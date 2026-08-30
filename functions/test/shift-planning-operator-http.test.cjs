"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");

const {ShiftPlanningError} = require("../lib/shift-planning-contract.js");
const {
  SHIFT_PLANNING_OPERATOR_RECOVERY_HTTPS_OPTIONS,
  SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
  createShiftPlanningOperatorRecoveryHttpFunction,
  createShiftPlanningOperatorRecoveryHttpHandler,
} = require("../lib/shift-planning-operator-http.js");

const authorizationDigest =
  "shift-planning:v1:sha256:" + "a".repeat(64);
const outcomeDigest =
  "shift-planning:v1:sha256:" + "b".repeat(64);

const command = {
  schemaVersion: 1,
  mode: "recovery",
  environment: "develop",
  activationOperationId: "request-activate-2026",
  recoveryOperationId: "recovery-activate-2026",
  authorizationDigest,
};

const executionResult = (kind = "committed") => ({
  kind,
  attempt: kind === "committed" ? {} : null,
  outcomePersistenceKind: kind === "committed" ? "committed" : "replayed",
  outcome: {outcomeDigest},
});

const createResponse = () => {
  const state = {headers: {}, status: null, body: null};
  const response = {
    json(body) {
      state.body = body;
      return response;
    },
    setHeader(name, value) {
      state.headers[name] = value;
      return response;
    },
    status(value) {
      state.status = value;
      return response;
    },
  };
  return {response, state};
};

const createAuditLogger = () => {
  const entries = [];
  return {
    entries,
    logger: {
      info(message, data) {
        entries.push({level: "info", message, data});
      },
      warn(message, data) {
        entries.push({level: "warn", message, data});
      },
      error(message, data) {
        entries.push({level: "error", message, data});
      },
    },
  };
};

const invoke = async ({
  executor,
  method = "POST",
  body = command,
  query = {},
}) => {
  const audit = createAuditLogger();
  const {response, state} = createResponse();
  const handler = createShiftPlanningOperatorRecoveryHttpHandler(
    executor,
    audit.logger,
    {createAuditId: () => "audit-2026"},
  );
  await handler({method, body, query}, response);
  return {state, entries: audit.entries};
};

test("exports recovery only for the exact invoker-only operator", () => {
  assert.equal(
    SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
    "reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com",
  );
  const audit = createAuditLogger();
  const cloudFunction = createShiftPlanningOperatorRecoveryHttpFunction(
    {execute: async () => executionResult()},
    audit.logger,
  );
  assert.deepEqual(cloudFunction.__endpoint.httpsTrigger.invoker, [
    SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
  ]);
  assert.equal(
    Object.hasOwn(SHIFT_PLANNING_OPERATOR_RECOVERY_HTTPS_OPTIONS, "serviceAccount"),
    false,
  );
});

test("returns one minimal committed response and sanitized audit trail", async () => {
  let receivedCommand = null;
  const {state, entries} = await invoke({
    executor: {
      async execute(value) {
        receivedCommand = value;
        return executionResult();
      },
    },
  });
  assert.deepEqual(receivedCommand, command);
  assert.equal(state.status, 200);
  assert.deepEqual(state.body, {
    ok: true,
    auditId: "audit-2026",
    schemaVersion: 1,
    mode: "recovery",
    environment: "develop",
    activationOperationId: "request-activate-2026",
    recoveryOperationId: "recovery-activate-2026",
    resultKind: "committed",
    outcomePersistenceKind: "committed",
    outcomeDigest,
  });
  assert.deepEqual(entries.map(({level}) => level), ["info", "info"]);
  assert.equal(JSON.stringify(entries).includes(authorizationDigest), false);
});

test("reports exact terminal replay without invoking another contract", async () => {
  const {state} = await invoke({
    executor: {execute: async () => executionResult("terminalReplay")},
  });
  assert.equal(state.status, 200);
  assert.equal(state.body.resultKind, "terminalReplay");
  assert.equal(state.body.outcomePersistenceKind, "replayed");
});

test("rejects non-POST and query-bearing calls before execution", async () => {
  let executions = 0;
  const executor = {
    async execute() {
      executions += 1;
      return executionResult();
    },
  };
  const methodResult = await invoke({executor, method: "GET"});
  assert.equal(methodResult.state.status, 405);
  assert.equal(methodResult.state.headers.Allow, "POST");
  assert.equal(methodResult.state.body.error.code, "method_not_allowed");

  const queryResult = await invoke({executor, query: {environment: "develop"}});
  assert.equal(queryResult.state.status, 400);
  assert.equal(queryResult.state.body.error.code, "invalid_recovery_command");
  assert.equal(executions, 0);
});

test("rejects malformed commands without logging their body", async () => {
  const body = {...command, requestedByUserId: "ordinary-admin"};
  const {state, entries} = await invoke({
    executor: {execute: async () => executionResult()},
    body,
  });
  assert.equal(state.status, 400);
  assert.equal(state.body.error.code, "invalid_recovery_command");
  assert.equal(JSON.stringify(entries).includes("ordinary-admin"), false);
});

test("keeps deterministic state rejection diagnostics internal", async () => {
  const {state, entries} = await invoke({
    executor: {
      async execute() {
        throw new ShiftPlanningError(
          "maintenance_state_conflict",
          "sensitive internal state detail",
        );
      },
    },
  });
  assert.equal(state.status, 409);
  assert.equal(state.body.error.code, "recovery_rejected");
  assert.equal(
    JSON.stringify(state.body).includes("sensitive internal state detail"),
    false,
  );
  assert.equal(entries.at(-1).data.failureCode, "maintenance_state_conflict");
});

test("marks ambiguous failures unknown without leaking their detail", async () => {
  const {state, entries} = await invoke({
    executor: {
      async execute() {
        throw new Error("transport may have committed sensitive detail");
      },
    },
  });
  assert.equal(state.status, 500);
  assert.equal(state.body.error.code, "internal");
  assert.match(state.body.error.message, /outcome is unknown/);
  assert.equal(
    JSON.stringify({state, entries}).includes("sensitive detail"),
    false,
  );
  assert.equal(entries.at(-1).data.errorType, "Error");
});
