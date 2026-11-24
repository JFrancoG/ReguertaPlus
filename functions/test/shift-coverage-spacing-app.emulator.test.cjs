"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {startProvisionalShiftCoverageServer} = require("../lib/shift-coverage-local-server.js");
const {seedSpacingAdministration} = require("./shift-coverage-spacing-administration-fixture.cjs");
const root = "develop/plus-collections", projectId = "demo-reguerta-hu084-coverage";
const enabled = process.env.GCLOUD_PROJECT === projectId &&
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798" &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9098";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const now = Date.parse("2026-06-01T00:00:00Z");
const query = {schemaVersion: 1, environment: "develop", action: "administration"};
let db, adminApp, auth, server, tokens;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const call = async (actor, body) => {
  const response = await fetch(server.url, {method: "POST", headers: {
    authorization: `Bearer ${tokens[actor]}`, "Content-Type": "application/json"}, body: JSON.stringify(body)});
  return {status: response.status, value: await response.json()};
};
const command = (candidate, operationId = "native-spacing") => ({...query,
  action: "authorizeDeliverySpacingException", operationId,
  userId: candidate.userId, proposalId: candidate.id, expectedContextDigest: candidate.contextDigest,
  planningRequestId: candidate.planningRequestId, previousDate: candidate.previousDate,
  previousRoundNumber: candidate.previousRoundNumber, date: candidate.date, roundNumber: candidate.roundNumber,
  reason: "Evitar un turno vacio por fuerza mayor"});
const capture = async () => {
  const collections = (await db.doc(root).listCollections()).sort((a, b) => a.id.localeCompare(b.id));
  return Promise.all(collections.map(async (collection) => [collection.id,
    (await collection.orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()])]));
};
before(async () => {
  if (!enabled) return;
  db = createProvisionalCreditFirestore();
  adminApp = initializeApp({projectId}, "hu084-spacing-real-auth"); auth = getAuth(adminApp);
  server = await startProvisionalShiftCoverageServer({nowMillis: () => now,
    maximumOfferWindowMillis: 60_000, selectionPolicy: {version: "hu089-provisional-v1"}}, 0);
});
beforeEach(async () => {
  if (!enabled) return;
  await db.recursiveDelete(db.doc(root)); await seedSpacingAdministration(db);
  const existing = await auth.listUsers(1000);
  if (existing.users.length) await auth.deleteUsers(existing.users.map((user) => user.uid));
  tokens = {};
  for (const [actor, memberId] of [["admin", "member-1"], ["member", "member-2"]]) {
    const uid = `spacing-auth-${actor}`, email = `${actor}@example.test`;
    await auth.createUser({uid, email, password: "local-fixture-password", emailVerified: true});
    await ref("authLinks", uid).set({memberId}); await ref("users", memberId).update({authUid: uid});
    const response = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password: "local-fixture-password", returnSecureToken: true})});
    assert.equal(response.ok, true); tokens[actor] = (await response.json()).idToken;
  }
});
after(async () => { if (server) await server.close(); if (adminApp) await deleteApp(adminApp); if (db) await db.terminate(); });

run("real Auth native administration discovers and authorizes one exact spacing pair with minimal receipt and replay", async () => {
  const before = await capture();
  const overview = await call("admin", query);
  assert.equal(overview.status, 200, JSON.stringify(overview.value));
  assert.equal(overview.value.data.membershipWritable, false);
  assert.equal(overview.value.data.spacingCandidates.length, 48);
  assert.deepEqual(await capture(), before);
  const candidate = overview.value.data.spacingCandidates.find((item) => item.userId === "member-1");
  const intent = command(candidate);
  const response = await call("admin", intent);
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const receipt = response.value.data;
  assert.deepEqual(Object.keys(receipt).sort(), ["schemaVersion", "environment", "operationId", "action", "userId",
    "replayed", "membershipRevision", "exceptionId"].sort());
  assert.equal(receipt.action, "authorizeDeliverySpacingException");
  assert.equal(receipt.userId, "member-1"); assert.equal(receipt.membershipRevision, null);
  assert.equal(receipt.replayed, false); assert.equal(receipt.operationId, "native-spacing");
  const approval = (await ref("shiftDeliverySpacingExceptions", receipt.exceptionId).get()).data().value;
  assert.equal(approval.approvedByUserId, "member-1"); assert.equal(approval.reason, intent.reason);
  assert.equal(approval.previousDate, "2026-09-03"); assert.equal(approval.date, "2026-10-15");
  const accepted = await capture();
  assert.equal((await call("admin", intent)).value.data.replayed, true);
  assert.deepEqual(await capture(), accepted);
  assert.equal((await call("admin", query)).value.data.spacingCandidates.length, 47);
  for (const forbidden of ["reason", "approvedByUserId", "authorityDigest", "authUid"]) {
    assert.equal(JSON.stringify(receipt).includes(forbidden), false);
  }
});

run("real Auth spacing rejects nonadmins, forged identity, stale context and role loss on replay without writes", async () => {
  const candidate = (await call("admin", query)).value.data.spacingCandidates[0];
  const intent = command(candidate);
  const before = await capture();
  assert.equal((await call("member", query)).status, 403);
  assert.equal((await call("member", intent)).status, 403);
  assert.equal((await call("admin", {...intent, actorMemberId: "member-1"})).status, 400);
  assert.deepEqual(await capture(), before);
  await ref("config", "global").update({"otherConfig.deliveryDayOfWeek": "WED"});
  const drifted = await capture();
  assert.equal((await call("admin", intent)).status, 409);
  assert.deepEqual(await capture(), drifted);
  const current = (await call("admin", query)).value.data.spacingCandidates[0];
  const acceptedIntent = command(current, "current-native-spacing");
  assert.equal((await call("admin", acceptedIntent)).status, 200);
  await ref("users", "member-1").update({roles: ["member"]});
  const roleChanged = await capture();
  assert.equal((await call("admin", acceptedIntent)).status, 403);
  assert.deepEqual(await capture(), roleChanged);
});
