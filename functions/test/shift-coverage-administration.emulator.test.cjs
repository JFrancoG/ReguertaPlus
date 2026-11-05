"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {startProvisionalShiftCoverageServer} = require("../lib/shift-coverage-local-server.js");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_COVERAGE_POLICY_REVISION} = require("../lib/shift-coverage.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");
const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections";
const enabled = process.env.GCLOUD_PROJECT === projectId && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798" &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9098";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
let db, server, adminApp, auth, now, tokens, sequence;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const hash = (type, id) => digest([type, id]).split(":").at(-1);
const query = {schemaVersion: 1, environment: "develop", action: "administration"};
const call = async (actor, body = query) => {
  const response = await fetch(server.url, {method: "POST", headers: {
    authorization: `Bearer ${tokens[actor]}`, "Content-Type": "application/json"}, body: JSON.stringify(body)});
  return {status: response.status, value: await response.json()};
};
const view = async () => {
  const response = await call("admin");
  assert.equal(response.status, 200, JSON.stringify(response.value)); return response.value.data;
};
const intent = async (userId = "d", extra = {}) => {
  const member = (await view()).members.find((row) => row.userId === userId);
  assert.ok(member);
  return {...query, action: "reconcileMembership", operationId: `admin-${++sequence}`, userId,
    expectedRevision: member.membershipRevision, expectedContextDigest: member.contextDigest, ...extra};
};
const execute = async (userId = "d", extra = {}) => {
  const command = await intent(userId, extra); const response = await call("admin", command);
  assert.equal(response.status, 200, JSON.stringify(response.value)); return {command, receipt: response.value.data};
};
const capture = async () => {
  const result = [];
  for (const collection of (await db.doc(root).listCollections()).sort((a, b) => a.id.localeCompare(b.id))) {
    result.push([collection.id, (await collection.orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()])]);
  }
  return result;
};
const seedCredit = async () => {
  await ref("shiftCoverageCredits", "earned-service").set({schemaVersion: 1,
    policyRevision: SHIFT_COVERAGE_POLICY_REVISION, id: "earned-service", caseId: "earned-service",
    shiftId: "completed-delivery", type: "delivery", userId: "d", state: "pending",
    earnedAtMillis: now - 1000, completionRevision: 1});
  await ref("shiftCoverageMemberClaims", hash("delivery", "d")).set({
    type: "delivery", userId: "d", caseId: "earned-service", state: "creditPending"});
  await ref("shiftCoverageLedgerState", "delivery").set({revision: 1});
};
before(async () => {
  if (!enabled) return;
  db = createProvisionalCreditFirestore();
  adminApp = initializeApp({projectId}, "hu084-administration-auth"); auth = getAuth(adminApp);
  server = await startProvisionalShiftCoverageServer({nowMillis: () => now,
    maximumOfferWindowMillis: 60_000, selectionPolicy: {version: "hu089-provisional-v1"}}, 0);
});
after(async () => { if (server) await server.close(); if (db) await db.terminate();
  if (adminApp) await deleteApp(adminApp); });
beforeEach(async () => {
  if (!enabled) return;
  await db.recursiveDelete(db.doc(root));
  assert.equal((await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`, {method: "DELETE"})).ok, true);
  now = initialTime; sequence = 0; tokens = {};
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const id of ["a", "b", "c", "d", "admin"]) {
    await auth.createUser({uid: `auth-${id}`, email: `${id}@example.test`, password: "local-admin-password", emailVerified: true});
    const signed = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: `${id}@example.test`, password: "local-admin-password", returnSecureToken: true})});
    assert.equal(signed.ok, true); tokens[id] = (await signed.json()).idToken;
    await ref("authLinks", `auth-${id}`).set({memberId: id});
    await ref("users", id).set({displayName: `Member ${id}`, authUid: `auth-${id}`, isActive: true,
      isCommonPurchaseManager: false, roles: id === "admin" ? ["member", "admin"] : ["member"]});
  }
  for (const type of ["delivery", "market"]) {
    await ref("shiftRotations", type).set({schemaVersion: 1, type, stateRevision: 4,
      cursor: {schemaVersion: 1, type, cohortUserIds: ["a", "b", "c"], roundNumber: 1, nextMemberIndex: 1},
      planningFrontierSeasonStartYear: 2027, cohortFrozen: true, frozenCohortUserIds: ["a", "b", "c"],
      activeRevision: "active-1", activeDigest, lastIdempotencyKey: null, migrationBaseline: null, releaseLease: null});
  }
});

run("authenticated administration is role-bound and omits private reasons and accounting documents", async () => {
  await seedCredit(); await ref("users", "d").update({isActive: false});
  await execute("d", {permanentDepartureReason: "Private departure reason"});
  const prior = await capture(); const result = await view();
  assert.equal(result.isAdmin, true); assert.equal(result.membershipWritable, true);
  assert.equal(result.spacingUnavailableReason, "no_planning_request");
  const member = result.members.find((row) => row.userId === "d");
  assert.equal(member.sourceActive, false); assert.equal(member.permanentDeparture, true);
  assert.equal(member.credits.find((row) => row.type === "delivery").cancelledCount, 1);
  for (const privateValue of ["Private departure reason", "authUid", "earned-service", "cancelledByMembershipOperationId"]) {
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  }
  assert.equal((await call("a")).status, 403);
  assert.deepEqual(await capture(), prior);
});

run("reconciliation admits both reserves and exact replay retains FIFO and minimal receipt", async () => {
  const {command, receipt} = await execute();
  assert.deepEqual(Object.keys(receipt).sort(), ["action", "environment", "exceptionId", "membershipRevision", "operationId", "replayed", "schemaVersion", "userId"]);
  assert.equal(receipt.membershipRevision, 1); assert.equal(receipt.exceptionId, null);
  for (const type of ["delivery", "market"]) {
    const reserve = await read("shiftCoverageReserves", hash(type, "d"));
    assert.equal(reserve.active, true); assert.equal(reserve.admissionAfterRound, 1);
  }
  now += 1000; const prior = await capture();
  const replay = await call("admin", command);
  assert.equal(replay.status, 200); assert.equal(replay.value.data.replayed, true);
  assert.deepEqual(await capture(), prior);
  const noChange = await execute(); assert.equal(noChange.receipt.membershipRevision, 1);
});

run("source/accounting/authority drift rejects stale confirmations without partial mutation", async () => {
  for (const drift of ["source", "credit", "authority"]) {
    const command = await intent();
    if (drift === "source") await ref("users", "d").update({isActive: false});
    if (drift === "credit") await seedCredit();
    if (drift === "authority") await ref("shiftPlanningState", "current").update({stateRevision: 2});
    const prior = await capture(); const response = await call("admin", command);
    assert.equal(response.status, 409); assert.equal(response.value.code, "administration_context_changed");
    assert.deepEqual(await capture(), prior);
  }
});

run("inactivity preserves credits; explicit permanent departure cancels them once; reentry never restores history", async () => {
  await seedCredit(); await execute(); await ref("users", "d").update({isActive: false});
  await execute(); assert.equal((await read("shiftCoverageCredits", "earned-service")).state, "pending");
  const {command} = await execute("d", {permanentDepartureReason: "Confirmed permanent departure"});
  assert.equal((await read("users", "d")).isActive, false);
  assert.equal((await read("shiftCoverageCredits", "earned-service")).state, "cancelled");
  assert.equal((await read("shiftCoverageMemberClaims", hash("delivery", "d"))).state, "released");
  assert.equal((await read("shiftCoverageLedgerState", "delivery")).revision, 2);
  assert.equal((await call("admin", command)).value.data.replayed, true);
  await ref("users", "d").update({isActive: true}); now += 1000; await execute();
  const member = (await view()).members.find((row) => row.userId === "d");
  assert.equal(member.permanentDeparture, false); assert.equal(member.sourceActive, true);
  assert.equal(member.credits.find((row) => row.type === "delivery").cancelledCount, 1);
  assert.equal((await read("shiftCoverageReserves", hash("delivery", "d"))).enteredAtMillis, now);
});

run("deleted source remains manageable through history and active members cannot be declared departed", async () => {
  const bad = await intent("d", {permanentDepartureReason: "Never deactivate implicitly"});
  const prior = await capture(); assert.equal((await call("admin", bad)).status, 409);
  assert.deepEqual(await capture(), prior);
  await seedCredit(); await ref("users", "d").delete();
  const member = (await view()).members.find((row) => row.userId === "d");
  assert.equal(member.sourceActive, null);
  await execute("d", {permanentDepartureReason: "Explicit removed member departure"});
  assert.equal((await read("shiftCoverageCredits", "earned-service")).state, "cancelled");
  assert.equal(await read("users", "d"), undefined);
});

run("ordinary due date derives reserve exit and administration persists it without changing published assignments", async () => {
  await execute(); const id = "shift_delivery_20270901";
  await ref("shifts", id).set(materialize(id, "delivery", "2027-09-01", ["d"], "b", 2));
  const beforeShift = await read("shifts", id);
  assert.equal((await view()).members.find((row) => row.userId === "d").reserves.find((row) => row.type === "delivery").active, true);
  now = Date.parse("2027-09-01T00:00:00Z");
  const member = (await view()).members.find((row) => row.userId === "d");
  assert.equal(member.reserves.find((row) => row.type === "delivery").active, false);
  assert.equal((await read("shiftCoverageReserves", hash("delivery", "d"))).active, true);
  await execute();
  assert.equal((await read("shiftCoverageReserves", hash("delivery", "d"))).active, false);
  assert.equal((await read("shiftCoverageReserves", hash("market", "d"))).active, true);
  assert.deepEqual(await read("shifts", id), beforeShift);
});

for (const drift of ["role", "unlink", "wrongLink", "authDisabled"]) run(`administrative command and replay reject ${drift} after token issuance`, async () => {
  const {command} = await execute();
  if (drift === "role") await ref("users", "admin").update({roles: ["member"]});
  if (drift === "unlink") await ref("authLinks", "auth-admin").delete();
  if (drift === "wrongLink") await ref("authLinks", "auth-admin").set({memberId: "a"});
  if (drift === "authDisabled") await auth.updateUser("auth-admin", {disabled: true});
  const prior = await capture();
  assert.notEqual((await call("admin", command)).status, 200);
  assert.notEqual((await call("admin", {...command, operationId: "new-operation"})).status, 200);
  assert.notEqual((await call("admin")).status, 200);
  assert.deepEqual(await capture(), prior);
});

run("forged actor, unknown fields, malformed pair and policy optout never execute administrative writes", async () => {
  const command = await intent();
  for (const extra of [{actorMemberId: "admin"}, {environment: "production"}, {expectedContextDigest: "guess"}, {manualReserve: true}]) {
    const prior = await capture(); assert.equal((await call("admin", {...command, ...extra})).status, 400);
    assert.deepEqual(await capture(), prior);
  }
  const old = await startProvisionalShiftCoverageServer({nowMillis: () => now,
    maximumOfferWindowMillis: 60_000}, 0);
  try {
    const response = await fetch(old.url, {method: "POST", headers: {
      authorization: `Bearer ${tokens.admin}`, "Content-Type": "application/json"}, body: JSON.stringify(query)});
    assert.equal(response.status, 409); assert.equal((await response.json()).code, "administration_policy_unavailable");
  } finally { await old.close(); }
});
