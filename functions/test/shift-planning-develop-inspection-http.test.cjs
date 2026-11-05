"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL} = require("../lib/shift-planning-operator-http.js");
const {ShiftSheetsOperationalPreflightError} = require("../lib/shift-sheets-operational-preflight.js");
const {SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID,
  SHIFT_PLANNING_DEVELOP_INSPECTION_RUNTIME_SERVICE_ACCOUNT_EMAIL,
  SHIFT_PLANNING_DEVELOP_INSPECTION_INVOKER_SERVICE_ACCOUNT_EMAIL,
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

test("declares dedicated inspection runtime and invoker identities, separate from recovery authority", () => {
  const logger = {info() {}, warn() {}, error() {}};
  const fn = createShiftPlanningDevelopInspectionHttpFunction({projectId: SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID,
    workbookId: "server_owned_workbook",
    inspect: async () => report()}, logger);
  assert.deepEqual(fn.__endpoint.httpsTrigger.invoker, [SHIFT_PLANNING_DEVELOP_INSPECTION_INVOKER_SERVICE_ACCOUNT_EMAIL]);
  assert.notEqual(SHIFT_PLANNING_DEVELOP_INSPECTION_INVOKER_SERVICE_ACCOUNT_EMAIL, SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL);
  assert.equal(SHIFT_PLANNING_DEVELOP_INSPECTION_RUNTIME_SERVICE_ACCOUNT_EMAIL,
    "reguerta-shifts-inspector@reguerta-9f27f.iam.gserviceaccount.com");
  assert.equal(SHIFT_PLANNING_DEVELOP_INSPECTION_INVOKER_SERVICE_ACCOUNT_EMAIL,
    "reguerta-inspect-invoker@reguerta-9f27f.iam.gserviceaccount.com");
  assert.equal(SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS.cors, false);
  for (const account of [SHIFT_PLANNING_DEVELOP_INSPECTION_RUNTIME_SERVICE_ACCOUNT_EMAIL,
    SHIFT_PLANNING_DEVELOP_INSPECTION_INVOKER_SERVICE_ACCOUNT_EMAIL])
    assert.match(account.split("@")[0], /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
  assert.equal(SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS.serviceAccount,
    SHIFT_PLANNING_DEVELOP_INSPECTION_RUNTIME_SERVICE_ACCOUNT_EMAIL);
  assert.equal(fn.__endpoint.serviceAccountEmail, SHIFT_PLANNING_DEVELOP_INSPECTION_RUNTIME_SERVICE_ACCOUNT_EMAIL);
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

test("accepts unavailable reader permission counts only with the matching unknown-owner blocker", async () => {
  const unknown = "workbook_permission_inventory_unavailable";
  const base = report();
  const result = await invoke({observe: async () => ({...base, permissionCount: null, ownerCount: null,
    blockers: [...base.blockers, unknown]})});
  assert.equal(result.state.status, 200);
  assert.equal(result.state.body.report.permissionCount, null);
  assert.equal(result.state.body.report.ownerCount, null);
  assert.equal(result.state.body.canApply, false);
  for (const invalid of [
    {...base, permissionCount: null, ownerCount: null},
    {...base, permissionCount: null, blockers: [...base.blockers, unknown]},
    {...base, permissionCount: 0, ownerCount: null, blockers: [...base.blockers, unknown]},
  ]) {
    const rejected = await invoke({observe: async () => invalid});
    assert.equal(rejected.state.status, 503);
    assert.equal(rejected.state.body.error.code, "inspection_unavailable");
  }
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

test("logs only fixed observation code and stage while preserving the generic unavailable response", async () => {
  const result = await invoke({observe: async () => {
    const error = new ShiftSheetsOperationalPreflightError("workbook_observation_unavailable", "permissions");
    error.message = "403 owner@example.test token=secret";
    error.cause = {response: {data: "private-workbook"}};
    throw error;
  }});
  assert.equal(result.state.status, 503);
  assert.deepEqual(result.state.body, {ok: false, schemaVersion: 1, auditId: "inspection-audit",
    environment: "develop", canApply: false,
    error: {code: "inspection_unavailable", message: "Inspection is unavailable."}});
  assert.deepEqual(result.entries, [{level: "warn", message: "Develop shift inspection rejected", data: {
    auditSchemaVersion: 1, auditId: "inspection-audit", environment: "develop", failureCode: "inspection_unavailable",
    observationFailureCode: "workbook_observation_unavailable", observationFailureStage: "permissions",
  }}]);
  assert.equal(/403|owner@example|private-workbook|token=secret/.test(JSON.stringify(result)), false);
});

test("never logs arbitrary constructor diagnostics or evaluates error accessors", async () => {
  for (const error of [new ShiftSheetsOperationalPreflightError("private-code", "private-stage"),
    Object.defineProperties(new ShiftSheetsOperationalPreflightError("workbook_observation_unavailable", "permissions"), {
      code: {get() { throw new Error("secret-code-accessor"); }},
      stage: {get() { throw new Error("secret-stage-accessor"); }},
    })]) {
    const result = await invoke({observe: async () => { throw error; }});
    assert.equal(result.state.status, 503);
    assert.equal(Object.hasOwn(result.entries[0].data, "observationFailureCode"), false);
    assert.equal(Object.hasOwn(result.entries[0].data, "observationFailureStage"), false);
    assert.equal(/private-|secret-/.test(JSON.stringify(result)), false);
  }
});
