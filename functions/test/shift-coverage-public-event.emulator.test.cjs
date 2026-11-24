"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const {readCoveragePublicEventOwnership} = require("../lib/shift-coverage-public-event.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");
const {runShiftSheetsOrdinaryWriter} = require("../lib/shift-sheets-ordinary-writer.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");

const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections";
const enabled = process.env.GCLOUD_PROJECT === projectId && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
let db, store, now, exported;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const data = async (collection, id) => (await ref(collection, id).get()).data();
const command = async (action, operationId, extra = {}) => {
  const item = (await data("shiftCoverageCases", "case-a"))?.value;
  const shiftId = item?.shiftId ?? "shift_delivery_20270901";
  return {schemaVersion: 1, environment: "develop", action, operationId, caseId: "case-a",
    expectedRevision: item?.revision ?? 0, expectedShiftRevision: (await data("shifts", shiftId)).documentRevision, ...extra};
};
const accepted = async () => {
  await store.execute(await command("open", "open", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Absent"}), "a");
  await store.execute(await command("offer", "offer", {userId: "d", reason: "Agreed", expiresAtMillis: now + 60_000}), "admin");
  const before = new Map((await db.collection(`${root}/shifts`).get()).docs.map((doc) => [doc.ref.path, doc]));
  const intent = await command("accept", "accept");
  await store.execute(intent, "d");
  return {before, intent};
};
const event = async (before, path) => {
  const next = await db.doc(path).get();
  return {targetPath: path, before: before.data(), after: next.data(), afterUpdateTime: next.updateTime};
};
before(() => {
  if (!enabled) return;
  db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
  store = createProvisionalShiftCoverageStore({nowMillis: () => now, maximumOfferWindowMillis: 60_000});
  exported = require("../lib/index.js");
});
after(async () => {
  if (store) await store.close();
  if (db) await db.terminate();
  if (exported) {
    await require("firebase-admin/firestore").getFirestore().terminate();
    await require("firebase-admin/app").deleteApp(require("firebase-admin/app").getApp());
  }
});
beforeEach(async () => {
  if (!enabled) return;
  assert.equal((await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
  now = initialTime;
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const id of ["a", "b", "c", "d", "e", "admin"]) await ref("users", id).set({roles: id === "admin" ? ["admin", "member"] : ["member"],
    isActive: true, isCommonPurchaseManager: false});
  await ref("shifts", "shift_delivery_20270825").set(materialize("shift_delivery_20270825", "delivery", "2027-08-25", ["b"], "a"));
  await ref("shifts", "shift_delivery_20270901").set(materialize("shift_delivery_20270901", "delivery", "2027-09-01", ["a"], "c"));
  await ref("shifts", "shift_delivery_20270908").set(materialize("shift_delivery_20270908", "delivery", "2027-09-08", ["c"], "e"));
});

run("accept atomically binds target and predecessor to commit metadata; duplicate commands and trigger reads retain one owner", async () => {
  const {before, intent} = await accepted();
  const bindings = await db.collection(`${root}/shiftCoveragePublicWrites`).get();
  assert.equal(bindings.size, 2);
  const receipt = await ref("shiftCoverageOperations", "accept").get();
  const effect = await ref("shiftCoverageEffects", "accept").get();
  for (const binding of bindings.docs) {
    const path = binding.get("targetPath"), current = await db.doc(path).get();
    assert.ok(current.updateTime.isEqual(binding.createTime));
    assert.ok(current.updateTime.isEqual(receipt.createTime));
    assert.ok(current.updateTime.isEqual(effect.createTime));
    const input = await event(before.get(path), path);
    assert.equal(await readCoveragePublicEventOwnership(db, input), "coverage");
    assert.equal(await readCoveragePublicEventOwnership(db, input), "coverage");
    // No Sheets config or credentials exist: the actual trigger must return
    // before opening the ordinary exporter or emitting its generic event.
    await exported.onShiftWritten.run({id: "coverage-" + binding.id, time: current.updateTime.toDate().toISOString(),
      authType: "system", params: {env: "develop", shiftId: current.id},
      data: {before: before.get(path), after: current}});
    assert.deepEqual(current.get("lastBackendMutation"), before.get(path).get("lastBackendMutation"));
  }
  assert.equal((await store.execute(intent, "d")).replayed, true);
  assert.equal((await db.collection(`${root}/shiftCoveragePublicWrites`).get()).size, 2);
  assert.equal((await db.collection(`${root}/notificationEvents`).get()).size, 0);
});

run("completion has immutable ownership even when the Sheets row does not change", async () => {
  await accepted();
  const before = await ref("shifts", "shift_delivery_20270901").get();
  now = before.get("date").toMillis() + 1000;
  await store.execute(await command("complete", "complete"), "admin");
  assert.equal((await data("shiftCoverageEffects", "complete")).value.changes.length, 0);
  const input = await event(before, before.ref.path);
  assert.equal(await readCoveragePublicEventOwnership(db, input), "coverage");
});

run("delayed coverage event survives worker mutation and later manual edits; identical manual revert/reapply is ordinary", async () => {
  const {before} = await accepted();
  const path = ref("shifts", "shift_delivery_20270901").path;
  const input = await event(before.get(path), path);
  await ref("shiftCoverageEffects", "accept").update({state: "completed", deliveredTo: []});
  const acceptedSnapshot = await db.doc(path).get();
  await db.doc(path).update({status: "planned"});
  assert.equal(await readCoveragePublicEventOwnership(db, await event(acceptedSnapshot, path)), "ordinary");
  assert.equal(await readCoveragePublicEventOwnership(db, input), "coverage");
  await db.doc(path).set(input.before);
  const restored = await db.doc(path).get();
  await db.doc(path).set(input.after);
  const reapplied = await event(restored, path);
  assert.notDeepEqual(reapplied.afterUpdateTime, input.afterUpdateTime);
  assert.equal(await readCoveragePublicEventOwnership(db, reapplied), "ordinary");
});

run("an equal operation and shift id in another environment cannot inherit the coverage owner", async () => {
  const {before} = await accepted();
  const path = ref("shifts", "shift_delivery_20270901").path;
  const input = await event(before.get(path), path);
  const productionPath = path.replace("develop/", "production/");
  const scoped = (value) => ({...value, lastBackendMutation: {...value.lastBackendMutation, targetPath: productionPath}});
  assert.equal(await readCoveragePublicEventOwnership(db, {...input, targetPath: productionPath,
    before: scoped(input.before), after: scoped(input.after)}), "ordinary");
});

run("missing or recreated sidecar never falls through to ordinary while commit claims remain", async () => {
  const {before} = await accepted();
  const bindings = await db.collection(`${root}/shiftCoveragePublicWrites`).get();
  const binding = bindings.docs.find((doc) => doc.get("targetPath").endsWith("20270901"));
  const input = await event(before.get(binding.get("targetPath")), binding.get("targetPath"));
  await binding.ref.delete();
  await assert.rejects(readCoveragePublicEventOwnership(db, input), {code: "coverage_public_event_evidence_invalid"});
  await binding.ref.set(binding.data());
  await assert.rejects(readCoveragePublicEventOwnership(db, input), {code: "coverage_public_event_evidence_invalid"});
});

run("aborted commands create no public bindings or immutable claims", async () => {
  const before = await db.collection(`${root}/shiftCoveragePublicWrites`).get();
  await assert.rejects(store.execute(await command("accept", "not-offered"), "d"));
  assert.equal((await db.collection(`${root}/shiftCoveragePublicWrites`).get()).size, before.size);
  assert.equal((await ref("shiftCoverageEffects", "not-offered").get()).exists, false);
  assert.equal((await ref("shiftCoverageOperations", "not-offered").get()).exists, false);
});

run("ordinary reservation fences public writes while notification-only commands still work", async () => {
  const pointer = ref("shiftPlanningState", "sheetsSubmission");
  const reservation = {schemaVersion: 1, kind: "ordinaryWriteBack", environment: "develop",
    workbookId: "coverage-rehearsal-book", operationId: "ordinary-test", authority: null,
    createdAt: Timestamp.now(), state: "reserved", beforeWorkbookRevision: null, submissionCount: 0, evidence: null};
  await pointer.set(reservation);
  await store.execute(await command("open", "open", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Absent"}), "a");
  await store.execute(await command("offer", "offer", {userId: "d", reason: "Agreed", expiresAtMillis: now + 60_000}), "admin");
  const intent = await command("accept", "accept");
  for (const value of [reservation, {...reservation, state: "submitting", beforeWorkbookRevision: "1", submissionCount: 1}]) {
    await pointer.set(value);
    await assert.rejects(store.execute(intent, "d"), {code: "coverage_effects_workbook_reserved"});
    assert.equal((await data("shiftCoverageCases", "case-a")).value.status, "offered");
    assert.equal((await ref("shiftCoverageOperations", "accept").get()).exists, false);
    assert.equal((await db.collection(`${root}/shiftCoveragePublicWrites`).get()).size, 0);
  }
});

run("real ordinary reservation and coverage command exclude each other across the command-to-worker gap", async () => {
  await store.execute(await command("open", "open", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Absent"}), "a");
  await store.execute(await command("offer", "offer", {userId: "d", reason: "Agreed", expiresAtMillis: now + 60_000}), "admin");
  const intent = await command("accept", "accept");
  const caseBefore = await data("shiftCoverageCases", "case-a");
  const publicBefore = (await db.collection(`${root}/shifts`).get()).docs.map((doc) => [doc.id, doc.data()]);
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "coverage-rehearsal-book"}});
  let revision = "1", release, started, mutations = 0;
  const held = new Promise((resolve) => { release = resolve; });
  const entered = new Promise((resolve) => { started = resolve; });
  const ordinary = runShiftSheetsOrdinaryWriter({firestore: db, config, readWorkbookVersion: async () => revision}, async (fence) => {
    started(); await held;
    await fence.beforeMutation(); mutations++; revision = "2";
    await fence.finish();
  });
  await entered;
  try {
    assert.equal((await data("shiftPlanningState", "sheetsSubmission")).state, "reserved");
    await assert.rejects(store.execute(intent, "d"), {code: "coverage_effects_workbook_reserved"});
    assert.deepEqual(await data("shiftCoverageCases", "case-a"), caseBefore);
    assert.deepEqual((await db.collection(`${root}/shifts`).get()).docs.map((doc) => [doc.id, doc.data()]), publicBefore);
    assert.equal((await ref("shiftCoverageOperations", "accept").get()).exists, false);
    assert.equal((await ref("shiftCoverageEffects", "accept").get()).exists, false);
    assert.equal((await db.collection(`${root}/shiftCoveragePublicWrites`).get()).size, 0);
  } finally { release(); await ordinary; }
  assert.equal(mutations, 1);
  assert.equal((await data("shiftPlanningState", "sheetsSubmission")).evidence.workbookRevision, "2");
  assert.equal((await store.execute(intent, "d")).case.status, "accepted");
  assert.ok((await data("shiftCoverageEffects", "accept")).value.changes.length > 0);
  let observations = 0;
  await assert.rejects(runShiftSheetsOrdinaryWriter({firestore: db, config,
    readWorkbookVersion: async () => { observations++; return revision; }},
  async () => { observations++; }), {code: "shift_sheets_ordinary_unresolved"});
  assert.equal(observations, 0);
});
