const {test} = require("node:test");
const assert = require("node:assert/strict");
const {ownerFixture} = require("./shift-planning-owner-maintenance-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningOwnerMaintenanceAgreement} = require("../lib/shift-planning-owner-maintenance.js");
const {parseShiftPlanningIntakeBarrierEvidenceEnvelope,
  verifyShiftPlanningIntakeBarrierEvidence,
  verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence,
  createShiftPlanningControlManifestDigest} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningTrustedIntakeBarrierCheckpoint,
  createShiftPlanningOwnerAgreementIntakeBarrierCheckpoint,
  createTrustedShiftPlanningOwnerAgreementIntakeBarrierAdapter,
  createShiftPlanningIntakeBarrierFailureClosureRecord} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const inventory = require("../lib/shift-planning-writer-inventory.js");
function rehash(fixture) {
  fixture.evidence.digest = digest(fixture.evidence.payload);
  return fixture;
}
function renewAgreement(fixture, transform) {
  const intent = structuredClone(fixture.agreement.payload.intent);
  transform(intent);
  const agreement = createShiftPlanningOwnerMaintenanceAgreement(intent,
    intent.participants.map((participant) => ({...participant, intentDigest: digest(intent),
      confirmationId: `renew-${participant.role}`, confirmedAtMillis: 100,
      onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true})));
  fixture.agreement = fixture.evidence.payload.ownerAgreement = agreement;
  fixture.command.expectedOwnerAgreementDigest = fixture.scope.expectedOwnerAgreementDigest = agreement.digest;
  const owner = fixture.evidence.payload.writerControls.find((item) =>
    item.writerId === inventory.SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID);
  owner.controlDigest = owner.initialReadBackDigest = owner.finalReadBackDigest = agreement.digest;
  fixture.command.expectedControlManifestDigest = fixture.scope.expectedControlManifestDigest =
    createShiftPlanningControlManifestDigest(fixture.evidence.payload.writerControls, "owner-agreement");
  return rehash(fixture);
}
function recording(fixture) {
  const checkpoint = createShiftPlanningOwnerAgreementIntakeBarrierCheckpoint({
    scope: fixture.scope, holdRevision: "owner-hold-1", evidence: fixture.evidence,
  });
  let now = fixture.nowMillis;
  let observation = structuredClone(fixture.evidence.payload.ownerObservation);
  let incident = null;
  const calls = [];
  const adapter = createTrustedShiftPlanningOwnerAgreementIntakeBarrierAdapter({
    readClockMillis: () => now,
    controlPlane: {
      closeAndCollect: async () => { calls.push("close"); return checkpoint; },
      readBackClosed: async () => { calls.push("technical"); return checkpoint; },
      readBackOwnerObservation: async () => { calls.push("owner"); return observation; },
    },
    failurePersistence: {
      readExistingFailure: async () => incident,
      retainFailureAndReadBack: async (request) => {
        calls.push("incident");
        incident = createShiftPlanningIntakeBarrierFailureClosureRecord(request, now);
        return incident;
      },
    },
  });
  return {adapter, calls, get incident() { return incident; },
    set now(value) { now = value; }, set observation(value) { observation = value; }};
}

test("strict inventory and default parser remain strict; only explicit v2 records retained owner capability", () => {
  const strict = inventory.SHIFT_PLANNING_AFFECTED_WRITERS;
  const cooperative = inventory.SHIFT_PLANNING_OWNER_AGREEMENT_WRITERS;
  assert.equal(strict.length, 29); assert.equal(cooperative.length, 30);
  assert.equal(inventory.SHIFT_PLANNING_INTAKE_BARRIER_WRITERS.length, 23);
  assert.equal(inventory.SHIFT_PLANNING_OWNER_AGREEMENT_INTAKE_WRITERS.length, 24);
  for (const writer of strict) {
    const next = cooperative.find((item) => item.writerId === writer.writerId);
    if (writer.writerId !== "workbook-human-and-offline-editors") assert.deepEqual(next, writer);
    else { assert.equal(next.requiredState, "fenced"); assert.equal(next.control, writer.control); }
  }
  assert.equal(cooperative.find((item) => item.writerId ===
    inventory.SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID).requiredState, "agreement-recorded");
  const fixture = ownerFixture();
  assert.throws(() => parseShiftPlanningIntakeBarrierEvidenceEnvelope(fixture.evidence));
  assert.throws(() => verifyShiftPlanningIntakeBarrierEvidence(fixture.evidence, fixture.command, 530));
  assert.throws(() => createShiftPlanningTrustedIntakeBarrierCheckpoint({
    scope: fixture.scope, holdRevision: "wrong-strict", evidence: fixture.evidence,
  }));
  assert.equal(verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
    fixture.evidence, fixture.command, 530).expiresAtMillis, 600);
});

test("owner cooperation cannot bypass missing, enabled or undrained reminder schedulers", () => {
  const complete = ownerFixture();
  assert.doesNotThrow(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
    complete.evidence, complete.command, 530));
  for (const writerId of ["scheduler-order-reminder-sunday20", "scheduler-order-reminder-sunday22",
    "scheduler-order-reminder-sunday23"]) {
    for (const mutate of [
      (payload) => { payload.writerControls = payload.writerControls.filter((entry) => entry.writerId !== writerId); },
      (payload) => { payload.writerControls.find((entry) => entry.writerId === writerId).state = "enabled"; },
      (payload) => { payload.writerControls.find((entry) => entry.writerId === writerId).pendingWorkCount = 1; },
      (payload) => { payload.writerControls.find((entry) => entry.writerId === writerId).inFlightWorkCount = 1; },
    ]) {
      const fixture = ownerFixture();
      mutate(fixture.evidence.payload);
      rehash(fixture);
      assert.throws(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
        fixture.evidence, fixture.command, 530));
    }
  }
});

test("a rehashed document cannot widen scope, operations, lineage or participant commitments", () => {
  for (const transform of [
    (intent) => { intent.affectedScopeDigest = digest({different: "scope"}); },
    (intent) => { intent.operations[0].manifestDigest = digest({different: "controls"}); },
    (intent) => { intent.expectedWriteEpoch += 1; },
    (intent) => { intent.expectedActiveRevision = "other-active"; },
  ]) {
    const fixture = renewAgreement(ownerFixture(), transform);
    assert.throws(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
      fixture.evidence, fixture.command, 530));
  }
  const fixture = ownerFixture();
  fixture.evidence.payload.ownerAgreement.payload.intent.participantsRevision = "changed-without-confirmation";
  fixture.evidence.payload.ownerAgreement.digest = digest(fixture.evidence.payload.ownerAgreement.payload);
  rehash(fixture);
  assert.throws(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
    fixture.evidence, fixture.command, 530));
});

test("operator identity cannot alias owner or controller; owner-controller exception binds exact closed action", () => {
  for (const role of ["owner", "permission-controller"]) {
    assert.throws(() => renewAgreement(ownerFixture(), (intent) => {
      if (role === "owner") intent.participants.find((item) => item.role === "operator").principalId = "owner-human";
      else intent.participants.push({role, principalId: "operator-invoker"});
    }));
  }
  const fixture = renewAgreement(ownerFixture(), (intent) => {
    intent.participants.push({principalId: "owner-human", role: "permission-controller"});
    intent.permissionControl = {principalId: "owner-human", actionId: "sealed-acl-action",
      actionKind: "acl-protection-only", sealedActionDigest: digest({action: 1}),
      postAuthorityDigest: intent.effectiveAuthorityDigest, credentialClosureDigest: digest({closed: 1})};
  });
  const observation = fixture.evidence.payload.ownerObservation;
  observation.participantsDigest = digest({revision: fixture.agreement.payload.intent.participantsRevision,
    participants: fixture.agreement.payload.intent.participants});
  observation.permissionControlEvidenceDigest = digest(fixture.agreement.payload.intent.permissionControl);
  rehash(fixture);
  assert.doesNotThrow(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
    fixture.evidence, fixture.command, 530));
  observation.permissionControlEvidenceDigest = digest({anotherAction: 1});
  rehash(fixture);
  assert.throws(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
    fixture.evidence, fixture.command, 530));
});

test("owner confirmation lasts its agreed window while technical observations must stay fresh", () => {
  const fixture = ownerFixture();
  // Confirmation at 100 remains valid at 530; it is not a per-batch human TTL.
  assert.doesNotThrow(() => verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
    fixture.evidence, fixture.command, 530));
  for (const time of [89, 600, 901]) assert.throws(() =>
    verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(fixture.evidence, fixture.command, time));
});

test("initial reported activity, withdrawal, uncertainty and owner/authority drift stop before callback", async () => {
  for (const patch of [{ownerActivity: "reported"}, {agreementStatus: "withdrawn"},
    {unresolvedWriteCount: 1}, {ownerPrincipalId: "different-owner"},
    {effectiveAuthorityDigest: digest({authority: 2})}]) {
    const fixture = ownerFixture(); const runtime = recording(fixture);
    runtime.observation = {...fixture.evidence.payload.ownerObservation, ...patch};
    let effects = 0;
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope, async () => { effects += 1; }));
    assert.equal(effects, 0);
    assert.equal(runtime.incident.schemaVersion, 2);
    assert.equal(runtime.incident.ownerIncident.agreementDigest, fixture.agreement.digest);
    assert.ok(runtime.incident.ownerIncident.observationDigest);
  }
});

test("expiry or reported activity after an actual guarded callback leaves its afterimage and a typed incident", async () => {
  for (const reason of ["agreement_expired", "owner_reported_activity"]) {
    const fixture = ownerFixture(); const runtime = recording(fixture);
    const stored = [];
    await assert.rejects(runtime.adapter.withClosedIntakeBarrier(fixture.scope, async () => {
      stored.push("committed-local-port-effect");
      if (reason === "agreement_expired") runtime.now = 600;
      else runtime.observation = {...fixture.evidence.payload.ownerObservation, ownerActivity: "reported"};
    }));
    assert.deepEqual(stored, ["committed-local-port-effect"]);
    assert.equal(runtime.incident.ownerIncident.reason, reason);
    assert.deepEqual(runtime.calls, ["close", "technical", "owner", "technical", "owner", "technical", "incident"]);
    await assert.rejects(runtime.adapter.assertReadOnlyReplayAllowed(fixture.scope));
    assert.deepEqual(stored, ["committed-local-port-effect"]);
  }
});
