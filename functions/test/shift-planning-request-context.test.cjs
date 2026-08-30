const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  buildShiftPlanningRequestContext,
  executeShiftPlanningRequestContextRequest,
  parseShiftPlanningRequestContextInput,
} = require("../lib/shift-planning-request-context.js");

const activeDigest = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const openState = {
  schemaVersion: 1,
  stateRevision: 7,
  maintenanceStatus: "open",
  writeEpoch: 3,
  activeRevision: "bundle-2026-27-r1",
  activeDigest,
  intakeBarrier: null,
  lastTransitionId: "activate-2026-27-r1",
};

test("returns only the request fields needed by a v2 client", () => {
  const input = parseShiftPlanningRequestContextInput({
    schemaVersion: 1,
    environment: "production",
  });
  assert.deepEqual(input, {
    schemaVersion: 1,
    environment: "production",
  });
  assert.deepEqual(buildShiftPlanningRequestContext(input, openState), {
    schemaVersion: 1,
    environment: "production",
    expectedWriteEpoch: 3,
    expectedActiveRevision: "bundle-2026-27-r1",
  });
});

test("rejects malformed input and unavailable planning state", () => {
  for (const invalid of [
    {schemaVersion: 2, environment: "develop"},
    {schemaVersion: 1, environment: "staging"},
    {schemaVersion: 1, environment: "develop", memberId: "forged"},
  ]) {
    assert.throws(
      () => parseShiftPlanningRequestContextInput(invalid),
      (error) => error.code === "invalid_shift_planning_context",
    );
  }
  assert.throws(
    () => buildShiftPlanningRequestContext({
      schemaVersion: 1,
      environment: "develop",
    }, undefined),
    (error) => error.code === "shift_planning_state_unavailable",
  );
  assert.throws(
    () => buildShiftPlanningRequestContext({
      schemaVersion: 1,
      environment: "develop",
    }, {...openState, writeEpoch: "3"}),
    (error) => error.code === "invalid_shift_planning_state",
  );
  assert.throws(
    () => buildShiftPlanningRequestContext({
      schemaVersion: 1,
      environment: "develop",
    }, {
      ...openState,
      maintenanceStatus: "closed",
      intakeBarrier: {
        revision: "barrier-1",
        digest: activeDigest,
        verifiedAtMillis: 1_798_000_000_000,
      },
    }),
    (error) => error.code === "shift_planning_maintenance",
  );
});

test("authorizes the exact environment before resolving context", async () => {
  const calls = [];
  const result = await executeShiftPlanningRequestContextRequest({
    method: "POST",
    query: {},
    body: {schemaVersion: 1, environment: "develop"},
  }, {
    verifyIdentity: async () => {
      calls.push("verify");
      return {uid: "admin-uid", email: null, emailVerified: false};
    },
    requireAdmin: async (environment, identity) => {
      calls.push(`admin:${environment}:${identity.uid}`);
    },
    resolveContext: async (input) => {
      calls.push(`resolve:${input.environment}`);
      return buildShiftPlanningRequestContext(input, openState);
    },
  });
  assert.deepEqual(calls, [
    "verify",
    "admin:develop:admin-uid",
    "resolve:develop",
  ]);
  assert.deepEqual(result, {
    schemaVersion: 1,
    environment: "develop",
    expectedWriteEpoch: 3,
    expectedActiveRevision: "bundle-2026-27-r1",
  });
});

test("rejects transport shape before authentication or Firestore", async () => {
  let effects = 0;
  const dependencies = {
    verifyIdentity: async () => {
      effects += 1;
      return {uid: "admin-uid", email: null, emailVerified: false};
    },
    requireAdmin: async () => {
      effects += 1;
    },
    resolveContext: async () => {
      effects += 1;
      return {};
    },
  };
  for (const request of [
    {method: "GET", query: {}, body: {}},
    {
      method: "POST",
      query: {environment: "develop"},
      body: {schemaVersion: 1, environment: "develop"},
    },
    {
      method: "POST",
      query: {},
      body: {schemaVersion: 1, environment: "develop", uid: "forged"},
    },
  ]) {
    await assert.rejects(
      executeShiftPlanningRequestContextRequest(request, dependencies),
    );
  }
  assert.equal(effects, 0);
});
