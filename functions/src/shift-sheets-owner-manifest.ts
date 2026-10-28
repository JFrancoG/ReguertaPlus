import {createHash} from "node:crypto";
import {canonicalShiftPlanningJson, createShiftPlanningDigest as digest} from
  "./shift-planning-digest.js";
import {ShiftSheetsError} from "./shift-sheets-config.js";
import {SHIFT_SHEETS_LIMITS} from "./shift-sheets.js";

type Data = Record<string, unknown>;
type Write = {sheetId: number; row: number; column: number; value: unknown};
type Policy = {existing: number[]; covered: number[]; additions: Data[];
  resizes: Data[]; writes: Write[]; creates: Data[]; updates: Data[]};
export type ShiftSheetsOwnerPreservationManifest = {
  schemaVersion: 1; workbookId: string; requestDigest: string;
  beforeDigest: string; preservationDigest: string; policy: Policy;
  digest: string;
};
const markerKey = "reguerta.shiftSheets.v1";
const fail = (): never => {
  throw new ShiftSheetsError("sheets_owner_preservation_rejected",
    "Workbook preservation could not be verified.");
};
const record = (value: unknown): Data => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype) return fail();
  return value as Data;
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return fail();
  return value;
};
const integer = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return fail();
  return value as number;
};
const exact = (value: Data, keys: string[]): void => {
  if (Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))) fail();
};
const same = (a: unknown, b: unknown): boolean => digest(a) === digest(b);
const detached = <T>(value: T): T =>
  JSON.parse(canonicalShiftPlanningJson(value)) as T;
const clean = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) =>
    item !== null && item !== undefined).map(([key, item]) =>
    [key, clean(item)]).filter(([, item]) =>
    typeof item !== "object" || item === null ||
    Object.keys(item).length > 0));
};
const entered = (value: unknown): unknown => {
  const item = record(value ?? {});
  if (!Object.keys(item).length ||
    same(item, {stringValue: ""})) return {};
  if (Object.keys(item).length !== 1 ||
    !["stringValue", "numberValue", "boolValue", "formulaValue"]
      .includes(Object.keys(item)[0])) return fail();
  const key = Object.keys(item)[0];
  if ((key === "numberValue" && (typeof item[key] !== "number" ||
      !Number.isFinite(item[key]))) ||
    (key === "boolValue" && typeof item[key] !== "boolean") ||
    (["stringValue", "formulaValue"].includes(key) &&
      typeof item[key] !== "string")) return fail();
  return clean(item);
};
const sheetId = (sheet: unknown): number =>
  integer(record(record(sheet).properties).sheetId);
const sheets = (snapshot: unknown): Data[] => {
  const result = list(record(snapshot).sheets).map(record);
  if (result.length > 1000 ||
    new Set(result.map(sheetId)).size !== result.length) return fail();
  return result;
};
const dimensions = (properties: Data): Data => {
  const grid = record(properties.gridProperties);
  const rows = integer(grid.rowCount);
  const columns = integer(grid.columnCount);
  if (!rows || !columns || rows > SHIFT_SHEETS_LIMITS.tabRows ||
    columns > SHIFT_SHEETS_LIMITS.tabColumns) return fail();
  return grid;
};
const metadata = (sheet: Data): Data[] =>
  list(sheet.developerMetadata).map(record);
const cells = (sheet: Data): Map<string, Data> => {
  const output = new Map<string, Data>();
  const grid = dimensions(record(sheet.properties));
  for (const block of list(sheet.data).map(record)) {
    const rowStart = integer(block.startRow ?? 0);
    const columnStart = integer(block.startColumn ?? 0);
    list(block.rowData).map(record).forEach((row, y) => {
      list(row.values).map(record).forEach((cell, x) => {
        const r = rowStart + y;
        const c = columnStart + x;
        const key = `${r}:${c}`;
        if (r >= (grid.rowCount as number) ||
          c >= (grid.columnCount as number) || output.has(key)) fail();
        output.set(key, record(clean(cell)));
      });
    });
  }
  return output;
};

const compile = (before: unknown, requests: readonly unknown[]): Policy => {
  const beforeSheets = sheets(before);
  const policy: Policy = {existing: beforeSheets.map(sheetId).sort((a, b) =>
    a - b), covered: beforeSheets.filter((sheet) =>
    sheet.dataCoverage === "complete").map(sheetId), additions: [],
  resizes: [], writes: [], creates: [], updates: []};
  const properties = new Map(beforeSheets.map((sheet) =>
    [sheetId(sheet), detached(record(sheet.properties))]));
  const knownMetadata = new Map(beforeSheets.flatMap((sheet) =>
    metadata(sheet).map((item) => [integer(item.metadataId), item] as const)));
  if (knownMetadata.size !== beforeSheets.flatMap(metadata).length) {
    return fail();
  }
  if (!requests.length || Buffer.byteLength(JSON.stringify({requests})) >
    SHIFT_SHEETS_LIMITS.requestBytes) return fail();
  for (const raw of requests) {
    const request = record(raw);
    const keys = Object.keys(request);
    if (keys.length !== 1) return fail();
    const value = record(request[keys[0]]);
    if (keys[0] === "addSheet") {
      exact(value, ["properties"]);
      const props = record(value.properties);
      exact(props, ["sheetId", "title", "gridProperties"]);
      const id = integer(props.sheetId);
      exact(record(props.gridProperties), ["rowCount", "columnCount"]);
      dimensions(props);
      if (properties.has(id) || typeof props.title !== "string" ||
        !props.title || [...properties.values()].some((item) =>
        item.title === props.title)) return fail();
      const added = {...detached(props), index: properties.size,
        sheetType: "GRID", hidden: false};
      policy.additions.push(added);
      properties.set(id, added);
      policy.covered.push(id);
    } else if (keys[0] === "updateSheetProperties") {
      exact(value, ["properties", "fields"]);
      if (value.fields !==
        "gridProperties.rowCount,gridProperties.columnCount") {
        return fail();
      }
      const props = record(value.properties);
      exact(props, ["sheetId", "gridProperties"]);
      exact(record(props.gridProperties), ["rowCount", "columnCount"]);
      const id = integer(props.sheetId);
      const prior = properties.get(id);
      if (!prior || !policy.covered.includes(id)) return fail();
      const grid = dimensions(props);
      const old = dimensions(prior);
      if ((grid.rowCount as number) < (old.rowCount as number) ||
        (grid.columnCount as number) < (old.columnCount as number) ||
        policy.resizes.some((item) => item.sheetId === id)) return fail();
      policy.resizes.push(detached(props));
      properties.set(id, {...prior, gridProperties: {...old, ...grid}});
    } else if (keys[0] === "updateCells") {
      exact(value, ["range", "rows", "fields"]);
      if (value.fields !== "userEnteredValue") return fail();
      const range = record(value.range);
      exact(range, ["sheetId", "startRowIndex", "endRowIndex",
        "startColumnIndex", "endColumnIndex"]);
      const id = integer(range.sheetId);
      const props = properties.get(id);
      if (!props || !policy.covered.includes(id)) return fail();
      const grid = dimensions(props);
      const start = integer(range.startRowIndex);
      const end = integer(range.endRowIndex);
      const left = integer(range.startColumnIndex);
      const right = integer(range.endColumnIndex);
      const rows = list(value.rows).map(record);
      if (end <= start || right <= left ||
        end > (grid.rowCount as number) ||
        right > (grid.columnCount as number) || rows.length !== end - start) {
        return fail();
      }
      rows.forEach((row, y) => {
        exact(row, ["values"]);
        const values = list(row.values).map(record);
        if (values.length !== right - left) fail();
        values.forEach((cell, x) => {
          if (Object.keys(cell).some((key) => key !== "userEnteredValue")) {
            fail();
          }
          if (policy.writes.some((write) => write.sheetId === id &&
            write.row === start + y && write.column === left + x)) fail();
          policy.writes.push({sheetId: id, row: start + y, column: left + x,
            value: entered(cell.userEnteredValue)});
        });
      });
    } else if (keys[0] === "createDeveloperMetadata") {
      exact(value, ["developerMetadata"]);
      const item = record(value.developerMetadata);
      exact(item, ["metadataKey", "metadataValue", "location", "visibility"]);
      exact(record(item.location), ["sheetId"]);
      const id = integer(record(item.location).sheetId);
      if (!properties.has(id) || !policy.covered.includes(id) ||
        item.metadataKey !== markerKey ||
        item.visibility !== "DOCUMENT" ||
        typeof item.metadataValue !== "string" ||
        [...knownMetadata.values()].some((prior) =>
          prior.metadataKey === markerKey &&
          record(prior.location).sheetId === id) ||
        policy.creates.some((prior) =>
          record(prior.location).sheetId === id)) return fail();
      policy.creates.push(detached(item));
    } else if (keys[0] === "updateDeveloperMetadata") {
      exact(value, ["dataFilters", "developerMetadata", "fields"]);
      if (value.fields !== "metadataValue") return fail();
      const filters = list(value.dataFilters).map(record);
      if (filters.length !== 1) return fail();
      exact(filters[0], ["developerMetadataLookup"]);
      const lookup = record(filters[0].developerMetadataLookup);
      exact(lookup, ["metadataId"]);
      const id = integer(lookup.metadataId);
      const previous = knownMetadata.get(id);
      const update = record(value.developerMetadata);
      exact(update, ["metadataValue"]);
      if (!previous || previous.metadataKey !== markerKey ||
        !policy.covered.includes(integer(record(previous.location).sheetId)) ||
        typeof update.metadataValue !== "string" ||
        policy.updates.some((item) => item.metadataId === id)) return fail();
      policy.updates.push({metadataId: id, ...update});
    } else return fail();
  }
  return policy;
};

const fingerprint = (snapshot: unknown, policy: Policy, after: boolean) => {
  const observed = sheets(snapshot);
  const expectedIds = [...policy.existing, ...(after ?
    policy.additions.map((props) => integer(props.sheetId)) : [])]
    .sort((a, b) => a - b);
  if (!same(observed.map(sheetId).sort((a, b) => a - b), expectedIds)) {
    return fail();
  }
  const output = observed.map((sheet) => {
    const id = sheetId(sheet);
    const copy = detached(sheet);
    const props = record(copy.properties);
    const added = policy.additions.find((item) => item.sheetId === id);
    const resize = policy.resizes.find((item) => item.sheetId === id);
    if (resize) {
      const grid = dimensions(props);
      const target = record(resize.gridProperties);
      if (after && (grid.rowCount !== target.rowCount ||
        grid.columnCount !== target.columnCount)) return fail();
      grid.rowCount = "authorized";
      grid.columnCount = "authorized";
    }
    let entries = metadata(copy);
    if (after) {
      entries = entries.filter((item) => {
        const create = policy.creates.find((expected) =>
          same(clean(item.location), expected.location) &&
        item.metadataKey === expected.metadataKey);
        if (!create) return true;
        integer(item.metadataId);
        const {metadataId: ignored, ...rest} = item;
        void ignored;
        if (!same(clean(rest), create)) return fail();
        return false;
      });
    }
    for (const update of policy.updates) {
      const matches = entries.filter((item) =>
        item.metadataId === update.metadataId);
      // Metadata belonging to a different tab is checked there.
      if (matches.length > 1) return fail();
      if (matches.length) {
        if (after && matches[0].metadataValue !== update.metadataValue) {
          return fail();
        }
        matches[0].metadataValue = "authorized";
      }
    }
    copy.developerMetadata = entries.sort((a, b) =>
      integer(a.metadataId) - integer(b.metadataId));
    if (policy.covered.includes(id)) {
      if (copy.dataCoverage !== "complete") return fail();
      const values = cells(sheet);
      for (const write of policy.writes.filter((item) => item.sheetId === id)) {
        const key = `${write.row}:${write.column}`;
        const cell = values.get(key) ?? {};
        if (after && !same(entered(cell.userEnteredValue), write.value)) {
          return fail();
        }
        delete cell.userEnteredValue;
        values.set(key, cell);
      }
      copy.data = [...values.entries()].filter(([, value]) =>
        Object.keys(value).length).sort(([a], [b]) => a.localeCompare(b));
    } else if (copy.dataCoverage !== "metadata-only") return fail();
    if (added) {
      const expectedGrid = record(resize?.gridProperties ??
        added.gridProperties);
      const original = record(sheet.properties);
      const actualGrid = record(original.gridProperties);
      const normalized = {...original, hidden: original.hidden ?? false,
        sheetType: original.sheetType ?? "GRID", gridProperties: {
          ...actualGrid, frozenRowCount: actualGrid.frozenRowCount ?? 0,
          frozenColumnCount: actualGrid.frozenColumnCount ?? 0}};
      const expected = {...added, gridProperties: {...expectedGrid,
        frozenRowCount: 0, frozenColumnCount: 0}};
      if (!same(normalized, expected) || list(copy.protectedRanges).length ||
        list(copy.merges).length || list(copy.developerMetadata).length ||
        list(copy.data).length) return fail();
      return null;
    }
    return copy;
  }).filter((item) => item !== null).sort((a, b) => sheetId(a) - sheetId(b));
  if (after) {
    for (const create of policy.creates) {
      const matches = observed.flatMap(metadata).filter((item) =>
        item.metadataKey === create.metadataKey &&
      same(clean(item.location), create.location));
      if (matches.length !== 1) return fail();
    }
  }
  return digest({spreadsheetId: record(snapshot).spreadsheetId,
    sheets: output});
};

/**
 * Compiles only the five request shapes emitted by the shift adapter. Complete
 * selected grids preserve entered formats, notes, rich text and validation;
 * metadata-only tabs never imply that their unobserved cells were checked.
 * Managed values, known dimension changes and operation metadata are verified
 * exactly after the batch; every other observed surface must stay identical.
 * @param {object} input Detached bounded observation and exact physical batch.
 * @return {ShiftSheetsOwnerPreservationManifest} Persistable sealed manifest.
 */
export const createShiftSheetsOwnerPreservationManifest = (input: {
  before: unknown; requests: readonly unknown[];
}): ShiftSheetsOwnerPreservationManifest => {
  const before = detached(input.before);
  const requests = detached(input.requests);
  const workbookId = record(before).spreadsheetId;
  if (typeof workbookId !== "string" || !workbookId) return fail();
  const policy = compile(before, requests);
  const body = {schemaVersion: 1 as const, workbookId,
    requestDigest: "shift-sheets:v1:sha256:" + createHash("sha256")
      .update(JSON.stringify({requests: input.requests})).digest("hex"),
    beforeDigest: digest(before), policy,
    preservationDigest: fingerprint(before, policy, false)};
  return {...body, digest: digest(body)};
};

/**
 * Read-only assertion; a failure never permits retrying the external batch.
 * @param {object} input Persisted manifest and a fresh complete observation.
 */
export const assertShiftSheetsOwnerPreservation = (input: {
  manifest: ShiftSheetsOwnerPreservationManifest; after: unknown;
}): void => {
  const manifest = parseShiftSheetsOwnerPreservationManifest(input.manifest);
  if (record(input.after).spreadsheetId !== manifest.workbookId ||
    fingerprint(input.after, manifest.policy, true) !==
      manifest.preservationDigest) fail();
};

/**
 * Parses the compact persisted manifest. Its digest must also be bound by the
 * reviewed owner agreement; a self-consistent hash is not authorization.
 * @param {unknown} value Private persisted manifest.
 * @return {ShiftSheetsOwnerPreservationManifest} Detached exact manifest.
 */
export const parseShiftSheetsOwnerPreservationManifest = (
  value: unknown,
): ShiftSheetsOwnerPreservationManifest => {
  const item = record(detached(value));
  exact(item, ["schemaVersion", "workbookId", "requestDigest", "beforeDigest",
    "preservationDigest", "policy", "digest"]);
  const {digest: expected, ...body} = item;
  if (item.schemaVersion !== 1 || typeof item.workbookId !== "string" ||
    !item.workbookId || expected !== digest(body) ||
    typeof item.requestDigest !== "string" ||
    !/^shift-sheets:v1:sha256:[a-f0-9]{64}$/.test(item.requestDigest) ||
    [item.beforeDigest, item.preservationDigest].some((hash) =>
      typeof hash !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(hash))) return fail();
  const policy = record(item.policy);
  exact(policy, ["existing", "covered", "additions", "resizes", "writes",
    "creates", "updates"]);
  for (const key of ["existing", "covered"]) {
    const values = list(policy[key]).map(integer);
    if (values.length > 1000 || new Set(values).size !== values.length) fail();
  }
  for (const key of ["additions", "resizes", "creates", "updates"]) {
    if (list(policy[key]).length > 1000) fail();
    list(policy[key]).forEach(record);
  }
  if (list(policy.writes).length > SHIFT_SHEETS_LIMITS.readCells) fail();
  for (const value of list(policy.writes).map(record)) {
    exact(value, ["sheetId", "row", "column", "value"]);
    integer(value.sheetId);
    if (integer(value.row) >= SHIFT_SHEETS_LIMITS.tabRows ||
      integer(value.column) >= SHIFT_SHEETS_LIMITS.tabColumns) fail();
    entered(value.value);
  }
  return item as ShiftSheetsOwnerPreservationManifest;
};
