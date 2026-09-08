import {createHash} from "node:crypto";
import type {sheets_v4 as SheetsV4} from "googleapis";
import {
  ShiftSheetsConfig,
  ShiftSheetsError,
  ShiftSheetsType,
  quoteShiftSheetsTitle,
  resolveShiftSheetsTab,
} from "./shift-sheets-config.js";

export type ShiftSheetsProjectionRow = {
  id: string;
  type: ShiftSheetsType;
  date: string;
  rotationOwnerUserIds: readonly string[];
  assignedUserIds: readonly string[];
  helperUserId: string | null;
  status: "planned" | "swap_pending" | "confirmed";
  source: "app" | "google_sheets";
  origin: string | null;
};

// This new table format is intentionally distinct from legacy human layouts.
// Aliasing a title does not authorize interpreting or migrating its old cells.
export const SHIFT_SHEETS_HEADERS = Object.freeze([
  "shiftId", "type", "date", "seasonStartYear", "rotationOwnerUserIds",
  "assignedUserIds", "helperUserId", "status", "source", "origin", "rowDigest",
]);

export const SHIFT_SHEETS_LIMITS = Object.freeze({
  projectionRows: 500,
  tabs: 8,
  tabRows: 2000,
  tabColumns: 64,
  readCells: 250000,
  requestBytes: 1024 * 1024,
});

const MARKER_KEY = "reguerta.shiftSheets.v1";
const REQUEST_OPTIONS = {retry: false, timeout: 30000} as const;
type Spreadsheet = SheetsV4.Schema$Spreadsheet;
type Sheet = SheetsV4.Schema$Sheet;
type Cell = SheetsV4.Schema$CellData;
type Request = SheetsV4.Schema$Request;
type Projection = {
  title: string;
  id: string;
  values: readonly string[];
};

export type ShiftSheetsMergePlan = {
  projectionDigest: string;
  projections: readonly Projection[];
  requests: readonly Request[];
  sheets: readonly {title: string; sheetId: number}[];
};

export type ShiftSheetsReadBack =
  | {
    kind: "verified";
    operationId: string;
    projectionDigest: string;
    readBackDigest: string;
  }
  | {
    kind: "ambiguous";
    operationId: string;
    reason: "read_back_unavailable" | "read_back_mismatch";
  };

export type ShiftSheetsBatchBinding = {
  workbookId: string;
  projectionDigest: string;
  requestDigest: string;
};

type OperationInput = {
  operationId: string;
  rows: readonly ShiftSheetsProjectionRow[];
};

const fail = (code: string, message: string): never => {
  throw new ShiftSheetsError(code, message);
};

const digest = (value: unknown): string => "shift-sheets:v1:sha256:" +
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const identifier = (value: string): boolean =>
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

const cellText = (cell?: Cell): string => {
  const value = cell?.userEnteredValue;
  if (!value) return "";
  if (value.stringValue !== undefined && value.stringValue !== null) {
    return value.stringValue;
  }
  if (value.numberValue !== undefined && value.numberValue !== null) {
    return String(value.numberValue);
  }
  if (value.boolValue !== undefined && value.boolValue !== null) {
    return String(value.boolValue);
  }
  return value.formulaValue ?? "";
};

const projectionsFor = (
  config: ShiftSheetsConfig,
  rows: readonly ShiftSheetsProjectionRow[],
): readonly Projection[] => {
  if (!rows.length || rows.length > SHIFT_SHEETS_LIMITS.projectionRows) {
    return fail("sheets_limit", "Projection row count is outside the limit.");
  }
  const ids = new Set<string>();
  const dates = new Set<string>();
  const projections = rows.map((row) => {
    const tab = resolveShiftSheetsTab(config, row.type, row.date);
    const count = row.type === "delivery" ? 1 : 3;
    const idsValid = (values: readonly string[]) => Array.isArray(values) &&
      values.length === count && values.every(identifier) &&
      new Set(values).size === values.length;
    if (!identifier(row.id) || !idsValid(row.rotationOwnerUserIds) ||
      !idsValid(row.assignedUserIds) ||
      (row.helperUserId !== null && !identifier(row.helperUserId)) ||
      (row.type === "market" && row.helperUserId !== null) ||
      !["planned", "swap_pending", "confirmed"].includes(row.status) ||
      !["app", "google_sheets"].includes(row.source) ||
      (row.origin !== null && !identifier(row.origin))) {
      return fail("invalid_sheets_projection", "Projection row is invalid.");
    }
    const dateKey = `${row.type}:${row.date}`;
    if (ids.has(row.id) || dates.has(dateKey)) {
      return fail(
        "duplicate_sheets_row", "Projection identities are duplicated.",
      );
    }
    ids.add(row.id);
    dates.add(dateKey);
    const values = [
      row.id, row.type, row.date, String(tab.seasonStartYear),
      JSON.stringify(row.rotationOwnerUserIds),
      JSON.stringify(row.assignedUserIds), row.helperUserId ?? "",
      row.status, row.source, row.origin ?? "",
    ];
    return Object.freeze({
      title: tab.title,
      id: row.id,
      values: Object.freeze([...values, digest(values)]),
    });
  }).sort((a, b) => a.title.localeCompare(b.title) ||
    a.values[2].localeCompare(b.values[2]) || a.id.localeCompare(b.id));
  if (new Set(projections.map((row) => row.title)).size >
    SHIFT_SHEETS_LIMITS.tabs) {
    return fail("sheets_limit", "Projection tab count exceeds the limit.");
  }
  return Object.freeze(projections);
};

const projectionDigestFor = (
  config: ShiftSheetsConfig,
  projections: readonly Projection[],
): string => digest({
  environment: config.environment, workbookId: config.workbookId,
  headers: SHIFT_SHEETS_HEADERS, projections,
});

const gridRows = (sheet: Sheet): Cell[][] => {
  const rows: Cell[][] = [];
  for (const grid of sheet.data ?? []) {
    const rowStart = grid.startRow ?? 0;
    const columnStart = grid.startColumn ?? 0;
    for (const [offset, row] of (grid.rowData ?? []).entries()) {
      const target = rows[rowStart + offset] ?? [];
      (row.values ?? []).forEach((value, column) => {
        target[columnStart + column] = value;
      });
      rows[rowStart + offset] = target;
    }
  }
  return rows;
};

const intersects = (
  range: SheetsV4.Schema$GridRange,
  row: number,
  column: number,
): boolean => row >= (range.startRowIndex ?? 0) &&
  row < (range.endRowIndex ?? Infinity) &&
  column >= (range.startColumnIndex ?? 0) &&
  column < (range.endColumnIndex ?? Infinity);

const requireWritable = (
  sheet: Sheet,
  rows: Cell[][],
  row: number,
  column: number,
): void => {
  if (rows[row]?.[column]?.userEnteredValue?.formulaValue !== undefined) {
    fail("sheets_formula_conflict", "A managed cell contains a formula.");
  }
  if ((sheet.merges ?? []).some((range) => intersects(range, row, column))) {
    fail("sheets_merged_cell", "A managed cell belongs to a merged range.");
  }
  const protectedCell = (sheet.protectedRanges ?? []).some((protection) => {
    // No protected-range override is authorized in this first adapter slice.
    // A named range or table reference needs a reviewed resolver, so deny it.
    if (!protection.range) return true;
    if (!intersects(protection.range, row, column)) return false;
    return !(protection.unprotectedRanges ?? [])
      .some((range) => intersects(range, row, column));
  });
  if (protectedCell) {
    fail("sheets_protected_cell", "A managed cell is protected.");
  }
};

const existingRows = (rows: Cell[][]): Map<string, number> => {
  const result = new Map<string, number>();
  rows.forEach((row, index) => {
    if (index === 0) return;
    const id = cellText(row[0]);
    if (!id) return;
    if (!identifier(id) || row[0]?.userEnteredValue?.formulaValue ||
      result.has(id)) {
      fail("duplicate_sheets_row", "Existing row identity is ambiguous.");
    }
    result.set(id, index);
  });
  return result;
};

const validateSheetSize = (sheet: Sheet): number => {
  const {sheetId, title, gridProperties: grid, sheetType} =
    sheet.properties ?? {};
  if (!Number.isSafeInteger(sheetId) || (sheetId as number) < 0 || !title ||
    (sheetType && sheetType !== "GRID") ||
    !Number.isSafeInteger(grid?.rowCount) ||
    !Number.isSafeInteger(grid?.columnCount) ||
    (grid?.rowCount ?? 0) < 1 || (grid?.columnCount ?? 0) < 1 ||
    (grid?.rowCount ?? Infinity) > SHIFT_SHEETS_LIMITS.tabRows ||
    (grid?.columnCount ?? Infinity) > SHIFT_SHEETS_LIMITS.tabColumns) {
    return fail(
      "sheets_limit", "Existing tab is outside supported grid limits.",
    );
  }
  return (grid?.rowCount ?? 0) * (grid?.columnCount ?? 0);
};

/**
 * Plans literal cell patches by stable ID without mutating the snapshot.
 * A changed exported rowDigest is a manual-edit conflict, not permission to
 * overwrite. Unknown columns, rows, formatting and untouched cells survive.
 * @param {ShiftSheetsConfig} config Exact environment and alias authority.
 * @param {Spreadsheet} spreadsheet Complete bounded grids for affected tabs.
 * @param {ShiftSheetsProjectionRow[]} inputRows Detached target projections.
 * @return {ShiftSheetsMergePlan} Pure plan without external operation markers.
 */
export const planShiftSheetsMerge = (
  config: ShiftSheetsConfig,
  spreadsheet: Spreadsheet,
  inputRows: readonly ShiftSheetsProjectionRow[],
): ShiftSheetsMergePlan => {
  if (spreadsheet.spreadsheetId !== config.workbookId) {
    return fail(
      "sheets_workbook_mismatch", "Snapshot belongs to another workbook.",
    );
  }
  const projections = projectionsFor(config, inputRows);
  const requests: Request[] = [];
  const sheets: {title: string; sheetId: number}[] = [];
  const usedIds = new Set((spreadsheet.sheets ?? [])
    .map((sheet) => sheet.properties?.sheetId));
  const titles = new Set(projections.map((row) => row.title));
  const locations = new Map<string, string>();
  const dateOwners = new Map<string, string>();
  for (const sheet of spreadsheet.sheets ?? []) {
    const title = sheet.properties?.title ?? "";
    if (!titles.has(title)) continue;
    const rows = gridRows(sheet);
    for (const [id, index] of existingRows(rows)) {
      const type = cellText(rows[index]?.[1]);
      const date = cellText(rows[index]?.[2]);
      const tab = resolveShiftSheetsTab(config, type as ShiftSheetsType, date);
      const dateKey = `${type}:${date}`;
      if (locations.has(id) || dateOwners.has(dateKey) || tab.title !== title) {
        return fail(
          "duplicate_sheets_row", "Existing row partition is ambiguous.",
        );
      }
      locations.set(id, title);
      dateOwners.set(dateKey, id);
    }
  }
  for (const projection of projections) {
    const existingTitle = locations.get(projection.id);
    const existingId = dateOwners.get(
      `${projection.values[1]}:${projection.values[2]}`,
    );
    if ((existingTitle && existingTitle !== projection.title) ||
      (existingId && existingId !== projection.id)) {
      return fail(
        "duplicate_sheets_row", "Incoming row identity is ambiguous.",
      );
    }
  }
  for (const title of new Set(projections.map((row) => row.title))) {
    const matches = (spreadsheet.sheets ?? [])
      .filter((sheet) => sheet.properties?.title === title);
    if (matches.length > 1) {
      return fail(
        "duplicate_sheets_tab", "Snapshot tab identity is ambiguous.",
      );
    }
    let sheet = matches[0];
    if (!sheet) {
      let sheetId = 1;
      while (usedIds.has(sheetId)) sheetId += 1;
      usedIds.add(sheetId);
      sheet = {properties: {
        sheetId, title, gridProperties: {rowCount: 1000, columnCount: 26},
      }};
      requests.push({addSheet: {properties: sheet.properties}});
    }
    validateSheetSize(sheet);
    const sheetId = sheet.properties?.sheetId as number;
    sheets.push({title, sheetId});
    const rows = gridRows(sheet);
    const hasContent = rows.some((row) => row.some((cell) => cellText(cell)));
    if (hasContent && SHIFT_SHEETS_HEADERS.some((header, column) =>
      cellText(rows[0]?.[column]) !== header ||
      rows[0]?.[column]?.userEnteredValue?.formulaValue !== undefined)) {
      return fail(
        "sheets_header_mismatch", "Tab needs an explicit layout migration.",
      );
    }
    const byId = existingRows(rows);
    let nextRow = Math.max(1, rows.reduce((last, row, index) =>
      row.some((cell) => cellText(cell)) ? index + 1 : last, 1));
    const patches: {row: number; values: readonly string[]}[] = [];
    if (!hasContent) patches.push({row: 0, values: SHIFT_SHEETS_HEADERS});
    for (const projection of projections.filter((row) => row.title === title)) {
      const existing = byId.get(projection.id);
      if (existing !== undefined) {
        const values = SHIFT_SHEETS_HEADERS.slice(0, -1)
          .map((_, column) => cellText(rows[existing]?.[column]));
        if (values.some((_, column) =>
          rows[existing]?.[column]?.userEnteredValue?.formulaValue !==
            undefined) ||
          cellText(rows[existing]?.[SHIFT_SHEETS_HEADERS.length - 1]) !==
            digest(values)) {
          return fail(
            "sheets_manual_conflict", "Existing managed row was edited.",
          );
        }
      }
      patches.push({row: existing ?? nextRow++, values: projection.values});
    }
    if (nextRow > SHIFT_SHEETS_LIMITS.tabRows) {
      return fail("sheets_limit", "Merge would exceed the tab row limit.");
    }
    const rowCount = sheet.properties?.gridProperties?.rowCount ?? 0;
    const columnCount = sheet.properties?.gridProperties?.columnCount ?? 0;
    if (nextRow > rowCount || SHIFT_SHEETS_HEADERS.length > columnCount) {
      requests.push({updateSheetProperties: {
        properties: {sheetId, gridProperties: {
          rowCount: Math.max(rowCount, nextRow),
          columnCount: Math.max(columnCount, SHIFT_SHEETS_HEADERS.length),
        }},
        fields: "gridProperties.rowCount,gridProperties.columnCount",
      }});
    }
    for (const patch of patches) {
      let column = 0;
      while (column < patch.values.length) {
        if (cellText(rows[patch.row]?.[column]) === patch.values[column]) {
          column += 1;
          continue;
        }
        const start = column;
        while (column < patch.values.length &&
          cellText(rows[patch.row]?.[column]) !== patch.values[column]) {
          requireWritable(sheet, rows, patch.row, column);
          column += 1;
        }
        requests.push({updateCells: {
          range: {sheetId, startRowIndex: patch.row, endRowIndex: patch.row + 1,
            startColumnIndex: start, endColumnIndex: column},
          rows: [{values: patch.values.slice(start, column).map((value) => ({
            userEnteredValue: {stringValue: value},
          }))}],
          fields: "userEnteredValue",
        }});
      }
    }
  }
  return {projectionDigest: projectionDigestFor(config, projections),
    projections, requests, sheets};
};

const markerFor = (sheet: Sheet): SheetsV4.Schema$DeveloperMetadata | null => {
  const matches = (sheet.developerMetadata ?? [])
    .filter((marker) => marker.metadataKey === MARKER_KEY);
  if (matches.length > 1) {
    return fail(
      "sheets_marker_conflict", "Tab has duplicated operation markers.",
    );
  }
  const marker = matches[0];
  if (!marker) return null;
  if (!Number.isSafeInteger(marker.metadataId) ||
    (marker.metadataId as number) < 0 ||
    marker.location?.sheetId !== sheet.properties?.sheetId) {
    return fail(
      "sheets_marker_conflict", "Marker identity or location is invalid.",
    );
  }
  let value: {operationId?: string; projectionDigest?: string};
  try {
    value = JSON.parse(marker.metadataValue ?? "");
  } catch {
    return fail("sheets_marker_conflict", "Operation marker is invalid.");
  }
  if (!value || typeof value !== "object" ||
    Object.keys(value).length !== 2 || !identifier(value.operationId ?? "") ||
    !/^shift-sheets:v1:sha256:[a-f0-9]{64}$/
      .test(value.projectionDigest ?? "")) {
    return fail(
      "sheets_marker_conflict", "Operation marker fields are invalid.",
    );
  }
  return marker;
};

const markerValue = (operationId: string, projectionDigest: string): string =>
  JSON.stringify({operationId, projectionDigest});

const columnName = (count: number): string => count <= 26 ?
  String.fromCharCode(64 + count) :
  String.fromCharCode(64 + Math.floor((count - 1) / 26)) +
    String.fromCharCode(65 + (count - 1) % 26);

/**
 * Uses the public Sheets API for one atomic batch, with SDK retries disabled.
 * authorizeMutation must establish exclusive writer/operation authority; this
 * adapter offers no Sheets CAS and cannot fence human edits between read/write.
 * One latest-operation marker per tab is replaced by the next authorized batch.
 * Durable replay history and obsolete-operation rejection belong to the caller.
 * inspect only reads and is the recovery path after an ambiguous result.
 * @param {object} input Frozen config and existing googleapis Sheets resource.
 * @return {object} Explicit reconcile and read-only recovery operations.
 */
export const createShiftSheetsAdapter = (input: {
  config: ShiftSheetsConfig;
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get" | "batchUpdate">;
}) => {
  const {config, sheets} = input;
  const snapshot = async (projections: readonly Projection[]) => {
    const titles = new Set(projections.map((row) => row.title));
    const metadata = (await sheets.get({
      spreadsheetId: config.workbookId,
      fields: "spreadsheetId,sheets(properties,protectedRanges,merges," +
        "developerMetadata)",
    }, REQUEST_OPTIONS)).data;
    if (metadata.spreadsheetId !== config.workbookId) {
      return fail("sheets_workbook_mismatch", "Wrong workbook response.");
    }
    const selected = (metadata.sheets ?? []).filter((sheet) =>
      titles.has(sheet.properties?.title ?? ""));
    const cells = selected.reduce((sum, sheet) =>
      sum + validateSheetSize(sheet), 0);
    if (cells > SHIFT_SHEETS_LIMITS.readCells) {
      return fail("sheets_limit", "Read would exceed the bounded grid limit.");
    }
    if (!selected.length) return metadata;
    const response = (await sheets.get({
      spreadsheetId: config.workbookId,
      ranges: selected.map((sheet) =>
        `${quoteShiftSheetsTitle(sheet.properties?.title ?? "")}!A1:` +
        `${columnName(sheet.properties?.gridProperties?.columnCount ?? 0)}` +
        `${sheet.properties?.gridProperties?.rowCount}`),
      fields: "spreadsheetId,sheets(properties,protectedRanges,merges," +
        "developerMetadata,data(startRow,startColumn,rowData(values(" +
        "userEnteredValue))))",
    }, REQUEST_OPTIONS)).data;
    const incomplete = selected.some((sheet) => {
      const matches = (response.sheets ?? []).filter((read) =>
        read.properties?.sheetId === sheet.properties?.sheetId &&
        read.properties?.title === sheet.properties?.title);
      return matches.length !== 1 ||
        matches[0].properties?.gridProperties?.rowCount !==
          sheet.properties?.gridProperties?.rowCount ||
        matches[0].properties?.gridProperties?.columnCount !==
          sheet.properties?.gridProperties?.columnCount;
    });
    if (response.spreadsheetId !== config.workbookId || incomplete) {
      return fail("sheets_read_incomplete", "An affected tab was not read.");
    }
    // Keep IDs of unaffected tabs so a new addSheet cannot reuse one.
    return {...metadata, sheets: (metadata.sheets ?? []).map((sheet) =>
      response.sheets?.find((read) =>
        read.properties?.sheetId === sheet.properties?.sheetId) ?? sheet)};
  };

  const detached = (operation: OperationInput) => {
    if (!identifier(operation.operationId)) {
      return fail("invalid_sheets_operation", "Operation ID is invalid.");
    }
    const projections = projectionsFor(config, operation.rows);
    return {operationId: operation.operationId, projections,
      projectionDigest: projectionDigestFor(config, projections)};
  };

  const inspectDetached = async (
    operation: ReturnType<typeof detached>,
  ): Promise<ShiftSheetsReadBack> => {
    let read: Spreadsheet;
    try {
      read = await snapshot(operation.projections);
    } catch {
      return {kind: "ambiguous", operationId: operation.operationId,
        reason: "read_back_unavailable"};
    }
    try {
      const actual: Projection[] = [];
      const titles = new Set(operation.projections.map((row) => row.title));
      for (const title of titles) {
        const sheet = read.sheets?.find((item) =>
          item.properties?.title === title);
        if (!sheet || markerFor(sheet)?.metadataValue !== markerValue(
          operation.operationId, operation.projectionDigest,
        )) throw new Error("Operation marker is not current.");
        const rows = gridRows(sheet);
        if (SHIFT_SHEETS_HEADERS.some((header, column) =>
          cellText(rows[0]?.[column]) !== header ||
          rows[0]?.[column]?.userEnteredValue?.formulaValue !== undefined)) {
          throw new Error("Headers changed.");
        }
        const byId = existingRows(rows);
        for (const expected of operation.projections.filter((row) =>
          row.title === title)) {
          const index = byId.get(expected.id);
          if (index === undefined) {
            throw new Error("Projection row is missing.");
          }
          const cells = rows[index] ?? [];
          if (cells.slice(0, SHIFT_SHEETS_HEADERS.length).some((cell) =>
            cell?.userEnteredValue?.formulaValue !== undefined)) {
            throw new Error("Projection cells contain formulas.");
          }
          actual.push({title, id: expected.id, values: SHIFT_SHEETS_HEADERS
            .map((_, column) => cellText(cells[column]))});
        }
      }
      const readBackDigest = projectionDigestFor(config, actual);
      if (readBackDigest !== operation.projectionDigest) {
        throw new Error("Projection read-back differs.");
      }
      return {kind: "verified", operationId: operation.operationId,
        projectionDigest: operation.projectionDigest, readBackDigest};
    } catch {
      return {kind: "ambiguous", operationId: operation.operationId,
        reason: "read_back_mismatch"};
    }
  };

  return {
    inspect: (operation: OperationInput): Promise<ShiftSheetsReadBack> =>
      inspectDetached(detached(operation)),

    async reconcile(operation: OperationInput & {
      authorizeMutation(batch: ShiftSheetsBatchBinding): Promise<void>;
      signal?: AbortSignal;
    }): Promise<ShiftSheetsReadBack> {
      const frozen = detached(operation);
      const read = await snapshot(frozen.projections);
      // Caller-owned arrays may have changed while the snapshot was loading.
      const rows: ShiftSheetsProjectionRow[] = frozen.projections
        .map((row) => ({
          id: row.id,
          type: row.values[1] as ShiftSheetsType,
          date: row.values[2],
          rotationOwnerUserIds: JSON.parse(row.values[4]),
          assignedUserIds: JSON.parse(row.values[5]),
          helperUserId: row.values[6] || null,
          status: row.values[7] as ShiftSheetsProjectionRow["status"],
          source: row.values[8] as ShiftSheetsProjectionRow["source"],
          origin: row.values[9] || null,
        }));
      const plan = planShiftSheetsMerge(config, read, rows);
      const requests = [...plan.requests];
      let replay = false;
      for (const target of plan.sheets) {
        const sheet = read.sheets?.find((item) =>
          item.properties?.sheetId === target.sheetId);
        const marker = sheet ? markerFor(sheet) : null;
        const value = markerValue(frozen.operationId, plan.projectionDigest);
        if (marker) {
          let prior: {operationId?: string};
          try {
            prior = JSON.parse(marker.metadataValue ?? "");
          } catch {
            return fail(
              "sheets_marker_conflict", "Operation marker is invalid.",
            );
          }
          if (prior.operationId === frozen.operationId) {
            if (marker.metadataValue !== value) {
              return fail("sheets_marker_conflict", "Operation ID was reused.");
            }
            replay = true;
          }
          requests.push({updateDeveloperMetadata: {
            dataFilters: [{developerMetadataLookup: {
              metadataId: marker.metadataId,
            }}],
            developerMetadata: {metadataValue: value}, fields: "metadataValue",
          }});
        } else {
          requests.push({createDeveloperMetadata: {developerMetadata: {
            metadataKey: MARKER_KEY, metadataValue: value,
            location: {sheetId: target.sheetId}, visibility: "DOCUMENT",
          }}});
        }
      }
      // Any retained marker means this is recovery, never a reason to resend.
      if (replay) return inspectDetached(frozen);
      if (Buffer.byteLength(JSON.stringify({requests}), "utf8") >
        SHIFT_SHEETS_LIMITS.requestBytes) {
        return fail(
          "sheets_limit", "Sheets batch exceeds the admission limit.",
        );
      }
      await operation.authorizeMutation({
        workbookId: config.workbookId,
        projectionDigest: plan.projectionDigest,
        requestDigest: digest({requests}),
      });
      if (operation.signal?.aborted) {
        return fail(
          "sheets_submission_aborted", "Sheets submission was aborted.",
        );
      }
      try {
        await sheets.batchUpdate({
          spreadsheetId: config.workbookId, requestBody: {requests},
        }, {...REQUEST_OPTIONS, signal: operation.signal});
      } catch {
        // An SDK exception does not prove the server rejected or stopped it.
        return inspectDetached(frozen);
      }
      return inspectDetached(frozen);
    },
  };
};
