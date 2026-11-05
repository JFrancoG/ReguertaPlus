const {test, beforeEach, afterEach, after} = require("node:test");
const assert = require("node:assert/strict");
const {Firestore, Timestamp, FieldValue} = require("@google-cloud/firestore");
const {loadExactLegacy} = require("./develop-legacy-pause-rehearsal-vm.cjs");
const {createDevelopLegacyPauseRehearsal} = require("../lib/develop-legacy-pause-rehearsal.js");
const {captureShiftPlanningWriterAuthorityFromReference,
  assertShiftPlanningWriterAuthorityInTransaction} =
  require("../lib/shift-planning-writer-authority.js");
const {parseShiftPlanningIntakeBarrierEvidenceEnvelope} =
  require("../lib/shift-planning-intake-barrier.js");
const {createHandoffFixture, eventWire, wire, stamp, ROOT, STATE, SOURCE,
  PROJECT, digest, manifestOf} =
  require("./develop-backend-handoff-helper.cjs");
assert.equal(process.env.GCLOUD_PROJECT, PROJECT);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
const db = new Firestore({projectId: PROJECT, host: "127.0.0.1:8897", ssl: false});
const shiftPath = "develop/plus-collections/shifts/shift-a";
const noticePath = "develop/plus-collections/notificationEvents/notice-a";
const date = Timestamp.fromDate(new Date("2027-01-06T00:00:00Z"));
const openState = {schemaVersion: 1, stateRevision: 7, writeEpoch: 3,
  maintenanceStatus: "open", activeRevision: "bundle-demo", activeDigest: digest({bundle: 1}),
  intakeBarrier: null, lastTransitionId: "fixture-initialization"};
let fixture, pause, beforeSnapshots;
beforeEach(async () => {
  for (const path of [ROOT, "develop/plus-collections", "shiftWriterPauses/develop"]) {
    await db.recursiveDelete(db.doc(path));
  }
  beforeSnapshots = new Map();
  fixture = createHandoffFixture(); pause = createDevelopLegacyPauseRehearsal();
});
afterEach(async () => { await fixture.dispose(); await pause.dispose(); });
after(async () => { await db.terminate(); });
async function seed() {
  beforeSnapshots.set(shiftPath, await db.doc(shiftPath).get());
  beforeSnapshots.set(noticePath, await db.doc(noticePath).get());
  await db.doc(STATE).set(openState);
  await db.doc("develop/plus-collections/users/a").set({
    displayName: "Member A", isActive: true, roles: ["member"], phone: "600000001",
  });
  await db.doc("develop/plus-collections/users/a/devices/one").set({fcmToken: "demo-token"});
  await db.doc(shiftPath).set({type: "delivery", date, assignedUserIds: ["a"],
    helperUserId: null, source: "app", status: "confirmed"});
  await db.doc(noticePath).set({title: "Demo", body: "Demo notice", type: "shift_updated",
    target: "users", targetPayload: {userIds: ["a"]}});
}
async function makeEvent(entryPoint, path = shiftPath, id = "delivery-1") {
  const after = await db.doc(path).get();
  const before = beforeSnapshots.get(path);
  if (!before) throw Error("fixture_before_snapshot_missing");
  return {id, time: after.updateTime.toDate().toISOString(), source: SOURCE,
    subject: `documents/${path}`, type: entryPoint.endsWith("Created") ?
      "google.cloud.firestore.document.v1.created" : "google.cloud.firestore.document.v1.written",
    params: {env: "develop", shiftId: path.split("/").at(-1), eventId: path.split("/").at(-1)},
    data: entryPoint.endsWith("Created") ? after : {before, after}};
}
async function assess(manifest) {
  return fixture.assess(manifest || await fixture.freezeManifest());
}
// A deliberately small fixture command uses the actual epoch/revision CAS. It is
// not the production Sheets worker or proof of exclusive external authority.
async function commitProjection(commandId, authority, manifest) {
  const projectionPath = `${ROOT}/projections/current`;
  await db.runTransaction(async (tx) => {
    const events = await tx.get(db.collection(`${ROOT}/events`));
    if (manifestOf(events) !== manifest) throw Error("capture_manifest_changed");
    await assertShiftPlanningWriterAuthorityInTransaction({transaction: tx,
      stateReference: db.doc(STATE), capturedValue: authority,
      changedCode: "authority_changed", changedMessage: "authority_changed"});
    if (!authority) throw Error("authority_missing");
    const source = await tx.get(db.doc(shiftPath));
    const projection = {assignedUserIds: source.get("assignedUserIds"),
      date: source.get("date"), sourcePath: shiftPath};
    tx.set(db.doc(projectionPath), projection);
    tx.create(db.doc(`${ROOT}/commands/${commandId}`), {
      kind: "closedDemoProjectionCommand", state: "committed", authority,
      sourcePath: shiftPath, sourceDigest: digest(wire(source.data())),
      sourceVersionDigest: digest(stamp(source.updateTime)), projectionPath,
      projectionDigest: digest(wire(projection)),
    });
  });
}
function heldPort() {
  let finish, entered;
  const admitted = new Promise((resolve) => { entered = resolve; });
  const waiting = new Promise((resolve) => { finish = resolve; });
  return {admitted, release: finish, wait: {then(resolve, reject) {
    entered(); return waiting.then(resolve, reject);
  }}};
}

test("a real capture commit survives lost acknowledgment; recovery preserves full original wire", async () => {
  await seed(); await fixture.initializeUniverse();
  const event = await makeEvent("onShiftWritten");
  event.traceparent = "00-demo-extension";
  const envelope = eventWire("onShiftWritten", event);
  const runTransaction = Firestore.prototype.runTransaction;
  let faultArmed = true;
  Firestore.prototype.runTransaction = async function(...args) {
    const result = await runTransaction.apply(this, args);
    if (faultArmed) { faultArmed = false; throw Error("transaction_commit_ack_lost"); }
    return result;
  };
  try {
    await assert.rejects(fixture.capture(envelope), /transaction_commit_ack_lost/);
  } finally { Firestore.prototype.runTransaction = runTransaction; }
  const persisted = (await db.collection(`${ROOT}/events`).get()).docs[0];
  const first = {acknowledgeable: true, eventKey: persisted.id,
    coreDigest: persisted.get("coreDigest")};
  assert.deepEqual(persisted.get("envelope"), envelope);
  assert.equal(persisted.get("envelope.event.traceparent"), "00-demo-extension");
  assert.ok(persisted.get("envelope.after.updateTime"));
  assert.ok(persisted.get("envelope.after.createTime"));
  assert.ok(persisted.get("envelope.after.readTime"));
  const recovered = createHandoffFixture();
  assert.deepEqual(await recovered.capture(envelope), first);
  const reread = structuredClone(envelope);
  reread.after.readTime.nanoseconds += 1;
  assert.deepEqual(await recovered.capture(reread), first);
  const alias = structuredClone(envelope); alias.event.id = "another-subscription-delivery";
  assert.equal((await recovered.capture(alias)).eventKey, first.eventKey);
  assert.equal((await db.collection(`${ROOT}/events`).get()).size, 1);
  assert.equal((await db.collection(`${ROOT}/deliveries`).get()).size, 2);
  const conflicting = structuredClone(envelope);
  conflicting.after.fields.assignedUserIds = ["different-member"];
  await assert.rejects(recovered.capture(conflicting), {code: "event_payload_conflict"});
  assert.deepEqual((await db.doc(`${ROOT}/events/${first.eventKey}`).get()).data(), persisted.data());
  const unsupported = {...event, extension: new Date()};
  assert.throws(() => eventWire("onShiftWritten", unsupported), {code: "unsupported_wire_value"});
  assert.equal((await db.collection(`${ROOT}/events`).get()).size, 1);
  await recovered.dispose();
});

test("an old exact callback predates the pause journal; unknown history remains held after it settles", async () => {
  await seed(); await fixture.initializeUniverse(["old-export"]);
  const held = heldPort();
  const legacy = loadExactLegacy(db, {waitPort: "sheets.values.update", wait: held.wait});
  const running = fixture.observeOld("old-export", legacy, () =>
    legacy.handlers.exportShiftsToGoogleSheets({query: {env: "develop"}}, {
      status() { return this; }, json() {},
    }));
  await held.admitted; // The exact old callback predates the new pause journal.
  await pause.initializeOpen(); await pause.pause();
  assert.equal((await pause.assess()).state.active, 0);
  assert.ok((await assess()).blockers.includes("old_operation_running"));
  held.release(); await running; // The old callback resumes after the new pause.
  const oldTerminal = await db.doc(`${ROOT}/oldTerminals/old-export`).get();
  assert.equal(oldTerminal.get("status"), "settled");
  assert.ok(legacy.trace.some((entry) => entry.port === "logger.info"));
  await fixture.retainUnknown("pre-capture-history");
  assert.ok((await assess()).blockers.includes("unknown_old_history"));
  const packet = await assess();
  assert.equal(packet.physicalHandoffReady, false);
  assert.ok(packet.requiredExternalProofs.includes("owner_and_workbook_fence"));
  assert.equal(packet.legacyUntracked, true);
  assert.equal((await pause.assess()).state.legacyUntracked, true);
});

test("a recording provider commits an accepted request after the old callback has terminated", async () => {
  await seed(); await fixture.initializeUniverse(["old-shift"]);
  let accept, release;
  const accepted = new Promise((resolve) => { accept = resolve; });
  const commitLater = new Promise((resolve) => { release = resolve; });
  const childPath = "develop/plus-collections/notificationEvents/auto_1";
  beforeSnapshots.set(childPath, await db.doc(childPath).get());
  const decode = (value) => value === "<field-transform>" ? FieldValue.serverTimestamp() :
    Array.isArray(value) ? value.map(decode) : value && typeof value === "object" ?
      Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)])) : value;
  let remoteCommit;
  const legacy = loadExactLegacy(db, {waitPort: "firestore.create", wait: {
    then(_resolve, reject) {
      return Promise.resolve().then(async () => {
        const submission = legacy.trace.find((item) => item.port === "firestore.create");
        await db.doc(`${ROOT}/externalAccepted/old-notice`).create({
          operationId: "old-shift", submissionDigest: digest(submission), targetPath: submission.args.path,
        });
        // Test-only provider accepts the exact recorded arguments, then commits
        // independently after the callback's response window has failed.
        remoteCommit = commitLater.then(async () => {
          await db.doc(submission.args.path).create(decode(submission.args.args[0]));
          const current = await db.doc(submission.args.path).get();
          await db.doc(`${ROOT}/externalTerminals/old-notice`).create({
            committed: true, submissionDigest: digest(submission), targetPath: submission.args.path,
            afterImageDigest: digest(wire(current.data())),
            afterVersionDigest: digest(stamp(current.updateTime)),
          });
        });
        accept(); reject(Error("recording_provider_response_lost"));
      });
    },
  }});
  const event = await makeEvent("onShiftWritten");
  event.data.after = await legacy.snapshot(shiftPath);
  const failure = assert.rejects(fixture.observeOld("old-shift", legacy,
    () => legacy.handlers.onShiftWritten(event)), /recording_provider_response_lost/);
  await accepted; await failure;
  await pause.initializeOpen(); await pause.pause();
  assert.equal((await pause.assess()).state.active, 0);
  assert.equal((await db.doc(childPath).get()).exists, false);
  const pending = await assess();
  assert.ok(pending.blockers.includes("old_operation_uncertain"));
  assert.ok(pending.blockers.includes("external_request_pending"));
  release(); await remoteCommit;
  assert.equal((await db.doc(childPath).get()).get("type"), "shift_updated");
  await fixture.capture(eventWire("onNotificationEventCreated",
    await makeEvent("onNotificationEventCreated", childPath, "late-child")));
  const after = await assess();
  assert.ok(after.blockers.includes("old_operation_uncertain"));
  assert.ok(after.blockers.includes("event_unreconciled"));
  assert.equal(after.knownFixtureReconciliationReady, false);
});

test("lost FCM acknowledgment is retained as possibly delivered without retry or a replacement notice", async () => {
  await seed(); await fixture.initializeUniverse(["old-fcm"]);
  const event = await makeEvent("onNotificationEventCreated", noticePath);
  const captured = await fixture.capture(eventWire("onNotificationEventCreated", event));
  const legacy = loadExactLegacy(db, {loseAckPort: "fcm.sendEachForMulticast"});
  event.data = await legacy.snapshot(noticePath);
  await assert.rejects(fixture.observeOld("old-fcm", legacy,
    () => legacy.handlers.onNotificationEventCreated(event), captured.eventKey), /synthetic_ack_lost/);
  assert.equal((await db.doc(noticePath).get()).get("dispatch"), undefined);
  const record = {id: "fcm-uncertain", kind: "possiblyDelivered",
    coreDigest: captured.coreDigest, evidence: {operationId: "old-fcm"}};
  await fixture.appendDisposition(captured.eventKey, record);
  await fixture.appendDisposition(captured.eventKey, record);
  await assert.rejects(fixture.appendDisposition(captured.eventKey,
    {...record, evidence: {operationId: "another-operation"}}), {code: "disposition_conflict"});
  await assert.rejects(fixture.appendDisposition(captured.eventKey,
    {...record, kind: "reconciledCurrentProjection", evidence: {commandId: "fake"}}),
  {code: "disposition_readback_invalid"});
  for (const kind of ["replayLegacy", "resendNotification"]) {
    await assert.rejects(fixture.appendDisposition(captured.eventKey, {...record, kind}),
      {code: "replay_forbidden"});
  }
  const packet = await assess();
  assert.ok(packet.blockers.includes("old_operation_uncertain"));
  assert.ok(packet.blockers.includes("event_possiblyDelivered"));
  assert.equal(legacy.mutations.filter((port) => port === "fcm.sendEachForMulticast").length, 1);
  assert.equal((await db.collection("develop/plus-collections/notificationEvents").get()).size, 1);
  assert.equal((await db.collection(`${ROOT}/dispositions`).get()).size, 1);
});

test("known demo universe reconciles current state through initialized existing CAS; stale input cannot overwrite it", async () => {
  await seed(); await fixture.initializeUniverse();
  await pause.initializeOpen(); await pause.pause();
  const oldEvent = await makeEvent("onShiftWritten");
  const captured = await fixture.capture(eventWire("onShiftWritten", oldEvent));
  await db.doc(shiftPath).update({assignedUserIds: ["current-member"]});
  const manifest = await fixture.freezeManifest();
  const authority = await captureShiftPlanningWriterAuthorityFromReference(db.doc(STATE));
  await commitProjection("reconcile-current", authority, manifest);
  await fixture.appendDisposition(captured.eventKey, {id: "projection-current",
    kind: "reconciledCurrentProjection", coreDigest: captured.coreDigest,
    evidence: {commandId: "reconcile-current"}});
  const packet = await assess(manifest);
  assert.equal(packet.knownFixtureReconciliationReady, true);
  assert.equal(packet.canApply, false);
  assert.equal(packet.canClaimClosure, false);
  assert.equal(packet.physicalHandoffReady, false);
  assert.throws(() => parseShiftPlanningIntakeBarrierEvidenceEnvelope(packet));
  const projection = db.doc(`${ROOT}/projections/current`);
  assert.deepEqual((await projection.get()).get("assignedUserIds"), ["current-member"]);
  assert.equal((await db.collection("develop/plus-collections/notificationEvents").get()).size, 1);
  await db.doc(STATE).update({writeEpoch: 4, stateRevision: 8, activeRevision: "bundle-next",
    activeDigest: digest({bundle: 2})});
  await assert.rejects(commitProjection("stale-command", authority, manifest), {code: "authority_changed"});
  assert.equal((await db.doc(`${ROOT}/commands/stale-command`).get()).exists, false);
  assert.deepEqual((await projection.get()).get("assignedUserIds"), ["current-member"]);
  assert.equal((await assess(manifest)).knownFixtureReconciliationReady, false);
  assert.equal((await db.doc(STATE).get()).get("activeRevision"), "bundle-next");
  assert.equal((await pause.assess()).state.mode, "paused");
});

test("a newly captured event invalidates the frozen manifest before any projection write", async () => {
  await seed(); await fixture.initializeUniverse();
  const original = await fixture.capture(eventWire("onShiftWritten", await makeEvent("onShiftWritten")));
  const frozen = await fixture.freezeManifest();
  beforeSnapshots.set(shiftPath, await db.doc(shiftPath).get());
  await db.doc(shiftPath).update({assignedUserIds: ["new-version"]});
  await fixture.capture(eventWire("onShiftWritten", await makeEvent("onShiftWritten", shiftPath, "new-delivery")));
  const authority = await captureShiftPlanningWriterAuthorityFromReference(db.doc(STATE));
  await assert.rejects(commitProjection("phantom-command", authority, frozen), /capture_manifest_changed/);
  assert.ok((await assess(frozen)).blockers.includes("capture_manifest_changed"));
  assert.equal((await db.doc(`${ROOT}/projections/current`).get()).exists, false);
  assert.equal((await db.doc(`${ROOT}/events/${original.eventKey}`).get()).exists, true);
});

test("missing authority cannot obtain the legacy both-null compatibility bypass", async () => {
  await fixture.initializeUniverse();
  const manifest = await fixture.freezeManifest();
  const authority = await captureShiftPlanningWriterAuthorityFromReference(db.doc(STATE));
  assert.equal(authority, null);
  await assert.rejects(commitProjection("missing-authority", authority, manifest), /authority_missing/);
  assert.ok((await assess()).blockers.includes("authority_unavailable"));
  assert.equal((await db.doc(`${ROOT}/commands/missing-authority`).get()).exists, false);
});

test("completed legacy notification is bound to its exact retained payload and terminal afterimage", async () => {
  await seed(); await fixture.initializeUniverse(["completed-notice"]);
  const event = await makeEvent("onNotificationEventCreated", noticePath);
  const captured = await fixture.capture(eventWire("onNotificationEventCreated", event));
  const legacy = loadExactLegacy(db);
  event.data = await legacy.snapshot(noticePath);
  await fixture.observeOld("completed-notice", legacy,
    () => legacy.handlers.onNotificationEventCreated(event), captured.eventKey);
  await fixture.appendDisposition(captured.eventKey, {id: "notice-completed",
    kind: "legacyCompleted", coreDigest: captured.coreDigest,
    evidence: {operationId: "completed-notice"}});
  const known = await assess();
  assert.equal(known.knownFixtureReconciliationReady, true);
  assert.equal(known.physicalHandoffReady, false);
  await db.doc(noticePath).update({body: "A different current payload"});
  assert.equal((await db.doc(noticePath).get()).get("dispatch.status"), "success");
  assert.ok((await assess()).blockers.includes("event_unreconciled"));
  assert.equal(legacy.mutations.filter((port) => port === "fcm.sendEachForMulticast").length, 1);
});
