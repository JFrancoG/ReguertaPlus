import type {sheets_v4 as SheetsV4} from "googleapis";
import {ShiftSheetsConfig, ShiftSheetsError, resolveShiftSheetsTab} from
  "./shift-sheets-config.js";
import type {ShiftSheetsProjectionRow} from "./shift-sheets.js";

/** Trusted display data; callers must bind it to the persisted submission. */
export type ShiftSheetsHumanGenerationRow = {
  id: string;
  visibleDate: string;
  assignees: readonly {userId: string; name: string; phone: string}[];
  helper: {userId: string; name: string} | null;
};

export const SHIFT_SHEETS_HUMAN_HEADERS = Object.freeze({
  delivery: ["Fecha", "Persona", "Teléfono", "Notas", "Cambio", "Ayuda"],
  market: ["Fecha / Persona", "Teléfono", "Notas / Cambio"],
});

export const shiftSheetsISOWeekKey = (date: string): string => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) /
    86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

export const shiftSheetsDateFromCell = (value: string): string => {
  const cell = value.normalize("NFKC").trim().replace(/\s+/g, " ")
    .toLowerCase();
  const long = /^(\d{1,2}) (?:de )?([a-z]+) (?:de )?(\d{4})$/.exec(cell);
  if (long) {
    const month = ["enero january", "febrero february", "marzo march",
      "abril april", "mayo may", "junio june", "julio july", "agosto august",
      "septiembre setiembre september", "octubre october", "noviembre november",
      "diciembre december"].findIndex((names) =>
      names.split(" ").includes(long[2])) + 1;
    if (month) {
      return `${long[3]}-${String(month).padStart(2, "0")}-` +
        long[1].padStart(2, "0");
    }
  }
  const european = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(cell);
  if (european) {
    return `${european[3]}-` +
      `${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  }
  if (/^\d{5}$/.test(cell)) {
    return new Date(Date.UTC(1899, 11, 30) + Number(cell) * 86400000)
      .toISOString().slice(0, 10);
  }
  return cell;
};

export type ShiftSheetsHumanBlock = {
  id: string;
  title: string;
  type: "delivery" | "market";
  visibleDate: string;
  values: readonly (readonly string[])[];
};

const fail = (): never => {
  throw new ShiftSheetsError("invalid_sheets_projection",
    "Human generation needs exact, unambiguous display data.");
};

/**
 * Produces literal human cells; technical identity remains in the backend.
 * @param {ShiftSheetsConfig} config Exact workbook and seasonal routing.
 * @param {ShiftSheetsProjectionRow[]} rows Validated backend projections.
 * @param {ShiftSheetsHumanGenerationRow[]} display Trusted display data.
 * @return {ShiftSheetsHumanBlock[]} Deterministic readable blocks.
 */
export const buildShiftSheetsHumanBlocks = (
  config: ShiftSheetsConfig,
  rows: readonly ShiftSheetsProjectionRow[],
  display: readonly ShiftSheetsHumanGenerationRow[],
): readonly ShiftSheetsHumanBlock[] => {
  if (display.length !== rows.length ||
    new Set(display.map((row) => row.id)).size !== display.length) fail();
  const dates = new Set<string>();
  const names = new Map<string, string>();
  const phones = new Map<string, string>();
  const identities = new Map<string, string>();
  const literal = (value: string, required: boolean) => {
    if (typeof value !== "string" || value.length > 1024 ||
      (required && !value.trim())) fail();
    return value;
  };
  return rows.map((row) => {
    const item = display.find((value) => value.id === row.id);
    if (!item || item.assignees.length !== row.assignedUserIds.length ||
      item.assignees.some((person, index) =>
        person.userId !== row.assignedUserIds[index]) ||
      (item.helper?.userId ?? null) !== row.helperUserId) return fail();
    resolveShiftSheetsTab(config, row.type, item.visibleDate);
    if (row.type === "market" ? item.visibleDate !== row.date :
      shiftSheetsISOWeekKey(item.visibleDate) !==
        shiftSheetsISOWeekKey(row.date)) fail();
    const title = resolveShiftSheetsTab(config, row.type, row.date).title;
    const key = `${title}:${row.type === "delivery" ?
      shiftSheetsISOWeekKey(item.visibleDate) : item.visibleDate}`;
    if (dates.has(key)) fail();
    dates.add(key);
    const people = item.assignees.map((person) => {
      const name = literal(person.name, true);
      const phone = literal(person.phone, false);
      const key = name.normalize("NFKC").trim().replace(/\s+/g, " ")
        .toLowerCase();
      const phoneKey = phone.replace(/[ ()-]/g, "");
      const identity = JSON.stringify([name, phone]);
      if ((names.has(key) && names.get(key) !== person.userId) ||
        (phoneKey && phones.has(phoneKey) &&
          phones.get(phoneKey) !== person.userId) ||
        (identities.has(person.userId) &&
          identities.get(person.userId) !== identity)) fail();
      names.set(key, person.userId);
      if (phoneKey) phones.set(phoneKey, person.userId);
      identities.set(person.userId, identity);
      return [name, phone];
    });
    const helper = item.helper ? literal(item.helper.name, true) : "";
    const [year, month, day] = item.visibleDate.split("-");
    const date = `${day}/${month}/${year}`;
    return {id: row.id,
      title,
      type: row.type, visibleDate: item.visibleDate,
      values: row.type === "delivery" ?
        [[date, ...people[0], "", "", helper]] :
        [[date, "", ""], ...people.map((person) => [...person, ""])]};
  }).sort((a, b) => a.title.localeCompare(b.title) ||
    a.visibleDate.localeCompare(b.visibleDate) || a.id.localeCompare(b.id));
};

/**
 * Rejects formulas in identity cells; annotations are never read as people.
 * @param {object} cell Actual user-entered cell, not formatted output.
 * @return {string} Bounded literal string or empty value.
 */
export const shiftSheetsHumanLiteral = (
  cell?: SheetsV4.Schema$CellData,
): string => {
  const value = cell?.userEnteredValue;
  if (value?.formulaValue != null || value?.boolValue != null) {
    return fail();
  }
  const result = String(value?.stringValue ?? value?.numberValue ?? "");
  if (result.length > 1024) fail();
  return result;
};
