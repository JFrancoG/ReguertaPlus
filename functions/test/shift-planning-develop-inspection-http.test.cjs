"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL} = require("../lib/shift-planning-operator-http.js");
const {SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID,
  SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS,
  createShiftPlanningDevelopInspectionHttpHandler,
  createShiftPlanningDevelopInspectionHttpFunction} = require("../lib/shift-planning-develop-inspection-http.js");

const command = () => ({schemaVersion: 1, environment: "develop", operationId: "inspect-develop-base"});
const report = () => ({schemaVersion: 1, environment: "develop", canApply: false,
  observedAtMillis: 1_798_000_000_000, workbookVersionBefore: "17", workbookVersionAfter: "17",
  observationPrincipalKind: "serviceAccount", selectedTabCount: 4, permissionCount: 3, ownerCount: 1,
  contentDigest: digest("cells"), aclDigest: digest("access"), protectionsDigest: digest("protections"),
  observationDigest: digest("complete private observation"), blockers: ["control_plane_unavailable",
    "workbook_human_offline_editors_unverified"]});
const invoke = async ({method = "POST", body = command(), query = {}, configuration = {},
  observe = async () => report()} = {}) => {
  const entries = [], calls = [], state = {headers: {}, status: null, body: null};
  const logger = Object.fromEntries(["info", "warn", "error"].map((level) => [level,
    (message, data) => entries.push({level, message, data})]));
  const dependencies = {projectId: SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID,
    workbookId: "server_owned_workbook",
    createAuditId: () => "inspection-audit", inspect: async (input) => {
      calls.push(structuredClone(input)); return observe(input);
    }, ...configuration};
  const response = {status: (value) => { state.status = value; return response; },
    setHeader: (key, value) => { state.headers[key] = value; return response; },
    json: (value) => { state.body = value; return response; }};
  await createShiftPlanningDevelopInspectionHttpHandler(dependencies, logger)({method, body, query}, response);
  return {state, entries, calls};
};

test("declares inspection only behind the existing exact IAM operator, without selecting runtime identity", () => {
  const logger = {info() {}, warn() {}, error() {}};
  const fn = createShiftPlanningDevelopInspectionHttpFunction({projectId: SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID,
    workbookId: "server_owned_workbook",
    inspect: async () => report()}, logger);
  assert.deepEqual(fn.__endpoint.httpsTrigger.invoker, [SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL]);
  assert.equal(SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS.cors, false);
  assert.equal(Object.hasOwn(SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS, "serviceAccount"), false);
});

test("passes only the operation and server workbook to the observer, returning a detached non-executable summary", async () => {
  const observed = report();
  const result = await invoke({observe: async () => observed});
  assert.equal(result.state.status, 200);
  assert.equal(result.state.headers["Cache-Control"], "no-store");
  assert.equal(result.state.body.canApply, false);
  assert.deepEqual(result.calls, [{operationId: "inspect-develop-base", workbookId: "server_owned_workbook"}]);
  assert.deepEqual(result.state.body.report, observed);
  observed.blockers.push("workbook_apps_script_addons_unverified");
  assert.equal(result.state.body.report.blockers.length, 2);
  const publicOutput = JSON.stringify([result.state, result.entries]);
  assert.equal(publicOutput.includes("server_owned_workbook"), false);
  assert.equal(publicOutput.includes("inspect-develop-base"), false);
  assert.deepEqual(result.entries.map((entry) => entry.data), [{auditSchemaVersion: 1,
    auditId: "inspection-audit", environment: "develop", canApply: false, blockerCount: 2}]);
});

test("validates transport before inspecting configuration or invoking the observer", async () => {
  const result = await invoke({method: "GET", body: null, configuration: {projectId: "another-project"}});
  assert.equal(result.state.status, 405);
  assert.equal(result.state.headers.Allow, "POST");
  assert.equal(result.state.headers["Cache-Control"], "no-store");
  assert.equal(result.state.body.canApply, false);
  assert.equal(result.calls.length, 0);
  const query = await invoke({query: {apply: "true"}});
  assert.equal(query.state.status, 400); assert.equal(query.calls.length, 0);
});

test("rejects production, execution modes, resource selectors, malformed bodies and extra fields before observation", async () => {
  for (const body of [null, [], {}, {...command(), environment: "production"},
    {...command(), mode: "apply"}, {...command(), mode: "recover"},
    {...command(), workbookId: "client_workbook"}, {...command(), projectId: "reguerta-9f27f"},
    {...command(), targetPath: "develop/plus-collections/users/private"},
    {...command(), operationId: "../private"}, {...command(), approvedContentDigest: "unbound"},
    {...command(), schemaVersion: 2}]) {
    const result = await invoke({body});
    assert.equal(result.state.status, 400);
    assert.equal(result.state.body.canApply, false);
    assert.equal(result.calls.length, 0);
  }
});

test("does not evaluate command accessors or leak their contents", async () => {
  const body = command();
  Object.defineProperty(body, "operationId", {enumerable: true,
    get() { throw new Error("private command getter must not run"); }});
  const result = await invoke({body});
  assert.equal(result.state.status, 400);
  assert.equal(result.calls.length, 0);
  assert.equal(JSON.stringify(result).includes("private command"), false);
});

test("rejects approval fields instead of treating a workbook inspection as migration approval", async () => {
  const result = await invoke({body: {...command(), approvedContentDigest: digest("semantic proposal")}});
  assert.equal(result.state.status, 400);
  assert.equal(result.calls.length, 0);
  assert.equal(result.state.body.error.code, "invalid_inspection_command");
});

test("fails closed on invalid server project or workbook without invoking the provider", async () => {
  for (const configuration of [{projectId: "production-project"}, {workbookId: ""},
    {workbookId: "workbook/with/range"}]) {
    const result = await invoke({configuration});
    assert.equal(result.state.status, 503); assert.equal(result.calls.length, 0);
    assert.equal(result.state.body.canApply, false);
  }
});

test("copies no private provider fields and never traverses unknown objects or accessors", async () => {
  const observed = {...report(), ownerEmail: "private-owner@example.test", workbookId: "private-file",
    privateObservation: {authUid: "private-uid", permissions: ["private-permission"]}};
  Object.defineProperty(observed, "sdkReference", {enumerable: true,
    get() { throw new Error("unknown SDK getter must not run"); }});
  const result = await invoke({observe: async () => observed});
  assert.equal(result.state.status, 200);
  assert.deepEqual(result.state.body.report, report());
  assert.equal(/private-owner|private-file|private-uid|private-permission|sdkReference/.test(JSON.stringify(result)), false);
});

test("keeps unknown owner count as null instead of presenting it as zero", async () => {
  const result = await invoke({observe: async () => ({...report(), ownerCount: null, observationPrincipalKind: "unknown"})});
  assert.equal(result.state.status, 200);
  assert.equal(result.state.body.report.ownerCount, null);
  assert.equal(result.state.body.report.canApply, false);
});

test("rejects invalid summaries or unknown blocker values without reflecting them", async () => {
  for (const fields of [{canApply: true}, {environment: "production"}, {observedAtMillis: NaN},
    {selectedTabCount: 9}, {permissionCount: -1}, {ownerCount: "private-owner"},
    {contentDigest: "private-data"}, {workbookVersionBefore: "9223372036854775808"},
    {workbookVersionAfter: null}, {blockers: ["private-owner@example.test"]}]) {
    const result = await invoke({observe: async () => ({...report(), ...fields})});
    assert.equal(result.state.status, 503);
    assert.equal(result.state.body.canApply, false);
    assert.equal(/private-owner|private-data|9223372036854775808/.test(JSON.stringify([result.state, result.entries])), false);
  }
});

test("provider failures produce a fixed unavailable result and sanitized logs without error reflection", async () => {
  const result = await invoke({observe: async () => {
    const error = new Error("owner@example.test has access to private-workbook");
    error.name = "private-uid"; error.code = "private-provider-code";
    throw error;
  }});
  assert.equal(result.state.status, 503);
  assert.equal(result.state.body.error.code, "inspection_unavailable");
  assert.equal(result.state.body.canApply, false);
  assert.equal(/owner@example|private-workbook|private-uid|private-provider-code/.test(JSON.stringify(result)), false);
});
