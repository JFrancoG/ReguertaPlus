import {createHash} from "node:crypto";
import {HttpRequestError} from "./backend-security.js";
import type {
  ShiftPlanningWriterAuthority,
} from "./shift-planning-writer-authority.js";

type UnknownRecord = Record<string, unknown>;

export type DeliveryCalendarWeekday = "TUE" | "THU" | "FRI";

export type DeliveryCalendarMutationContextInput = {
  schemaVersion: 1;
  environment: "develop" | "production";
  weekKey: string;
};

export type DeliveryCalendarMutationInput = {
  schemaVersion: 1;
  environment: "develop" | "production";
  operationId: string;
  action: "upsert" | "delete";
  weekKey: string;
  expectedPlanningAuthority: ShiftPlanningWriterAuthority;
  expectedOverrideDigest: string | null;
  deliveryWeekday?: DeliveryCalendarWeekday;
};

export type DeliveryCalendarOverrideValue = {
  weekKey: string;
  deliveryDateMillis: number;
  ordersBlockedDateMillis: number;
  ordersOpenAtMillis: number;
  ordersCloseAtMillis: number;
  updatedBy: string;
  updatedAtMillis: number;
};

export const DELIVERY_CALENDAR_DIGEST_PREFIX =
  "delivery-calendar:v1:sha256:" as const;

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const planningDigestPattern = /^shift-planning:v1:sha256:[a-f0-9]{64}$/;
const calendarDigestPattern =
  /^delivery-calendar:v1:sha256:[a-f0-9]{64}$/;
const contextFields = ["schemaVersion", "environment", "weekKey"] as const;
const commonMutationFields = [
  "schemaVersion",
  "environment",
  "operationId",
  "action",
  "weekKey",
  "expectedPlanningAuthority",
  "expectedOverrideDigest",
] as const;
const authorityFields = [
  "schemaVersion",
  "stateRevision",
  "writeEpoch",
  "activeRevision",
  "activeDigest",
] as const;

const failCommand = (message: string): never => {
  throw new HttpRequestError(
    400,
    "invalid_delivery_calendar_command",
    message,
  );
};

const requirePlainRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failCommand(`${name} must be a plain object`);
  }
  return value as UnknownRecord;
};

const hasExactFields = (
  value: UnknownRecord,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value);
  return actual.length === expected.length &&
    actual.every((field) => expected.includes(field));
};

const requireEnvironment = (
  value: unknown,
): "develop" | "production" => {
  if (value !== "develop" && value !== "production") {
    return failCommand("environment must be develop or production");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    return failCommand(`${name} is invalid`);
  }
  return value;
};

const requireDocumentId = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_500 ||
    value.includes("/")
  ) {
    return failCommand(`${name} is invalid`);
  }
  return value;
};

const isoWeekStartUtc = (weekKey: string): Date | null => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (year < 2000 || year > 9999 || week < 1 || week > 53) return null;
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const mondayOffset = (januaryFourth.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, 0, 4 - mondayOffset + (week - 1) * 7));
  const thursday = new Date(start.getTime() + 3 * 86_400_000);
  if (thursday.getUTCFullYear() !== year) return null;
  return start;
};

const requireWeekKey = (value: unknown): string => {
  if (typeof value !== "string" || isoWeekStartUtc(value) === null) {
    return failCommand("weekKey must be a real ISO week in YYYY-Www format");
  }
  return value;
};

const parseAuthority = (value: unknown): ShiftPlanningWriterAuthority => {
  const authority = requirePlainRecord(
    value,
    "expectedPlanningAuthority",
  );
  const activeRevision = authority.activeRevision;
  const activeDigest = authority.activeDigest;
  if (
    !hasExactFields(authority, authorityFields) ||
    authority.schemaVersion !== 1 ||
    !Number.isSafeInteger(authority.stateRevision) ||
    (authority.stateRevision as number) < 0 ||
    !Number.isSafeInteger(authority.writeEpoch) ||
    (authority.writeEpoch as number) < 0 ||
    (
      activeRevision !== null &&
      (typeof activeRevision !== "string" ||
        !identifierPattern.test(activeRevision))
    ) ||
    (
      activeDigest !== null &&
      (typeof activeDigest !== "string" ||
        !planningDigestPattern.test(activeDigest))
    ) ||
    ((activeRevision === null) !== (activeDigest === null))
  ) {
    return failCommand("expectedPlanningAuthority is invalid");
  }
  return {
    schemaVersion: 1,
    stateRevision: authority.stateRevision as number,
    writeEpoch: authority.writeEpoch as number,
    activeRevision: activeRevision as string | null,
    activeDigest: activeDigest as string | null,
  };
};

const parseExpectedDigest = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || !calendarDigestPattern.test(value)) {
    return failCommand("expectedOverrideDigest is invalid");
  }
  return value;
};

export const parseDeliveryCalendarMutationContextInput = (
  value: unknown,
): DeliveryCalendarMutationContextInput => {
  const input = requirePlainRecord(value, "delivery calendar context");
  if (!hasExactFields(input, contextFields) || input.schemaVersion !== 1) {
    return failCommand("delivery calendar context fields are invalid");
  }
  return {
    schemaVersion: 1,
    environment: requireEnvironment(input.environment),
    weekKey: requireWeekKey(input.weekKey),
  };
};

export const parseDeliveryCalendarMutationInput = (
  value: unknown,
): DeliveryCalendarMutationInput => {
  const input = requirePlainRecord(value, "delivery calendar command");
  const action = input.action;
  const expectedFields = action === "upsert" ?
    [...commonMutationFields, "deliveryWeekday"] : commonMutationFields;
  if (
    (action !== "upsert" && action !== "delete") ||
    !hasExactFields(input, expectedFields) ||
    input.schemaVersion !== 1
  ) {
    return failCommand("delivery calendar command fields are invalid");
  }
  const parsed: DeliveryCalendarMutationInput = {
    schemaVersion: 1,
    environment: requireEnvironment(input.environment),
    operationId: requireIdentifier(input.operationId, "operationId"),
    action,
    weekKey: requireWeekKey(input.weekKey),
    expectedPlanningAuthority: parseAuthority(
      input.expectedPlanningAuthority,
    ),
    expectedOverrideDigest: parseExpectedDigest(
      input.expectedOverrideDigest,
    ),
  };
  if (action === "upsert") {
    if (
      input.deliveryWeekday !== "TUE" &&
      input.deliveryWeekday !== "THU" &&
      input.deliveryWeekday !== "FRI"
    ) {
      return failCommand("deliveryWeekday must be TUE, THU or FRI");
    }
    parsed.deliveryWeekday = input.deliveryWeekday;
  }
  return parsed;
};

const madridFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const madridWallClockMillis = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number => {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      madridFormatter.formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant += target - observed;
  }
  return instant;
};

const localDateAfter = (weekStart: Date, dayOffset: number): Date =>
  new Date(weekStart.getTime() + dayOffset * 86_400_000);

const startOfMadridDay = (date: Date): number => madridWallClockMillis(
  date.getUTCFullYear(),
  date.getUTCMonth() + 1,
  date.getUTCDate(),
  0,
  0,
  0,
);

export const buildDeliveryCalendarOverride = (input: {
  weekKey: string;
  deliveryWeekday: DeliveryCalendarWeekday;
  actorMemberId: string;
  updatedAtMillis: number;
}): DeliveryCalendarOverrideValue => {
  const weekStart = isoWeekStartUtc(requireWeekKey(input.weekKey));
  if (!weekStart) return failCommand("weekKey is invalid");
  const deliveryOffset = input.deliveryWeekday === "TUE" ? 1 :
    input.deliveryWeekday === "THU" ? 3 : 4;
  const delivery = localDateAfter(weekStart, deliveryOffset);
  const blocked = localDateAfter(delivery, 1);
  const open = localDateAfter(delivery, 2);
  const close = localDateAfter(weekStart, 6);
  const actorMemberId = requireDocumentId(
    input.actorMemberId,
    "actorMemberId",
  );
  if (
    !Number.isSafeInteger(input.updatedAtMillis) ||
    input.updatedAtMillis < 0
  ) {
    return failCommand("updatedAtMillis is invalid");
  }
  return {
    weekKey: input.weekKey,
    deliveryDateMillis: startOfMadridDay(delivery),
    ordersBlockedDateMillis: startOfMadridDay(blocked),
    ordersOpenAtMillis: startOfMadridDay(open),
    ordersCloseAtMillis: madridWallClockMillis(
      close.getUTCFullYear(),
      close.getUTCMonth() + 1,
      close.getUTCDate(),
      23,
      59,
      59,
    ),
    updatedBy: actorMemberId,
    updatedAtMillis: input.updatedAtMillis,
  };
};

const sha256Digest = (value: unknown): string => {
  const hash = createHash("sha256")
    .update("delivery-calendar:v1:sha256", "utf8")
    .update("\n", "utf8")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
  return `${DELIVERY_CALENDAR_DIGEST_PREFIX}${hash}`;
};

export const createDeliveryCalendarCommandDigest = (
  value: unknown,
): string => sha256Digest(parseDeliveryCalendarMutationInput(value));

export const createDeliveryCalendarOverrideDigest = (
  value: DeliveryCalendarOverrideValue,
): string => sha256Digest({
  weekKey: value.weekKey,
  deliveryDateMillis: value.deliveryDateMillis,
  ordersBlockedDateMillis: value.ordersBlockedDateMillis,
  ordersOpenAtMillis: value.ordersOpenAtMillis,
  ordersCloseAtMillis: value.ordersCloseAtMillis,
  updatedBy: value.updatedBy,
  updatedAtMillis: value.updatedAtMillis,
});
