import {DocumentSnapshot, FieldPath, Firestore, Timestamp, Transaction} from
  "@google-cloud/firestore";
import type {sheets_v4 as SheetsV4} from "googleapis";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {inspectShiftPlanningNotificationWriterFences} from
  "./shift-planning-firestore-notification-writer-fence.js";
import {
  attachShiftPlanningControlledMutationMarker,
  createShiftPlanningControlledMutationOperationTerminal,
  parseShiftPlanningControlledMutationOperationTerminal,
} from "./shift-planning-public-event-contract.js";
import {
  ShiftPlanningPublicShiftDocument,
  createShiftPlanningPublicShiftMaterialization,
  encodeShiftPlanningFirestoreValue,
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  ShiftPlanningPublicEventRetentionPolicy,
  createShiftPlanningPublicEventOperationRetention,
  parseShiftPlanningPublicEventOperationRetention,
  parseShiftPlanningPublicEventRetentionPolicy,
  shiftPlanningPublicEventOperationRetentionPath,
} from "./shift-planning-public-event-retention.js";
import {
  parseShiftSheetsImportSubmission,
  parseShiftSheetsWorkbookSubmission,
  requireShiftSheetsWorkbookVersion,
} from "./shift-planning-sheets-submission.js";
import {parseShiftPlanningWorkbookPartition} from
  "./shift-planning-firestore-sync-command-repository.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {parseShiftRotationAggregateWire} from "./shift-planning-wire.js";
import {ShiftSheetsConfig, createShiftSheetsConfig} from
  "./shift-sheets-config.js";
import {
  ShiftSheetsImportMember,
  ShiftSheetsImportTab,
  failShiftSheetsImport,
  readShiftSheetsImport,
} from "./shift-sheets-import.js";
import {
  ShiftSheetsImportSource,
  planShiftSheetsImport,
} from "./shift-sheets-import-plan.js";
import {
  SHIFT_SHEETS_LIMITS, ShiftSheetsProjectionRow, createShiftSheetsAdapter,
} from "./shift-sheets.js";

const MAX_PATCHES = 100;
type ImportPlan = ReturnType<typeof planShiftSheetsImport>;
type Observation = Awaited<ReturnType<typeof readShiftSheetsImport>>;
type ImportResult = {
  commandDigest: string;
  planDigest: string;
  operationIntentDigest: string;
  writeBackRows: ShiftSheetsProjectionRow[];
  writeBackState: "pending";
  resultDigest: string;
};
type PreparedImport = {
  schemaVersion: 1;
  operationId: string;
  configurationDigest: string;
  sourceDigest: string;
  observation: Observation;
  plan: ImportPlan;
  commandDigest: string;
};

const digest = createShiftPlanningDigest;
const encodedDigest = (value: unknown) => digest(
  encodeShiftPlanningFirestoreValue(value, "import source", new Set()),
);
const projectRow = (id: string, doc: ShiftPlanningPublicShiftDocument):
  ShiftSheetsProjectionRow => ({
  id, type: doc.type, date: doc.date.toDate().toISOString().slice(0, 10),
  rotationOwnerUserIds: doc.rotationOwnerUserIds ??
    [doc.rotationOwnerUserId as string],
  assignedUserIds: doc.assignedUserIds,
  helperUserId: doc.helperUserId, status: doc.status,
  source: doc.source, origin: doc.origin,
});

const parseMember = (snapshot: DocumentSnapshot): ShiftSheetsImportMember => {
  const value = snapshot.data();
  if (!value || !Array.isArray(value.roles) || !value.roles.length ||
    value.roles.some((role) =>
      !["member", "producer", "admin"].includes(role)) ||
    new Set(value.roles).size !== value.roles.length ||
    !value.roles.includes("member") ||
    typeof value.isActive !== "boolean" ||
    typeof value.isCommonPurchaseManager !== "boolean" ||
    typeof value.displayName !== "string" || !value.displayName.trim() ||
    ["phoneNumber", "phone", "telephone", "telefono"].some((key) =>
      value[key] != null && typeof value[key] !== "string")) {
    return failShiftSheetsImport("Member authority is incomplete.");
  }
  // Match the canonical member writer and its explicit legacy aliases.
  const phone = ["phoneNumber", "phone", "telephone", "telefono"]
    .map((key) => value[key] as string | undefined)
    .find((candidate) => candidate?.trim());
  return {
    userId: snapshot.id,
    names: [snapshot.id, value.displayName],
    phones: phone ? [phone] : [],
    eligibleTypes: isEligibleForShiftRotation({
      roles: value.roles, isActive: value.isActive,
      isCommonPurchaseManager: value.isCommonPurchaseManager,
    }) ? ["delivery", "market"] : [],
  };
};

const parsePrepared = (value: unknown): PreparedImport => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failShiftSheetsImport("Import has no prepared command.");
  }
  const record = value as PreparedImport;
  const {commandDigest, ...body} = record;
  if (Object.keys(record).length !== 7 || record.schemaVersion !== 1 ||
    digest(body) !== commandDigest) {
    return failShiftSheetsImport("Prepared import command was changed.");
  }
  const {planDigest, ...planBody} = record.plan;
  if (digest(planBody) !== planDigest) {
    return failShiftSheetsImport("Prepared import plan was changed.");
  }
  return record;
};

/**
 * Internal preparation/apply/write-back behind the private import handler.
 * Preparation owns source loading and persists the exact reviewed plan. Apply
 * re-reads the full bounded queries, so edits, deletions and inserted neighbors
 * participate in the same transaction as source/eligibility/fence checks.
 * Sheets observation still requires an external-writer fence at live rollout;
 * Drive version checks are observations and cannot make Sheets part of this
 * CAS.
 * @param {object} input Trusted pinned configuration, APIs and backend clock.
 * @return {object} Explicit prepare/apply/write-back, never notifications.
 */
export const createFirestoreShiftSheetsImport = (input: {
  firestore: Firestore;
  config: ShiftSheetsConfig;
  tabs: readonly ShiftSheetsImportTab[];
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get" | "batchUpdate">;
  readWorkbookVersion(): Promise<string>;
  clock?: () => Timestamp;
  retentionPolicy: ShiftPlanningPublicEventRetentionPolicy;
}) => {
  const {firestore, sheets} = input;
  const config = createShiftSheetsConfig({
    environment: input.config.environment,
    workbooks: {[input.config.environment]: input.config.workbookId},
    aliases: input.config.aliases,
  });
  const tabs = structuredClone(input.tabs);
  const retentionPolicy = parseShiftPlanningPublicEventRetentionPolicy(
    input.retentionPolicy,
  );
  const configurationDigest = digest({config, tabs, retentionPolicy});
  const root = `${config.environment}/plus-collections`;
  const clock = input.clock ?? (() => Timestamp.now());
  const workbookReference = firestore.doc(
    `${root}/shiftPlanningState/sheetsSubmission`,
  );
  const adapter = createShiftSheetsAdapter({config, sheets});
  const references = (operationId: string) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(operationId)) {
      return failShiftSheetsImport("Import operation ID is invalid.");
    }
    const operation = firestore.doc(
      `${root}/shiftPlanningOperations/sheets-import-${operationId}`,
    );
    const retention = firestore.doc(
      shiftPlanningPublicEventOperationRetentionPath({
        environment: config.environment, operationId: operation.id,
      }),
    );
    return {operation, retention,
      command: operation.collection("sheetsImport").doc("prepared"),
      result: operation.collection("sheetsImport").doc("result"),
      submission: operation.collection("sheetsImport").doc("submission")};
  };
  const bindCommand = (snapshot: DocumentSnapshot, operationId: string) => {
    const command = parsePrepared(snapshot.data());
    if (command.operationId !== operationId ||
      command.configurationDigest !== configurationDigest) {
      return failShiftSheetsImport("Import command targets another context.");
    }
    return command;
  };
  const loadSource = async (
    transaction: Transaction, ownImportId?: string,
  ) => {
    const stateReferences = ["shiftPlanningState/current",
      "shiftPlanningState/sourcePolicy", "shiftRotations/delivery",
      "shiftRotations/market", "shiftPlanningState/sheetsSubmission"]
      .map((path) => firestore.doc(`${root}/${path}`));
    const [states, shifts, users, pending, calendar] = await Promise.all([
      transaction.getAll(...stateReferences),
      transaction.get(firestore.collection(`${root}/shifts`)
        .orderBy("__name__").limit(SHIFT_SHEETS_LIMITS.projectionRows + 1)),
      transaction.get(firestore.collection(`${root}/users`)
        .orderBy("__name__").limit(SHIFT_SHEETS_LIMITS.projectionRows + 1)),
      transaction.get(firestore.collection(`${root}/shiftPlanningSyncCommands`)
        .where("state", "in", ["pending", "processing"]).limit(1)),
      transaction.get(firestore.collection(`${root}/deliveryCalendar`)
        .orderBy("__name__").limit(SHIFT_SHEETS_LIMITS.projectionRows + 1)),
    ]);
    if (!shifts.size || shifts.size + users.size >
      SHIFT_SHEETS_LIMITS.projectionRows || !pending.empty ||
      calendar.size > SHIFT_SHEETS_LIMITS.projectionRows) {
      return failShiftSheetsImport(
        "Import source is oversized or sync is pending.",
      );
    }
    const authority = captureShiftPlanningWriterAuthority(states[0].data());
    if (!authority || !authority.activeRevision || !authority.activeDigest) {
      return failShiftSheetsImport(
        "Import requires open active planning state.",
      );
    }
    const policy = states[1].data();
    for (const [index, type] of ["delivery", "market"].entries()) {
      const rotation = parseShiftRotationAggregateWire(
        states[index + 2].data(), type as "delivery" | "market",
      );
      const partition = parseShiftPlanningWorkbookPartition(
        policy?.sync?.partitions?.[type],
      );
      if (rotation.releaseLease !== null ||
        rotation.activeRevision !== authority.activeRevision ||
        rotation.activeDigest !== authority.activeDigest ||
        policy?.environment !== config.environment ||
        partition?.workbookId !== config.workbookId ||
        partition?.lease !== null) {
        return failShiftSheetsImport(
          "Rotation or workbook is not free to import.",
        );
      }
    }
    if (states[4].exists) {
      const current = parseShiftSheetsWorkbookSubmission(states[4].data());
      if (current.workbookId !== config.workbookId ||
        (current.evidence === null &&
          current.importOperationId !== ownImportId)) {
        return failShiftSheetsImport("A Sheets submission remains unresolved.");
      }
    }
    const documents = new Map(shifts.docs.map((snapshot) => [snapshot.id,
      parseShiftPlanningPublicShiftDocument({
        targetPath: snapshot.ref.path, value: snapshot.data(),
      })]));
    const source: ShiftSheetsImportSource[] = [...documents]
      .map(([id, doc]) => ({
        row: projectRow(id, doc), documentRevision: doc.documentRevision,
        assignmentRevision: doc.assignmentRevision,
        completionRevision: doc.completion.revision,
        completed: doc.completion.state === "completed",
      }));
    const sourceDigest = encodedDigest(
      [...states, ...shifts.docs, ...users.docs, ...calendar.docs]
        .map((snapshot) => ({
          path: snapshot.ref.path, updateTime: snapshot.updateTime ?? null,
          value: snapshot.data() ?? null,
        })),
    );
    return {authority: {...authority,
      activeRevision: authority.activeRevision,
      activeDigest: authority.activeDigest}, source, sourceDigest, documents,
    members: users.docs.map(parseMember),
    deliveryCalendar: calendar.docs.map((snapshot) => {
      const date = snapshot.get("deliveryDate");
      if (!(date instanceof Timestamp) ||
        (snapshot.get("weekKey") != null &&
          snapshot.get("weekKey") !== snapshot.id)) {
        return failShiftSheetsImport("Stored delivery calendar is invalid.");
      }
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
        day: "2-digit",
      }).formatToParts(date.toDate());
      const part = (type: string) =>
        parts.find((item) => item.type === type)?.value;
      return {weekKey: snapshot.id,
        date: `${part("year")}-${part("month")}-${part("day")}`};
    })};
  };
  const resultFor = (
    result: DocumentSnapshot,
    operation: DocumentSnapshot,
    retention: DocumentSnapshot,
    command: PreparedImport,
  ): ImportResult => {
    const terminal = parseShiftPlanningControlledMutationOperationTerminal(
      operation.data(),
    );
    const retained = parseShiftPlanningPublicEventOperationRetention(
      retention.data(),
    );
    const record = result.data();
    const expectedRows = command.plan.patches.map((patch) => {
      const guard = command.plan.sourceGuards.find(
        ({row}) => row.id === patch.id,
      );
      if (!guard) return failShiftSheetsImport("Result has no source guard.");
      return {...guard.row, ...patch};
    });
    if (terminal.kind !== "syncCorrection" ||
      retained.operationId !== terminal.operationId ||
      retained.operationIntentDigest !== terminal.operationIntentDigest ||
      retained.policyDigest !== retentionPolicy.policyDigest ||
      !record || record.commandDigest !== command.commandDigest ||
      record.planDigest !== command.plan.planDigest ||
      record.writeBackState !== "pending" ||
      digest(record.writeBackRows) !== digest(expectedRows) ||
      digest(terminal.publicMutations.map((item) => item.targetPath)) !==
        digest(expectedRows.map((row) => `${root}/shifts/${row.id}`)) ||
      record.operationIntentDigest !== terminal.operationIntentDigest ||
      terminal.operationId !== operation.id ||
      terminal.environment !== config.environment ||
      record.resultDigest !== encodedDigest({
        commandDigest: record.commandDigest, planDigest: record.planDigest,
        operationIntentDigest: record.operationIntentDigest,
        writeBackRows: record.writeBackRows,
        writeBackState: record.writeBackState,
      })) {
      return failShiftSheetsImport(
        "Import result is not an exact terminal replay.",
      );
    }
    return record as ImportResult;
  };
  const readWriteBack = async (
    transaction: Transaction, operationId: string, planDigest: string,
  ) => {
    const refs = references(operationId);
    const [prepared, result, operation, retention, submitted, workbook] =
      await transaction.getAll(refs.command, refs.result, refs.operation,
        refs.retention, refs.submission, workbookReference);
    const command = bindCommand(prepared, operationId);
    const record = resultFor(result, operation, retention, command);
    const receipt = parseShiftSheetsImportSubmission(submitted.data());
    if (command.plan.planDigest !== planDigest ||
      receipt.planDigest !== planDigest ||
      receipt.resultDigest !== record.resultDigest ||
      receipt.environment !== config.environment ||
      receipt.workbookId !== config.workbookId ||
      receipt.operationId !== refs.operation.id ||
      receipt.beforeWorkbookRevision !== command.observation.workbookRevision) {
      return failShiftSheetsImport("Write-back is not bound to its import.");
    }
    // Once acknowledged, replay never reopens the reservation or reads Google.
    if (receipt.evidence) return {refs, command, record, receipt};
    if (encodedDigest(workbook.data()) !== encodedDigest(receipt)) {
      return failShiftSheetsImport("Import lost its workbook reservation.");
    }
    const live = await loadSource(transaction, refs.operation.id);
    const terminal = parseShiftPlanningControlledMutationOperationTerminal(
      operation.data(),
    );
    const originalRows = live.source.map((item) =>
      command.plan.patches.some((patch) => patch.id === item.row.id) ?
        command.plan.sourceGuards.find((guard) =>
          guard.row.id === item.row.id)?.row : item.row);
    if (live.authority.activeRevision !== terminal.bundleRevision ||
      live.authority.activeDigest !== terminal.bundleDigest ||
      live.authority.writeEpoch !== terminal.writeEpoch ||
      digest(live.members) !== command.observation.membershipDigest ||
      digest(originalRows) !== command.observation.baselineDigest) {
      return failShiftSheetsImport("Import source changed before write-back.");
    }
    for (const binding of terminal.publicMutations) {
      const doc = parseShiftPlanningPublicShiftDocument({
        targetPath: binding.targetPath,
        value: live.documents.get(binding.targetPath.split("/").pop() ?? ""),
        expectedOperationIntentDigest: terminal.operationIntentDigest,
      });
      if (doc.documentRevision !== binding.documentRevision ||
        doc.lastBackendMutation.operationId !== terminal.operationId ||
        doc.lastBackendMutation.payloadDigest !== binding.payloadDigest) {
        return failShiftSheetsImport("Import row changed after commit.");
      }
    }
    for (const guard of command.plan.sourceGuards) {
      if (command.plan.patches.some((patch) => patch.id === guard.row.id)) {
        continue;
      }
      const current = live.source.find((item) => item.row.id === guard.row.id);
      if (digest(current) !== digest(guard)) {
        return failShiftSheetsImport("Import neighbor changed after commit.");
      }
    }
    const fence = await inspectShiftPlanningNotificationWriterFences({
      firestore, transaction, root, now: clock(),
      resources: command.plan.sourceGuards.map(({row}) =>
        ({scope: "shift" as const, resourceId: row.id})),
    });
    if (fence.kind === "busy") {
      return failShiftSheetsImport("Notification fence blocks write-back.");
    }
    return {refs, command, record, receipt};
  };
  return {
    async prepare(operationId: string) {
      const refs = references(operationId);
      const existing = await refs.command.get();
      if (existing.exists) {
        return {kind: "prepared" as const,
          plan: bindCommand(existing, operationId).plan};
      }
      const initial = await firestore.runTransaction(loadSource);
      const observation = await readShiftSheetsImport({config, sheets, tabs,
        baseline: initial.source.map((item) => item.row),
        members: initial.members,
        deliveryCalendar: initial.deliveryCalendar,
        readWorkbookVersion: input.readWorkbookVersion});
      const plan = planShiftSheetsImport({observation, source: initial.source});

      if (plan.patches.length > MAX_PATCHES) {
        return failShiftSheetsImport("Import exceeds the atomic patch budget.");
      }
      const body = {schemaVersion: 1 as const, operationId,
        configurationDigest, sourceDigest: initial.sourceDigest,
        observation, plan};
      const command = {...body, commandDigest: digest(body)};
      if (Buffer.byteLength(JSON.stringify(command)) >
        SHIFT_SHEETS_LIMITS.requestBytes) {
        return failShiftSheetsImport(
          "Prepared import exceeds the document budget.",
        );
      }
      await firestore.runTransaction(async (transaction) => {
        const [current, terminal] = await transaction.getAll(
          refs.command, refs.operation,
        );
        if (current.exists) {
          if (bindCommand(current, operationId).commandDigest !==
            command.commandDigest) {
            return failShiftSheetsImport("Import ID already has another plan.");
          }
          return;
        }
        if (terminal.exists) {
          return failShiftSheetsImport(
            "Import operation ID already has a terminal.",
          );
        }
        const fresh = await loadSource(transaction);
        if (fresh.sourceDigest !== initial.sourceDigest) {
          return failShiftSheetsImport("Source changed while reading Sheets.");
        }
        if (plan.patches.length) transaction.create(refs.command, command);
      });
      return plan.patches.length ? {kind: "prepared" as const, plan} :
        {kind: "unchanged" as const, plan};
    },
    async writeBack(operationId: string, expectedPlanDigest: string) {
      const read = (transaction: Transaction) =>
        readWriteBack(transaction, operationId, expectedPlanDigest);
      const initial = await firestore.runTransaction(read);
      if (initial.receipt.evidence) {
        return {kind: "replayed" as const, evidence: initial.receipt.evidence};
      }
      const operation = {operationId: initial.refs.operation.id,
        rows: initial.record.writeBackRows};
      if (initial.receipt.batch === null) {
        const before = requireShiftSheetsWorkbookVersion(
          await input.readWorkbookVersion(),
        );
        if (before !== initial.receipt.beforeWorkbookRevision) {
          return failShiftSheetsImport("Workbook changed before write-back.");
        }
        await adapter.reconcile({...operation,
          reviewedRows: initial.command.observation.canonicalRows
            .filter((row) => operation.rows.some((target) =>
              target.id === row.id)),
          async authorizeMutation(binding) {
            if (binding.workbookId !== config.workbookId ||
              await input.readWorkbookVersion() !== before) {
              return failShiftSheetsImport("Workbook changed during planning.");
            }
            await firestore.runTransaction(async (transaction) => {
              const live = await read(transaction);
              if (live.receipt.batch !== null) {
                return failShiftSheetsImport(
                  "Submitted import is inspect-only.",
                );
              }
              const receipt = parseShiftSheetsImportSubmission({
                ...live.receipt, batch: {
                  projectionDigest: binding.projectionDigest,
                  requestDigest: binding.requestDigest, submittedAt: clock(),
                },
              });
              transaction.set(live.refs.submission, receipt);
              transaction.set(workbookReference, receipt);
            });
          },
        });
      }
      const submitted = await firestore.runTransaction(read);
      if (submitted.receipt.evidence) {
        return {kind: "replayed" as const,
          evidence: submitted.receipt.evidence};
      }
      const batch = submitted.receipt.batch;
      if (!batch) {
        return failShiftSheetsImport(
          "Sheets marker has no recorded submission.",
        );
      }
      let version: string;
      let observed;
      try {
        const before = requireShiftSheetsWorkbookVersion(
          await input.readWorkbookVersion(),
        );
        observed = await adapter.inspect(operation);
        version = requireShiftSheetsWorkbookVersion(
          await input.readWorkbookVersion(),
        );
        if (before !== version || observed.kind !== "verified" ||
          observed.readBackDigest !== batch.projectionDigest ||
          BigInt(version) <= BigInt(submitted.receipt.beforeWorkbookRevision)) {
          return {kind: "reconciliationRequired" as const};
        }
      } catch {
        return {kind: "reconciliationRequired" as const};
      }
      const evidence = {workbookRevision: version,
        partitionDigest: digest({projectionDigest: observed.readBackDigest})};
      return firestore.runTransaction(async (transaction) => {
        const live = await read(transaction);
        if (live.receipt.evidence) {
          return {kind: "replayed" as const, evidence: live.receipt.evidence};
        }
        if (encodedDigest(live.receipt) !== encodedDigest(submitted.receipt)) {
          return failShiftSheetsImport("Submission changed during read-back.");
        }
        const policyReference = firestore.doc(
          `${root}/shiftPlanningState/sourcePolicy`,
        );
        const policy = await transaction.get(policyReference);
        const partitions = (["delivery", "market"] as const).map((type) => {
          const partition = parseShiftPlanningWorkbookPartition(
            policy.get(`sync.partitions.${type}`),
          );
          if (partition.stateRevision >= Number.MAX_SAFE_INTEGER) {
            return failShiftSheetsImport("Workbook state revision exhausted.");
          }
          return {type, partition: {...partition,
            stateRevision: partition.stateRevision + 1,
            workbookRevision: evidence.workbookRevision}};
        });
        const receipt = parseShiftSheetsImportSubmission({
          ...live.receipt, evidence,
        });
        transaction.set(live.refs.submission, receipt);
        transaction.set(workbookReference, receipt);
        for (const {type, partition} of partitions) {
          transaction.update(policyReference,
            new FieldPath("sync", "partitions", type), partition);
        }
        return {kind: "completed" as const, evidence};
      });
    },
    async apply(operationId: string, expectedPlanDigest: string) {
      const refs = references(operationId);
      const command = bindCommand(await refs.command.get(), operationId);
      if (command.plan.planDigest !== expectedPlanDigest) {
        return failShiftSheetsImport("Reviewed import digest does not match.");
      }
      // An exact terminal replay does no Google I/O and cannot change history.
      const replay = await firestore.runTransaction(async (transaction) => {
        const [result, operation, retention] = await transaction.getAll(
          refs.result, refs.operation, refs.retention,
        );
        return result.exists ?
          resultFor(result, operation, retention, command) : null;
      });
      if (replay) return {kind: "replayed" as const, result: replay};
      const workbookRevision = await input.readWorkbookVersion();
      if (workbookRevision !== command.observation.workbookRevision) {
        return failShiftSheetsImport("Workbook changed after import review.");
      }
      return firestore.runTransaction(async (transaction) => {
        const [stored, result, operation, retention, submission] =
          await transaction.getAll(refs.command, refs.result,
            refs.operation, refs.retention, refs.submission);
        if (bindCommand(stored, operationId).commandDigest !==
          command.commandDigest) {
          return failShiftSheetsImport("Import command changed before apply.");
        }
        if (result.exists) {
          return {kind: "replayed" as const,
            result: resultFor(result, operation, retention, command)};
        }
        if (operation.exists || retention.exists || submission.exists) {
          return failShiftSheetsImport(
            "Import terminal exists without its result.",
          );
        }
        const live = await loadSource(transaction);
        if (live.sourceDigest !== command.sourceDigest ||
          digest(live.members) !== command.observation.membershipDigest) {
          return failShiftSheetsImport(
            "Source or eligibility changed after review.",
          );
        }
        const plan = planShiftSheetsImport({
          observation: command.observation, source: live.source,
        });
        if (plan.planDigest !== expectedPlanDigest) {
          return failShiftSheetsImport("Import plan changed after review.");
        }
        if (plan.patches.some((patch) =>
          !command.observation.canonicalRows.some((row) =>
            row.id === patch.id))) {
          return failShiftSheetsImport(
            "Human apply requires the reviewed readable write-back.",
          );
        }
        const checkedAt = clock();
        const fence = await inspectShiftPlanningNotificationWriterFences({
          firestore, transaction, root, now: checkedAt,
          resources: plan.sourceGuards.map(({row}) =>
            ({scope: "shift" as const, resourceId: row.id})),
        });
        if (fence.kind === "busy") {
          return failShiftSheetsImport("Notification writer fence is active.");
        }
        const materializations = plan.patches.map((patch) => {
          const current = live.documents.get(patch.id);
          if (!current ||
            current.bundleRevision !== live.authority.activeRevision ||
            current.bundleDigest !== live.authority.activeDigest ||
            current.writeEpoch !== live.authority.writeEpoch ||
            current.documentRevision >= Number.MAX_SAFE_INTEGER ||
            current.assignmentRevision >= Number.MAX_SAFE_INTEGER) {
            return failShiftSheetsImport(
              "Import patch has stale or exhausted lineage.",
            );
          }
          const payload = {...current};
          Reflect.deleteProperty(payload, "lastBackendMutation");
          const assignmentChanged = digest(current.assignedUserIds) !==
            digest(patch.assignedUserIds) ||
            current.helperUserId !== patch.helperUserId;
          return createShiftPlanningPublicShiftMaterialization({
            targetPath: `${root}/shifts/${patch.id}`,
            payload: {...payload, assignedUserIds: patch.assignedUserIds,
              helperUserId: patch.helperUserId, status: patch.status,
              rotationPositions: current.rotationPositions?.map(
                (position, index) => ({...position,
                  effectiveAssigneeUserId: patch.assignedUserIds[index]}),
              ) ?? null,
              assignmentRevision: current.assignmentRevision +
                (assignmentChanged ? 1 : 0),
              documentRevision: current.documentRevision + 1,
              updatedAt: checkedAt},
          });
        });
        const terminal =
          createShiftPlanningControlledMutationOperationTerminal({
            operationId: refs.operation.id, kind: "syncCorrection",
            environment: config.environment,
            bundleRevision: live.authority.activeRevision,
            bundleDigest: live.authority.activeDigest,
            writeEpoch: live.authority.writeEpoch, committedAt: checkedAt,
            publicMutations: materializations.map((item) => ({
              mutationKind: "update", targetPath: item.targetPath,
              payloadDigest: item.payloadDigest,
              documentRevision: item.documentRevision,
            })),
          });
        const documents = materializations.map((materialization) =>
          attachShiftPlanningControlledMutationMarker({materialization,
            operation: terminal}));
        const resultBody = {commandDigest: command.commandDigest,
          planDigest: expectedPlanDigest,
          operationIntentDigest: terminal.operationIntentDigest,
          writeBackRows: documents.map((doc, index) =>
            projectRow(plan.patches[index].id, doc)),
          writeBackState: "pending"};
        const outcome = {...resultBody,
          resultDigest: encodedDigest(resultBody)};
        documents.forEach((doc, index) => transaction.set(firestore.doc(
          materializations[index].targetPath,
        ), doc));
        transaction.create(refs.operation, terminal);
        transaction.create(refs.retention,
          createShiftPlanningPublicEventOperationRetention({
            environment: config.environment,
            controlledOperationKind: "syncCorrection",
            operationId: terminal.operationId,
            operationIntentDigest: terminal.operationIntentDigest,
            terminalAt: checkedAt, policy: retentionPolicy,
          }));
        transaction.create(refs.result, outcome);
        const reservation = parseShiftSheetsImportSubmission({
          schemaVersion: 1, kind: "importWriteBack",
          environment: config.environment, workbookId: config.workbookId,
          operationId: refs.operation.id, planDigest: expectedPlanDigest,
          resultDigest: outcome.resultDigest,
          beforeWorkbookRevision: command.observation.workbookRevision,
          batch: null, evidence: null,
        });
        transaction.create(refs.submission, reservation);
        transaction.set(workbookReference, reservation);
        return {kind: "committed" as const, result: outcome};
      });
    },
  };
};
