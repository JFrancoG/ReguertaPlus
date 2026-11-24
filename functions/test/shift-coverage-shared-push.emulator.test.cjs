"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {HttpRequestError} = require("../lib/backend-security.js");
const {createFirestoreShiftCoveragePushDispatcher} = require("../lib/shift-coverage-push.js");
const {buildShiftCoverageEffects} = require("../lib/shift-coverage-effects.js");
const {buildShiftCoverageOpening} = require("../lib/shift-coverage-opening.js");
const {releaseCoverageInbox} = require("../lib/shift-coverage-inbox.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");

const projectId = "demo-reguerta-hu084-coverage";
const enabled = process.env.GCLOUD_PROJECT === projectId &&
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const environments = ["develop", "production"];
const root = (environment) => `${environment}/plus-collections`;
const ref = (environment, collection, id) => db.doc(`${root(environment)}/${collection}/${id}`);
let db;

before(() => {
  if (enabled) db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
});
after(async () => { if (db) await db.terminate(); });
beforeEach(async () => {
  if (!enabled) return;
  for (const environment of environments) await db.recursiveDelete(db.doc(root(environment)));
});

const prepare = async (environment) => {
  const state = {schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest,
    intakeBarrier: null, lastTransitionId: "initial"};
  const opening = buildShiftCoverageOpening({environment, caseId: "case", shiftId: "shift_delivery_20270901",
    shift: materialize("shift_delivery_20270901", "delivery", "2027-09-01", ["a"]),
    positionIndex: 0, actorId: "a", reason: "Private absence fixture", now: initialTime});
  const current = {...opening, status: "offered", revision: 2, offer: {id: "offer", userId: "d", source: "admin",
    expiresAtMillis: initialTime + 60_000, assignmentContextDigest: digest("local-offer")}};
  const value = buildShiftCoverageEffects({operationId: "operation", action: "offer", previous: opening,
    next: current, before: new Map(), writes: new Map()});
  await ref(environment, "shiftPlanningState", "current").set(state);
  await ref(environment, "shiftPlanningState", "fixtureDispatchAdmission").set({enabled: true});
  await ref(environment, "users", "d").set({isActive: true, roles: ["member"], isCommonPurchaseManager: false});
  await ref(environment, "shiftCoverageCases", "case").set({value: current, digest: digest(current)});
  await ref(environment, "shiftCoverageOperations", "operation").set({effectsDigest: value.effectsDigest});
  await db.runTransaction(async (tx) => {
    const users = await tx.get(db.collection(`${root(environment)}/users`));
    const deliveredTo = releaseCoverageInbox({db, tx, value, users, now: initialTime});
    tx.create(ref(environment, "shiftCoverageEffects", "operation"), {value, deliveredTo, state: "completed",
      authority: {schemaVersion: 1, stateRevision: 1, writeEpoch: 1, activeRevision: "active-1", activeDigest}});
  });
  return {value, eventId: value.notifications[0].push.data.eventId,
    receipt: () => ref(environment, "shiftCoverageEffects", "operation").collection("pushes").doc("d")};
};

const dispatcher = (environment, transport, resolveTargets = async () =>
  ({fcmTokens: ["private-fixture-token"], firebaseInstallationIds: []})) =>
  createFirestoreShiftCoveragePushDispatcher({firestore: db, context: {environment, requireReady: async (tx) => {
    const gate = await tx.get(ref(environment, "shiftPlanningState", "fixtureDispatchAdmission"));
    if (gate.data()?.enabled !== true) throw new HttpRequestError(409, "coverage_unavailable", "Fixture gate closed");
  }}, resolveTargets, transport, nowMillis: () => initialTime});

run("shared inbox and dispatch isolate identical case, operation and recipient IDs by environment", async () => {
  const prepared = new Map();
  for (const environment of environments) prepared.set(environment, await prepare(environment));
  assert.equal(prepared.get("develop").eventId, prepared.get("production").eventId);
  for (const environment of environments) {
    const calls = [], lookups = [];
    const service = dispatcher(environment, {submit: async (message) => {
      calls.push(message); return {outcome: "accepted", acceptedTargetCount: 1};
    }}, async (...args) => { lookups.push(args); return {fcmTokens: [`private-${environment}-token`], firebaseInstallationIds: []}; });
    const fixture = prepared.get(environment);
    assert.deepEqual(await service.submit("d", fixture.eventId), {state: "accepted", replayed: false});
    assert.deepEqual(await service.submit("d", fixture.eventId), {state: "accepted", replayed: true});
    assert.deepEqual(lookups, [[environment, "d"]]);
    assert.equal(calls.length, 1);
    assert.equal(JSON.stringify(calls).includes("Private absence"), false);
    const receipt = (await fixture.receipt().get()).data();
    assert.equal(receipt.state, "accepted");
    assert.equal(JSON.stringify(receipt).includes("token"), false);
    const inbox = await db.collection(`${root(environment)}/users/d/notificationInbox`).get();
    assert.equal(inbox.size, 1);
    assert.equal(inbox.docs[0].data().coverageOperationId, "operation");
  }
});

run("shared push rejects closed admission and drift during destination lookup before transport", async () => {
  const fixture = await prepare("production");
  let sends = 0, lookups = 0;
  const transport = {submit: async () => { sends++; return {outcome: "accepted", acceptedTargetCount: 1}; }};
  await ref("production", "shiftPlanningState", "fixtureDispatchAdmission").update({enabled: false});
  await assert.rejects(dispatcher("production", transport).submit("d", fixture.eventId), {code: "coverage_unavailable"});
  await ref("production", "shiftPlanningState", "fixtureDispatchAdmission").update({enabled: true});
  const service = dispatcher("production", transport, async () => {
    lookups++;
    await ref("production", "shiftPlanningState", "fixtureDispatchAdmission").update({enabled: false});
    return {fcmTokens: ["fixture-token"], firebaseInstallationIds: []};
  });
  await assert.rejects(service.submit("d", fixture.eventId), {code: "coverage_unavailable"});
  assert.equal(lookups, 1); assert.equal(sends, 0);
  assert.equal((await fixture.receipt().get()).exists, false);
});

run("uncertain shared pushes never resend and frozen effects cannot dispatch", async () => {
  const fixture = await prepare("production");
  let sends = 0;
  const service = dispatcher("production", {submit: async () => { sends++; throw new Error("lost acknowledgement"); }});
  assert.deepEqual(await service.submit("d", fixture.eventId), {state: "unknown", replayed: false});
  assert.deepEqual(await service.submit("d", fixture.eventId), {state: "unknown", replayed: true});
  assert.equal(sends, 1);
  await ref("production", "shiftCoverageEffects", "operation").update({state: "reconciliationRequired"});
  await assert.rejects(service.submit("d", fixture.eventId), {code: "coverage_notification_unavailable"});
  assert.equal(sends, 1);
  assert.equal((await fixture.receipt().get()).data().state, "unknown");
});

run("closing admission during an accepted send retains an unsettled receipt and never permits another send", async () => {
  const fixture = await prepare("production");
  let sends = 0;
  const service = dispatcher("production", {submit: async () => {
    sends++;
    await ref("production", "shiftPlanningState", "fixtureDispatchAdmission").update({enabled: false});
    return {outcome: "accepted", acceptedTargetCount: 1};
  }});
  await assert.rejects(service.submit("d", fixture.eventId), {code: "coverage_unavailable"});
  assert.equal((await fixture.receipt().get()).data().state, "submitting");
  await ref("production", "shiftPlanningState", "fixtureDispatchAdmission").update({enabled: true});
  assert.deepEqual(await service.submit("d", fixture.eventId), {state: "submitting", replayed: true});
  assert.equal(sends, 1);
});

run("cross-environment roster cannot release a coverage inbox", async () => {
  const fixture = await prepare("production");
  await ref("develop", "users", "d").set({isActive: true, roles: ["member"]});
  const users = await db.collection(`${root("develop")}/users`).get();
  await assert.rejects(db.runTransaction(async (tx) =>
    releaseCoverageInbox({db, tx, value: fixture.value, users, now: initialTime})),
  {code: "invalid_coverage_environment"});
  assert.equal((await db.collection(`${root("develop")}/users/d/notificationInbox`).get()).size, 0);
});

const {createFirebaseShiftCoverageNotificationTransport} = require("../lib/shift-coverage-push.js");
const normal = (environment, messaging) => createFirestoreShiftCoveragePushDispatcher({
  firestore: db, context: {environment, requireReady: async () => {}},
  transport: createFirebaseShiftCoverageNotificationTransport(messaging, () => initialTime),
  nowMillis: () => initialTime,
});
const setActor = async (memberId, roles) => {
  await ref("develop", "users", memberId).set({authUid: memberId, isActive: true, isCommonPurchaseManager: false, roles});
  await ref("develop", "authLinks", memberId).set({memberId});
};
const responses = (outcomes) => {
  const results = outcomes.map((code) => code ? {success: false, error: {code}} : {success: true, messageId: "accepted"});
  return {responses: results, successCount: outcomes.filter((code) => !code).length, failureCount: outcomes.filter(Boolean).length};
};
run("normal dispatch selects one address per installation and retries a certain rejection only once for the linked administrator", async () => {
  const {receipt, eventId} = await prepare("develop");
  await setActor("admin", ["member", "admin"]); await setActor("d", ["member"]);
  const devices = ref("develop", "users", "d").collection("devices");
  await devices.doc("android").set({firebaseInstallationId: "fid-d", fcmToken: "old-token"});
  await devices.doc("legacy").set({fcmToken: "old-token"});
  const messages = [];
  const messaging = {sendEachForMulticast: async (message) => {
    messages.push(message);
    return responses([messages.length === 1 ? "messaging/registration-token-not-registered" : null]);
  }};
  assert.equal((await normal("develop", messaging).submit("d", eventId)).state, "failed");
  const original = await receipt().get();
  assert.equal(original.get("retryable"), true);
  assert.deepEqual(messages[0].fids, ["fid-d"]);
  assert.equal(messages[0].tokens, undefined);
  assert.equal((await normal("develop", messaging).submit("d", eventId)).replayed, true);
  const command = {operationId: "admin-recovery", expectedAttemptId: original.get("attemptId"), eventId, memberId: "d"};
  await assert.rejects(normal("develop", messaging).retryRejected(command, {uid: "d"}), {code: "coverage_actor_forbidden"});
  const results = await Promise.all([1, 2].map(() => normal("develop", messaging).retryRejected(command, {uid: "admin"})));
  assert.equal(results.filter((result) => !result.replayed && result.state === "accepted").length, 1);
  const recovered = await receipt().get();
  assert.equal(recovered.get("state"), "accepted");
  assert.equal(messages.length, 2);
  assert.deepEqual(await normal("develop", messaging).retryRejected(command, {uid: "admin"}), {state: "accepted", replayed: true});
  assert.deepEqual((await receipt().get()).updateTime, recovered.updateTime);
  await assert.rejects(normal("develop", messaging).retryRejected({...command, operationId: "obsolete"}, {uid: "admin"}),
    {code: "coverage_push_retry_unavailable"});
  assert.equal((await ref("develop", "users", "d").collection("notificationInbox").get()).size, 1);
  assert.equal(messages.length, 2);
});

run("an uncertain individual SDK error or a partial delivery never permits another notification", async () => {
  await setActor("admin", ["member", "admin"]);
  for (const [environment, outcomes, state] of [
    ["develop", ["messaging/internal-error", "messaging/registration-token-not-registered"], "unknown"],
    ["production", [null, "messaging/registration-token-not-registered"], "accepted"],
  ]) {
    const {receipt, eventId} = await prepare(environment);
    const devices = ref(environment, "users", "d").collection("devices");
    await devices.doc("one").set({fcmToken: "legacy-token-one"}); await devices.doc("two").set({fcmToken: "legacy-token-two"});
    let sends = 0;
    const messaging = {sendEachForMulticast: async () => { sends++; return responses(outcomes); }};
    assert.equal((await normal(environment, messaging).submit("d", eventId)).state, state);
    const current = await receipt().get();
    assert.notEqual(current.get("retryable"), true);
    assert.deepEqual(await normal(environment, messaging).submit("d", eventId), {state, replayed: true});
    if (environment === "develop") {
      await assert.rejects(normal(environment, messaging).retryRejected({eventId, memberId: "d",
        operationId: "unsafe", expectedAttemptId: current.get("attemptId")}, {uid: "admin"}), {code: "coverage_push_retry_unavailable"});
    }
    assert.equal(sends, 1);
  }
});

run("a member without devices keeps one inbox notice and an explicit no-targets outcome", async () => {
  const {receipt, eventId} = await prepare("develop");
  const service = normal("develop", {sendEachForMulticast: async () => assert.fail("no target")});
  assert.deepEqual(await service.submit("d", eventId), {state: "noTargets", replayed: false});
  const completed = await receipt().get();
  assert.equal(completed.get("result.outcome"), "noTargets");
  assert.deepEqual(await service.submit("d", eventId), {state: "noTargets", replayed: true});
  assert.deepEqual((await receipt().get()).updateTime, completed.updateTime);
  assert.equal((await ref("develop", "users", "d").collection("notificationInbox").get()).size, 1);
});
