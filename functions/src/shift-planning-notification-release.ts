import {Timestamp} from "@google-cloud/firestore";
import {
  NotificationInboxDocument,
  buildNotificationInboxDocument,
} from "./notification-inbox.js";
import {ShiftPlanningHeldNotificationIntent} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {ShiftPlanningCompletedSyncCommand} from
  "./shift-planning-sync-command.js";

export const SHIFT_PLANNING_NOTIFICATION_RELEASE_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_NOTIFICATION_EVENT_TYPE = "shift_updated" as const;

export type ShiftPlanningCanonicalNotificationEvent = {
  title: "Turnos actualizados";
  body: "Consulta la aplicación para ver la información actualizada.";
  type: typeof SHIFT_PLANNING_NOTIFICATION_EVENT_TYPE;
  target: "users";
  targetPayload: {userIds: [string]};
  sentAt: Timestamp;
  createdBy: "system";
};

export type ShiftPlanningNotificationReleaseReceipt = {
  schemaVersion: typeof SHIFT_PLANNING_NOTIFICATION_RELEASE_SCHEMA_VERSION;
  operationKind: "notificationRelease";
  state: "released";
  intentId: string;
  idempotencyKey: string;
  canonicalEventId: string;
  recipientUserId: string;
  shiftId: string;
  shiftType: "delivery" | "market";
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  writeEpoch: number;
  releasedAt: Timestamp;
  readBackGate: {
    delivery: ShiftPlanningNotificationSyncReadBack;
    market: ShiftPlanningNotificationSyncReadBack;
  };
  readBackGateDigest: ShiftPlanningDigest;
  dispatchPolicy: {
    deliveryGuarantee: "atLeastOnce";
    duplicatePresentationPossible: true;
    stableEventId: string;
    collapseKey: string;
  };
  releaseDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationSyncReadBack = {
  commandId: string;
  commandDigest: ShiftPlanningDigest;
  workbookRevision: string;
  partitionDigest: ShiftPlanningDigest;
  completedAtMillis: number;
};

export type ShiftPlanningNotificationReleaseArtifacts = {
  eventId: string;
  event: ShiftPlanningCanonicalNotificationEvent;
  inbox: NotificationInboxDocument;
  receipt: ShiftPlanningNotificationReleaseReceipt;
};

type UnknownRecord = Record<string, unknown>;

const failRelease = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failRelease(`${name} must be a plain object.`);
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
    failRelease(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failRelease(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failRelease(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return failRelease(`${name} must be a positive safe integer.`);
  }
  return value as number;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failRelease(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const heldIntentFields = [
  "intentId",
  "idempotencyKey",
  "state",
  "recipientUserId",
  "shiftId",
  "shiftType",
  "expectedAssignmentRevision",
  "expectedMembershipRevision",
  "expectedEligibilityRevision",
  "expectedDestinationRevision",
  "canonicalEventType",
  "payloadPolicy",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
] as const;

/**
 * Validates one immutable held intent before any consumable event exists.
 * @param {unknown} value Persisted held-intent candidate.
 * @return {ShiftPlanningHeldNotificationIntent} Exact immutable intent.
 */
export const parseShiftPlanningHeldNotificationIntent = (
  value: unknown,
): ShiftPlanningHeldNotificationIntent => {
  const intent = requireRecord(value, "held notification intent");
  requireExactFields(intent, heldIntentFields, "held notification intent");
  if (
    intent.state !== "held" ||
    (intent.shiftType !== "delivery" && intent.shiftType !== "market") ||
    intent.expectedAssignmentRevision !== 1 ||
    intent.canonicalEventType !== "shift_assignment_updated" ||
    intent.payloadPolicy !== "genericReferenceOnly"
  ) {
    return failRelease("Held notification intent discriminator is invalid.");
  }
  const bundleRevision = requireIdentifier(
    intent.bundleRevision,
    "notification bundleRevision",
  );
  const parsed: ShiftPlanningHeldNotificationIntent = {
    intentId: requireIdentifier(intent.intentId, "notification intentId"),
    idempotencyKey: requireIdentifier(
      intent.idempotencyKey,
      "notification idempotencyKey",
    ),
    state: "held",
    recipientUserId: requireIdentifier(
      intent.recipientUserId,
      "notification recipientUserId",
    ),
    shiftId: requireIdentifier(intent.shiftId, "notification shiftId"),
    shiftType: intent.shiftType,
    expectedAssignmentRevision: 1,
    expectedMembershipRevision: requireNonNegativeInteger(
      intent.expectedMembershipRevision,
      "notification expectedMembershipRevision",
    ),
    expectedEligibilityRevision: requireNonNegativeInteger(
      intent.expectedEligibilityRevision,
      "notification expectedEligibilityRevision",
    ),
    expectedDestinationRevision: requireNonNegativeInteger(
      intent.expectedDestinationRevision,
      "notification expectedDestinationRevision",
    ),
    canonicalEventType: "shift_assignment_updated",
    payloadPolicy: "genericReferenceOnly",
    bundleRevision,
    bundleDigest: requireDigest(
      intent.bundleDigest,
      "notification bundleDigest",
    ),
    writeEpoch: requirePositiveInteger(
      intent.writeEpoch,
      "notification writeEpoch",
    ),
  };
  const match = /^(.*)-notification-([1-9][0-9]*)$/.exec(parsed.intentId);
  if (
    !match ||
    match[1] !== bundleRevision ||
    parsed.idempotencyKey !== `${bundleRevision}:notification:${match[2]}`
  ) {
    return failRelease("Held notification intent lineage is not canonical.");
  }
  return parsed;
};

const syncReadBack = (
  command: ShiftPlanningCompletedSyncCommand,
  type: "delivery" | "market",
  intent: ShiftPlanningHeldNotificationIntent,
): ShiftPlanningNotificationSyncReadBack => {
  if (
    command.state !== "completed" ||
    command.type !== type ||
    command.commandId !== `${intent.bundleRevision}-${type}` ||
    command.bundleRevision !== intent.bundleRevision ||
    command.bundleDigest !== intent.bundleDigest ||
    command.writeEpoch !== intent.writeEpoch ||
    command.expectedActiveRevision !== intent.bundleRevision ||
    command.expectedActiveDigest !== intent.bundleDigest
  ) {
    return failRelease(`${type} sync read-back does not authorize release.`);
  }
  return {
    commandId: command.commandId,
    commandDigest: requireDigest(
      command.commandDigest,
      `${type} commandDigest`,
    ),
    workbookRevision: command.terminal.readBackWorkbookRevision,
    partitionDigest: requireDigest(
      command.terminal.readBackPartitionDigest,
      `${type} partitionDigest`,
    ),
    completedAtMillis: command.terminal.completedAt.toMillis(),
  };
};

const releaseDigestCore = (
  receipt: Omit<ShiftPlanningNotificationReleaseReceipt, "releaseDigest">,
): object => ({
  ...receipt,
  releasedAt: receipt.releasedAt.toMillis(),
});

/**
 * Builds the one stable legacy-compatible event, per-user inbox projection,
 * and backend-only release receipt after both workbook partitions read back.
 * @param {object} input Held intent, read-backs, and trusted release time.
 * @return {ShiftPlanningNotificationReleaseArtifacts} Canonical write set.
 */
export const createShiftPlanningNotificationReleaseArtifacts = (input: {
  intent: ShiftPlanningHeldNotificationIntent;
  deliverySync: ShiftPlanningCompletedSyncCommand;
  marketSync: ShiftPlanningCompletedSyncCommand;
  releasedAt: Timestamp;
}): ShiftPlanningNotificationReleaseArtifacts => {
  const intent = parseShiftPlanningHeldNotificationIntent(input.intent);
  const eventId = intent.intentId;
  const readBackGate = {
    delivery: syncReadBack(input.deliverySync, "delivery", intent),
    market: syncReadBack(input.marketSync, "market", intent),
  };
  const event: ShiftPlanningCanonicalNotificationEvent = {
    title: "Turnos actualizados",
    body: "Consulta la aplicación para ver la información actualizada.",
    type: SHIFT_PLANNING_NOTIFICATION_EVENT_TYPE,
    target: "users",
    targetPayload: {userIds: [intent.recipientUserId]},
    sentAt: input.releasedAt,
    createdBy: "system",
  };
  const inbox = buildNotificationInboxDocument(
    eventId,
    event,
    intent.recipientUserId,
  );
  if (!inbox) return failRelease("Canonical notification inbox is invalid.");
  const receiptWithoutDigest: Omit<
    ShiftPlanningNotificationReleaseReceipt,
    "releaseDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_RELEASE_SCHEMA_VERSION,
    operationKind: "notificationRelease",
    state: "released",
    intentId: intent.intentId,
    idempotencyKey: intent.idempotencyKey,
    canonicalEventId: eventId,
    recipientUserId: intent.recipientUserId,
    shiftId: intent.shiftId,
    shiftType: intent.shiftType,
    bundleRevision: intent.bundleRevision,
    bundleDigest: requireDigest(
      intent.bundleDigest,
      "notification bundleDigest",
    ),
    writeEpoch: intent.writeEpoch,
    releasedAt: input.releasedAt,
    readBackGate,
    readBackGateDigest: createShiftPlanningDigest(readBackGate),
    dispatchPolicy: {
      deliveryGuarantee: "atLeastOnce",
      duplicatePresentationPossible: true,
      stableEventId: eventId,
      collapseKey: eventId,
    },
  };
  return {
    eventId,
    event,
    inbox,
    receipt: {
      ...receiptWithoutDigest,
      releaseDigest: createShiftPlanningDigest(
        releaseDigestCore(receiptWithoutDigest),
      ),
    },
  };
};

/**
 * Compares Firestore values without allowing replay-time timestamp drift.
 * @param {unknown} left First persisted or expected value.
 * @param {unknown} right Second persisted or expected value.
 * @return {boolean} Whether both values are canonically identical.
 */
export const sameShiftPlanningNotificationValue = (
  left: unknown,
  right: unknown,
): boolean => {
  const normalize = (value: unknown): unknown => {
    if (value instanceof Timestamp) {
      return {seconds: value.seconds, nanoseconds: value.nanoseconds};
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(Object.entries(value).map(
        ([key, item]) => [key, normalize(item)],
      ));
    }
    return value;
  };
  return canonicalShiftPlanningJson(normalize(left)) ===
    canonicalShiftPlanningJson(normalize(right));
};
