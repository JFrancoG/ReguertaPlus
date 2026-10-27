import {randomUUID} from "node:crypto";
import {Firestore, Timestamp} from "@google-cloud/firestore";
import {HttpRequestError} from "./backend-security.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {parseShiftSheetsWorkbookSubmission} from
  "./shift-planning-sheets-submission.js";
import {captureShiftPlanningWriterAuthority,
  assertShiftPlanningWriterAuthority,
  ShiftPlanningWriterAuthority} from "./shift-planning-writer-authority.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {parseShiftPlanningWorkbookPartition} from
  "./shift-planning-firestore-sync-command-repository.js";

export type ShiftSheetsOrdinarySubmission = {
  schemaVersion: 1;
  kind: "ordinaryWriteBack";
  environment: "develop" | "production";
  workbookId: string;
  operationId: string;
  authority: ShiftPlanningWriterAuthority | null;
  createdAt: Timestamp;
  state: "reserved" | "submitting" | "completed";
  beforeWorkbookRevision: string | null;
  submissionCount: number;
  evidence: {workbookRevision: string; partitionDigest: string} | null;
};

const fail = (message: string): never => {
  throw new HttpRequestError(409, "shift_sheets_ordinary_unresolved", message);
};
const version = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value) &&
  BigInt(value) <= BigInt("9223372036854775807");
const acknowledgementDigest = (value: ShiftSheetsOrdinarySubmission,
  workbookRevision: string) => digest({
  kind: value.kind, environment: value.environment,
  workbookId: value.workbookId, operationId: value.operationId,
  authority: value.authority, createdAt: {
    seconds: value.createdAt.seconds, nanoseconds: value.createdAt.nanoseconds,
  }, beforeWorkbookRevision: value.beforeWorkbookRevision,
  submissionCount: value.submissionCount, workbookRevision,
});

/**
 * Legacy exports retain their SDK acknowledgement semantics. This evidence
 * binds an acknowledged operation to a stable Drive version; it does not claim
 * the exact-cell read-back supplied by the HU-083 projection adapter.
 * @param {unknown} value Backend-only operation receipt or workbook pointer.
 * @return {object} Exact receipt; ambiguous writes never acquire evidence.
 */
export const parseShiftSheetsOrdinarySubmission = (
  value: unknown,
): ShiftSheetsOrdinarySubmission => {
  const record = value as ShiftSheetsOrdinarySubmission;
  const keys = ["schemaVersion", "kind", "environment", "workbookId",
    "operationId", "authority", "createdAt", "state",
    "beforeWorkbookRevision", "submissionCount", "evidence"];
  const id = (value: unknown) => typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
  if (!record || typeof record !== "object" || Array.isArray(record) ||
    Object.keys(record).length !== keys.length ||
    Object.keys(record).some((key) => !keys.includes(key)) ||
    record.schemaVersion !== 1 || record.kind !== "ordinaryWriteBack" ||
    !["develop", "production"].includes(record.environment) ||
    !id(record.workbookId) || !id(record.operationId) ||
    !(record.createdAt instanceof Timestamp) ||
    !["reserved", "submitting", "completed"].includes(record.state) ||
    !Number.isSafeInteger(record.submissionCount) ||
    record.submissionCount < 0 || record.submissionCount > 10000 ||
    (record.beforeWorkbookRevision !== null &&
      !version(record.beforeWorkbookRevision)) ||
    (record.state !== "reserved" &&
      (!record.beforeWorkbookRevision || record.submissionCount === 0))) {
    return fail("Ordinary Sheets receipt is invalid.");
  }
  // Reuse the authority codec without requiring today's mutable writer state.
  if (record.authority !== null) {
    const authority = record.authority;
    assertShiftPlanningWriterAuthority({capturedValue: authority,
      currentStateValue: {...authority,
        maintenanceStatus: "open", intakeBarrier: null,
        lastTransitionId: "ordinary-receipt"},
      changedCode: "shift_sheets_ordinary_unresolved",
      changedMessage: "Ordinary authority is invalid."});
  }
  if (record.state === "completed") {
    const evidence = record.evidence;
    if (!evidence || Object.keys(evidence).sort().join() !==
        "partitionDigest,workbookRevision" ||
      !version(evidence.workbookRevision) ||
      BigInt(evidence.workbookRevision) <=
        BigInt(record.beforeWorkbookRevision as string) ||
      evidence.partitionDigest !== acknowledgementDigest(
        record, evidence.workbookRevision)) {
      return fail("Ordinary acknowledgement evidence is invalid.");
    }
  } else if (record.evidence !== null) {
    return fail("An unfinished ordinary write cannot have evidence.");
  }
  return {...record, authority: record.authority ? {...record.authority} : null,
    evidence: record.evidence ? {...record.evidence} : null};
};

/**
 * Reserves the shared workbook before loading ordinary export sources. Every
 * possible SDK call is recorded first. A timeout/crash retains the pointer and
 * cannot be replayed by another invocation or freed by lease expiry. External
 * IAM/Drive fencing remains necessary; a Firestore lock is not a Sheets CAS.
 * @param {object} input Shared SDK authority and explicit workbook observation.
 * @param {Function} work Existing ordinary export, using the supplied fence.
 * @return {Promise<Result>} Original result after durable acknowledgement.
 */
export const runShiftSheetsOrdinaryWriter = async<Result>(input: {
  firestore: Firestore;
  config: ShiftSheetsConfig;
  readWorkbookVersion(): Promise<string>;
}, work: (fence: {
  authority: ShiftPlanningWriterAuthority | null;
  beforeMutation(): Promise<void>;
  finish(): Promise<void>;
}) => Promise<Result>): Promise<Result> => {
  const {firestore: db, config} = input;
  if (!["develop", "production"].includes(config.environment)) {
    return fail("Ordinary writer environment is invalid.");
  }
  const root = `${config.environment}/plus-collections`;
  const pointer = db.doc(`${root}/shiftPlanningState/sheetsSubmission`);
  const maintenance = db.doc(`${root}/shiftPlanningState/current`);
  const operationId = `ordinary-${randomUUID()}`;
  const receipt = db.doc(
    `${root}/shiftSheetsOrdinaryOperations/${operationId}`);
  let preceding: object | null = null;
  let expectedRevision: string | null = null;
  let value = await db.runTransaction(async (tx) => {
    preceding = null;
    expectedRevision = null;
    const [state, current, effects, policy] = await Promise.all([
      tx.get(maintenance), tx.get(pointer),
      tx.get(db.collection(`${root}/shiftCoverageEffects`)
        .where("state", "in", ["pending", "reconciliationRequired"])
        .limit(501)),
      tx.get(db.doc(`${root}/shiftPlanningState/sourcePolicy`)),
    ]);
    if (effects.size > 500 || effects.docs.some((effect) => {
      const changes = effect.get("value.changes");
      return !Array.isArray(changes) || changes.length > 0;
    })) return fail("Coverage projection work must be resolved first.");
    if (policy.exists) {
      if (policy.get("environment") !== config.environment) {
        return fail("Workbook policy belongs to another environment.");
      }
      if (policy.get("sync") !== undefined) {
        const partitions = ["delivery", "market"].map((type) =>
          parseShiftPlanningWorkbookPartition(
            policy.get(`sync.partitions.${type}`)));
        if (partitions.some((p) => p.workbookId !== config.workbookId ||
          p.lease !== null)) return fail("Workbook partitions are not free.");
        if (!current.exists) {
          if (partitions[0].workbookRevision !==
            partitions[1].workbookRevision) {
            return fail("Workbook baseline lacks one exact revision.");
          }
          expectedRevision = partitions[0].workbookRevision;
        }
      }
    }
    if (current.exists) {
      const prior = parseShiftSheetsWorkbookSubmission(current.data());
      if (prior.workbookId !== config.workbookId || prior.evidence === null) {
        return fail("The workbook has an unfinished submission.");
      }
      preceding = current.data() as object;
      expectedRevision = prior.evidence.workbookRevision;
    }
    const next: ShiftSheetsOrdinarySubmission = {
      schemaVersion: 1, kind: "ordinaryWriteBack",
      environment: config.environment, workbookId: config.workbookId,
      operationId, createdAt: Timestamp.now(), state: "reserved",
      authority: captureShiftPlanningWriterAuthority(state.data()),
      beforeWorkbookRevision: null, submissionCount: 0, evidence: null,
    };
    tx.create(receipt, next); tx.set(pointer, next);
    return next;
  });
  const update = async (mutate: (fresh: ShiftSheetsOrdinarySubmission) =>
    ShiftSheetsOrdinarySubmission | null) => db.runTransaction(async (tx) => {
    const [state, current, own] = await tx.getAll(
      maintenance, pointer, receipt);
    const fresh = parseShiftSheetsOrdinarySubmission(own.data());
    const lock = parseShiftSheetsOrdinarySubmission(current.data());
    if (lock.operationId !== operationId ||
      acknowledgementDigest(lock, "1") !==
        acknowledgementDigest(fresh, "1") || lock.state !== fresh.state) {
      return fail("Ordinary writer lost its workbook reservation.");
    }
    assertShiftPlanningWriterAuthority({capturedValue: fresh.authority,
      currentStateValue: state.data(),
      changedCode: "shift_sheets_ordinary_authority_changed",
      changedMessage: "Ordinary writer authority changed."});
    const next = mutate(fresh);
    if (next) {
      tx.set(receipt, next); tx.set(pointer, next);
    } else {
      tx.delete(receipt);
      if (preceding) tx.set(pointer, preceding); else tx.delete(pointer);
    }
    return next;
  });
  try {
    const before = await input.readWorkbookVersion();
    if (!version(before)) return fail("Drive version is invalid.");
    if (expectedRevision !== null && expectedRevision !== before) {
      return fail("Drive version changed outside its verified writer.");
    }
    value = await update((fresh) => ({...fresh,
      beforeWorkbookRevision: before})) as ShiftSheetsOrdinarySubmission;
    const result = await work({authority: value.authority,
      beforeMutation: async () => {
        value = await update((fresh) => ({...fresh, state: "submitting",
          submissionCount: fresh.submissionCount + 1})) as
          ShiftSheetsOrdinarySubmission;
      },
      finish: async () => {
        await update((fresh) => fresh);
      },
    });
    if (value.submissionCount === 0) {
      await update(() => null);
      return result;
    }
    const after = await input.readWorkbookVersion();
    if (!version(after) || after !== await input.readWorkbookVersion() ||
      BigInt(after) <= BigInt(before)) {
      return fail("Acknowledged writes lack a stable advanced Drive version.");
    }
    await update((fresh) => parseShiftSheetsOrdinarySubmission({...fresh,
      state: "completed", evidence: {workbookRevision: after,
        partitionDigest: acknowledgementDigest(fresh, after)}}));
    return result;
  } catch (error) {
    // Inspect persisted identity: a lost Firestore acknowledgement may have
    // recorded a possible SDK call even if the local variable still says zero.
    await db.runTransaction(async (tx) => {
      const [own, current] = await tx.getAll(receipt, pointer);
      if (own.get("state") === "reserved" &&
        own.get("submissionCount") === 0 &&
        current.get("operationId") === operationId) {
        tx.delete(receipt);
        if (preceding) tx.set(pointer, preceding); else tx.delete(pointer);
      }
    });
    throw error;
  }
};
