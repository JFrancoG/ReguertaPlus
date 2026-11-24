"use strict";

// Offline classification only: no SDK, replay, live journal or admission port.
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {inspectCensus} = require("./inspect-develop-legacy-census.cjs");
const PROJECT = "reguerta-9f27f";
const BASE = `projects/${PROJECT}/databases/(default)/documents/`;
const HEX = /^[a-f0-9]{64}$/;
const LIMIT = 64 * 1024 * 1024;
const PHASES = {
  "capture-first-redelivery-inspection": {count: 6, cleanup: "failure-cleanup-with-readback-precondition"},
  "legacy-develop-containment": {count: 12, cleanup: "deleted-with-precondition"},
};
const COLLECTIONS = ["shiftPlanningRequests", "shifts", "deliveryCalendar", "notificationEvents"];
const fail = (code) => { throw Object.assign(new Error(code), {code}); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : plain(value) ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const digest = (value) => hash(JSON.stringify(canonical(value)));
const same = (left, right) => digest(left) === digest(right);
const relative = (value) => typeof value === "string" && /^develop\/plus-collections\/[^/]+\/[^/]+$/.test(value) &&
  COLLECTIONS.includes(value.split("/")[2]);
function stamp(value) {
  const match = typeof value === "string" && value.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/);
  check(match, "invalid_receipt_timestamp");
  const millis = Date.parse(`${match[1]}Z`);
  check(Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 19) === match[1], "invalid_receipt_timestamp");
  return [millis / 1000, Number((match[2] || "").padEnd(9, "0"))];
}
const compare = (left, right) => left[0] - right[0] || left[1] - right[1];
function tagged(value, depth = 0) {
  check(depth <= 32, "invalid_canary_payload");
  if (value === null) return ["null"];
  if (["string", "boolean"].includes(typeof value)) return [typeof value, value];
  if (typeof value === "number") {
    check(Number.isFinite(value), "invalid_canary_payload");
    return ["number", Object.is(value, -0) ? "-0" : String(value)];
  }
  if (Array.isArray(value)) return ["array", value.map((item) => tagged(item, depth + 1))];
  check(plain(value), "invalid_canary_payload");
  return ["map", Object.keys(value).sort().map((key) => [key, tagged(value[key], depth + 1)])];
}
function parsed(source) {
  check(plain(source) && typeof source.text === "string" && Buffer.byteLength(source.text) <= LIMIT &&
    HEX.test(source.sha256 || "") && hash(source.text) === source.sha256, "source_digest_mismatch");
  try { return JSON.parse(source.text); } catch { return fail("invalid_source_json"); }
}
function envelopes(census) {
  return new Map(census.events.map((event) => {
    const chunks = [...census.chunks[event.name]].sort((a, b) => Number(a.name.split("/").at(-1)) -
      Number(b.name.split("/").at(-1)));
    return [event.name.split("/").at(-1), JSON.parse(Buffer.concat(chunks.map((chunk) =>
      Buffer.from(chunk.fields.bytes.bytesValue, "base64"))).toString("utf8"))];
  }));
}
function receiptClaims(receipt, source, census, inspected) {
  const phase = plain(receipt) && Object.hasOwn(PHASES, receipt.phase) ? PHASES[receipt.phase] : null;
  check(plain(receipt) && phase && receipt.schemaVersion === 1 && receipt.projectId === PROJECT &&
    receipt.status === "accepted" && receipt.canApply === false && receipt.finalState?.legacyUntracked === true &&
    ["captureRevision", "eventCount", "deliveryCount"].every((key) => receipt.finalState[key] === phase.count) &&
    Array.isArray(receipt.entries) && receipt.entries.length === 4 && Array.isArray(receipt.captures) &&
    receipt.captures.length === 6, "receipt_not_accepted_canary_group");
  check(compare(stamp(receipt.startedAt), stamp(receipt.completedAt)) <= 0 &&
    compare(stamp(receipt.completedAt), stamp(census.readTime)) <= 0, "receipt_time_mismatch");
  check(["captureRevision", "eventCount", "deliveryCount"].every((key) =>
    receipt.finalState[key] <= inspected[key]), "receipt_state_exceeds_census");
  const entries = new Map(), collections = new Set(), ids = new Set(), claims = [];
  for (const entry of receipt.entries) {
    check(relative(entry.path) && entry.name === BASE + entry.path && !entries.has(entry.path) &&
      entry.submission === "acknowledged" && entry.cleanup === phase.cleanup &&
      entry.payloadDigest === digest(entry.payload), "receipt_entry_mismatch");
    check(compare(stamp(entry.created?.createTime), stamp(entry.created?.updateTime)) <= 0 &&
      compare(stamp(entry.created.updateTime), stamp(receipt.completedAt)) <= 0, "receipt_time_mismatch");
    tagged(entry.payload);
    entries.set(entry.path, entry); collections.add(entry.path.split("/")[2]); ids.add(entry.path.split("/").at(-1));
  }
  check(collections.size === 4 && ids.size === 1, "receipt_entry_set_mismatch");
  const captureIds = new Set(), versions = new Set();
  for (const capture of receipt.captures) {
    const entry = entries.get(capture.path), key = `${capture.path}:${capture.deleted}`;
    check(entry && HEX.test(capture.eventId || "") && HEX.test(capture.coreDigest || "") &&
      typeof capture.deleted === "boolean" && typeof capture.metadataId === "string" && capture.metadataId.length > 0 &&
      !captureIds.has(capture.eventId) && !versions.has(key) &&
      same(stamp(capture.sourceVersion), stamp(entry.created.updateTime)) &&
      (!capture.deleted || ["shifts", "deliveryCalendar"].includes(capture.path.split("/")[2])), "receipt_capture_mismatch");
    captureIds.add(capture.eventId); versions.add(key);
    claims.push({capture, entry, receiptSha256: source.sha256, phase: receipt.phase});
  }
  check([...entries.keys()].every((target) => versions.has(`${target}:false`) &&
    (!["shifts", "deliveryCalendar"].includes(target.split("/")[2]) || versions.has(`${target}:true`))),
  "receipt_capture_set_mismatch");
  return claims;
}
function matchClaim(row, claim, envelope, sourcePaths) {
  const {capture, entry} = claim, core = envelope.core, image = capture.deleted ? core.before : core.after;
  if (capture.path !== row.path || capture.coreDigest !== row.coreDigest ||
      !same(stamp(capture.sourceVersion), row.sourceVersion) || sourcePaths.has(row.path)) return false;
  if (!image?.exists || core.after.exists !== !capture.deleted ||
      (!capture.deleted && core.before?.exists) ||
      !same(image.createTime, stamp(entry.created.createTime)) ||
      !same(image.updateTime, stamp(entry.created.updateTime)) || !same(image.fields, tagged(entry.payload))) return false;
  const id = envelope.metadata[1].find(([name]) => name === "id")?.[1];
  return same(id, ["string", capture.metadataId]);
}
function reconcileCensus(input) {
  const census = parsed(input.census), inspected = inspectCensus(census);
  check(HEX.test(input.expectedStableSetDigest || "") && inspected.stableSetDigest === input.expectedStableSetDigest,
    "causal_set_digest_mismatch");
  check(Array.isArray(input.canaryReceipts) && input.canaryReceipts.length <= 8, "receipt_budget_exceeded");
  const claims = [], receipts = [], seen = new Set();
  for (const source of input.canaryReceipts) {
    const receipt = parsed(source);
    check(!seen.has(source.sha256), "duplicate_receipt_source"); seen.add(source.sha256);
    try {
      claims.push(...receiptClaims(receipt, source, census, inspected));
      receipts.push({sha256: source.sha256, binding: "accepted-canary-receipt"});
    } catch (error) {
      receipts.push({sha256: source.sha256, binding: "unresolved-receipt", reason: error.code || "invalid_receipt"});
    }
  }
  const wire = envelopes(census), sourcePaths = new Set(inspected.records.map((row) => row.path));
  const captures = inspected.captures.map((row) => {
    const candidates = claims.filter((claim) => claim.capture.eventId === row.eventKey);
    const matched = candidates.length === 1 && matchClaim(row, candidates[0], wire.get(row.eventKey), sourcePaths);
    return {...row, classification: matched ? "accepted-canary-capture" : "unresolved-retained-capture",
      receiptSha256: matched ? candidates[0].receiptSha256 : null,
      cleanupEvidence: matched ? (candidates[0].capture.deleted ? "captured-deletion-and-current-absence" :
        "receipt-recorded-preconditioned-cleanup-and-current-absence") : "not-established",
      legacyCallbackTerminality: "not-established", externalOutcome: "unknown", replayAllowed: false};
  });
  const sourceEvidenceDigest = input.sourceEvidence ? (parsed(input.sourceEvidence), input.sourceEvidence.sha256) : null;
  return {schemaVersion: 1, kind: "develop-legacy-offline-reconciliation", projectId: PROJECT,
    censusSourceSha256: input.census.sha256, stableSetDigest: inspected.stableSetDigest,
    observationFingerprint: inspected.fingerprint, readTime: inspected.readTime, captureRevision: inspected.captureRevision,
    sourceEvidenceDigest, sourceEvidenceInterpretation: "provenance-only-not-terminal-evidence",
    receipts, sourceCounts: inspected.sourceCounts, dispatchSummaries: inspected.dispatchSummaries,
    historicalPossiblyDeliveredNotificationCount: inspected.historicalPossiblyDeliveredNotificationCount,
    records: inspected.records, captures,
    acceptedCanaryCaptureCount: captures.filter((row) => row.classification === "accepted-canary-capture").length,
    unresolvedCaptureCount: captures.filter((row) => row.classification === "unresolved-retained-capture").length,
    legacyExecutionEvidence: {localSourceGuards: "requires-separate-source-review", realTerminality: "not-established"},
    physicalHandoffReady: false, canEnterMaintenance: false, canApply: false, canClaimClosure: false, legacyUntracked: true};
}

module.exports = {reconcileCensus};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    check(args.length === 4 && args[0] === "--input" && args[2] === "--output", "invalid_arguments");
    const manifestPath = path.resolve(args[1]), output = path.resolve(args[3]);
    check(fs.statSync(manifestPath).size <= LIMIT, "input_budget_exceeded");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    check(manifest.schemaVersion === 1 && manifest.projectId === PROJECT &&
      Array.isArray(manifest.canaryReceipts) && manifest.canaryReceipts.length <= 8, "invalid_manifest_scope");
    const load = (item) => {
      check(plain(item) && typeof item.path === "string", "invalid_manifest_source");
      const filename = path.resolve(path.dirname(manifestPath), item.path);
      check(filename !== output && fs.statSync(filename).size <= LIMIT, "input_budget_exceeded");
      return {text: fs.readFileSync(filename, "utf8"), sha256: item.sha256};
    };
    const report = reconcileCensus({census: load(manifest.census), expectedStableSetDigest: manifest.expectedStableSetDigest,
      canaryReceipts: manifest.canaryReceipts.map(load), sourceEvidence: manifest.sourceEvidence ? load(manifest.sourceEvidence) : null});
    check((fs.statSync(path.dirname(output)).mode & 0o077) === 0, "output_directory_not_private");
    const fd = fs.openSync(output, "wx", 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(report, null, 2) + "\n"); } finally { fs.closeSync(fd); }
    process.stdout.write(JSON.stringify({reportWritten: true, acceptedCanaryCaptureCount: report.acceptedCanaryCaptureCount,
      unresolvedCaptureCount: report.unresolvedCaptureCount, canApply: false, canEnterMaintenance: false}) + "\n");
  } catch (error) {
    const code = typeof error.code === "string" && /^[a-z_]+$/.test(error.code) ? error.code : "offline_reconciliation_failed";
    process.stderr.write(`offline_reconciliation_failed:${code}\n`); process.exitCode = 1;
  }
}
