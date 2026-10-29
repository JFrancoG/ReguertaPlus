"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {verifyShiftPlanningIntakeBarrierEvidence: verify,
  verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence: verifyAdmin,
  parseShiftPlanningMaintenanceBarrierEvidenceEnvelope: parse} = require("../lib/shift-planning-intake-barrier.js");
const {applyCapture, applyContained, bindScope} = require("./develop-capture-control-fixture.cjs");
const fixture = require("./shift-planning-barrier-fixture.cjs");
const {administratorFixture} = require("./shift-planning-administrator-maintenance-fixture.cjs");
const {DEVELOP_CAPTURE_ROUTES} = require("../lib/shift-planning-develop-capture-control.js");
const {prepareDevelopContainedDeliveryEvidence: prepare} = require("../scripts/observe-develop-capture-controls.cjs");
const {inspectCensus} = require("../scripts/inspect-develop-legacy-census.cjs");
const census = require("./develop-legacy-census-fixture.cjs");
const envelope = payload => ({payload, digest: digest(payload)});
const command = scope => {const c = {...scope};delete c.writerInventoryRevision;delete c.writerInventoryDigest;return c;};
const setup = () => {const payload = applyContained(applyCapture(fixture.evidence().payload));
  return {payload, command: command(bindScope(fixture.scope(), payload))};};
const proof = p => p.causalDrain.containedDelivery;
const control = p => p.writerControls.find(c => c.developCapture);

test("explicit contained delivery preserves unknown/nonzero counts and both capture revisions", () => {
  const f = setup(), result = verify(envelope(f.payload), f.command, 520);
  assert.equal(result.evidence.payload.causalDrain.initialPendingDeliveryCount, null);
  assert.equal(result.evidence.payload.causalDrain.finalPendingDeliveryCount, 1);
  assert.deepEqual([proof(result.evidence.payload).initial.captureRevision, proof(result.evidence.payload).final.captureRevision], [1, 2]);
  assert.deepEqual(parse(result.evidence), result.evidence);
  verify(fixture.evidence(), command(fixture.scope()), 520);
});
test("cooperative develop mode binds contained controls into both human agreements", () => {
  const f = administratorFixture({}, {captureControl: true, containedDelivery: true});
  const result = verifyAdmin(f.evidence, f.command, 520);
  assert.equal(result.evidence.payload.causalDrain.initialPendingDeliveryCount, null);
});
for (const [name, change] of [
  ["non-opted-in command", (p, c) => {c.expectedControlManifestDigest = bindScope(fixture.scope(), applyCapture(fixture.evidence().payload)).expectedControlManifestDigest;}],
  ["partial policy", p => {delete control(p).deliveryPolicy;}],
  ["unknown policy version", p => {control(p).deliveryPolicy = "future";}],
  ["policy on unrelated writer", p => {p.writerControls[0].deliveryPolicy = control(p).deliveryPolicy;}],
  ["missing proof", p => {delete p.causalDrain.containedDelivery;}],
  ["wrong proof version", p => {proof(p).schemaVersion = 2;}],
  ["production", p => {p.environment = "production";}],
  ["old business invocation", p => {control(p).inFlightWorkCount = 1;}],
  ["unknown old work", p => {control(p).pendingWorkCount = null;}],
  ["other writer work", p => {p.writerControls[0].pendingWorkCount = 1;}],
  ["pending causal business work", p => {p.causalDrain.finalPendingWorkCount = 1;}],
  ["unknown causal business invocation", p => {p.causalDrain.initialInFlightWorkCount = null;}],
  ["new source version", p => {proof(p).final.sourceSetDigest = digest("changed");}],
  ["unclassified captured core", p => {proof(p).final.capturedEventSetDigest = digest("unclassified");}],
  ["rewritten classification", p => {proof(p).final.classifiedEventSetDigest = proof(p).final.capturedEventSetDigest = digest("reclassified");}],
  ["capture revision regression", p => {proof(p).final.captureRevision = 0;}],
  ["rewritten history at same revision", p => {proof(p).final.captureRevision = 1;}],
  ["missing route", p => {proof(p).final.deliveries.pop();}],
  ["duplicate route", p => {proof(p).final.deliveries[1] = {...proof(p).final.deliveries[0]};}],
  ["invented zero aggregate", p => {p.causalDrain.initialPendingDeliveryCount = 0;}],
  ["wrong sum", p => {p.causalDrain.finalPendingDeliveryCount = 2;}],
  ["negative route count", p => {proof(p).initial.deliveries[0].pendingCount = -1;}],
  ["fractional route count", p => {proof(p).initial.deliveries[0].pendingCount = 0.5;}],
  ["overflowing aggregate", p => {for (const d of proof(p).final.deliveries) d.pendingCount = Number.MAX_SAFE_INTEGER;}],
  ["unbound sample time", p => {proof(p).final.observedAtMillis++;}],
  ["business delivery mutations", p => {p.quietHorizon.deliveryMutationCount = 1;}],
  ["business mutation", p => {p.quietHorizon.firestoreMutationCount = 1;}],
  ["workbook mutation", p => {p.quietHorizon.workbookMutationCount = 1;}],
  ["unreviewed source", p => {control(p).developCapture.shared.sourceDigest = digest("unknown");}],
]) test(`rejects ${name} with a recomputed evidence digest`, () => {
  const f = setup();change(f.payload, f.command);assert.throws(() => verify(envelope(f.payload), f.command, 520));
});

const offlineSetup = () => {
  const initial = census.fixture(), final = structuredClone(initial);
  census.addMetadataObservation(final);
  final.readTime = "2026-10-28T10:06:00.987654321Z";
  const classifiedCaptures = inspectCensus(initial).captures.map(({eventKey, coreDigest}) => ({eventKey, coreDigest}));
  const deliveries = DEVELOP_CAPTURE_ROUTES.flatMap(r => r.slice(1, 3)).map(name => ({
    functionName: `projects/reguerta-9f27f/locations/europe-west1/functions/${name}`, pendingCount: null, inFlightCount: null}));
  return {initial, final, classifiedCaptures, initialDeliveries: deliveries, finalDeliveries: deliveries};
};
test("validated census projection separates a late duplicate from unchanged source versions and reviewed event cores", () => {
  const input = offlineSetup(), before = structuredClone(input), result = prepare(input);
  assert.equal(result.evidence.initial.captureRevision, 1);assert.equal(result.evidence.final.captureRevision, 2);
  assert.equal(result.evidence.initial.sourceSetDigest, result.evidence.final.sourceSetDigest);
  assert.notEqual(result.evidence.initial.deliveryHistoryDigest, result.evidence.final.deliveryHistoryDigest);
  assert.equal(result.legacyUntracked, true);assert.equal(result.canEnterMaintenance, false);assert.equal(result.canApply, false);
  assert.deepEqual(input, before);
});
test("late unseen event blocks instead of expanding the classification automatically", () => {
  const input = offlineSetup(), extra = census.fixture("new-source");
  input.final.collections.shifts.push(...extra.collections.shifts);
  input.final.events.push(...extra.events);input.final.deliveries.push(...extra.deliveries);
  Object.assign(input.final.chunks, extra.chunks);
  for (const state of [input.final.intakeBefore, input.final.intakeAfter]) {
    state.fields.captureRevision = census.raw(3);state.fields.deliveryCount = census.raw(3);state.fields.eventCount = census.raw(2);
  }
  assert.throws(() => prepare(input));
});
test("empty or duplicated classification cannot certify a captured event", () => {
  const input = offlineSetup();assert.throws(() => prepare({...input, classifiedCaptures: []}));
  assert.throws(() => prepare({...input, classifiedCaptures: [...input.classifiedCaptures, ...input.classifiedCaptures]}));
});
test("capture history cannot lose an already observed metadata row", () => {
  const input = offlineSetup();
  census.addMetadataObservation(input.initial, {location: "old-extension"});
  assert.throws(() => prepare(input));
});

test("unknown in-flight capture count is retained, and known nonzero counts are summed without inventing drain", () => {
  const f = setup(), final = proof(f.payload).final;
  final.deliveries[0].inFlightCount = null;f.payload.causalDrain.finalInFlightDeliveryCount = null;
  assert.equal(verify(envelope(f.payload), f.command, 520).evidence.payload.causalDrain.finalInFlightDeliveryCount, null);
  final.deliveries[0].inFlightCount = 3;final.deliveries[1].inFlightCount = 2;
  f.payload.causalDrain.finalInFlightDeliveryCount = 5;
  assert.equal(verify(envelope(f.payload), f.command, 520).evidence.payload.causalDrain.finalInFlightDeliveryCount, 5);
});
for (const field of ["ownerObservation", "administratorObservation"]) test(`contained delivery does not admit unresolved ${field} writes`, () => {
  const f = administratorFixture({}, {captureControl: true, containedDelivery: true});
  f.evidence.payload[field].unresolvedWriteCount = 1;
  f.evidence.digest = digest(f.evidence.payload);
  assert.throws(() => verifyAdmin(f.evidence, f.command, 520));
});
