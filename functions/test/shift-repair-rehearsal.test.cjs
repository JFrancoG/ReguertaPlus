"use strict";
const assert = require("node:assert/strict");
const {before, beforeEach, after, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {readFileSync} = require("node:fs");
const {rehearseShiftRepair} = require("../scripts/rehearse-shift-repair.cjs");
const {repairFixture, PROJECT_ID, root, encode, decode, digest} = require("./shift-repair-rehearsal-fixture.cjs");
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(host ?? "")) throw new Error("Loopback Firestore emulator required");
const emulator = {host, projectId: PROJECT_ID};
const indexConfigurationDigest = digest(JSON.parse(readFileSync(require.resolve("../../firestore.indexes.json"), "utf8")));
let firestore;
before(() => {firestore = new Firestore({projectId: PROJECT_ID, host, ssl: false});});
after(async () => {await firestore.terminate();});
beforeEach(async () => {
  const response = await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {method: "DELETE"});
  assert.equal(response.ok, true);
});
const run = (fixture, direction, readBack, extra = {}) => rehearseShiftRepair({options: fixture.options, expectedReviewDigest: fixture.review.planDigest,
  direction, emulator, indexConfigurationDigest, ...(readBack ? {readBack} : {}), ...extra});
const readAll = async (fixture) => {
  const paths = fixture.review.recoveryEvidence.forward.readGuards.map((item) => item.targetPath);
  const snapshots = await firestore.getAll(...paths.map((path) => firestore.doc(path)));
  return snapshots.map((snapshot) => ({path: snapshot.ref.path, exists: snapshot.exists,
    payload: snapshot.exists ? encode(snapshot.data()) : null, updateTime: snapshot.exists ? encode(snapshot.updateTime) : null}));
};

test("actual atomic forward/inverse restores all payloads, removes created objects and receipts replay without writes", async () => {
  const fixture = await repairFixture({firestore, createMissing: true}), original = await readAll(fixture);
  const forward = await run(fixture, "forward");
  assert.equal(forward.outcome, "committed"); assert.equal(forward.admission.documentWriteCount, 7);
  const expected = fixture.review.recoveryEvidence.forward.writes;
  for (const write of expected) assert.deepEqual(encode((await firestore.doc(write.targetPath).get()).data()), write.payload);
  const baseline = fixture.review.recoveryEvidence.baseline.reference;
  for (const type of ["delivery", "market"]) {
    const doc = (await firestore.doc(`${root}/shiftRotations/${type}`).get()).data();
    assert.equal(doc.stateRevision, 3); assert.deepEqual(doc.migrationBaseline, baseline);
  }
  const committed = await readAll(fixture), replay = await run(fixture, "forward", forward.readBack);
  assert.equal(replay.outcome, "replayed"); assert.equal(replay.admission, null); assert.deepEqual(await readAll(fixture), committed);
  const inverse = await run(fixture, "inverse", forward.readBack);
  assert.equal(inverse.admission.direction, "inverse"); assert.equal(inverse.admission.documentWriteCount, 7);
  const restored = await readAll(fixture);
  assert.deepEqual(restored.map(({updateTime, ...entry}) => entry), original.map(({updateTime, ...entry}) => entry));
  assert.equal(Object.hasOwn((await firestore.doc(`${root}/shifts/shift_market_20260920`).get()).data(), "lastBackendMutation"), false);
  const inverseReplay = await run(fixture, "inverse", inverse.readBack);
  assert.equal(inverseReplay.outcome, "replayed"); assert.deepEqual(await readAll(fixture), restored);
});

test("stale updateTime with identical data rejects before any forward writes", async () => {
  const fixture = await repairFixture({firestore});
  const path = `${root}/shiftRotations/market`, doc = await firestore.doc(path).get();
  await firestore.doc(path).update({stateRevision: 99}); await firestore.doc(path).set(doc.data());
  assert.ok(!(await firestore.doc(path).get()).updateTime.isEqual(doc.updateTime));
  const before = await readAll(fixture); await assert.rejects(run(fixture, "forward")); assert.deepEqual(await readAll(fixture), before);
});

test("inverse rejects missing or tampered receipt and an ABA update to an unchanged neighbor", async () => {
  const fixture = await repairFixture({firestore}), forward = await run(fixture, "forward"), before = await readAll(fixture);
  await assert.rejects(run(fixture, "inverse"));
  const bad = structuredClone(forward.readBack); bad.documents[0].payloadDigest = "tampered";
  await assert.rejects(run(fixture, "inverse", bad)); assert.deepEqual(await readAll(fixture), before);
  const path = `${root}/shifts/shift_delivery_20260827`, doc = (await firestore.doc(path).get()).data();
  await firestore.doc(path).update({status: "confirmed"}); await firestore.doc(path).set(doc);
  const changed = await readAll(fixture); await assert.rejects(run(fixture, "inverse", forward.readBack)); assert.deepEqual(await readAll(fixture), changed);
});

test("parallel forward attempts commit one complete group and reject the stale attempt", async () => {
  const fixture = await repairFixture({firestore, createMissing: true});
  const results = await Promise.allSettled([run(fixture, "forward"), run(fixture, "forward")]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  for (const write of fixture.review.recoveryEvidence.forward.writes) assert.deepEqual(encode((await firestore.doc(write.targetPath).get()).data()), write.payload);
});

test("HU-082 notification fence blocks the full repair group without partial documents", async () => {
  const fixture = await repairFixture({firestore}), now = Date.now();
  await firestore.doc(`${root}/shiftPlanningNotificationFences/shift:shift_market_20260920`).set({schemaVersion: 1,
    operationKind: "notificationDispatchResourceFence", scope: "shift", resourceId: "shift_market_20260920", intentId: "intent-r1", eventId: "event-r1",
    attemptId: "attempt-r1", workerId: "worker-r1", leaseEpoch: 1, acquiredAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + 30000),
    validationDigest: digest({fixture: "fence"})});
  const before = await readAll(fixture);
  await assert.rejects(run(fixture, "forward"), (error) => error.code === "planning_release_lease_conflict");
  assert.deepEqual(await readAll(fixture), before);
});

test("review digest and index-policy validation cannot be bypassed to send a transaction", async () => {
  const fixture = await repairFixture({firestore}), before = await readAll(fixture);
  await assert.rejects(run(fixture, "forward", undefined, {expectedReviewDigest: "stale"}));
  await assert.rejects(run(fixture, "forward", undefined, {indexConfigurationDigest: "not-a-digest"}));
  await assert.rejects(run(fixture, "forward", undefined, {emulator: {host: "https://127.0.0.1:8080", projectId: PROJECT_ID}}));
  assert.deepEqual(await readAll(fixture), before);
});


test("readable snapshots produce the same bounded Firestore repair and inverse without converting Sheets", async () => {
  const fixture = await repairFixture({firestore, readable: true, createMissing: true});
  const original = await readAll(fixture);
  assert.ok(fixture.options.input.tabs.every((tab) => tab.layout !== "canonical"));
  const sheets = structuredClone(fixture.options.input.spreadsheet);
  const forward = await run(fixture, "forward");
  assert.equal(forward.outcome, "committed");
  assert.equal((await run(fixture, "forward", forward.readBack)).outcome, "replayed");
  await run(fixture, "inverse", forward.readBack);
  assert.deepEqual((await readAll(fixture)).map(({updateTime, ...row}) => row), original.map(({updateTime, ...row}) => row));
  assert.deepEqual(fixture.options.input.spreadsheet, sheets);
});
