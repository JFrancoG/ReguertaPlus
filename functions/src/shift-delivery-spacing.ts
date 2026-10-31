import {addBusinessDays} from "./shift-planning-calendar.js";
import {ShiftPlanningError,
  ShiftPlanningFailureCode} from "./shift-planning-contract.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";

export type DeliverySpacingHistory = {
  shiftId: string; date: string; userId: string; roundNumber: number;
};
export type DeliverySpacingException = {
  id: string; operationId: string; planningRequestId: string; userId: string;
  previousDate: string; previousRoundNumber: number;
  date: string; roundNumber: number; reason: string;
  approvedByUserId: string; approvedAtMillis: number;
  authorityDigest: string; authorized: boolean;
};
export type DeliverySpacingSource = {
  version: "hu089-delivery-spacing-v1"; authorityDigest: string;
  history: DeliverySpacingHistory[]; exceptions: DeliverySpacingException[];
};

export type DeliverySpacingConflict = {
  userId: string; previousDate: string; previousRoundNumber: number;
  date: string; roundNumber: number;
};

const fail = (
  code: ShiftPlanningFailureCode = "invalid_delivery_spacing_source",
): never => {
  throw new ShiftPlanningError(code, "Ordinary delivery spacing rejected.");
};
const exact = (value: object, keys: string) =>
  Object.keys(value).sort().join() === keys;
const identity = (value: unknown) => typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const round = (value: unknown) => Number.isSafeInteger(value) &&
  (value as number) > 0 && (value as number) < Number.MAX_SAFE_INTEGER;
const date = (value: unknown) => {
  try {
    return typeof value === "string" && addBusinessDays(value, 0) === value;
  } catch {
    return false;
  }
};
const isDigest = (value: unknown) => typeof value === "string" &&
  /^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value);
const pair = (value: {userId: string; previousDate: string;
  previousRoundNumber: number; date: string; roundNumber: number}) =>
  [value.userId, value.previousDate, value.previousRoundNumber,
    value.date, value.roundNumber].join("|");

export const deliverySpacingAuthorityDigest = (
  maintenance: {writeEpoch: number; activeRevision: string | null;
    activeDigest: string | null},
  rotation: {stateRevision: number},
): string => digest({writeEpoch: maintenance.writeEpoch,
  activeRevision: maintenance.activeRevision,
  activeDigest: maintenance.activeDigest,
  deliveryRotationRevision: rotation.stateRevision});

export const parseDeliverySpacingSource = (
  value: unknown,
): DeliverySpacingSource => {
  const source = value as DeliverySpacingSource | undefined;
  if (!source || !exact(source, "authorityDigest,exceptions,history,version") ||
      source.version !== "hu089-delivery-spacing-v1" ||
      !isDigest(source.authorityDigest) || !Array.isArray(source.history) ||
      !Array.isArray(source.exceptions) || source.history.length > 1000 ||
      source.exceptions.length > 250) return fail();
  for (const entry of source.history) {
    if (!entry || !exact(entry, "date,roundNumber,shiftId,userId") ||
        !identity(entry.shiftId) || !identity(entry.userId) ||
        !date(entry.date) || !round(entry.roundNumber)) return fail();
  }
  if (new Set(source.history.map((entry) => entry.shiftId)).size !==
      source.history.length || new Set(source.history.map((entry) =>
    entry.date)).size !== source.history.length) return fail();
  for (const entry of source.exceptions) {
    if (!entry || !exact(entry, "approvedAtMillis,approvedByUserId," +
      "authorityDigest,authorized,date,id,operationId,planningRequestId," +
      "previousDate,previousRoundNumber,reason,roundNumber,userId") ||
        ![entry.id, entry.operationId, entry.planningRequestId, entry.userId,
          entry.approvedByUserId].every(identity) ||
        !date(entry.date) || !date(entry.previousDate) ||
        entry.previousDate >= entry.date || !round(entry.roundNumber) ||
        !round(entry.previousRoundNumber) ||
        entry.roundNumber <= entry.previousRoundNumber ||
        addBusinessDays(entry.previousDate, 70) <= entry.date ||
        typeof entry.reason !== "string" || !entry.reason.trim() ||
        entry.reason.length > 500 || !isDigest(entry.authorityDigest) ||
        typeof entry.authorized !== "boolean" ||
        !Number.isSafeInteger(entry.approvedAtMillis) ||
        entry.approvedAtMillis < 0 || entry.approvedAtMillis >=
          Date.parse(entry.date + "T00:00:00.000Z")) return fail();
  }
  if (new Set(source.exceptions.map((entry) => entry.id)).size !==
      source.exceptions.length || new Set(source.exceptions.map((entry) =>
    entry.planningRequestId + "|" + pair(entry))).size !==
      source.exceptions.length) return fail();
  return structuredClone(source);
};

/**
 * Validate the unchanged ordinary queue/calendar after credit omission. The
 * immutable rotation owner counts even if a substitute does its published turn;
 * helper work and additional coverage do not introduce ordinary positions.
 * Compare calendar dates so daylight-saving hours cannot shorten ten weeks.
 * This diagnostic enumerates conflicts without applying or granting approvals.
 * @param {object} input Complete governed history and generated ordinary leads.
 * @return {object[]} Exact chronological pairs requiring approval.
 */
export const deliverySpacingConflicts = (input: {
  shifts: readonly {date: string; rotationOwnerUserId: string;
    roundNumber: number}[];
  source: DeliverySpacingSource;
}): DeliverySpacingConflict[] => {
  const source = parseDeliverySpacingSource(input.source);
  const entries = source.history.map((entry) => ({...entry, generated: false}));
  for (const shift of input.shifts) {
    const existing = entries.find((entry) => entry.date === shift.date);
    if (existing) return fail();
    entries.push({shiftId: `shift_delivery_${shift.date.replace(/-/g, "")}`,
      userId: shift.rotationOwnerUserId, date: shift.date,
      roundNumber: shift.roundNumber, generated: true});
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  const conflicts: DeliverySpacingConflict[] = [];
  for (let index = 0; index < entries.length; index++) {
    const current = entries[index];
    for (let prior = index - 1; prior >= 0; prior--) {
      const previous = entries[prior];
      if (addBusinessDays(previous.date, 70) <= current.date) break;
      if (current.userId !== previous.userId ||
          current.roundNumber === previous.roundNumber ||
          (!current.generated && !previous.generated)) continue;
      const violation = {userId: current.userId, date: current.date,
        roundNumber: current.roundNumber, previousDate: previous.date,
        previousRoundNumber: previous.roundNumber};
      conflicts.push(violation);
    }
  }
  return conflicts;
};

/**
 * Require current exact approvals for every ordinary cross-round conflict.
 * Native diagnostics reuse the same conflict calculation; they cannot grant
 * approval or publish their diagnostic plan.
 * @param {object} input Current request, history and generated ordinary leads.
 * @return {string[]} Applied approvals for the private audited artifact.
 */
export const validateDeliverySpacing = (input: {
  planningRequestId: string;
  shifts: readonly {date: string; rotationOwnerUserId: string;
    roundNumber: number}[];
  source: DeliverySpacingSource;
}): string[] => {
  const source = parseDeliverySpacingSource(input.source);
  const exceptions = source.exceptions.filter((entry) =>
    entry.planningRequestId === input.planningRequestId);
  if (exceptions.some((entry) => !entry.authorized ||
      entry.authorityDigest !== source.authorityDigest)) {
    return fail("delivery_spacing_exception_unavailable");
  }
  const used = new Set<string>();
  for (const violation of deliverySpacingConflicts(input)) {
    const exception = exceptions.find((entry) => pair(entry) ===
      pair(violation));
    if (!exception) return fail("delivery_spacing_conflict");
    used.add(exception.id);
  }
  if (exceptions.some((entry) => !used.has(entry.id))) {
    return fail("delivery_spacing_exception_unused");
  }
  return [...used];
};
