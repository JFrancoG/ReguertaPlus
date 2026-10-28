"use strict";

// Shared wire fixture for the offline census and reconciliation behavior tests.
const {createHash} = require("node:crypto");
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

module.exports = {PROJECT, BASE, ROOT, SOURCE, CREATED, UPDATED, LATER, READ, at, hash, raw, fields, doc, tagged, fixture};
