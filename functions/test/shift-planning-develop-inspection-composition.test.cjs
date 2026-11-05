"use strict";
const assert = require("node:assert/strict");
const {test, after} = require("node:test");
const {google} = require("googleapis");
const variables = ["GCLOUD_PROJECT", "SHEETS_SPREADSHEET_ID_DEVELOP", "SHEETS_SPREADSHEET_ID_PRODUCTION", "SHIFT_SHEETS_ALIASES_DEVELOP", "METADATA_SERVER_DETECTION"];
const previous = variables.map((key) => [key, process.env[key]]);
process.env.GCLOUD_PROJECT = "reguerta-9f27f";
process.env.METADATA_SERVER_DETECTION = "none";
process.env.SHEETS_SPREADSHEET_ID_DEVELOP = "synthetic_develop_workbook";
delete process.env.SHEETS_SPREADSHEET_ID_PRODUCTION;
const title = "turnos-reparto 2026-27";
const aliases = JSON.stringify([{type: "delivery", seasonStartYear: 2026, title}]);
process.env.SHIFT_SHEETS_ALIASES_DEVELOP = aliases;
const original = {auth: google.auth.GoogleAuth, drive: google.drive, sheets: google.sheets};
const calls = [];
google.auth.GoogleAuth = class { constructor(options) { calls.push({api: "auth", options}); } };
const owner = {permissionId: "synthetic-owner", emailAddress: "owner@example.test"};
google.drive = () => ({
  files: {get: async (request, options) => {
    calls.push({api: "files.get", request, options});
    return {data: {id: "synthetic_develop_workbook", mimeType: "application/vnd.google-apps.spreadsheet",
      trashed: false, version: "17", owners: [owner], parents: [], capabilities: {canEdit: true, canModifyContent: true}}};
  }},
  about: {get: async (request, options) => {
    calls.push({api: "about.get", request, options});
    return {data: {user: {permissionId: "synthetic-observer", emailAddress: "inspector@synthetic.iam.gserviceaccount.com"}}};
  }},
  permissions: {list: async (request, options) => {
    calls.push({api: "permissions.list", request, options});
    return {data: {permissions: [{id: owner.permissionId, type: "user", role: "owner", emailAddress: owner.emailAddress}]}};
  }},
});
google.sheets = () => ({spreadsheets: {get: async (request, options) => {
  calls.push({api: "sheets.get", request, options});
  const sheet = {properties: {sheetId: 1, title, sheetType: "GRID", gridProperties: {rowCount: 2, columnCount: 2}}};
  if (request.ranges) sheet.data = [{startRow: 0, startColumn: 0, rowData: [{values: [{userEnteredValue: {stringValue: "Published date"}}]}]}];
  return {data: {spreadsheetId: "synthetic_develop_workbook", sheets: [sheet]}};
}}});
const fn = require("../lib/index.js").inspectDevelopShiftMigration;
const app = require("express")();
app.use(require("express").json());
app.all("/", fn);
const server = app.listen(0, "127.0.0.1");
const listening = new Promise((resolve) => server.once("listening", resolve));
const invoke = async (body = {schemaVersion: 1, environment: "develop", operationId: "inspect-local-contract"}) => {
  await listening;
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
  });
  return {status: response.status, "Cache-Control": response.headers.get("cache-control"), body: await response.json()};
};
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  google.auth.GoogleAuth = original.auth; google.drive = original.drive; google.sheets = original.sheets;
  for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await require("firebase-admin/firestore").getFirestore().terminate();
  await require("firebase-admin/app").deleteApp(require("firebase-admin/app").getApp());
});
test("exported inspection rejects resource selectors before opening any Google client", async () => {
  calls.length = 0;
  assert.equal((await invoke({schemaVersion: 1, environment: "develop", operationId: "inspect", workbookId: "caller-selected"})).status, 400);
  assert.equal(calls.length, 0);
});
test("exported inspection requires explicit develop aliases and rejects shared workbook configuration without Google access", async () => {
  for (const bad of [undefined, "[]"]) {
    calls.length = 0;
    if (bad === undefined) delete process.env.SHIFT_SHEETS_ALIASES_DEVELOP; else process.env.SHIFT_SHEETS_ALIASES_DEVELOP = bad;
    assert.equal((await invoke()).status, 503); assert.equal(calls.length, 0);
  }
  process.env.SHIFT_SHEETS_ALIASES_DEVELOP = aliases;
  process.env.SHEETS_SPREADSHEET_ID_PRODUCTION = "synthetic_develop_workbook";
  assert.equal((await invoke()).status, 503); assert.equal(calls.length, 0);
  delete process.env.SHEETS_SPREADSHEET_ID_PRODUCTION;
});
test("exported inspection uses only read scopes and methods on server-owned develop, returning no private evidence", async () => {
  calls.length = 0;
  const response = await invoke();
  assert.equal(response.status, 200); assert.equal(response["Cache-Control"], "no-store");
  assert.deepEqual(calls[0], {api: "auth", options: {scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"]}});
  assert.equal(calls.filter((c) => c.api === "files.get").length, 4);
  assert.equal(calls.filter((c) => c.api === "sheets.get").length, 2);
  for (const call of calls.filter((c) => c.request?.fileId)) assert.equal(call.request.fileId, "synthetic_develop_workbook");
  for (const call of calls.filter((c) => c.api === "sheets.get")) assert.equal(call.request.spreadsheetId, "synthetic_develop_workbook");
  assert.equal(response.body.report.selectedTabCount, 1); assert.equal(response.body.canApply, false);
  for (const secret of ["synthetic_develop_workbook", "example.test", "gserviceaccount.com", "Published date", title]) assert.equal(JSON.stringify(response.body).includes(secret), false);
});
