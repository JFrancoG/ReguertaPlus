import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
  SHIFT_PLANNING_FIRESTORE_TRANSACTION_SERIALIZER_SCHEMA_VERSION,
  ShiftPlanningFirestoreCommitMeasurement,
  ShiftPlanningFirestoreTransactionDirection,
} from "./shift-planning-firestore-transaction-serializer.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION = 1 as const;

export type ShiftPlanningCommittedAttemptOutcome = {
  schemaVersion: typeof SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION;
  operationKind: "planningTransactionAttemptOutcome";
  state: "committed";
  acknowledgement: "transactionReturned";
  environment: ShiftPlanningEnvironment;
  operationId: string;
  operationIntentDigest: ShiftPlanningDigest;
  attemptId: string;
  outcomePath: string;
  direction: ShiftPlanningFirestoreTransactionDirection;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  writeEpoch: number;
  recordedAt: Timestamp;
  measurement: ShiftPlanningFirestoreCommitMeasurement;
  measurementDigest: ShiftPlanningDigest;
  outcomeDigest: ShiftPlanningDigest;
};

export type CreateShiftPlanningCommittedAttemptOutcomeInput = Omit<
  ShiftPlanningCommittedAttemptOutcome,
  | "schemaVersion"
  | "operationKind"
  | "state"
  | "acknowledgement"
  | "attemptId"
  | "outcomePath"
  | "direction"
  | "measurementDigest"
  | "outcomeDigest"
>;

type UnknownRecord = Record<string, unknown>;

const outcomeFields = [
  "schemaVersion",
  "operationKind",
  "state",
  "acknowledgement",
  "environment",
  "operationId",
  "operationIntentDigest",
  "attemptId",
  "outcomePath",
  "direction",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
  "recordedAt",
  "measurement",
  "measurementDigest",
  "outcomeDigest",
] as const;

const measurementFields = [
  "schemaVersion",
  "direction",
  "manifestDigest",
  "databaseName",
  "writeSetDigest",
  "commitRequestDigest",
  "documentWriteCount",
  "fieldTransformCount",
  "maximumFieldTransformsPerDocument",
  "requestByteCount",
  "adapterRevision",
  "indexConfigurationDigest",
] as const;

const databaseNamePattern = new RegExp(
  "^projects/[a-z][a-z0-9-]{3,62}/databases/" +
  "(?:\\(default\\)|[a-z][a-z0-9_-]{2,62})$",
);

const failOutcome = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_attempt_outcome", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failOutcome(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactFields = (
  value: UnknownRecord,
  fields: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== fields.length ||
    actual.some((field) => !fields.includes(field))
  ) {
    failOutcome(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failOutcome(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failOutcome(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requirePrefixedDigest = (
  value: unknown,
  prefix: string,
  name: string,
): string => {
  if (
    typeof value !== "string" ||
    !new RegExp(`^${prefix}[a-f0-9]{64}$`).test(value)
  ) {
    return failOutcome(`${name} is not a supported digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failOutcome(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) return failOutcome(`${name} must be positive.`);
  return parsed;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failOutcome(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failOutcome("Attempt outcome environment is invalid.");
  }
  return value;
};

const requireDirection = (
  value: unknown,
): ShiftPlanningFirestoreTransactionDirection => {
  if (value !== "forward" && value !== "inverse") {
    return failOutcome("Attempt outcome direction is invalid.");
  }
  return value;
};

const parseMeasurement = (
  value: unknown,
): ShiftPlanningFirestoreCommitMeasurement => {
  const measurement = requireRecord(value, "attempt measurement");
  requireExactFields(
    measurement,
    measurementFields,
    "attempt measurement",
  );
  const direction = requireDirection(measurement.direction);
  const databaseName = measurement.databaseName;
  if (
    measurement.schemaVersion !==
      SHIFT_PLANNING_FIRESTORE_TRANSACTION_SERIALIZER_SCHEMA_VERSION ||
    measurement.adapterRevision !==
      SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION ||
    typeof databaseName !== "string" ||
    !databaseNamePattern.test(databaseName)
  ) {
    return failOutcome("Attempt measurement authority is invalid.");
  }
  const fieldTransformCount = requireNonNegativeInteger(
    measurement.fieldTransformCount,
    "field transform count",
  );
  const maximumFieldTransformsPerDocument = requireNonNegativeInteger(
    measurement.maximumFieldTransformsPerDocument,
    "maximum transforms per document",
  );
  if (
    (fieldTransformCount === 0 && maximumFieldTransformsPerDocument !== 0) ||
    maximumFieldTransformsPerDocument > fieldTransformCount
  ) {
    return failOutcome("Attempt transform counts are inconsistent.");
  }
  return {
    schemaVersion:
      SHIFT_PLANNING_FIRESTORE_TRANSACTION_SERIALIZER_SCHEMA_VERSION,
    direction,
    manifestDigest: requireDigest(
      measurement.manifestDigest,
      "measurement manifest digest",
    ),
    databaseName,
    writeSetDigest: requirePrefixedDigest(
      measurement.writeSetDigest,
      "shift-planning:firestore-write-set:v1:sha256:",
      "write-set digest",
    ),
    commitRequestDigest: requirePrefixedDigest(
      measurement.commitRequestDigest,
      "shift-planning:firestore-commit-request:v1:sha256:",
      "commit-request digest",
    ),
    documentWriteCount: requirePositiveInteger(
      measurement.documentWriteCount,
      "document write count",
    ),
    fieldTransformCount,
    maximumFieldTransformsPerDocument,
    requestByteCount: requirePositiveInteger(
      measurement.requestByteCount,
      "request byte count",
    ),
    adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
    indexConfigurationDigest: requireDigest(
      measurement.indexConfigurationDigest,
      "index configuration digest",
    ),
  };
};

const measurementDigest = (
  measurement: ShiftPlanningFirestoreCommitMeasurement,
): ShiftPlanningDigest => createShiftPlanningDigest(measurement);

const attemptId = (
  measurement: ShiftPlanningFirestoreCommitMeasurement,
): string => {
  const commitHex = measurement.commitRequestDigest.split(":").at(-1);
  if (commitHex === undefined || !/^[a-f0-9]{64}$/.test(commitHex)) {
    return failOutcome("Commit-request digest cannot derive an attempt ID.");
  }
  return `${measurement.direction}-${commitHex}`;
};

const timestampCore = (value: Timestamp): {
  seconds: number;
  nanoseconds: number;
} => ({seconds: value.seconds, nanoseconds: value.nanoseconds});

const outcomeDigestCore = (
  value: Omit<ShiftPlanningCommittedAttemptOutcome, "outcomeDigest">,
): object => ({
  ...value,
  recordedAt: timestampCore(value.recordedAt),
});

/**
 * Creates the immutable acknowledgement written only after the measured
 * Firestore transaction returns successfully. The measurement digest is not
 * part of the measured request, so this record is deliberately a second,
 * non-circular persistence step.
 * @param {CreateShiftPlanningCommittedAttemptOutcomeInput} input Committed
 * operation lineage, post-commit clock sample, and in-memory measurement.
 * @return {ShiftPlanningCommittedAttemptOutcome} Canonical outcome record.
 */
export const createShiftPlanningCommittedAttemptOutcome = (
  input: CreateShiftPlanningCommittedAttemptOutcomeInput,
): ShiftPlanningCommittedAttemptOutcome => {
  const environment = requireEnvironment(input.environment);
  const operationId = requireIdentifier(input.operationId, "operationId");
  const measurement = parseMeasurement(input.measurement);
  const direction = measurement.direction;
  const resolvedAttemptId = attemptId(measurement);
  const withoutDigest: Omit<
    ShiftPlanningCommittedAttemptOutcome,
    "outcomeDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION,
    operationKind: "planningTransactionAttemptOutcome",
    state: "committed",
    acknowledgement: "transactionReturned",
    environment,
    operationId,
    operationIntentDigest: requireDigest(
      input.operationIntentDigest,
      "operation intent digest",
    ),
    attemptId: resolvedAttemptId,
    outcomePath: `${environment}/plus-collections/` +
      `shiftPlanningOperations/${operationId}/` +
      `attemptOutcomes/${resolvedAttemptId}`,
    direction,
    bundleRevision: requireIdentifier(
      input.bundleRevision,
      "bundle revision",
    ),
    bundleDigest: requireDigest(input.bundleDigest, "bundle digest"),
    writeEpoch: requireNonNegativeInteger(input.writeEpoch, "write epoch"),
    recordedAt: requireTimestamp(input.recordedAt, "recordedAt"),
    measurement,
    measurementDigest: measurementDigest(measurement),
  };
  return {
    ...withoutDigest,
    outcomeDigest: createShiftPlanningDigest(
      outcomeDigestCore(withoutDigest),
    ),
  };
};

/**
 * Parses an untrusted attempt outcome and re-derives its stable key, path, and
 * both digests. Exact field validation prevents a later writer from attaching
 * unbound acknowledgement metadata to committed evidence.
 * @param {unknown} value Persisted attempt outcome document.
 * @return {ShiftPlanningCommittedAttemptOutcome} Canonical outcome record.
 */
export const parseShiftPlanningCommittedAttemptOutcome = (
  value: unknown,
): ShiftPlanningCommittedAttemptOutcome => {
  const outcome = requireRecord(value, "attempt outcome");
  requireExactFields(outcome, outcomeFields, "attempt outcome");
  if (
    outcome.schemaVersion !== SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION ||
    outcome.operationKind !== "planningTransactionAttemptOutcome" ||
    outcome.state !== "committed" ||
    outcome.acknowledgement !== "transactionReturned"
  ) {
    return failOutcome("Attempt outcome discriminators are invalid.");
  }
  const environment = requireEnvironment(outcome.environment);
  const operationId = requireIdentifier(outcome.operationId, "operationId");
  const measurement = parseMeasurement(outcome.measurement);
  const direction = requireDirection(outcome.direction);
  const resolvedAttemptId = attemptId(measurement);
  const expectedPath = `${environment}/plus-collections/` +
    `shiftPlanningOperations/${operationId}/` +
    `attemptOutcomes/${resolvedAttemptId}`;
  if (
    direction !== measurement.direction ||
    outcome.attemptId !== resolvedAttemptId ||
    outcome.outcomePath !== expectedPath ||
    outcome.measurementDigest !== measurementDigest(measurement)
  ) {
    return failOutcome("Attempt outcome measurement binding has drifted.");
  }
  const withoutDigest: Omit<
    ShiftPlanningCommittedAttemptOutcome,
    "outcomeDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_ATTEMPT_OUTCOME_SCHEMA_VERSION,
    operationKind: "planningTransactionAttemptOutcome",
    state: "committed",
    acknowledgement: "transactionReturned",
    environment,
    operationId,
    operationIntentDigest: requireDigest(
      outcome.operationIntentDigest,
      "operation intent digest",
    ),
    attemptId: resolvedAttemptId,
    outcomePath: expectedPath,
    direction,
    bundleRevision: requireIdentifier(
      outcome.bundleRevision,
      "bundle revision",
    ),
    bundleDigest: requireDigest(outcome.bundleDigest, "bundle digest"),
    writeEpoch: requireNonNegativeInteger(outcome.writeEpoch, "write epoch"),
    recordedAt: requireTimestamp(outcome.recordedAt, "recordedAt"),
    measurement,
    measurementDigest: requireDigest(
      outcome.measurementDigest,
      "measurement digest",
    ),
  };
  const outcomeDigest = requireDigest(outcome.outcomeDigest, "outcome digest");
  if (
    outcomeDigest !== createShiftPlanningDigest(
      outcomeDigestCore(withoutDigest),
    )
  ) {
    return failOutcome("Attempt outcome digest does not match.");
  }
  return {...withoutDigest, outcomeDigest};
};
