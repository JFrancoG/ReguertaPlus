"use strict";

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {test} = require("node:test");

const {
  createShiftPlanningNotificationReleaseDispatchExecutor,
} = require(
  "../lib/shift-planning-notification-release-dispatch-executor.js"
);

const command = (overrides = {}) => ({
  environment: "develop",
  intentId: "intent-1",
  workerId: "worker-1",
  attemptId: "attempt-1",
  ...overrides,
});

const harness = (options = {}) => {
  const calls = [];
  const releaseRepository = {
    async release(input) {
      calls.push({kind: "release", input});
      if (options.releaseError) throw options.releaseError;
      return {
        kind: options.releaseKind ?? "committed",
        artifacts: {eventId: options.releaseEventId ?? input.intentId},
      };
    },
  };
  const dispatchExecutor = {
    async execute(input) {
      calls.push({kind: "dispatch", input});
      return options.dispatchResult ?? {
        kind: "busy",
        retryAtMillis: 1_788_393_930_000,
      };
    },
  };
  return {
    calls,
    executor: createShiftPlanningNotificationReleaseDispatchExecutor({
      releaseRepository,
      dispatchExecutor,
    }),
  };
};

test("validates the complete command before releasing an event", async () => {
  for (const invalid of [
    {environment: "staging"},
    {intentId: ""},
    {workerId: "worker with spaces"},
    {attemptId: "attempt/with/slash"},
  ]) {
    const current = harness();
    await assert.rejects(
      current.executor.execute(command(invalid)),
      (error) => error.code === "invalid_planning_transaction",
    );
    assert.deepEqual(current.calls, []);
  }
});

test("releases before dispatching one exact attempt", async () => {
  const dispatchResult = {
    kind: "completed",
    attempt: {attemptId: "attempt-1", state: "terminal"},
  };
  const current = harness({dispatchResult});

  assert.deepEqual(await current.executor.execute(command()), {
    releaseKind: "committed",
    dispatch: dispatchResult,
  });
  assert.deepEqual(current.calls, [
    {
      kind: "release",
      input: {environment: "develop", intentId: "intent-1"},
    },
    {kind: "dispatch", input: command()},
  ]);
});

test("an exact release replay still converges through dispatch", async () => {
  const current = harness({releaseKind: "replayed"});

  assert.deepEqual(await current.executor.execute(command()), {
    releaseKind: "replayed",
    dispatch: {kind: "busy", retryAtMillis: 1_788_393_930_000},
  });
  assert.equal(current.calls.filter(({kind}) => kind === "dispatch").length, 1);
});

test("release failure or drift prevents any dispatch attempt", async () => {
  const failed = harness({releaseError: new Error("release unavailable")});
  await assert.rejects(
    failed.executor.execute(command()),
    /release unavailable/,
  );
  assert.deepEqual(failed.calls.map(({kind}) => kind), ["release"]);

  const drifted = harness({releaseEventId: "event-2"});
  await assert.rejects(
    drifted.executor.execute(command()),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.deepEqual(drifted.calls.map(({kind}) => kind), ["release"]);
});

test("composition stays outside the exported Firebase runtime", () => {
  const source = readFileSync(join(__dirname, "../src/index.ts"), "utf8");

  assert.doesNotMatch(
    source,
    /shift-planning-notification-release-dispatch-executor/,
  );
  assert.doesNotMatch(
    source,
    /createShiftPlanningNotificationReleaseDispatchExecutor/,
  );
});
