"use strict";

// No ADC, owner write scope, arbitrary destination or automatic retry.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const FILE = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
const PARENT = "0AK7v8_RQogQlUk9PVA";
const OWNER = "testplusprojects@gmail.com";
const WRITER = "reguerta-develop-sheets-writer@reguerta-9f27f.iam.gserviceaccount.com";
const PERMISSION = "06575248221544440100";
const TABS = Object.freeze([
  [673721152, "turnos-reparto 2026-27"], [300742320, "turnos-mercado 2026-27"],
  [769128650, "turnos-reparto 2027-28"], [1735509106, "turnos-mercado 2027-28"],
  [1770956648, "TORRE 2025-26"], [448800119, "MERCADO 2025-26"],
].map(([id, title]) => Object.freeze({id, title})));
const REQUEST = () => ({requests: [{updateCells: {start: {sheetId: TABS[0].id, rowIndex: 0, columnIndex: 0},
  rows: [{values: [{userEnteredValue: {stringValue: "Fecha"}}]}], fields: "userEnteredValue"}}]});
const READERS = ["drpuerk@gmail.com", "195744802339-compute@developer.gserviceaccount.com",
  "firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com",
  "reguerta-shifts-inspector@reguerta-9f27f.iam.gserviceaccount.com"].sort();
const DRIVE = "https://www.googleapis.com/drive/v3/files/";
const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${FILE}`;
const FILE_FIELDS = "id,mimeType,trashed,version,parents,driveId,owners(emailAddress,permissionId,me),contentRestrictions,capabilities(canEdit,canModifyContent,canShare)";
const PERMISSION_FIELDS = "nextPageToken,permissions(id,type,role,emailAddress,deleted,pendingOwner,expirationTime,permissionDetails)";

async function request(fetchImpl, bearer, url, method = "GET", body) {
  assert.ok(typeof bearer === "string" && bearer.length > 0);
  const response = await fetchImpl(url, {method, redirect: "error", signal: AbortSignal.timeout(15000),
    headers: {Authorization: `Bearer ${bearer}`, "Content-Type": "application/json"},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  let data = null;
  try { data = await response.json(); } catch { /* Unknown, never infer success. */ }
  return {status: response.status, data};
}
function ok(result) {
  if (result.status !== 200 || !result.data) throw Object.assign(Error("Scoped request failed"), {httpStatus: result.status});
  return result.data;
}
const query = (url, entries) => url + "?" + new URLSearchParams(entries);

async function readMetadata(fetchImpl, bearer, includeParent = true) {
  const file = id => request(fetchImpl, bearer, query(DRIVE + id, {fields: FILE_FIELDS})).then(ok);
  async function permissions(id) {
    const result = [], seen = new Set();
    let pageToken = "";
    do {
      assert.ok(!seen.has(pageToken) && seen.size < 10, "Permission pagination incomplete"); seen.add(pageToken);
      const data = ok(await request(fetchImpl, bearer, query(DRIVE + id + "/permissions",
        {fields: PERMISSION_FIELDS, pageSize: "100", ...(pageToken ? {pageToken} : {})})));
      assert.ok(Array.isArray(data.permissions)); result.push(...data.permissions);
      pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    assert.equal(new Set(result.map(p => p.id)).size, result.length);
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }
  const before = await file(FILE);
  assert.deepEqual(before.parents, [PARENT], "Unexpected parent is never queried");
  const filePermissions = await permissions(FILE);
  const parent = includeParent ? await file(PARENT) : undefined;
  const parentPermissions = includeParent ? await permissions(PARENT) : undefined;
  const after = await file(FILE);
  assert.deepEqual(after, before, "Metadata changed during observation");
  return {file: before, filePermissions, ...(includeParent ? {parent, parentPermissions} : {})};
}

function validateMetadata(value, writerPresent) {
  const f = value.file, p = value.parent;
  assert.equal(f.id, FILE); assert.equal(f.mimeType, "application/vnd.google-apps.spreadsheet");
  assert.equal(f.trashed, false); assert.match(f.version, /^\d+$/);
  assert.deepEqual(f.parents, [PARENT]); assert.ok(!f.driveId); assert.deepEqual(f.contentRestrictions ?? [], []);
  assert.equal(f.owners.length, 1); assert.equal(f.owners[0].emailAddress, OWNER);
  assert.equal(p.id, PARENT); assert.equal(p.mimeType, "application/vnd.google-apps.folder");
  assert.equal(p.trashed, false); assert.ok(!p.driveId); assert.deepEqual(p.contentRestrictions ?? [], []);
  assert.deepEqual(p.owners.map(o => ({emailAddress: o.emailAddress, permissionId: o.permissionId})),
    f.owners.map(o => ({emailAddress: o.emailAddress, permissionId: o.permissionId})));
  const ownerId = f.owners[0].permissionId;
  assert.ok(typeof ownerId === "string" && ownerId.length > 0);
  const check = perm => {
    assert.equal(perm.type, "user"); assert.ok(!perm.deleted && !perm.pendingOwner && !perm.expirationTime);
    for (const detail of perm.permissionDetails ?? []) {
      assert.ok(!detail.inherited || perm.id === ownerId, "Inherited non-owner authority");
    }
  };
  value.filePermissions.forEach(check); value.parentPermissions.forEach(check);
  assert.equal(value.parentPermissions.length, 1);
  assert.equal(value.parentPermissions[0].id, ownerId); assert.equal(value.parentPermissions[0].role, "owner");
  assert.equal(value.parentPermissions[0].emailAddress, OWNER);
  const owners = value.filePermissions.filter(x => x.role === "owner");
  assert.equal(owners.length, 1); assert.equal(owners[0].id, ownerId); assert.equal(owners[0].emailAddress, OWNER);
  const readers = value.filePermissions.filter(x => x.role === "reader");
  assert.deepEqual(readers.map(x => x.emailAddress).sort(), READERS);
  const writers = value.filePermissions.filter(x => x.role === "writer");
  assert.equal(value.filePermissions.length, writerPresent ? 6 : 5);
  assert.equal(writers.length, writerPresent ? 1 : 0);
  if (writerPresent) {
    assert.equal(writers[0].id, PERMISSION); assert.equal(writers[0].emailAddress, WRITER);
  }
}

// Excludes viewer-dependent capabilities, but binds the complete permission records.
function metadataFingerprint(value, {omitWriter = false, omitVersion = false} = {}) {
  const copy = structuredClone(value);
  delete copy.file.capabilities; delete copy.parent.capabilities;
  for (const file of [copy.file, copy.parent]) for (const owner of file.owners) delete owner.me;
  // Parent version changes for unrelated My Drive children are not file authority.
  delete copy.parent.version;
  if (omitVersion) delete copy.file.version;
  if (omitWriter) copy.filePermissions = copy.filePermissions.filter(p => p.id !== PERMISSION);
  return digest(copy);
}

function snapshot(value) {
  assert.equal(value.spreadsheetId, FILE); assert.equal(value.sheets?.length, TABS.length);
  const actual = value.sheets.map(s => ({id: s.properties.sheetId, title: s.properties.title}));
  assert.deepEqual(actual, TABS);
  const cells = {};
  for (const sheet of value.sheets) for (const data of sheet.data ?? []) {
    for (const [r, row] of (data.rowData ?? []).entries()) for (const [c, cell] of (row.values ?? []).entries()) {
      if (Object.keys(cell).length) cells[`${sheet.properties.sheetId}:${(data.startRow ?? 0) + r}:${(data.startColumn ?? 0) + c}`] = cell;
    }
  }
  assert.deepEqual(cells[`${TABS[0].id}:0:0`]?.userEnteredValue, {stringValue: "Fecha"});
  return {digest: digest({properties: value.properties, sheets: value.sheets.map(s => s.properties), cells}),
    selectedCells: Object.keys(cells).length};
}

function createWorkbookAccess({writerBearer, fetchImpl = fetch}) {
  let bearer = writerBearer, attempted = false;
  return {
    readMetadata: () => readMetadata(fetchImpl, bearer, false),
    async readSnapshot() {
      const params = new URLSearchParams({includeGridData: "true",
        fields: "spreadsheetId,properties,sheets(properties,data(startRow,startColumn,rowData(values(userEnteredValue,note,userEnteredFormat))))"});
      // Bounded six-tab image, not a whole-workbook snapshot.
      TABS.forEach(tab => params.append("ranges", `'${tab.title}'!A1:${tab.id === 1770956648 ? "Y" : "Z"}100`));
      const data = ok(await request(fetchImpl, bearer, SHEETS + "?" + params));
      return snapshot(data);
    },
    async writeSameHeader() {
      assert.equal(attempted, false, "One write attempt, including a lost response"); attempted = true;
      const data = ok(await request(fetchImpl, bearer, SHEETS + ":batchUpdate", "POST", REQUEST()));
      assert.equal(data.spreadsheetId, FILE); assert.equal(data.replies?.length, 1);
    },
    async probeAccess() {
      const result = await request(fetchImpl, bearer, query(DRIVE + FILE, {fields: "id"}));
      return {status: result.status, id: result.data?.id ?? null};
    },
    close() { bearer = null; },
  };
}

// Mutations of permissions are deliberately supplied through reviewed native Drive
// owner UI callbacks. This token can only read metadata and revoke itself.
function createOwnerReader({ownerBearer, fetchImpl = fetch}) {
  let bearer = ownerBearer;
  return {read: () => readMetadata(fetchImpl, bearer), async close() {
    try {
      const revoked = await fetchImpl("https://oauth2.googleapis.com/revoke", {method: "POST", redirect: "error",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({token: bearer}).toString(), signal: AbortSignal.timeout(15000)});
      const probe = await request(fetchImpl, bearer, query(DRIVE + FILE, {fields: "id"}));
      assert.equal(revoked.status, 200); assert.equal(probe.status, 401);
      return {revoked: true, sameTokenStatus: 401};
    } finally { bearer = null; }
  }};
}
module.exports = {FILE, PARENT, OWNER, WRITER, PERMISSION, TABS, REQUEST, READERS,
  validateMetadata, metadataFingerprint, snapshot, createWorkbookAccess, createOwnerReader};
if (require.main === module) { console.error("Explicit reviewed composition only; no live CLI."); process.exitCode = 1; }
