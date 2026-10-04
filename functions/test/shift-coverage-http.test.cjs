"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftCoverageHttpHandler} = require("../lib/shift-coverage-http.js");
const {projectShiftCoverageCase, parseShiftCoverageQuery} = require("../lib/shift-coverage-client.js");
const {HttpRequestError} = require("../lib/backend-security.js");
const command = {schemaVersion: 1, environment: "develop", action: "accept", caseId: "case",
  operationId: "op", expectedRevision: 2, expectedShiftRevision: 1};
const call = async (deps = {}, request = {}) => {
  const calls = []; const headers = {}; let status, body;
  const handle = createShiftCoverageHttpHandler({requireLocalEnvironment: () => {},
    verifyToken: async (token, revoked) => { calls.push(["verify", token, revoked]); return {uid: "verified"}; },
    execute: async (value, identity) => { calls.push(["execute", value, identity]);
      return {case: {id: "case", revision: 3, reason: "private", selection: {snapshot: ["private"]}}, replayed: false}; },
    read: async (value, identity) => { calls.push(["read", value, identity]); return {memberId: "member"}; }, ...deps});
  await handle({method: "POST", headers: {authorization: "Bearer token"}, query: {}, body: command, ...request},
    {setHeader: (key, value) => { headers[key] = value; }, status: (value) => { status = value;
      return {json: (value) => { body = value; }}; }, json: (value) => { body = value; }});
  return {status, body, headers, calls};
};

test("HTTP verifies revoked tokens, binds identity and returns only command acknowledgement", async () => {
  const result = await call();
  assert.deepEqual(result.calls[0], ["verify", "token", true]);
  assert.equal(result.calls[1][2].uid, "verified");
  assert.deepEqual(result.body, {ok: true, data: {schemaVersion: 1, environment: "develop", operationId: "op",
    caseId: "case", revision: 3, replayed: false}});
  assert.equal(result.headers["Cache-Control"], "no-store");
});

test("invalid transport, forged identity/environment and unknown fields never execute", async () => {
  for (const request of [{body: {...command, actorMemberId: "admin"}}, {body: {...command, environment: "production"}},
    {body: {...command, creditId: "gift"}}, {body: {...command, action: "reconcileMembership"}}, {query: {uid: "admin"}},
    {body: {schemaVersion: 1, environment: "develop", action: "overview", userId: "other"}}]) {
    const result = await call({}, request); assert.equal(result.status, 400);
    assert.equal(result.calls.some(([kind]) => kind === "execute" || kind === "read"), false);
  }
  const method = await call({}, {method: "GET"}); assert.equal(method.status, 405); assert.deepEqual(method.calls, []);
  assert.equal(method.headers.Allow, "POST");
  const missing = await call({}, {headers: {}}); assert.equal(missing.status, 401); assert.deepEqual(missing.calls, []);
});

test("token failures and environment drift fail closed; arbitrary infrastructure errors never echo private details", async () => {
  const failed = await call({verifyToken: async () => { throw new Error("secret token"); }});
  assert.deepEqual(failed.body, {ok: false, code: "unauthenticated"});
  let checks = 0;
  const drift = await call({requireLocalEnvironment: () => {
    if (++checks === 2) throw new HttpRequestError(409, "local_required", "private configuration"); }});
  assert.equal(drift.status, 409); assert.equal(drift.calls.length, 1);
  const broken = await call({execute: async () => { throw new Error("token, user, candidate snapshot"); }});
  assert.equal(broken.status, 500); assert.deepEqual(broken.body, {ok: false, code: "coverage_unavailable"});
});

test("overview and detail have exact read-only envelopes and cannot supply another member identity", async () => {
  for (const body of [{schemaVersion: 1, environment: "develop", action: "overview"},
    {schemaVersion: 1, environment: "develop", action: "detail", caseId: "case"}]) {
    assert.deepEqual(parseShiftCoverageQuery(body), body);
    const result = await call({}, {body}); assert.equal(result.status, 200); assert.equal(result.calls[1][0], "read");
  }
  for (const value of [null, [], {schemaVersion: 1, environment: "production", action: "overview"},
    {schemaVersion: 1, environment: "develop", action: "detail", caseId: "../other"}]) {
    assert.throws(() => parseShiftCoverageQuery(value));
  }
});

test("member/admin projections omit private snapshots and expose only the relevant offer and own volunteering", () => {
  const value = {id: "case", shiftId: "shift", type: "market", positionIndex: 0, status: "offered", revision: 2,
    absentUserId: "absent", openedByUserId: "admin", acceptedUserId: null, reason: "private reason", updatedAtMillis: 20,
    ownershipDigest: "private digest", offer: {userId: "offered", source: "reserve", expiresAtMillis: 100,
      id: "internal", assignmentContextDigest: "internal"}, selection: {phase: "volunteers", snapshot: ["excluded"],
      latestExclusions: ["medical reason"], draw: {order: ["secret"]}, volunteerClosesAtMillis: 80,
      volunteers: [{userId: "member", withdrawn: false}, {userId: "other", withdrawn: true}]}};
  const project = (memberId, admin = false) => projectShiftCoverageCase({value, memberId, admin,
    scheduledAtMillis: 200, shiftRevision: 1, writable: true});
  const member = project("member"); assert.equal(member.offer, null); assert.equal(member.administration, null);
  assert.equal(member.volunteered, true); assert.equal(project("other").volunteered, false);
  assert.deepEqual(project("offered").offer, {userId: "offered", source: "reserve", expiresAtMillis: 100});
  assert.deepEqual(project("admin", true).administration, {openedByUserId: "admin", reason: "private reason", volunteerCount: 1});
  for (const role of [member, project("admin", true)]) {
    assert.equal(JSON.stringify(role).includes("excluded"), false);
    assert.equal(JSON.stringify(role).includes("secret"), false);
    assert.equal(JSON.stringify(role).includes("Digest"), false);
  }
});

test("the actual local app factory cannot create Auth or Firestore clients outside the fixed emulators", () => {
  const {createProvisionalShiftCoverageApp} = require("../lib/shift-coverage-provisional-app.js");
  const saved = {...process.env};
  try {
    for (const [project, firestore, auth] of [["production", "127.0.0.1:8798", "127.0.0.1:9098"],
      ["demo-reguerta-hu084-coverage", "localhost:8798", "127.0.0.1:9098"],
      ["demo-reguerta-hu084-coverage", "127.0.0.1:8798", "localhost:9098"]]) {
      process.env.GCLOUD_PROJECT = project; process.env.FIRESTORE_EMULATOR_HOST = firestore; process.env.FIREBASE_AUTH_EMULATOR_HOST = auth;
      assert.throws(() => createProvisionalShiftCoverageApp({nowMillis: () => 0, maximumOfferWindowMillis: 100}));
    }
  } finally {
    for (const key of ["GCLOUD_PROJECT", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
