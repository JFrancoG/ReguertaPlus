import {DocumentSnapshot, FieldPath, Firestore, Transaction} from
  "@google-cloud/firestore";
import {AppEnvironment, HttpRequestError, VerifiedIdentity} from
  "./backend-security.js";
import {readShiftCoverageActor} from "./shift-coverage-access.js";
import {coverageId, SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";
import {SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS,
  ShiftCoverageBootstrapDecision, ShiftCoverageBootstrapPlan,
  ShiftCoverageBootstrapSnapshot, parseShiftCoverageBootstrapDecision,
  planShiftCoverageBootstrap} from "./shift-coverage-bootstrap.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {prepareShiftPlanningFirestoreTransaction} from
  "./shift-planning-firestore-transaction-manifest.js";
import {ShiftPlanningClosedBarrierScope,
  verifyShiftPlanningIntakeBarrierEvidence} from
  "./shift-planning-intake-barrier.js";
import {decodeShiftPlanningFirestoreDocument,
  encodeShiftPlanningFirestoreValue} from
  "./shift-planning-publication-contract.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";
import {parseShiftPlanningWorkbookPartition} from
  "./shift-planning-firestore-sync-command-repository.js";
import {parseShiftSheetsWorkbookSubmission} from
  "./shift-planning-sheets-submission.js";
import {createTrustedShiftPlanningIntakeBarrierAdapter,
  ShiftPlanningIntakeBarrierFailureClosurePersistence,
  ShiftPlanningTrustedIntakeBarrierControlPlane} from
  "./shift-planning-trusted-intake-barrier-adapter.js";

export type ShiftCoverageBootstrapReceipt = {
  schemaVersion: 1;
  environment: AppEnvironment;
  policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  operationId: string;
  state: "completed";
  sourceDigest: string;
  decisionDigest: string;
  planDigest: string;
  createsDigest: string;
  decision: ShiftCoverageBootstrapDecision;
  actor: {uid: string; memberId: string};
  completedAtMillis: number;
  receiptDigest: string;
};

const fail = (code: string): never => {
  throw new HttpRequestError(409, code, "Coverage bootstrap unavailable");
};
const isDigest = (value: unknown): value is string =>
  typeof value === "string" &&
  /^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, fields: string[]) =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === fields.length &&
  Object.keys(value).every((key) => fields.includes(key));
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ?
    value as Record<string, unknown> : {};
const receiptCore = (value: ShiftCoverageBootstrapReceipt) =>
  Object.fromEntries(Object.entries(value).filter(([key]) =>
    key !== "receiptDigest"));
const markerFor = (receipt: ShiftCoverageBootstrapReceipt) => ({
  schemaVersion: 1, environment: receipt.environment,
  policyRevision: receipt.policyRevision, operationId: receipt.operationId,
  receiptDigest: receipt.receiptDigest,
});

const parseReceipt = (
  value: unknown, environment: AppEnvironment,
): ShiftCoverageBootstrapReceipt | null => {
  const receipt = value as ShiftCoverageBootstrapReceipt;
  if (!exact(receipt, ["schemaVersion", "environment", "policyRevision",
    "operationId", "state", "sourceDigest", "decisionDigest", "planDigest",
    "createsDigest", "decision", "actor", "completedAtMillis",
    "receiptDigest"]) || receipt.schemaVersion !== 1 ||
      receipt.environment !== environment ||
      receipt.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION ||
      receipt.state !== "completed" || receipt.operationId === "current" ||
      ![receipt.sourceDigest, receipt.decisionDigest, receipt.planDigest,
        receipt.createsDigest, receipt.receiptDigest].every(isDigest) ||
      !exact(receipt.actor, ["uid", "memberId"]) ||
      !Number.isSafeInteger(receipt.completedAtMillis) ||
      receipt.completedAtMillis < 0) return null;
  try {
    coverageId(receipt.operationId);
    coverageId(receipt.actor.memberId);
    if (typeof receipt.actor.uid !== "string" || !receipt.actor.uid ||
        receipt.actor.uid.length > 128 || receipt.actor.uid.includes("/")) {
      return null;
    }
    const decision = parseShiftCoverageBootstrapDecision(receipt.decision);
    if (decision.environment !== environment ||
        decision.operationId !== receipt.operationId ||
        receipt.completedAtMillis < decision.effectiveAtMillis ||
        digest(decision) !== receipt.decisionDigest ||
        digest(receiptCore(receipt)) !== receipt.receiptDigest) return null;
    return {...receipt, decision, actor: {...receipt.actor}};
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
};

const immutableCommit = (document: DocumentSnapshot) =>
  document.exists && document.createTime !== undefined &&
  document.updateTime !== undefined &&
  document.createTime.isEqual(document.updateTime);

/**
 * Verify only the historical atomic bootstrap proof. Later membership/ledger
 * changes are legitimate and must never be compared to initial after-images.
 * Malformed or rewritten proof closes readiness; SDK read errors propagate.
 * @param {Firestore} db Caller-owned database client.
 * @param {Transaction} tx Caller-owned readiness transaction.
 * @param {string} environment Bound server environment.
 * @return {Promise<object|null>} Immutable bootstrap receipt or unavailable.
 */
export const readVerifiedShiftCoverageBootstrap = async (
  db: Firestore, tx: Transaction, environment: AppEnvironment,
): Promise<ShiftCoverageBootstrapReceipt | null> => {
  const root = `${environment}/plus-collections/shiftCoverageMigrations`;
  const marker = await tx.get(db.doc(`${root}/current`));
  const value = marker.data();
  if (!exact(value, ["schemaVersion", "environment", "policyRevision",
    "operationId", "receiptDigest"]) || value?.schemaVersion !== 1 ||
      value.environment !== environment ||
      value.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION ||
      value.operationId === "current" ||
      typeof value.operationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.operationId) ||
      !isDigest(value.receiptDigest) || !immutableCommit(marker)) return null;
  const document = await tx.get(db.doc(`${root}/${value.operationId}`));
  const receipt = parseReceipt(document.data(), environment);
  const createdAt = document.createTime;
  if (!receipt || !immutableCommit(document) ||
      !createdAt || !marker.createTime?.isEqual(createdAt) ||
      digest(value) !== digest(markerFor(receipt))) return null;
  return receipt;
};

/**
 * Capture a bounded, complete initial source and apply only a reviewed create
 * plan behind the existing held intake barrier. No policy is enabled, no
 * public assignment changes, and no SDK client is constructed or terminated.
 * @param {object} input Scoped SDK, trusted clock and existing barrier ports.
 * @return {object} Read-only inspection/preview and governed atomic apply.
 */
export const createFirestoreShiftCoverageBootstrap = (input: {
  firestore: Firestore;
  environment: AppEnvironment;
  nowMillis(): number;
  controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane;
  failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
}) => {
  if (!["develop", "production"].includes(input.environment)) {
    return fail("coverage_bootstrap_environment_invalid");
  }
  const {firestore: db, environment} = input;
  const root = `${environment}/plus-collections`;
  const reference = (path: string) => db.doc(`${root}/${path}`);
  const barrier = createTrustedShiftPlanningIntakeBarrierAdapter(input);
  const clock = () => {
    const now = input.nowMillis();
    if (!Number.isSafeInteger(now) || now < 0) {
      return fail("invalid_coverage_clock");
    }
    return now;
  };
  const capture = async (tx: Transaction):
    Promise<ShiftCoverageBootstrapSnapshot> => {
    const documents = new Map<string, DocumentSnapshot>();
    for (const collection of SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS) {
      const maximum = collection === "users" ||
        collection === "shiftMembershipState" ? 250 :
        collection === "shiftCoverageReserves" ? 500 : 1000;
      const result = await tx.get(db.collection(`${root}/${collection}`)
        .orderBy(FieldPath.documentId()).limit(maximum + 1));
      if (result.size > maximum) {
        return fail("coverage_bootstrap_source_limit");
      }
      for (const document of result.docs) {
        documents.set(document.ref.path, document);
      }
    }
    const singletons = ["shiftPlanningState/current",
      "shiftPlanningState/sourcePolicy", "shiftPlanningState/sheetsSubmission",
      "shiftRotations/delivery", "shiftRotations/market",
      "shiftCoverageLedgerState/delivery", "shiftCoverageLedgerState/market",
      "shiftCoverageMigrations/current"];
    const missing = singletons.filter((path) =>
      !documents.has(`${root}/${path}`));
    if (missing.length) {
      const absent = await tx.getAll(...missing.map(reference));
      for (const document of absent) {
        documents.set(document.ref.path, document);
      }
    }
    const snapshot: ShiftCoverageBootstrapSnapshot = {
      schemaVersion: 1, environment,
      collections: [...SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS],
      documents: [...documents.values()]
        .sort((a, b) => a.ref.path < b.ref.path ? -1 :
          a.ref.path > b.ref.path ? 1 : 0)
        .map((document) => ({path: document.ref.path,
          value: document.exists ? encodeShiftPlanningFirestoreValue(
            document.data(), document.ref.path, new Set(),
          ) : null,
          updateTime: document.updateTime ? {
            seconds: document.updateTime.seconds,
            nanoseconds: document.updateTime.nanoseconds,
          } : null})),
    };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 6 * 1024 * 1024) {
      return fail("coverage_bootstrap_source_limit");
    }
    return snapshot;
  };
  const documentValue = (snapshot: ShiftCoverageBootstrapSnapshot,
    path: string) => {
    const value = snapshot.documents.find((doc) =>
      doc.path === `${root}/${path}`)?.value;
    return value ? decodeShiftPlanningFirestoreDocument(value) : null;
  };
  const requireScope = (snapshot: ShiftCoverageBootstrapSnapshot,
    scope: ShiftPlanningClosedBarrierScope, operationId: string,
    sourceDigest: string) => {
    const state = parseShiftPlanningMaintenanceState(documentValue(snapshot,
      "shiftPlanningState/current"));
    if (scope.environment !== environment ||
        scope.transitionId !== operationId ||
        scope.expectedAuthoritativeDigest !== sourceDigest ||
        state.maintenanceStatus !== "closed" ||
        state.stateRevision !== scope.expectedStateRevision ||
        state.writeEpoch !== scope.expectedWriteEpoch ||
        state.activeRevision !== scope.expectedActiveRevision ||
        state.activeDigest !== scope.expectedActiveDigest) {
      return fail("coverage_bootstrap_scope_changed");
    }
    const policy = documentValue(snapshot, "shiftPlanningState/sourcePolicy");
    if (policy?.environment !== environment) {
      return fail("coverage_bootstrap_scope_changed");
    }
    const partitionValues = asRecord(asRecord(policy?.sync).partitions);
    const partitions = (["delivery", "market"] as const).map((type) =>
      parseShiftPlanningWorkbookPartition(partitionValues[type]));
    if (partitions.some((partition) => partition.lease !== null ||
        partition.workbookId !== scope.expectedWorkbookFileId)) {
      return fail("coverage_bootstrap_workbook_busy");
    }
    const pointer = documentValue(snapshot,
      "shiftPlanningState/sheetsSubmission");
    const submission = pointer ?
      parseShiftSheetsWorkbookSubmission(pointer) : null;
    if (submission &&
        (submission.workbookId !== scope.expectedWorkbookFileId ||
          (submission.environment !== null &&
            submission.environment !== environment))) {
      return fail("coverage_bootstrap_workbook_changed");
    }
    const revision = submission ? submission.evidence?.workbookRevision :
      partitions.every((partition) => partition.workbookRevision ===
        partitions[0].workbookRevision) ? partitions[0].workbookRevision : null;
    if (!revision || revision !== scope.expectedWorkbookRevision) {
      return fail("coverage_bootstrap_workbook_changed");
    }
  };
  const currentActor = async (tx: Transaction, identity: VerifiedIdentity) => {
    const actor = await readShiftCoverageActor(db, tx, identity, environment);
    if (!actor.admin) {
      throw new HttpRequestError(403, "coverage_actor_forbidden", "Denied");
    }
    return {uid: identity.uid, memberId: actor.memberId};
  };
  const requireReplay = (receipt: ShiftCoverageBootstrapReceipt,
    decision: ShiftCoverageBootstrapDecision, expectedPlanDigest: string,
    actor: {uid: string; memberId: string}) => {
    if (receipt.operationId !== decision.operationId ||
        receipt.planDigest !== expectedPlanDigest ||
        receipt.decisionDigest !== digest(decision) ||
        digest(receipt.actor) !== digest(actor)) {
      return fail("coverage_bootstrap_operation_conflict");
    }
    return {state: "completed" as const, operationId: receipt.operationId,
      planDigest: receipt.planDigest, receiptDigest: receipt.receiptDigest,
      replayed: true};
  };
  return {
    inspect: () => db.runTransaction(capture),
    async preview(value: unknown): Promise<ShiftCoverageBootstrapPlan> {
      const decision = parseShiftCoverageBootstrapDecision(value);
      const snapshot = await db.runTransaction(capture);
      return planShiftCoverageBootstrap({snapshot, decision});
    },
    async apply(request: {
      decision: unknown;
      expectedPlanDigest: string;
      identity: VerifiedIdentity;
      scope: ShiftPlanningClosedBarrierScope;
    }) {
      const decision = parseShiftCoverageBootstrapDecision(request.decision);
      const {expectedPlanDigest} = request;
      const identity = {...request.identity};
      const scope = {...request.scope};
      if (decision.environment !== environment ||
          decision.operationId === "current" ||
          !isDigest(expectedPlanDigest) ||
          decision.effectiveAtMillis > clock()) {
        return fail("coverage_bootstrap_intent_invalid");
      }
      const initial = await db.runTransaction(async (tx) => {
        const actor = await currentActor(tx, identity);
        const snapshot = await capture(tx);
        const receipt = await readVerifiedShiftCoverageBootstrap(
          db, tx, environment,
        );
        const plan = receipt ? null :
          planShiftCoverageBootstrap({snapshot, decision});
        if (receipt) {
          requireReplay(receipt, decision, expectedPlanDigest, actor);
        }
        if (plan && (plan.blockers.length ||
            plan.planDigest !== expectedPlanDigest)) {
          return fail("coverage_bootstrap_plan_changed");
        }
        requireScope(snapshot, scope, decision.operationId,
          receipt?.sourceDigest ?? (plan as ShiftCoverageBootstrapPlan)
            .sourceDigest);
        return {actor, receipt};
      });
      return barrier.withClosedIntakeBarrier(scope, async (evidence) => {
        const bound = {...scope};
        Reflect.deleteProperty(bound, "writerInventoryRevision");
        Reflect.deleteProperty(bound, "writerInventoryDigest");
        const verify = () => verifyShiftPlanningIntakeBarrierEvidence(
          evidence, bound, clock(),
        );
        verify();
        try {
          return await db.runTransaction(async (tx) => {
            const actor = await currentActor(tx, identity);
            if (digest(actor) !== digest(initial.actor)) {
              return fail("coverage_session_changed");
            }
            const receipt = await readVerifiedShiftCoverageBootstrap(
              db, tx, environment,
            );
            if (receipt) {
              requireScope(await capture(tx), scope, decision.operationId,
                receipt.sourceDigest);
              verify();
              return requireReplay(receipt, decision, expectedPlanDigest,
                actor);
            }
            const snapshot = await capture(tx);
            const plan = planShiftCoverageBootstrap({snapshot, decision});
            if (initial.receipt || plan.blockers.length ||
              plan.planDigest !== expectedPlanDigest) {
              return fail("coverage_bootstrap_plan_changed");
            }
            requireScope(snapshot, scope, decision.operationId,
              plan.sourceDigest);
            verify();
            const completedAtMillis = clock();
            if (completedAtMillis < decision.effectiveAtMillis) {
              return fail("invalid_coverage_clock");
            }
            const core = {schemaVersion: 1 as const, environment,
              policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
              operationId: decision.operationId, state: "completed" as const,
              sourceDigest: plan.sourceDigest,
              decisionDigest: plan.decisionDigest, planDigest: plan.planDigest,
              createsDigest: digest(plan.creates), decision, actor,
              completedAtMillis};
            const record: ShiftCoverageBootstrapReceipt = {...core,
              receiptDigest: digest(core)};
            const migrationRoot = `${root}/shiftCoverageMigrations`;
            const creates = [...plan.creates.map((item) => {
              const parts = item.path.split("/");
              if (parts.length !== 4 || parts.slice(0, 2).join("/") !== root ||
                !["shiftMembershipState", "shiftCoverageReserves",
                  "shiftCoverageLedgerState"].includes(parts[2])) {
                return fail("coverage_bootstrap_target_invalid");
              }
              return {kind: "create" as const, documentPath: item.path,
                data: decodeShiftPlanningFirestoreDocument(item.value)};
            }), {kind: "create" as const,
              documentPath: `${migrationRoot}/${decision.operationId}`,
              data: record}, {kind: "create" as const,
              documentPath: `${migrationRoot}/current`,
              data: markerFor(record)}];
            const policy = documentValue(snapshot,
              "shiftPlanningState/sourcePolicy");
            const authority = asRecord(asRecord(policy?.sync)
              .transactionMeasurementAuthority);
            const writeLimit = policy?.transactionWriteLimit;
            if (!exact(authority, ["adapterRevision",
              "indexConfigurationDigest"]) ||
              typeof authority.adapterRevision !== "string" ||
              !isDigest(authority.indexConfigurationDigest) ||
              typeof writeLimit !== "number" ||
              !Number.isSafeInteger(writeLimit) || writeLimit < 1) {
              return fail("coverage_bootstrap_admission_required");
            }
            prepareShiftPlanningFirestoreTransaction({direction: "forward",
              manifestDigest: plan.planDigest, mutations: creates,
              expectedDocumentWriteCount: creates.length,
              authority: {adapterRevision: authority.adapterRevision,
                indexConfigurationDigest: authority.indexConfigurationDigest},
              writeLimit});
            for (const mutation of creates) {
              tx.create(db.doc(mutation.documentPath), mutation.data);
            }
            return {state: "completed" as const,
              operationId: record.operationId, planDigest: record.planDigest,
              receiptDigest: record.receiptDigest,
              replayed: false};
          });
        } catch (error) {
          // A lost transaction acknowledgement is resolved only by its exact
          // atomic receipt; absence never authorizes a second business commit.
          return db.runTransaction(async (tx) => {
            const actor = await currentActor(tx, identity);
            const receipt = await readVerifiedShiftCoverageBootstrap(
              db, tx, environment,
            );
            if (!receipt) throw error;
            requireScope(await capture(tx), scope, decision.operationId,
              receipt.sourceDigest);
            verify();
            return requireReplay(receipt, decision, expectedPlanDigest, actor);
          });
        }
      });
    },
  };
};
