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
  ShiftPlanningNotificationDispatchState,
  deriveShiftPlanningNotificationDispatchAggregate,
  parseShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchState,
} from "./shift-planning-notification-dispatch.js";
import {parseShiftPlanningHeldNotificationIntent} from
  "./shift-planning-notification-release.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningReleaseLease,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_NOTIFICATION_TERMINAL_INCIDENT_SCHEMA_VERSION =
  1 as const;
export const SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS =
  86_400_000 as const;

export type ShiftPlanningNotificationDispatchEvidence = {
  intentId: string;
  dispatchState: ShiftPlanningNotificationDispatchState;
  attempts: readonly ShiftPlanningNotificationDispatchAttempt[];
};

export type ShiftPlanningNotificationSafeResumeIntent = {
  intentId: string;
  shiftId: string;
  dispatchDisposition:
    | "pending"
    | "claimed"
    | "submitting"
    | "accepted"
    | "unknown"
    | "definitivelyFailed"
    | "demonstrablyUnsubmitted";
  authenticatedSubmissionPossible: boolean;
  dispatchEvidenceDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationReleaseLeaseDegradeAction = {
  action: "degrade";
  type: ShiftRotationType;
  expectedLease: ShiftPlanningReleaseLease;
  replacementLease: ShiftPlanningReleaseLease;
};

export type ShiftPlanningNotificationSafeResume = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_TERMINAL_INCIDENT_SCHEMA_VERSION;
  operationKind: "notificationSafeResume";
  incidentId: string;
  environment: ShiftPlanningEnvironment;
  state: "degraded";
  resolution: "operatorRequired";
  bundleId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  writeEpoch: number;
  abandonedOwnerOperationId: string;
  ownerUserId: string;
  escalationTargetId: string;
  enteredAtMillis: number;
  expiresAtMillis: number;
  intents: readonly ShiftPlanningNotificationSafeResumeIntent[];
  affectedShiftIds: readonly string[];
  releaseLeaseActions: readonly [
    ShiftPlanningNotificationReleaseLeaseDegradeAction,
    ShiftPlanningNotificationReleaseLeaseDegradeAction,
  ];
  safeResumeDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationTerminalIncidentCancellation = {
  action: "cancelAndSupersede";
  intentId: string;
  incidentId: string;
  cancelledAtMillis: number;
};

export type ShiftPlanningNotificationTerminalIncidentIntent = {
  intentId: string;
  shiftId: string;
  resolution:
    | "cancelledUnsubmitted"
    | "possibleDeliveryCorrectionRequired"
    | "definitivelyFailed";
  attemptIds: readonly string[];
  dispatchEvidenceDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationReleaseLeaseClearAction = {
  action: "clear";
  type: ShiftRotationType;
  expectedLease: ShiftPlanningReleaseLease;
};

export type ShiftPlanningNotificationTerminalIncident = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_TERMINAL_INCIDENT_SCHEMA_VERSION;
  operationKind: "notificationTerminalIncident";
  incidentId: string;
  environment: ShiftPlanningEnvironment;
  state: "terminal";
  resolution: "incidentTerminalized";
  bundleId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  writeEpoch: number;
  ownerUserId: string;
  escalationTargetId: string;
  terminalizedAtMillis: number;
  intents: readonly ShiftPlanningNotificationTerminalIncidentIntent[];
  cancelledIntentIds: readonly string[];
  possibleDeliveryIntentIds: readonly string[];
  correctionRequiredIntentIds: readonly string[];
  definitivelyFailedIntentIds: readonly string[];
  cancellations: readonly
    ShiftPlanningNotificationTerminalIncidentCancellation[];
  releaseLeaseActions: readonly [
    ShiftPlanningNotificationReleaseLeaseClearAction,
    ShiftPlanningNotificationReleaseLeaseClearAction,
  ];
  terminalIncidentDigest: ShiftPlanningDigest;
};

type UnknownRecord = Record<string, unknown>;

type AnalyzedIntent = {
  intent: ShiftPlanningHeldNotificationIntent;
  disposition: ShiftPlanningNotificationSafeResumeIntent[
    "dispatchDisposition"
  ];
  authenticatedSubmissionPossible: boolean;
  attemptIds: readonly string[];
  dispatchEvidenceDigest: ShiftPlanningDigest;
};

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

const failIncident = (message: string): never => {
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
    return failIncident(`${name} must be a plain object.`);
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
    failIncident(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failIncident(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failIncident(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failIncident(`${name} must be a non-negative integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) return failIncident(`${name} must be positive.`);
  return parsed;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failIncident("Planning environment is invalid.");
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
    bundleDigest: requireDigest(lease.bundleDigest, `${type} lease digest`),
    leaseEpoch: requirePositiveInteger(lease.leaseEpoch, `${type} lease epoch`),
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
    return failIncident("Notification intent ordinal is invalid.");
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

const canonicalIntents = (input: {
  intents: readonly ShiftPlanningHeldNotificationIntent[];
  lease: ShiftPlanningReleaseLease;
}): readonly ShiftPlanningHeldNotificationIntent[] => {
  const parsed = input.intents.map(parseShiftPlanningHeldNotificationIntent)
    .map((intent) => ({
      intent,
      ordinal: intentOrdinal(intent.intentId, input.lease.bundleRevision),
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  if (
    parsed.length === 0 ||
    new Set(parsed.map(({intent}) => intent.intentId)).size !== parsed.length ||
    parsed.some(({ordinal}, index) => ordinal !== index + 1)
  ) {
    return failIncident(
      "Notification batch intents are not complete and contiguous.",
    );
  }
  parsed.forEach(({intent}) => requireIntentLineage(intent, input.lease));
  return parsed.map(({intent}) => intent);
};

const evidenceDigest = (input: {
  dispatchState: ShiftPlanningNotificationDispatchState;
  attempts: readonly ShiftPlanningNotificationDispatchAttempt[];
}): ShiftPlanningDigest => createShiftPlanningDigest({
  dispatchState: {
    schemaVersion: input.dispatchState.schemaVersion,
    operationKind: input.dispatchState.operationKind,
    intentId: input.dispatchState.intentId,
    eventId: input.dispatchState.eventId,
    attemptCount: input.dispatchState.attemptCount,
    lastLeaseEpoch: input.dispatchState.lastLeaseEpoch,
    activeLease: null,
  },
  attempts: input.attempts.map((attempt) => ({
    schemaVersion: attempt.schemaVersion,
    operationKind: attempt.operationKind,
    intentId: attempt.intentId,
    eventId: attempt.eventId,
    attemptId: attempt.attemptId,
    attemptOrdinal: attempt.attemptOrdinal,
    lease: {
      attemptId: attempt.lease.attemptId,
      workerId: attempt.lease.workerId,
      epoch: attempt.lease.epoch,
      acquiredAtMillis: attempt.lease.acquiredAt.toMillis(),
      expiresAtMillis: attempt.lease.expiresAt.toMillis(),
    },
    validation: attempt.validation,
    state: attempt.state,
    authenticatedStartedAtMillis:
      attempt.authenticatedStartedAt?.toMillis() ?? null,
    terminal: attempt.terminal === null ? null : {
      outcome: attempt.terminal.outcome,
      completedAtMillis: attempt.terminal.completedAt.toMillis(),
      failureCode: attempt.terminal.failureCode,
      acceptedTargetCount: attempt.terminal.acceptedTargetCount,
      possiblyDelivered: attempt.terminal.possiblyDelivered,
    },
  })),
});

const analyzeIntent = (input: {
  intent: ShiftPlanningHeldNotificationIntent;
  evidence: ShiftPlanningNotificationDispatchEvidence;
  observedAtMillis: number;
}): AnalyzedIntent => {
  const evidence = requireRecord(input.evidence, "dispatch evidence");
  requireExactFields(
    evidence,
    ["intentId", "dispatchState", "attempts"],
    "dispatch evidence",
  );
  const intentId = requireIdentifier(evidence.intentId, "evidence intentId");
  if (!Array.isArray(evidence.attempts)) {
    return failIncident("Dispatch attempts must be an array.");
  }
  const dispatchState = parseShiftPlanningNotificationDispatchState(
    evidence.dispatchState,
  );
  const attempts = evidence.attempts.map(
    parseShiftPlanningNotificationDispatchAttempt,
  ).sort((left, right) => left.attemptOrdinal - right.attemptOrdinal);
  if (
    intentId !== input.intent.intentId ||
    dispatchState.intentId !== intentId ||
    dispatchState.eventId !== intentId ||
    dispatchState.activeLease !== null ||
    dispatchState.attemptCount !== attempts.length ||
    dispatchState.lastLeaseEpoch !== attempts.length ||
    attempts.some((attempt, index) =>
      attempt.intentId !== intentId ||
      attempt.eventId !== intentId ||
      attempt.attemptOrdinal !== index + 1)
  ) {
    return failLeaseConflict("Dispatch evidence is not exact and inactive.");
  }
  if (attempts.some((attempt) => {
    if (attempt.state === "terminal") {
      return attempt.terminal.completedAt.toMillis() > input.observedAtMillis;
    }
    return attempt.lease.expiresAt.toMillis() > input.observedAtMillis;
  })) {
    return failLeaseConflict(
      "Dispatch evidence is not settled at observation.",
    );
  }
  const aggregate = deriveShiftPlanningNotificationDispatchAggregate(attempts);
  const accepted = attempts.some((attempt) =>
    attempt.state === "terminal" &&
    attempt.terminal.outcome === "accepted");
  const unknown = attempts.some((attempt) =>
    attempt.state === "terminal" &&
    attempt.terminal.outcome === "unknown");
  const authenticatedSubmissionPossible =
    accepted ||
    unknown ||
    aggregate === "submitting";
  const disposition = accepted ? "accepted" : unknown ? "unknown" :
    aggregate !== "failed" ? aggregate :
      attempts.some(({authenticatedStartedAt}) =>
        authenticatedStartedAt !== null) ?
        "definitivelyFailed" : "demonstrablyUnsubmitted";
  return {
    intent: input.intent,
    disposition,
    authenticatedSubmissionPossible,
    attemptIds: attempts.map(({attemptId}) => attemptId),
    dispatchEvidenceDigest: evidenceDigest({dispatchState, attempts}),
  };
};

const analyzeBatch = (input: {
  intents: readonly ShiftPlanningHeldNotificationIntent[];
  dispatchEvidence: readonly ShiftPlanningNotificationDispatchEvidence[];
  observedAtMillis: number;
}): readonly AnalyzedIntent[] => {
  const evidenceByIntent = new Map<
    string,
    ShiftPlanningNotificationDispatchEvidence
  >();
  for (const value of input.dispatchEvidence) {
    const evidence = requireRecord(value, "dispatch evidence");
    const intentId = requireIdentifier(evidence.intentId, "evidence intentId");
    if (evidenceByIntent.has(intentId)) {
      return failIncident("Dispatch evidence is not unique.");
    }
    evidenceByIntent.set(
      intentId,
      value as ShiftPlanningNotificationDispatchEvidence,
    );
  }
  if (
    evidenceByIntent.size !== input.intents.length ||
    [...evidenceByIntent.keys()].some((intentId) =>
      !input.intents.some((intent) => intent.intentId === intentId))
  ) {
    return failIncident("Dispatch evidence does not cover the exact batch.");
  }
  return input.intents.map((intent) => analyzeIntent({
    intent,
    evidence: evidenceByIntent.get(intent.intentId) ??
      failIncident("Dispatch evidence is missing."),
    observedAtMillis: input.observedAtMillis,
  }));
};

const sameValue = (left: unknown, right: unknown): boolean =>
  createShiftPlanningDigest(left) === createShiftPlanningDigest(right);

const safeResumeCore = (
  safeResume: ShiftPlanningNotificationSafeResume,
): Omit<ShiftPlanningNotificationSafeResume, "safeResumeDigest"> => {
  const core: Partial<ShiftPlanningNotificationSafeResume> = {...safeResume};
  delete core.safeResumeDigest;
  return core as Omit<
    ShiftPlanningNotificationSafeResume,
    "safeResumeDigest"
  >;
};

const requireSafeResume = (
  value: ShiftPlanningNotificationSafeResume,
): ShiftPlanningNotificationSafeResume => {
  if (
    value.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_TERMINAL_INCIDENT_SCHEMA_VERSION ||
    value.operationKind !== "notificationSafeResume" ||
    value.state !== "degraded" ||
    value.resolution !== "operatorRequired" ||
    createShiftPlanningDigest(safeResumeCore(value)) !== value.safeResumeDigest
  ) {
    return failIncident("Safe-resume evidence is invalid.");
  }
  return value;
};

/**
 * Freezes an abandoned notification batch into a bounded degraded mode. The
 * complete inactive dispatch evidence is summarized, both release leases move
 * to one incident owner, and only affected shifts remain mutation-fenced.
 * @param {object} input Exact batch, ownership, evidence, and TTL authority.
 * @return {object} Deterministic dual-lease degraded-mode proposal.
 */
export const createShiftPlanningNotificationSafeResume = (input: {
  environment: ShiftPlanningEnvironment;
  incidentId: string;
  ownerUserId: string;
  escalationTargetId: string;
  deliveryLease: ShiftPlanningReleaseLease;
  marketLease: ShiftPlanningReleaseLease;
  intents: readonly ShiftPlanningHeldNotificationIntent[];
  dispatchEvidence: readonly ShiftPlanningNotificationDispatchEvidence[];
  enteredAtMillis: number;
  ttlMillis: number;
}): ShiftPlanningNotificationSafeResume => {
  const environment = requireEnvironment(input.environment);
  const incidentId = requireIdentifier(input.incidentId, "incidentId");
  const ownerUserId = requireIdentifier(input.ownerUserId, "ownerUserId");
  const escalationTargetId = requireIdentifier(
    input.escalationTargetId,
    "escalationTargetId",
  );
  const enteredAtMillis = requireNonNegativeInteger(
    input.enteredAtMillis,
    "safe-resume entry instant",
  );
  const ttlMillis = requirePositiveInteger(input.ttlMillis, "safe-resume TTL");
  if (ttlMillis > SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS) {
    return failIncident("Safe-resume TTL exceeds its bounded policy.");
  }
  const expiresAtMillis = enteredAtMillis + ttlMillis;
  if (!Number.isSafeInteger(expiresAtMillis)) {
    return failIncident("Safe-resume expiry is not representable.");
  }
  const deliveryLease = parseReleaseLease(input.deliveryLease, "delivery");
  const marketLease = parseReleaseLease(input.marketLease, "market");
  requirePairedLeases(deliveryLease, marketLease);
  if (deliveryLease.state === "degraded" || marketLease.state === "degraded") {
    return failLeaseConflict(
      "An existing degraded incident cannot be replaced.",
    );
  }
  if (enteredAtMillis < deliveryLease.deadlineAtMillis) {
    return failLeaseConflict("Release batch has not reached its deadline.");
  }
  const intents = canonicalIntents({
    intents: input.intents,
    lease: deliveryLease,
  });
  const analyzed = analyzeBatch({
    intents,
    dispatchEvidence: input.dispatchEvidence,
    observedAtMillis: enteredAtMillis,
  });
  const replacementLease = (
    type: ShiftRotationType,
  ): ShiftPlanningReleaseLease => ({
    type,
    bundleId: deliveryLease.bundleId,
    bundleRevision: deliveryLease.bundleRevision,
    bundleDigest: deliveryLease.bundleDigest,
    leaseEpoch: deliveryLease.leaseEpoch,
    ownerOperationId: incidentId,
    state: "degraded",
    acquiredAtMillis: enteredAtMillis,
    deadlineAtMillis: expiresAtMillis,
  });
  const core = {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_TERMINAL_INCIDENT_SCHEMA_VERSION,
    operationKind: "notificationSafeResume" as const,
    incidentId,
    environment,
    state: "degraded" as const,
    resolution: "operatorRequired" as const,
    bundleId: deliveryLease.bundleId,
    bundleRevision: deliveryLease.bundleRevision,
    bundleDigest: requireDigest(deliveryLease.bundleDigest, "bundle digest"),
    writeEpoch: deliveryLease.leaseEpoch,
    abandonedOwnerOperationId: deliveryLease.ownerOperationId,
    ownerUserId,
    escalationTargetId,
    enteredAtMillis,
    expiresAtMillis,
    intents: analyzed.map((item) => ({
      intentId: item.intent.intentId,
      shiftId: item.intent.shiftId,
      dispatchDisposition: item.disposition,
      authenticatedSubmissionPossible: item.authenticatedSubmissionPossible,
      dispatchEvidenceDigest: item.dispatchEvidenceDigest,
    })),
    affectedShiftIds: [...new Set(intents.map(({shiftId}) => shiftId))].sort(),
    releaseLeaseActions: [
      {
        action: "degrade" as const,
        type: "delivery" as const,
        expectedLease: deliveryLease,
        replacementLease: replacementLease("delivery"),
      },
      {
        action: "degrade" as const,
        type: "market" as const,
        expectedLease: marketLease,
        replacementLease: replacementLease("market"),
      },
    ] as const,
  };
  return {...core, safeResumeDigest: createShiftPlanningDigest(core)};
};

/**
 * Terminalizes an expired degraded batch without erasing possible-delivery
 * history. Cancellation is exact and mandatory only for intents whose complete
 * dispatch history proves authenticated submission never began.
 * @param {object} input Safe-resume authority and current terminal evidence.
 * @return {object} Deterministic dual-lease terminal-incident proposal.
 */
export const createShiftPlanningNotificationTerminalIncident = (input: {
  safeResume: ShiftPlanningNotificationSafeResume;
  deliveryLease: ShiftPlanningReleaseLease;
  marketLease: ShiftPlanningReleaseLease;
  intents: readonly ShiftPlanningHeldNotificationIntent[];
  dispatchEvidence: readonly ShiftPlanningNotificationDispatchEvidence[];
  cancellations: readonly
    ShiftPlanningNotificationTerminalIncidentCancellation[];
  terminalizedAtMillis: number;
}): ShiftPlanningNotificationTerminalIncident => {
  const safeResume = requireSafeResume(input.safeResume);
  const terminalizedAtMillis = requireNonNegativeInteger(
    input.terminalizedAtMillis,
    "terminal incident instant",
  );
  if (terminalizedAtMillis < safeResume.expiresAtMillis) {
    return failLeaseConflict("Safe-resume TTL has not expired.");
  }
  const deliveryLease = parseReleaseLease(input.deliveryLease, "delivery");
  const marketLease = parseReleaseLease(input.marketLease, "market");
  requirePairedLeases(deliveryLease, marketLease);
  if (
    !sameValue(
      deliveryLease,
      safeResume.releaseLeaseActions[0].replacementLease,
    ) ||
    !sameValue(marketLease, safeResume.releaseLeaseActions[1].replacementLease)
  ) {
    return failLeaseConflict(
      "Degraded release leases drifted from the incident.",
    );
  }
  const intents = canonicalIntents({
    intents: input.intents,
    lease: deliveryLease,
  });
  const currentIntentIdentity = intents.map(({intentId, shiftId}) => ({
    intentId,
    shiftId,
  }));
  const safeResumeIntentIdentity = safeResume.intents.map(
    ({intentId, shiftId}) => ({intentId, shiftId}),
  );
  const affectedShiftIds = [
    ...new Set(intents.map(({shiftId}) => shiftId)),
  ].sort();
  if (
    !sameValue(currentIntentIdentity, safeResumeIntentIdentity) ||
    !sameValue(affectedShiftIds, safeResume.affectedShiftIds)
  ) {
    return failLeaseConflict(
      "Incident intent identity drifted during safe resume.",
    );
  }
  const analyzed = analyzeBatch({
    intents,
    dispatchEvidence: input.dispatchEvidence,
    observedAtMillis: terminalizedAtMillis,
  });
  const cancellations = new Map<
    string,
    ShiftPlanningNotificationTerminalIncidentCancellation
  >();
  for (const value of input.cancellations) {
    const cancellation = requireRecord(value, "incident cancellation");
    requireExactFields(
      cancellation,
      ["action", "intentId", "incidentId", "cancelledAtMillis"],
      "incident cancellation",
    );
    const intentId = requireIdentifier(
      cancellation.intentId,
      "cancel intentId",
    );
    const cancelledAtMillis = requireNonNegativeInteger(
      cancellation.cancelledAtMillis,
      "cancellation instant",
    );
    if (
      cancellation.action !== "cancelAndSupersede" ||
      cancellation.incidentId !== safeResume.incidentId ||
      cancelledAtMillis !== terminalizedAtMillis ||
      cancellations.has(intentId)
    ) {
      return failIncident("Incident cancellation is not exact and unique.");
    }
    cancellations.set(intentId, {
      action: "cancelAndSupersede",
      intentId,
      incidentId: safeResume.incidentId,
      cancelledAtMillis,
    });
  }
  const mustCancel = analyzed.filter(({disposition}) =>
    disposition === "pending" ||
    disposition === "claimed" ||
    disposition === "demonstrablyUnsubmitted");
  if (
    cancellations.size !== mustCancel.length ||
    mustCancel.some(({intent}) => !cancellations.has(intent.intentId)) ||
    [...cancellations.keys()].some((intentId) =>
      !mustCancel.some(({intent}) => intent.intentId === intentId))
  ) {
    return failLeaseConflict(
      "Cancellation does not cover exactly demonstrably unsubmitted intents.",
    );
  }
  const terminalIntents = analyzed.map((item) => {
    const resolution = item.authenticatedSubmissionPossible ?
      "possibleDeliveryCorrectionRequired" as const :
      item.disposition === "definitivelyFailed" ?
        "definitivelyFailed" as const : "cancelledUnsubmitted" as const;
    return {
      intentId: item.intent.intentId,
      shiftId: item.intent.shiftId,
      resolution,
      attemptIds: item.attemptIds,
      dispatchEvidenceDigest: item.dispatchEvidenceDigest,
    };
  });
  const orderedCancellations = mustCancel.map(({intent}) =>
    cancellations.get(intent.intentId) ??
      failIncident("Required cancellation is missing."));
  const possibleDeliveryIntentIds = terminalIntents
    .filter(({resolution}) =>
      resolution === "possibleDeliveryCorrectionRequired")
    .map(({intentId}) => intentId);
  const core = {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_TERMINAL_INCIDENT_SCHEMA_VERSION,
    operationKind: "notificationTerminalIncident" as const,
    incidentId: safeResume.incidentId,
    environment: safeResume.environment,
    state: "terminal" as const,
    resolution: "incidentTerminalized" as const,
    bundleId: safeResume.bundleId,
    bundleRevision: safeResume.bundleRevision,
    bundleDigest: safeResume.bundleDigest,
    writeEpoch: safeResume.writeEpoch,
    ownerUserId: safeResume.ownerUserId,
    escalationTargetId: safeResume.escalationTargetId,
    terminalizedAtMillis,
    intents: terminalIntents,
    cancelledIntentIds: terminalIntents
      .filter(({resolution}) => resolution === "cancelledUnsubmitted")
      .map(({intentId}) => intentId),
    possibleDeliveryIntentIds,
    correctionRequiredIntentIds: possibleDeliveryIntentIds,
    definitivelyFailedIntentIds: terminalIntents
      .filter(({resolution}) => resolution === "definitivelyFailed")
      .map(({intentId}) => intentId),
    cancellations: orderedCancellations,
    releaseLeaseActions: [
      {
        action: "clear" as const,
        type: "delivery" as const,
        expectedLease: deliveryLease,
      },
      {
        action: "clear" as const,
        type: "market" as const,
        expectedLease: marketLease,
      },
    ] as const,
  };
  return {
    ...core,
    terminalIncidentDigest: createShiftPlanningDigest(core),
  };
};
