"use strict";

const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {encodeShiftPlanningFirestoreValue: encode} = require("../lib/shift-planning-publication-contract.js");
const {shiftPlanningNotificationResourceFenceId} = require("../lib/shift-planning-notification-resource-fence.js");
const {SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS} = require("../lib/shift-planning-notification-dispatch.js");
const {parseShiftSheetsOrdinarySubmission} = require("../lib/shift-sheets-ordinary-writer.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const migration = require("../scripts/rehearse-develop-shift-migration.cjs");
const fixture = require("./develop-shift-migration-fixture.cjs");
const enabled = process.env.GCLOUD_PROJECT === migration.PROJECT_ID &&
  process.env.FIRESTORE_EMULATOR_HOST === migration.HOST;
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const encoded = (data) => encode(data, "migration test comparison", new Set());
const ROOT = fixture.ROOT;
let db;
const services = [];
before(() => {
  if (enabled) db = new Firestore({projectId: migration.PROJECT_ID, host: migration.HOST, ssl: false});
});
beforeEach(async () => {
  if (!enabled) return;
  assert.equal((await fetch(`http://${migration.HOST}/emulator/v1/projects/${migration.PROJECT_ID}/databases/(default)/documents`,
    {method: "DELETE"})).ok, true);
});
after(async () => {
  for (const service of services) await service.close();
  if (db) await db.terminate();
});
const collection = (name) => db.collection(`${ROOT}/${name}`);
const saved = async (name, withVersion = true) => (await collection(name).orderBy("__name__").get()).docs
  .map((doc) => ({path: doc.ref.path, data: encoded(doc.data()), ...(withVersion ? {updateTime: doc.updateTime} : {})}));
const harness = async (options = {}) => {
  const legacyCapture = await fixture.seedAndCapture(db);
  const prepared = migration.prepareDevelopShiftMigration({contentProposal: fixture.contentProposal(), legacyCapture});
  const control = fixture.heldControl(options);
  const service = migration.createDevelopShiftMigrationRehearsal({prepared, ...control,
    nowMillis: options.nowMillis ?? (() => fixture.NOW)});
  services.push(service);
  const scope = async (inverse = false) => fixture.scopeFor(prepared, await service.inspect(), inverse);
  let forwardScope;
  return {prepared, service, control, scope, forward: async () => {
    forwardScope ??= await scope();
    return service.forward({scope: forwardScope});
  }};
};
const noForwardWrites = async () => {
  assert.equal((await collection("shifts").get()).size, 62);
  assert.equal((await collection("shiftPlanningOperations").get()).size, 0);
  assert.equal((await collection("shiftPlanningMigrationBaselines").get()).size, 0);
  assert.equal((await collection("shiftPlanningState").get()).size, 0);
};
const reserveWorkbook = async () => {
  const reference = db.doc(`${ROOT}/shiftPlanningState/sheetsSubmission`);
  const submission = parseShiftSheetsOrdinarySubmission({schemaVersion: 1, kind: "ordinaryWriteBack",
    environment: "develop", workbookId: migration.WORKBOOK_ID, operationId: "unresolved-ordinary-export",
    authority: null, createdAt: Timestamp.fromMillis(fixture.NOW), state: "reserved",
    beforeWorkbookRevision: null, submissionCount: 0, evidence: null});
  await reference.create(submission);
  return reference.get();
};

run("SDK replay and inverse preserve raw payloads and roster while retaining closed higher-epoch audit state", async () => {
  const f = await harness(), originals = await saved("shifts", false), users = await saved("users"), calendar = await saved("deliveryCalendar");
  const forward = await f.forward();
  assert.equal(forward.measurement.documentWriteCount, 203);
  assert.equal((await collection("shifts").get()).size, 72);
  assert.equal((await db.collection(`${ROOT}/shiftPlanningOperations/${f.prepared.operationId}/beforeImages`).get()).size, 62);
  const forwardPublic = await saved("shifts");
  assert.equal((await f.forward()).measurement, null);
  assert.deepEqual(await saved("shifts"), forwardPublic);
  const inverseScope = await f.scope(true);
  const inverse = await f.service.inverse({scope: inverseScope, forwardReadBack: forward});
  assert.equal(inverse.measurement.documentWriteCount, 140);
  assert.deepEqual(await saved("shifts", false), originals);
  assert.deepEqual(await saved("users"), users);
  assert.deepEqual(await saved("deliveryCalendar"), calendar);
  const current = (await db.doc(`${ROOT}/shiftPlanningState/current`).get()).data();
  assert.equal(current.maintenanceStatus, "closed"); assert.equal(current.writeEpoch, 2);
  assert.equal(current.activeRevision, null); assert.equal(current.activeDigest, null);
  assert.equal((await collection("shiftRotations").get()).size, 0);
  const recoveredPublic = await saved("shifts");
  assert.equal((await f.service.inverse({scope: inverseScope, forwardReadBack: forward})).replayed, true);
  assert.equal((await f.forward()).recovered, true);
  assert.deepEqual(await saved("shifts"), recoveredPublic);
  for (const name of ["notificationEvents", "shiftCoverageCredits", "shiftCoverageReserves", "shiftCoverageCases"])
    assert.equal((await collection(name).get()).size, 0);
});

run("SDK rejects a legacy ABA restore even when its complete body is unchanged", async () => {
  const f = await harness(), path = f.prepared.legacy[0].path, reference = db.doc(path), before = await reference.get();
  await reference.update({status: "confirmed"}); await reference.set(before.data());
  const latest = await reference.get();
  assert.deepEqual(encoded(latest.data()), encoded(before.data()));
  assert.equal(latest.updateTime.isEqual(before.updateTime), false);
  await assert.rejects(f.forward(), /legacy source version changed/);
  await noForwardWrites();
});

run("SDK rejects a concurrent extra public row without deleting or overwriting it", async () => {
  const f = await harness(), extra = `${ROOT}/shifts/shift_delivery_20300102`;
  const original = fixture.legacyRows()[0].data;
  await db.doc(extra).create(original);
  const extraBefore = await db.doc(extra).get();
  await assert.rejects(f.forward(), /public source cardinality|source.*binding/);
  assert.equal((await collection("shifts").get()).size, 63);
  const extraAfter = await db.doc(extra).get();
  assert.deepEqual(encoded(extraAfter.data()), encoded(extraBefore.data()));
  assert.ok(extraAfter.updateTime.isEqual(extraBefore.updateTime));
  assert.equal((await collection("shiftPlanningOperations").get()).size, 0);
});

run("SDK rejects canonical ABA drift before inverse despite restored body equality", async () => {
  const f = await harness(), forward = await f.forward();
  const reference = db.doc(`${ROOT}/shifts/${f.prepared.content.shifts[0].id}`), before = await reference.get();
  await reference.update({status: "confirmed"}); await reference.set(before.data());
  await assert.rejects(f.service.inverse({scope: await f.scope(true), forwardReadBack: forward}),
    /stale forward updateTime|afterimage commit version changed/);
  assert.equal((await collection("shifts").get()).size, 72);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("writeEpoch"), 1);
});

run("SDK inverse rejects a re-digested receipt that adopts a later public edit", async () => {
  const f = await harness(), forward = await f.forward();
  const path = `${ROOT}/shifts/${f.prepared.content.shifts[0].id}`, reference = db.doc(path);
  await reference.update({status: "confirmed"});
  const current = await reference.get(), forged = structuredClone(forward);
  const entry = forged.documents.find((row) => row.path === path);
  entry.payload = encoded(current.data()); entry.updateTime = encoded(current.updateTime);
  const body = {...forged}; delete body.receiptDigest;
  forged.receiptDigest = digest(body);
  await assert.rejects(f.service.inverse({scope: await f.scope(true), forwardReadBack: forged}),
    /afterimage|receipt|binding|changed/);
  assert.equal((await reference.get()).get("status"), "confirmed");
  assert.equal((await collection("shifts").get()).size, 72);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("writeEpoch"), 1);
});

run("SDK inverse refuses an unexpected public document even with a freshly bound scope", async () => {
  const f = await harness(), forward = await f.forward();
  await db.doc(`${ROOT}/shifts/shift_delivery_20300102`).create(fixture.legacyRows()[0].data);
  await assert.rejects(f.service.inverse({scope: await f.scope(true), forwardReadBack: forward}),
    /public|source|extra|cardinality/);
  assert.equal((await collection("shifts").get()).size, 73);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("writeEpoch"), 1);
});

run("SDK refuses current member eligibility changes after the captured roster", async () => {
  const f = await harness();
  await db.doc(`${ROOT}/users/${fixture.cohort[0]}`).update({isActive: false});
  await assert.rejects(f.forward(), /guard|source|member|roster/);
  await noForwardWrites();
});

run("SDK rejects coherent held workbook evidence whose revision contradicts the prepared local policy", async () => {
  const f = await harness(), originals = await saved("shifts"), scope = await f.scope();
  scope.expectedWorkbookRevision = "99";
  // heldControl echoes revision 99 into the checkpoint and both workbook
  // observations: the contradiction is with the prepared policy, not a broken
  // or stale barrier proof.
  await assert.rejects(f.service.forward({scope}), /scope|workbook|revision/);
  assert.deepEqual(await saved("shifts"), originals);
  await noForwardWrites();
});

run("SDK forward refuses a reserved workbook pointer even with a fresh source scope", async () => {
  const f = await harness(), originals = await saved("shifts"), pointer = await reserveWorkbook();
  await assert.rejects(f.forward(), /workbook submission pointer must be absent/);
  assert.deepEqual(await saved("shifts"), originals);
  assert.equal((await collection("shiftPlanningOperations").get()).size, 0);
  assert.equal((await collection("shiftPlanningMigrationBaselines").get()).size, 0);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).exists, false);
  const afterPointer = await pointer.ref.get();
  assert.deepEqual(encoded(afterPointer.data()), encoded(pointer.data()));
  assert.ok(afterPointer.updateTime.isEqual(pointer.updateTime));
});

run("SDK inverse refuses a newly reserved workbook pointer without changing its 72 public rows", async () => {
  const f = await harness(), forward = await f.forward(), originals = await saved("shifts");
  const pointer = await reserveWorkbook();
  await assert.rejects(f.service.inverse({scope: await f.scope(true), forwardReadBack: forward}),
    /workbook submission pointer must be absent/);
  assert.deepEqual(await saved("shifts"), originals);
  assert.equal((await collection("shifts").get()).size, 72);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("writeEpoch"), 1);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningOperations/${f.prepared.operationId}`).get()).get("operationKind"), "activation");
  const afterPointer = await pointer.ref.get();
  assert.deepEqual(encoded(afterPointer.data()), encoded(pointer.data()));
  assert.ok(afterPointer.updateTime.isEqual(pointer.updateTime));
});

run("SDK public mutation admission honors active notification resource fences", async () => {
  const f = await harness(), resourceId = f.prepared.content.shifts[0].id;
  const fence = {schemaVersion: 1, operationKind: "notificationDispatchResourceFence", scope: "shift", resourceId,
    intentId: "intent", eventId: "event", attemptId: "attempt", workerId: "worker", leaseEpoch: 1,
    acquiredAt: Timestamp.fromMillis(fixture.NOW - 1000),
    expiresAt: Timestamp.fromMillis(fixture.NOW - 1000 + SHIFT_PLANNING_NOTIFICATION_DISPATCH_LEASE_MILLIS),
    validationDigest: digest("portable active dispatch")};
  await db.doc(`${ROOT}/shiftPlanningNotificationFences/${shiftPlanningNotificationResourceFenceId("shift", resourceId)}`).create(fence);
  await assert.rejects(f.forward(), (error) => error.code === "planning_release_lease_conflict");
  await noForwardWrites();
});

run("SDK barrier read-back failure journals closure before any migration commit", async () => {
  const f = await harness({onReadBack: async (count) => { if (count === 1) throw new Error("unconfirmed closed barrier"); }});
  await assert.rejects(f.forward());
  assert.equal(f.control.failed.phase, "initialReadBack");
  assert.ok(f.control.events.includes("failureJournal"));
  await noForwardWrites();
});

run("SDK refuses success when both barrier confirmation and failure-journal acknowledgement fail", async () => {
  const f = await harness({onReadBack: async (count) => { if (count === 1) throw new Error("unconfirmed closed barrier"); },
    onJournal: async () => { throw new Error("failure journal unavailable"); }});
  await assert.rejects(f.forward());
  assert.equal(f.control.failed, null);
  assert.ok(f.control.events.includes("failureJournal"));
  await noForwardWrites();
});

run("SDK lost final-barrier acknowledgement never reports rollback of an already committed forward", async () => {
  const f = await harness({onReadBack: async (count) => { if (count === 2) throw new Error("final closed read-back unavailable"); }});
  await assert.rejects(f.forward());
  assert.equal(f.control.failed.phase, "finalReadBack");
  assert.equal((await collection("shifts").get()).size, 72);
  assert.equal((await collection("shiftPlanningOperations").get()).size, 1);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"), "closed");
});

run("SDK commit acknowledgement loss retains the committed migration and blocks retries after fixture TTL", async (t) => {
  let now = fixture.NOW;
  const f = await harness({nowMillis: () => now});
  const actual = Firestore.prototype.runTransaction;
  let armed = true;
  const lost = t.mock.method(Firestore.prototype, "runTransaction", async function(...args) {
    const result = await actual.call(this, ...args);
    if (armed && result?.measurement?.direction === "forward") {
      armed = false;
      throw new Error("Injected SDK commit acknowledgement loss");
    }
    return result;
  });
  await assert.rejects(f.forward(), /Injected SDK commit acknowledgement loss/);
  lost.mock.restore();
  assert.equal(armed, false, "The injection must follow the actual admitted SDK commit");
  assert.equal(f.control.failed.phase, "operation");
  assert.equal((await collection("shifts").get()).size, 72);
  assert.equal((await collection("shiftPlanningOperations").get()).size, 1);
  const committed = await saved("shifts");
  now += 7 * 86_400_000;
  await assert.rejects(f.forward(), /retained barrier failure requires governed inspection/);
  assert.deepEqual(await saved("shifts"), committed);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"), "closed");
});
