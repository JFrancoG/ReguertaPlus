import {Timestamp} from "@google-cloud/firestore";
import {
  ShiftPlanningError,
  ShiftPlanningFailureCode,
} from "./shift-planning-contract.js";
import {
  SHIFT_PLANNING_DIGEST_PREFIX,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningPublicWriteEventDecision,
  classifyShiftPlanningPublicWriteEvent,
} from "./shift-planning-public-event-contract.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningPublicEventOperationKind =
  | "activation"
  | "recovery"
  | "repair"
  | "syncCorrection";

export type ShiftPlanningPublicEventRetentionPolicy = {
  schemaVersion:
    typeof SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION;
  policyRevision: string;
  maximumDeliveryRetryHorizonMillis: number;
  safetyMarginMillis: number;
  policyDigest: string;
};

export type ShiftPlanningPublicEventOperationRetention = {
  schemaVersion:
    typeof SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION;
  recordKind: "publicEventOperationRetention";
  state: "retained";
  environment: ShiftPlanningEnvironment;
  controlledOperationKind: ShiftPlanningPublicEventOperationKind;
  operationId: string;
  operationIntentDigest: string;
  terminalAt: Timestamp;
  policyRevision: string;
  maximumDeliveryRetryHorizonMillis: number;
  safetyMarginMillis: number;
  policyDigest: string;
  retainUntil: Timestamp;
  retentionDigest: string;
};

export type ShiftPlanningPublicEventLedger = {
  schemaVersion:
    typeof SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION;
  recordKind: "publicEventLedger";
  state: "terminal";
  outcome: "controlledNoOp" | "rejected";
  eventId: string | null;
  eventTime: Timestamp | null;
  environment: ShiftPlanningEnvironment;
  targetPath: string;
  mutationKind: "create" | "update" | "delete";
  controlledOperationKind: ShiftPlanningPublicEventOperationKind | null;
  operationId: string | null;
  operationIntentDigest: string | null;
  failureCode: ShiftPlanningFailureCode | null;
  alertRequired: boolean;
  legacySideEffectsAllowed: false;
  policyRevision: string;
  maximumDeliveryRetryHorizonMillis: number;
  safetyMarginMillis: number;
  policyDigest: string;
  retainUntil: Timestamp;
  eventDigest: string;
  ledgerDigest: string;
};

export type ShiftPlanningPublicEventProducerOutcome =
  | {
    kind: "ordinary";
    targetPath: string;
    legacySideEffectsAllowed: true;
  }
  | {
    kind: "controlledNoOp";
    decision: Extract<
      ShiftPlanningPublicWriteEventDecision,
      {kind: "controlledNoOp"}
    >;
    ledger: ShiftPlanningPublicEventLedger;
    alertRequired: false;
    legacySideEffectsAllowed: false;
  }
  | {
    kind: "failClosed";
    targetPath: string;
    failureCode: "invalid_planning_publication_contract";
    eventDigest: string;
    ledger: ShiftPlanningPublicEventLedger;
    alertRequired: true;
    legacySideEffectsAllowed: false;
  };

export type ShiftPlanningPublicEventCleanupDecision =
  | {
    kind: "retain";
    retainUntil: Timestamp;
    protectedDigests: readonly string[];
    protectedPaths: readonly string[];
  }
  | {
    kind: "eligible";
    expiredAfter: Timestamp;
    protectedDigests: readonly string[];
    protectedPaths: readonly string[];
  };

const policyFields = [
  "schemaVersion",
  "policyRevision",
  "maximumDeliveryRetryHorizonMillis",
  "safetyMarginMillis",
  "policyDigest",
] as const;

const operationRetentionFields = [
  "schemaVersion",
  "recordKind",
  "state",
  "environment",
  "controlledOperationKind",
  "operationId",
  "operationIntentDigest",
  "terminalAt",
  "policyRevision",
  "maximumDeliveryRetryHorizonMillis",
  "safetyMarginMillis",
  "policyDigest",
  "retainUntil",
  "retentionDigest",
] as const;

const ledgerFields = [
  "schemaVersion",
  "recordKind",
  "state",
  "outcome",
  "eventId",
  "eventTime",
  "environment",
  "targetPath",
  "mutationKind",
  "controlledOperationKind",
  "operationId",
  "operationIntentDigest",
  "failureCode",
  "alertRequired",
  "legacySideEffectsAllowed",
  "policyRevision",
  "maximumDeliveryRetryHorizonMillis",
  "safetyMarginMillis",
  "policyDigest",
  "retainUntil",
  "eventDigest",
  "ledgerDigest",
] as const;

const failRetention = (message: string): never => {
  throw new ShiftPlanningError(
    "invalid_planning_publication_contract",
    message,
  );
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failRetention(`${name} must be a plain object.`);
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
    return failRetention(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failRetention(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireEventId = (value: unknown): string => {
  const containsControlCharacter = typeof value === "string" &&
    [...value].some((character) => {
      const codeUnit = character.charCodeAt(0);
      return codeUnit <= 31 || codeUnit === 127;
    });
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    value !== value.trim() ||
    containsControlCharacter
  ) {
    return failRetention("eventId is invalid.");
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !new RegExp(
      `^${SHIFT_PLANNING_DIGEST_PREFIX.replace(/[:]/g, "\\:")}[0-9a-f]{64}$`,
    ).test(value)
  ) {
    return failRetention(`${name} is not a planning digest.`);
  }
  return value;
};

const requirePositiveMillis = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return failRetention(`${name} must be a positive safe integer.`);
  }
  return value as number;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (
    !(value instanceof Timestamp) ||
    value.nanoseconds % 1_000_000 !== 0 ||
    value.toMillis() < 0 ||
    !Number.isSafeInteger(value.toMillis())
  ) {
    return failRetention(
      `${name} must be a non-negative millisecond timestamp.`,
    );
  }
  return value;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failRetention("environment is invalid.");
  }
  return value;
};

const requireOperationKind = (
  value: unknown,
): ShiftPlanningPublicEventOperationKind => {
  if (
    value !== "activation" &&
    value !== "recovery" &&
    value !== "repair" &&
    value !== "syncCorrection"
  ) {
    return failRetention("controlledOperationKind is invalid.");
  }
  return value;
};

const requireMutationKind = (
  value: unknown,
): "create" | "update" | "delete" => {
  if (value !== "create" && value !== "update" && value !== "delete") {
    return failRetention("mutationKind is invalid.");
  }
  return value;
};

const requireTargetPath = (
  value: unknown,
  environment: ShiftPlanningEnvironment,
): string => {
  if (typeof value !== "string") {
    return failRetention("targetPath is invalid.");
  }
  const segments = value.split("/");
  if (
    segments.length !== 4 ||
    segments[0] !== environment ||
    segments[1] !== "plus-collections" ||
    segments[2] !== "shifts" ||
    !/^shift_(delivery|market)_\d{8}$/.test(segments[3])
  ) {
    return failRetention("targetPath is not a canonical public shift path.");
  }
  return value;
};

const safeAddMillis = (values: readonly number[]): number => {
  const result = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(result)) {
    return failRetention("Retention instant exceeds the safe integer range.");
  }
  return result;
};

const timestampFromMillis = (value: number, name: string): Timestamp => {
  try {
    return Timestamp.fromMillis(value);
  } catch {
    return failRetention(`${name} is outside the Firestore timestamp range.`);
  }
};

const sameTimestamp = (left: Timestamp, right: Timestamp): boolean =>
  left.isEqual(right);

const planningRoot = (environment: ShiftPlanningEnvironment): string =>
  `${environment}/plus-collections`;

/**
 * Returns the immutable policy-binding path for one operation terminal.
 * @param {object} input Environment and operation identity.
 * @return {string} Canonical backend-only Firestore document path.
 */
export const shiftPlanningPublicEventOperationRetentionPath = (input: {
  environment: ShiftPlanningEnvironment;
  operationId: string;
}): string => {
  const environment = requireEnvironment(input.environment);
  const operationId = requireIdentifier(input.operationId, "operationId");
  return `${planningRoot(environment)}/shiftPlanningPublicEventLedgers/` +
    `operation-${operationId}`;
};

/**
 * Returns the idempotent ledger path for one controlled or rejected event.
 * @param {object} input Environment and stable event digest.
 * @return {string} Canonical backend-only Firestore document path.
 */
export const shiftPlanningPublicEventLedgerPath = (input: {
  environment: ShiftPlanningEnvironment;
  eventDigest: string;
}): string => {
  const environment = requireEnvironment(input.environment);
  const eventDigest = requireDigest(input.eventDigest, "eventDigest");
  const digestHex = eventDigest.slice(SHIFT_PLANNING_DIGEST_PREFIX.length);
  return `${planningRoot(environment)}/shiftPlanningPublicEventLedgers/` +
    `event-${digestHex}`;
};

const policyWithoutDigest = (input: {
  policyRevision: string;
  maximumDeliveryRetryHorizonMillis: number;
  safetyMarginMillis: number;
}) => ({
  schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
  policyRevision: input.policyRevision,
  maximumDeliveryRetryHorizonMillis:
    input.maximumDeliveryRetryHorizonMillis,
  safetyMarginMillis: input.safetyMarginMillis,
});

/**
 * Freezes the approved end-to-end event retention horizon.
 * @param {object} input Versioned horizon and safety margin.
 * @return {ShiftPlanningPublicEventRetentionPolicy} Immutable policy.
 */
export const createShiftPlanningPublicEventRetentionPolicy = (input: {
  policyRevision: string;
  maximumDeliveryRetryHorizonMillis: number;
  safetyMarginMillis: number;
}): ShiftPlanningPublicEventRetentionPolicy => {
  const withoutDigest = policyWithoutDigest({
    policyRevision: requireIdentifier(
      input.policyRevision,
      "policyRevision",
    ),
    maximumDeliveryRetryHorizonMillis: requirePositiveMillis(
      input.maximumDeliveryRetryHorizonMillis,
      "maximumDeliveryRetryHorizonMillis",
    ),
    safetyMarginMillis: requirePositiveMillis(
      input.safetyMarginMillis,
      "safetyMarginMillis",
    ),
  });
  safeAddMillis([
    withoutDigest.maximumDeliveryRetryHorizonMillis,
    withoutDigest.safetyMarginMillis,
  ]);
  return {
    ...withoutDigest,
    policyDigest: createShiftPlanningDigest({
      contract: "publicEventRetentionPolicy",
      ...withoutDigest,
    }),
  };
};

/**
 * Parses one exact retention policy and re-verifies its digest.
 * @param {unknown} value Candidate persisted policy.
 * @return {ShiftPlanningPublicEventRetentionPolicy} Verified policy.
 */
export const parseShiftPlanningPublicEventRetentionPolicy = (
  value: unknown,
): ShiftPlanningPublicEventRetentionPolicy => {
  const record = requireRecord(value, "public event retention policy");
  requireExactFields(record, policyFields, "public event retention policy");
  if (
    record.schemaVersion !==
      SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION
  ) {
    return failRetention(
      "Public event retention policy version is unsupported.",
    );
  }
  const parsed = createShiftPlanningPublicEventRetentionPolicy({
    policyRevision: requireIdentifier(
      record.policyRevision,
      "policyRevision",
    ),
    maximumDeliveryRetryHorizonMillis: requirePositiveMillis(
      record.maximumDeliveryRetryHorizonMillis,
      "maximumDeliveryRetryHorizonMillis",
    ),
    safetyMarginMillis: requirePositiveMillis(
      record.safetyMarginMillis,
      "safetyMarginMillis",
    ),
  });
  if (parsed.policyDigest !== record.policyDigest) {
    return failRetention("Public event retention policy digest is invalid.");
  }
  return parsed;
};

const policyFromRecord = (
  value: UnknownRecord,
): ShiftPlanningPublicEventRetentionPolicy =>
  parseShiftPlanningPublicEventRetentionPolicy({
    schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
    policyRevision: value.policyRevision,
    maximumDeliveryRetryHorizonMillis:
      value.maximumDeliveryRetryHorizonMillis,
    safetyMarginMillis: value.safetyMarginMillis,
    policyDigest: value.policyDigest,
  });

const operationRetentionWithoutDigest = (input: {
  environment: ShiftPlanningEnvironment;
  controlledOperationKind: ShiftPlanningPublicEventOperationKind;
  operationId: string;
  operationIntentDigest: string;
  terminalAt: Timestamp;
  policy: ShiftPlanningPublicEventRetentionPolicy;
  retainUntil: Timestamp;
}) => ({
  schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
  recordKind: "publicEventOperationRetention" as const,
  state: "retained" as const,
  environment: input.environment,
  controlledOperationKind: input.controlledOperationKind,
  operationId: input.operationId,
  operationIntentDigest: input.operationIntentDigest,
  terminalAt: input.terminalAt,
  policyRevision: input.policy.policyRevision,
  maximumDeliveryRetryHorizonMillis:
    input.policy.maximumDeliveryRetryHorizonMillis,
  safetyMarginMillis: input.policy.safetyMarginMillis,
  policyDigest: input.policy.policyDigest,
  retainUntil: input.retainUntil,
});

const operationRetentionDigest = (
  value: ReturnType<typeof operationRetentionWithoutDigest>,
): string => createShiftPlanningDigest({
  contract: "publicEventOperationRetention",
  schemaVersion: value.schemaVersion,
  recordKind: value.recordKind,
  state: value.state,
  environment: value.environment,
  controlledOperationKind: value.controlledOperationKind,
  operationId: value.operationId,
  operationIntentDigest: value.operationIntentDigest,
  terminalAtMillis: value.terminalAt.toMillis(),
  policyRevision: value.policyRevision,
  maximumDeliveryRetryHorizonMillis:
    value.maximumDeliveryRetryHorizonMillis,
  safetyMarginMillis: value.safetyMarginMillis,
  policyDigest: value.policyDigest,
  retainUntilMillis: value.retainUntil.toMillis(),
});

/**
 * Creates the immutable retention binding that a controlled-operation producer
 * must persist atomically with its terminal tombstone.
 * @param {object} input Terminal authority and retention policy.
 * @return {ShiftPlanningPublicEventOperationRetention} Retention binding.
 */
export const createShiftPlanningPublicEventOperationRetention = (input: {
  environment: ShiftPlanningEnvironment;
  controlledOperationKind: ShiftPlanningPublicEventOperationKind;
  operationId: string;
  operationIntentDigest: string;
  terminalAt: Timestamp;
  policy: ShiftPlanningPublicEventRetentionPolicy;
}): ShiftPlanningPublicEventOperationRetention => {
  const policy = parseShiftPlanningPublicEventRetentionPolicy(input.policy);
  const terminalAt = requireTimestamp(input.terminalAt, "terminalAt");
  const retainUntil = timestampFromMillis(
    safeAddMillis([
      terminalAt.toMillis(),
      policy.maximumDeliveryRetryHorizonMillis,
      policy.safetyMarginMillis,
    ]),
    "retainUntil",
  );
  const withoutDigest = operationRetentionWithoutDigest({
    environment: requireEnvironment(input.environment),
    controlledOperationKind: requireOperationKind(
      input.controlledOperationKind,
    ),
    operationId: requireIdentifier(input.operationId, "operationId"),
    operationIntentDigest: requireDigest(
      input.operationIntentDigest,
      "operationIntentDigest",
    ),
    terminalAt,
    policy,
    retainUntil,
  });
  return {
    ...withoutDigest,
    retentionDigest: operationRetentionDigest(withoutDigest),
  };
};

/**
 * Parses and re-verifies one operation-retention binding.
 * @param {unknown} value Candidate persisted operation retention.
 * @return {ShiftPlanningPublicEventOperationRetention} Verified binding.
 */
export const parseShiftPlanningPublicEventOperationRetention = (
  value: unknown,
): ShiftPlanningPublicEventOperationRetention => {
  const record = requireRecord(value, "public event operation retention");
  requireExactFields(
    record,
    operationRetentionFields,
    "public event operation retention",
  );
  if (
    record.schemaVersion !==
      SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION ||
    record.recordKind !== "publicEventOperationRetention" ||
    record.state !== "retained"
  ) {
    return failRetention("Public event operation retention header is invalid.");
  }
  const policy = policyFromRecord(record);
  const parsed = createShiftPlanningPublicEventOperationRetention({
    environment: requireEnvironment(record.environment),
    controlledOperationKind: requireOperationKind(
      record.controlledOperationKind,
    ),
    operationId: requireIdentifier(record.operationId, "operationId"),
    operationIntentDigest: requireDigest(
      record.operationIntentDigest,
      "operationIntentDigest",
    ),
    terminalAt: requireTimestamp(record.terminalAt, "terminalAt"),
    policy,
  });
  if (
    !sameTimestamp(
      parsed.retainUntil,
      requireTimestamp(record.retainUntil, "retainUntil"),
    ) ||
    parsed.retentionDigest !== record.retentionDigest
  ) {
    return failRetention("Public event operation retention digest is invalid.");
  }
  return parsed;
};

const mutationKindForEvent = (input: {
  before: unknown | null;
  after: unknown | null;
}): "create" | "update" | "delete" =>
  input.after === null ? "delete" : input.before === null ? "create" : "update";

const ledgerWithoutDigest = (
  input: Omit<ShiftPlanningPublicEventLedger, "ledgerDigest">,
): Omit<ShiftPlanningPublicEventLedger, "ledgerDigest"> => input;

const ledgerDigest = (
  value: Omit<ShiftPlanningPublicEventLedger, "ledgerDigest">,
): string => createShiftPlanningDigest({
  contract: "publicEventLedger",
  schemaVersion: value.schemaVersion,
  recordKind: value.recordKind,
  state: value.state,
  outcome: value.outcome,
  eventId: value.eventId,
  eventTimeMillis: value.eventTime?.toMillis() ?? null,
  environment: value.environment,
  targetPath: value.targetPath,
  mutationKind: value.mutationKind,
  controlledOperationKind: value.controlledOperationKind,
  operationId: value.operationId,
  operationIntentDigest: value.operationIntentDigest,
  failureCode: value.failureCode,
  alertRequired: value.alertRequired,
  legacySideEffectsAllowed: value.legacySideEffectsAllowed,
  policyRevision: value.policyRevision,
  maximumDeliveryRetryHorizonMillis:
    value.maximumDeliveryRetryHorizonMillis,
  safetyMarginMillis: value.safetyMarginMillis,
  policyDigest: value.policyDigest,
  retainUntilMillis: value.retainUntil.toMillis(),
  eventDigest: value.eventDigest,
});

const controlledLedger = (input: {
  decision: Extract<
    ShiftPlanningPublicWriteEventDecision,
    {kind: "controlledNoOp"}
  >;
  eventTime: Timestamp;
  retention: ShiftPlanningPublicEventOperationRetention;
}): ShiftPlanningPublicEventLedger => {
  const retention = parseShiftPlanningPublicEventOperationRetention(
    input.retention,
  );
  const eventTime = requireTimestamp(input.eventTime, "eventTime");
  if (
    retention.controlledOperationKind !== input.decision.operationKind ||
    retention.operationId !== input.decision.operationId ||
    retention.operationIntentDigest !==
      input.decision.operationIntentDigest ||
    retention.environment !== input.decision.targetPath.split("/")[0] ||
    eventTime.toMillis() < retention.terminalAt.toMillis() ||
    eventTime.toMillis() > retention.retainUntil.toMillis()
  ) {
    return failRetention(
      "Controlled event is outside or detached from retained authority.",
    );
  }
  const withoutDigest = ledgerWithoutDigest({
    schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
    recordKind: "publicEventLedger",
    state: "terminal",
    outcome: "controlledNoOp",
    eventId: null,
    eventTime: null,
    environment: retention.environment,
    targetPath: input.decision.targetPath,
    mutationKind: input.decision.mutationKind,
    controlledOperationKind: input.decision.operationKind,
    operationId: input.decision.operationId,
    operationIntentDigest: input.decision.operationIntentDigest,
    failureCode: null,
    alertRequired: false,
    legacySideEffectsAllowed: false,
    policyRevision: retention.policyRevision,
    maximumDeliveryRetryHorizonMillis:
      retention.maximumDeliveryRetryHorizonMillis,
    safetyMarginMillis: retention.safetyMarginMillis,
    policyDigest: retention.policyDigest,
    retainUntil: retention.retainUntil,
    eventDigest: requireDigest(input.decision.eventDigest, "eventDigest"),
  });
  return {...withoutDigest, ledgerDigest: ledgerDigest(withoutDigest)};
};

const rejectedEventDigest = (input: {
  eventId: string;
  environment: ShiftPlanningEnvironment;
  targetPath: string;
  mutationKind: "create" | "update" | "delete";
  failureCode: "invalid_planning_publication_contract";
}): string => createShiftPlanningDigest({
  contract: "publicEventRejected",
  schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
  ...input,
});

const rejectedLedger = (input: {
  eventId: string;
  eventTime: Timestamp;
  targetPath: string;
  mutationKind: "create" | "update" | "delete";
  policy: ShiftPlanningPublicEventRetentionPolicy;
}): ShiftPlanningPublicEventLedger => {
  const policy = parseShiftPlanningPublicEventRetentionPolicy(input.policy);
  const eventTime = requireTimestamp(input.eventTime, "eventTime");
  const environment = requireEnvironment(input.targetPath.split("/")[0]);
  const targetPath = requireTargetPath(input.targetPath, environment);
  const eventId = requireEventId(input.eventId);
  const mutationKind = requireMutationKind(input.mutationKind);
  const failureCode = "invalid_planning_publication_contract" as const;
  const retainUntil = timestampFromMillis(
    safeAddMillis([
      eventTime.toMillis(),
      policy.maximumDeliveryRetryHorizonMillis,
      policy.safetyMarginMillis,
    ]),
    "retainUntil",
  );
  const eventDigest = rejectedEventDigest({
    eventId,
    environment,
    targetPath,
    mutationKind,
    failureCode,
  });
  const withoutDigest = ledgerWithoutDigest({
    schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
    recordKind: "publicEventLedger",
    state: "terminal",
    outcome: "rejected",
    eventId,
    eventTime,
    environment,
    targetPath,
    mutationKind,
    controlledOperationKind: null,
    operationId: null,
    operationIntentDigest: null,
    failureCode,
    alertRequired: true,
    legacySideEffectsAllowed: false,
    policyRevision: policy.policyRevision,
    maximumDeliveryRetryHorizonMillis:
      policy.maximumDeliveryRetryHorizonMillis,
    safetyMarginMillis: policy.safetyMarginMillis,
    policyDigest: policy.policyDigest,
    retainUntil,
    eventDigest,
  });
  return {...withoutDigest, ledgerDigest: ledgerDigest(withoutDigest)};
};

const parsedLedgerBase = (record: UnknownRecord) => {
  const policy = policyFromRecord(record);
  const environment = requireEnvironment(record.environment);
  return {
    policy,
    environment,
    targetPath: requireTargetPath(record.targetPath, environment),
    mutationKind: requireMutationKind(record.mutationKind),
    retainUntil: requireTimestamp(record.retainUntil, "retainUntil"),
    eventDigest: requireDigest(record.eventDigest, "eventDigest"),
    ledgerDigest: requireDigest(record.ledgerDigest, "ledgerDigest"),
  };
};

/**
 * Parses one immutable controlled or rejected event-ledger terminal.
 * @param {unknown} value Candidate persisted ledger entry.
 * @return {ShiftPlanningPublicEventLedger} Verified ledger entry.
 */
export const parseShiftPlanningPublicEventLedger = (
  value: unknown,
): ShiftPlanningPublicEventLedger => {
  const record = requireRecord(value, "public event ledger");
  requireExactFields(record, ledgerFields, "public event ledger");
  if (
    record.schemaVersion !==
      SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION ||
    record.recordKind !== "publicEventLedger" ||
    record.state !== "terminal" ||
    record.legacySideEffectsAllowed !== false
  ) {
    return failRetention("Public event ledger header is invalid.");
  }
  const base = parsedLedgerBase(record);
  let parsed: ShiftPlanningPublicEventLedger;
  if (record.outcome === "controlledNoOp") {
    if (
      record.eventId !== null ||
      record.eventTime !== null ||
      record.failureCode !== null ||
      record.alertRequired !== false
    ) {
      return failRetention("Controlled event ledger disposition is invalid.");
    }
    const withoutDigest = ledgerWithoutDigest({
      schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_SCHEMA_VERSION,
      recordKind: "publicEventLedger",
      state: "terminal",
      outcome: "controlledNoOp",
      eventId: null,
      eventTime: null,
      environment: base.environment,
      targetPath: base.targetPath,
      mutationKind: base.mutationKind,
      controlledOperationKind: requireOperationKind(
        record.controlledOperationKind,
      ),
      operationId: requireIdentifier(record.operationId, "operationId"),
      operationIntentDigest: requireDigest(
        record.operationIntentDigest,
        "operationIntentDigest",
      ),
      failureCode: null,
      alertRequired: false,
      legacySideEffectsAllowed: false,
      policyRevision: base.policy.policyRevision,
      maximumDeliveryRetryHorizonMillis:
        base.policy.maximumDeliveryRetryHorizonMillis,
      safetyMarginMillis: base.policy.safetyMarginMillis,
      policyDigest: base.policy.policyDigest,
      retainUntil: base.retainUntil,
      eventDigest: base.eventDigest,
    });
    parsed = {...withoutDigest, ledgerDigest: ledgerDigest(withoutDigest)};
  } else if (record.outcome === "rejected") {
    if (
      record.controlledOperationKind !== null ||
      record.operationId !== null ||
      record.operationIntentDigest !== null ||
      record.failureCode !== "invalid_planning_publication_contract" ||
      record.alertRequired !== true
    ) {
      return failRetention("Rejected event ledger disposition is invalid.");
    }
    parsed = rejectedLedger({
      eventId: requireEventId(record.eventId),
      eventTime: requireTimestamp(record.eventTime, "eventTime"),
      targetPath: base.targetPath,
      mutationKind: base.mutationKind,
      policy: base.policy,
    });
  } else {
    return failRetention("Public event ledger outcome is invalid.");
  }
  if (
    parsed.eventDigest !== base.eventDigest ||
    !sameTimestamp(parsed.retainUntil, base.retainUntil) ||
    parsed.ledgerDigest !== base.ledgerDigest
  ) {
    return failRetention("Public event ledger digest is invalid.");
  }
  return parsed;
};

/**
 * Produces the side-effect routing intent for a candidate public-write
 * consumer. Invalid changed markers become retained, alertable failures and
 * never ordinary legacy events.
 * @param {object} input Stable event, registry, retention, and policy evidence.
 * @return {ShiftPlanningPublicEventProducerOutcome} Fail-closed route.
 */
export const produceShiftPlanningPublicEventAudit = (input: {
  eventId: string;
  eventTime: Timestamp;
  targetPath: string;
  before: unknown | null;
  after: unknown | null;
  operation: unknown | null;
  retention: ShiftPlanningPublicEventOperationRetention | null;
  policy: ShiftPlanningPublicEventRetentionPolicy;
}): ShiftPlanningPublicEventProducerOutcome => {
  try {
    const decision = classifyShiftPlanningPublicWriteEvent({
      targetPath: input.targetPath,
      before: input.before,
      after: input.after,
      operation: input.operation,
    });
    if (decision.kind === "ordinary") {
      return {
        kind: "ordinary",
        targetPath: decision.targetPath,
        legacySideEffectsAllowed: true,
      };
    }
    if (input.retention === null) {
      return failRetention(
        "Controlled event has no retained operation authority.",
      );
    }
    return {
      kind: "controlledNoOp",
      decision,
      ledger: controlledLedger({
        decision,
        eventTime: input.eventTime,
        retention: input.retention,
      }),
      alertRequired: false,
      legacySideEffectsAllowed: false,
    };
  } catch (error) {
    if (
      !(error instanceof ShiftPlanningError) ||
      error.code !== "invalid_planning_publication_contract"
    ) {
      throw error;
    }
    const ledger = rejectedLedger({
      eventId: input.eventId,
      eventTime: input.eventTime,
      targetPath: input.targetPath,
      mutationKind: mutationKindForEvent(input),
      policy: parseShiftPlanningPublicEventRetentionPolicy(input.policy),
    });
    return {
      kind: "failClosed",
      targetPath: ledger.targetPath,
      failureCode: "invalid_planning_publication_contract",
      eventDigest: ledger.eventDigest,
      ledger,
      alertRequired: true,
      legacySideEffectsAllowed: false,
    };
  }
};

/**
 * Decides whether cleanup may remove one operation terminal and its ledgers.
 * Expiry is exclusive: evidence remains protected at the exact boundary.
 * @param {object} input Current time and complete retained evidence.
 * @return {ShiftPlanningPublicEventCleanupDecision} Cleanup eligibility.
 */
export const classifyShiftPlanningPublicEventEvidenceCleanup = (input: {
  currentTime: Timestamp;
  retention: ShiftPlanningPublicEventOperationRetention;
  ledgers: readonly ShiftPlanningPublicEventLedger[];
}): ShiftPlanningPublicEventCleanupDecision => {
  const currentTime = requireTimestamp(input.currentTime, "currentTime");
  const retention = parseShiftPlanningPublicEventOperationRetention(
    input.retention,
  );
  const ledgers = input.ledgers.map(parseShiftPlanningPublicEventLedger);
  const uniqueEventCount = new Set(
    ledgers.map((item) => item.eventDigest),
  ).size;
  if (uniqueEventCount !== ledgers.length) {
    return failRetention("Public event cleanup contains duplicate ledgers.");
  }
  if (ledgers.some((ledger) =>
    ledger.outcome !== "controlledNoOp" ||
    ledger.environment !== retention.environment ||
    ledger.controlledOperationKind !== retention.controlledOperationKind ||
    ledger.operationId !== retention.operationId ||
    ledger.operationIntentDigest !== retention.operationIntentDigest ||
    ledger.policyDigest !== retention.policyDigest ||
    !sameTimestamp(ledger.retainUntil, retention.retainUntil))) {
    return failRetention(
      "Public event cleanup ledger is detached from operation retention.",
    );
  }
  const protectedDigests = [
    retention.retentionDigest,
    ...ledgers.map((item) => item.ledgerDigest).sort(),
  ];
  const protectedPaths = [
    `${planningRoot(retention.environment)}/shiftPlanningOperations/` +
      retention.operationId,
    shiftPlanningPublicEventOperationRetentionPath({
      environment: retention.environment,
      operationId: retention.operationId,
    }),
    ...ledgers.map((ledger) => shiftPlanningPublicEventLedgerPath({
      environment: ledger.environment,
      eventDigest: ledger.eventDigest,
    })).sort(),
  ];
  if (currentTime.toMillis() <= retention.retainUntil.toMillis()) {
    return {
      kind: "retain",
      retainUntil: retention.retainUntil,
      protectedDigests,
      protectedPaths,
    };
  }
  return {
    kind: "eligible",
    expiredAfter: retention.retainUntil,
    protectedDigests,
    protectedPaths,
  };
};
