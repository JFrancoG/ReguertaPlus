"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftSheetsImportHttpHandler, createShiftSheetsImportHttpFunction,
  readShiftSheetsImportMapping} = require("../lib/shift-sheets-import-http.js");
const {createShiftSheetsConfig, resolveShiftSheetsTab, ShiftSheetsError} = require("../lib/shift-sheets-config.js");
const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "test-book"}});
const digest = "shift-planning:v1:sha256:" + "a".repeat(64);
const command = {schemaVersion: 1, environment: "develop", operationId: "review-1", mode: "prepare"};
const setup = (overrides = {}) => {
  const calls = [], logs = [];
  const plan = {planDigest: digest, patches: [{id: "shift-1", assignedUserIds: ["member-2"]}]};
  const importer = {
    prepare: async (...args) => { calls.push(["prepare", ...args]); return {kind: "prepared", plan}; },
    apply: async (...args) => { calls.push(["apply", ...args]); return {kind: "committed", result: {privateSource: "secret"}}; },
    writeBack: async (...args) => { calls.push(["writeBack", ...args]); return {kind: "completed", evidence: {privateVersion: "secret"}}; },
    ...overrides,
  };
  const dependencies = {importerFor: (env) => { assert.equal(env, "develop"); return importer; }, logger: {error: (...args) => logs.push(args)}};
  const invoke = async (body = command, extra = {}) => {
    const result = {headers: {}};
    const response = {setHeader(k, v) { result.headers[k] = v; return response; },
      status(v) { result.status = v; return response; }, json(v) { result.body = v; return response; }};
    await createShiftSheetsImportHttpHandler(dependencies)({method: "POST", body, query: {}, ...extra}, response);
    return result;
  };
  return {calls, logs, importer, dependencies, invoke, plan};
};

test("import function is private and exposes no implicit scheduler", () => {
  const fn = createShiftSheetsImportHttpFunction(setup().dependencies);
  assert.deepEqual(fn.__endpoint.httpsTrigger.invoker, ["private"]);
  assert.equal(fn.__endpoint.timeoutSeconds, 300);
  assert.equal(fn.__endpoint.scheduleTrigger, undefined);
});

test("prepare returns the exact review plan without invoking either mutation mode", async () => {
  const f = setup(); const result = await f.invoke();
  assert.equal(result.status, 200); assert.deepEqual(result.body.plan, f.plan);
  assert.deepEqual(f.calls, [["prepare", "review-1"]]);
  assert.equal(result.headers["Cache-Control"], "no-store"); assert.deepEqual(f.logs, []);
});

test("apply and writeBack pass the exact digest separately and return no internal payload", async () => {
  const f = setup();
  for (const mode of ["apply", "writeBack"]) {
    const result = await f.invoke({...command, mode, expectedPlanDigest: digest});
    assert.equal(result.status, 200); assert.equal(result.body.operationId, "review-1");
    assert.doesNotMatch(JSON.stringify(result), /privateSource|privateVersion|secret/);
  }
  assert.deepEqual(f.calls, [["apply", "review-1", digest], ["writeBack", "review-1", digest]]);
});

test("malformed or caller-supplied authority is rejected before composition", async () => {
  const f = setup(); let compositions = 0;
  f.dependencies.importerFor = () => { compositions += 1; throw new Error("must not compose"); };
  for (const body of [null, [], {}, {...command, operationId: "a/b"}, {...command, environment: "other"},
    {...command, schemaVersion: 2}, {...command, mode: "all"}, {...command, mode: "apply"},
    {...command, expectedPlanDigest: digest}, {...command, mode: "writeBack", expectedPlanDigest: "bad"},
    ...["rows", "workbookId", "retentionPolicy", "tabs", "source"].map((key) => ({...command, [key]: []}))]) {
    assert.equal((await f.invoke(body)).status, 400);
  }
  assert.equal((await f.invoke(command, {query: {mode: "apply"}})).status, 400);
  const get = await f.invoke(command, {method: "GET"}); assert.equal(get.status, 405); assert.equal(get.headers.Allow, "POST");
  assert.equal(compositions, 0);
});

test("unknown write-back remains explicit and typed/unexpected failures are sanitized", async () => {
  const f = setup({writeBack: async () => ({kind: "reconciliationRequired"})});
  const result = await f.invoke({...command, mode: "writeBack", expectedPlanDigest: digest});
  assert.equal(result.status, 409); assert.equal(result.body.kind, "reconciliationRequired");
  for (const error of [new ShiftSheetsError("invalid_sheets_import", "private person"), new Error("private token")]) {
    f.importer.apply = async () => { throw error; };
    const failed = await f.invoke({...command, mode: "apply", expectedPlanDigest: digest});
    assert.equal(failed.status, error instanceof ShiftSheetsError ? 409 : 503);
    assert.doesNotMatch(JSON.stringify({failed, logs: f.logs}), /private person|private token/);
  }
});

test("configuration owns the exact bounded seasonal layout and decoration mapping", () => {
  const tab = {...resolveShiftSheetsTab(config, "delivery", "2026-09-01"), layout: "canonical", decorations: []};
  const read = (tabs) => readShiftSheetsImportMapping(config, {SHIFT_SHEETS_IMPORT_TABS_DEVELOP: JSON.stringify(tabs)});
  assert.deepEqual(read([tab]), [tab]);
  const human = {...tab, layout: "delivery_human", decorations: [{rowNumber: 1, cells: ["REPARTO"]}]};
  assert.deepEqual(read([human]), [human]);
  for (const tabs of [null, [], [tab, tab], [{...tab, title: "different"}], [{...tab, seasonStartYear: "2026"}],
    [{...tab, layout: "market_human"}], [{...tab, extra: true}], [{...tab, decorations: human.decorations}],
    [{...human, decorations: [{rowNumber: 0, cells: []}]}],
    [{...human, decorations: [{rowNumber: 1, cells: [false]}]}],
    [{...human, decorations: [...human.decorations, ...human.decorations]}]]) assert.throws(() => read(tabs));
  for (const variables of [{}, {SHIFT_SHEETS_IMPORT_TABS_PRODUCTION: JSON.stringify([tab])}, {SHIFT_SHEETS_IMPORT_TABS_DEVELOP: "{"}]) {
    assert.throws(() => readShiftSheetsImportMapping(config, variables));
  }
});
