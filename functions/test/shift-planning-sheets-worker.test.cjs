"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningSheetsWorkerHttpHandler, createShiftPlanningSheetsWorkerHttpFunction} =
  require("../lib/shift-planning-sheets-worker.js");
const {readShiftSheetsWorkerConfig, ShiftSheetsError} = require("../lib/shift-sheets-config.js");
const command = {schemaVersion: 1, environment: "develop", mode: "execute", commandId: "sync-1"};
const response = () => {
  const result = {headers: {}};
  return {result, setHeader(key, value) { result.headers[key] = value; return this; },
    status(value) { result.status = value; return this; }, json(value) { result.body = value; return this; }};
};
const dependencies = (overrides = {}) => ({repository: {}, consumerFor: () => ({}), logger: {error() {}}, ...overrides});
const invoke = async (deps, body = command, extra = {}) => {
  const reply = response();
  await createShiftPlanningSheetsWorkerHttpHandler(deps)({method: "POST", query: {}, body, ...extra}, reply);
  return reply.result;
};

test("worker export is private, bounded and does not create an invoker grant", () => {
  const fn = createShiftPlanningSheetsWorkerHttpFunction(dependencies());
  assert.deepEqual(fn.__endpoint.httpsTrigger.invoker, ["private"]);
  assert.equal(fn.__endpoint.timeoutSeconds, 300);
});

test("invalid HTTP commands are rejected before any configuration or repository access", async () => {
  let accessed = 0;
  const deps = dependencies({consumerFor: () => { accessed += 1; throw new Error("unexpected"); }});
  for (const body of [null, [], {}, {...command, schemaVersion: 2}, {...command, environment: "other"},
    {...command, rows: []}, {...command, workbookId: "injected"}, {...command, commandId: "a/b"},
    {...command, mode: "inspect"}, {schemaVersion: 1, environment: "develop", mode: "drain", limit: 3},
    {schemaVersion: 1, environment: "develop", mode: "drain", limit: 0}]) {
    assert.equal((await invoke(deps, body)).status, 400);
  }
  assert.equal((await invoke(deps, command, {query: {environment: "production"}})).status, 400);
  const get = await invoke(deps, command, {method: "GET"});
  assert.equal(get.status, 405); assert.equal(get.headers.Allow, "POST");
  assert.equal(accessed, 0);
});

test("worker config requires exact environment workbook and explicitly reviewed aliases", () => {
  const vars = {SHEETS_SPREADSHEET_ID_DEVELOP: "dev-book", SHIFT_SHEETS_ALIASES_DEVELOP: "[]"};
  assert.equal(readShiftSheetsWorkerConfig("develop", vars).workbookId, "dev-book");
  assert.throws(() => readShiftSheetsWorkerConfig("production", vars));
  for (const extra of [
    {SHIFT_SHEETS_ALIASES_DEVELOP: undefined}, {SHIFT_SHEETS_ALIASES_DEVELOP: "null"},
    {SHIFT_SHEETS_ALIASES_DEVELOP: "[{\"title\":\"unreviewed\"}]"},
    {SHEETS_SPREADSHEET_ID_DEVELOP: undefined, SHEETS_SPREADSHEET_ID: "global-book"},
    {SHEETS_SPREADSHEET_ID_PRODUCTION: "dev-book"},
  ]) assert.throws(() => readShiftSheetsWorkerConfig("develop", {...vars, ...extra}));
  const aliases = [{type: "delivery", seasonStartYear: 2025, title: "TORRE 2025-26"}];
  assert.deepEqual(readShiftSheetsWorkerConfig("develop", {...vars,
    SHIFT_SHEETS_ALIASES_DEVELOP: JSON.stringify(aliases)}).aliases, aliases);
});

test("terminal retries expose only summary and use fresh worker identities without external calls", async () => {
  const claims = [];
  const deps = dependencies({repository: {claim: async (input) => {
    claims.push(input); return {kind: "terminalReplay", command: {commandId: "sync-1", privateRows: ["secret"]}};
  }}, consumerFor: (environment) => { assert.equal(environment, "develop"); return {}; }});
  for (let i = 0; i < 2; i++) {
    const result = await invoke(deps);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.results, [{kind: "terminalReplay", commandId: "sync-1"}]);
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.doesNotMatch(JSON.stringify(result), /secret|privateRows/);
  }
  assert.notEqual(claims[0].workerId, claims[1].workerId);
  assert.notEqual(claims[0].attemptId, claims[1].attemptId);
});

test("drain stops at busy work and returns its retry time without claiming another command", async () => {
  const claimed = [];
  const result = await invoke(dependencies({repository: {
    discoverRunnable: async (input) => { assert.equal(input.limit, 2); return ["a", "b"]; },
    claim: async ({commandId}) => { claimed.push(commandId); return {kind: "busy", retryAt: Timestamp.fromMillis(4000)}; },
  }}), {schemaVersion: 1, environment: "develop", mode: "drain", limit: 2});
  assert.equal(result.status, 202);
  assert.deepEqual(claimed, ["a"]);
  assert.deepEqual(result.body.results, [{kind: "busy", retryAtMillis: 4000}]);
});

test("unknown submission is inspected once and blocks the rest of this drain", async () => {
  const claimed = [], inspected = [];
  const result = await invoke(dependencies({repository: {
    discoverRunnable: async () => ["a", "b"],
    claim: async ({commandId}) => { claimed.push(commandId); return {kind: "reconcile", command: {commandId}}; },
  }, consumerFor: () => ({inspect: async ({commandId}) => {
    inspected.push(commandId); return {kind: "reconciliationRequired"};
  }, apply: async () => { throw new Error("must never resubmit"); }})}),
  {schemaVersion: 1, environment: "develop", mode: "drain", limit: 2});
  assert.equal(result.status, 409); assert.deepEqual(claimed, ["a"]); assert.deepEqual(inspected, ["a"]);
});

test("typed conflicts and transient failures do not expose backend diagnostics", async () => {
  for (const error of [new ShiftSheetsError("invalid_sheets_config", "private book name"), new Error("private credential")]) {
    const logs = [];
    const result = await invoke(dependencies({consumerFor: () => { throw error; },
      logger: {error: (...args) => logs.push(args)}}));
    assert.equal(result.status, error instanceof ShiftSheetsError ? 409 : 503);
    assert.doesNotMatch(JSON.stringify({result, logs}), /private book|private credential/);
  }
});
