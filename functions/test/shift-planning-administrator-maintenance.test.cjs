"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {administratorFixture, MODE, ADMIN} = require("./shift-planning-administrator-maintenance-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {parseShiftPlanningAdministratorMaintenanceAgreement: parseAgreement} =
  require("../lib/shift-planning-administrator-maintenance.js");
const {verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence: verify,
  createShiftPlanningControlManifestDigest: controlsDigest,
  verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence: ownerVerify,
  verifyShiftPlanningIntakeBarrierEvidence: strictVerify,
  parseShiftPlanningIntakeBarrierEvidenceEnvelope: strictParse,
  parseShiftPlanningOwnerAgreementIntakeBarrierEvidenceEnvelope: ownerParse} =
  require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningAdministratorBarrierCheckpoint: checkpointFor,
  createTrustedShiftPlanningAdministratorBarrierAdapter: adapterFor,
  createShiftPlanningOwnerAgreementIntakeBarrierCheckpoint: ownerCheckpoint,
  createShiftPlanningTrustedIntakeBarrierCheckpoint: strictCheckpoint,
  createShiftPlanningIntakeBarrierFailureClosureRecord: failureFor,
  parseShiftPlanningIntakeBarrierFailureClosureRecord: parseFailure} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const inventory = require("../lib/shift-planning-writer-inventory.js");

function recording(fixture, {missingReader = false} = {}) {
  const checkpoint = checkpointFor({scope: fixture.scope, holdRevision: "admin-hold-1", evidence: fixture.evidence});
  let now = fixture.nowMillis, incident = null;
  let current = structuredClone(fixture.evidence.payload.administratorObservation);
  const calls = [];
  const controlPlane = {closeAndCollect: async () => checkpoint, readBackClosed: async () => checkpoint,
    readBackOwnerObservation: async () => {calls.push("owner");
      return structuredClone(fixture.evidence.payload.ownerObservation);},
    ...(!missingReader ? {readBackAdministratorObservation: async () => {
      calls.push("admin"); if (current instanceof Error) throw current; return current;
    }} : {})};
  const adapter = adapterFor({readClockMillis: () => now, controlPlane,
    failurePersistence: {readExistingFailure: async () => incident,
      retainFailureAndReadBack: async (request) => { calls.push("incident");
        incident = failureFor(request, now); return incident; }}});
  return {adapter, calls, get incident() {return incident;},
    set now(value) {now = value;}, set observation(value) {current = value;}};
}

test("explicit v3 is develop-only, leaving strict v4 and owner-only v2 unmodified", async () => {
  const fixture = administratorFixture();
  assert.equal(verify(fixture.evidence, fixture.command, 530).expiresAtMillis, 590);
  assert.equal(inventory.SHIFT_PLANNING_WRITER_INVENTORY_REVISION, "hu082-affected-writers-v4");
  const strict = inventory.SHIFT_PLANNING_AFFECTED_WRITERS;
  assert.equal(strict.length, 29);
  const variant = inventory.SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITERS;
  assert.equal(variant.length, 31);
  const automated = variant.find((item) => item.writerId === "iam-firestore-admin-and-server-writers");
  assert.equal(automated.requiredState, "fenced");
  assert.equal(automated.control, "fence-external-authority");
  assert.equal(variant.find((item) => item.writerId === ADMIN).requiredState, "agreement-recorded");
  for (const parse of [strictParse, ownerParse]) assert.throws(() => parse(fixture.evidence));
  for (const verifyDefault of [strictVerify, ownerVerify]) {
    assert.throws(() => verifyDefault(fixture.evidence, fixture.command, 530));
  }
  for (const build of [strictCheckpoint, ownerCheckpoint]) assert.throws(() => build({
    scope: fixture.scope, holdRevision: "wrong-mode", evidence: fixture.evidence}));
  for (const field of ["projectId", "databaseId", "environment"]) {
    const changed = structuredClone(fixture.administratorAgreement);
    changed.payload.intent[field] = field === "environment" ? "production" : "another";
    changed.digest = digest(changed.payload);
    assert.throws(() => parseAgreement(changed));
  }
  const production = {...fixture.scope, environment: "production"};
  let callbacks = 0;
  await assert.rejects(recording(fixture).adapter.withClosedIntakeBarrier(production,
    async () => {callbacks += 1;}));
  assert.equal(callbacks, 0);
});

test("every named human must confirm the same complete intent; service accounts and groups are excluded", () => {
  for (const mutate of [
    (value) => value.payload.confirmations.pop(),
    (value) => value.payload.confirmations.push(value.payload.confirmations[0]),
    (value) => {value.payload.intent.administratorPrincipalIds.push("group:admins@example.test");},
    (value) => {value.payload.intent.administratorPrincipalIds[0] = "serviceAccount:runtime@example.test";},
    (value) => {value.payload.intent.sourceDigest = digest({source: "changed"});},
    (value) => {value.payload.confirmations[0].noAutomationViaHumanCredentials = false;},
  ]) {
    const value = structuredClone(administratorFixture().administratorAgreement);
    mutate(value); value.digest = digest(value.payload);
    assert.throws(() => parseAgreement(value));
  }
});

test("administrative cooperation preserves all workload, scheduler and causal drain gates", () => {
  for (const mutate of [
    (p) => p.writerControls.splice(p.writerControls.findIndex((c) => c.writerId === "scheduler-order-reminder-sunday20"), 1),
    (p) => {p.writerControls.find((c) => c.writerId === "iam-firestore-admin-and-server-writers").state = "agreement-recorded";},
    (p) => {p.writerControls.find((c) => c.writerId === "trigger-on-shift-written").inFlightWorkCount = 1;},
    (p) => {p.causalDrain.finalPendingDeliveryCount = 1;},
    (p) => {p.causalDrain.initialInFlightWorkCount = 1;},
    (p) => {p.causalDrain.legacyUntracked = false;},
    (p) => {p.causalDrain.legacyUntracked = true;},
    (p) => {p.administratorObservation.observedAtMillis = p.verifiedAtMillis + 1;},
  ]) {
    const fixture = administratorFixture(); mutate(fixture.evidence.payload);
    fixture.evidence.digest = digest(fixture.evidence.payload);
    assert.throws(() => verify(fixture.evidence, fixture.command, 530));
  }
  const fixture = administratorFixture();
  const changed = structuredClone(fixture.administratorAgreement);
  changed.payload.confirmations[0].confirmedAtMillis = 160;
  changed.digest = digest(changed.payload);
  fixture.evidence.payload.administratorAgreement = changed;
  const control = fixture.evidence.payload.writerControls.find((entry) => entry.writerId === ADMIN);
  for (const field of ["controlDigest", "initialReadBackDigest", "finalReadBackDigest"]) control[field] = changed.digest;
  fixture.command.expectedAdministratorAgreementDigest = changed.digest;
  fixture.command.expectedControlManifestDigest = controlsDigest(fixture.evidence.payload.writerControls, MODE);
  fixture.evidence.digest = digest(fixture.evidence.payload);
  assert.throws(() => verify(fixture.evidence, fixture.command, 530));
  for (const field of ["expectedAdministratorSourceRevision", "expectedAdministratorSourceDigest",
    "expectedEffectiveIamDigest", "expectedTechnicalControlManifestDigest", "expectedOwnerAgreementDigest"]) {
    const fixture = administratorFixture(); fixture.command[field] = field.endsWith("Revision") ? "different" : digest({wrong: field});
    assert.throws(() => verify(fixture.evidence, fixture.command, 530));
  }
});

test("fresh missing participants, activity, withdrawal, expiry, uncertainty and authority drift cause zero callbacks", async () => {
  for (const patch of [
    {administratorPrincipalIds: ["user:admin-a@example.test"]},
    {administratorPrincipalIds: ["user:admin-a@example.test", "user:admin-b@example.test", "user:unknown@example.test"]},
    {administratorActivity: "reported"}, {agreementStatus: "withdrawn"},
    {effectiveIamDigest: digest({iam: "changed"})}, {sourceDigest: digest({source: "changed"})},
    {unresolvedWriteCount: 1}, {technicalCapability: "fenced"}, {observedAtMillis: 531},
  ]) {
    const fixture = administratorFixture(); const runtime = recording(fixture);
    runtime.observation = {...fixture.evidence.payload.administratorObservation, ...patch};
    let callbacks = 0;
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope, async () => {callbacks += 1;}));
    assert.equal(callbacks, 0); assert.equal(runtime.incident.schemaVersion, 3);
    assert.equal(parseFailure(runtime.incident).administratorIncident.agreementDigest, fixture.administratorAgreement.digest);
  }
  for (const options of [{missingReader: true}, {}]) {
    const fixture = administratorFixture(), runtime = recording(fixture, options);
    runtime.now = 590;
    let callbacks = 0;
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope, async () => {callbacks += 1;}));
    assert.equal(callbacks, 0);
  }
  for (const patch of [{expectedAdministratorSourceDigest: digest({source: "wrong"})},
    {expectedEffectiveIamDigest: digest({iam: "wrong"})}, {expectedWriteEpoch: 12}]) {
    const fixture = administratorFixture();
    fixture.scope = {...fixture.scope, ...patch};
    const runtime = recording(fixture);
    let callbacks = 0;
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope,
      async () => {callbacks += 1;}));
    assert.equal(callbacks, 0);
  }
});

test("success checks both fresh ports; later report revision changes retain afterimage and permanently close replay", async () => {
  const fixture = administratorFixture(), healthy = recording(fixture);
  assert.equal(await healthy.adapter.withClosedIntakeBarrier(fixture.scope, async () => "done"), "done");
  assert.deepEqual(healthy.calls, ["owner", "admin", "owner", "admin"]);
  const fresh = recording(fixture);
  assert.equal(await fresh.adapter.withClosedIntakeBarrier(fixture.scope, async () => {
    fresh.now = 540;
    fresh.observation = {...fixture.evidence.payload.administratorObservation,
      administratorPrincipalIds: [...fixture.evidence.payload.administratorObservation.administratorPrincipalIds].reverse(),
      observedAtMillis: 540};
    return "fresh-read";
  }), "fresh-read");
  for (const patch of [{administratorActivity: "reported"}, {reportRevision: "admin-report-2"}]) {
    const runtime = recording(fixture), afterimage = [];
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope, async () => {
      afterimage.push("committed");
      runtime.observation = {...fixture.evidence.payload.administratorObservation, ...patch};
    }));
    assert.deepEqual(afterimage, ["committed"]);
    assert.equal(runtime.incident.schemaVersion, 3);
    runtime.observation = fixture.evidence.payload.administratorObservation;
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope, async () => afterimage.push("retry")));
    await assert.rejects(runtime.adapter.assertReadOnlyReplayAllowed(fixture.scope));
    assert.deepEqual(afterimage, ["committed"]);
  }
});


test("source-scoped capture composes with fresh owner and administrator agreement checks", async () => {
  const fixture = administratorFixture({}, {captureControl: true});
  const result = verify(fixture.evidence, fixture.command, 530);
  assert.equal(result.evidence.payload.writerControls.filter(item => item.state === "capture-only").length, 4);
  const accepted = recording(fixture);
  await accepted.adapter.withClosedIntakeBarrier(fixture.scope, async () => "accepted");
  assert.ok(accepted.calls.includes("owner"));assert.ok(accepted.calls.includes("admin"));
  const withdrawn = recording(fixture);let calls = 0;
  withdrawn.observation = {...fixture.evidence.payload.administratorObservation, agreementStatus: "withdrawn"};
  await assert.rejects(withdrawn.adapter.withClosedIntakeBarrier(fixture.scope, async () => {calls++;}));
  assert.equal(calls, 0);assert.ok(withdrawn.incident);
});
