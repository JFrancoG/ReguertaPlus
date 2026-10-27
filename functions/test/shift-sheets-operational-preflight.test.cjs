"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {observeShiftSheetsWorkbook, ShiftSheetsOperationalPreflightError} =
  require("../lib/shift-sheets-operational-preflight.js");
const titles = ["turnos-reparto 2026-27", "turnos-reparto 2027-28",
  "turnos-mercado 2026-27", "turnos-mercado 2027-28"];
const workbookId = "synthetic-reviewed-workbook";
const owner = {permissionId: "owner-private-id", emailAddress: "owner@example.test", me: false};
const principal = {permissionId: "observer-private-id", emailAddress: "observer@project.iam.gserviceaccount.com", me: true};
const clone = structuredClone;
const fixture = (changes = {}) => {
  const requests = [];
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: workbookId}});
  const file = {id: workbookId, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false,
    version: "17", parents: ["private-parent"], owners: [owner],
    capabilities: {canEdit: true, canModifyContent: true, canShare: false, canReadRevisions: true},
    ...changes.file};
  const pages = changes.pages ?? [{permissions: [{id: owner.permissionId, type: "user", role: "owner", emailAddress: owner.emailAddress}],
    nextPageToken: "next-page"}, {permissions: [{id: principal.permissionId, type: "user", role: "reader", emailAddress: principal.emailAddress}]}];
  const state = {spreadsheetId: workbookId, sheets: [...titles, "histórico reparto", "histórico mercado"].map((title, index) => ({
    properties: {sheetId: index + 1, title, gridProperties: {rowCount: 3, columnCount: 4}},
    protectedRanges: [], merges: [], developerMetadata: [],
    data: [{rowData: [{values: [{userEnteredValue: {stringValue: `Private ${title}`}}, {},
      {userEnteredValue: {numberValue: 3}}, {userEnteredValue: {formulaValue: "=1+2"}}]}]}],
  }))};
  changes.mutateState?.(state);
  let fileReads = 0, permissionReads = 0, snapshotReads = 0;
  const forbidden = () => { throw new Error("A write interface must never be called"); };
  const files = {get: async (request, options) => {
    requests.push({api: "files.get", request, options});
    fileReads++; await changes.onFileRead?.(fileReads, request);
    if (changes.fileFailure) throw new Error(changes.fileFailure);
    return {data: {...clone(file), ...(changes.fileAt?.(fileReads) ?? {})}};
  }, update: forbidden, delete: forbidden};
  const permissions = {list: async (request, options) => {
    requests.push({api: "permissions.list", request, options});
    if (changes.permissionFailure) throw new Error(changes.permissionFailure);
    const page = pages[Math.min(permissionReads++, pages.length - 1)];
    return {data: clone(page)};
  }, create: forbidden, delete: forbidden};
  const about = {get: async (request, options) => {
    requests.push({api: "about.get", request, options});
    return {data: {user: clone(changes.principal ?? principal)}};
  }};
  const sheets = {get: async (request, options) => {
    requests.push({api: "sheets.get", request, options}); snapshotReads++;
    if (changes.snapshotFailure) throw new Error(changes.snapshotFailure);
    const response = clone(state);
    if (!request.ranges) response.sheets.forEach((s) => { delete s.data; });
    else response.sheets = response.sheets.filter((s) => request.ranges.some((range) => range.startsWith(`'${s.properties.title}'!`)));
    return {data: response};
  }, batchUpdate: forbidden};
  const input = {config, titles: [...titles], files, permissions, about, sheets, nowMillis: () => 123456};
  return {input, state, requests, observe: (extra = {}) => observeShiftSheetsWorkbook({...input, ...extra}),
    get fileReads() { return fileReads; }, get permissionReads() { return permissionReads; }, get snapshotReads() { return snapshotReads; }};
};
const rejected = async (promise, code) => assert.rejects(promise, (error) => {
  assert.ok(error instanceof ShiftSheetsOperationalPreflightError);
  assert.equal(error.code, code);
  assert.equal(error.message, "Workbook operational observation could not be verified.");
  assert.equal(error.message.includes("example.test"), false);
  return true;
});

test("observes complete visible ACL and bounded seasonal grids while keeping owner and external writers unresolved", async () => {
  const f = fixture(), result = await f.observe(), summary = result.summary;
  assert.equal(summary.canApply, false); assert.equal(summary.environment, "develop");
  assert.equal(summary.workbookVersionBefore, "17"); assert.equal(summary.workbookVersionAfter, "17");
  assert.equal(summary.observationPrincipalKind, "serviceAccount");
  assert.equal(summary.selectedTabCount, 4); assert.equal(summary.permissionCount, 2); assert.equal(summary.ownerCount, 1);
  assert.equal(result.privateObservation.snapshot.sheets.length, 6);
  assert.ok(result.privateObservation.snapshot.sheets.filter((s) => s.properties.title.startsWith("histórico")).every((s) => s.data.length === 0));
  assert.ok(summary.blockers.includes("workbook_owner_fence_unverified"));
  for (const blocker of ["control_plane_unavailable", "workbook_human_offline_editors_unverified",
    "workbook_apps_script_addons_unverified", "workbook_api_oauth_service_accounts_unverified", "workbook_inherited_admin_authority_unverified"])
    assert.ok(summary.blockers.includes(blocker));
  assert.equal(f.fileReads, 4); assert.equal(f.permissionReads, 2); assert.equal(f.snapshotReads, 2);
  assert.equal(result.privateObservation.principal.permissionId, principal.permissionId);
  const wire = JSON.stringify(summary);
  for (const secret of [workbookId, "example.test", "gserviceaccount.com", "Private", "private-parent", "owner-private-id", "turnos-"])
    assert.equal(wire.includes(secret), false);
  assert.ok(f.requests.every((call) => call.options.retry === false && call.options.timeout > 0));
  assert.ok(f.requests.filter((call) => call.api === "permissions.list").every((call) => call.request.supportsAllDrives === true));
});

test("observer capabilities are its own and never inferred from the owner's role", async () => {
  const result = await fixture({principal: {...owner, me: true},
    file: {capabilities: {canEdit: false, canModifyContent: false}}}).observe();
  assert.equal(result.summary.observationPrincipalKind, "user");
  assert.equal(result.summary.ownerCount, 1);
  assert.ok(result.summary.blockers.includes("observer_cannot_modify_content"));
  assert.equal(result.summary.canApply, false);
});

test("shared-drive ownership is unknown rather than a fabricated zero-owner count", async () => {
  const result = await fixture({file: {driveId: "private-shared-drive", owners: undefined},
    pages: [{permissions: [{id: "inherited-group", type: "group", role: "organizer",
      permissionDetails: [{inherited: true, inheritedFrom: "private-drive", role: "organizer"}]}]}]}).observe();
  assert.equal(result.summary.ownerCount, null);
  assert.ok(result.summary.blockers.includes("workbook_shared_drive_authority_unverified"));
  assert.ok(result.summary.blockers.includes("workbook_inherited_admin_authority_unverified"));
  assert.equal(JSON.stringify(result.summary).includes("private-shared-drive"), false);
});

test("metadata owners inconsistent with the complete ACL remain explicitly blocked", async () => {
  const result = await fixture({file: {owners: [{...owner, permissionId: "different-private-owner"}]}}).observe();
  assert.ok(result.summary.blockers.includes("workbook_owner_inventory_mismatch"));
  assert.equal(result.summary.ownerCount, null);
  assert.equal(result.summary.canApply, false);
});

test("rejects every version or file-identity drift without exposing Google errors", async () => {
  for (const fileAt of [(n) => n === 3 ? {version: "18"} : {}, (n) => n === 4 ? {version: "18"} : {},
    (n) => n === 2 ? {id: "other-private-workbook"} : {}, (n) => n === 3 ? {owners: []} : {}]) {
    await rejected(fixture({fileAt}).observe(), "workbook_observation_changed");
  }
  for (const file of [{version: undefined}, {mimeType: "application/vnd.google-apps.shortcut"}, {trashed: true}])
    await rejected(fixture({file}).observe(), "workbook_observation_unavailable");
  await rejected(fixture({fileFailure: "https://private.invalid?token=secret"}).observe(), "workbook_observation_unavailable");
  await rejected(fixture({permissionFailure: "403 private owner@example.test"}).observe(), "workbook_observation_unavailable");
});

test("never presents partial, cyclic, duplicate or oversized permissions as a complete inventory", async () => {
  const entry = (n) => ({id: `grant-${n}`, type: "user", role: "reader"});
  const cases = [
    [{permissions: [entry(1)], nextPageToken: "cycle"}],
    [{permissions: Array.from({length: 501}, (_, n) => entry(n))}],
    [{permissions: [entry(1), entry(1)]}],
    [{permissions: Array.from({length: 500}, (_, n) => entry(n)), nextPageToken: "unread"}],
  ];
  for (const pages of cases) await rejected(fixture({pages}).observe(), "workbook_permissions_incomplete");
  await rejected(fixture({pages: [{permissions: [{id: "broken", type: "user", role: "unrecognized"}]}]}).observe(),
    "workbook_permissions_invalid");
});

test("requires the actual Drive observer identity and exact selected tabs", async () => {
  for (const principal of [{permissionId: null, emailAddress: "observer@example.test"}, {permissionId: "id", emailAddress: null}])
    await rejected(fixture({principal}).observe(), "workbook_observer_identity_unavailable");
  await rejected(fixture().observe({titles: [titles[0], titles[0]]}), "workbook_selected_tabs_invalid");
  const missing = fixture({mutateState: (state) => { state.sheets.shift(); }});
  await rejected(missing.observe(), "workbook_selected_tabs_missing");
});

test("reuses snapshot bounds before requesting an oversized grid", async () => {
  const f = fixture({mutateState: (state) => { state.sheets[0].properties.gridProperties.rowCount = 100000; }});
  await rejected(f.observe(), "workbook_observation_unavailable");
  assert.equal(f.snapshotReads, 1);
  assert.equal(f.requests.some((call) => call.api === "sheets.get" && call.request.ranges), false);
});

test("normalizes only whitelisted API values and keeps protection evidence separate from content", async () => {
  const clean = await fixture().observe();
  const f = fixture({file: {unrequestedSecret: "discard-file-secret"}, mutateState: (state) => {
    const s = state.sheets[0];
    s.unrequestedSecret = "discard-sheet-secret";
    s.data[0].rowData[0].values[0].unrequestedSecret = "discard-cell-secret";
    s.data[0].rowData[0].values[1] = {userEnteredValue: undefined};
  }});
  const normalized = await f.observe();
  assert.equal(normalized.summary.contentDigest, clean.summary.contentDigest);
  assert.equal(normalized.summary.observationDigest, clean.summary.observationDigest);
  assert.equal(JSON.stringify(normalized.privateObservation).includes("discard-"), false);
  const protectedResult = await fixture({mutateState: (state) => {
    state.sheets[0].protectedRanges = [{protectedRangeId: 4, range: {sheetId: 1}, warningOnly: true,
      editors: {users: ["owner@example.test"]}}];
  }}).observe({expectedContentDigest: clean.summary.contentDigest});
  assert.equal(protectedResult.summary.contentDigest, clean.summary.contentDigest);
  assert.notEqual(protectedResult.summary.protectionsDigest, clean.summary.protectionsDigest);
  assert.ok(protectedResult.summary.blockers.includes("managed_tabs_have_protections"));
});

test("binds the expected content digest before asynchronous reads", async () => {
  const clean = await fixture().observe(), f = fixture();
  await rejected(f.observe({expectedContentDigest: "unreviewed"}), "workbook_content_changed");
  const detached = fixture({onFileRead: async () => {
    detached.input.titles.length = 0;
    detached.input.config = {...detached.input.config, workbookId: "other"};
    detached.input.expectedContentDigest = "changed-during-read";
  }});
  detached.input.expectedContentDigest = clean.summary.contentDigest;
  const result = await observeShiftSheetsWorkbook(detached.input);
  assert.equal(result.summary.contentDigest, clean.summary.contentDigest);
  assert.equal(result.summary.selectedTabCount, 4);
});
