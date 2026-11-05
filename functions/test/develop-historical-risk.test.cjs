"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {historicalFixture} = require("./develop-historical-risk-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence: verify,
  parseShiftPlanningMaintenanceBarrierEvidenceEnvelope: parse,
  verifyShiftPlanningIntakeBarrierEvidence: strict} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningAdministratorBarrierCheckpoint: checkpoint,
  createTrustedShiftPlanningAdministratorBarrierAdapter: adapter,
  createShiftPlanningIntakeBarrierFailureClosureRecord: failure} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const risk = f => f.evidence.payload.causalDrain.historicalRisk;
const seal = f => { f.evidence.digest = digest(f.evidence.payload); };

test("ADR-0026 preserves historical unknowns and retains exact evidence without weakening strict admission", () => {
  const f = historicalFixture(), result = verify(f.evidence, f.command, 520);
  assert.equal(result.expiresAtMillis, 580);
  const d = result.evidence.payload.causalDrain;
  assert.equal(d.historicalRisk.legacyUntracked, true);assert.equal(d.historicalRisk.replayAllowed, false);
  assert.equal(d.drainedAtMillis, null);assert.equal(d.finalInFlightWorkCount, null);
  assert.equal(result.evidence.payload.writerControls.find(c => c.developCapture).pendingWorkCount, null);
  assert.deepEqual(parse(result.evidence), result.evidence);
  assert.throws(() => strict(f.evidence, f.command, 520));
});
for (const [name, change] of [
  ["missing authorized acceptance", f => {delete f.command.expectedHistoricalRiskDigest;}],
  ["changed acceptance", f => {risk(f).confirmationId = "other";}],
  ["existing planner lineage", f => {f.evidence.payload.transition.expectedWriteEpoch = f.command.expectedWriteEpoch = 1;}],
  ["production", f => {f.command.environment = f.evidence.payload.environment = "production";}],
  ["wrong project", f => {risk(f).projectId = "other";}],
  ["wrong database", f => {risk(f).databaseId = "other";}],
  ["classic namespace", f => {risk(f).namespace = "develop/collections";}],
  ["another workbook", f => {risk(f).workbookFileId = "other";}],
  ["new source version", f => {f.evidence.payload.causalDrain.containedDelivery.final.sourceSetDigest = digest("new");}],
  ["unclassified event", f => {f.evidence.payload.causalDrain.containedDelivery.final.capturedEventSetDigest = digest("new");}],
  ["unknown writer", f => {risk(f).predecessors[0].writerId = "external-new-writer";}],
  ["missing predecessor", f => {risk(f).predecessors.pop();}],
  ["duplicate predecessor", f => {risk(f).predecessors.push({...risk(f).predecessors[0]});}],
  ["changed predecessor closure", f => {risk(f).predecessors[0].closedAtMillis++;}],
  ["acceptance before observed closure", f => {risk(f).acceptedAtMillis = 100;}],
  ["future acceptance", f => {risk(f).acceptedAtMillis = 900;}],
  ["missing agreement", f => {delete f.evidence.payload.administratorAgreement;}],
  ["unconfirmed operator", f => {risk(f).operatorPrincipalId = "user:unconfirmed@example.test";}],
  ["changed controls", f => {risk(f).technicalControlManifestDigest = digest("other");}],
  ["changed current source", f => {risk(f).currentSourceDigest = digest("other");}],
  ["invented historical drain", f => {f.evidence.payload.causalDrain.drainedAtMillis = 300;}],
  ["erased legacy unknown", f => {risk(f).legacyUntracked = false;}],
  ["replay", f => {risk(f).replayAllowed = true;}],
  ["observed continuing work", f => {risk(f).continuingWorkObserved = true;}],
  ["positive old count", f => {f.evidence.payload.writerControls.find(c => c.developCapture).inFlightWorkCount = 1;}],
  ["positive causal count", f => {f.evidence.payload.causalDrain.finalPendingWorkCount = 1;}],
  ["unknown unreviewed writer", f => {f.evidence.payload.writerControls.find(c => !c.developCapture).pendingWorkCount = null;}],
  ["late Firestore mutation", f => {f.evidence.payload.quietHorizon.firestoreMutationCount = 1;}],
  ["late Sheets mutation", f => {f.evidence.payload.quietHorizon.workbookMutationCount = 1;}],
  ["changed migration plan", f => {risk(f).migrationPlanDigest = digest("other");}],
  ["changed inverse plan", f => {risk(f).inversePlanDigest = digest("other");}],
]) test(`historical risk rejects ${name}`, () => {
  const f = historicalFixture();change(f);
  if (!["missing authorized acceptance", "changed acceptance", "changed migration plan", "changed inverse plan"].includes(name)) {
    f.command.expectedHistoricalRiskDigest = digest(risk(f));
  }
  seal(f);
  assert.throws(() => verify(f.evidence, f.command, 520));
});
test("risk acceptance expires independently of control freshness", () => {
  const f = historicalFixture();assert.throws(() => verify(f.evidence, f.command, 580));
  assert.throws(() => verify(f.evidence, f.command, 700));
});
function held(f) {
  let current = checkpoint({scope: f.scope, holdRevision: "risk-hold", evidence: f.evidence}), incident = null;
  const a = adapter({readClockMillis: () => 520,
    controlPlane: {closeAndCollect: async () => current, readBackClosed: async () => current,
      readBackOwnerObservation: async () => f.evidence.payload.ownerObservation,
      readBackAdministratorObservation: async () => f.evidence.payload.administratorObservation},
    failurePersistence: {readExistingFailure: async () => incident,
      retainFailureAndReadBack: async r => {incident = failure(r, 520);return incident;}}});
  return {adapter: a, get incident() {return incident;}, mutate: () => {
    const changed = structuredClone(f);risk(changed).confirmationId = "replacement";seal(changed);
    current = checkpoint({scope: f.scope, holdRevision: "changed", evidence: changed.evidence});
  }};
}
test("held adapter refuses late checkpoint drift without fabricating an incident receipt", async () => {
  const f = historicalFixture(), h = held(f);let calls = 0;
  await assert.rejects(h.adapter.withClosedIntakeBarrier(f.scope, async evidence => {
    calls++;assert.equal(evidence.payload.causalDrain.historicalRisk.legacyUntracked, true);h.mutate();
  }), /could not be durably proven/);
  assert.equal(calls, 1);assert.equal(h.incident, null);
  await assert.rejects(h.adapter.withClosedIntakeBarrier(f.scope, async () => {calls++;}));
  assert.equal(calls, 1);
});
test("held adapter requires fresh human observations and does not reopen after reported activity", async () => {
  const f = historicalFixture(), h = held(f);let calls = 0;
  f.evidence.payload.administratorObservation.administratorActivity = "reported";
  await assert.rejects(h.adapter.withClosedIntakeBarrier(f.scope, async () => {calls++;}));
  assert.equal(calls, 0);assert.ok(h.incident);
});

test("operation failure retains its incident when the original closed checkpoint is provable", async () => {
  const f = historicalFixture(), h = held(f);
  await assert.rejects(h.adapter.withClosedIntakeBarrier(f.scope, async () => {throw new Error("late cell change");}), /late cell change/);
  assert.ok(h.incident);
  await assert.rejects(h.adapter.withClosedIntakeBarrier(f.scope, async () => {assert.fail("must not resume");}));
});
