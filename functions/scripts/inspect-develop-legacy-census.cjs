"use strict";

// Offline inspection only. This file deliberately has no SDK or network port.
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const PROJECT = "reguerta-9f27f";
const BASE = `projects/${PROJECT}/databases/(default)/documents/`;
const ROOT = `${BASE}shiftPlanningDevelopIntake/current`;
const SOURCE = `//firestore.googleapis.com/projects/${PROJECT}/databases/(default)`;
const COLLECTIONS = ["shiftPlanningRequests", "shifts", "deliveryCalendar", "notificationEvents"];
const ROUTES = {
  shiftPlanningRequests: ["onShiftPlanningRequestCreated", "requestId", "created"],
  shifts: ["onShiftWritten", "shiftId", "written"],
  deliveryCalendar: ["onDeliveryCalendarOverrideWritten", "weekKey", "written"],
  notificationEvents: ["onNotificationEventCreated", "eventId", "created"],
};
const MAX_BYTES = 64 * 1024 * 1024;
const HEX = /^[a-f0-9]{64}$/;
const fail = (code) => { throw Object.assign(new Error(code), {code}); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, names, code = "invalid_fields") => check(plain(value) &&
  Object.keys(value).sort().join("\0") === [...names].sort().join("\0"), code);
const sorted = (value) => Array.isArray(value) ? value.map(sorted) : plain(value) ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value;
const digest = (value) => hash(JSON.stringify(sorted(value)));
const same = (left, right) => digest(left) === digest(right);
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function jsonTree(value, depth = 0, budget = {nodes: 0}) {
  check(depth <= 60 && ++budget.nodes <= 1_000_000, "input_budget_exceeded");
  if (value === null || ["string", "boolean"].includes(typeof value)) return;
  if (typeof value === "number") return check(Number.isFinite(value), "invalid_json_value");
  check(Array.isArray(value) || plain(value), "invalid_json_value");
  check(Object.getOwnPropertySymbols(value).length === 0, "invalid_json_value");
  const names = Array.isArray(value) ? Array.from({length: value.length}, (_, index) => String(index)) :
    Object.keys(value);
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    check(descriptor && "value" in descriptor && descriptor.enumerable, "invalid_json_value");
    jsonTree(descriptor.value, depth + 1, budget);
  }
}

function isoStamp(value) {
  check(typeof value === "string", "invalid_timestamp");
  const match = value.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/);
  check(match, "invalid_timestamp");
  const milliseconds = Date.parse(`${match[1]}Z`);
  check(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 19) === match[1],
    "invalid_timestamp");
  return stamp([milliseconds / 1000, Number((match[2] || "").padEnd(9, "0"))]);
}
const compareStamp = (left, right) => left[0] - right[0] || left[1] - right[1];
function stamp(value, nullable = false) {
  if (nullable && value === null) return null;
  check(Array.isArray(value) && value.length === 2 && Number.isSafeInteger(value[0]) &&
    value[0] >= -62135596800 && value[0] <= 253402300799 && Number.isInteger(value[1]) &&
    value[1] >= 0 && value[1] < 1e9, "invalid_snapshot_timestamp");
  return value;
}
function base64(value) {
  check(typeof value === "string" && Buffer.from(value, "base64").toString("base64") === value,
    "invalid_bytes");
  return Buffer.from(value, "base64");
}

function tagged(value, depth = 0) {
  check(depth <= 32 && Array.isArray(value) && typeof value[0] === "string", "invalid_tagged_value");
  const [kind, content] = value;
  if (kind === "null") return check(value.length === 1, "invalid_tagged_value");
  check(value.length === (kind === "geopoint" ? 3 : 2), "invalid_tagged_value");
  if (kind === "boolean" || kind === "string") return check(typeof content === kind, "invalid_tagged_value");
  if (kind === "number") return check(typeof content === "string" &&
    (content === "-0" || ["NaN", "Infinity", "-Infinity"].includes(content) ||
      (Number.isFinite(Number(content)) && String(Number(content)) === content)), "invalid_tagged_value");
  if (kind === "timestamp") return stamp(content);
  if (kind === "bytes") return base64(content);
  if (kind === "geopoint") return check(Number.isFinite(content) && content >= -90 && content <= 90 &&
    Number.isFinite(value[2]) && value[2] >= -180 && value[2] <= 180, "invalid_tagged_value");
  if (kind === "array" || kind === "vector") {
    check(Array.isArray(content), "invalid_tagged_value");
    for (const item of content) {
      if (kind === "vector") check(Array.isArray(item) && item[0] === "number", "invalid_tagged_value");
      tagged(item, depth + 1);
    }
    return;
  }
  check(kind === "map" && Array.isArray(content), "invalid_tagged_value");
  let previous = null;
  for (const pair of content) {
    check(Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" &&
      (previous === null || previous < pair[0]), "invalid_tagged_value");
    previous = pair[0];
    tagged(pair[1], depth + 1);
  }
}
const taggedField = (value, key) => value?.[0] === "map" ?
  value[1].find((pair) => pair[0] === key)?.[1] : undefined;
const taggedString = (value) => value?.[0] === "string" ? value[1] : null;
const restString = (value) => plain(value) && Object.keys(value).length === 1 &&
  typeof value.stringValue === "string" ? value.stringValue : null;

// Used only when a retained source version is still current. Unsupported or
// lossy values block a matching claim instead of silently skipping a field.
function restTagged(value, depth = 0) {
  check(depth <= 32 && plain(value) && Object.keys(value).length === 1, "source_value_unsupported");
  const [kind] = Object.keys(value), content = value[kind];
  if (kind === "nullValue") {
    check(content === null || content === "NULL_VALUE", "source_value_unsupported");
    return ["null"];
  }
  if (kind === "stringValue" || kind === "booleanValue") {
    const type = kind === "stringValue" ? "string" : "boolean";
    check(typeof content === type, "source_value_unsupported");
    return [type, content];
  }
  if (kind === "integerValue") {
    check(typeof content === "string" && /^-?(0|[1-9][0-9]*)$/.test(content) &&
      Number.isSafeInteger(Number(content)), "source_value_unsupported");
    return ["number", String(Number(content))];
  }
  if (kind === "doubleValue") {
    check(typeof content === "number" || ["NaN", "Infinity", "-Infinity"].includes(content), "source_value_unsupported");
    return ["number", Object.is(content, -0) ? "-0" : String(content)];
  }
  if (kind === "timestampValue") return ["timestamp", isoStamp(content)];
  if (kind === "bytesValue") return ["bytes", base64(content).toString("base64")];
  if (kind === "geoPointValue") {
    check(plain(content) && Object.keys(content).every((key) => ["latitude", "longitude"].includes(key)),
      "source_value_unsupported");
    const result = ["geopoint", content.latitude ?? 0, content.longitude ?? 0];
    tagged(result);
    return result;
  }
  if (kind === "arrayValue") {
    check(plain(content) && Object.keys(content).every((key) => key === "values") &&
      (content.values === undefined || Array.isArray(content.values)), "source_value_unsupported");
    return ["array", (content.values || []).map((item) => restTagged(item, depth + 1))];
  }
  check(kind === "mapValue" && plain(content) && Object.keys(content).every((key) => key === "fields") &&
    (content.fields === undefined || plain(content.fields)), "source_value_unsupported");
  const fields = content.fields || {};
  if (restString(fields.__type__) === "__vector__") {
    exact(fields, ["__type__", "value"], "source_value_unsupported");
    const vector = restTagged(fields.value, depth + 1);
    check(vector[0] === "array" && vector[1].every((item) => item[0] === "number"), "source_value_unsupported");
    return ["vector", vector[1]];
  }
  return ["map", Object.keys(fields).sort().map((key) => [key, restTagged(fields[key], depth + 1)])];
}

function restInteger(value) {
  exact(value, ["integerValue"]);
  check(typeof value.integerValue === "string" && /^(0|[1-9][0-9]*)$/.test(value.integerValue), "invalid_integer");
  const number = Number(value.integerValue);
  check(Number.isSafeInteger(number), "invalid_integer");
  return number;
}
function restBoolean(value) {
  exact(value, ["booleanValue"]);
  check(typeof value.booleanValue === "boolean", "invalid_boolean");
  return value.booleanValue;
}
function restStamp(value) {
  if (plain(value) && Object.keys(value).length === 1 && value.nullValue === null) return null;
  exact(value, ["arrayValue"]);
  exact(value.arrayValue, ["values"]);
  check(Array.isArray(value.arrayValue.values) && value.arrayValue.values.length === 2, "invalid_snapshot_timestamp");
  const values = value.arrayValue.values.map((item) => {
    exact(item, ["integerValue"]);
    check(typeof item.integerValue === "string" && /^-?(0|[1-9][0-9]*)$/.test(item.integerValue), "invalid_integer");
    return Number(item.integerValue);
  });
  return stamp(values);
}

function document(value, expectedName, readTime, names) {
  exact(value, ["name", "fields", "createTime", "updateTime"], "invalid_document");
  check(value.name === expectedName && plain(value.fields), "document_path_invalid");
  check(!names.has(value.name), "duplicate_document");
  names.add(value.name);
  const created = isoStamp(value.createTime), updated = isoStamp(value.updateTime);
  check(compareStamp(created, updated) <= 0 && compareStamp(updated, readTime) <= 0, "document_time_invalid");
  return value;
}
function sourcePath(value, collection) {
  const prefix = `develop/plus-collections/${collection}/`;
  check(typeof value === "string" && value.startsWith(prefix), "document_path_invalid");
  const id = value.slice(prefix.length);
  check(id && !id.includes("/") && id !== "." && id !== ".." && Buffer.byteLength(id) <= 1500,
    "document_path_invalid");
  return id;
}

function snapshot(value, expectedPath, readTime) {
  exact(value, ["path", "exists", "createTime", "updateTime", "readTime", "fields"], "invalid_snapshot");
  check(value.path === expectedPath && typeof value.exists === "boolean", "invalid_snapshot");
  const read = stamp(value.readTime, true);
  if (read) check(compareStamp(read, readTime) <= 0, "invalid_snapshot_timestamp");
  if (!value.exists) {
    check(value.createTime === null && value.updateTime === null && value.fields === null, "invalid_snapshot");
    return;
  }
  const created = stamp(value.createTime), updated = stamp(value.updateTime);
  check(compareStamp(created, updated) <= 0 && compareStamp(updated, readTime) <= 0, "invalid_snapshot_timestamp");
  tagged(value.fields);
  check(value.fields[0] === "map", "invalid_snapshot");
}
function metadata(value, core) {
  tagged(value);
  check(value[0] === "map", "invalid_event_metadata");
  const collection = core.path.split("/")[2], route = ROUTES[collection];
  const params = taggedField(value, "params");
  const id = taggedString(taggedField(value, "id"));
  const time = taggedString(taggedField(value, "time"));
  check(id && id.length <= 512 && taggedString(taggedField(value, "source")) === SOURCE &&
    taggedString(taggedField(value, "type")) === core.type &&
    taggedString(taggedField(value, "subject")) === `documents/${core.path}` &&
    taggedString(taggedField(value, "specversion")) === "1.0" &&
    taggedString(taggedField(params, "env")) === "develop" &&
    taggedString(taggedField(params, route[1])) === sourcePath(core.path, collection), "invalid_event_metadata");
  isoStamp(time);
  return id;
}

/** Inspect one complete private REST census, without changing any record or external system. */
function inspectCensus(input) {
  jsonTree(input);
  check(Buffer.byteLength(JSON.stringify(input)) <= MAX_BYTES, "input_budget_exceeded");
  exact(input, ["schemaVersion", "projectId", "readOnly", "atomicSnapshot", "readTime", "canApply",
    "canClaimClosure", "intakeBefore", "intakeAfter", "collections", "events", "deliveries", "chunks"]);
  check(input.schemaVersion === 1 && input.projectId === PROJECT && input.readOnly === true &&
    input.atomicSnapshot === true && input.canApply === false && input.canClaimClosure === false, "invalid_census_scope");
  const readTime = isoStamp(input.readTime), names = new Set();
  document(input.intakeBefore, ROOT, readTime, new Set());
  document(input.intakeAfter, ROOT, readTime, names);
  check(same(input.intakeBefore, input.intakeAfter), "intake_changed");
  const control = input.intakeAfter.fields;
  exact(control, ["schemaVersion", "legacyUntracked", "captureRevision", "eventCount", "deliveryCount"]);
  check(restInteger(control.schemaVersion) === 1 && restBoolean(control.legacyUntracked) === true, "invalid_intake_state");
  const captureRevision = restInteger(control.captureRevision), eventCount = restInteger(control.eventCount),
    deliveryCount = restInteger(control.deliveryCount);
  check(Array.isArray(input.events) && input.events.length <= 5000 && Array.isArray(input.deliveries) &&
    input.deliveries.length <= 10000 && input.events.length === eventCount &&
    input.deliveries.length === deliveryCount && captureRevision === deliveryCount && eventCount <= deliveryCount,
  "intake_count_mismatch");
  exact(input.collections, COLLECTIONS);
  check(plain(input.chunks), "invalid_chunks");
  const sources = new Map(), records = [];
  const sourceCounts = {}, dispatchSummaries = {missing: 0, no_tokens: 0, partial_success: 0, success: 0, unrecognized: 0};
  let sourceCount = 0;
  for (const collection of COLLECTIONS) {
    const docs = input.collections[collection];
    check(Array.isArray(docs) && (sourceCount += docs.length) <= 5000, "source_budget_exceeded");
    sourceCounts[collection] = docs.length;
    for (const doc of docs) {
      const relative = typeof doc?.name === "string" ? doc.name.slice(BASE.length) : "";
      sourcePath(relative, collection);
      document(doc, BASE + relative, readTime, names);
      sources.set(relative, doc);
      const row = {path: relative, updateTime: doc.updateTime, documentDigest: digest(doc),
        classification: "current-state-only", sheetsOutcome: "unknown"};
      if (collection === "shiftPlanningRequests") {
        const status = restString(doc.fields.status);
        row.classification = new Map([["requested", "request-pending-current"], ["processing", "request-processing-current"],
          ["failed", "request-failed-review"], ["completed", "request-completed-summary-only"]]).get(status) ||
          "request-unclassified-review";
        row.notificationOutcome = "unknown";
      }
      if (collection === "notificationEvents") {
        row.classification = "legacy-notification-history";
        delete row.sheetsOutcome;
        const dispatch = doc.fields.dispatch?.mapValue?.fields;
        const status = restString(dispatch?.status);
        row.dispatchSummary = !Object.hasOwn(doc.fields, "dispatch") ? "missing" :
          ["no_tokens", "partial_success", "success"].includes(status) ? status : "unrecognized";
        dispatchSummaries[row.dispatchSummary]++;
        row.possiblyDelivered = true;
        row.replayAllowed = false;
      }
      records.push(row);
    }
  }
  const captured = new Map(), captureRecords = [], bindings = new Map();
  check(Object.keys(input.chunks).length === input.events.length, "capture_chunk_set_mismatch");
  for (const event of input.events) {
    const id = typeof event?.name === "string" ? event.name.slice(`${ROOT}/events/`.length) : null;
    check(HEX.test(id || ""), "event_path_invalid");
    document(event, `${ROOT}/events/${id}`, readTime, names);
    const fields = event.fields;
    exact(fields, ["schemaVersion", "coreDigest", "path", "entryPoint", "state", "envelopeDigest", "chunkCount", "replayable"]);
    const coreDigest = restString(fields.coreDigest), envelopeDigest = restString(fields.envelopeDigest),
      target = restString(fields.path), entryPoint = restString(fields.entryPoint), chunkCount = restInteger(fields.chunkCount);
    check(restInteger(fields.schemaVersion) === 1 && restString(fields.state) === "retained" &&
      restBoolean(fields.replayable) === false && HEX.test(coreDigest || "") && HEX.test(envelopeDigest || "") &&
      chunkCount >= 1 && chunkCount <= 21, "invalid_capture_record");
    const chunks = input.chunks[event.name];
    check(Array.isArray(chunks) && chunks.length === chunkCount, "capture_chunk_set_mismatch");
    const buffers = new Map();
    for (const chunk of chunks) {
      const index = typeof chunk?.name === "string" ? chunk.name.slice(`${event.name}/chunks/`.length) : null;
      check(typeof index === "string" && /^(0|[1-9][0-9]*)$/.test(index) && Number(index) < chunkCount,
        "chunk_path_invalid");
      document(chunk, `${event.name}/chunks/${index}`, readTime, names);
      exact(chunk.fields, ["bytes"]);
      exact(chunk.fields.bytes, ["bytesValue"]);
      const bytes = base64(chunk.fields.bytes.bytesValue);
      check(bytes.length > 0 && bytes.length <= 200 * 1024, "chunk_budget_exceeded");
      buffers.set(Number(index), bytes);
    }
    const bytes = Buffer.concat(Array.from({length: chunkCount}, (_, index) => buffers.get(index)));
    check(bytes.length <= 4 * 1024 * 1024 && hash(bytes) === envelopeDigest, "capture_envelope_digest_mismatch");
    let envelope;
    try { envelope = JSON.parse(bytes.toString("utf8")); } catch { fail("invalid_capture_envelope"); }
    check(Buffer.from(JSON.stringify(envelope)).equals(bytes), "invalid_capture_envelope");
    exact(envelope, ["core", "metadata", "before", "after"]);
    const core = envelope.core;
    exact(core, ["schemaVersion", "entryPoint", "source", "type", "path", "before", "after"]);
    const collection = target?.split("/")[2], route = ROUTES[collection];
    check(route && core.schemaVersion === 1 && core.entryPoint === route[0] && entryPoint === route[0] &&
      core.path === target && core.source === SOURCE && core.type === `google.cloud.firestore.document.v1.${route[2]}`,
    "capture_identity_invalid");
    sourcePath(target, collection);
    snapshot(envelope.after, target, readTime);
    if (route[2] === "created") check(envelope.before === null && core.before === null && envelope.after.exists,
      "invalid_snapshot");
    else snapshot(envelope.before, target, readTime);
    check(envelope.after.exists || envelope.before?.exists, "invalid_snapshot");
    check(same(core.after, {...envelope.after, readTime: null}) &&
      same(core.before, envelope.before && {...envelope.before, readTime: null}), "capture_snapshot_mismatch");
    check(hash(JSON.stringify(core)) === coreDigest, "capture_core_digest_mismatch");
    check(hash(JSON.stringify({entryPoint, source: SOURCE, type: core.type, path: target,
      before: core.before && [core.before.exists, core.before.updateTime],
      after: [core.after.exists, core.after.updateTime]})) === id, "capture_event_key_mismatch");
    const metadataId = metadata(envelope.metadata, core);
    const firstDeliveryKey = hash(JSON.stringify({entryPoint, source: SOURCE, id: metadataId}));
    captured.set(id, {core, coreDigest, firstDeliveryKey, envelope});
    const current = sources.get(target), version = core.after.exists ? core.after.updateTime : core.before.updateTime;
    let relationship = "source-absent";
    if (current) {
      const compared = compareStamp(isoStamp(current.updateTime), version);
      check(compared >= 0 && (core.after.exists || compared > 0), "source_version_regression");
      if (compared === 0) {
        check(same(isoStamp(current.createTime), core.after.createTime) &&
          same(restTagged({mapValue: {fields: current.fields}}), core.after.fields), "source_payload_conflict");
      }
      relationship = compared === 0 ? "current-version-matching" : "superseded";
    }
    captureRecords.push({eventKey: id, path: target, coreDigest, envelopeDigest,
      sourceVersion: version, currentUpdateTime: current?.updateTime ?? null,
      relationship, classification: "retained-unreplayed", externalOutcome: "unknown", replayAllowed: false});
  }
  for (const delivery of input.deliveries) {
    const id = typeof delivery?.name === "string" ? delivery.name.slice(`${ROOT}/deliveries/`.length) : null;
    check(HEX.test(id || ""), "delivery_path_invalid");
    document(delivery, `${ROOT}/deliveries/${id}`, readTime, names);
    const fields = delivery.fields;
    exact(fields, ["schemaVersion", "eventKey", "digest", "metadata", "beforeReadTime", "afterReadTime"]);
    const eventKey = restString(fields.eventKey), event = captured.get(eventKey), text = restString(fields.metadata);
    check(restInteger(fields.schemaVersion) === 1 && event && text && Buffer.byteLength(text) <= 256 * 1024,
      "invalid_delivery_record");
    let wire;
    try { wire = JSON.parse(text); } catch { fail("invalid_delivery_metadata"); }
    const metadataId = metadata(wire, event.core);
    check(hash(JSON.stringify({entryPoint: event.core.entryPoint, source: SOURCE, id: metadataId})) === id &&
      hash(JSON.stringify({coreDigest: event.coreDigest, metadataWire: wire})) === restString(fields.digest),
    "delivery_binding_mismatch");
    const beforeRead = restStamp(fields.beforeReadTime), afterRead = restStamp(fields.afterReadTime);
    for (const time of [beforeRead, afterRead].filter(Boolean)) {
      check(compareStamp(time, readTime) <= 0, "invalid_snapshot_timestamp");
    }
    if (id === event.firstDeliveryKey) {
      check(same(wire, event.envelope.metadata) && same(beforeRead, event.envelope.before?.readTime ?? null) &&
        same(afterRead, event.envelope.after.readTime), "delivery_binding_mismatch");
    }
    bindings.set(id, eventKey);
  }
  for (const [id, event] of captured) check(bindings.get(event.firstDeliveryKey) === id, "capture_delivery_missing");
  records.sort((a, b) => compareText(a.path, b.path));
  captureRecords.sort((a, b) => compareText(a.eventKey, b.eventKey));
  const documents = [input.intakeAfter, ...COLLECTIONS.flatMap((name) => input.collections[name]),
    ...input.events, ...input.deliveries, ...Object.values(input.chunks).flat()];
  const fingerprint = digest({readTime: input.readTime, captureRevision,
    documents: documents
      .map((doc) => ({name: doc.name, updateTime: doc.updateTime, digest: digest(doc)}))
      .sort((a, b) => compareText(a.name, b.name))});
  // This is a stable identity for the inspected set, not fresh control evidence
  // or permission to turn retained captures into a drained-work declaration.
  const stableSetDigest = digest({schemaVersion: 1, projectId: PROJECT, intakePath: ROOT,
    captureRevision, eventCount, deliveryCount,
    documents: documents.map((doc) => ({name: doc.name, createTime: doc.createTime,
      updateTime: doc.updateTime, contentDigest: digest(doc.fields)}))
      .sort((a, b) => compareText(a.name, b.name))});
  return {schemaVersion: 1, kind: "develop-legacy-census-inspection", projectId: PROJECT, readTime: input.readTime,
    atomicSnapshotReported: true, captureRevision, eventCount, deliveryCount, fingerprint, stableSetDigest,
    sourceCounts, dispatchSummaries, historicalPossiblyDeliveredNotificationCount: sourceCounts.notificationEvents,
    records, captures: captureRecords, legacyUntracked: true, canApply: false, canClaimClosure: false};
}

module.exports = {inspectCensus};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    check(args.length === 4 && args[0] === "--input" && args[2] === "--output", "invalid_arguments");
    const input = path.resolve(args[1]), output = path.resolve(args[3]);
    check(input !== output && fs.statSync(input).size <= MAX_BYTES, "input_budget_exceeded");
    const report = inspectCensus(JSON.parse(fs.readFileSync(input, "utf8")));
    const descriptor = fs.openSync(output, "wx", 0o600);
    try { fs.writeFileSync(descriptor, JSON.stringify(report, null, 2) + "\n"); } finally { fs.closeSync(descriptor); }
    process.stdout.write(JSON.stringify({reportWritten: true, eventCount: report.eventCount,
      deliveryCount: report.deliveryCount, canApply: false, canClaimClosure: false}) + "\n");
  } catch (error) {
    const code = typeof error.code === "string" && /^[a-z_]+$/.test(error.code) ? error.code : "census_inspection_failed";
    process.stderr.write(`census_inspection_failed:${code}\n`);
    process.exitCode = 1;
  }
}
