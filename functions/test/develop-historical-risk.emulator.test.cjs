"use strict";
const assert = require("node:assert/strict");
const {before, beforeEach, after, test} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const migration = require("../scripts/rehearse-develop-shift-migration.cjs");
const fixture = require("./develop-shift-migration-fixture.cjs");
const {historicalFixture} = require("./develop-historical-risk-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningAdministratorBarrierCheckpoint: checkpoint} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository: repository} = require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {Timestamp} = require("firebase-admin/firestore");
const enabled = process.env.GCLOUD_PROJECT === migration.PROJECT_ID && process.env.FIRESTORE_EMULATOR_HOST === migration.HOST;
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const ROOT = fixture.ROOT;
let db;const services = [];
before(() => {if (enabled) db = new Firestore({projectId: migration.PROJECT_ID, host: migration.HOST, ssl: false});});
beforeEach(async () => {
  if (enabled) assert.equal((await fetch(`http://${migration.HOST}/emulator/v1/projects/${migration.PROJECT_ID}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
});
after(async () => {for (const s of services) await s.close();if (db) await db.terminate();});
const rows = async name => (await db.collection(`${ROOT}/${name}`).orderBy("__name__").get()).docs.map(d => ({id: d.id, data: d.data()}));
async function harness() {
  const legacyCapture = await fixture.seedAndCapture(db);
  for (const [id, dispatch] of [["old-success", {status: "success"}], ["old-unknown", null]]) {
    await db.doc(`${ROOT}/notificationEvents/${id}`).create({type: "admin_broadcast", ...(dispatch ? {dispatch} : {})});
  }
  const prepared = migration.prepareDevelopShiftMigration({contentProposal: fixture.contentProposal(), legacyCapture});
  const journal = repository(db, () => Timestamp.fromMillis(520));
  let f, held, onRead = async () => {};
  const controlPlane = {closeAndCollect: async () => {
    held = checkpoint({scope: f.scope, evidence: f.evidence, holdRevision: "risk-local"});
    await journal.retainAndReadBack({environment: "develop", transitionId: f.command.transitionId, evidence: f.evidence});
    return held;
  }, readBackClosed: async () => {await onRead();return held;},
  readBackOwnerObservation: async () => f.evidence.payload.ownerObservation,
  readBackAdministratorObservation: async () => f.evidence.payload.administratorObservation};
  const service = migration.createDevelopShiftMigrationRehearsal({prepared, controlPlane, failurePersistence: journal,
    nowMillis: () => 520, historicalRiskMode: true});services.push(service);
  const scope = async (inverse = false, mutate) => {
    const inspection = await service.inspect();
    f = historicalFixture({transitionId: inverse ? prepared.recoveryOperationId : prepared.operationId,
      expectedAuthoritativeDigest: inspection.sourceDigest, expectedStateRevision: inspection.maintenance.stateRevision,
      expectedWriteEpoch: inspection.maintenance.writeEpoch, expectedActiveRevision: inspection.maintenance.activeRevision,
      expectedActiveDigest: inspection.maintenance.activeDigest, expectedWorkbookRevision: "1"});
    const risk = f.evidence.payload.causalDrain.historicalRisk;
    Object.assign(risk, migration.historicalMigrationPlanBindings(prepared), {
      direction: inverse ? "inverse" : "forward", migrationOperationId: prepared.operationId, recoveryOperationId: prepared.recoveryOperationId});
    mutate?.(f);
    f.command.expectedHistoricalRiskDigest = f.scope.expectedHistoricalRiskDigest = digest(risk);
    f.evidence.digest = digest(f.evidence.payload);
    return f.scope;
  };
  return {service, scope, prepared, journal, onRead: fn => {onRead = fn;}, current: () => f};
}
run("actual SDK migration and inverse retain historical notices and unknown evidence without replay", async () => {
  const h = await harness(), notices = await rows("notificationEvents"), originals = await rows("shifts");
  const scope = await h.scope(), forward = await h.service.forward({scope});
  assert.equal((await rows("shifts")).length, 72);
  assert.deepEqual(await rows("notificationEvents"), notices);
  const retained = await h.journal.readExisting({environment: "develop", transitionId: h.prepared.operationId});
  assert.equal(retained.payload.causalDrain.drainedAtMillis, null);
  assert.equal(retained.payload.causalDrain.finalInFlightWorkCount, null);
  assert.equal(retained.payload.causalDrain.historicalRisk.legacyUntracked, true);
  await h.service.inverse({scope: await h.scope(true), forwardReadBack: forward});
  assert.deepEqual(await rows("shifts"), originals);
  assert.deepEqual(await rows("notificationEvents"), notices);
  assert.equal((await rows("shiftCoverageEffects")).length, 0);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"), "closed");
});
run("a newly created notice after acceptance prevents the first migration CAS", async () => {
  const h = await harness(), scope = await h.scope();
  await db.doc(`${ROOT}/notificationEvents/late`).create({type: "late"});
  await assert.rejects(h.service.forward({scope}));
  assert.equal((await rows("shifts")).length, 62);
  assert.equal((await rows("shiftPlanningMigrationBaselines")).length, 0);
  assert.ok(await h.journal.readExistingFailure({environment: "develop", transitionId: h.prepared.operationId}));
});
run("a late assignment change is preserved and stops automatic inverse writes", async () => {
  const h = await harness(), forward = await h.service.forward({scope: await h.scope()});
  const scope = await h.scope(true), id = h.prepared.content.shifts[0].id;
  await db.doc(`${ROOT}/shifts/${id}`).update({manualLateNote: "retain"});
  await assert.rejects(h.service.inverse({scope, forwardReadBack: forward}));
  assert.equal((await db.doc(`${ROOT}/shifts/${id}`).get()).get("manualLateNote"), "retain");
  assert.equal((await rows("shifts")).length, 72);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"), "closed");
});
run("even a freshly authorized risk cannot substitute a different migration plan", async () => {
  const h = await harness(), scope = await h.scope(false, f => {f.evidence.payload.causalDrain.historicalRisk.migrationPlanDigest = digest("other");});
  await assert.rejects(h.service.forward({scope}));
  assert.equal((await rows("shifts")).length, 62);
});

run("a failure after committed migration retains closure without claiming rollback or replaying notices", async () => {
  const h = await harness(), scope = await h.scope(), notices = await rows("notificationEvents");let reads = 0;
  h.onRead(async () => {if (++reads === 2) h.current().evidence.payload.administratorObservation.unresolvedWriteCount = 1;});
  await assert.rejects(h.service.forward({scope}));
  assert.equal((await rows("shifts")).length, 72);
  assert.deepEqual(await rows("notificationEvents"), notices);
  assert.ok(await h.journal.readExistingFailure({environment: "develop", transitionId: h.prepared.operationId}));
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"), "closed");
  await assert.rejects(h.service.forward({scope}));
});
