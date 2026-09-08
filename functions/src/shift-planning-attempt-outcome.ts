import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
  ShiftPlanningFirestoreAdmission,
  ShiftPlanningFirestoreTransactionDirection,
} from "./shift-planning-firestore-transaction-manifest.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION = 2 as const;

export type ShiftPlanningCommittedAttemptOutcome = {
  schemaVersion: typeof SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION;
  operationKind: "planningTransactionAttemptOutcome";
  state: "committed";
  acknowledgement: "transactionReturned" | "operationReadBack";
  environment: ShiftPlanningEnvironment;
  operationId: string;
  operationIntentDigest: ShiftPlanningDigest;
  attemptId: string;
  outcomePath: string;
  direction: ShiftPlanningFirestoreTransactionDirection;
  manifestDigest: ShiftPlanningDigest;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  writeEpoch: number;
  recordedAt: Timestamp;
  measurement: ShiftPlanningFirestoreAdmission | null;
  measurementDigest: ShiftPlanningDigest | null;
  outcomeDigest: ShiftPlanningDigest;
};

export type CreateShiftPlanningCommittedAttemptOutcomeInput = {
  acknowledgement?: "transactionReturned" | "operationReadBack";
  environment: ShiftPlanningEnvironment;
  operationId: string;
  operationIntentDigest: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  recordedAt: Timestamp;
  measurement: ShiftPlanningFirestoreAdmission | null;
  direction?: ShiftPlanningFirestoreTransactionDirection;
  manifestDigest?: string;
};

type UnknownRecord = Record<string, unknown>;
const failOutcome = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_attempt_outcome", message);
};
const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    return failOutcome("Outcome must contain plain data objects.");
  }
  return value as UnknownRecord;
};
const exactFields = (value: UnknownRecord, names: string[]): void => {
  if (Object.keys(value).length !== names.length ||
      names.some((name) =>
        !Object.prototype.hasOwnProperty.call(value, name))) {
    failOutcome("Outcome fields are not exact.");
  }
};
const identifier = (value: unknown): string => {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    return failOutcome("Outcome identifier is invalid.");
  }
  return value;
};
const digest = (value: unknown): ShiftPlanningDigest => {
  if (typeof value !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)) {
    return failOutcome("Outcome digest is invalid.");
  }
  return value as ShiftPlanningDigest;
};
const integer = (value: unknown, minimum = 0): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    return failOutcome("Outcome count is invalid.");
  }
  return value as number;
};
const direction = (
  value: unknown,
): ShiftPlanningFirestoreTransactionDirection => {
  if (value !== "forward" && value !== "inverse") {
    return failOutcome("Outcome direction is invalid.");
  }
  return value;
};
const parseAdmission = (value: unknown): ShiftPlanningFirestoreAdmission => {
  const admission = record(value);
  exactFields(admission, [
    "schemaVersion", "evidenceKind", "direction", "manifestDigest",
    "logicalMutationDigest", "documentWriteCount", "estimatedRequestBytes",
    "adapterRevision", "indexConfigurationDigest",
  ]);
  if (admission.schemaVersion !== 2 ||
      admission.evidenceKind !== "applicationAdmission" ||
      admission.adapterRevision !==
        SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION) {
    return failOutcome("Outcome admission policy is unsupported.");
  }
  return {
    schemaVersion: 2,
    evidenceKind: "applicationAdmission",
    direction: direction(admission.direction),
    manifestDigest: digest(admission.manifestDigest),
    logicalMutationDigest: digest(admission.logicalMutationDigest),
    documentWriteCount: integer(admission.documentWriteCount, 1),
    estimatedRequestBytes: integer(admission.estimatedRequestBytes, 1),
    adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
    indexConfigurationDigest: digest(admission.indexConfigurationDigest),
  };
};
const outcomeDigest = (
  value: Omit<ShiftPlanningCommittedAttemptOutcome, "outcomeDigest">,
): ShiftPlanningDigest => createShiftPlanningDigest({
  ...value,
  recordedAt: {
    seconds: value.recordedAt.seconds,
    nanoseconds: value.recordedAt.nanoseconds,
  },
});

/**
 * Records either a returned transaction with application admission evidence or
 * a validated terminal read-back after an ambiguous acknowledgement. Read-back
 * never invents admission evidence or claims the original transaction returned.
 * One directional operation identity owns one immutable receipt, irrespective
 * of callback retries or which acknowledgement path first retained it.
 * @param {CreateShiftPlanningCommittedAttemptOutcomeInput} input Commit
 * evidence.
 * @return {ShiftPlanningCommittedAttemptOutcome} Versioned acknowledgement.
 */
export const createShiftPlanningCommittedAttemptOutcome = (
  input: CreateShiftPlanningCommittedAttemptOutcomeInput,
): ShiftPlanningCommittedAttemptOutcome => {
  const acknowledgement = input.acknowledgement ?? "transactionReturned";
  const measurement = input.measurement === null ?
    null : parseAdmission(input.measurement);
  if ((acknowledgement !== "transactionReturned" &&
      acknowledgement !== "operationReadBack") ||
      (acknowledgement === "transactionReturned") !== (measurement !== null)) {
    return failOutcome("Acknowledgement does not match its evidence.");
  }
  if (input.environment !== "develop" && input.environment !== "production") {
    return failOutcome("Outcome environment is invalid.");
  }
  if (!(input.recordedAt instanceof Timestamp)) {
    return failOutcome("Outcome timestamp is invalid.");
  }
  const operationId = identifier(input.operationId);
  const operationIntentDigest = digest(input.operationIntentDigest);
  const resolvedDirection = direction(
    measurement?.direction ?? input.direction,
  );
  const manifestDigest = digest(
    measurement?.manifestDigest ?? input.manifestDigest,
  );
  const intentHash = operationIntentDigest.split(":").at(-1);
  const attemptId = `${resolvedDirection}-${intentHash}`;
  const core: Omit<ShiftPlanningCommittedAttemptOutcome, "outcomeDigest"> = {
    schemaVersion: SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION,
    operationKind: "planningTransactionAttemptOutcome",
    state: "committed",
    acknowledgement,
    environment: input.environment,
    operationId,
    operationIntentDigest,
    attemptId,
    outcomePath: `${input.environment}/plus-collections/` +
      `shiftPlanningOperations/${operationId}/attemptOutcomes/${attemptId}`,
    direction: resolvedDirection,
    manifestDigest,
    bundleRevision: identifier(input.bundleRevision),
    bundleDigest: digest(input.bundleDigest),
    writeEpoch: integer(input.writeEpoch),
    recordedAt: input.recordedAt,
    measurement,
    measurementDigest: measurement === null ?
      null : createShiftPlanningDigest(measurement),
  };
  return {...core, outcomeDigest: outcomeDigest(core)};
};

/**
 * Reconstructs the receipt from its supported evidence and checks every field.
 * @param {unknown} value Persisted v2 acknowledgement.
 * @return {ShiftPlanningCommittedAttemptOutcome} Validated immutable receipt.
 */
export const parseShiftPlanningCommittedAttemptOutcome = (
  value: unknown,
): ShiftPlanningCommittedAttemptOutcome => {
  const actual = record(value);
  const rebuilt = createShiftPlanningCommittedAttemptOutcome({
    acknowledgement: actual.acknowledgement as
      ShiftPlanningCommittedAttemptOutcome["acknowledgement"],
    environment: actual.environment as ShiftPlanningEnvironment,
    operationId: actual.operationId as string,
    operationIntentDigest: actual.operationIntentDigest as string,
    bundleRevision: actual.bundleRevision as string,
    bundleDigest: actual.bundleDigest as string,
    writeEpoch: actual.writeEpoch as number,
    recordedAt: actual.recordedAt as Timestamp,
    measurement: actual.measurement as ShiftPlanningFirestoreAdmission | null,
    direction: actual.direction as ShiftPlanningFirestoreTransactionDirection,
    manifestDigest: actual.manifestDigest as string,
  });
  exactFields(actual, Object.keys(rebuilt));
  const core = {...actual, recordedAt: {
    seconds: rebuilt.recordedAt.seconds,
    nanoseconds: rebuilt.recordedAt.nanoseconds,
  }};
  const canonical = {...rebuilt, recordedAt: core.recordedAt};
  if (createShiftPlanningDigest(core) !==
      createShiftPlanningDigest(canonical)) {
    return failOutcome("Outcome identity, evidence, or digest has drifted.");
  }
  return rebuilt;
};
