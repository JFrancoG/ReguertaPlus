"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {materialize, activeDigest} = require("./shift-coverage-fixture.cjs");
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections";
const day = 86_400_000, due = Date.parse("2027-09-30T00:00:00Z"), shiftId = "shift_market_20270930";
let db, store, now, sequence;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const command = async (action, extra = {}) => {
  const state = (await read("shiftCoverageCases", "case"))?.value;
  const shift = await read("shifts", shiftId);
  return {schemaVersion: 1, environment: "develop", action, caseId: "case", operationId: `timing-${++sequence}`,
    expectedRevision: state?.revision ?? 0, expectedShiftRevision: shift.documentRevision, ...extra};
};
const execute = async (action, actor = "admin", extra = {}) => store.execute(await command(action, extra), actor);
const open = () => execute("open", "a", {shiftId, absentUserId: "a", reason: "Absence"});
const start = () => execute("startSelection");
const snapshot = async () => {
  const collections = await db.doc(root).listCollections();
  return Promise.all(collections.sort((a, b) => a.id.localeCompare(b.id)).map(async (collection) =>
    [collection.id, (await collection.orderBy("__name__").get()).docs.map((d) => [d.id, d.data()])]));
};
const rejectWithoutWrites = async (action, actor, extra, code) => {
  const input = await command(action, extra), prior = await snapshot();
  await assert.rejects(store.execute(input, actor), {code});
  assert.deepEqual(await snapshot(), prior);
};
const reserve = async (userId, time = 1) => ref("shiftCoverageReserves", digest(["market", userId]).split(":").at(-1))
  .set({schemaVersion: 1, userId, type: "market", active: true, enteredAtMillis: time, revision: 1});

before(() => {
  if (!enabled) return;
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8798");
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
  store = createProvisionalShiftCoverageStore({nowMillis: () => now, maximumOfferWindowMillis: 7 * day,
    selectionPolicy: {version: "hu089-provisional-v1"}});
});
after(async () => { if (store) await store.close(); if (db) await db.terminate(); });
beforeEach(async () => {
  if (!enabled) return;
  assert.equal((await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    {method: "DELETE"})).ok, true);
  now = due - 14 * day; sequence = 0;
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const id of ["a", "b", "c", "d", "e", "admin"]) {
    await ref("users", id).set({isActive: true, roles: id === "admin" ? ["admin", "member"] : ["member"],
      isCommonPurchaseManager: false});
  }
  await ref("shifts", shiftId).set(materialize(shiftId, "market", "2027-09-30", ["a", "b", "c"]));
});

run("new policy cannot bypass selection; decline and exact replay do not restart the reserve deadline", async () => {
  await reserve("d"); await reserve("e", 2); await open();
  await rejectWithoutWrites("offer", "admin", {userId: "d", reason: "Bypass", expiresAtMillis: now + day},
    "coverage_selection_missing");
  const started = await start(), end = now + 2 * day;
  assert.equal(started.case.selection.timing.phaseClosesAtMillis, end);
  const offered = await command("offerNext", {expiresAtMillis: now + day});
  await store.execute(offered, "admin");
  now += 1000;
  const beforeReplay = await snapshot();
  assert.equal((await store.execute(offered, "admin")).replayed, true);
  assert.deepEqual(await snapshot(), beforeReplay);
  await execute("decline", "d"); now += day;
  await rejectWithoutWrites("offerNext", "admin", {expiresAtMillis: end + 1}, "coverage_offer_deadline");
  const next = await execute("offerNext", "admin", {expiresAtMillis: end});
  assert.equal(next.case.offer.userId, "e");
  assert.equal(next.case.offer.expiresAtMillis, end);
  assert.equal(next.case.selection.timing.phaseClosesAtMillis, end);
});

run("first volunteer is offered immediately and acceptance closes the search", async () => {
  await open(); await start();
  const empty = await execute("offerNext", "admin", {expiresAtMillis: now + day});
  assert.equal(empty.case.selection.phase, "volunteers");
  const end = now + 7 * day;
  await execute("volunteer", "e"); now += 1000; await execute("volunteer", "d");
  const offered = await execute("offerNext", "admin", {expiresAtMillis: now + day});
  assert.equal(offered.case.offer.userId, "e");
  assert.equal(offered.case.selection.volunteerClosesAtMillis, end);
  const accepted = await execute("accept", "e");
  assert.equal(accepted.case.status, "accepted");
  assert.deepEqual((await read("shifts", shiftId)).assignedUserIds, ["e", "b", "c"]);
  await rejectWithoutWrites("offerNext", "admin", {expiresAtMillis: now + day}, "coverage_state_conflict");
});

run("below five days only administrative offers can assign; exactly five retains urgent reserve", async () => {
  now = due - 5 * day + 1;
  await reserve("d"); await open();
  const initial = await start();
  assert.equal(initial.case.selection.phase, "adminRequired");
  assert.equal(initial.case.selection.timing.mode, "adminOnly");
  const ignoredReserve = await execute("offerNext", "admin", {expiresAtMillis: now + 1000});
  assert.equal(ignoredReserve.case.offer, null);
  await rejectWithoutWrites("volunteer", "d", {}, "coverage_volunteer_window_closed");
  await rejectWithoutWrites("offerAdmin", "d", {userId: "e", reason: "Not admin", expiresAtMillis: now + 1000},
    "coverage_actor_forbidden");
  await execute("offerAdmin", "admin", {userId: "d", reason: "Urgent resolution", expiresAtMillis: now + day});
  assert.equal((await execute("accept", "d")).case.status, "accepted");
});

run("exactly five days allows one reserve day and rejects acceptance at its expiry", async () => {
  now = due - 5 * day;
  await reserve("d"); await open();
  const initial = await start();
  assert.equal(initial.case.selection.phase, "reserve");
  assert.equal(initial.case.selection.timing.mode, "urgent");
  const end = now + day;
  await execute("offerNext", "admin", {expiresAtMillis: end});
  now = end;
  await rejectWithoutWrites("accept", "d", {}, "coverage_offer_deadline");
  await execute("expire");
  const next = await execute("offerNext", "admin", {expiresAtMillis: now + day});
  assert.equal(next.case.selection.phase, "volunteers");
  assert.equal(next.case.selection.volunteerClosesAtMillis, due - 2 * day);
});

run("a delayed start and later offers use original opening time and cannot extend past shift start", async () => {
  await reserve("d"); await open(); now += 12 * day;
  const started = await start();
  assert.equal(started.case.selection.timing.mode, "normal");
  assert.equal(started.case.selection.phase, "adminRequired");
  assert.equal(started.case.selection.timing.phaseClosesAtMillis, due);
  await rejectWithoutWrites("offerAdmin", "admin", {userId: "d", reason: "Too late", expiresAtMillis: due},
    "coverage_offer_deadline");
  await execute("offerAdmin", "admin", {userId: "d", reason: "Before deadline", expiresAtMillis: due - 1});
  now = due - 1;
  await rejectWithoutWrites("accept", "d", {}, "coverage_offer_deadline");
});

run("expired volunteer phase advances to draw without granting another volunteer window", async () => {
  await open(); await start(); now += 10 * day;
  const advanced = await execute("offerNext", "admin", {expiresAtMillis: now + 1000});
  assert.equal(advanced.case.selection.phase, "drawRequired");
  assert.equal(advanced.case.selection.timing.phaseClosesAtMillis, due - 3 * day);
  await rejectWithoutWrites("volunteer", "d", {}, "coverage_volunteer_window_closed");
});

run("native reads expose current phase deadlines without writes or private candidate data", async () => {
  await ref("authLinks", "auth-admin").set({memberId: "admin"});
  await ref("users", "admin").update({authUid: "auth-admin"});
  const overview = () => store.readClient({schemaVersion: 1, environment: "develop", action: "overview"}, {uid: "auth-admin"});
  await open();
  assert.equal((await overview()).policy.selectionRequired, true);
  assert.equal((await overview()).policy.volunteerWindowMillis, null);
  await start();
  let prior = await snapshot();
  let result = await overview();
  assert.equal(result.cases[0].selectionPhase, "reserve");
  assert.equal(result.cases[0].phaseClosesAtMillis, due - 12 * day);
  assert.deepEqual(await snapshot(), prior);
  now += 2 * day;
  prior = await snapshot();
  result = await overview();
  assert.equal(result.cases[0].selectionPhase, "volunteers");
  assert.equal(result.cases[0].phaseClosesAtMillis, due - 5 * day);
  assert.equal(result.cases[0].volunteerClosesAtMillis, due - 5 * day);
  assert.equal(result.cases[0].revision, 2);
  assert.equal(result.cases[0].timing, undefined);
  assert.equal(result.cases[0].snapshot, undefined);
  assert.deepEqual(await snapshot(), prior);
  now = due - 3 * day;
  result = await overview();
  assert.equal(result.cases[0].selectionPhase, "adminRequired");
  assert.equal(result.cases[0].phaseClosesAtMillis, due);
});
