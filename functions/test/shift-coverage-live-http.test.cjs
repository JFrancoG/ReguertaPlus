"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {executeShiftCoverageAccessRequest, executeShiftCoverageRequest} = require("../lib/shift-coverage-live-http.js");
const {resolveReviewerEnvironment} = require("../lib/backend-security.js");

const access = {schemaVersion: 1, environment: "production"};
const command = {...access, action: "accept", caseId: "case", operationId: "op",
  expectedRevision: 1, expectedShiftRevision: 1};
const forbiddenDependencies = () => {
  const calls = [];
  return {calls, dependencies: {
    verifyIdentity: async () => { calls.push("auth"); throw new Error("Unexpected authentication"); },
    resolveEnvironment: async () => { calls.push("routing"); throw new Error("Unexpected routing"); },
    serviceFor: () => { calls.push("service"); throw new Error("Unexpected SDK composition"); },
  }};
};
const request = (body, extra = {}) => ({method: "POST", query: {}, body, ...extra});

test("access rejects transport and extra identity fields before authentication or SDK composition", async () => {
  for (const value of [null, [], {}, {...access, actorId: "admin"}, {...access, memberId: "other"},
    {...access, schemaVersion: 2}, {...access, environment: "PRODUCTION"}, {...access, enabled: true}]) {
    const {calls, dependencies} = forbiddenDependencies();
    await assert.rejects(executeShiftCoverageAccessRequest(request(value), dependencies), {status: 400});
    assert.deepEqual(calls, []);
  }
  for (const [extra, status] of [[{method: "GET"}, 405], [{query: {environment: "develop"}}, 400]]) {
    const {calls, dependencies} = forbiddenDependencies();
    await assert.rejects(executeShiftCoverageAccessRequest(request(access, extra), dependencies), {status});
    assert.deepEqual(calls, []);
  }
});

test("coverage rejects smuggled actors, unknown fields and malformed actions before authentication", async () => {
  for (const value of [null, [], {...command, actorMemberId: "admin"}, {...command, creditId: "gift"},
    {...command, environment: "staging"}, {...command, environment: "PRODUCTION"}, {...command, action: "publish"},
    {...access, action: "overview", userId: "other"}, {...access, action: "administration", enabled: true},
    {...access, action: "reconcileMembership", userId: "other"}]) {
    const {calls, dependencies} = forbiddenDependencies();
    await assert.rejects(executeShiftCoverageRequest(request(value), dependencies), {status: 400});
    assert.deepEqual(calls, []);
  }
  for (const [extra, status] of [[{method: "DELETE"}, 405], [{query: {uid: "admin"}}, 400]]) {
    const {calls, dependencies} = forbiddenDependencies();
    await assert.rejects(executeShiftCoverageRequest(request(command, extra), dependencies), {status});
    assert.deepEqual(calls, []);
  }
});

test("reviewer environment changes require a refreshed canonical context and never compose another service", async () => {
  for (const [execute, body] of [[executeShiftCoverageAccessRequest, access], [executeShiftCoverageRequest, command]]) {
    const identity = {uid: "reviewer", email: "reviewer@example.test", emailVerified: true};
    const calls = [];
    await assert.rejects(execute(request(body), {
      verifyIdentity: async () => identity,
      resolveEnvironment: async (environment, actor) => {
        calls.push([environment, actor.uid]);
        return resolveReviewerEnvironment(environment, actor, {reviewerAllowlistUids: [identity.uid]});
      },
      serviceFor: () => { throw new Error("A redirected service must never be constructed"); },
    }), {status: 409, code: "coverage_environment_changed"});
    assert.deepEqual(calls, [["production", "reviewer"]]);
  }
});

test("administrative delivery rejects forged actors and incomplete recovery targets before authentication", async () => {
  const query = {...access, action: "deliveryIncidents"};
  const resume = {...access, action: "retryDelivery", mode: "resume", effectOperationId: "completion"};
  const retry = {...resume, mode: "retryPush", memberId: "member", eventId: "event",
    expectedAttemptId: "prior", operationId: "admin-decision"};
  for (const body of [{...query, actorId: "admin"}, {...query, after: "develop/private"}, {...resume, force: true},
    {...retry, expectedAttemptId: null}, {...retry, operationId: undefined}, {...retry, mode: "inspect"}]) {
    const {calls, dependencies} = forbiddenDependencies();
    await assert.rejects(executeShiftCoverageRequest(request(body), dependencies), {status: 400});
    assert.deepEqual(calls, []);
  }
  for (const body of [query, {...query, after: "cursor"}, resume, {...resume, mode: "inspect"}, retry]) {
    const identity = {uid: "linked-admin"};
    const result = await executeShiftCoverageRequest(request(body), {verifyIdentity: async () => identity,
      resolveEnvironment: async () => body.environment, serviceFor: (environment) => ({
        administerDelivery: (parsed, actor) => { assert.equal(environment, body.environment);
          assert.deepEqual(parsed, body); assert.equal(actor, identity); return "routed"; },
      })});
    assert.equal(result, "routed");
  }
});

test("the deployment opt-in admits only Develop and closed triggers never open a database transaction", async () => {
  const {createDevelopCoverageAdmission} = require("../lib/shift-coverage-activation.js");
  const {createShiftCoverageDeliveryEventHandler} = require("../lib/shift-coverage-delivery.js");
  for (const value of [undefined, "[]", "{}", "unparsed", '["a","a"]', '["a/b"]']) {
    assert.equal(createDevelopCoverageAdmission({SHIFT_COVERAGE_DEVELOP_ENABLED: "true",
      SHIFT_COVERAGE_DEVELOP_MEMBERS: value}).allows("develop"), false);
  }
  for (const setting of [undefined, "", "false", "TRUE", "production", "true"]) {
    const {allows: operationalReady} = createDevelopCoverageAdmission({SHIFT_COVERAGE_DEVELOP_ENABLED: setting,
      SHIFT_COVERAGE_DEVELOP_MEMBERS: '["member"]'});
    assert.equal(operationalReady("develop"), setting === "true");
    assert.equal(operationalReady("production"), false);
    const handle = createShiftCoverageDeliveryEventHandler({operationalReady,
      firestore: {runTransaction: () => assert.fail("closed worker reached Firestore")},
      deliveryFor: () => assert.fail("closed worker reached delivery")});
    for (const environment of ["production", "invalid", ...(setting === "true" ? [] : ["develop"])]) {
      await handle({kind: "effect", environment, operationId: "effect"});
      await handle({kind: "inbox", environment, memberId: "member", eventId: "coverage-event", coverageOperationId: "effect"});
    }
  }
});
