import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningNotificationCurrentValidation,
} from "./shift-planning-firestore-notification-source.js";

export const SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS =
  30_000 as const;

export type ShiftPlanningNotificationDispatchLease = {
  attemptId: string;
  workerId: string;
  epoch: number;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
};

export type ShiftPlanningNotificationDispatchState = {
  schemaVersion: typeof SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION;
  operationKind: "notificationDispatchState";
  intentId: string;
  eventId: string;
  attemptCount: number;
  lastLeaseEpoch: number;
  activeLease: ShiftPlanningNotificationDispatchLease | null;
};

type ShiftPlanningNotificationAttemptValidation = {
  assignmentRevision: number;
  membershipRevision: number;
  eligibilityRevision: number;
  destinationRevision: number;
  destinationDigest: ShiftPlanningDigest;
  messagingTargetCount: number;
  validationDigest: ShiftPlanningDigest;
};

type ShiftPlanningNotificationDispatchAttemptBase = {
  schemaVersion: typeof SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION;
  operationKind: "notificationDispatchAttempt";
  intentId: string;
  eventId: string;
  attemptId: string;
  attemptOrdinal: number;
  lease: ShiftPlanningNotificationDispatchLease;
  validation: ShiftPlanningNotificationAttemptValidation;
};

export type ShiftPlanningClaimedNotificationDispatchAttempt =
  ShiftPlanningNotificationDispatchAttemptBase & {
    state: "claimed";
    authenticatedStartedAt: null;
    terminal: null;
  };

export type ShiftPlanningSubmittingNotificationDispatchAttempt =
  ShiftPlanningNotificationDispatchAttemptBase & {
    state: "submitting";
    authenticatedStartedAt: Timestamp;
    terminal: null;
  };

export type ShiftPlanningNotificationDispatchTerminal = {
  outcome: "accepted" | "unknown" | "failed";
  completedAt: Timestamp;
  failureCode: string | null;
  acceptedTargetCount: number;
  possiblyDelivered: boolean;
};

export type ShiftPlanningTerminalNotificationDispatchAttempt =
  ShiftPlanningNotificationDispatchAttemptBase & {
    state: "terminal";
    authenticatedStartedAt: Timestamp | null;
    terminal: ShiftPlanningNotificationDispatchTerminal;
  };

export type ShiftPlanningNotificationDispatchAttempt =
  | ShiftPlanningClaimedNotificationDispatchAttempt
  | ShiftPlanningSubmittingNotificationDispatchAttempt
  | ShiftPlanningTerminalNotificationDispatchAttempt;

export type ShiftPlanningNotificationDispatchToken = {
  intentId: string;
  eventId: string;
  attemptId: string;
  workerId: string;
  leaseEpoch: number;
  leaseExpiresAtMillis: number;
  validationDigest: ShiftPlanningDigest;
};

export type ShiftPlanningGenericPush = {
  collapseKey: string;
  notification: {
    title: "Turnos actualizados";
    body: "Consulta la aplicación para ver la información actualizada.";
  };
  data: {
    eventId: string;
    type: "shift_updated";
    target: "users";
  };
};

export type ShiftPlanningNotificationDispatchAggregate =
  | "pending"
  | "claimed"
  | "submitting"
  | "accepted"
  | "unknown"
  | "failed";

type UnknownRecord = Record<string, unknown>;

const failDispatch = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failDispatch(`${name} must be a plain object.`);
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
    failDispatch(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failDispatch(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failDispatch(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failDispatch(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) return failDispatch(`${name} must be positive.`);
  return parsed;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failDispatch(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const leaseFields = [
  "attemptId",
  "workerId",
  "epoch",
  "acquiredAt",
  "expiresAt",
] as const;

const parseLease = (value: unknown): ShiftPlanningNotificationDispatchLease => {
  const lease = requireRecord(value, "notification dispatch lease");
  requireExactFields(lease, leaseFields, "notification dispatch lease");
  const acquiredAt = requireTimestamp(lease.acquiredAt, "dispatch acquiredAt");
  const expiresAt = requireTimestamp(lease.expiresAt, "dispatch expiresAt");
  if (
    expiresAt.toMillis() - acquiredAt.toMillis() !==
      SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS
  ) {
    return failDispatch("Notification dispatch lease duration drifted.");
  }
  return {
    attemptId: requireIdentifier(lease.attemptId, "dispatch attemptId"),
    workerId: requireIdentifier(lease.workerId, "dispatch workerId"),
    epoch: requirePositiveInteger(lease.epoch, "dispatch lease epoch"),
    acquiredAt,
    expiresAt,
  };
};

const stateFields = [
  "schemaVersion",
  "operationKind",
  "intentId",
  "eventId",
  "attemptCount",
  "lastLeaseEpoch",
  "activeLease",
] as const;

/**
 * Parses the mutable fence without treating it as dispatch outcome history.
 * @param {unknown} value Persisted dispatch state candidate.
 * @return {ShiftPlanningNotificationDispatchState} Exact mutable fence.
 */
export const parseShiftPlanningNotificationDispatchState = (
  value: unknown,
): ShiftPlanningNotificationDispatchState => {
  const state = requireRecord(value, "notification dispatch state");
  requireExactFields(state, stateFields, "notification dispatch state");
  if (
    state.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION ||
    state.operationKind !== "notificationDispatchState"
  ) {
    return failDispatch(
      "Notification dispatch state discriminator is invalid.",
    );
  }
  const attemptCount = requireNonNegativeInteger(
    state.attemptCount,
    "dispatch attemptCount",
  );
  const lastLeaseEpoch = requireNonNegativeInteger(
    state.lastLeaseEpoch,
    "dispatch lastLeaseEpoch",
  );
  const activeLease = state.activeLease === null ? null :
    parseLease(state.activeLease);
  if (
    lastLeaseEpoch !== attemptCount ||
    (activeLease !== null && activeLease.epoch !== lastLeaseEpoch)
  ) {
    return failDispatch("Notification dispatch counters are incoherent.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION,
    operationKind: "notificationDispatchState",
    intentId: requireIdentifier(state.intentId, "dispatch state intentId"),
    eventId: requireIdentifier(state.eventId, "dispatch state eventId"),
    attemptCount,
    lastLeaseEpoch,
    activeLease,
  };
};

const attemptBaseFields = [
  "schemaVersion",
  "operationKind",
  "intentId",
  "eventId",
  "attemptId",
  "attemptOrdinal",
  "lease",
  "validation",
  "state",
  "authenticatedStartedAt",
  "terminal",
] as const;

const validationFields = [
  "assignmentRevision",
  "membershipRevision",
  "eligibilityRevision",
  "destinationRevision",
  "destinationDigest",
  "messagingTargetCount",
  "validationDigest",
] as const;

const parseValidation = (
  value: unknown,
): ShiftPlanningNotificationAttemptValidation => {
  const validation = requireRecord(value, "dispatch validation");
  requireExactFields(validation, validationFields, "dispatch validation");
  return {
    assignmentRevision: requirePositiveInteger(
      validation.assignmentRevision,
      "dispatch assignmentRevision",
    ),
    membershipRevision: requireNonNegativeInteger(
      validation.membershipRevision,
      "dispatch membershipRevision",
    ),
    eligibilityRevision: requireNonNegativeInteger(
      validation.eligibilityRevision,
      "dispatch eligibilityRevision",
    ),
    destinationRevision: requireNonNegativeInteger(
      validation.destinationRevision,
      "dispatch destinationRevision",
    ),
    destinationDigest: requireDigest(
      validation.destinationDigest,
      "dispatch destinationDigest",
    ),
    messagingTargetCount: requireNonNegativeInteger(
      validation.messagingTargetCount,
      "dispatch messagingTargetCount",
    ),
    validationDigest: requireDigest(
      validation.validationDigest,
      "dispatch validationDigest",
    ),
  };
};

const terminalFields = [
  "outcome",
  "completedAt",
  "failureCode",
  "acceptedTargetCount",
  "possiblyDelivered",
] as const;

const parseTerminal = (
  value: unknown,
  authenticatedStartedAt: Timestamp | null,
  lease: ShiftPlanningNotificationDispatchLease,
): ShiftPlanningNotificationDispatchTerminal => {
  const terminal = requireRecord(value, "dispatch terminal");
  requireExactFields(terminal, terminalFields, "dispatch terminal");
  if (
    terminal.outcome !== "accepted" &&
    terminal.outcome !== "unknown" &&
    terminal.outcome !== "failed"
  ) {
    return failDispatch("Notification dispatch outcome is invalid.");
  }
  const acceptedTargetCount = requireNonNegativeInteger(
    terminal.acceptedTargetCount,
    "dispatch acceptedTargetCount",
  );
  const failureCode = terminal.failureCode === null ? null :
    requireIdentifier(terminal.failureCode, "dispatch failureCode");
  const accepted = terminal.outcome === "accepted";
  const unknown = terminal.outcome === "unknown";
  if (
    (accepted !== (acceptedTargetCount > 0)) ||
    (accepted === (failureCode !== null)) ||
    terminal.possiblyDelivered !== (accepted || unknown) ||
    (unknown && authenticatedStartedAt === null)
  ) {
    return failDispatch("Notification dispatch terminal is incoherent.");
  }
  const completedAt = requireTimestamp(
    terminal.completedAt,
    "dispatch completedAt",
  );
  if (
    completedAt.toMillis() < lease.acquiredAt.toMillis() ||
    (
      authenticatedStartedAt !== null &&
      completedAt.toMillis() < authenticatedStartedAt.toMillis()
    ) ||
    (
      authenticatedStartedAt !== null &&
      completedAt.toMillis() >= lease.expiresAt.toMillis() &&
      terminal.outcome !== "unknown"
    )
  ) {
    return failDispatch(
      "Notification dispatch terminal chronology is invalid.",
    );
  }
  return {
    outcome: terminal.outcome,
    completedAt,
    failureCode,
    acceptedTargetCount,
    possiblyDelivered: terminal.possiblyDelivered,
  };
};

/**
 * Parses one exact attempt while preserving terminal evidence.
 * @param {unknown} value Persisted attempt candidate.
 * @return {ShiftPlanningNotificationDispatchAttempt} Exact attempt state.
 */
export const parseShiftPlanningNotificationDispatchAttempt = (
  value: unknown,
): ShiftPlanningNotificationDispatchAttempt => {
  const attempt = requireRecord(value, "notification dispatch attempt");
  requireExactFields(
    attempt,
    attemptBaseFields,
    "notification dispatch attempt",
  );
  if (
    attempt.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION ||
    attempt.operationKind !== "notificationDispatchAttempt"
  ) {
    return failDispatch(
      "Notification dispatch attempt discriminator is invalid.",
    );
  }
  const lease = parseLease(attempt.lease);
  const base: ShiftPlanningNotificationDispatchAttemptBase = {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION,
    operationKind: "notificationDispatchAttempt",
    intentId: requireIdentifier(attempt.intentId, "dispatch intentId"),
    eventId: requireIdentifier(attempt.eventId, "dispatch eventId"),
    attemptId: requireIdentifier(attempt.attemptId, "dispatch attemptId"),
    attemptOrdinal: requirePositiveInteger(
      attempt.attemptOrdinal,
      "dispatch attemptOrdinal",
    ),
    lease,
    validation: parseValidation(attempt.validation),
  };
  if (
    base.attemptId !== lease.attemptId ||
    base.attemptOrdinal !== lease.epoch
  ) {
    return failDispatch("Notification dispatch attempt lease drifted.");
  }
  if (attempt.state === "claimed") {
    if (attempt.authenticatedStartedAt !== null || attempt.terminal !== null) {
      return failDispatch("Claimed notification attempt is incoherent.");
    }
    return {
      ...base,
      state: "claimed",
      authenticatedStartedAt: null,
      terminal: null,
    };
  }
  if (attempt.state === "submitting") {
    if (attempt.terminal !== null) {
      return failDispatch("Submitting notification attempt is terminal.");
    }
    const authenticatedStartedAt = requireTimestamp(
      attempt.authenticatedStartedAt,
      "dispatch authenticatedStartedAt",
    );
    if (
      authenticatedStartedAt.toMillis() < lease.acquiredAt.toMillis() ||
      authenticatedStartedAt.toMillis() >= lease.expiresAt.toMillis()
    ) {
      return failDispatch("Authenticated start falls outside its lease.");
    }
    return {
      ...base,
      state: "submitting",
      authenticatedStartedAt,
      terminal: null,
    };
  }
  if (attempt.state !== "terminal") {
    return failDispatch("Notification dispatch attempt state is invalid.");
  }
  const authenticatedStartedAt = attempt.authenticatedStartedAt === null ?
    null : requireTimestamp(
      attempt.authenticatedStartedAt,
      "dispatch authenticatedStartedAt",
    );
  const terminal = parseTerminal(
    attempt.terminal,
    authenticatedStartedAt,
    lease,
  );
  if (terminal.acceptedTargetCount > base.validation.messagingTargetCount) {
    return failDispatch("Accepted target count exceeds validated targets.");
  }
  return {
    ...base,
    state: "terminal",
    authenticatedStartedAt,
    terminal,
  };
};

const attemptValidation = (
  validation: ShiftPlanningNotificationCurrentValidation,
): ShiftPlanningNotificationAttemptValidation => ({
  assignmentRevision: validation.assignmentRevision,
  membershipRevision: validation.membershipRevision,
  eligibilityRevision: validation.eligibilityRevision,
  destinationRevision: validation.destinationRevision,
  destinationDigest: validation.destinationDigest,
  messagingTargetCount:
    validation.messagingTargets.firebaseInstallationIds.length +
    validation.messagingTargets.fcmTokens.length,
  validationDigest: validation.validationDigest,
});

/**
 * Creates one fresh fenced attempt without replacing prior attempts.
 * @param {object} input Identity, owner, time, and current validation.
 * @return {ShiftPlanningClaimedNotificationDispatchAttempt} Claimed attempt.
 */
export const createShiftPlanningClaimedNotificationAttempt = (input: {
  intentId: string;
  eventId: string;
  attemptId: string;
  workerId: string;
  attemptOrdinal: number;
  acquiredAt: Timestamp;
  validation: ShiftPlanningNotificationCurrentValidation;
}): ShiftPlanningClaimedNotificationDispatchAttempt => {
  const expiresAtMillis = input.acquiredAt.toMillis() +
    SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS;
  if (!Number.isSafeInteger(expiresAtMillis)) {
    return failDispatch("Notification dispatch lease expiry is unsafe.");
  }
  return parseShiftPlanningNotificationDispatchAttempt({
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_DISPATCH_SCHEMA_VERSION,
    operationKind: "notificationDispatchAttempt",
    intentId: input.intentId,
    eventId: input.eventId,
    attemptId: input.attemptId,
    attemptOrdinal: input.attemptOrdinal,
    lease: {
      attemptId: input.attemptId,
      workerId: input.workerId,
      epoch: input.attemptOrdinal,
      acquiredAt: input.acquiredAt,
      expiresAt: Timestamp.fromMillis(expiresAtMillis),
    },
    validation: attemptValidation(input.validation),
    state: "claimed",
    authenticatedStartedAt: null,
    terminal: null,
  }) as ShiftPlanningClaimedNotificationDispatchAttempt;
};

export const notificationDispatchToken = (
  attempt: ShiftPlanningClaimedNotificationDispatchAttempt |
    ShiftPlanningSubmittingNotificationDispatchAttempt,
): ShiftPlanningNotificationDispatchToken => ({
  intentId: attempt.intentId,
  eventId: attempt.eventId,
  attemptId: attempt.attemptId,
  workerId: attempt.lease.workerId,
  leaseEpoch: attempt.lease.epoch,
  leaseExpiresAtMillis: attempt.lease.expiresAt.toMillis(),
  validationDigest: attempt.validation.validationDigest,
});

export const requireNotificationDispatchToken = (
  attempt: ShiftPlanningClaimedNotificationDispatchAttempt |
    ShiftPlanningSubmittingNotificationDispatchAttempt,
  token: ShiftPlanningNotificationDispatchToken,
): void => {
  if (
    attempt.intentId !== token.intentId ||
    attempt.eventId !== token.eventId ||
    attempt.attemptId !== token.attemptId ||
    attempt.lease.workerId !== token.workerId ||
    attempt.lease.epoch !== token.leaseEpoch ||
    attempt.lease.expiresAt.toMillis() !== token.leaseExpiresAtMillis ||
    attempt.validation.validationDigest !== token.validationDigest
  ) {
    failDispatch("Notification dispatch token no longer owns the attempt.");
  }
};

export const startShiftPlanningAuthenticatedSubmission = (input: {
  attempt: ShiftPlanningClaimedNotificationDispatchAttempt;
  startedAt: Timestamp;
}): ShiftPlanningSubmittingNotificationDispatchAttempt => {
  if (
    input.startedAt.toMillis() < input.attempt.lease.acquiredAt.toMillis() ||
    input.startedAt.toMillis() >= input.attempt.lease.expiresAt.toMillis()
  ) {
    return failDispatch("Authenticated submission starts outside its lease.");
  }
  return parseShiftPlanningNotificationDispatchAttempt({
    ...input.attempt,
    state: "submitting",
    authenticatedStartedAt: input.startedAt,
    terminal: null,
  }) as ShiftPlanningSubmittingNotificationDispatchAttempt;
};

export const terminalizeShiftPlanningNotificationAttempt = (input: {
  attempt: ShiftPlanningNotificationDispatchAttempt;
  completedAt: Timestamp;
  outcome: "accepted" | "unknown" | "failed";
  failureCode: string | null;
  acceptedTargetCount: number;
}): ShiftPlanningTerminalNotificationDispatchAttempt => {
  if (input.attempt.state === "terminal") return input.attempt;
  const startedAt = input.attempt.authenticatedStartedAt;
  const expired = input.completedAt.toMillis() >=
    input.attempt.lease.expiresAt.toMillis();
  const outcome = startedAt !== null && expired ? "unknown" : input.outcome;
  const failureCode = outcome === "accepted" ? null :
    outcome === "unknown" && expired ? "submission_lease_expired" :
      input.failureCode;
  return parseShiftPlanningNotificationDispatchAttempt({
    ...input.attempt,
    state: "terminal",
    authenticatedStartedAt: startedAt,
    terminal: {
      outcome,
      completedAt: input.completedAt,
      failureCode,
      acceptedTargetCount: outcome === "accepted" ?
        input.acceptedTargetCount : 0,
      possiblyDelivered: outcome === "accepted" || outcome === "unknown",
    },
  }) as ShiftPlanningTerminalNotificationDispatchAttempt;
};

export const genericShiftPlanningPush = (
  eventId: string,
): ShiftPlanningGenericPush => ({
  collapseKey: requireIdentifier(eventId, "push eventId"),
  notification: {
    title: "Turnos actualizados",
    body: "Consulta la aplicación para ver la información actualizada.",
  },
  data: {
    eventId,
    type: "shift_updated",
    target: "users",
  },
});

/**
 * Derives aggregate state without persisting over attempt evidence.
 * @param {ShiftPlanningNotificationDispatchAttempt[]} attempts Full history.
 * @return {ShiftPlanningNotificationDispatchAggregate} Derived display state.
 */
export const deriveShiftPlanningNotificationDispatchAggregate = (
  attempts: readonly ShiftPlanningNotificationDispatchAttempt[],
): ShiftPlanningNotificationDispatchAggregate => {
  if (attempts.length === 0) return "pending";
  const sorted = [...attempts].sort(
    (left, right) => left.attemptOrdinal - right.attemptOrdinal,
  );
  if (
    new Set(sorted.map(({attemptOrdinal}) => attemptOrdinal)).size !==
      sorted.length ||
    sorted.some((attempt, index) => attempt.attemptOrdinal !== index + 1)
  ) {
    return failDispatch("Notification dispatch attempt history has gaps.");
  }
  const accepted = sorted.some(
    (attempt) => attempt.state === "terminal" &&
      attempt.terminal.outcome === "accepted",
  );
  if (accepted) return "accepted";
  const latest = sorted[sorted.length - 1];
  if (latest.state === "claimed") return "claimed";
  if (latest.state === "submitting") return "submitting";
  const unknown = sorted.some(
    (attempt) => attempt.state === "terminal" &&
      attempt.terminal.outcome === "unknown",
  );
  return unknown ? "unknown" : "failed";
};
