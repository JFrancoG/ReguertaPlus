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
      "Formula cells require a reviewed conversion.",
    );
  }
  const result = value.stringValue ?? value.numberValue ??
    value.boolValue ?? "";
  if (String(result).length > 1024) {
    return failShiftSheetsImport("Import cell is oversized.");
  }
  return String(result);
};

const dateFromCell = (cell: string): string => {
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
  readWorkbookVersion(): Promise<string>;
}) => {
  const {config, sheets} = input;
  // Detach caller-owned layout/source data before the first asynchronous read.
  const tabs: ShiftSheetsImportTab[] = JSON.parse(JSON.stringify(input.tabs));
  const baseline: ShiftSheetsProjectionRow[] =
    JSON.parse(JSON.stringify(input.baseline));
  const members: ShiftSheetsImportMember[] =
    JSON.parse(JSON.stringify(input.members));
  const resolver = memberResolver(members);
  const projections = buildShiftSheetsProjections(config, baseline);
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
  const seen = new Set<string>();
  const add = (tab: ShiftSheetsImportTab, dateCell: string, rowNumber: number,
    assignedUserIds: string[], canonical?: string[]) => {
    const date = dateFromCell(dateCell);
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
    seen.add(id);
    assignments.push({id, type: tab.type, date, assignedUserIds, status,
      sheetName: tab.title, rowNumber});
  };
  const person = (name: string, phone: string, replacement: string) => {
    const listed = resolver.resolve(name, phone);
    if (!replacement.trim()) return listed;
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
      const values = cells.slice(0, tab.layout === "canonical" ? 11 : 6)
        .map(text);
      if (values.every((value) => !value.trim())) {
        flush(); return;
      }
      if (tab.layout === "canonical") {
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
      } else if (tab.layout === "delivery_human") {
        add(tab, values[0], index + 1, [person(values[1] ?? "",
          values[2] ?? "", values[4] ?? "")]);
      } else if (/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{5})$/
        .test(values[0] ?? "")) {
        if (values.slice(1).some((value) => value.trim())) {
          return failShiftSheetsImport(
            "Market date heading contains extra data.",
          );
        }
        flush();
        // Validate dates now, rather than silently skipping unknown headings.
        const date = dateFromCell(values[0]);
        resolveShiftSheetsTab(config, tab.type, date);
        market = {date, rowNumber: index + 1, ids: []};
      } else {
        if (!market) {
          return failShiftSheetsImport(
            "Market participant has no date heading.",
          );
        }
        market.ids.push(person(values[0] ?? "", values[1] ?? "",
          values[2] ?? ""));
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
    baselineDigest: createShiftPlanningDigest(baseline),
    mappingDigest: createShiftPlanningDigest({config, tabs}),
    membershipDigest: createShiftPlanningDigest(members),
  };
  return {...observation,
    snapshotDigest: createShiftPlanningDigest(observation)};
};
