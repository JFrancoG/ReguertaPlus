import {Timestamp} from "@google-cloud/firestore";
import {
  parseShiftPlanningHeldNotificationIntent,
} from "./shift-planning-notification-release.js";
import {
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";

export const SHIFT_PLANNING_NOTIFICATION_DETAIL_SCHEMA_VERSION = 1 as const;

export type ShiftPlanningNotificationDetail = {
  schemaVersion: typeof SHIFT_PLANNING_NOTIFICATION_DETAIL_SCHEMA_VERSION;
  eventId: string;
  assignmentRevision: number;
  documentRevision: number;
  shift: {
    id: string;
    type: "delivery" | "market";
    dateMillis: number;
    assignedUserIds: readonly string[];
    helperUserId: string | null;
    status: "planned" | "swap_pending" | "confirmed";
    source: "app";
    createdAtMillis: number;
    updatedAtMillis: number;
  };
};

type UnknownRecord = Record<string, unknown>;

const GENERIC_SHIFT_NOTIFICATION_BODY =
  "Consulta la aplicación para ver la información actualizada.";

const inboxFields = [
  "notificationEventId",
  "schemaVersion",
  "operationKind",
  "contentPolicy",
  "title",
  "body",
  "type",
  "target",
  "targetPayload",
  "createdBy",
  "sentAt",
] as const;

const releaseFields = [
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

const plainRecord = (value: unknown): UnknownRecord | null => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }
  return value as UnknownRecord;
};

const hasExactFields = (
  value: UnknownRecord,
  fields: readonly string[],
): boolean => {
  const actual = Object.keys(value);
  return actual.length === fields.length &&
    actual.every((field) => fields.includes(field));
};

const exactUserTarget = (value: unknown, memberId: string): boolean => {
  const target = plainRecord(value);
  return target !== null &&
    hasExactFields(target, ["userIds"]) &&
    Array.isArray(target.userIds) &&
    target.userIds.length === 1 &&
    target.userIds[0] === memberId;
};

const hasCanonicalInbox = (
  value: unknown,
  eventId: string,
  memberId: string,
): boolean => {
  const inbox = plainRecord(value);
  return inbox !== null &&
    hasExactFields(inbox, inboxFields) &&
    inbox.notificationEventId === eventId &&
    inbox.schemaVersion === 1 &&
    inbox.operationKind === "shiftPlanningNotification" &&
    inbox.contentPolicy === "genericReferenceOnly" &&
    inbox.title === "Turnos actualizados" &&
    inbox.body === GENERIC_SHIFT_NOTIFICATION_BODY &&
    inbox.type === "shift_updated" &&
    inbox.target === "users" &&
    exactUserTarget(inbox.targetPayload, memberId) &&
    inbox.createdBy === "system" &&
    inbox.sentAt instanceof Timestamp;
};

const releaseMatches = (input: {
  value: unknown;
  eventId: string;
  memberId: string;
  shiftId: string;
  shiftType: "delivery" | "market";
  idempotencyKey: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
}): boolean => {
  const release = plainRecord(input.value);
  if (release === null || !hasExactFields(release, releaseFields)) return false;
  const dispatchPolicy = plainRecord(release.dispatchPolicy);
  return release.schemaVersion === 1 &&
    release.operationKind === "notificationRelease" &&
    release.state === "released" &&
    release.intentId === input.eventId &&
    release.idempotencyKey === input.idempotencyKey &&
    release.canonicalEventId === input.eventId &&
    release.recipientUserId === input.memberId &&
    release.shiftId === input.shiftId &&
    release.shiftType === input.shiftType &&
    release.bundleRevision === input.bundleRevision &&
    release.bundleDigest === input.bundleDigest &&
    release.writeEpoch === input.writeEpoch &&
    release.releasedAt instanceof Timestamp &&
    dispatchPolicy !== null &&
    dispatchPolicy.deliveryGuarantee === "atLeastOnce" &&
    dispatchPolicy.duplicatePresentationPossible === true &&
    dispatchPolicy.stableEventId === input.eventId &&
    dispatchPolicy.collapseKey === input.eventId;
};

/**
 * Resolves current notification detail without trusting generic event copy.
 * Any lineage, recipient, release, assignment, or public-document drift returns
 * no detail so callers retain only the non-sensitive inbox representation.
 *
 * @param {object} input Current transaction snapshots and authenticated member.
 * @return {ShiftPlanningNotificationDetail|null} Current authorized detail.
 */
export const resolveShiftPlanningNotificationDetail = (input: {
  eventId: string;
  memberId: string;
  inboxValue: unknown;
  intentValue: unknown;
  releaseValue: unknown;
  shiftValue: unknown;
  shiftTargetPath: string;
}): ShiftPlanningNotificationDetail | null => {
  try {
    if (!hasCanonicalInbox(input.inboxValue, input.eventId, input.memberId)) {
      return null;
    }
    const intent = parseShiftPlanningHeldNotificationIntent(input.intentValue);
    if (
      intent.intentId !== input.eventId ||
      intent.recipientUserId !== input.memberId ||
      !releaseMatches({
        value: input.releaseValue,
        eventId: input.eventId,
        memberId: input.memberId,
        shiftId: intent.shiftId,
        shiftType: intent.shiftType,
        idempotencyKey: intent.idempotencyKey,
        bundleRevision: intent.bundleRevision,
        bundleDigest: intent.bundleDigest,
        writeEpoch: intent.writeEpoch,
      })
    ) {
      return null;
    }
    const shift = parseShiftPlanningPublicShiftDocument({
      targetPath: input.shiftTargetPath,
      value: input.shiftValue,
    });
    if (
      shift.type !== intent.shiftType ||
      !shift.assignedUserIds.includes(input.memberId)
    ) {
      return null;
    }
    return {
      schemaVersion: SHIFT_PLANNING_NOTIFICATION_DETAIL_SCHEMA_VERSION,
      eventId: input.eventId,
      assignmentRevision: shift.assignmentRevision,
      documentRevision: shift.documentRevision,
      shift: {
        id: intent.shiftId,
        type: shift.type,
        dateMillis: shift.date.toMillis(),
        assignedUserIds: [...shift.assignedUserIds],
        helperUserId: shift.helperUserId,
        status: shift.status,
        source: "app",
        createdAtMillis: shift.createdAt.toMillis(),
        updatedAtMillis: shift.updatedAt.toMillis(),
      },
    };
  } catch {
    return null;
  }
};
