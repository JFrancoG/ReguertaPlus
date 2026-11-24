"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {before, beforeEach, after, test} = require("node:test");
const {Firestore, DocumentSnapshot, Timestamp, GeoPoint, FieldValue} = require("@google-cloud/firestore");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {onDocumentCreated, onDocumentWritten} = require("firebase-functions/v2/firestore");
const {createDevelopShiftIntakeDatabase, captureDevelopShiftEvent, encodeDevelopShiftEvent,
  encodeDevelopShiftValue, inspectDevelopShiftIntake, DEVELOP_SHIFT_INTAKE_PATH} =
  require("../lib/develop-shift-intake.js");

const PROJECT = "demo-reguerta-durable-intake";
const HOST = "127.0.0.1:8897";
const ROOT = "develop/plus-collections";
const SOURCE = `//firestore.googleapis.com/projects/${PROJECT}/databases/(default)`;
const routes = [
  {entryPoint: "onShiftPlanningRequestCreated", collection: "shiftPlanningRequests", parameter: "requestId", created: true},
  {entryPoint: "onShiftWritten", collection: "shifts", parameter: "shiftId", created: false},
  {entryPoint: "onDeliveryCalendarOverrideWritten", collection: "deliveryCalendar", parameter: "weekKey", created: false},
  {entryPoint: "onNotificationEventCreated", collection: "notificationEvents", parameter: "eventId", created: true},
];
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, HOST);
let db, snapshotApp;
before(() => {
  db = createDevelopShiftIntakeDatabase(PROJECT);
  snapshotApp = initializeApp({projectId: PROJECT});
});
after(async () => {
  try { await db.terminate(); }
  finally { await deleteApp(snapshotApp); }
});
beforeEach(async () => {
  const result = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    {method: "DELETE"});
  assert.equal(result.ok, true, await result.text());
});

const hasCode = (code) => (error) => error.code === code && error.message === code;
const version = (snapshot) => `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`;
const state = async () => (await db.doc(DEVELOP_SHIFT_INTAKE_PATH).get()).data();

function cloudEvent(route, before, after, id = "original-delivery-a") {
  return {specversion: "1.0", id, source: SOURCE,
    type: `google.cloud.firestore.document.v1.${route.created ? "created" : "written"}`,
    subject: `documents/${after.ref.path}`, time: "2026-10-28T12:34:56.123456789Z",
    location: "europe-west1", project: PROJECT, database: "(default)", namespace: "(default)",
    traceparent: "00-original-causal-trace", extension: {attempt: 1, labels: ["original", "develop"]},
    params: {env: "develop", [route.parameter]: after.id},
    data: route.created ? after : {before, after}};
}

async function sourceEvent(entryPoint = "onShiftWritten", data = {type: "delivery", assignedUserIds: ["a", "b"]}) {
  const route = routes.find((item) => item.entryPoint === entryPoint);
  const reference = db.doc(`${ROOT}/${route.collection}/source-a`);
  const before = await reference.get();
  await reference.create(data);
  const after = await reference.get();
  return {route, reference, before, after, event: cloudEvent(route, before, after)};
}

function snapshotImage(snapshot, changes = {}) {
  return {ref: snapshot.ref, exists: snapshot.exists, createTime: snapshot.createTime,
    updateTime: snapshot.updateTime, readTime: snapshot.readTime,
    data: () => snapshot.data(), ...changes};
}

async function storedCapture(eventKey) {
  const reference = db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("events").doc(eventKey);
  const event = await reference.get();
  const chunks = (await reference.collection("chunks").get()).docs
    .sort((a, b) => Number(a.id) - Number(b.id));
  const bytes = Buffer.concat(chunks.map((chunk) => chunk.get("bytes")));
  return {event, chunks, bytes, envelope: JSON.parse(bytes.toString("utf8"))};
}

async function journalImage() {
  const control = db.doc(DEVELOP_SHIFT_INTAKE_PATH);
  const snapshots = [await control.get()];
  const events = await control.collection("events").get();
  snapshots.push(...events.docs, ...(await control.collection("deliveries").get()).docs);
  for (const event of events.docs) snapshots.push(...(await event.ref.collection("chunks").get()).docs);
  return snapshots.filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({path: snapshot.ref.path, version: version(snapshot), data: snapshot.data()}))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function emptyJournal() {
  const control = db.doc(DEVELOP_SHIFT_INTAKE_PATH);
  assert.equal((await control.get()).exists, false);
  assert.equal((await control.collection("events").get()).empty, true);
  assert.equal((await control.collection("deliveries").get()).empty, true);
  assert.equal((await db.collectionGroup("chunks").get()).empty, true);
}

function rawProtobufEvent(route, documentId, {deleted = false, writtenCreated = false} = {}) {
  // Test-only, explicitly version-bound wire fixture. Decoding goes through the
  // public trigger entry point, rather than SDK snapshot_/serializer internals.
  const functionsRoot = path.resolve(path.dirname(require.resolve("firebase-functions/v2/firestore")), "../../..");
  assert.equal(JSON.parse(fs.readFileSync(path.join(functionsRoot, "package.json"), "utf8")).version, "7.3.2");
  const {google: {events: {cloud: {firestore: {v1: {DocumentEventData}}}}}} =
    require(path.join(functionsRoot, "protos/compiledFirestore.js"));
  const document = `${ROOT}/${route.collection}/${documentId}`;
  const wireDocument = (status, nanos) => ({
    name: `projects/${PROJECT}/databases/(default)/documents/${document}`,
    createTime: {seconds: 1_700_000_000, nanos: 111111111},
    updateTime: {seconds: 1_700_000_002, nanos},
    fields: {status: {stringValue: status}, at: {timestampValue: {seconds: 123, nanos: 987654321}}},
  });
  const payload = {...(!route.created && !writtenCreated ? {oldValue: wireDocument("before", 222222222)} : {}),
    ...(!deleted ? {value: wireDocument("after", 333333333)} : {})};
  const data = Buffer.from(DocumentEventData.encode(DocumentEventData.fromObject(payload)).finish());
  return {specversion: "1.0", id: `raw-${route.entryPoint}-${documentId}`, source: SOURCE,
    subject: `documents/${document}`, time: "2026-10-28T13:14:15.123456789Z",
    type: `google.cloud.firestore.document.v1.${route.created ? "created" : "written"}`,
    project: PROJECT, database: "(default)", namespace: "(default)", location: "europe-west1",
    document, datacontenttype: "application/protobuf",
    traceparent: `00-${"1".repeat(32)}-${"2".repeat(16)}-01`, data};
}

function publicFirestoreTrigger(route, handler, shared = false) {
  const bind = route.created ? onDocumentCreated : onDocumentWritten;
  return bind(`${shared ? "{env}" : "develop"}/plus-collections/${route.collection}/{${route.parameter}}`,
    (event) => {
      // This fixture uses SDK 7.3.2 to decode real protobuf snapshots. Its V1
      // compatibility getters are derived aliases, not CloudEvent wire fields;
      // the deployed 6.3.2 boundary has no such aliases or compatibility symbol.
      // Project only own enumerable data descriptors, without reading getters.
      const descriptors = Object.getOwnPropertyDescriptors(event);
      const getters = Object.entries(descriptors).filter(([, descriptor]) => !("value" in descriptor));
      assert.deepEqual(getters.map(([key]) => key).sort(),
        ["context", route.created ? "snapshot" : "change"].sort());
      assert.ok(getters.every(([, descriptor]) => descriptor.enumerable));
      const projected = Object.fromEntries(Object.entries(descriptors)
        .filter(([, descriptor]) => descriptor.enumerable && "value" in descriptor)
        .map(([key, descriptor]) => [key, descriptor.value]));
      const params = Object.getOwnPropertyDescriptors(projected.params);
      assert.ok(Object.values(params).every((descriptor) => "value" in descriptor));
      projected.params = {...Object.fromEntries(Object.entries(params)
        .map(([key, descriptor]) => [key, descriptor.value])), env: "develop"};
      return handler(projected);
    });
}

test("each handler durably retains its original CloudEvent metadata and real SDK before/after images", async () => {
  for (const route of routes) {
    const value = await sourceEvent(route.entryPoint);
    const encoded = encodeDevelopShiftEvent(PROJECT, route.entryPoint, value.event);
    const captured = await captureDevelopShiftEvent(db, route.entryPoint, value.event);
    assert.equal(captured.duplicate, false);
    const stored = await storedCapture(captured.eventKey);
    assert.equal(stored.bytes.toString("utf8"), encoded.envelope);
    assert.equal(stored.event.get("state"), "retained");
    assert.equal(stored.event.get("replayable"), false);
    assert.equal(stored.event.get("entryPoint"), route.entryPoint);
    assert.equal(stored.event.get("path"), value.reference.path);
    assert.deepEqual(stored.envelope.after.updateTime, [value.after.updateTime.seconds, value.after.updateTime.nanoseconds]);
    assert.deepEqual(stored.envelope.after.createTime, [value.after.createTime.seconds, value.after.createTime.nanoseconds]);
    assert.deepEqual(stored.envelope.after.readTime, [value.after.readTime.seconds, value.after.readTime.nanoseconds]);
    assert.equal(stored.envelope.core.after.readTime, null);
    if (route.created) {
      assert.equal(stored.envelope.before, null);
      assert.equal(stored.envelope.core.before, null);
    }
    else {
      assert.equal(stored.envelope.before.exists, false);
      assert.equal(stored.envelope.before.fields, null);
      assert.equal(stored.envelope.before.updateTime, null);
    }
    const metadata = new Map(stored.envelope.metadata[1]);
    assert.deepEqual(metadata.get("id"), ["string", value.event.id]);
    assert.deepEqual(metadata.get("time"), ["string", value.event.time]);
    assert.deepEqual(metadata.get("traceparent"), ["string", "00-original-causal-trace"]);
    assert.deepEqual(metadata.get("location"), ["string", "europe-west1"]);
    assert.equal(metadata.get("extension")[0], "map");
    assert.equal(metadata.has("data"), false);
    assert.equal(version(await value.reference.get()), version(value.after));
  }
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true,
    captureRevision: 4, eventCount: 4, deliveryCount: 4});
  assert.equal((await db.collection(`${ROOT}/shiftPlanningSyncCommands`).get()).empty, true);
});

test("public Firestore triggers decode raw protobuf local snapshots whose absent read time is retained as null", async () => {
  const cases = [...routes.map((route, index) => ({route, id: `protobuf-${index}`, deleted: false})),
    {route: routes.find((route) => route.entryPoint === "onShiftWritten"), id: "protobuf-create", writtenCreated: true},
    {route: routes.find((route) => route.entryPoint === "onShiftWritten"), id: "protobuf-delete", deleted: true}];
  for (const item of cases) {
    const raw = rawProtobufEvent(item.route, item.id, item);
    let admitted = false;
    const trigger = publicFirestoreTrigger(item.route, async (event) => {
      const snapshots = item.route.created ? [event.data] : [event.data.before, event.data.after];
      for (const snapshot of snapshots) {
        assert.ok(snapshot instanceof DocumentSnapshot);
        assert.throws(() => snapshot.readTime,
          (error) => error.message === "Called 'readTime' on a local document");
      }
      assert.equal(event.params.env, "develop");
      assert.equal(event.params[item.route.parameter], item.id);
      const result = await captureDevelopShiftEvent(db, item.route.entryPoint, event);
      const stored = await storedCapture(result.eventKey);
      const expectedAfterExists = !item.deleted;
      assert.equal(stored.envelope.after.exists, expectedAfterExists);
      assert.equal(stored.envelope.after.readTime, null);
      assert.equal(stored.envelope.core.after.readTime, null);
      if (expectedAfterExists) {
        assert.deepEqual(stored.envelope.after.createTime, [1_700_000_000, 111111111]);
        assert.deepEqual(stored.envelope.after.updateTime, [1_700_000_002, 333333333]);
        assert.deepEqual(new Map(stored.envelope.after.fields[1]).get("at"), ["timestamp", [123, 987654321]]);
      } else {
        assert.equal(stored.envelope.after.fields, null);
        assert.equal(stored.envelope.after.updateTime, null);
      }
      if (item.route.created) assert.equal(stored.envelope.before, null);
      else {
        assert.equal(stored.envelope.before.exists, !item.writtenCreated);
        assert.equal(stored.envelope.before.readTime, null);
        if (item.writtenCreated) {
          assert.equal(stored.envelope.before.fields, null);
          assert.equal(stored.envelope.before.updateTime, null);
        } else assert.deepEqual(stored.envelope.before.updateTime, [1_700_000_002, 222222222]);
      }
      const metadata = new Map(stored.envelope.metadata[1]);
      assert.deepEqual(metadata.get("document"), ["string", raw.document]);
      assert.deepEqual(metadata.get("id"), ["string", raw.id]);
      assert.deepEqual(metadata.get("traceparent"), ["string", raw.traceparent]);
      admitted = true;
    });
    // Call the exported CloudFunction itself with the raw transport payload;
    // its .run shortcut would bypass the broken SDK decoding boundary.
    await trigger(raw);
    assert.equal(admitted, true);
  }
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true,
    captureRevision: 6, eventCount: 6, deliveryCount: 6});
});

test("read-time errors other than the exact SDK-local absence remain unacknowledged and are never swallowed", async () => {
  const route = routes.find((item) => item.entryPoint === "onNotificationEventCreated");
  let localEvent;
  await publicFirestoreTrigger(route, (event) => { localEvent = event; })(rawProtobufEvent(route, "getter-other"));
  assert.ok(localEvent.data instanceof DocumentSnapshot);
  const unrelated = new Error("unexpected_read_time_failure");
  Object.defineProperty(localEvent.data, "readTime", {get() { throw unrelated; }});
  await assert.rejects(captureDevelopShiftEvent(db, route.entryPoint, localEvent), (error) => error === unrelated);
  await emptyJournal();
  const value = await sourceEvent();
  const imitation = snapshotImage(value.after);
  const exactTextOutsideSDK = new Error("Called 'readTime' on a local document");
  Object.defineProperty(imitation, "readTime", {get() { throw exactTextOutsideSDK; }});
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint,
    {...value.event, data: {before: value.before, after: imitation}}), (error) => error === exactTextOutsideSDK);
  await emptyJournal();
});

test("a real committed capture survives acknowledgment loss and an owned fresh client returns it without rewriting evidence", async () => {
  const value = await sourceEvent();
  const original = db.runTransaction;
  db.runTransaction = async function(...args) {
    await original.apply(this, args);
    throw new Error("capture_commit_ack_lost");
  };
  try {
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, value.event), /capture_commit_ack_lost/);
  } finally { db.runTransaction = original; }
  const committed = await journalImage();
  assert.equal((await state()).captureRevision, 1);
  const fresh = createDevelopShiftIntakeDatabase(PROJECT);
  try {
    const recovered = await captureDevelopShiftEvent(fresh, value.route.entryPoint, value.event);
    assert.equal(recovered.duplicate, true);
    assert.deepEqual(await journalImage(), committed);
    assert.equal((await storedCapture(recovered.eventKey)).event.get("replayable"), false);
  } finally { await fresh.terminate(); }
});

test("a failed real transaction cannot acknowledge or leave any journal, delivery or chunk write", async () => {
  const value = await sourceEvent();
  const original = db.runTransaction;
  db.runTransaction = function(update, options) {
    return original.call(this, async (transaction) => {
      await update(transaction);
      throw new Error("capture_commit_rejected");
    }, options);
  };
  let acknowledged = false;
  try {
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, value.event)
      .then(() => { acknowledged = true; }), /capture_commit_rejected/);
  } finally { db.runTransaction = original; }
  assert.equal(acknowledged, false);
  await emptyJournal();
});

test("concurrent duplicate deliveries create exactly one event, delivery and monotonically increasing capture step", async () => {
  const value = await sourceEvent();
  const results = await Promise.all(Array.from({length: 6}, () =>
    captureDevelopShiftEvent(db, value.route.entryPoint, value.event)));
  assert.equal(new Set(results.map((result) => result.eventKey)).size, 1);
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true,
    captureRevision: 1, eventCount: 1, deliveryCount: 1});
  const stored = await storedCapture(results[0].eventKey);
  assert.equal(stored.chunks.length, stored.event.get("chunkCount"));
});

test("a new delivery ID and later SDK read time alias one source version without overwriting the first envelope", async () => {
  const value = await sourceEvent();
  const first = await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const retained = await storedCapture(first.eventKey);
  const alias = {...value.event, id: "alias-delivery-b", time: "2026-10-28T12:35:57.987654321Z",
    data: {before: value.before, after: await value.reference.get()}};
  const second = await captureDevelopShiftEvent(db, value.route.entryPoint, alias);
  assert.equal(second.duplicate, true);
  assert.equal(second.eventKey, first.eventKey);
  assert.equal(second.coreDigest, first.coreDigest);
  assert.equal((await storedCapture(first.eventKey)).bytes.toString("utf8"), retained.bytes.toString("utf8"));
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true,
    captureRevision: 2, eventCount: 1, deliveryCount: 2});
  const delivery = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, alias);
  const row = await db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries").doc(delivery.deliveryKey).get();
  assert.deepEqual(row.get("afterReadTime"), [alias.data.after.readTime.seconds, alias.data.after.readTime.nanoseconds]);
  assert.equal(row.get("eventKey"), first.eventKey);
});

test("same-ID metadata variations are retained losslessly without rewriting the first capture or base delivery", async () => {
  const value = await sourceEvent();
  const first = await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const retained = await storedCapture(first.eventKey), firstImage = await journalImage();
  const variant = {...value.event, traceparent: "another-receiver-trace", extension: {different: true}};
  const next = await captureDevelopShiftEvent(db, value.route.entryPoint, variant);
  const encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, variant);
  const observations = (await db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries").get()).docs;
  const appended = observations.find((doc) => doc.get("schemaVersion") === 2);
  assert.equal(next.eventKey, first.eventKey); assert.equal(next.duplicate, true);
  assert.equal(appended.id, createHash("sha256").update(JSON.stringify({baseDeliveryKey: encoded.deliveryKey,
    metadataDigest: encoded.deliveryDigest})).digest("hex"));
  assert.deepEqual(appended.data(), {schemaVersion: 2, baseDeliveryKey: encoded.deliveryKey,
    eventKey: first.eventKey, digest: encoded.deliveryDigest, ...encoded.delivery});
  assert.deepEqual((await storedCapture(first.eventKey)).bytes, retained.bytes);
  const after = await journalImage();
  for (const original of firstImage.filter((row) => row.path !== DEVELOP_SHIFT_INTAKE_PATH)) {
    assert.deepEqual(after.find((row) => row.path === original.path), original);
  }
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true, captureRevision: 2, eventCount: 1, deliveryCount: 2});
  const stable = await journalImage();
  await captureDevelopShiftEvent(db, value.route.entryPoint,
    {...variant, data: {before: value.before, after: await value.reference.get()}});
  assert.deepEqual(await journalImage(), stable);
});

test("same-ID changed CloudEvent time remains a diagnostic conflict without modifying retained metadata", async () => {
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const retained = await journalImage();
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint,
    {...value.event, time: "2026-10-28T12:34:57.123456789Z"}), hasCode("delivery_identity_conflict"));
  assert.deepEqual(await journalImage(), retained);
});

test("same CloudEvent ID for another source version remains a rejected delivery identity", async () => {
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const retained = await journalImage();
  await value.reference.update({assignedUserIds: ["b", "a"]});
  const next = cloudEvent(value.route, value.after, await value.reference.get(), value.event.id);
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, next), hasCode("delivery_event_key_conflict"));
  assert.deepEqual(await journalImage(), retained);
});

test("conflicting fields for an already captured source version remain unacknowledged even under another delivery ID", async () => {
  const value = await sourceEvent();
  const first = await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const retained = await journalImage();
  const conflict = {...value.event, id: "different-id-conflicting-image", data: {before: value.before,
    after: snapshotImage(value.after, {data: () => ({...value.after.data(), assignedUserIds: ["tampered"]})})}};
  const encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, conflict);
  assert.equal(encoded.eventKey, first.eventKey);
  assert.notEqual(encoded.coreDigest, first.coreDigest);
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, conflict), hasCode("event_core_conflict"));
  assert.deepEqual(await journalImage(), retained);
});

test("both public SDK path patterns retain four same-ID metadata observations after real protobuf decoding", async () => {
  for (const route of routes) {
    const input = rawProtobufEvent(route, `overlap-${route.collection}`);
    const retain = (event) => captureDevelopShiftEvent(db, route.entryPoint, event);
    const shared = publicFirestoreTrigger(route, retain, true), fixed = publicFirestoreTrigger(route, retain);
    await shared({...input, traceparent: "shared-delivery-context"});
    const original = await journalImage();
    await fixed({...input, traceparent: "private-delivery-context", deliveryExtension: {preserved: true}});
    const after = await journalImage();
    for (const row of original.filter((row) => row.path !== DEVELOP_SHIFT_INTAKE_PATH)) {
      assert.deepEqual(after.find((item) => item.path === row.path), row);
    }
  }
  const deliveries = (await db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries").get()).docs;
  assert.equal(deliveries.filter((doc) => doc.get("schemaVersion") === 1).length, 4);
  assert.equal(deliveries.filter((doc) => doc.get("schemaVersion") === 2).length, 4);
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true, captureRevision: 8, eventCount: 4, deliveryCount: 8});
});

test("concurrent distinct metadata observations and exact retries advance only once per observation", async () => {
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const events = [1, 2].map((attempt) => ({...value.event, extension: {attempt}, traceparent: `trace-${attempt}`}));
  await Promise.all(events.flatMap((event) => Array.from({length: 3}, () =>
    captureDevelopShiftEvent(db, value.route.entryPoint, event))));
  assert.deepEqual(await state(), {schemaVersion: 1, legacyUntracked: true, captureRevision: 3, eventCount: 1, deliveryCount: 3});
});

test("a metadata observation committed before lost ACK is recovered without another write", async () => {
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const variant = {...value.event, traceparent: "retained-before-lost-ack"}, original = db.runTransaction;
  db.runTransaction = async function(...args) { await original.apply(this, args); throw new Error("observation_ack_lost"); };
  try {
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, variant), /observation_ack_lost/);
  } finally { db.runTransaction = original; }
  const committed = await journalImage();
  assert.equal((await state()).deliveryCount, 2);
  const fresh = createDevelopShiftIntakeDatabase(PROJECT);
  try {
    assert.equal((await captureDevelopShiftEvent(fresh, value.route.entryPoint, variant)).duplicate, true);
    assert.deepEqual(await journalImage(), committed);
  } finally { await fresh.terminate(); }
});

test("an observation transaction failure cannot ACK, change counters or leave a partial observation", async () => {
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const retained = await journalImage(), original = db.runTransaction;
  db.runTransaction = function(update, options) { return original.call(this, async (tx) => {
    await update(tx); throw new Error("observation_not_committed");
  }, options); };
  try {
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint,
      {...value.event, traceparent: "uncommitted"}), /observation_not_committed/);
  } finally { db.runTransaction = original; }
  assert.deepEqual(await journalImage(), retained);
});

test("every retained immutable identity field is bound to its base delivery key and incoming event", async () => {
  const value = await sourceEvent();
  const encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, value.event);
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const base = db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries").doc(encoded.deliveryKey), original = (await base.get()).data();
  for (const name of ["id", "source", "type", "subject", "time", "specversion"]) {
    const metadataWire = JSON.parse(original.metadata);
    metadataWire[1].find(([key]) => key === name)[1][1] = name === "time" ? "2026-10-28T12:34:57Z" : `changed-${name}`;
    const digest = createHash("sha256").update(JSON.stringify({coreDigest: encoded.coreDigest, metadataWire})).digest("hex");
    await base.set({...original, metadata: JSON.stringify(metadataWire), digest});
    const retained = await journalImage();
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint,
      {...value.event, traceparent: "candidate"}), hasCode(["id", "source"].includes(name) ?
      "delivery_record_invalid" : "delivery_identity_conflict"));
    assert.deepEqual(await journalImage(), retained);
    await base.set(original);
  }
});

test("corrupted base metadata, digest, scope or schema cannot authorize a new observation", async () => {
  const value = await sourceEvent(), encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, value.event);
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const base = db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries").doc(encoded.deliveryKey), original = (await base.get()).data();
  for (const patch of [{digest: "f".repeat(64)}, {metadata: "[]"}, {metadata: original.metadata + " "},
    {schemaVersion: 2}, {unexpected: true}, {beforeReadTime: [1, 1e9]}]) {
    await base.set({...original, ...patch});
    const retained = await journalImage();
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint,
      {...value.event, traceparent: "candidate"}), hasCode("delivery_record_invalid"));
    assert.deepEqual(await journalImage(), retained);
    await base.set(original);
  }
});

test("orphaned or contradictory v2 rows remain unacknowledged and never repair themselves", async () => {
  const value = await sourceEvent(), variant = {...value.event, traceparent: "private-observation"};
  const encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, variant);
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  await captureDevelopShiftEvent(db, value.route.entryPoint, variant);
  const deliveries = db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries"),
    base = deliveries.doc(encoded.deliveryKey), rows = (await deliveries.get()).docs,
    observation = rows.find((doc) => doc.get("schemaVersion") === 2).ref;
  const baseData = (await base.get()).data(), observationData = (await observation.get()).data();
  for (const patch of [{baseDeliveryKey: "f".repeat(64)}, {eventKey: "f".repeat(64)},
    {digest: "f".repeat(64)}, {metadata: baseData.metadata}, {afterReadTime: "invalid"}]) {
    await observation.set({...observationData, ...patch});
    const retained = await journalImage();
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, variant), (error) =>
      ["delivery_record_invalid", "delivery_observation_conflict"].includes(error.code));
    assert.deepEqual(await journalImage(), retained);
  }
  await observation.set(observationData); await base.delete();
  const orphan = await journalImage();
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, variant), hasCode("intake_state_invalid"));
  assert.deepEqual(await journalImage(), orphan);
});

test("a fabricated v2 row identical to its v1 base cannot manufacture a second observation", async () => {
  const value = await sourceEvent(), encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, value.event);
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const key = createHash("sha256").update(JSON.stringify({baseDeliveryKey: encoded.deliveryKey,
    metadataDigest: encoded.deliveryDigest})).digest("hex");
  await db.doc(DEVELOP_SHIFT_INTAKE_PATH).collection("deliveries").doc(key).create({schemaVersion: 2,
    baseDeliveryKey: encoded.deliveryKey, eventKey: encoded.eventKey, digest: encoded.deliveryDigest, ...encoded.delivery});
  const retained = await journalImage();
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, value.event), hasCode("delivery_observation_conflict"));
  assert.deepEqual(await journalImage(), retained);
});

test("inconsistent five-field root counters cannot ACK an existing delivery or append an observation", async () => {
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const control = db.doc(DEVELOP_SHIFT_INTAKE_PATH), original = (await control.get()).data();
  for (const patch of [{captureRevision: 2}, {eventCount: 2}]) {
    await control.set({...original, ...patch});
    const retained = await journalImage();
    for (const event of [value.event, {...value.event, traceparent: "new-observation"}]) {
      await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, event), hasCode("intake_state_invalid"));
      assert.deepEqual(await journalImage(), retained);
    }
  }
});

test("written creation and deletion keep absent images distinct and preserve the original SDK timestamp precision", async () => {
  const value = await sourceEvent("onShiftWritten", {at: new Timestamp(123, 987654321)});
  const created = await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const createdEnvelope = (await storedCapture(created.eventKey)).envelope;
  assert.equal(createdEnvelope.before.exists, false);
  const actualTimestamp = value.after.get("at");
  assert.deepEqual(new Map(createdEnvelope.after.fields[1]).get("at"),
    ["timestamp", [actualTimestamp.seconds, actualTimestamp.nanoseconds]]);
  // Firestore storage may truncate sub-microsecond input. The encoder must
  // retain nine digits when they are present in the value actually supplied.
  assert.deepEqual(encodeDevelopShiftValue(new Timestamp(123, 987654321)), ["timestamp", [123, 987654321]]);
  await value.reference.delete();
  const missing = await value.reference.get();
  const deletion = cloudEvent(value.route, value.after, missing, "delete-delivery");
  const deleted = await captureDevelopShiftEvent(db, value.route.entryPoint, deletion);
  const deletedEnvelope = (await storedCapture(deleted.eventKey)).envelope;
  assert.equal(deletedEnvelope.before.exists, true);
  assert.equal(deletedEnvelope.after.exists, false);
  assert.equal(deletedEnvelope.after.fields, null);
  assert.equal(deletedEnvelope.after.updateTime, null);
  assert.deepEqual(deletedEnvelope.before.updateTime, [value.after.updateTime.seconds, value.after.updateTime.nanoseconds]);
  const nanos = (amount) => ({...value.event, data: {before: value.before,
    after: snapshotImage(value.after, {updateTime: new Timestamp(value.after.updateTime.seconds, amount)})}});
  assert.notEqual(encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, nanos(123456781)).eventKey,
    encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, nanos(123456782)).eventKey);
  assert.notEqual(created.eventKey, deleted.eventKey);
  assert.equal((await state()).eventCount, 2);
});

test("real SDK values and direct signed-zero input retain their distinct wire types without map impersonation", async () => {
  const value = await sourceEvent("onShiftWritten", {at: new Timestamp(45, 123456789),
    location: new GeoPoint(37.1773, -3.5986), binary: Buffer.from([0, 255, 15]),
    vector: FieldValue.vector([0.125, -2, 3]), numbers: [NaN, Infinity, -Infinity, -0],
    spoof: {type: "timestamp", value: [45, 123456789]}, nested: [null, true, "retained"]});
  const captured = await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const fields = new Map((await storedCapture(captured.eventKey)).envelope.after.fields[1]);
  const actualTimestamp = value.after.get("at");
  assert.deepEqual(fields.get("at"), ["timestamp", [actualTimestamp.seconds, actualTimestamp.nanoseconds]]);
  assert.deepEqual(fields.get("location"), ["geopoint", 37.1773, -3.5986]);
  assert.deepEqual(fields.get("binary"), ["bytes", "AP8P"]);
  assert.deepEqual(value.after.get("vector").toArray(), [0.125, -2, 3]);
  assert.deepEqual(fields.get("vector"), ["vector", [["number", "0.125"], ["number", "-2"], ["number", "3"]]]);
  const actualZero = value.after.get("numbers")[3];
  assert.ok(actualZero === 0);
  assert.deepEqual(fields.get("numbers"), ["array", [["number", "NaN"], ["number", "Infinity"],
    ["number", "-Infinity"], ["number", Object.is(actualZero, -0) ? "-0" : "0"]]]);
  assert.deepEqual(fields.get("nested"), ["array", [["null"], ["boolean", true], ["string", "retained"]]]);
  assert.equal(fields.get("spoof")[0], "map");
  assert.deepEqual(new Map(fields.get("spoof")[1]).get("type"), ["string", "timestamp"]);
  assert.deepEqual(encodeDevelopShiftValue(-0), ["number", "-0"]);
});

test("a DocumentReference in a real source snapshot fails without acknowledgment rather than losing its project identity", async () => {
  const value = await sourceEvent("onShiftWritten", {reference: db.doc(`${ROOT}/users/referenced-member`)});
  assert.throws(() => encodeDevelopShiftValue(value.after.get("reference")), hasCode("reference_value_unsupported"));
  await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, value.event), hasCode("reference_value_unsupported"));
  await emptyJournal();
  assert.equal(value.after.get("reference").path, `${ROOT}/users/referenced-member`);
});

test("large Unicode payload chunks commit atomically and reconstruct the exact original UTF-8 envelope", async () => {
  const value = await sourceEvent("onShiftWritten", {description: "á🧺".repeat(80_000)});
  const encoded = encodeDevelopShiftEvent(PROJECT, value.route.entryPoint, value.event);
  const captured = await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  const stored = await storedCapture(captured.eventKey);
  const bytes = Buffer.from(encoded.envelope);
  assert.ok(stored.chunks.length > 1);
  assert.equal(stored.chunks.length, Math.ceil(bytes.length / (200 * 1024)));
  assert.deepEqual(stored.chunks.map((chunk) => chunk.id), stored.chunks.map((_, index) => String(index)));
  assert.ok(stored.chunks.every((chunk) => chunk.get("bytes").length <= 200 * 1024));
  assert.deepEqual(stored.bytes, bytes);
  assert.equal(stored.event.get("envelopeDigest"), createHash("sha256").update(bytes).digest("hex"));
  assert.deepEqual(new Map(stored.envelope.after.fields[1]).get("description"), ["string", value.after.get("description")]);
});

test("accessor metadata and user-value getters are rejected without invoking them or writing the intake", async () => {
  const value = await sourceEvent();
  let invoked = 0;
  for (const mutate of [
    (event) => Object.defineProperty(event, "id", {enumerable: true, get() { invoked += 1; return "hidden"; }}),
    (event) => Object.defineProperty(event, "extension", {enumerable: true, get() { invoked += 1; return "hidden"; }}),
    (event) => Object.defineProperty(event.params, "env", {enumerable: true, get() { invoked += 1; return "develop"; }}),
  ]) {
    const event = {...value.event, params: {...value.event.params}};
    mutate(event);
    await assert.rejects(captureDevelopShiftEvent(db, value.route.entryPoint, event), hasCode("invalid_field"));
  }
  const mapped = {};
  Object.defineProperty(mapped, "hidden", {enumerable: true, get() { invoked += 1; return "hidden"; }});
  assert.throws(() => encodeDevelopShiftValue(mapped), hasCode("invalid_field"));
  assert.throws(() => encodeDevelopShiftValue({toJSON() { invoked += 1; return "lossy"; }}), hasCode("invalid_object"));
  assert.equal(invoked, 0);
  await emptyJournal();
});

test("wrong environment, source, entry point, document path and oversized metadata fail before any database IO", async () => {
  const value = await sourceEvent();
  const originalDoc = db.doc, originalTransaction = db.runTransaction;
  let touched = 0;
  db.doc = () => { touched += 1; throw new Error("unexpected_database_io"); };
  db.runTransaction = () => { touched += 1; throw new Error("unexpected_database_io"); };
  try {
    for (const [entryPoint, event, code] of [
      ["onShiftWritten", {...value.event, params: {...value.event.params, env: "production"}}, "event_identity_invalid"],
      ["onShiftWritten", {...value.event, source: "//firestore.googleapis.com/projects/another-project/databases/(default)"},
        "event_identity_invalid"],
      ["onShiftWritten", {...value.event, params: {...value.event.params, shiftId: "another-document"}}, "event_path_invalid"],
      ["onShiftWritten", {...value.event, subject: "documents/production/plus-collections/shifts/source-a"}, "event_path_invalid"],
      ["onShiftWritten", {...value.event, type: "google.cloud.firestore.document.v1.created"}, "event_type_invalid"],
      ["__proto__", value.event, "invalid_entry_point"],
      ["onShiftWritten", {...value.event, extension: "x".repeat(270_000)}, "event_payload_too_large"],
    ]) {
      await assert.rejects(captureDevelopShiftEvent(db, entryPoint, event), hasCode(code));
    }
    assert.equal(touched, 0);
  } finally { db.doc = originalDoc; db.runTransaction = originalTransaction; }
  await emptyJournal();
});

test("the intake factory rejects an unapproved project or host and does not trust an injected SDK client", async () => {
  for (const project of ["reguerta-9f27f", "demo-other-app", "another-live-project"]) {
    assert.throws(() => createDevelopShiftIntakeDatabase(project), hasCode("intake_database_invalid"));
  }
  const previousHost = process.env.FIRESTORE_EMULATOR_HOST;
  try {
    process.env.FIRESTORE_EMULATOR_HOST = "192.0.2.1:8897";
    assert.throws(() => createDevelopShiftIntakeDatabase(PROJECT), hasCode("intake_database_invalid"));
    delete process.env.FIRESTORE_EMULATOR_HOST;
    assert.throws(() => createDevelopShiftIntakeDatabase(PROJECT), hasCode("intake_database_invalid"));
  } finally { process.env.FIRESTORE_EMULATOR_HOST = previousHost; }
  const value = await sourceEvent();
  const unowned = new Firestore({projectId: PROJECT, host: HOST, ssl: false});
  let touched = 0;
  unowned.doc = () => { touched += 1; throw new Error("unowned_database_io"); };
  unowned.runTransaction = () => { touched += 1; throw new Error("unowned_database_io"); };
  try {
    await assert.rejects(captureDevelopShiftEvent(unowned, value.route.entryPoint, value.event), hasCode("intake_database_invalid"));
    await assert.rejects(inspectDevelopShiftIntake(unowned), hasCode("intake_database_invalid"));
    assert.equal(touched, 0);
  } finally { await unowned.terminate(); }
  await emptyJournal();
});

test("later capture revisions never qualify untracked old operations or grant closure and write authority", async () => {
  const legacy = db.doc(`${ROOT}/shiftPlanningOperations/old-untracked-effect`);
  await legacy.create({state: "unknown", pendingExternalEffect: true});
  const legacyBefore = await legacy.get();
  const empty = await inspectDevelopShiftIntake(db);
  assert.equal(empty.state, null);
  assert.equal(empty.legacyUntracked, true);
  assert.equal(empty.canClaimClosure, false);
  assert.equal(empty.canApply, false);
  const value = await sourceEvent();
  await captureDevelopShiftEvent(db, value.route.entryPoint, value.event);
  await captureDevelopShiftEvent(db, value.route.entryPoint, {...value.event, id: "later-delivery"});
  const inspectionBefore = await journalImage();
  const inspected = await inspectDevelopShiftIntake(db);
  assert.equal(inspected.state.captureRevision, 2);
  assert.equal(inspected.state.legacyUntracked, true);
  assert.equal(inspected.legacyUntracked, true);
  assert.equal(inspected.canClaimClosure, false);
  assert.equal(inspected.canApply, false);
  assert.deepEqual(await journalImage(), inspectionBefore);
  const legacyAfter = await legacy.get();
  assert.deepEqual(legacyAfter.data(), legacyBefore.data());
  assert.equal(version(legacyAfter), version(legacyBefore));
});
