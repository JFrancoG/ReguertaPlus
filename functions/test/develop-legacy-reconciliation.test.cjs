"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {inspectCensus} = require("../scripts/inspect-develop-legacy-census.cjs");
const {reconcileCensus} = require("../scripts/reconcile-develop-legacy-census.cjs");
const {PROJECT, BASE, SOURCE, CREATED, UPDATED, LATER, at, hash, raw, doc, tagged, fixture} =
  require("./develop-legacy-census-fixture.cjs");
const routes = {
  shiftPlanningRequests: ["onShiftPlanningRequestCreated", "requestId", "created"],
  shifts: ["onShiftWritten", "shiftId", "written"],
  deliveryCalendar: ["onDeliveryCalendarOverrideWritten", "weekKey", "written"],
  notificationEvents: ["onNotificationEventCreated", "eventId", "created"],
};
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const digest = (value) => hash(JSON.stringify(canonical(value)));
const source = (value) => { const text = JSON.stringify(value); return {text, sha256: hash(text)}; };
const errorCode = (code) => (error) => error.code === code;

function canaryGroup(id = "probe-a", phase = "capture-first-redelivery-inspection") {
  const census = fixture(id);
  census.events = []; census.deliveries = []; census.chunks = {};
  census.collections = Object.fromEntries(Object.keys(routes).map((key) => [key, []]));
  const receipt = {schemaVersion: 1, projectId: PROJECT, phase, startedAt: UPDATED, completedAt: LATER,
    canApply: false, status: "accepted", entries: [], captures: [], finalState: {legacyUntracked: true,
      captureRevision: phase === "legacy-develop-containment" ? 12 : 6,
      eventCount: phase === "legacy-develop-containment" ? 12 : 6,
      deliveryCount: phase === "legacy-develop-containment" ? 12 : 6}};
  for (const [collection, [entryPoint, parameter, eventType]] of Object.entries(routes)) {
    const target = `develop/plus-collections/${collection}/${id}`;
    const payload = {probe: id, privateNote: "Never leak this private payload", status: "proposed"};
    receipt.entries.push({path: target, name: BASE + target, payload, payloadDigest: digest(payload),
      submission: "acknowledged", created: {createTime: CREATED, updateTime: UPDATED}, cleanup:
        phase === "legacy-develop-containment" ? "deleted-with-precondition" : "failure-cleanup-with-readback-precondition"});
    for (const deleted of eventType === "written" ? [false, true] : [false]) {
      const original = fixture(id), oldEvent = original.events[0];
      const envelope = JSON.parse(Buffer.from(original.chunks[oldEvent.name][0].fields.bytes.bytesValue, "base64"));
      const missing = {path: target, exists: false, createTime: null, updateTime: null, readTime: null, fields: null};
      const present = {path: target, exists: true, createTime: at(CREATED), updateTime: at(UPDATED), readTime: null,
        fields: tagged(payload)};
      const before = deleted ? present : (eventType === "created" ? null : missing), after = deleted ? missing : present;
      const core = {schemaVersion: 1, entryPoint, source: SOURCE, type: `google.cloud.firestore.document.v1.${eventType}`,
        path: target, before, after};
      const metadataId = `${collection}-${id}-${deleted}`;
      const metadata = tagged({id: metadataId, params: {env: "develop", [parameter]: id}, source: SOURCE,
        specversion: "1.0", subject: `documents/${target}`, time: deleted ? LATER : UPDATED, type: core.type});
      Object.assign(envelope, {core, before, after, metadata});
      const bytes = Buffer.from(JSON.stringify(envelope)), coreDigest = hash(JSON.stringify(core));
      const eventKey = hash(JSON.stringify({entryPoint, source: SOURCE, type: core.type, path: target,
        before: before && [before.exists, before.updateTime], after: [after.exists, after.updateTime]}));
      const deliveryKey = hash(JSON.stringify({entryPoint, source: SOURCE, id: metadataId}));
      const event = doc(`shiftPlanningDevelopIntake/current/events/${eventKey}`, {schemaVersion: 1, coreDigest,
        path: target, entryPoint, state: "retained", envelopeDigest: hash(bytes), chunkCount: 1, replayable: false}, LATER);
      census.events.push(event);
      census.chunks[event.name] = [doc(`shiftPlanningDevelopIntake/current/events/${eventKey}/chunks/0`, {bytes}, LATER)];
      census.deliveries.push(doc(`shiftPlanningDevelopIntake/current/deliveries/${deliveryKey}`, {schemaVersion: 1,
        eventKey, digest: hash(JSON.stringify({coreDigest, metadataWire: metadata})), metadata: JSON.stringify(metadata),
        beforeReadTime: null, afterReadTime: null}, LATER));
      receipt.captures.push({path: target, eventId: eventKey, coreDigest, deleted, metadataId, sourceVersion: UPDATED});
    }
  }
  for (const root of [census.intakeBefore, census.intakeAfter]) {
    root.fields.captureRevision = raw(6); root.fields.eventCount = raw(6); root.fields.deliveryCount = raw(6);
  }
  return {census, receipt};
}
function inputFor(census, receipts = [], sourceEvidence) {
  return {census: source(census), expectedStableSetDigest: inspectCensus(census).stableSetDigest,
    canaryReceipts: receipts.map(source), ...(sourceEvidence ? {sourceEvidence: source(sourceEvidence)} : {})};
}
function merge(left, right) {
  left.events.push(...right.events); left.deliveries.push(...right.deliveries); Object.assign(left.chunks, right.chunks);
  for (const root of [left.intakeBefore, left.intakeAfter]) {
    root.fields.captureRevision = raw(left.deliveries.length);
    root.fields.eventCount = raw(left.events.length); root.fields.deliveryCount = raw(left.deliveries.length);
  }
  return left;
}

test("twelve exact accepted canaries bind their source versions, payloads, provider IDs and cleanup without proving legacy terminality", () => {
  const first = canaryGroup(), second = canaryGroup("probe-b", "legacy-develop-containment");
  const census = merge(first.census, second.census);
  for (let index = 0; index < 62; index++) census.collections.shifts.push(doc(`develop/plus-collections/shifts/real-${index}`,
    {status: "planned", assignedUserIds: ["Private member"]}));
  for (let index = 0; index < 4; index++) census.collections.deliveryCalendar.push(doc(
    `develop/plus-collections/deliveryCalendar/real-${index}`, {assignedUserIds: ["Private member"]}));
  for (let index = 0; index < 117; index++) census.collections.notificationEvents.push(doc(
    `develop/plus-collections/notificationEvents/real-${index}`, {title: "Private announcement",
      ...(index < 114 ? {dispatch: {status: ["success", "no_tokens", "partial_success"][index % 3]}} : {})}));
  const input = inputFor(census, [first.receipt, second.receipt], {logEntries: [{message: "Private runtime log"}]}),
    unchanged = structuredClone(input), report = reconcileCensus(input);
  assert.equal(report.acceptedCanaryCaptureCount, 12); assert.equal(report.unresolvedCaptureCount, 0);
  assert.equal(report.captures.filter((row) => row.cleanupEvidence === "captured-deletion-and-current-absence").length, 4);
  assert.equal(report.historicalPossiblyDeliveredNotificationCount, 117);
  assert.equal(report.records.filter((row) => row.sheetsOutcome === "unknown").length, 66);
  assert.ok(report.records.filter((row) => row.classification === "legacy-notification-history")
    .every((row) => row.possiblyDelivered === true && row.replayAllowed === false));
  assert.ok(report.captures.every((row) => row.replayAllowed === false && row.externalOutcome === "unknown" &&
    row.legacyCallbackTerminality === "not-established"));
  for (const key of ["canApply", "canClaimClosure", "canEnterMaintenance", "physicalHandoffReady"]) assert.equal(report[key], false);
  assert.equal(report.legacyUntracked, true);
  assert.equal(report.sourceEvidenceDigest, input.sourceEvidence.sha256);
  assert.equal(report.sourceEvidenceInterpretation, "provenance-only-not-terminal-evidence");
  assert.equal(JSON.stringify(report).includes("Private"), false);
  assert.equal(JSON.stringify(report).includes("Never leak"), false);
  assert.deepEqual(input, unchanged);
});

test("a probe-looking capture with no exact accepted receipt stays unresolved and cannot exempt a current processing request", () => {
  const census = fixture("__hu084_intake_probe_looks-real");
  census.collections.shiftPlanningRequests.push(doc("develop/plus-collections/shiftPlanningRequests/__hu084_intake_probe_looks-real",
    {status: "processing", probe: "fixture"}));
  const report = reconcileCensus(inputFor(census));
  assert.equal(report.acceptedCanaryCaptureCount, 0); assert.equal(report.unresolvedCaptureCount, 1);
  assert.equal(report.records.find((row) => row.path.includes("shiftPlanningRequests")).classification, "request-processing-current");
});

for (const [name, mutate] of [
  ["different event key", (receipt) => { receipt.captures[0].eventId = "f".repeat(64); }],
  ["different core", (receipt) => { receipt.captures[0].coreDigest = "f".repeat(64); }],
  ["provider ID", (receipt) => { receipt.captures[0].metadataId = "another-delivery"; }],
  ["source nanosecond", (receipt) => { receipt.entries[0].created.updateTime = "2026-10-28T10:00:01.123456788Z"; }],
  ["source creation time", (receipt) => { receipt.entries[0].created.createTime = "2026-10-28T10:00:00.000000002Z"; }],
  ["payload with recomputed checksum", (receipt) => { receipt.entries[0].payload.status = "processing";
    receipt.entries[0].payloadDigest = digest(receipt.entries[0].payload); }],
  ["missing cleanup", (receipt) => { receipt.entries[0].cleanup = "pending"; }],
  ["unknown submission", (receipt) => { receipt.entries[0].submission = "unknown"; }],
  ["failed group", (receipt) => { receipt.status = "failed"; }],
  ["different project", (receipt) => { receipt.projectId = "production-project"; }],
  ["unreviewed phase", (receipt) => { receipt.phase = "toString"; }],
  ["future acceptance", (receipt) => { receipt.completedAt = "2027-01-01T00:00:00Z"; }],
]) test(`a receipt with ${name} never proves the mismatched canary, even when its supplied file hash is correct`, () => {
  const {census, receipt} = canaryGroup(); mutate(receipt);
  const report = reconcileCensus(inputFor(census, [receipt]));
  const row = report.captures.find((item) => item.eventKey === census.events[0].name.split("/").at(-1));
  assert.equal(row.classification, "unresolved-retained-capture");
  assert.equal(row.replayAllowed, false); assert.equal(report.canEnterMaintenance, false);
});

test("mixing entries or capture IDs from two accepted groups cannot launder them as one canary set", () => {
  const first = canaryGroup(), second = canaryGroup("probe-b", "legacy-develop-containment");
  const census = merge(first.census, second.census);
  first.receipt.entries[0] = second.receipt.entries[0];
  first.receipt.captures[0] = second.receipt.captures[0];
  const report = reconcileCensus(inputFor(census, [first.receipt]));
  assert.equal(report.acceptedCanaryCaptureCount, 0); assert.equal(report.unresolvedCaptureCount, 12);
  assert.equal(report.receipts[0].binding, "unresolved-receipt");
});

test("overlapping accepted receipts leave ambiguous captures unresolved instead of selecting the first", () => {
  const {census, receipt} = canaryGroup();
  const overlap = {...structuredClone(receipt), startedAt: CREATED};
  const report = reconcileCensus(inputFor(census, [receipt, overlap]));
  assert.equal(report.acceptedCanaryCaptureCount, 0); assert.equal(report.unresolvedCaptureCount, 6);
});

test("a receipt declaring twelve retained events cannot authenticate a census containing only six", () => {
  const {census, receipt} = canaryGroup("probe-b", "legacy-develop-containment");
  const report = reconcileCensus(inputFor(census, [receipt]));
  assert.equal(report.acceptedCanaryCaptureCount, 0);
  assert.equal(report.receipts[0].reason, "receipt_state_exceeds_census");
});

test("a still-present or later restored source prevents cleanup classification without rejecting real current history", () => {
  const {census, receipt} = canaryGroup();
  const entry = receipt.entries.find((item) => item.path.includes("shiftPlanningRequests"));
  census.collections.shiftPlanningRequests.push(doc(entry.path, entry.payload, LATER));
  const report = reconcileCensus(inputFor(census, [receipt]));
  assert.equal(report.captures.find((row) => row.path === entry.path).classification, "unresolved-retained-capture");
  assert.equal(report.records.find((row) => row.path === entry.path).classification, "request-unclassified-review");
});

test("census/source hash drift and a fresh set under a stale expected digest are rejected before output", () => {
  const {census, receipt} = canaryGroup(), input = inputFor(census, [receipt]);
  const hashDrift = structuredClone(input); hashDrift.census.text += "\n";
  assert.throws(() => reconcileCensus(hashDrift), errorCode("source_digest_mismatch"));
  const receiptDrift = structuredClone(input); receiptDrift.canaryReceipts[0].text += "\n";
  assert.throws(() => reconcileCensus(receiptDrift), errorCode("source_digest_mismatch"));
  census.collections.notificationEvents.push(doc("develop/plus-collections/notificationEvents/another-real-notice", {title: "private"}));
  assert.throws(() => reconcileCensus({...input, census: source(census)}), errorCode("causal_set_digest_mismatch"));
  assert.throws(() => reconcileCensus({...input, canaryReceipts: [input.canaryReceipts[0], input.canaryReceipts[0]]}),
    errorCode("duplicate_receipt_source"));
});

test("fresh provenance never turns a current failed/completed summary or an arbitrary log assertion into terminal evidence", () => {
  const census = fixture();
  for (const status of ["failed", "completed"]) census.collections.shiftPlanningRequests.push(doc(
    `develop/plus-collections/shiftPlanningRequests/${status}`, {status}));
  const report = reconcileCensus(inputFor(census, [], {allOldInvocationsDone: true, pending: 0, inFlight: 0}));
  assert.ok(report.records.filter((row) => row.path.includes("shiftPlanningRequests"))
    .every((row) => row.sheetsOutcome === "unknown" && row.notificationOutcome === "unknown"));
  assert.equal(report.physicalHandoffReady, false);
  assert.equal(report.legacyExecutionEvidence.realTerminality, "not-established");
});

test("the offline CLI writes one private immutable report, pins all inputs and emits no private payload", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "develop-reconciliation-"));
  const script = path.resolve(__dirname, "../scripts/reconcile-develop-legacy-census.cjs");
  try {
    const {census, receipt} = canaryGroup(), input = inputFor(census, [receipt]);
    fs.writeFileSync(path.join(folder, "census.json"), input.census.text);
    fs.writeFileSync(path.join(folder, "receipt.json"), input.canaryReceipts[0].text);
    const manifest = {schemaVersion: 1, projectId: PROJECT, census: {path: "census.json", sha256: input.census.sha256},
      expectedStableSetDigest: input.expectedStableSetDigest,
      canaryReceipts: [{path: "receipt.json", sha256: input.canaryReceipts[0].sha256}]};
    const manifestPath = path.join(folder, "input.json"), output = path.join(folder, "report.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const run = () => spawnSync(process.execPath, [script, "--input", manifestPath, "--output", output], {encoding: "utf8"});
    const first = run(); assert.equal(first.status, 0, first.stderr);
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    assert.equal(JSON.stringify({stdout: first.stdout, stderr: first.stderr}).includes("Never leak"), false);
    const original = fs.readFileSync(output), second = run(); assert.equal(second.status, 1);
    assert.deepEqual(fs.readFileSync(output), original);
    assert.equal(JSON.parse(first.stdout).canEnterMaintenance, false);
    manifest.projectId = "another-project"; fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.equal(run().status, 1); assert.deepEqual(fs.readFileSync(output), original);
  } finally { fs.rmSync(folder, {recursive: true, force: true}); }
});
