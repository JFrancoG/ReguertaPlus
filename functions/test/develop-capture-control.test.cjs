"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {verifyShiftPlanningIntakeBarrierEvidence: verify} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningTrustedIntakeBarrierCheckpoint: checkpoint,
  createTrustedShiftPlanningIntakeBarrierAdapter: adapter,
  createShiftPlanningIntakeBarrierFailureClosureRecord: failureRecord} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const fixture = require("./shift-planning-barrier-fixture.cjs");
const {applyCapture, bindScope} = require("./develop-capture-control-fixture.cjs");
const setup = () => { const payload = applyCapture(fixture.evidence().payload);return {payload, scope: bindScope(fixture.scope(), payload)}; };
const envelope = payload => ({payload, digest: digest(payload)});
const command = scope => { const value = {...scope};delete value.writerInventoryRevision;delete value.writerInventoryDigest;return value; };
const first = payload => payload.writerControls.find(control => control.developCapture);
test("admits exact develop capture while preserving active production transport and unchanged strict proofs", () => {
  const {payload, scope} = setup(); const result = verify(envelope(payload), command(scope), 520);
  assert.equal(result.evidence.payload.writerControls.filter(x => x.state === "capture-only").length, 4);
  assert.equal(first(result.evidence.payload).developCapture.shared.transportState, "ACTIVE");
  verify(fixture.evidence(), command(fixture.scope()), 520);
});
for (const [name, change] of [
  ["production environment", p => {p.environment = "production";}],
  ["missing proof", p => {delete first(p).developCapture;}],
  ["partial four-route set", p => {const c = first(p);c.state = "disabled";delete c.developCapture;}],
  ["altered source", p => {first(p).developCapture.shared.sourceDigest = digest("other");}],
  ["altered configuration", p => {first(p).developCapture.collector.configurationDigest = digest("other");}],
  ["broadened collector", p => {first(p).developCapture.collector.documentPattern = "{env}/plus-collections/shifts/{shiftId}";}],
  ["unknown pending work", p => {first(p).pendingWorkCount = null;}],
  ["pending prior work", p => {first(p).pendingWorkCount = 1;}],
  ["in-flight prior callback", p => {first(p).inFlightWorkCount = 1;}],
  ["unknown causal queue", p => {p.causalDrain.finalPendingDeliveryCount = null;}],
  ["undrained causal queue", p => {p.causalDrain.finalPendingDeliveryCount = 1;}],
  ["final source readback drift", p => {first(p).finalReadBackDigest = digest("drift");}],
  ["missing collector retry", p => {first(p).developCapture.collector.retryPolicy = "RETRY_POLICY_DO_NOT_RETRY";}],
  ["proof attached to unrelated writer", p => {const original = first(p), other = p.writerControls[0];Object.assign(other, original, {writerId: other.writerId});}],
]) test(`rejects ${name} even with an updated envelope digest`, () => {
  const {payload, scope} = setup();change(payload);
  assert.throws(() => verify(envelope(payload), command(scope), 520));
});
test("source capture does not bypass control-manifest approval or evidence freshness", () => {
  const {payload, scope} = setup();
  assert.throws(() => verify(envelope(payload), command(fixture.scope()), 520));
  assert.throws(() => verify(envelope(payload), command(scope), 999));
});
test("trusted adapter checks capture control before callback and journals lost final acknowledgement", async () => {
  const {payload, scope} = setup();
  const held = checkpoint({scope, holdRevision: "capture-hold", evidence: envelope(payload)});
  let reads = 0, calls = 0, incident;
  const instance = adapter({controlPlane: {async closeAndCollect() {return held;}, async readBackClosed() {
    if (++reads === 2) throw Error("lost final acknowledgement");return held;
  }}, failurePersistence: {async readExistingFailure() {return null;}, async retainFailureAndReadBack(value) {
    incident = failureRecord(value, 520);return incident;
  }}});
  await assert.rejects(instance.withClosedIntakeBarrier(scope, async proof => {
    verify(proof, command(scope), 520);calls++;return "committed";
  }), /lost final acknowledgement/);
  assert.equal(calls, 1);assert.equal(incident.phase, "finalReadBack");
});
