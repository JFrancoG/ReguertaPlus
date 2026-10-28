"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {createHash} = require("node:crypto");
const {inspectCensus} = require("../scripts/inspect-develop-legacy-census.cjs");
const PROJECT = "reguerta-9f27f";
const BASE = `projects/${PROJECT}/databases/(default)/documents/`;
const ROOT = `${BASE}shiftPlanningDevelopIntake/current`;
const SOURCE = `//firestore.googleapis.com/projects/${PROJECT}/databases/(default)`;
const CREATED = "2026-10-28T10:00:00.000000001Z";
const UPDATED = "2026-10-28T10:00:01.123456789Z";
const LATER = "2026-10-28T10:00:02.123456789Z";
const READ = "2026-10-28T10:05:00.123456789Z";
const at = (value) => [Date.parse(value.slice(0, 19) + "Z") / 1000, Number(value.slice(20, 29))];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const raw = (value) => value === null ? {nullValue: null} : Buffer.isBuffer(value) ?
  {bytesValue: value.toString("base64")} : typeof value === "string" ? {stringValue: value} :
    typeof value === "boolean" ? {booleanValue: value} : typeof value === "number" ?
      {integerValue: String(value)} : Array.isArray(value) ? {arrayValue: {values: value.map(raw)}} :
        {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, raw(item)]))}};
const fields = (value) => raw(value).mapValue.fields;
const doc = (relative, value, updateTime = UPDATED) => ({name: BASE + relative, fields: fields(value),
  createTime: CREATED, updateTime});
const tagged = (value) => value === null ? ["null"] : typeof value === "string" ? ["string", value] :
  typeof value === "boolean" ? ["boolean", value] : typeof value === "number" ? ["number", String(value)] :
    Array.isArray(value) ? ["array", value.map(tagged)] :
      ["map", Object.keys(value).sort().map((key) => [key, tagged(value[key])])];
const code = (expected) => (error) => error.code === expected && error.message === expected;

function fixture(id = "current-shift") {
  const target = `develop/plus-collections/shifts/${id}`;
  const providerId = id === "current-shift" ? "provider-delivery-a" : `provider-${id}`;
  const payload = {status: "planned", type: "delivery", privateNote: "Never include this private content"};
  const before = {path: target, exists: false, createTime: null, updateTime: null, readTime: null, fields: null};
  const after = {path: target, exists: true, createTime: at(CREATED), updateTime: at(UPDATED),
    readTime: null, fields: tagged(payload)};
  const core = {schemaVersion: 1, entryPoint: "onShiftWritten", source: SOURCE,
    type: "google.cloud.firestore.document.v1.written", path: target, before, after};
  const metadata = tagged({id: providerId, params: {env: "develop", shiftId: id},
    source: SOURCE, specversion: "1.0", subject: `documents/${target}`, time: UPDATED, type: core.type});
  const envelope = JSON.stringify({core, metadata, before, after});
  const eventKey = hash(JSON.stringify({entryPoint: core.entryPoint, source: SOURCE, type: core.type, path: target,
    before: [false, null], after: [true, after.updateTime]}));
  const deliveryKey = hash(JSON.stringify({entryPoint: core.entryPoint, source: SOURCE, id: providerId}));
  const coreDigest = hash(JSON.stringify(core));
  const event = doc(`shiftPlanningDevelopIntake/current/events/${eventKey}`, {schemaVersion: 1, coreDigest,
    path: target, entryPoint: core.entryPoint, state: "retained", envelopeDigest: hash(envelope), chunkCount: 1, replayable: false}, LATER);
  const delivery = doc(`shiftPlanningDevelopIntake/current/deliveries/${deliveryKey}`, {schemaVersion: 1, eventKey,
    digest: hash(JSON.stringify({coreDigest, metadataWire: metadata})), metadata: JSON.stringify(metadata),
    beforeReadTime: null, afterReadTime: null}, LATER);
  const intake = doc("shiftPlanningDevelopIntake/current", {schemaVersion: 1, legacyUntracked: true,
    captureRevision: 1, eventCount: 1, deliveryCount: 1}, LATER);
  return {schemaVersion: 1, projectId: PROJECT, readOnly: true, atomicSnapshot: true, readTime: READ,
    canApply: false, canClaimClosure: false, intakeBefore: structuredClone(intake), intakeAfter: intake,
    collections: {shiftPlanningRequests: [], shifts: [doc(target, payload)], deliveryCalendar: [], notificationEvents: []},
    events: [event], deliveries: [delivery], chunks: {[event.name]: [doc(
      `shiftPlanningDevelopIntake/current/events/${eventKey}/chunks/0`, {bytes: Buffer.from(envelope)}, LATER)]}};
}

function replaceEnvelope(input, mutate) {
  const event = input.events[0], chunk = input.chunks[event.name][0];
  const envelope = JSON.parse(Buffer.from(chunk.fields.bytes.bytesValue, "base64"));
  mutate(envelope);
  const bytes = Buffer.from(JSON.stringify(envelope));
  chunk.fields.bytes = raw(bytes);
  event.fields.envelopeDigest = raw(hash(bytes));
}

test("valid inspection binds a complete census and source version without granting closure or exposing fields", () => {
  const input = fixture(), before = structuredClone(input), report = inspectCensus(input);
  assert.equal(report.captureRevision, 1);
  assert.equal(report.eventCount, 1);
  assert.equal(report.deliveryCount, 1);
  assert.equal(report.captures[0].relationship, "current-version-matching");
  assert.equal(report.captures[0].externalOutcome, "unknown");
  assert.equal(report.legacyUntracked, true);
  assert.equal(report.canApply, false);
  assert.equal(report.canClaimClosure, false);
  assert.equal(report.fingerprint.length, 64);
  assert.match(report.stableSetDigest, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(report).includes("Never include this private content"), false);
  assert.deepEqual(input, before);
});

test("failed and processing requests retain unknown Sheets effects; completion remains an observed summary", () => {
  const input = fixture();
  for (const status of ["requested", "processing", "failed", "completed", "toString"]) {
    input.collections.shiftPlanningRequests.push(doc(`develop/plus-collections/shiftPlanningRequests/${status}`,
      {status, errorMessage: "Private account or external failure details", sheetName: "Private worksheet"}));
  }
  const rows = inspectCensus(input).records.filter((row) => row.path.includes("/shiftPlanningRequests/"));
  const byId = new Map(rows.map((row) => [row.path.split("/").at(-1), row]));
  assert.equal(byId.get("requested").classification, "request-pending-current");
  assert.equal(byId.get("processing").classification, "request-processing-current");
  assert.equal(byId.get("failed").classification, "request-failed-review");
  assert.equal(byId.get("completed").classification, "request-completed-summary-only");
  assert.equal(byId.get("toString").classification, "request-unclassified-review");
  assert.ok(rows.every((row) => row.sheetsOutcome === "unknown" && row.notificationOutcome === "unknown"));
  assert.equal(JSON.stringify(rows).includes("Private"), false);
});

test("missing, successful, partially successful and no-token notification summaries never authorize replay or claim non-delivery", () => {
  const input = fixture();
  for (const [index, status] of [null, "success", "partial_success", "no_tokens", "unexpected-private-value"].entries()) {
    input.collections.notificationEvents.push(doc(`develop/plus-collections/notificationEvents/event-${index}`,
      {title: "Private notification title", targetPayload: {userIds: ["private-user"]},
        ...(status ? {dispatch: {status}} : {})}));
  }
  const report = inspectCensus(input);
  assert.deepEqual(report.dispatchSummaries, {missing: 1, no_tokens: 1, partial_success: 1, success: 1, unrecognized: 1});
  assert.equal(report.historicalPossiblyDeliveredNotificationCount, 5);
  const rows = report.records.filter((row) => row.classification === "legacy-notification-history");
  assert.ok(rows.every((row) => row.possiblyDelivered === true && row.replayAllowed === false));
  assert.equal(JSON.stringify(rows).includes("private-user"), false);
  assert.equal(JSON.stringify(rows).includes("unexpected-private-value"), false);
  assert.equal(rows.find((row) => row.dispatchSummary === "unrecognized").dispatchSummary, "unrecognized");
});

test("an absent source and a later identical-body ABA restore are distinct from current-version matching", () => {
  const absent = fixture();
  absent.collections.shifts = [];
  assert.equal(inspectCensus(absent).captures[0].relationship, "source-absent");
  const later = fixture();
  later.collections.shifts[0].updateTime = LATER;
  const report = inspectCensus(later);
  assert.equal(report.captures[0].relationship, "superseded");
  assert.notEqual(report.fingerprint, inspectCensus(fixture()).fingerprint);
  assert.notEqual(report.stableSetDigest, inspectCensus(fixture()).stableSetDigest);
  assert.equal(report.captures[0].replayAllowed, false);
});

test("a matching source version with contradictory fields cannot claim current-version matching", () => {
  const input = fixture();
  input.collections.shifts[0].fields.status = raw("confirmed");
  assert.throws(() => inspectCensus(input), code("source_payload_conflict"));
});

test("a matching update time with contradictory creation time is rejected", () => {
  const input = fixture();
  input.collections.shifts[0].createTime = UPDATED;
  assert.throws(() => inspectCensus(input), code("source_payload_conflict"));
});

test("matching compares timestamps, bytes, maps, arrays and the SDK vector representation without rounding unsafe integers", () => {
  const input = fixture(), current = input.collections.shifts[0];
  current.fields = {
    at: {timestampValue: UPDATED}, binary: {bytesValue: "AP8P"}, empty: {mapValue: {}},
    location: {geoPointValue: {latitude: 37.1773, longitude: -3.5986}},
    nested: {arrayValue: {values: [{nullValue: null}, {booleanValue: true}, {stringValue: "retained"}]}},
    numbers: {arrayValue: {values: [{integerValue: "42"}, {doubleValue: "NaN"}, {doubleValue: "Infinity"}, {doubleValue: -0}]}},
    vector: {mapValue: {fields: {__type__: {stringValue: "__vector__"},
      value: {arrayValue: {values: [{doubleValue: 0.125}, {doubleValue: -2}]}}}}},
  };
  const expected = ["map", [
    ["at", ["timestamp", at(UPDATED)]], ["binary", ["bytes", "AP8P"]], ["empty", ["map", []]],
    ["location", ["geopoint", 37.1773, -3.5986]],
    ["nested", ["array", [["null"], ["boolean", true], ["string", "retained"]]]],
    ["numbers", ["array", [["number", "42"], ["number", "NaN"], ["number", "Infinity"], ["number", "-0"]]]],
    ["vector", ["vector", [["number", "0.125"], ["number", "-2"]]]],
  ]];
  replaceEnvelope(input, (envelope) => { envelope.after.fields = expected; envelope.core.after.fields = expected; });
  const event = input.events[0], chunk = input.chunks[event.name][0];
  const envelope = JSON.parse(Buffer.from(chunk.fields.bytes.bytesValue, "base64"));
  const coreDigest = hash(JSON.stringify(envelope.core));
  event.fields.coreDigest = raw(coreDigest);
  input.deliveries[0].fields.digest = raw(hash(JSON.stringify({coreDigest, metadataWire: envelope.metadata})));
  assert.equal(inspectCensus(input).captures[0].relationship, "current-version-matching");
  for (const replacement of [{integerValue: "9007199254740993"}, {referenceValue: `${BASE}develop/plus-collections/users/member`}]) {
    const unsupported = structuredClone(input);
    unsupported.collections.shifts[0].fields.binary = replacement;
    assert.throws(() => inspectCensus(unsupported), code("source_value_unsupported"));
  }
});

test("a probe-looking source is not exempted from real pending-work review", () => {
  const input = fixture();
  input.collections.shiftPlanningRequests.push(doc("develop/plus-collections/shiftPlanningRequests/__hu084_intake_probe_looks-real",
    {status: "processing", probe: {purpose: "durable-develop-intake"}}));
  assert.equal(inspectCensus(input).records.find((row) => row.path.includes("looks-real")).classification,
    "request-processing-current");
});

test("a changed intake version, changed revision and incomplete event or delivery lists are rejected", () => {
  for (const mutate of [
    (input) => { input.intakeAfter.updateTime = READ; },
    (input) => { input.intakeAfter.fields.captureRevision = raw(2); },
    (input) => { input.events = []; },
    (input) => { input.deliveries = []; },
  ]) {
    const input = fixture(); mutate(input);
    assert.throws(() => inspectCensus(input), (error) => ["intake_changed", "intake_count_mismatch"].includes(error.code));
  }
});

test("truncated chunks and corrupted bytes fail before producing a reconciliation report", () => {
  const truncated = fixture();
  truncated.chunks[truncated.events[0].name] = [];
  assert.throws(() => inspectCensus(truncated), code("capture_chunk_set_mismatch"));
  const corrupted = fixture();
  corrupted.chunks[corrupted.events[0].name][0].fields.bytes = raw(Buffer.from("tampered envelope"));
  assert.throws(() => inspectCensus(corrupted), code("capture_envelope_digest_mismatch"));
});

test("a rewritten envelope cannot hide a core digest or event identity conflict", () => {
  const mismatch = fixture();
  replaceEnvelope(mismatch, (envelope) => {
    envelope.after.fields = tagged({status: "confirmed"});
    envelope.core.after.fields = envelope.after.fields;
  });
  assert.throws(() => inspectCensus(mismatch), code("capture_core_digest_mismatch"));
  const identity = fixture();
  replaceEnvelope(identity, (envelope) => { envelope.core.source = "//firestore.googleapis.com/projects/other/databases/(default)"; });
  assert.throws(() => inspectCensus(identity), code("capture_identity_invalid"));
});

test("a delivery attached to another event or with changed original metadata is rejected", () => {
  const wrong = fixture();
  wrong.deliveries[0].fields.eventKey = raw("f".repeat(64));
  assert.throws(() => inspectCensus(wrong), code("invalid_delivery_record"));
  const metadata = fixture();
  const original = JSON.parse(metadata.deliveries[0].fields.metadata.stringValue);
  original[1].find(([name]) => name === "id")[1][1] = "another-provider-id";
  metadata.deliveries[0].fields.metadata = raw(JSON.stringify(original));
  assert.throws(() => inspectCensus(metadata), code("delivery_binding_mismatch"));
});

test("production paths, duplicate source records and undeclared extra input cannot be hidden in a private census", () => {
  const production = fixture();
  production.collections.shifts[0].name = BASE + "production/plus-collections/shifts/current-shift";
  assert.throws(() => inspectCensus(production), code("document_path_invalid"));
  const duplicate = fixture();
  duplicate.collections.shifts.push(structuredClone(duplicate.collections.shifts[0]));
  assert.throws(() => inspectCensus(duplicate), code("duplicate_document"));
  const extra = {...fixture(), assumedHistoricalApproval: true};
  assert.throws(() => inspectCensus(extra), code("invalid_fields"));
});

test("non-atomic snapshots, future versions and source version regressions remain invalid", () => {
  const nonAtomic = fixture(); nonAtomic.atomicSnapshot = false;
  assert.throws(() => inspectCensus(nonAtomic), code("invalid_census_scope"));
  const future = fixture(); future.collections.shifts[0].updateTime = "2027-01-01T00:00:00Z";
  assert.throws(() => inspectCensus(future), code("document_time_invalid"));
  const regressed = fixture(); regressed.collections.shifts[0].updateTime = CREATED;
  assert.throws(() => inspectCensus(regressed), code("source_version_regression"));
});

test("fresh reads retain stable set identity while recording distinct observation provenance", () => {
  const input = fixture(), fresh = structuredClone(input);
  fresh.readTime = "2026-10-28T10:06:00.987654321Z";
  const original = inspectCensus(input), observed = inspectCensus(fresh);
  assert.equal(original.stableSetDigest, observed.stableSetDigest);
  assert.notEqual(original.fingerprint, observed.fingerprint);
  assert.equal(observed.canApply, false);
  assert.equal(observed.canClaimClosure, false);
  assert.equal(observed.legacyUntracked, true);
});

test("source, event, delivery, chunk and collection ordering do not change either digest", () => {
  const input = fixture(), second = fixture("another-shift");
  input.collections.shifts.push(...second.collections.shifts);
  input.events.push(...second.events);
  input.deliveries.push(...second.deliveries);
  Object.assign(input.chunks, second.chunks);
  for (const root of [input.intakeBefore, input.intakeAfter]) {
    root.fields.captureRevision = raw(2); root.fields.eventCount = raw(2); root.fields.deliveryCount = raw(2);
  }
  const event = input.events[0], chunk = input.chunks[event.name][0];
  const bytes = Buffer.from(chunk.fields.bytes.bytesValue, "base64"), split = Math.floor(bytes.length / 2);
  event.fields.chunkCount = raw(2);
  chunk.fields.bytes = raw(bytes.subarray(0, split));
  input.chunks[event.name].push(doc(`${event.name.slice(BASE.length)}/chunks/1`, {bytes: bytes.subarray(split)}, LATER));
  const reversed = structuredClone(input);
  reversed.collections.shifts.reverse();
  reversed.events.reverse(); reversed.deliveries.reverse();
  reversed.chunks = Object.fromEntries(Object.entries(reversed.chunks).reverse()
    .map(([name, chunks]) => [name, chunks.reverse()]));
  assert.equal(inspectCensus(input).fingerprint, inspectCensus(reversed).fingerprint);
  assert.equal(inspectCensus(input).stableSetDigest, inspectCensus(reversed).stableSetDigest);
});

test("stable identity binds every document image, including capture, delivery and chunk versions", () => {
  const original = fixture();
  original.collections.deliveryCalendar.push(doc("develop/plus-collections/deliveryCalendar/week", {enabled: true}));
  const expected = inspectCensus(original).stableSetDigest;
  for (const mutate of [
    (input) => { input.collections.deliveryCalendar[0].fields.enabled = raw(false); },
    (input) => { input.collections.deliveryCalendar[0].createTime = UPDATED; },
    (input) => { input.collections.shifts[0].updateTime = LATER; },
    (input) => { input.events[0].updateTime = READ; },
    (input) => { input.deliveries[0].updateTime = READ; },
    (input) => { input.chunks[input.events[0].name][0].updateTime = READ; },
  ]) {
    const changed = structuredClone(original); mutate(changed);
    assert.notEqual(inspectCensus(changed).stableSetDigest, expected);
  }
  const corrupted = structuredClone(original);
  corrupted.chunks[corrupted.events[0].name][0].fields.bytes = raw(Buffer.from("changed retained bytes"));
  assert.throws(() => inspectCensus(corrupted), code("capture_envelope_digest_mismatch"));
});

test("a new valid delivery and capture revision invalidate stable set identity even for the same logical event", () => {
  const input = fixture(), original = inspectCensus(input);
  const event = input.events[0], alias = structuredClone(input.deliveries[0]);
  const metadata = JSON.parse(alias.fields.metadata.stringValue);
  metadata[1].find(([name]) => name === "id")[1][1] = "provider-alias-delivery";
  const id = hash(JSON.stringify({entryPoint: "onShiftWritten", source: SOURCE, id: "provider-alias-delivery"}));
  alias.name = `${ROOT}/deliveries/${id}`;
  alias.fields.metadata = raw(JSON.stringify(metadata));
  alias.fields.digest = raw(hash(JSON.stringify({coreDigest: event.fields.coreDigest.stringValue, metadataWire: metadata})));
  input.deliveries.push(alias);
  for (const root of [input.intakeBefore, input.intakeAfter]) {
    root.fields.captureRevision = raw(2); root.fields.deliveryCount = raw(2);
  }
  const changed = inspectCensus(input);
  assert.equal(changed.eventCount, 1);
  assert.equal(changed.captureRevision, 2);
  assert.notEqual(changed.stableSetDigest, original.stableSetDigest);
});

test("the offline CLI writes only a new private report and refuses to overwrite existing evidence", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "develop-census-"));
  const input = path.join(folder, "input.json"), output = path.join(folder, "output.json");
  const script = path.resolve(__dirname, "../scripts/inspect-develop-legacy-census.cjs");
  try {
    fs.writeFileSync(input, JSON.stringify(fixture()));
    const run = () => spawnSync(process.execPath, [script, "--input", input, "--output", output], {encoding: "utf8"});
    const first = run(); assert.equal(first.status, 0, first.stderr);
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    const before = fs.readFileSync(output);
    const second = run(); assert.equal(second.status, 1);
    assert.deepEqual(fs.readFileSync(output), before);
    assert.equal(JSON.parse(first.stdout).canApply, false);
    assert.equal(JSON.parse(fs.readFileSync(output)).canClaimClosure, false);
  } finally { fs.rmSync(folder, {recursive: true, force: true}); }
});
