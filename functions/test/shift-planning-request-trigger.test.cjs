"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");
const {createVersionedShiftPlanningRequestTrigger} =
  require("../lib/shift-planning-request-trigger.js");
const {resolvePrivilegedFirestoreEventAuthorization} =
  require("../lib/backend-security.js");

const request = () => ({
  schemaVersion: 2,
  requestId: "preview-a",
  bundleId: "bundle-a",
  environment: "develop",
  requestedByUserId: "admin-a",
  requestedAt: Timestamp.fromMillis(1_788_393_800_000),
  mode: "preview",
  status: "requested",
  expectedWriteEpoch: 7,
  expectedActiveRevision: null,
  subplans: {
    delivery: {targetSeasonStartYear: 2026},
    market: {targetSeasonStartYear: 2026},
  },
  binding: null,
});
const event = (data = request()) => ({
  id: "event-a",
  params: {env: "develop", requestId: "preview-a"},
  authType: "system",
  data: {data: () => data},
});

test("v2 trigger retries transport and busy leases until a terminal result", async () => {
  const calls = [];
  const trigger = createVersionedShiftPlanningRequestTrigger({
    async executeRequest(input) {
      calls.push(input);
      if (calls.length === 1) throw new Error("transient Firestore outage");
      if (calls.length === 2) return {
        kind: "lifecycle", result: {kind: "busy", retryAfterMillis: 1_000},
      };
      return {kind: "lifecycle", result: {kind: "terminalReplay"}};
    },
  }, async () => true);
  assert.equal(trigger.__endpoint.eventTrigger.retry, true);
  await assert.rejects(trigger.run(event()), /transient Firestore outage/);
  await assert.rejects(trigger.run(event()), /live worker/);
  await trigger.run(event());
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(({requestId}) => requestId), [
    "preview-a", "preview-a", "preview-a",
  ]);
  assert.equal(new Set(calls.map(({workerId}) => workerId)).size, 3);
});

test("mobile v2 authorization retries unavailable lookup without accepting a denied admin", async () => {
  const unavailable = new Error("identity lookup unavailable");
  let outcome = "unavailable";
  const resolvedUids = [];
  const executions = [];
  const trigger = createVersionedShiftPlanningRequestTrigger({
    async executeRequest(input) {
      executions.push(input.requestId);
      return {kind: "lifecycle", result: {kind: "terminalReplay"}};
    },
  }, (_environment, authType, authId) =>
    resolvePrivilegedFirestoreEventAuthorization({authType, authId}, async (uid) => {
      resolvedUids.push(uid);
      if (outcome === "unavailable") throw unavailable;
      return outcome === "admin";
    }));
  const mobileEvent = {...event(), authType: "unknown", authId: "admin-uid"};

  await assert.rejects(trigger.run(mobileEvent), (error) => error === unavailable);
  assert.deepEqual(executions, []);
  outcome = "admin";
  await trigger.run(mobileEvent);
  assert.deepEqual(executions, ["preview-a"]);
  outcome = "denied";
  await trigger.run(mobileEvent);
  assert.deepEqual(executions, ["preview-a"], "A real denial never invokes runtime");
  assert.deepEqual(resolvedUids, ["admin-uid", "admin-uid", "admin-uid"]);
});

test("v2 retry delivery excludes legacy, malformed, path-mismatched and unauthorized work", async () => {
  let executions = 0;
  let authorized = true;
  const trigger = createVersionedShiftPlanningRequestTrigger({
    async executeRequest() { executions += 1; },
  }, async () => authorized);
  for (const data of [
    {type: "delivery"},
    {...request(), schemaVersion: 3},
    {schemaVersion: 2},
    {...request(), requestId: "different-request"},
  ]) await trigger.run(event(data));
  authorized = false;
  await trigger.run(event());
  assert.equal(executions, 0);
});
