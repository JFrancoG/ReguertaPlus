import type {sheets_v4 as SheetsV4} from "googleapis";
import {randomUUID} from "node:crypto";
import {DocumentSnapshot, FieldPath, Firestore, Transaction, Timestamp} from
  "@google-cloud/firestore";
import {coverageId, rejectCoverage} from "./shift-coverage.js";
import {releaseCoverageInbox} from "./shift-coverage-inbox.js";
import {coverageSheetRow, ShiftCoverageEffects} from
  "./shift-coverage-effects.js";
import {createProvisionalCreditFirestore} from "./shift-credit-publication.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {encodeShiftPlanningFirestoreValue,
  parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {assertShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {createShiftSheetsMemberResolver, readShiftSheetsImport,
  ShiftSheetsImportTab} from
  "./shift-sheets-import.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {ShiftCoverageStoreContext} from "./shift-coverage-store-context.js";
import {parseShiftPlanningWorkbookPartition} from
  "./shift-planning-firestore-sync-command-repository.js";
import {parseShiftCoverageSheetsSubmission,
  parseShiftSheetsWorkbookSubmission, requireShiftSheetsWorkbookVersion,
  ShiftCoverageSheetsSubmission} from "./shift-planning-sheets-submission.js";
import {createShiftSheetsAdapter, ShiftSheetsHumanWriteBackRow,
  ShiftSheetsProjectionRow} from "./shift-sheets.js";

export type CoverageSubmission = {
  operationId: string; rows: ShiftSheetsProjectionRow[];
  humanRows: ShiftSheetsHumanWriteBackRow[]; sourceDigest: string};

const receiptDigest = (value: unknown) => digest(
  encodeShiftPlanningFirestoreValue(value, "coverage workbook", new Set()),
);

/**
 * Rechecks the shared pointer and exact partition fence without renewing it.
 * @param {object} input Current policy, pointer and immutable claim.
 * @return {object} References and partitions owned by this exact claim.
 */
export const requireCoverageWorkbookOwnership = (input: {
  policy: DocumentSnapshot;
  pointer: DocumentSnapshot;
  receipt: ShiftCoverageSheetsSubmission;
}) => {
  const {receipt, policy, pointer} = input;
  if (!pointer.exists || receiptDigest(pointer.data()) !==
      receiptDigest(receipt) ||
      policy.data()?.environment !== receipt.environment) {
    return rejectCoverage("coverage_effects_workbook_reserved");
  }
  const partitions = receipt.claim.partitions.map((claim) => {
    const partition = parseShiftPlanningWorkbookPartition(
      policy.data()?.sync?.partitions?.[claim.type],
    );
    const lease = partition.lease;
    if (partition.workbookId !== receipt.workbookId ||
        partition.partitionKey !== claim.partitionKey ||
        partition.stateRevision !== claim.stateRevision ||
        partition.epoch !== claim.epoch ||
        lease?.ownerOperationId !== receipt.operationId ||
        lease.leaseEpoch !== claim.epoch || lease.state !== "claimed" ||
        lease.acquiredAtMillis !== receipt.claim.acquiredAt.toMillis() ||
        lease.deadlineAtMillis !== receipt.claim.expiresAt.toMillis()) {
      return rejectCoverage("coverage_effects_lease_changed");
    }
    return {type: claim.type, partition};
  });
  return {policy: policy.ref, pointer: pointer.ref, partitions};
};

/**
 * Verified read-back releases only the named claim, retaining its receipt.
 * @param {object} input Owning transaction, claim and verified read-back.
 * @return {object} Immutable terminal workbook receipt.
 */
export const completeCoverageWorkbook = (input: {
  tx: Transaction;
  owned: ReturnType<typeof requireCoverageWorkbookOwnership>;
  receipt: ShiftCoverageSheetsSubmission;
  evidence: NonNullable<ShiftCoverageSheetsSubmission["evidence"]>;
}) => {
  const verified = parseShiftCoverageSheetsSubmission({
    ...input.receipt, evidence: input.evidence,
  });
  for (const {type, partition} of input.owned.partitions) {
    input.tx.update(input.owned.policy,
      new FieldPath("sync", "partitions", type), {...partition,
        stateRevision: partition.stateRevision + 1,
        workbookRevision: input.evidence.workbookRevision, lease: null});
  }
  input.tx.set(input.owned.pointer, verified);
  return verified;
};

type CoverageEffectsInput = {
  config: ShiftSheetsConfig;
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get" | "batchUpdate">;
  tabs: readonly ShiftSheetsImportTab[];
  readWorkbookVersion(): Promise<string>;
  nowMillis(): number;
};

/**
 * HU-083 owns exact-cell patches and read-back. This worker shares its workbook
 * pointer and partition fences, recording the possible batch before external
 * I/O. A recorded batch is inspect-only even after expiry; unresolved results
 * freeze for governed recovery. The caller retains ownership of its SDK client.
 * @param {object} input SDK, readiness, reviewed layout and trusted lease.
 * @return {object} Drain one operation without constructing cloud clients.
 */
export const createFirestoreShiftCoverageEffectsWorker = (
  input: CoverageEffectsInput & {
    firestore: Firestore;
    context: ShiftCoverageStoreContext;
    leaseDurationMillis: number;
  },
) => {
  if (input.config.environment !== input.context.environment ||
      !Number.isSafeInteger(input.leaseDurationMillis) ||
      input.leaseDurationMillis <= 0) {
    return rejectCoverage("coverage_effects_configuration_invalid");
  }
  const db = input.firestore;
  const root = `${input.context.environment}/plus-collections`;
  const reservation = db.doc(`${root}/shiftPlanningState/sheetsSubmission`);
  const policyReference = db.doc(`${root}/shiftPlanningState/sourcePolicy`);
  const workerId = randomUUID();
  const clock = () => {
    const now = input.nowMillis();
    if (!Number.isSafeInteger(now) || now < 0 ||
        !Number.isSafeInteger(now + input.leaseDurationMillis)) {
      return rejectCoverage("invalid_coverage_clock");
    }
    return now;
  };
  const adapter = createShiftSheetsAdapter(input);
  const effectRef = (id: string) =>
    db.doc(`${root}/shiftCoverageEffects/${id}`);
  const load = async (tx: Transaction, id: string) => {
    await input.context.requireReady(tx);
    const [effect, receipt, maintenance, lock, policy] = await tx.getAll(
      effectRef(id),
      db.doc(`${root}/shiftCoverageOperations/${id}`),
      db.doc(`${root}/shiftPlanningState/current`), reservation,
      policyReference);
    const record = effect.data();
    const value = record?.value as ShiftCoverageEffects | undefined;
    if (!value) return rejectCoverage("coverage_effects_missing");
    const {effectsDigest, ...core} = value;
    if (value.operationId !== id ||
      value.environment !== input.context.environment ||
      value.schemaVersion !== 1 || effectsDigest !== digest(core) ||
      receipt.data()?.effectsDigest !== effectsDigest) {
      return rejectCoverage("coverage_effects_changed");
    }
    if (record?.state === "completed") {
      return {completed: true as const, value};
    }
    if (record?.state === "reconciliationRequired") {
      return {completed: false as const, frozen: true as const, value};
    }
    if (record?.state === "retired") {
      return rejectCoverage("coverage_effects_retired");
    }
    if (record?.state !== "pending") {
      return rejectCoverage("coverage_effects_changed");
    }
    assertShiftPlanningWriterAuthority({capturedValue: record?.authority,
      currentStateValue: maintenance.data(),
      changedCode: "coverage_effects_authority_changed",
      changedMessage: "Coverage effects lost their writer authority"});
    const current = await tx.get(db.doc(
      `${root}/shiftCoverageCases/${value.caseId}`));
    if (current.data()?.digest !== value.caseDigest ||
      digest(current.data()?.value) !== value.caseDigest) {
      return rejectCoverage("coverage_effects_superseded");
    }
    if (value.action.startsWith("offer") &&
      current.data()?.value.offer?.expiresAtMillis <= input.nowMillis()) {
      return rejectCoverage("coverage_effects_expired");
    }
    const [shifts, users, calendar] = await Promise.all([
      tx.get(db.collection(`${root}/shifts`).limit(501)),
      tx.get(db.collection(`${root}/users`).limit(501)),
      tx.get(db.collection(`${root}/deliveryCalendar`).limit(501)),
    ]);
    if ([shifts, users, calendar].some((s) => s.size > 500)) {
      return rejectCoverage("coverage_effects_source_limit");
    }
    const rows = shifts.docs.map((doc) => coverageSheetRow(doc.id,
      parseShiftPlanningPublicShiftDocument({targetPath: doc.ref.path,
        value: doc.data()})));
    for (const change of value.changes) {
      if (digest(rows.find((row) => row.id === change.after.id)) !==
        digest(change.after)) {
        return rejectCoverage("coverage_effects_source_changed");
      }
    }
    const sourceDigest = digest([shifts, users, calendar].map((s) =>
      s.docs.map((doc) => [doc.id, doc.updateTime?.seconds,
        doc.updateTime?.nanoseconds])));
    const submission = record?.submission as CoverageSubmission | undefined;
    if (submission && (submission.sourceDigest !== sourceDigest ||
      digest(submission) !== record?.submissionDigest)) {
      return rejectCoverage("coverage_effects_source_changed");
    }
    const workbook = record?.workbookSubmission ?
      parseShiftCoverageSheetsSubmission(record.workbookSubmission) : null;
    if (submission && !workbook) {
      return rejectCoverage("coverage_effects_receipt_required");
    }
    if (workbook && (workbook.operationId !== id ||
        workbook.effectsDigest !== effectsDigest ||
        workbook.sourceDigest !== sourceDigest ||
        workbook.environment !== input.context.environment ||
        workbook.workbookId !== input.config.workbookId ||
        digest(workbook.claim.partitions.map((p) => p.type).sort()) !==
          digest([...new Set(value.changes.map((c) => c.after.type))]
            .sort()))) {
      return rejectCoverage("coverage_effects_changed");
    }
    const owned = workbook ? requireCoverageWorkbookOwnership({
      policy, pointer: lock, receipt: workbook,
    }) : null;
    if (!workbook && value.changes.length && lock.exists) {
      const preceding = parseShiftSheetsWorkbookSubmission(lock.data());
      if (preceding.workbookId !== input.config.workbookId ||
          preceding.evidence === null) {
        return rejectCoverage("coverage_effects_workbook_reserved");
      }
    }
    return {completed: false as const, frozen: false as const,
      value, rows, users, calendar, sourceDigest, submission, workbook,
      owned, policy, lock};
  };

  return {
    async drain(operationId: string) {
      const id = coverageId(operationId);
      const attemptId = randomUUID();
      const source = await db.runTransaction((tx) => load(tx, id));
      if (source.completed) return {state: "completed", replayed: true};
      if (source.frozen) {
        return {state: "reconciliationRequired", replayed: true};
      }
      if (source.workbook &&
          source.workbook.claim.expiresAt.toMillis() > clock()) {
        return {state: "pending", replayed: false};
      }
      let submission = source.submission;
      let beforeWorkbookRevision = source.workbook?.beforeWorkbookRevision;
      if (source.value.changes.length && !source.workbook?.batch) {
        beforeWorkbookRevision = requireShiftSheetsWorkbookVersion(
          await input.readWorkbookVersion(),
        );
      }
      if (source.value.changes.length && !submission) {
        const members = source.users.docs.map((doc) => {
          const data = doc.data();
          return {userId: doc.id, names: [data.displayName as string],
            phones: [data.phoneNumber ?? data.phone ?? ""],
            eligibleTypes: ["delivery", "market"] as const};
        });
        if (members.some((m) => typeof m.names[0] !== "string" ||
            !m.names[0].trim() || typeof m.phones[0] !== "string")) {
          return rejectCoverage("coverage_effects_member_label_missing");
        }
        const resolver = createShiftSheetsMemberResolver(members);
        const baseline = source.rows.map((row) => source.value.changes
          .find((change) => change.before.id === row.id)?.before ?? row);
        const observation = await readShiftSheetsImport({
          config: input.config, sheets: input.sheets, tabs: input.tabs,
          baseline, members, readWorkbookVersion: input.readWorkbookVersion,
          deliveryCalendar: source.calendar.docs.filter((doc) =>
            doc.data().deliveryDate instanceof Timestamp).map((doc) => ({
            weekKey: doc.id, date: doc.data().deliveryDate.toDate()
              .toISOString().slice(0, 10)})),
        });
        const humanRows = source.value.changes.map((change) => {
          const human = observation.humanRows.find((r) =>
            r.id === change.after.id);
          const observed = observation.assignments.find((r) =>
            r.id === change.after.id);
          if (!human || !observed ||
              ![change.before, change.after].some((row) =>
                digest(row.assignedUserIds) ===
                  digest(observed.assignedUserIds))) {
            return rejectCoverage("coverage_effects_manual_conflict");
          }
          const next = {...structuredClone(human),
            after: human.after.map((row) => ({values: [...row.values]}))};
          const delivery = change.after.type === "delivery";
          next.assignedUserIds = [...change.after.assignedUserIds];
          next.assignedUserIds.forEach((userId, index) => {
            const member = members.find((m) => m.userId === userId) ??
                rejectCoverage("coverage_effects_member_label_missing");
            if (resolver.resolve(member.names[0], member.phones[0]) !==
                userId) {
              return rejectCoverage("coverage_effects_member_label_missing");
            }
            const cells = next.after[delivery ? 0 : index + 1].values;
            cells[delivery ? 1 : 0] = {stringValue: member.names[0]};
            cells[delivery ? 2 : 1] = member.phones[0] ?
              {stringValue: member.phones[0]} : {};
          });
          if (next.helper) {
            const userId = change.after.helperUserId;
            const name = userId ? members.find((m) =>
              m.userId === userId)?.names[0] : "";
            if (name === undefined) {
              return rejectCoverage("coverage_effects_member_label_missing");
            }
            const oldName = change.before.helperUserId ? members.find((m) =>
              m.userId === change.before.helperUserId)?.names[0] : "";
            const actual = human.before[0].values[5].stringValue ?? "";
            if (![oldName, name].includes(actual)) {
              return rejectCoverage("coverage_effects_manual_conflict");
            }
            if (userId && resolver.resolve(name, "") !== userId) {
              return rejectCoverage("coverage_effects_member_label_missing");
            }
            next.helper = {userId, name};
            next.after[0].values[5] = name ? {stringValue: name} : {};
          }
          return next;
        });
        if (observation.workbookRevision !== beforeWorkbookRevision) {
          return rejectCoverage("coverage_effects_workbook_changed");
        }
        submission = {operationId: id,
          rows: source.value.changes.map((c) => c.after), humanRows,
          sourceDigest: source.sourceDigest};
      }
      if (source.value.changes.length && !submission) {
        return {state: "completed", replayed: true};
      }
      let workbook = source.workbook;
      if (submission && !workbook?.batch) {
        const prepared = submission;
        const before = beforeWorkbookRevision as string;
        workbook = await db.runTransaction(async (tx) => {
          const fresh = await load(tx, id);
          if (fresh.completed || fresh.frozen) return null;
          if (fresh.workbook?.batch) return fresh.workbook;
          const now = clock();
          if (fresh.workbook &&
              fresh.workbook.claim.expiresAt.toMillis() > now) return null;
          if (fresh.sourceDigest !== prepared.sourceDigest ||
              (fresh.submission && digest(fresh.submission) !==
                digest(prepared))) {
            return rejectCoverage("coverage_effects_source_changed");
          }
          const types = [...new Set(fresh.value.changes.map((c) =>
            c.after.type))].sort();
          const allPartitions = (["delivery", "market"] as const)
            .map((type) => ({type,
              value: parseShiftPlanningWorkbookPartition(
                fresh.policy.data()?.sync?.partitions?.[type],
              )}));
          const partitions = allPartitions.filter(({type}) =>
            types.includes(type));
          if (fresh.policy.data()?.environment !== input.context.environment ||
              allPartitions.some(({type, value}) =>
                value.workbookId !== input.config.workbookId ||
                value.stateRevision >= Number.MAX_SAFE_INTEGER - 1 ||
                value.epoch >= Number.MAX_SAFE_INTEGER - 1 ||
                (value.lease !== null && (!fresh.workbook ||
                  !fresh.workbook.claim.partitions.some((p) =>
                    p.type === type))))) {
            return rejectCoverage("coverage_effects_lease_changed");
          }
          let expectedVersion = partitions[0].value.workbookRevision;
          if (fresh.lock.exists && !fresh.workbook) {
            const preceding = parseShiftSheetsWorkbookSubmission(
              fresh.lock.data(),
            );
            expectedVersion = preceding.evidence?.workbookRevision ??
              rejectCoverage("coverage_effects_workbook_reserved");
          } else if (fresh.workbook) {
            expectedVersion = fresh.workbook.beforeWorkbookRevision;
          }
          if (before !== expectedVersion) {
            return rejectCoverage("coverage_effects_workbook_changed");
          }
          const claim = {workerId, attemptId,
            acquiredAt: Timestamp.fromMillis(now),
            expiresAt: Timestamp.fromMillis(now + input.leaseDurationMillis),
            partitions: partitions.map(({type, value}) => ({type,
              partitionKey: value.partitionKey,
              stateRevision: value.stateRevision + 1, epoch: value.epoch + 1})),
          };
          const receipt = parseShiftCoverageSheetsSubmission({
            schemaVersion: 1, kind: "coverageWriteBack",
            environment: input.context.environment,
            workbookId: input.config.workbookId, operationId: id,
            effectsDigest: fresh.value.effectsDigest,
            sourceDigest: fresh.sourceDigest,
            beforeWorkbookRevision: before, claim, batch: null, evidence: null,
          });
          for (const {type, value} of partitions) {
            const field = new FieldPath("sync", "partitions", type);
            tx.update(policyReference, field,
              {...value, stateRevision: value.stateRevision + 1,
                epoch: value.epoch + 1, lease: {ownerOperationId: id,
                  leaseEpoch: value.epoch + 1, state: "claimed",
                  acquiredAtMillis: now,
                  deadlineAtMillis: now + input.leaseDurationMillis}});
          }
          tx.set(reservation, receipt);
          tx.update(effectRef(id), {submission: prepared,
            submissionDigest: digest(prepared), workbookSubmission: receipt});
          return receipt;
        });
        if (!workbook) return {state: "pending", replayed: false};
      }
      if (workbook?.batch && workbook.claim.expiresAt.toMillis() > clock()) {
        return {state: "pending", replayed: false};
      }
      const inspect = async () => {
        if (!submission || !workbook?.batch) return null;
        const beforeRead = requireShiftSheetsWorkbookVersion(
          await input.readWorkbookVersion(),
        );
        const observed = await adapter.inspect(submission);
        const afterRead = requireShiftSheetsWorkbookVersion(
          await input.readWorkbookVersion(),
        );
        if (beforeRead !== afterRead || observed.kind !== "verified" ||
            observed.readBackDigest !== workbook.batch.projectionDigest ||
            BigInt(afterRead) <= BigInt(workbook.beforeWorkbookRevision)) {
          return null;
        }
        return {projection: observed, evidence: {
          workbookRevision: afterRead,
          partitionDigest: digest({
            projectionDigest: workbook.batch.projectionDigest,
          }),
        }};
      };
      if (submission && workbook && !workbook.batch) {
        // Only this claim may admit a first batch. The durable receipt is
        // committed immediately before I/O; it is never permission to retry.
        const claim = workbook.claim;
        if (claim.workerId !== workerId || claim.attemptId !== attemptId) {
          return {state: "pending", replayed: false};
        }
        await adapter.reconcile({...submission,
          authorizeMutation: async (batch) => {
            const currentVersion = requireShiftSheetsWorkbookVersion(
              await input.readWorkbookVersion(),
            );
            workbook = await db.runTransaction(async (tx) => {
              const fresh = await load(tx, id);
              if (fresh.completed || fresh.frozen || !fresh.workbook ||
                  fresh.workbook.batch ||
                  receiptDigest(fresh.workbook.claim) !==
                    receiptDigest(claim) ||
                  clock() >= claim.expiresAt.toMillis() ||
                  currentVersion !== fresh.workbook.beforeWorkbookRevision ||
                  batch.workbookId !== fresh.workbook.workbookId) {
                return rejectCoverage("coverage_effects_lease_changed");
              }
              const receipt = parseShiftCoverageSheetsSubmission({
                ...fresh.workbook, batch: {
                  projectionDigest: batch.projectionDigest,
                  requestDigest: batch.requestDigest,
                  submittedAt: Timestamp.fromMillis(clock()),
                },
              });
              tx.update(effectRef(id), {workbookSubmission: receipt});
              tx.set(reservation, receipt);
              return receipt;
            });
          },
        });
      }
      const observed = submission ? await inspect().catch(() => null) : null;
      if (submission && !observed) {
        return db.runTransaction(async (tx) => {
          const fresh = await load(tx, id);
          if (fresh.completed) return {state: "completed", replayed: true};
          if (!fresh.frozen) {
            if (!fresh.workbook?.batch) {
              return rejectCoverage("coverage_effects_readback_required");
            }
            tx.update(effectRef(id), {state: "reconciliationRequired"});
          }
          return {state: "reconciliationRequired", replayed: false};
        });
      }
      return db.runTransaction(async (tx) => {
        const fresh = await load(tx, id);
        if (fresh.completed) return {state: "completed", replayed: true};
        if (fresh.frozen) {
          return {state: "reconciliationRequired", replayed: true};
        }
        if (fresh.value.changes.length && (!observed || !fresh.workbook ||
            !fresh.owned || receiptDigest(fresh.workbook) !==
              receiptDigest(workbook))) {
          return rejectCoverage("coverage_effects_readback_required");
        }
        const now = clock();
        const deliveredTo = releaseCoverageInbox({
          db, tx, value: fresh.value, users: fresh.users, now,
        });
        const verified = observed && fresh.workbook && fresh.owned ?
          completeCoverageWorkbook({tx, owned: fresh.owned,
            receipt: fresh.workbook, evidence: observed.evidence}) : null;
        tx.update(effectRef(id), {state: "completed",
          projection: observed?.projection ?? null,
          ...(verified ? {workbookSubmission: verified} : {}),
          completedAt: Timestamp.fromMillis(now), deliveredTo});
        return {state: "completed", replayed: false};
      });
    },
  };
};

/**
 * Fixed local composition; the injected factory never owns its SDK client.
 * @param {object} input Local API fixture and reviewed workbook layout.
 * @return {object} Worker and explicit cleanup for its owned local SDK.
 */
export const createProvisionalCoverageEffectsWorker = (
  input: CoverageEffectsInput,
) => {
  if (input.config.environment !== "develop" ||
      input.config.workbookId !== "coverage-rehearsal-book") {
    return rejectCoverage("coverage_effects_local_workbook_required");
  }
  const firestore = createProvisionalCreditFirestore();
  const worker = createFirestoreShiftCoverageEffectsWorker({...input,
    firestore, context: {environment: "develop",
      requireReady: async () => undefined},
    leaseDurationMillis: 60_000});
  return {...worker, close: () => firestore.terminate()};
};
