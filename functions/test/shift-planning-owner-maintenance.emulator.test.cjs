const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createFirestoreShiftPlanningStateRepository} =
  require("../lib/shift-planning-firestore-state-repository.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository} =
  require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {enterShiftPlanningMaintenanceBehindIntakeBarrier: enter,
  createShiftPlanningControlManifestDigest,
  verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningOwnerAgreementIntakeBarrierCheckpoint: checkpoint,
  createTrustedShiftPlanningOwnerAgreementIntakeBarrierAdapter: ownerAdapter,
  createTrustedShiftPlanningIntakeBarrierAdapter: strictAdapter} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {createShiftPlanningOwnerMaintenanceAgreement} =
  require("../lib/shift-planning-owner-maintenance.js");
const {SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID: OWNER_ID} =
  require("../lib/shift-planning-writer-inventory.js");
const {ownerFixture} = require("./shift-planning-owner-maintenance-fixture.cjs");
const {administratorFixture} = require("./shift-planning-administrator-maintenance-fixture.cjs");
const {createShiftPlanningAdministratorBarrierCheckpoint,
  createTrustedShiftPlanningAdministratorBarrierAdapter} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");

// This suite uses a separate emulator database so the earlier develop fixtures
// cannot accidentally supply authority or retained evidence to these cases.
const PROJECT = "demo-reguerta-owner-maintenance";
const HOST = "127.0.0.1:8897";
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, HOST);
const ROOT = "develop/plus-collections";
const CONTROL = "ownerMaintenanceRehearsal/control";
const EFFECT = "ownerMaintenanceRehearsal/effect";
const STATE = `${ROOT}/shiftPlanningState/current`;
const ACTIVE = digest({active: 4});
const BASELINE = digest({baseline: "published-assignments"});
const TRANSITION = "maintenance-entry-7";
const evidencePath = () => `${ROOT}/shiftPlanningOperations/barrier-evidence-${TRANSITION}`;
const failurePath = () => `${ROOT}/shiftPlanningOperations/barrier-failure-${TRANSITION}`;
const operationPath = () => `${ROOT}/shiftPlanningOperations/state-${TRANSITION}`;

let app, db, now, stateRepository, evidenceRepository;

before(async () => {
  app = initializeApp({projectId: PROJECT}, "owner-maintenance-emulator-tests");
  db = getFirestore(app);
});
after(async () => { await deleteApp(app); });
beforeEach(async () => {
  const response = await fetch(
    `http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
  now = 530;
  stateRepository = createFirestoreShiftPlanningStateRepository(db, () => Timestamp.fromMillis(now));
  evidenceRepository = createFirestoreShiftPlanningIntakeBarrierRepository(db, () => Timestamp.fromMillis(now));
});

const maintenance = () => ({schemaVersion: 1, stateRevision: 6, writeEpoch: 11,
  maintenanceStatus: "open", activeRevision: "active-4", activeDigest: ACTIVE,
  intakeBarrier: null, lastTransitionId: "published-owner-demo"});
const rotation = (type) => ({schemaVersion: 1, type,
  stateRevision: type === "delivery" ? 4 : 7,
  cursor: {schemaVersion: 1, type, cohortUserIds: ["member-a", "member-b"],
    roundNumber: 2, nextMemberIndex: 1},
  planningFrontierSeasonStartYear: 2026, cohortFrozen: true,
  frozenCohortUserIds: ["member-a", "member-b"], activeRevision: "active-4",
  activeDigest: ACTIVE, lastIdempotencyKey: "published-owner-demo",
  migrationBaseline: {revision: "baseline-owner-demo", digest: BASELINE}, releaseLease: null});
const canaryPaths = [
  `${ROOT}/shifts/published-canary`,
  `${ROOT}/deliveryCalendar/published-canary`,
  "production/plus-collections/shifts/published-canary",
  "production/plus-collections/shiftPlanningState/current",
];
const protectedPaths = [...canaryPaths,
  `${ROOT}/shiftRotations/delivery`, `${ROOT}/shiftRotations/market`];
async function seed() {
  await Promise.all([
    db.doc(STATE).create(maintenance()),
    ...["delivery", "market"].map((type) =>
      db.doc(`${ROOT}/shiftRotations/${type}`).create(rotation(type))),
    ...canaryPaths.map((path, index) => db.doc(path).create({
      sentinel: index, date: Timestamp.fromDate(new Date("2027-01-06T00:00:00Z")),
      assignedUserIds: ["member-b", "member-a"],
    })),
  ]);
  return stateRepository.loadAuthoritativeState({environment: "develop"});
}
async function snapshots(paths) {
  const result = await db.getAll(...paths.map((path) => db.doc(path)));
  return result.map((snapshot) => ({path: snapshot.ref.path, exists: snapshot.exists,
    data: snapshot.data() ?? null, version: snapshot.updateTime ?
      `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}` : null}));
}
async function noBusinessSideEffects(expectedCanaries) {
  assert.deepEqual(await snapshots(protectedPaths), expectedCanaries);
  assert.equal((await db.collection(`${ROOT}/notificationEvents`).get()).empty, true);
  assert.equal((await db.collection("production/plus-collections/notificationEvents").get()).empty, true);
}
const conflict = (error) => error instanceof Error && error.code === "maintenance_state_conflict";

async function fixture() {
  const source = await seed();
  return ownerFixture({expectedAuthoritativeDigest: source.authoritativeDigest});
}
function rehash(value) {
  value.evidence.digest = digest(value.evidence.payload);
  value.evidenceDigest = value.evidence.digest;
  value.scopeDigest = digest(value.scope);
  const {checkpointDigest: _oldDigest, ...body} = value;
  value.checkpointDigest = digest(body);
  return value;
}
function rebindAgreement(original, change, keepExpectedDigest = false) {
  const result = structuredClone(original);
  const intent = result.agreement.payload.intent;
  change(intent);
  const confirmations = result.agreement.payload.confirmations.map((confirmation) => ({
    ...confirmation, intentDigest: digest(intent),
  }));
  result.agreement = createShiftPlanningOwnerMaintenanceAgreement(intent, confirmations);
  result.evidence.payload.ownerAgreement = result.agreement;
  const owner = result.evidence.payload.writerControls.find((control) => control.writerId === OWNER_ID);
  owner.controlDigest = result.agreement.digest;
  owner.initialReadBackDigest = result.agreement.digest;
  owner.finalReadBackDigest = result.agreement.digest;
  const manifest = createShiftPlanningControlManifestDigest(result.evidence.payload.writerControls, "owner-agreement");
  for (const binding of [result.command, result.scope]) {
    binding.expectedControlManifestDigest = manifest;
    if (!keepExpectedDigest) binding.expectedOwnerAgreementDigest = result.agreement.digest;
  }
  result.evidence.digest = digest(result.evidence.payload);
  return result;
}
async function controls(value, rawCheckpoint) {
  const held = rawCheckpoint ?? checkpoint({scope: value.scope,
    holdRevision: "owner-hold-demo", evidence: value.evidence});
  const technical = value.evidence.payload.writerControls.filter((control) => control.writerId !== OWNER_ID);
  await db.doc(CONTROL).create({technicalClosed: true, technical,
    checkpoint: held, ownerObservation: value.evidence.payload.ownerObservation});
  const calls = {close: 0, read: 0, observation: 0, reopen: 0};
  async function readTechnical() {
    const current = await db.doc(CONTROL).get();
    const observed = current.get("technical");
    if (current.get("technicalClosed") !== true || !Array.isArray(observed) ||
        observed.some((control) => control.pendingWorkCount !== 0 || control.inFlightWorkCount !== 0) ||
        digest(observed) !== digest(technical)) {
      throw Error("local_technical_controls_not_closed");
    }
    return current.get("checkpoint");
  }
  const port = {
    async closeAndCollect() { calls.close += 1; return readTechnical(); },
    async readBackClosed() { calls.read += 1; return readTechnical(); },
    async readBackOwnerObservation() {
      calls.observation += 1;
      return (await db.doc(CONTROL).get()).get("ownerObservation");
    },
    async reopen() {
      calls.reopen += 1;
      await db.doc(CONTROL).update({technicalClosed: false});
    },
  };
  return {calls, port, held, adapter: ownerAdapter({controlPlane: port,
    failurePersistence: evidenceRepository, readClockMillis: () => now})};
}
async function administratorControls(value) {
  const control = await controls(value, createShiftPlanningAdministratorBarrierCheckpoint({
    scope: value.scope, holdRevision: "administrator-demo-hold", evidence: value.evidence}));
  await db.doc(CONTROL).update({administratorObservation: value.evidence.payload.administratorObservation});
  control.port.readBackAdministratorObservation = async () =>
    (await db.doc(CONTROL).get()).get("administratorObservation");
  control.adapter = createTrustedShiftPlanningAdministratorBarrierAdapter({controlPlane: control.port,
    failurePersistence: evidenceRepository, readClockMillis: () => now});
  return control;
}
const run = (value, control, repository = stateRepository) => enter({
  barrierAdapter: control.adapter, evidencePersistence: evidenceRepository,
  statePersistence: repository, readClockMillis: () => now,
}, value.command);
async function noEntry(beforeState, beforeCanaries) {
  assert.deepEqual(await snapshots([STATE]), beforeState);
  for (const path of [evidencePath(), operationPath(), EFFECT]) {
    assert.equal((await db.doc(path).get()).exists, false, path);
  }
  await noBusinessSideEffects(beforeCanaries);
}
async function assertIncident(value, reason, phase) {
  const raw = await db.doc(failurePath()).get();
  assert.equal(raw.get("schemaVersion"), 2);
  assert.equal(raw.get("phase"), phase);
  const observed = (await db.doc(CONTROL).get()).get("ownerObservation");
  const expected = {agreementDigest: value.agreement.digest, reason,
    observationDigest: digest(observed)};
  assert.deepEqual(raw.get("ownerIncident"), expected);
  const parsed = await evidenceRepository.readExistingFailure({
    environment: "develop", transitionId: TRANSITION,
  });
  assert.deepEqual(parsed.ownerIncident, expected);
  assert.equal(parsed.failureDigest, raw.get("failureDigest"));
}
async function remainsClosed(control, beforeCanaries, value, reason, phase) {
  assert.equal((await db.doc(CONTROL).get()).get("technicalClosed"), true);
  assert.equal(control.calls.reopen, 0);
  const state = (await db.doc(STATE).get()).data();
  assert.equal(state.maintenanceStatus, "closed");
  assert.equal(state.writeEpoch, 12);
  assert.equal(state.stateRevision, 7);
  await assertIncident(value, reason, phase);
  await noBusinessSideEffects(beforeCanaries);
}

test("explicit owner mode enters through the existing CAS and immutable evidence; replay is read-only even after expiry", async () => {
  const value = await fixture();
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  const result = await run(value, control);
  assert.equal(result.kind, "committed");
  const state = (await db.doc(STATE).get()).data();
  assert.equal(state.maintenanceStatus, "closed");
  assert.equal(state.stateRevision, 7);
  assert.equal(state.writeEpoch, 12);
  const retained = (await db.doc(evidencePath()).get()).get("evidence");
  assert.equal(retained.payload.schemaVersion, 2);
  assert.equal(retained.payload.maintenanceMode, "owner-agreement");
  assert.deepEqual(retained.payload.ownerAgreement, value.agreement);
  const residual = retained.payload.writerControls.find((entry) => entry.writerId === OWNER_ID);
  assert.equal(residual.state, "agreement-recorded");
  assert.equal(retained.payload.writerControls.length, 24);
  assert.equal(retained.payload.writerControls.filter((entry) => entry.state === "agreement-recorded").length, 1);
  assert.equal(retained.payload.ownerObservation.technicalCapability, "retained");
  assert.equal((await db.doc(failurePath()).get()).exists, false);
  const afterCommit = await snapshots([STATE, evidencePath(), operationPath()]);
  const callSnapshot = {...control.calls};
  now = value.agreement.payload.intent.endsAtMillis;
  assert.equal((await run(value, control)).kind, "replayed");
  assert.deepEqual(control.calls, callSnapshot);
  assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath()]), afterCommit);
  assert.equal((await db.collection(`${ROOT}/shiftPlanningOperations`).get()).size, 2);
  await noBusinessSideEffects(beforeCanaries);
});

test("develop administrator v3 uses the same Firestore CAS and immutable receipts without changing production", async () => {
  const source = await seed(), value = administratorFixture({expectedAuthoritativeDigest: source.authoritativeDigest});
  const beforeCanaries = await snapshots(protectedPaths), control = await administratorControls(value);
  assert.equal((await run(value, control)).kind, "committed");
  const state = (await db.doc(STATE).get()).data();
  assert.equal(state.maintenanceStatus, "closed"); assert.equal(state.writeEpoch, 12);
  const retained = await evidenceRepository.readExisting({environment: "develop", transitionId: TRANSITION});
  assert.equal(retained.payload.schemaVersion, 3);
  assert.deepEqual(retained.payload.administratorAgreement, value.administratorAgreement);
  const after = await snapshots([STATE, evidencePath(), operationPath()]);
  now = value.administratorAgreement.payload.intent.endsAtMillis;
  assert.equal((await run(value, control)).kind, "replayed");
  assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath()]), after);
  assert.equal(control.calls.reopen, 0);
  await noBusinessSideEffects(beforeCanaries);
});

test("withdrawal after the actual v3 maintenance CAS persists a typed administrative incident and closed state", async () => {
  const source = await seed(), value = administratorFixture({expectedAuthoritativeDigest: source.authoritativeDigest});
  const beforeCanaries = await snapshots(protectedPaths), control = await administratorControls(value);
  const repository = {...stateRepository, async enterMaintenanceWithBarrierEvidence(command) {
    const result = await stateRepository.enterMaintenanceWithBarrierEvidence(command);
    await db.doc(CONTROL).update({"administratorObservation.agreementStatus": "withdrawn"});
    return result;
  }};
  await assert.rejects(run(value, control, repository));
  assert.equal((await db.doc(STATE).get()).get("maintenanceStatus"), "closed");
  assert.equal((await db.doc(operationPath()).get()).exists, true);
  const failure = await evidenceRepository.readExistingFailure({environment: "develop", transitionId: TRANSITION});
  assert.equal(failure.schemaVersion, 3);
  assert.equal(failure.administratorIncident.reason, "administrator_withdrawn");
  await db.doc(CONTROL).update({"administratorObservation.agreementStatus": "confirmed"});
  await assert.rejects(run(value, control));
  assert.equal(control.calls.reopen, 0);
  await noBusinessSideEffects(beforeCanaries);
});

test("the default strict adapter cannot turn owner-mode evidence into a maintenance entry", async () => {
  const value = await fixture();
  const beforeState = await snapshots([STATE]);
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  control.adapter = strictAdapter({controlPlane: control.port, failurePersistence: evidenceRepository});
  await assert.rejects(run(value, control), conflict);
  await noEntry(beforeState, beforeCanaries);
});

test("expiry before admission leaves state and business data unchanged, retaining only a closed failure", async () => {
  const value = await fixture();
  const beforeState = await snapshots([STATE]);
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  now = value.agreement.payload.intent.endsAtMillis;
  await assert.rejects(run(value, control), conflict);
  await noEntry(beforeState, beforeCanaries);
  assert.equal((await db.doc(CONTROL).get()).get("technicalClosed"), true);
  await assertIncident(value, "agreement_expired", "initialReadBack");
});

test("a rehashed newly confirmed agreement cannot satisfy the previously authorized agreement digest", async () => {
  const original = await fixture();
  const beforeState = await snapshots([STATE]);
  const beforeCanaries = await snapshots(protectedPaths);
  const changed = rebindAgreement(original, (intent) => { intent.agreementId = "different-owner-agreement"; }, true);
  const raw = structuredClone(checkpoint({scope: original.scope,
    holdRevision: "owner-hold-demo", evidence: original.evidence}));
  raw.scope = changed.scope;
  raw.evidence = changed.evidence;
  rehash(raw);
  const control = await controls(changed, raw);
  assert.notEqual(changed.agreement.digest, changed.command.expectedOwnerAgreementDigest);
  await assert.rejects(run(changed, control), conflict);
  await noEntry(beforeState, beforeCanaries);
});

for (const [label, change, reason] of [
  ["owner identity", {"ownerObservation.ownerPrincipalId": "another-owner"}, "authority_drift"],
  ["effective ACL authority", {"ownerObservation.effectiveAuthorityDigest": digest({authority: "changed"})}, "authority_drift"],
  ["withdrawn consent", {"ownerObservation.agreementStatus": "withdrawn"}, "owner_withdrawn"],
]) {
  test(`fresh ${label} drift blocks admission even with the original immutable checkpoint`, async () => {
    const value = await fixture();
    const beforeState = await snapshots([STATE]);
    const beforeCanaries = await snapshots(protectedPaths);
    const control = await controls(value);
    await db.doc(CONTROL).update({...change, "ownerObservation.observedAtMillis": now});
    await assert.rejects(run(value, control), conflict);
    await noEntry(beforeState, beforeCanaries);
    assert.equal((await db.doc(CONTROL).get()).get("technicalClosed"), true);
    await assertIncident(value, reason, "initialReadBack");
  });
}

for (const [label, observedAtMillis] of [
  ["stale", 480], ["future-dated", 600],
]) {
  test(`a ${label} fresh owner read-back blocks admission while the historical packet and window remain valid`, async () => {
    const value = await fixture();
    value.command.maximumEvidenceAgeMillis = 100;
    value.scope.maximumEvidenceAgeMillis = 100;
    value.evidence.payload.policy.maximumEvidenceAgeMillis = 100;
    value.evidence.digest = digest(value.evidence.payload);
    now = 590;
    assert.equal(value.evidence.payload.ownerObservation.observedAtMillis, 510);
    assert.ok(now < value.agreement.payload.intent.endsAtMillis);
    assert.ok(now - value.evidence.payload.ownerObservation.observedAtMillis <= 100);
    assert.doesNotThrow(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
      value.evidence, value.command, now,
    ));
    const beforeState = await snapshots([STATE]);
    const beforeCanaries = await snapshots(protectedPaths);
    const control = await controls(value);
    await db.doc(CONTROL).update({"ownerObservation.observedAtMillis": observedAtMillis});
    let casCalls = 0;
    const counted = {...stateRepository, async enterMaintenanceWithBarrierEvidence(command) {
      casCalls += 1;
      return stateRepository.enterMaintenanceWithBarrierEvidence(command);
    }};
    await assert.rejects(run(value, control, counted), conflict);
    assert.equal(casCalls, 0);
    await noEntry(beforeState, beforeCanaries);
    assert.equal((await db.doc(CONTROL).get()).get("technicalClosed"), true);
    assert.equal(control.calls.reopen, 0);
    await assertIncident(value, "authority_drift", "initialReadBack");
  });
}

for (const [label, change] of [
  ["an old writer still running", (payload) => { payload.writerControls[0].inFlightWorkCount = 1; }],
  ["a pending causal delivery", (payload) => { payload.causalDrain.finalPendingDeliveryCount = 1; }],
  ["an unresolved owner-authorized write", (payload) => { payload.ownerObservation.unresolvedWriteCount = 1; }],
]) {
  test(`${label} cannot inherit the owner's cooperative exception`, async () => {
    const value = await fixture();
    const beforeState = await snapshots([STATE]);
    const beforeCanaries = await snapshots(protectedPaths);
    const raw = structuredClone(checkpoint({scope: value.scope,
      holdRevision: "owner-hold-demo", evidence: value.evidence}));
    change(raw.evidence.payload);
    rehash(raw);
    const control = await controls(value, raw);
    await assert.rejects(run(value, control), conflict);
    await noEntry(beforeState, beforeCanaries);
  });
}

test("a new agreement/window cannot replace the receipt already owned by the same transition", async () => {
  const value = await fixture();
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  await run(value, control);
  const retained = await snapshots([STATE, evidencePath(), operationPath()]);
  const renewed = rebindAgreement(value, (intent) => {
    intent.agreementId = "renewed-agreement"; intent.endsAtMillis = 650;
  });
  await assert.rejects(run(renewed, control));
  assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath()]), retained);
  await noBusinessSideEffects(beforeCanaries);
});

test("a historical receipt cannot reclaim maintenance after a newer epoch owns the current state", async () => {
  const value = await fixture();
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  await run(value, control);
  await db.doc(STATE).update({stateRevision: 8, writeEpoch: 13, lastTransitionId: "newer-operation"});
  const newer = await snapshots([STATE, evidencePath(), operationPath()]);
  const callSnapshot = {...control.calls};
  await assert.rejects(run(value, control), conflict);
  assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath()]), newer);
  assert.deepEqual(control.calls, callSnapshot);
  await noBusinessSideEffects(beforeCanaries);
});

test("a lost acknowledgement after the real CAS retains the committed afterimage and a closed incident, never a second CAS", async () => {
  const value = await fixture();
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  let submissions = 0;
  const losingAck = {...stateRepository, async enterMaintenanceWithBarrierEvidence(command) {
    submissions += 1;
    await stateRepository.enterMaintenanceWithBarrierEvidence(command);
    throw Error("owner_entry_commit_ack_lost");
  }};
  await assert.rejects(run(value, control, losingAck), /owner_entry_commit_ack_lost/);
  await remainsClosed(control, beforeCanaries, value, "operation_failed", "operation");
  const after = await snapshots([STATE, evidencePath(), operationPath(), failurePath()]);
  await assert.rejects(run(value, control, losingAck), conflict);
  assert.equal(submissions, 1);
  assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath(), failurePath()]), after);
});

for (const [label, invalidate, reason] of [
  ["deadline expiry", async (value) => { now = value.agreement.payload.intent.endsAtMillis; }, "agreement_expired"],
  ["reported owner activity with unchanged content digest", async () => {
    await db.doc(CONTROL).update({"ownerObservation.ownerActivity": "edit-reported",
      "ownerObservation.observedAtMillis": now});
  }, "owner_reported_activity"],
]) {
  test(`${label} after a guarded real effect keeps its afterimage and blocks automatic continuation`, async () => {
    const value = await fixture();
    const beforeCanaries = await snapshots(protectedPaths);
    const control = await controls(value);
    let submissions = 0;
    const guardedEffect = {...stateRepository, async enterMaintenanceWithBarrierEvidence(command) {
      submissions += 1;
      const result = await stateRepository.enterMaintenanceWithBarrierEvidence(command);
      await db.doc(EFFECT).create({operationId: TRANSITION, accepted: true,
        recordedSourceDigest: value.evidence.payload.workbook.digest});
      await invalidate(value);
      return result;
    }};
    await assert.rejects(run(value, control, guardedEffect), conflict);
    assert.deepEqual((await db.doc(EFFECT).get()).data(), {operationId: TRANSITION,
      accepted: true, recordedSourceDigest: value.evidence.payload.workbook.digest});
    assert.equal((await db.doc(CONTROL).get()).get("ownerObservation.sourceDigest"),
      value.evidence.payload.ownerObservation.sourceDigest);
    await remainsClosed(control, beforeCanaries, value, reason, "finalReadBack");
    const after = await snapshots([STATE, evidencePath(), operationPath(), failurePath(), EFFECT]);
    await assert.rejects(run(value, control, guardedEffect), conflict);
    assert.equal(submissions, 1);
    assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath(), failurePath(), EFFECT]), after);
  });
}

test("an incident persisted between the two read-only replay guards blocks the result without another CAS", async () => {
  const value = await fixture();
  const beforeCanaries = await snapshots(protectedPaths);
  const control = await controls(value);
  await run(value, control);
  const committed = await snapshots([STATE, evidencePath(), operationPath()]);
  const callSnapshot = {...control.calls};
  let failureReads = 0;
  const concurrentFailure = {...evidenceRepository, async readExistingFailure(key) {
    const existing = await evidenceRepository.readExistingFailure(key);
    failureReads += 1;
    if (failureReads === 1) {
      assert.equal(existing, null);
      await db.doc(CONTROL).update({"ownerObservation.ownerActivity": "edit-reported",
        "ownerObservation.observedAtMillis": now});
      const observation = (await db.doc(CONTROL).get()).get("ownerObservation");
      await evidenceRepository.retainFailureAndReadBack({environment: "develop",
        transitionId: TRANSITION, scopeDigest: control.held.scopeDigest,
        holdRevision: control.held.holdRevision, checkpointDigest: control.held.checkpointDigest,
        phase: "finalReadBack", ownerIncident: {agreementDigest: value.agreement.digest,
          reason: "owner_reported_activity", observationDigest: digest(observation)}});
    }
    return existing;
  }};
  control.adapter = ownerAdapter({controlPlane: control.port,
    failurePersistence: concurrentFailure, readClockMillis: () => now});
  let casCalls = 0;
  const counted = {...stateRepository, async enterMaintenanceWithBarrierEvidence(command) {
    casCalls += 1;
    return stateRepository.enterMaintenanceWithBarrierEvidence(command);
  }};
  await assert.rejects(run(value, control, counted), conflict);
  assert.equal(failureReads, 2);
  assert.equal(casCalls, 0);
  assert.deepEqual(control.calls, callSnapshot);
  assert.deepEqual(await snapshots([STATE, evidencePath(), operationPath()]), committed);
  await assertIncident(value, "owner_reported_activity", "finalReadBack");
  await noBusinessSideEffects(beforeCanaries);
  assert.equal((await db.doc(EFFECT).get()).exists, false);
});
