"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftPlanningPublicEventTrigger, readShiftPlanningPublicEventPolicy,
  requiresShiftPlanningPublicEventAudit} = require("../lib/shift-planning-public-event-trigger.js");
const {createShiftPlanningPublicEventRetentionPolicy} = require("../lib/shift-planning-public-event-retention.js");
const {recoveryEventFixture} = require("./shift-planning-recovery-event-fixture.cjs");
const event = (value = recoveryEventFixture()) => ({
  id: value.input.eventId, time: value.input.eventTime.toDate().toISOString(),
  params: {env: "develop", shiftId: value.input.targetPath.split("/").at(-1)},
  authType: "system",
  data: {
    before: {exists: true, ref: {path: value.input.targetPath}, data: () => value.input.before},
    after: {exists: true, ref: {path: value.input.targetPath}, data: () => value.input.after},
  },
});
const setup = (overrides = {}) => {
  const calls = [], logs = [];
  const trigger = createShiftPlanningPublicEventTrigger({
    authorize: async () => true,
    audit: async (input) => { calls.push(input); return {outcome: {kind: "controlledNoOp"}, persistence: "created"}; },
    logger: {error: (...args) => logs.push(args)},
    ...overrides,
  });
  return {calls, logs, trigger};
};

test("raw routing isolates controlled creates, recovery, removed and corrupt markers", () => {
  const value = recoveryEventFixture();
  const {lastBackendMutation, ...unmarked} = value.input.after;
  for (const input of [
    value.input,
    {...value.input, before: null},
    {...value.input, after: null},
    {...value.input, after: unmarked},
    {...value.input, after: {...value.input.after, lastBackendMutation: {}}},
  ]) assert.equal(requiresShiftPlanningPublicEventAudit(input), true);
  for (const input of [
    {...value.input, before: unmarked, after: unmarked},
    {...value.input, before: unmarked, after: null},
    {...value.input, before: value.input.after, after: {...value.input.after, helperUserId: "member-9"}},
  ]) assert.equal(requiresShiftPlanningPublicEventAudit(input), false);
});

test("policy is exact, environment scoped and has no shared fallback", () => {
  const policy = createShiftPlanningPublicEventRetentionPolicy({
    policyRevision: "test-1", maximumDeliveryRetryHorizonMillis: 60_000, safetyMarginMillis: 1_000,
  });
  const variables = {SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP: JSON.stringify(policy)};
  assert.deepEqual(readShiftPlanningPublicEventPolicy("develop", variables), policy);
  assert.throws(() => readShiftPlanningPublicEventPolicy("production", variables));
  for (const raw of [undefined, "", "{", "null", JSON.stringify({...policy, safetyMarginMillis: 2})]) {
    assert.throws(() => readShiftPlanningPublicEventPolicy("develop", {
      SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP: raw,
      SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY: JSON.stringify(policy),
    }));
  }
});

test("exported handler carries stable CloudEvent identity and enables audit retries", async () => {
  const value = recoveryEventFixture();
  const f = setup();
  assert.equal(f.trigger.__endpoint.eventTrigger.retry, true);
  await f.trigger.run(event(value));
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], value.input);
  assert.deepEqual(f.logs, []);
});

test("ordinary and unauthorized events never reach the audit or its policy", async () => {
  const value = recoveryEventFixture();
  value.input.before = value.input.after;
  const f = setup({authorize: async () => { throw new Error("must not run"); }});
  await f.trigger.run(event(value));
  const denied = setup({authorize: async () => false});
  await denied.trigger.run(event());
  assert.equal(f.calls.length + denied.calls.length, 0);
});

for (const dependency of ["authorize", "audit"]) {
  test(`${dependency} outage propagates for retry without recording raw errors`, async () => {
    const error = new Error("private@example.test spreadsheet-private-id");
    let fail = true;
    const f = setup({[dependency]: async () => {
      if (fail) throw error;
      return dependency === "authorize" ? true : {outcome: {kind: "controlledNoOp"}, persistence: "replayed"};
    }});
    await assert.rejects(f.trigger.run(event()), (value) => value === error);
    assert.equal(f.logs[0][1].retryRequired, true);
    assert.doesNotMatch(JSON.stringify(f.logs), /private@example|spreadsheet-private|member-/);
    fail = false;
    await f.trigger.run(event());
  });
}

test("rejection diagnostics follow persistence and remain actionable on replay", async () => {
  const order = [];
  const f = setup({audit: async () => {
    order.push("persisted");
    return {outcome: {kind: "failClosed", failureCode: "invalid_planning_publication_contract"}, persistence: "replayed"};
  }, logger: {error: (_message, data) => {
    order.push("logged"); assert.equal(data.alertRequired, true);
    assert.equal(data.persistence, "replayed");
    assert.deepEqual(Object.keys(data).sort(), ["alertRequired", "component", "environment", "eventCorrelationId", "failureCode", "persistence"]);
  }}});
  await f.trigger.run(event());
  assert.deepEqual(order, ["persisted", "logged"]);
});

test("bad event time or snapshot path cannot acquire durable audit authority", async () => {
  const f = setup();
  const invalidPath = event(); invalidPath.data.after.ref.path = "production/plus-collections/shifts/other";
  for (const input of [{...event(), time: "not a time"}, invalidPath]) {
    await assert.rejects(f.trigger.run(input));
  }
  assert.equal(f.calls.length, 0);
});
