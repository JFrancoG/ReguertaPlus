export type NotificationInboxDocument = {
  notificationEventId: string;
  schemaVersion?: 1;
  operationKind?: "shiftPlanningNotification";
  contentPolicy?: "genericReferenceOnly";
  title: string;
  body: string;
  type: string;
  target: "all" | "users" | "segment";
  targetPayload: Record<string, unknown>;
  createdBy: string;
  sentAt: unknown;
  weekKey?: string;
};

const parseString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const parseRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ?
    value as Record<string, unknown> :
    {};

const GENERIC_SHIFT_NOTIFICATION_BODY =
  "Consulta la aplicación para ver la información actualizada.";

const planningNotificationMetadata = (
  event: Record<string, unknown>,
): Pick<
NotificationInboxDocument,
"schemaVersion" | "operationKind" | "contentPolicy"
> | null | undefined => {
  const fields = ["schemaVersion", "operationKind", "contentPolicy"];
  const present = fields.filter((field) => event[field] !== undefined);
  if (present.length === 0) return undefined;
  if (
    present.length !== fields.length ||
    event.schemaVersion !== 1 ||
    event.operationKind !== "shiftPlanningNotification" ||
    event.contentPolicy !== "genericReferenceOnly" ||
    event.title !== "Turnos actualizados" ||
    event.body !== GENERIC_SHIFT_NOTIFICATION_BODY ||
    event.type !== "shift_updated" ||
    event.target !== "users" ||
    event.createdBy !== "system" ||
    event.weekKey !== undefined
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    operationKind: "shiftPlanningNotification",
    contentPolicy: "genericReferenceOnly",
  };
};

export const buildNotificationInboxDocument = (
  eventIdValue: unknown,
  eventValue: unknown,
  recipientMemberIdValue: unknown,
): NotificationInboxDocument | null => {
  const eventId = parseString(eventIdValue);
  const event = parseRecord(eventValue);
  const title = parseString(event.title);
  const body = parseString(event.body);
  const type = parseString(event.type);
  const targetValue = parseString(event.target)?.toLowerCase();
  const createdBy = parseString(event.createdBy);
  const recipientMemberId = parseString(recipientMemberIdValue);
  const planningMetadata = planningNotificationMetadata(event);
  if (
    !eventId ||
    !title ||
    !body ||
    !type ||
    !createdBy ||
    event.sentAt === null ||
    event.sentAt === undefined ||
    planningMetadata === null ||
    (targetValue !== "all" &&
      targetValue !== "users" &&
      targetValue !== "segment")
  ) {
    return null;
  }

  const sourceTargetPayload = parseRecord(event.targetPayload);
  let targetPayload: Record<string, unknown> = {};
  if (targetValue === "users") {
    if (!recipientMemberId) {
      return null;
    }
    targetPayload = {userIds: [recipientMemberId]};
  } else if (targetValue === "segment") {
    const segmentType = parseString(sourceTargetPayload.segmentType);
    const role = parseString(sourceTargetPayload.role);
    if (segmentType) {
      targetPayload.segmentType = segmentType;
    }
    if (role) {
      targetPayload.role = role;
    }
  }

  const result: NotificationInboxDocument = {
    notificationEventId: eventId,
    ...planningMetadata,
    title,
    body,
    type,
    target: targetValue,
    targetPayload,
    createdBy,
    sentAt: event.sentAt,
  };
  const weekKey = parseString(event.weekKey);
  if (weekKey) {
    result.weekKey = weekKey;
  }
  return result;
};
