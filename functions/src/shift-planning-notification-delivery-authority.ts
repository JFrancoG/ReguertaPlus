import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  SHIFT_PLANNING_NOTIFICATION_EVENT_TYPE,
  sameShiftPlanningNotificationValue,
} from "./shift-planning-notification-release.js";

export type ShiftPlanningNotificationDeliveryAuthority =
  "governed" | "legacy";

type UnknownRecord = Record<string, unknown>;

const receiptFields = [
  "schemaVersion",
  "operationKind",
  "state",
  "intentId",
  "idempotencyKey",
  "canonicalEventId",
  "recipientUserId",
  "shiftId",
  "shiftType",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
  "releasedAt",
  "readBackGate",
  "readBackGateDigest",
  "dispatchPolicy",
  "releaseDigest",
] as const;

const dispatchPolicyFields = [
  "deliveryGuarantee",
  "duplicatePresentationPossible",
  "stableEventId",
  "collapseKey",
] as const;

const failAuthority = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failAuthority(`${name} must be a plain object.`);
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
    failAuthority(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failAuthority(`${name} is not a valid identifier.`);
  }
  return value;
};

/**
 * Selects exactly one delivery owner for a created notification event.
 * A companion release receipt is backend-only evidence: once present, malformed
 * or drifting evidence fails closed instead of falling back to legacy delivery.
 * @param {object} input Event identity, payload, and optional release receipt.
 * @return {ShiftPlanningNotificationDeliveryAuthority} Exclusive owner.
 */
export const classifyShiftPlanningNotificationDeliveryAuthority = (input: {
  eventId: string;
  event: unknown;
  releaseReceipt: unknown | null;
}): ShiftPlanningNotificationDeliveryAuthority => {
  if (input.releaseReceipt === null) return "legacy";

  const eventId = requireIdentifier(input.eventId, "notification eventId");
  const receipt = requireRecord(
    input.releaseReceipt,
    "notification release receipt",
  );
  requireExactFields(
    receipt,
    receiptFields,
    "notification release receipt",
  );
  const recipientUserId = requireIdentifier(
    receipt.recipientUserId,
    "notification recipientUserId",
  );
  const releasedAt = receipt.releasedAt;
  const policy = requireRecord(
    receipt.dispatchPolicy,
    "notification dispatch policy",
  );
  requireExactFields(
    policy,
    dispatchPolicyFields,
    "notification dispatch policy",
  );
  if (
    receipt.schemaVersion !== 1 ||
    receipt.operationKind !== "notificationRelease" ||
    receipt.state !== "released" ||
    receipt.intentId !== eventId ||
    receipt.canonicalEventId !== eventId ||
    !(releasedAt instanceof Timestamp) ||
    policy.deliveryGuarantee !== "atLeastOnce" ||
    policy.duplicatePresentationPossible !== true ||
    policy.stableEventId !== eventId ||
    policy.collapseKey !== eventId
  ) {
    return failAuthority("Notification release authority has drifted.");
  }
  const expectedEvent = {
    title: "Turnos actualizados",
    body: "Consulta la aplicación para ver la información actualizada.",
    type: SHIFT_PLANNING_NOTIFICATION_EVENT_TYPE,
    target: "users",
    targetPayload: {userIds: [recipientUserId]},
    sentAt: releasedAt,
    createdBy: "system",
  };
  if (!sameShiftPlanningNotificationValue(input.event, expectedEvent)) {
    return failAuthority("Governed notification event has drifted.");
  }
  return "governed";
};
