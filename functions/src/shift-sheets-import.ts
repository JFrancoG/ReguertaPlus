import type {sheets_v4 as SheetsV4} from "googleapis";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {requireShiftSheetsWorkbookVersion} from
  "./shift-planning-sheets-submission.js";
import {
  ShiftSheetsConfig,
  ShiftSheetsError,
  ShiftSheetsTab,
  resolveShiftSheetsTab,
} from "./shift-sheets-config.js";
import {
  SHIFT_SHEETS_HEADERS,
  SHIFT_SHEETS_LIMITS,
  ShiftSheetsProjectionRow,
  ShiftSheetsReviewedRow,
  ShiftSheetsHumanWriteBackRow,
  shiftSheetsCellValue,
  buildShiftSheetsProjections,
  readShiftSheetsSnapshot,
  shiftSheetsGridRows,
} from "./shift-sheets.js";

export type ShiftSheetsImportTab = ShiftSheetsTab & {
  layout: "canonical" | "delivery_human" | "market_human";
  // Exact reviewed decoration rows, including display titles/month headings.
  decorations: readonly {rowNumber: number; cells: readonly string[]}[];
};

export type ShiftSheetsImportMember = {
  userId: string;
  names: readonly string[];
  phones: readonly string[];
  eligibleTypes: readonly ("delivery" | "market")[];
};

export type ShiftSheetsImportedAssignment = {
  id: string;
  type: "delivery" | "market";
  date: string;
  assignedUserIds: readonly string[];
  status: ShiftSheetsProjectionRow["status"];
  sheetName: string;
  rowNumber: number;
};

export const failShiftSheetsImport = (message: string): never => {
  throw new ShiftSheetsError("invalid_sheets_import", message);
};

const normalize = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const phoneKey = (value: string): string => value.replace(/[ ()-]/g, "");
const same = (left: unknown, right: unknown) =>
  createShiftPlanningDigest(left) === createShiftPlanningDigest(right);

const text = (cell?: SheetsV4.Schema$CellData): string => {
  const value = cell?.userEnteredValue;
  if (!value) return "";
  if (value.formulaValue !== undefined && value.formulaValue !== null) {
    return failShiftSheetsImport(
      "Assignment and date cells must contain literal values.",
    );
  }
  const result = value.stringValue ?? value.numberValue ??
    value.boolValue ?? "";
  if (String(result).length > 1024) {
    return failShiftSheetsImport("Import cell is oversized.");
  }
  return String(result);
};

const dateFromCell = (value: string): string => {
  const cell = normalize(value);
  const long = /^(\d{1,2}) (?:de )?([a-z]+) (?:de )?(\d{4})$/.exec(cell);
  if (long) {
    const month = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
      .indexOf(long[2]) + 1;
    if (month) {
      return `${long[3]}-${String(month).padStart(2, "0")}-` +
        long[1].padStart(2, "0");
    }
  }
  const european = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cell);
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

const isoWeekKey = (date: string): string => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) /
    86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

// Annotation formulas are preserved by writers and never resolve identities.
const annotation = (cell?: SheetsV4.Schema$CellData): string =>
  cell?.userEnteredValue?.formulaValue != null ? "" : text(cell);

const memberResolver = (members: readonly ShiftSheetsImportMember[]) => {
  const byId = new Map(members.map((member) => [member.userId, member]));
  if (byId.size !== members.length || members.some((member) =>
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(member.userId))) {
    return failShiftSheetsImport("Member identity is duplicated or invalid.");
  }
  const requireEligible = (id: string, type: "delivery" | "market") => {
    if (!byId.get(id)?.eligibleTypes.includes(type)) {
      return failShiftSheetsImport("Assignee is unknown or ineligible.");
    }
    return id;
  };
  const resolve = (name: string, phone: string): string => {
    const names = members.filter((member) => member.names.some((alias) =>
      normalize(alias) === normalize(name)));
    const phones = phone ? members.filter((member) =>
      member.phones.some((alias) => phoneKey(alias) === phoneKey(phone))) : [];
    if (!name || names.length !== 1 ||
      (phone && (phones.length !== 1 ||
        phones[0].userId !== names[0].userId))) {
      return failShiftSheetsImport("Human identity is unknown or ambiguous.");
    }
    return names[0].userId;
  };
  return {requireEligible, resolve};
};

/**
 * Reads all selected tabs or rejects the entire snapshot. It never clears,
 * deletes or applies a row. Legacy rows can propose effective assignments only;
 * ownership/status defaults come from the trusted exported Firestore baseline.
 * Visible delivery dates must match the trusted calendar; annotations never
 * resolve people through formulas or arbitrary notes.
 * @param {object} input Explicit layout mapping, source rows and member
 * authority.
 * @return {object} Version-bound assignments and absence diagnostics, no
 * writes.
 */
export const readShiftSheetsImport = async (input: {
  config: ShiftSheetsConfig;
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get">;
  tabs: readonly ShiftSheetsImportTab[];
  baseline: readonly ShiftSheetsProjectionRow[];
  members: readonly ShiftSheetsImportMember[];
  deliveryCalendar?: readonly {weekKey: string; date: string}[];
  readWorkbookVersion(): Promise<string>;
}) => {
  const {config, sheets} = input;
  // Detach caller-owned layout/source data before the first asynchronous read.
  const tabs: ShiftSheetsImportTab[] = JSON.parse(JSON.stringify(input.tabs));
  const baseline: ShiftSheetsProjectionRow[] =
    JSON.parse(JSON.stringify(input.baseline));
  const members: ShiftSheetsImportMember[] =
    JSON.parse(JSON.stringify(input.members));
  const calendar = structuredClone(input.deliveryCalendar ?? []);
  if (calendar.length > SHIFT_SHEETS_LIMITS.projectionRows ||
    new Set(calendar.map((item) => item.weekKey)).size !== calendar.length) {
    return failShiftSheetsImport("Calendar is oversized or duplicated.");
  }
  for (const entry of calendar) {
    resolveShiftSheetsTab(config, "delivery", entry.date);
    if (isoWeekKey(entry.date) !== entry.weekKey) {
      return failShiftSheetsImport("Delivery calendar week does not match.");
    }
  }
  const resolver = memberResolver(members);
  const projections = buildShiftSheetsProjections(config, baseline);
  const calendarByWeek = new Map(calendar.map((item) =>
    [item.weekKey, item.date]));
  const visibleDates = new Map(baseline.map((row) => [row.id,
    row.type === "delivery" ?
      calendarByWeek.get(isoWeekKey(row.date)) ?? row.date : row.date]));
  const byId = new Map(baseline.map((row) => [row.id, row]));
  if (!tabs.length || tabs.length > SHIFT_SHEETS_LIMITS.tabs ||
    new Set(tabs.map((tab) => tab.title)).size !== tabs.length) {
    return failShiftSheetsImport("Import tabs are missing or duplicated.");
  }
  for (const tab of tabs) {
    const routed = resolveShiftSheetsTab(config, tab.type,
      `${tab.seasonStartYear}-09-01`);
    if (routed.title !== tab.title ||
      !["canonical", `${tab.type}_human`].includes(tab.layout) ||
      (tab.layout === "canonical" && tab.decorations.length) ||
      new Set(tab.decorations.map((row) => row.rowNumber)).size !==
        tab.decorations.length || tab.decorations.some((row) =>
      !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 1 ||
      row.rowNumber > SHIFT_SHEETS_LIMITS.tabRows)) {
      return failShiftSheetsImport(
        "Layout does not match its exact partition.",
      );
    }
  }
  const before = requireShiftSheetsWorkbookVersion(
    await input.readWorkbookVersion(),
  );
  const snapshot = await readShiftSheetsSnapshot({config, sheets,
    titles: tabs.map((tab) => tab.title)});
  const after = requireShiftSheetsWorkbookVersion(
    await input.readWorkbookVersion(),
  );
  if (before !== after) {
    return failShiftSheetsImport("Workbook changed during import read.");
  }
  const assignments: ShiftSheetsImportedAssignment[] = [];
  const canonicalRows: ShiftSheetsReviewedRow[] = [];
  const humanRows: ShiftSheetsHumanWriteBackRow[] = [];
  const seen = new Set<string>();
  const add = (tab: ShiftSheetsImportTab, dateCell: string, rowNumber: number,
    assignedUserIds: string[], canonical?: string[]) => {
    const enteredDate = dateFromCell(dateCell);
    // The visible season validates the date, but cannot choose its tab.
    resolveShiftSheetsTab(config, tab.type, enteredDate);
    const candidates = canonical ? [] : baseline.filter((row) =>
      row.type === tab.type && visibleDates.get(row.id) === enteredDate &&
      resolveShiftSheetsTab(config, row.type, row.date).title === tab.title);
    if (!canonical && candidates.length !== 1) {
      return failShiftSheetsImport("Human date has no unique trusted shift.");
    }
    const date = canonical ? enteredDate : candidates[0].date;
    const routed = resolveShiftSheetsTab(config, tab.type, date);
    if (routed.title !== tab.title) {
      return failShiftSheetsImport("Row date belongs to another seasonal tab.");
    }
    const id = `shift_${tab.type}_${date.replace(/-/g, "")}`;
    const source = byId.get(id);
    if (!source || source.type !== tab.type || source.date !== date ||
      seen.has(id) ||
      assignments.length >= SHIFT_SHEETS_LIMITS.projectionRows) {
      return failShiftSheetsImport(
        "Row is unknown, duplicated or out of scope.",
      );
    }
    if (assignedUserIds.length !== (tab.type === "delivery" ? 1 : 3) ||
      new Set(assignedUserIds).size !== assignedUserIds.length) {
      return failShiftSheetsImport("Assignment cardinality is invalid.");
    }
    // Unchanged historic assignments need not still be active members today.
    if (!same(assignedUserIds, source.assignedUserIds)) {
      assignedUserIds.forEach((id) => resolver.requireEligible(id, tab.type));
    }
    let status = source.status;
    if (canonical) {
      const expected = projections.find((row) => row.id === id)?.values;
      if (!expected || [0, 1, 2, 3, 4, 6, 8, 9, 10].some((column) =>
        canonical[column] !== expected[column]) ||
        !["planned", "confirmed", "swap_pending"].includes(canonical[7])) {
        return failShiftSheetsImport(
          "Canonical authority fields were changed.",
        );
      }
      status = canonical[7] as ShiftSheetsProjectionRow["status"];
      canonicalRows.push({id, sheetName: tab.title, rowNumber,
        values: [...canonical]});
    }
    if (!canonical) {
      const sheet = snapshot.sheets?.find((item) =>
        item.properties?.title === tab.title);
      if (!sheet || !Number.isSafeInteger(sheet.properties?.sheetId)) {
        return failShiftSheetsImport("Human sheet identity is missing.");
      }
      const cells = shiftSheetsGridRows(sheet);
      const delivery = tab.type === "delivery";
      const before = Array.from({length: delivery ? 1 : 4}, (_, offset) => ({
        values: Array.from({length: delivery ? 6 : 3}, (_, column) => {
          const value = shiftSheetsCellValue(
            cells[rowNumber - 1 + offset]?.[column],
          );
          if (Object.values(value).some((scalar) =>
            typeof scalar === "string" && scalar.length > 1024)) {
            return failShiftSheetsImport("Human review cell is oversized.");
          }
          return value;
        }),
      }));
      const after = structuredClone(before);
      assignedUserIds.forEach((userId, index) => {
        const member = members.find((item) => item.userId === userId);
        if (!member?.names[0]?.trim() || member.names[0].length > 1024 ||
          (member.phones[0]?.length ?? 0) > 1024) {
          return failShiftSheetsImport("Human assignee has no display name.");
        }
        const values = after[delivery ? 0 : index + 1].values;
        values[delivery ? 1 : 0] = {stringValue: member.names[0]};
        values[delivery ? 2 : 1] = member.phones[0] ?
          {stringValue: member.phones[0]} : {};
        const replacement = delivery ? 4 : 2;
        if (/^lo hace\s+.+$/i.test(
          values[replacement].stringValue?.trim() ?? "",
        )) values[replacement] = {};
      });
      humanRows.push({id, sheetName: tab.title,
        sheetId: sheet.properties?.sheetId as number, rowNumber,
        assignedUserIds: [...assignedUserIds], before, after});
    }
    seen.add(id);
    assignments.push({id, type: tab.type, date, assignedUserIds, status,
      sheetName: tab.title, rowNumber});
  };
  const person = (name: string, phone: string, replacement: string) => {
    const listed = resolver.resolve(name, phone);
    if (!/^lo hace(?:\s|$)/i.test(replacement.trim())) return listed;
    const match = /^lo hace\s+(.+)$/i.exec(replacement.trim());
    if (!match) return failShiftSheetsImport("Replacement text is ambiguous.");
    return resolver.resolve(match[1], "");
  };
  for (const tab of tabs) {
    const matching = snapshot.sheets?.filter((sheet) =>
      sheet.properties?.title === tab.title) ?? [];
    if (matching.length !== 1) {
      return failShiftSheetsImport("A required import tab is missing.");
    }
    const rows = shiftSheetsGridRows(matching[0]);
    const decorations = new Map(tab.decorations.map((row) =>
      [row.rowNumber, row.cells]));
    // Check the full row, not just managed columns, before ignoring decoration.
    for (const [rowNumber, cells] of decorations) {
      if (!same((rows[rowNumber - 1] ?? []).map(text), cells)) {
        return failShiftSheetsImport("Reviewed decoration row changed.");
      }
    }
    let market: {date: string; rowNumber: number; ids: string[]} | null = null;
    const flush = () => {
      if (market) add(tab, market.date, market.rowNumber, market.ids);
      market = null;
    };
    rows.forEach((cells, index) => {
      if (decorations.has(index + 1)) {
        flush(); return;
      }
      if (tab.layout === "canonical") {
        const values = cells.slice(0, 11).map(text);
        if (values.every((value) => !value.trim())) return;
        if (index === 0) {
          if (!same(values, SHIFT_SHEETS_HEADERS)) {
            return failShiftSheetsImport("Canonical header is not exact.");
          }
          return;
        }
        let ids: unknown;
        try {
          ids = JSON.parse(values[5]);
        } catch {
          return failShiftSheetsImport("Assignment cell is not a JSON list.");
        }
        if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
          return failShiftSheetsImport("Assignment IDs are invalid.");
        }
        add(tab, values[2], index + 1, ids, values);
        return;
      }
      const first = text(cells[0]);
      if (!first.trim()) {
        // Notes alone are not participants; orphaned identity/replacement cells
        // still reject rather than silently dropping a possible assignment.
        const identityColumns = tab.layout === "delivery_human" ? [1, 2] : [1];
        const replacement = annotation(cells[tab.type === "delivery" ? 4 : 2]);
        if (identityColumns.some((column) => text(cells[column]).trim()) ||
          /^lo hace(?:\s|$)/i.test(replacement.trim())) {
          return failShiftSheetsImport("Human identity has no date or name.");
        }
        flush(); return;
      }
      if (tab.layout === "delivery_human") {
        add(tab, first, index + 1, [person(text(cells[1]),
          text(cells[2]), annotation(cells[4]))]);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateFromCell(first))) {
        flush();
        const date = dateFromCell(first);
        resolveShiftSheetsTab(config, tab.type, date);
        market = {date, rowNumber: index + 1, ids: []};
      } else {
        if (!market) {
          return failShiftSheetsImport(
            "Market participant has no date heading.",
          );
        }
        market.ids.push(person(first, text(cells[1]), annotation(cells[2])));
      }
    });
    flush();
    if (tab.layout === "canonical" &&
      !same((rows[0] ?? []).slice(0, 11).map(text), SHIFT_SHEETS_HEADERS)) {
      return failShiftSheetsImport("Canonical header is missing.");
    }
  }
  const missingIds = projections.filter((row) =>
    tabs.some((tab) => tab.title === row.title) && !seen.has(row.id))
    .map((row) => row.id).sort();
  assignments.sort((a, b) => a.id.localeCompare(b.id));
  const observation = {
    environment: config.environment, workbookId: config.workbookId,
    workbookRevision: after, assignments, missingIds,
    canonicalRows: canonicalRows.sort((a, b) => a.id.localeCompare(b.id)),
    humanRows: humanRows.sort((a, b) => a.id.localeCompare(b.id)),
    baselineDigest: createShiftPlanningDigest(baseline),
    mappingDigest: createShiftPlanningDigest({config, tabs}),
    membershipDigest: createShiftPlanningDigest(members),
    calendarDigest: createShiftPlanningDigest(calendar),
  };
  return {...observation,
    snapshotDigest: createShiftPlanningDigest(observation)};
};
