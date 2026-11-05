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
