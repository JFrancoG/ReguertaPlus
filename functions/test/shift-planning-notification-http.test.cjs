"use strict";

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {test} = require("node:test");

const {ShiftPlanningError} = require("../lib/shift-planning-contract.js");
const {
  SHIFT_PLANNING_NOTIFICATION_HTTPS_OPTIONS,
  createShiftPlanningNotificationHttpFunction,
  createShiftPlanningNotificationHttpHandler,
  parseShiftPlanningNotificationExecutionCommand,
} = require("../lib/shift-planning-notification-http.js");
const {
  SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
} = require("../lib/shift-planning-operator-http.js");
const {
  createFirebaseShiftPlanningNotificationRuntime,
} = require("../lib/shift-planning-firebase-notification-runtime.js");

const command = {
  schemaVersion: 1,
  mode: "notificationReleaseDispatch",
  environment: "develop",
  intentId: "intent-1",
  workerId: "worker-1",
  attemptId: "attempt-1",
};

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
  const handler = createShiftPlanningNotificationHttpHandler(
    executor,
    audit.logger,
    {createAuditId: () => "audit-notification-1"},
  );
  await handler({method, body, query}, response);
  return {state, entries: audit.entries};
};

test("parses only the exact notification execution command", () => {
  assert.deepEqual(
    parseShiftPlanningNotificationExecutionCommand(command),
    command,
  );
  for (const invalid of [
    {...command, schemaVersion: 2},
    {...command, mode: "notification"},
    {...command, environment: "staging"},
    {...command, attemptId: "attempt/1"},
    {...command, requestedBy: "admin"},
  ]) {
    assert.throws(
      () => parseShiftPlanningNotificationExecutionCommand(invalid),
      (error) => error.code === "invalid_planning_transaction",
    );
  }
});

test("declares only the existing invoker-only operator", () => {
  assert.equal(
    SHIFT_PLANNING_NOTIFICATION_HTTPS_OPTIONS.invoker,
    SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
  );
  const cloudFunction = createShiftPlanningNotificationHttpFunction(
    {execute: async () => ({})},
    createAuditLogger().logger,
  );
  assert.deepEqual(cloudFunction.__endpoint.httpsTrigger.invoker, [
    SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
  ]);
  assert.equal(
    Object.hasOwn(SHIFT_PLANNING_NOTIFICATION_HTTPS_OPTIONS, "serviceAccount"),
    false,
  );
});

test("returns a minimal busy result and sanitized audit trail", async () => {
  let received = null;
  const {state, entries} = await invoke({
    executor: {
      async execute(value) {
        received = value;
        return {
          releaseKind: "replayed",
          dispatch: {kind: "busy", retryAtMillis: 1_788_393_930_000},
        };
      },
    },
  });
  assert.deepEqual(received, command);
  assert.equal(state.status, 200);
  assert.deepEqual(state.body, {
    ok: true,
    auditId: "audit-notification-1",
    schemaVersion: 1,
    mode: "notificationReleaseDispatch",
    environment: "develop",
    intentId: "intent-1",
    workerId: "worker-1",
    attemptId: "attempt-1",
    releaseKind: "replayed",
    dispatchKind: "busy",
    retryAtMillis: 1_788_393_930_000,
  });
  assert.deepEqual(entries.map(({level}) => level), ["info", "info"]);
  assert.equal(JSON.stringify(entries).includes("fcmToken"), false);
});

test("returns only stable terminal outcome fields", async () => {
  const {state} = await invoke({
    executor: {
      async execute() {
        return {
          releaseKind: "committed",
          dispatch: {
            kind: "completed",
            attempt: {
              terminal: {
                outcome: "accepted",
                failureCode: null,
                acceptedTargetCount: 2,
              },
            },
          },
        };
      },
    },
  });
  assert.equal(state.status, 200);
  assert.equal(state.body.dispatchKind, "completed");
  assert.equal(state.body.outcome, "accepted");
  assert.equal(state.body.acceptedTargetCount, 2);
  assert.equal("attempt" in state.body, false);
});

test("rejects method, query, and body before execution", async () => {
  let executions = 0;
  const executor = {
    async execute() {
      executions += 1;
      return {};
    },
  };
  assert.equal((await invoke({executor, method: "GET"})).state.status, 405);
  assert.equal(
    (await invoke({executor, query: {environment: "develop"}})).state.status,
    400,
  );
  const malformed = await invoke({
    executor,
    body: {...command, memberName: "Sensitive Member"},
  });
  assert.equal(malformed.state.status, 400);
  assert.equal(JSON.stringify(malformed).includes("Sensitive Member"), false);
  assert.equal(executions, 0);
});

test("treats every escaped execution failure as unknown", async () => {
  const planningFailure = await invoke({
    executor: {
      async execute() {
        throw new ShiftPlanningError(
          "maintenance_state_conflict",
          "private state detail",
        );
      },
    },
  });
  assert.equal(planningFailure.state.status, 500);
  assert.equal(planningFailure.state.body.error.code, "internal");
  assert.equal(
    JSON.stringify(planningFailure).includes("private state detail"),
    false,
  );

  const unknown = await invoke({
    executor: {
      async execute() {
        throw new Error("private transport acknowledgement");
      },
    },
  });
  assert.equal(unknown.state.status, 500);
  assert.equal(unknown.state.body.error.code, "internal");
  assert.match(unknown.state.body.error.message, /outcome is unknown/);
  assert.equal(JSON.stringify(unknown).includes("private transport"), false);
});

test("runtime construction performs no Firebase IO", () => {
  const forbiddenAuthority = new Proxy({}, {
    get() {
      assert.fail("Firebase authority accessed during construction");
    },
  });

  const runtime = createFirebaseShiftPlanningNotificationRuntime({
    firestore: forbiddenAuthority,
    messaging: forbiddenAuthority,
  });

  assert.equal(typeof runtime.execute, "function");
});

test("runtime binds modular Messaging but remains absent from index", () => {
  const runtime = readFileSync(
    join(__dirname, "../src/shift-planning-firebase-notification-runtime.ts"),
    "utf8",
  );
  const index = readFileSync(join(__dirname, "../src/index.ts"), "utf8");

  assert.match(
    runtime,
    /createFirebaseShiftPlanningNotificationTransport\(\s*dependencies\.messaging/,
  );
  assert.match(
    runtime,
    /createFirestoreShiftPlanningNotificationReleaseRepository/,
  );
  assert.match(
    runtime,
    /createFirestoreShiftPlanningNotificationDispatchRepository/,
  );
  assert.doesNotMatch(index, /shift-planning-firebase-notification-runtime/);
  assert.doesNotMatch(index, /createShiftPlanningNotificationHttpFunction/);
});
