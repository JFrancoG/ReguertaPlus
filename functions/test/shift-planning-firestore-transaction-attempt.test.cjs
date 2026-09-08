"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Firestore, Timestamp, FieldValue} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {
  applyShiftPlanningFirestoreTransactionAttempt: apply,
} = require("../lib/shift-planning-firestore-transaction-attempt.js");
const {SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION} = require("../lib/shift-planning-firestore-transaction-manifest.js");
const emulator = (name, run) => test(name, {skip: !process.env.FIRESTORE_EMULATOR_HOST}, async () => {
  const database = new Firestore({projectId: "demo-reguerta-hu082-transaction-attempt"});
  try { await run(database); } finally { await database.terminate(); }
});
const input = (database, transaction, mutations) => ({
  firestore: database, transaction, mutations, writerFenceCheckedAt: Timestamp.now(),
  direction: "forward", manifestDigest: digest({plan: "atomic"}),
  expectedDocumentWriteCount: mutations.length,
  authority: {adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION, indexConfigurationDigest: digest({indexes: "test"})},
});

emulator("public transaction applies create/update/delete atomically with detached values", async (database) => {
  const state = database.doc("attemptState/current");
  const removed = database.doc("attemptState/removed");
  const created = database.doc("attemptState/created");
  await state.set({revision: 1, obsolete: true});
  await removed.set({value: "before"});
  const evidence = await database.runTransaction(async (transaction) => {
    const [current, before] = await transaction.getAll(state, removed);
    const data = {nested: {value: "original"}, bytes: Buffer.from([1, 2])};
    const result = await apply(input(database, transaction, [
      {kind: "create", documentPath: created.path, data},
      {kind: "update", documentPath: state.path, data: {revision: current.get("revision") + 1, obsolete: FieldValue.delete()}, precondition: {lastUpdateTime: current.updateTime}},
      {kind: "delete", documentPath: removed.path, precondition: {lastUpdateTime: before.updateTime}},
    ]));
    data.nested.value = "changed";
    data.bytes.fill(9);
    return result;
  });
  assert.deepEqual((await state.get()).data(), {revision: 2});
  assert.equal((await removed.get()).exists, false);
  assert.deepEqual((await created.get()).data(), {nested: {value: "original"}, bytes: Buffer.from([1, 2])});
  assert.equal(evidence.documentWriteCount, 3);
  assert.equal(evidence.evidenceKind, "applicationAdmission");
});

emulator("server rejection leaves every logical write unapplied", async (database) => {
  const existing = database.doc("atomicReject/existing");
  const state = database.doc("atomicReject/state");
  await existing.set({value: "existing"});
  await state.set({revision: 1});
  await assert.rejects(database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(state);
    return apply(input(database, transaction, [
      {kind: "create", documentPath: existing.path, data: {value: "forbidden"}},
      {kind: "update", documentPath: state.path, data: {revision: 2}, precondition: {lastUpdateTime: snapshot.updateTime}},
    ]));
  }));
  assert.deepEqual((await existing.get()).data(), {value: "existing"});
  assert.deepEqual((await state.get()).data(), {revision: 1});
});

emulator("each retry re-reads authority and constructs a new admitted manifest", async (database) => {
  const state = database.doc("attemptRetry/state");
  await state.set({revision: 1});
  let attempts = 0;
  const result = await database.runTransaction(async (transaction) => {
    attempts += 1;
    const snapshot = await transaction.get(state);
    if (attempts === 1) {
      const error = new Error("ABORTED callback retry"); error.code = 10; throw error;
    }
    return apply(input(database, transaction, [{
      kind: "update", documentPath: state.path, data: {revision: snapshot.get("revision") + 1},
      precondition: {lastUpdateTime: snapshot.updateTime},
    }]));
  });
  assert.equal(attempts, 2);
  assert.equal((await state.get()).get("revision"), 2);
  assert.equal(result.documentWriteCount, 1);
});

emulator("notification writer fence blocks the entire public shift transaction", async (database) => {
  const root = "develop/plus-collections";
  const shiftId = "blocked-shift";
  const now = Timestamp.now();
  await database.doc(`${root}/shiftPlanningNotificationFences/shift:${shiftId}`).set({
    schemaVersion: 1, operationKind: "notificationDispatchResourceFence", scope: "shift", resourceId: shiftId,
    intentId: "intent-1", eventId: "event-1", attemptId: "attempt-1", workerId: "worker-1", leaseEpoch: 1,
    acquiredAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 60_000), validationDigest: digest({valid: true}),
  });
  const state = database.doc("fencedAttempt/state");
  await state.set({revision: 1});
  await assert.rejects(database.runTransaction(async (transaction) => {
    await transaction.get(state);
    return apply(input(database, transaction, [
      {kind: "create", documentPath: `${root}/shifts/${shiftId}`, data: {owner: "one"}},
      {kind: "update", documentPath: state.path, data: {revision: 2}},
    ]));
  }));
  assert.equal((await database.doc(`${root}/shifts/${shiftId}`).get()).exists, false);
  assert.equal((await state.get()).get("revision"), 1);
});
