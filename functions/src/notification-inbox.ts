export type NotificationInboxDocument = {
  notificationEventId: string;
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
  if (
    !eventId ||
    !title ||
    !body ||
    !type ||
    !createdBy ||
    event.sentAt === null ||
    event.sentAt === undefined ||
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
