import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS,
  ShiftPlanningClaimedNotificationDispatchAttempt,
  ShiftPlanningNotificationDispatchAttempt,
  ShiftPlanningSubmittingNotificationDispatchAttempt,
} from "./shift-planning-notification-dispatch.js";

export const SHIFT_PLANNING_NOTIFICATION_RESOURCE_FENCE_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationResourceFenceScope = "member" | "shift";

export type ShiftPlanningNotificationResourceFence = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_RESOURCE_FENCE_SCHEMA_VERSION;
  operationKind: "notificationDispatchResourceFence";
  scope: ShiftPlanningNotificationResourceFenceScope;
  resourceId: string;
  intentId: string;
  eventId: string;
  attemptId: string;
  workerId: string;
  leaseEpoch: number;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
  validationDigest: ShiftPlanningDigest;
};

type UnknownRecord = Record<string, unknown>;

const failFence = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failFence("Notification resource fence must be a plain object.");
  }
  return value as UnknownRecord;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failFence(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failFence(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireDigest = (
  value: unknown,
  name: string,
): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failFence(`${name} must be a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const fields = [
  "schemaVersion",
  "operationKind",
  "scope",
  "resourceId",
  "intentId",
  "eventId",
  "attemptId",
  "workerId",
  "leaseEpoch",
  "acquiredAt",
  "expiresAt",
  "validationDigest",
] as const;

/**
 * Parses the shared writer-visible fence without accepting schema extensions.
 * @param {unknown} value Persisted resource-fence candidate.
 * @return {ShiftPlanningNotificationResourceFence} Exact fence contract.
 */
export const parseShiftPlanningNotificationResourceFence = (
  value: unknown,
): ShiftPlanningNotificationResourceFence => {
  const fence = requireRecord(value);
  const actualFields = Object.keys(fence);
  if (
    actualFields.length !== fields.length ||
    actualFields.some((field) =>
      !fields.some((expectedField) => expectedField === field)) ||
    fence.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_RESOURCE_FENCE_SCHEMA_VERSION ||
    fence.operationKind !== "notificationDispatchResourceFence" ||
    (fence.scope !== "member" && fence.scope !== "shift") ||
    !Number.isSafeInteger(fence.leaseEpoch) ||
    (fence.leaseEpoch as number) <= 0
  ) {
    return failFence("Notification resource fence discriminator is invalid.");
  }
  const acquiredAt = requireTimestamp(fence.acquiredAt, "fence acquiredAt");
  const expiresAt = requireTimestamp(fence.expiresAt, "fence expiresAt");
  if (
    expiresAt.toMillis() - acquiredAt.toMillis() !==
      SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS
  ) {
    return failFence("Notification resource fence duration drifted.");
  }
  return {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_RESOURCE_FENCE_SCHEMA_VERSION,
    operationKind: "notificationDispatchResourceFence",
    scope: fence.scope,
    resourceId: requireIdentifier(fence.resourceId, "fence resourceId"),
    intentId: requireIdentifier(fence.intentId, "fence intentId"),
    eventId: requireIdentifier(fence.eventId, "fence eventId"),
    attemptId: requireIdentifier(fence.attemptId, "fence attemptId"),
    workerId: requireIdentifier(fence.workerId, "fence workerId"),
    leaseEpoch: fence.leaseEpoch as number,
    acquiredAt,
    expiresAt,
    validationDigest: requireDigest(
      fence.validationDigest,
      "fence validationDigest",
    ),
  };
};

export const shiftPlanningNotificationResourceFenceId = (
  scope: ShiftPlanningNotificationResourceFenceScope,
  resourceId: string,
): string => `${scope}:${requireIdentifier(resourceId, "fence resourceId")}`;

const createFence = (
  attempt: ShiftPlanningClaimedNotificationDispatchAttempt |
    ShiftPlanningSubmittingNotificationDispatchAttempt,
  scope: ShiftPlanningNotificationResourceFenceScope,
  resourceId: string,
): ShiftPlanningNotificationResourceFence =>
  parseShiftPlanningNotificationResourceFence({
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_RESOURCE_FENCE_SCHEMA_VERSION,
    operationKind: "notificationDispatchResourceFence",
    scope,
    resourceId,
    intentId: attempt.intentId,
    eventId: attempt.eventId,
    attemptId: attempt.attemptId,
    workerId: attempt.lease.workerId,
    leaseEpoch: attempt.lease.epoch,
    acquiredAt: attempt.lease.acquiredAt,
    expiresAt: attempt.lease.expiresAt,
    validationDigest: attempt.validation.validationDigest,
  });

export const createShiftPlanningNotificationResourceFences = (input: {
  attempt: ShiftPlanningClaimedNotificationDispatchAttempt |
    ShiftPlanningSubmittingNotificationDispatchAttempt;
  recipientUserId: string;
  shiftId: string;
}): readonly [
  ShiftPlanningNotificationResourceFence,
  ShiftPlanningNotificationResourceFence,
] => [
  createFence(input.attempt, "member", input.recipientUserId),
  createFence(input.attempt, "shift", input.shiftId),
];

export const sameShiftPlanningNotificationResourceFence = (
  fence: ShiftPlanningNotificationResourceFence,
  expected: ShiftPlanningNotificationResourceFence,
): boolean => fields.every((field) => {
  const left = fence[field];
  const right = expected[field];
  if (left instanceof Timestamp && right instanceof Timestamp) {
    return left.isEqual(right);
  }
  return left === right;
});

export const shiftPlanningNotificationResourceFenceIsActive = (
  fence: ShiftPlanningNotificationResourceFence,
  now: Timestamp,
): boolean => now.toMillis() < fence.expiresAt.toMillis();

export const shiftPlanningNotificationAttemptCanReleaseResourceFences = (
  attempt: ShiftPlanningNotificationDispatchAttempt,
): boolean => attempt.state === "terminal" &&
  attempt.terminal.outcome !== "unknown";
