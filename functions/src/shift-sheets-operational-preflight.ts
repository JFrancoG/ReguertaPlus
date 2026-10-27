import type {drive_v3 as DriveV3, sheets_v4 as SheetsV4} from "googleapis";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {createShiftSheetsWorkbookVersionReader} from
  "./shift-planning-sheets-consumer.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {readShiftSheetsSnapshot} from "./shift-sheets.js";

export const SHIFT_SHEETS_OPERATIONAL_PREFLIGHT_BLOCKERS = Object.freeze([
  "control_plane_unavailable",
  "workbook_human_offline_editors_unverified",
  "workbook_apps_script_addons_unverified",
  "workbook_api_oauth_service_accounts_unverified",
  "workbook_inherited_admin_authority_unverified",
  "workbook_owner_fence_unverified",
  "workbook_shared_drive_authority_unverified",
  "workbook_owner_inventory_mismatch",
  "observer_cannot_modify_content",
  "managed_tabs_have_protections",
] as const);

type Blocker = typeof SHIFT_SHEETS_OPERATIONAL_PREFLIGHT_BLOCKERS[number];
type PrincipalKind = "serviceAccount" | "user" | "unknown";
type JsonRecord = Record<string, unknown>;

export type ShiftSheetsOperationalPreflightSummary = {
  schemaVersion: 1;
  environment: ShiftSheetsConfig["environment"];
  canApply: false;
  observedAtMillis: number;
  workbookVersionBefore: string;
  workbookVersionAfter: string;
  observationPrincipalKind: PrincipalKind;
  selectedTabCount: number;
  permissionCount: number;
  ownerCount: number | null;
  contentDigest: string;
  aclDigest: string;
  protectionsDigest: string;
  observationDigest: string;
  blockers: readonly Blocker[];
};

/** Fixed diagnostics prevent Google errors from reflecting account data. */
export class ShiftSheetsOperationalPreflightError extends Error {
  /**
   * @param {string} code Stable, non-sensitive rejection category.
   */
  constructor(readonly code: string) {
    super("Workbook operational observation could not be verified.");
    this.name = "ShiftSheetsOperationalPreflightError";
  }
}

const fail = (code: string): never => {
  throw new ShiftSheetsOperationalPreflightError(code);
};
const options = {retry: false, timeout: 15000} as const;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const digest = createShiftPlanningDigest;
const record = (value: unknown): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("workbook_observation_invalid");
  }
  return value as JsonRecord;
};
const text = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 8192) {
    return fail("workbook_observation_invalid");
  }
  return value;
};
const boolean = (value: unknown): boolean | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") return fail("workbook_observation_invalid");
  return value;
};
const integer = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return fail("workbook_observation_invalid");
  }
  return value as number;
};
const texts = (value: unknown): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return fail("workbook_observation_invalid");
  return value.map((item) => text(item) ??
    fail("workbook_observation_invalid")).sort(compare);
};
const list = (value: unknown): unknown[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return fail("workbook_observation_invalid");
  return Array.from(value);
};
const user = (value: unknown) => {
  const item = record(value);
  return {permissionId: text(item.permissionId),
    emailAddress: text(item.emailAddress), me: boolean(item.me)};
};
const range = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const item = record(value);
  return Object.fromEntries(["sheetId", "startRowIndex", "endRowIndex",
    "startColumnIndex", "endColumnIndex"].map((key) =>
    [key, integer(item[key])]));
};
const protection = (value: unknown) => {
  const item = record(value);
  const editors = item.editors ? record(item.editors) : {};
  return {protectedRangeId: integer(item.protectedRangeId),
    range: range(item.range), namedRangeId: text(item.namedRangeId),
    tableId: text(item.tableId), description: text(item.description),
    warningOnly: boolean(item.warningOnly),
    requestingUserCanEdit: boolean(item.requestingUserCanEdit),
    unprotectedRanges: list(item.unprotectedRanges).map(range),
    editors: {users: texts(editors.users), groups: texts(editors.groups),
      domainUsersCanEdit: boolean(editors.domainUsersCanEdit)}};
};
const cell = (value: unknown) => {
  if (value === undefined || value === null) return {};
  const item = record(value);
  const entered = item.userEnteredValue ? record(item.userEnteredValue) : {};
  const result: JsonRecord = {};
  for (const key of ["stringValue", "formulaValue", "boolValue",
    "numberValue"]) {
    const scalar = entered[key];
    if (scalar === undefined || scalar === null) continue;
    if ((key === "boolValue" && typeof scalar !== "boolean") ||
      (key === "numberValue" &&
        (typeof scalar !== "number" || !Number.isFinite(scalar))) ||
      (["stringValue", "formulaValue"].includes(key) &&
        typeof scalar !== "string")) {
      return fail("workbook_observation_invalid");
    }
    result[key] = scalar;
  }
  if (Object.keys(result).length > 1) {
    return fail("workbook_observation_invalid");
  }
  return result;
};
const sheet = (value: unknown, includeData: boolean) => {
  const item = record(value); const properties = record(item.properties);
  const grid = properties.gridProperties ?
    record(properties.gridProperties) : {};
  return {properties: {sheetId: integer(properties.sheetId),
    title: text(properties.title), sheetType: text(properties.sheetType),
    index: integer(properties.index), hidden: boolean(properties.hidden),
    gridProperties: Object.fromEntries(["rowCount", "columnCount",
      "frozenRowCount", "frozenColumnCount"].map((key) =>
      [key, integer(grid[key])]))},
  protectedRanges: list(item.protectedRanges).map(protection),
  merges: list(item.merges).map(range),
  developerMetadata: list(item.developerMetadata).map((value) => {
    const meta = record(value);
    const location = meta.location ? record(meta.location) : {};
    const dimension = location.dimensionRange ?
      record(location.dimensionRange) : {};
    return {metadataId: integer(meta.metadataId),
      metadataKey: text(meta.metadataKey),
      metadataValue: text(meta.metadataValue),
      visibility: text(meta.visibility), location: {
        spreadsheet: boolean(location.spreadsheet),
        sheetId: integer(location.sheetId), dimensionRange: {
          sheetId: integer(dimension.sheetId),
          dimension: text(dimension.dimension),
          startIndex: integer(dimension.startIndex),
          endIndex: integer(dimension.endIndex)}}};
  }),
  data: includeData ? list(item.data).map((value) => {
    const data = record(value);
    return {startRow: integer(data.startRow) ?? 0,
      startColumn: integer(data.startColumn) ?? 0,
      rowData: list(data.rowData).map((value) => ({values:
        list(value ? record(value).values : undefined).map(cell)}))};
  }) : []};
};
const permission = (value: unknown) => {
  const item = record(value);
  const id = text(item.id);
  const type = text(item.type);
  const role = text(item.role);
  if (!id || !["user", "group", "domain", "anyone"].includes(type ?? "") ||
    !["owner", "organizer", "fileOrganizer", "writer", "commenter", "reader"]
      .includes(role ?? "")) return fail("workbook_permissions_invalid");
  return {id, type, role, emailAddress: text(item.emailAddress),
    domain: text(item.domain), deleted: boolean(item.deleted),
    allowFileDiscovery: boolean(item.allowFileDiscovery),
    expirationTime: text(item.expirationTime),
    pendingOwner: boolean(item.pendingOwner),
    permissionDetails: list(item.permissionDetails).map((value) => {
      const detail = record(value);
      return {permissionType: text(detail.permissionType),
        role: text(detail.role), inherited: boolean(detail.inherited),
        inheritedFrom: text(detail.inheritedFrom)};
    })};
};

/**
 * Captures a version-bound read observation, never an exclusion checkpoint.
 * ACLs describe visible grants and capabilities belong to this observer only.
 * Owners, offline edits, scripts, OAuth and inherited authority stay unproven;
 * no caller declaration can turn this result into permission to mutate.
 * Private observations contain identities and cells and must not be returned
 * or logged by an HTTP boundary. Only the separate summary is wire-safe.
 * @param {object} input Frozen config and read-only public Google resources.
 * @return {Promise<object>} Private evidence and a blocked sanitized summary.
 */
export const observeShiftSheetsWorkbook = async (input: {
  config: ShiftSheetsConfig;
  titles: readonly string[];
  files: Pick<DriveV3.Resource$Files, "get">;
  permissions: Pick<DriveV3.Resource$Permissions, "list">;
  about: Pick<DriveV3.Resource$About, "get">;
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get">;
  nowMillis(): number;
  expectedContentDigest?: string;
}) => {
  const config = {...input.config, aliases: input.config.aliases.map((a) =>
    ({...a}))};
  const titles = [...input.titles];
  const expectedContentDigest = input.expectedContentDigest;
  if (new Set(titles).size !== titles.length) {
    return fail("workbook_selected_tabs_invalid");
  }
  const readVersion = createShiftSheetsWorkbookVersionReader({
    workbookId: config.workbookId, files: input.files});
  const readFile = async () => {
    const {data} = await input.files.get({fileId: config.workbookId,
      supportsAllDrives: true, fields: "id,mimeType,trashed,version," +
        "driveId,parents,owners(permissionId,emailAddress,me)," +
        "capabilities(canEdit,canModifyContent,canShare,canReadRevisions)"},
    options);
    const capabilities = data.capabilities ?? {};
    return {id: text(data.id), mimeType: text(data.mimeType),
      trashed: boolean(data.trashed), version: text(data.version),
      driveId: text(data.driveId), parents: texts(data.parents),
      owners: list(data.owners).map(user).sort((a, b) =>
        compare(a.permissionId ?? "", b.permissionId ?? "")), capabilities: {
        canEdit: boolean(capabilities.canEdit),
        canModifyContent: boolean(capabilities.canModifyContent),
        canShare: boolean(capabilities.canShare),
        canReadRevisions: boolean(capabilities.canReadRevisions)}};
  };
  let versionBefore: string; let versionAfter: string;
  let before: Awaited<ReturnType<typeof readFile>>;
  let after: Awaited<ReturnType<typeof readFile>>;
  let principal: ReturnType<typeof user>;
  let snapshot: SheetsV4.Schema$Spreadsheet;
  const permissions: ReturnType<typeof permission>[] = [];
  try {
    versionBefore = await readVersion();
    before = await readFile();
    const about = await input.about.get({fields:
      "user(permissionId,emailAddress,me)"}, options);
    principal = user(about.data.user);
    if (!principal.permissionId || !principal.emailAddress ||
      !/^[^\s@]+@[^\s@]+$/.test(principal.emailAddress)) {
      return fail("workbook_observer_identity_unavailable");
    }
    const seen = new Set<string>();
    let pageToken: string | undefined;
    let pages = 0;
    do {
      pages++;
      if (pages > 500) return fail("workbook_permissions_incomplete");
      const response = await input.permissions.list({fileId: config.workbookId,
        supportsAllDrives: true, pageSize: 100, pageToken, fields:
          "nextPageToken,permissions(id,type,role,emailAddress,domain," +
          "deleted,allowFileDiscovery,expirationTime,pendingOwner," +
          "permissionDetails(permissionType,role,inherited,inheritedFrom))"},
      options);
      permissions.push(...list(response.data.permissions).map(permission));
      if (permissions.length > 500) {
        return fail("workbook_permissions_incomplete");
      }
      const next = text(response.data.nextPageToken);
      if (next && (seen.has(next) || permissions.length >= 500)) {
        return fail("workbook_permissions_incomplete");
      }
      if (next) seen.add(next);
      pageToken = next ?? undefined;
    } while (pageToken);
    if (new Set(permissions.map((p) => p.id)).size !== permissions.length) {
      return fail("workbook_permissions_incomplete");
    }
    permissions.sort((a, b) => compare(a.id, b.id));
    snapshot = await readShiftSheetsSnapshot({config,
      sheets: input.sheets, titles});
    after = await readFile();
    versionAfter = await readVersion();
  } catch (error) {
    if (error instanceof ShiftSheetsOperationalPreflightError) throw error;
    return fail("workbook_observation_unavailable");
  }
  if (before.id !== config.workbookId || after.id !== config.workbookId ||
    before.mimeType !== "application/vnd.google-apps.spreadsheet" ||
    after.mimeType !== before.mimeType || before.trashed !== false ||
    after.trashed !== false || before.version !== versionBefore ||
    after.version !== versionBefore || versionAfter !== versionBefore ||
    digest(before) !== digest(after)) {
    return fail("workbook_observation_changed");
  }
  const normalized = {spreadsheetId: config.workbookId,
    sheets: list(snapshot.sheets).map((value) => {
      const title = text(record(record(value).properties).title);
      return sheet(value, titles.includes(title ?? ""));
    }).sort((a, b) => compare(a.properties.title ?? "",
      b.properties.title ?? ""))};
  const selected = normalized.sheets.filter((s) =>
    titles.includes(s.properties.title ?? ""));
  if (selected.length !== titles.length) {
    return fail("workbook_selected_tabs_missing");
  }
  const contentDigest = digest(selected.map((s) =>
    ({properties: s.properties, data: s.data})));
  if (expectedContentDigest !== undefined &&
    expectedContentDigest !== contentDigest) {
    return fail("workbook_content_changed");
  }
  const observedAtMillis = input.nowMillis();
  if (!Number.isSafeInteger(observedAtMillis) || observedAtMillis < 0) {
    return fail("workbook_observation_clock_invalid");
  }
  const aclDigest = digest({principal, file: before, permissions});
  const protectionsDigest = digest(normalized.sheets.map((s) =>
    ({sheetId: s.properties.sheetId, protectedRanges: s.protectedRanges,
      merges: s.merges})));
  const observationPrincipalKind: PrincipalKind =
    principal.emailAddress?.endsWith(".gserviceaccount.com") ?
      "serviceAccount" : principal.emailAddress ? "user" : "unknown";
  const ownerPermissions = permissions.filter((p) => p.role === "owner");
  let ownerCount: number | null = null;
  const blockers: Blocker[] = [...SHIFT_SHEETS_OPERATIONAL_PREFLIGHT_BLOCKERS
    .slice(0, 5)];
  if (before.driveId) {
    blockers.push("workbook_shared_drive_authority_unverified");
  } else {
    blockers.push("workbook_owner_fence_unverified");
    if (before.owners.length === 0 || ownerPermissions.length === 0 ||
      digest(before.owners.map((owner) => owner.permissionId).sort()) !==
        digest(ownerPermissions.map((owner) => owner.id).sort())) {
      blockers.push("workbook_owner_inventory_mismatch");
    } else {
      ownerCount = ownerPermissions.length;
    }
  }
  if (before.capabilities.canEdit !== true ||
    before.capabilities.canModifyContent !== true) {
    blockers.push("observer_cannot_modify_content");
  }
  if (selected.some((s) => s.protectedRanges.length > 0)) {
    blockers.push("managed_tabs_have_protections");
  }
  const privateBody = {schemaVersion: 1, environment: config.environment,
    workbookVersionBefore: versionBefore, workbookVersionAfter: versionAfter,
    observedAtMillis, principal, file: before, permissions,
    snapshot: normalized,
    contentDigest, aclDigest, protectionsDigest};
  const observationDigest = digest(privateBody);
  const summary: ShiftSheetsOperationalPreflightSummary = {
    schemaVersion: 1, environment: config.environment, canApply: false,
    observedAtMillis, workbookVersionBefore: versionBefore,
    workbookVersionAfter: versionAfter, observationPrincipalKind,
    selectedTabCount: selected.length, permissionCount: permissions.length,
    ownerCount,
    contentDigest, aclDigest, protectionsDigest, observationDigest, blockers,
  };
  return {privateObservation: {...privateBody, observationDigest}, summary};
};
