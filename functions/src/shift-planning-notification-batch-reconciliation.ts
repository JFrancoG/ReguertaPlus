import {ShiftPlanningHeldNotificationIntent} from
  "./shift-planning-bundle.js";
import {
  ShiftPlanningError,
  ShiftRotationType,
} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningNotificationDispatchAttempt,
  ShiftPlanningTerminalNotificationDispatchAttempt,
  deriveShiftPlanningNotificationDispatchAggregate,
  parseShiftPlanningNotificationDispatchAttempt,
} from "./shift-planning-notification-dispatch.js";
import {
  parseShiftPlanningHeldNotificationIntent,
} from "./shift-planning-notification-release.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningReleaseLease,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_NOTIFICATION_BATCH_RECONCILIATION_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationIntentReconciliation = {
  intentId: string;
  eventId: string;
  disposition:
    | "accepted"
    | "unknown"
    | "definitivelyFailed"
    | "demonstrablyUnsubmitted";
  attemptIds: readonly string[];
  intentEvidenceDigest: ShiftPlanningDigest;
  terminalEvidenceDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationReleaseLeaseClearAction = {
  action: "clear";
  type: ShiftRotationType;
  expectedLease: ShiftPlanningReleaseLease;
};

export type ShiftPlanningNotificationBatchReconciliation = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_BATCH_RECONCILIATION_SCHEMA_VERSION;
  operationKind: "notificationBatchReconciliation";
  reconciliationId: string;
  environment: ShiftPlanningEnvironment;
  state: "terminal";
  resolution: "reconciled";
  bundleId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  writeEpoch: number;
  reconciledAtMillis: number;
  intents: readonly ShiftPlanningNotificationIntentReconciliation[];
  possibleDeliveryIntentIds: readonly string[];
  definitivelyFailedIntentIds: readonly string[];
  demonstrablyUnsubmittedIntentIds: readonly string[];
  releaseLeaseActions: readonly [
    ShiftPlanningNotificationReleaseLeaseClearAction,
    ShiftPlanningNotificationReleaseLeaseClearAction,
  ];
  reconciliationDigest: ShiftPlanningDigest;
};

type UnknownRecord = Record<string, unknown>;

const leaseFields = [
  "type",
  "bundleId",
  "bundleRevision",
  "bundleDigest",
  "leaseEpoch",
  "ownerOperationId",
  "state",
  "acquiredAtMillis",
  "deadlineAtMillis",
] as const;

const failReconciliation = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const failLeaseConflict = (message: string): never => {
  throw new ShiftPlanningError("planning_release_lease_conflict", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failReconciliation(`${name} must be a plain object.`);
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
    failReconciliation(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failReconciliation(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failReconciliation(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failReconciliation(`${name} must be a non-negative integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) {
    return failReconciliation(`${name} must be positive.`);
  }
  return parsed;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failReconciliation("Planning environment is invalid.");
  }
  return value;
};

const parseReleaseLease = (
  value: unknown,
  type: ShiftRotationType,
): ShiftPlanningReleaseLease => {
  const lease = requireRecord(value, `${type} release lease`);
  requireExactFields(lease, leaseFields, `${type} release lease`);
  const acquiredAtMillis = requireNonNegativeInteger(
    lease.acquiredAtMillis,
    `${type} lease acquisition`,
  );
  const deadlineAtMillis = requireNonNegativeInteger(
    lease.deadlineAtMillis,
    `${type} lease deadline`,
  );
  if (
    lease.type !== type ||
    (
      lease.state !== "sealed" &&
      lease.state !== "releasing" &&
      lease.state !== "degraded"
    ) ||
    deadlineAtMillis < acquiredAtMillis
  ) {
    return failLeaseConflict(`${type} release lease is invalid.`);
  }
  return {
    type,
    bundleId: requireIdentifier(lease.bundleId, `${type} lease bundleId`),
    bundleRevision: requireIdentifier(
      lease.bundleRevision,
      `${type} lease bundleRevision`,
    ),
    bundleDigest: requireDigest(
      lease.bundleDigest,
      `${type} lease bundleDigest`,
    ),
    leaseEpoch: requirePositiveInteger(
      lease.leaseEpoch,
      `${type} lease epoch`,
    ),
    ownerOperationId: requireIdentifier(
      lease.ownerOperationId,
      `${type} lease owner`,
    ),
    state: lease.state,
    acquiredAtMillis,
    deadlineAtMillis,
  };
};

const requirePairedLeases = (
  delivery: ShiftPlanningReleaseLease,
  market: ShiftPlanningReleaseLease,
): void => {
  if (
    delivery.bundleId !== market.bundleId ||
    delivery.bundleRevision !== market.bundleRevision ||
    delivery.bundleDigest !== market.bundleDigest ||
    delivery.leaseEpoch !== market.leaseEpoch ||
    delivery.ownerOperationId !== market.ownerOperationId ||
    delivery.acquiredAtMillis !== market.acquiredAtMillis ||
    delivery.deadlineAtMillis !== market.deadlineAtMillis
  ) {
    failLeaseConflict("Release leases do not own one exact bundle batch.");
  }
};

const intentOrdinal = (intentId: string, bundleRevision: string): number => {
  const match = /^(.*)-notification-([1-9][0-9]*)$/.exec(intentId);
  if (!match || match[1] !== bundleRevision) {
    return failReconciliation("Notification intent ordinal is invalid.");
  }
  return requirePositiveInteger(Number(match[2]), "notification ordinal");
};

const requireIntentLineage = (
  intent: ShiftPlanningHeldNotificationIntent,
  lease: ShiftPlanningReleaseLease,
): void => {
  if (
    intent.bundleRevision !== lease.bundleRevision ||
    intent.bundleDigest !== lease.bundleDigest ||
    intent.writeEpoch !== lease.leaseEpoch
  ) {
    failLeaseConflict("Notification intent drifted from its release lease.");
  }
};

const terminalEvidence = (
  attempts: readonly ShiftPlanningTerminalNotificationDispatchAttempt[],
): object[] => attempts.map((attempt) => ({
  attemptId: attempt.attemptId,
  attemptOrdinal: attempt.attemptOrdinal,
  lease: {
    workerId: attempt.lease.workerId,
    epoch: attempt.lease.epoch,
    acquiredAtMillis: attempt.lease.acquiredAt.toMillis(),
    expiresAtMillis: attempt.lease.expiresAt.toMillis(),
  },
  validation: {
    assignmentRevision: attempt.validation.assignmentRevision,
    membershipRevision: attempt.validation.membershipRevision,
    eligibilityRevision: attempt.validation.eligibilityRevision,
    destinationRevision: attempt.validation.destinationRevision,
    destinationDigest: attempt.validation.destinationDigest,
    messagingTargetCount: attempt.validation.messagingTargetCount,
    validationDigest: attempt.validation.validationDigest,
  },
  authenticatedStartedAtMillis:
    attempt.authenticatedStartedAt?.toMillis() ?? null,
  outcome: attempt.terminal.outcome,
  completedAtMillis: attempt.terminal.completedAt.toMillis(),
  failureCode: attempt.terminal.failureCode,
  acceptedTargetCount: attempt.terminal.acceptedTargetCount,
  possiblyDelivered: attempt.terminal.possiblyDelivered,
}));

const reconcileIntent = (input: {
  intent: ShiftPlanningHeldNotificationIntent;
  attempts: readonly ShiftPlanningNotificationDispatchAttempt[];
  reconciledAtMillis: number;
}): ShiftPlanningNotificationIntentReconciliation => {
  const attempts = input.attempts.map(
    parseShiftPlanningNotificationDispatchAttempt,
  ).sort((left, right) => left.attemptOrdinal - right.attemptOrdinal);
  if (
    attempts.length === 0 ||
    attempts.some((attempt) =>
      attempt.intentId !== input.intent.intentId ||
      attempt.eventId !== input.intent.intentId) ||
    attempts.some((attempt) => attempt.state !== "terminal")
  ) {
    return failLeaseConflict(
      "Every notification intent must have only terminal attempt evidence.",
    );
  }
  const terminalAttempts = attempts as
    ShiftPlanningTerminalNotificationDispatchAttempt[];
  if (
    terminalAttempts.some((attempt) =>
      attempt.terminal.completedAt.toMillis() > input.reconciledAtMillis)
  ) {
    return failReconciliation(
      "Notification reconciliation predates terminal evidence.",
    );
  }
  const aggregate = deriveShiftPlanningNotificationDispatchAggregate(attempts);
  if (
    aggregate !== "accepted" &&
    aggregate !== "unknown" &&
    aggregate !== "failed"
  ) {
    return failLeaseConflict("Notification intent is not terminal.");
  }
  const disposition = aggregate !== "failed" ? aggregate :
    terminalAttempts.some(({authenticatedStartedAt}) =>
      authenticatedStartedAt !== null) ?
      "definitivelyFailed" : "demonstrablyUnsubmitted";
  const evidence = terminalEvidence(terminalAttempts);
  return {
    intentId: input.intent.intentId,
    eventId: input.intent.intentId,
    disposition,
    attemptIds: terminalAttempts.map(({attemptId}) => attemptId),
    intentEvidenceDigest: createShiftPlanningDigest(input.intent),
    terminalEvidenceDigest: createShiftPlanningDigest(evidence),
  };
};

/**
 * Plans the terminal reconciliation of a whole notification batch. Both
 * rotation leases remain retained unless every canonical intent has complete
 * terminal attempt evidence. Accepted and unknown submissions stay explicit
 * possible-delivery history; only failed-before-submission histories are
 * classified as demonstrably unsubmitted.
 * @param {object} input Dual leases, intents, attempt histories, and time.
 * @return {object} Deterministic CAS proposal that clears both leases together.
 */
export const createShiftPlanningNotificationBatchReconciliation = (input: {
  environment: ShiftPlanningEnvironment;
  reconciliationId: string;
  deliveryLease: ShiftPlanningReleaseLease;
  marketLease: ShiftPlanningReleaseLease;
  intents: readonly ShiftPlanningHeldNotificationIntent[];
  attemptHistories: readonly {
    intentId: string;
    attempts: readonly ShiftPlanningNotificationDispatchAttempt[];
  }[];
  reconciledAtMillis: number;
}): ShiftPlanningNotificationBatchReconciliation => {
  const environment = requireEnvironment(input.environment);
  const reconciliationId = requireIdentifier(
    input.reconciliationId,
    "reconciliationId",
  );
  const reconciledAtMillis = requireNonNegativeInteger(
    input.reconciledAtMillis,
    "reconciliation instant",
  );
  const deliveryLease = parseReleaseLease(input.deliveryLease, "delivery");
  const marketLease = parseReleaseLease(input.marketLease, "market");
  requirePairedLeases(deliveryLease, marketLease);
  if (reconciledAtMillis < deliveryLease.acquiredAtMillis) {
    return failReconciliation("Reconciliation predates lease acquisition.");
  }

  const intents = input.intents.map(parseShiftPlanningHeldNotificationIntent)
    .map((intent) => ({
      intent,
      ordinal: intentOrdinal(intent.intentId, deliveryLease.bundleRevision),
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  if (
    intents.length === 0 ||
    new Set(intents.map(({intent}) => intent.intentId)).size !==
      intents.length ||
    intents.some(({ordinal}, index) => ordinal !== index + 1)
  ) {
    return failReconciliation(
      "Notification batch intents are not complete and contiguous.",
    );
  }
  intents.forEach(({intent}) => requireIntentLineage(intent, deliveryLease));

  const histories = new Map<string, readonly
    ShiftPlanningNotificationDispatchAttempt[]>();
  for (const historyValue of input.attemptHistories) {
    const history = requireRecord(historyValue, "attempt history");
    requireExactFields(history, ["intentId", "attempts"], "attempt history");
    const intentId = requireIdentifier(history.intentId, "history intentId");
    if (!Array.isArray(history.attempts) || histories.has(intentId)) {
      return failReconciliation("Attempt histories are not exact and unique.");
    }
    histories.set(
      intentId,
      history.attempts as readonly ShiftPlanningNotificationDispatchAttempt[],
    );
  }
  if (
    histories.size !== intents.length ||
    [...histories.keys()].some((intentId) =>
      !intents.some(({intent}) => intent.intentId === intentId))
  ) {
    return failReconciliation(
      "Attempt histories do not cover the exact batch.",
    );
  }

  const reconciledIntents = intents.map(({intent}) => reconcileIntent({
    intent,
    attempts: histories.get(intent.intentId) ?? [],
    reconciledAtMillis,
  }));
  const releaseLeaseActions = [
    {action: "clear", type: "delivery", expectedLease: deliveryLease},
    {action: "clear", type: "market", expectedLease: marketLease},
  ] as const;
  const core = {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_BATCH_RECONCILIATION_SCHEMA_VERSION,
    operationKind: "notificationBatchReconciliation" as const,
    reconciliationId,
    environment,
    state: "terminal" as const,
    resolution: "reconciled" as const,
    bundleId: deliveryLease.bundleId,
    bundleRevision: deliveryLease.bundleRevision,
    bundleDigest: deliveryLease.bundleDigest as ShiftPlanningDigest,
    writeEpoch: deliveryLease.leaseEpoch,
    reconciledAtMillis,
    intents: reconciledIntents,
    possibleDeliveryIntentIds: reconciledIntents
      .filter(({disposition}) =>
        disposition === "accepted" || disposition === "unknown")
      .map(({intentId}) => intentId),
    definitivelyFailedIntentIds: reconciledIntents
      .filter(({disposition}) => disposition === "definitivelyFailed")
      .map(({intentId}) => intentId),
    demonstrablyUnsubmittedIntentIds: reconciledIntents
      .filter(({disposition}) => disposition === "demonstrablyUnsubmitted")
      .map(({intentId}) => intentId),
    releaseLeaseActions,
  };
  return {
    ...core,
    reconciliationDigest: createShiftPlanningDigest(core),
  };
};
