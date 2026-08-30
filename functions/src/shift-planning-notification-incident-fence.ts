import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS,
  ShiftPlanningNotificationSafeResume,
} from "./shift-planning-notification-terminal-incident.js";

export const SHIFT_PLANNING_NOTIFICATION_INCIDENT_FENCE_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationIncidentShiftFence = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_INCIDENT_FENCE_SCHEMA_VERSION;
  operationKind: "notificationIncidentShiftFence";
  shiftId: string;
  incidentId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  ownerUserId: string;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
  safeResumeDigest: ShiftPlanningDigest;
};

type UnknownRecord = Record<string, unknown>;

const fields = [
  "schemaVersion",
  "operationKind",
  "shiftId",
  "incidentId",
  "bundleRevision",
  "bundleDigest",
  "ownerUserId",
  "acquiredAt",
  "expiresAt",
  "safeResumeDigest",
] as const;

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
    return failFence("Incident shift fence must be a plain object.");
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

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failFence(`${name} must be a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

/**
 * Parses one backend-owned incident fence and enforces the same bounded TTL as
 * the safe-resume authority. Expired exact fences remain auditable but no
 * longer block a writer; malformed evidence always fails closed.
 * @param {unknown} value Persisted incident fence candidate.
 * @return {object} Exact incident shift fence.
 */
export const parseShiftPlanningNotificationIncidentShiftFence = (
  value: unknown,
): ShiftPlanningNotificationIncidentShiftFence => {
  const fence = requireRecord(value);
  const actualFields = Object.keys(fence);
  if (
    actualFields.length !== fields.length ||
    actualFields.some((field) =>
      !(fields as readonly string[]).includes(field)) ||
    fence.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_INCIDENT_FENCE_SCHEMA_VERSION ||
    fence.operationKind !== "notificationIncidentShiftFence"
  ) {
    return failFence("Incident shift fence discriminator is invalid.");
  }
  const acquiredAt = requireTimestamp(fence.acquiredAt, "fence acquiredAt");
  const expiresAt = requireTimestamp(fence.expiresAt, "fence expiresAt");
  const durationMillis = expiresAt.toMillis() - acquiredAt.toMillis();
  if (
    durationMillis <= 0 ||
    durationMillis > SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS
  ) {
    return failFence("Incident shift fence duration is invalid.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_INCIDENT_FENCE_SCHEMA_VERSION,
    operationKind: "notificationIncidentShiftFence",
    shiftId: requireIdentifier(fence.shiftId, "fence shiftId"),
    incidentId: requireIdentifier(fence.incidentId, "fence incidentId"),
    bundleRevision: requireIdentifier(
      fence.bundleRevision,
      "fence bundleRevision",
    ),
    bundleDigest: requireDigest(fence.bundleDigest, "fence bundleDigest"),
    ownerUserId: requireIdentifier(fence.ownerUserId, "fence ownerUserId"),
    acquiredAt,
    expiresAt,
    safeResumeDigest: requireDigest(
      fence.safeResumeDigest,
      "fence safeResumeDigest",
    ),
  };
};

export const shiftPlanningNotificationIncidentShiftFenceId = (
  shiftId: string,
): string => `shift:${requireIdentifier(shiftId, "fence shiftId")}`;

/**
 * Derives one exact fence only for a shift frozen by the safe-resume plan.
 * @param {object} input Digest-bound plan and affected shift identity.
 * @return {object} Persistable incident fence.
 */
export const createShiftPlanningNotificationIncidentShiftFence = (input: {
  safeResume: ShiftPlanningNotificationSafeResume;
  shiftId: string;
}): ShiftPlanningNotificationIncidentShiftFence => {
  const shiftId = requireIdentifier(input.shiftId, "fence shiftId");
  if (!input.safeResume.affectedShiftIds.includes(shiftId)) {
    return failFence("Incident fence shift is outside the safe-resume scope.");
  }
  return parseShiftPlanningNotificationIncidentShiftFence({
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_INCIDENT_FENCE_SCHEMA_VERSION,
    operationKind: "notificationIncidentShiftFence",
    shiftId,
    incidentId: input.safeResume.incidentId,
    bundleRevision: input.safeResume.bundleRevision,
    bundleDigest: input.safeResume.bundleDigest,
    ownerUserId: input.safeResume.ownerUserId,
    acquiredAt: Timestamp.fromMillis(input.safeResume.enteredAtMillis),
    expiresAt: Timestamp.fromMillis(input.safeResume.expiresAtMillis),
    safeResumeDigest: input.safeResume.safeResumeDigest,
  });
};

export const sameShiftPlanningNotificationIncidentShiftFence = (
  left: ShiftPlanningNotificationIncidentShiftFence,
  right: ShiftPlanningNotificationIncidentShiftFence,
): boolean => fields.every((field) => {
  const leftValue = left[field];
  const rightValue = right[field];
  if (leftValue instanceof Timestamp && rightValue instanceof Timestamp) {
    return leftValue.isEqual(rightValue);
  }
  return leftValue === rightValue;
});

export const shiftPlanningNotificationIncidentShiftFenceIsActive = (
  fence: ShiftPlanningNotificationIncidentShiftFence,
  now: Timestamp,
): boolean => now.toMillis() < fence.expiresAt.toMillis();
