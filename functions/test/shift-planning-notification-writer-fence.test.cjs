"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");

const {
  inspectShiftPlanningNotificationWriterFences,
  runShiftPlanningNotificationGuardedShiftWrite,
} = require(
  "../lib/shift-planning-firestore-notification-writer-fence.js"
);
const {
  assertShiftPlanningWriterAuthority,
  captureShiftPlanningWriterAuthority,
} = require("../lib/shift-planning-writer-authority.js");

const PROJECT_ID = "demo-reguerta-hu082-notification-writer-fence";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const root = "develop/plus-collections";
const initialMillis = 1_788_393_900_000;
const digest = `shift-planning:v1:sha256:${"f".repeat(64)}`;

let firestore;

const clearFirestore = async () => {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
};

const resourceFence = ({scope, resourceId, acquiredAtMillis}) => ({
  schemaVersion: 1,
  operationKind: "notificationDispatchResourceFence",
  scope,
  resourceId,
  intentId: "intent-1",
  eventId: "event-1",
  attemptId: "attempt-1",
  workerId: "worker-1",
  leaseEpoch: 1,
  acquiredAt: Timestamp.fromMillis(acquiredAtMillis),
  expiresAt: Timestamp.fromMillis(acquiredAtMillis + 30_000),
  validationDigest: digest,
});

const fencePath = (scope, resourceId) =>
  `${root}/shiftPlanningNotificationFences/${scope}:${resourceId}`;

const incidentFencePath = (shiftId) =>
  `${root}/shiftPlanningNotificationIncidentFences/shift:${shiftId}`;

const incidentFence = ({shiftId, acquiredAtMillis, expiresAtMillis}) => ({
  schemaVersion: 1,
  operationKind: "notificationIncidentShiftFence",
  shiftId,
  incidentId: "incident-1",
  bundleRevision: "bundle-v1",
  bundleDigest: digest,
  ownerUserId: "operator-1",
  acquiredAt: Timestamp.fromMillis(acquiredAtMillis),
  expiresAt: Timestamp.fromMillis(expiresAtMillis),
  safeResumeDigest: digest,
});

const planningState = (overrides = {}) => ({
  schemaVersion: 1,
  stateRevision: 4,
  writeEpoch: 7,
  maintenanceStatus: "open",
  activeRevision: "bundle-v2-1234567890abcdef12345678",
  activeDigest: digest,
  intakeBarrier: null,
  lastTransitionId: "activation-transition-1",
  ...overrides,
});

before(async () => {
  if (!EMULATOR_HOST) return;
  firestore = new Firestore({projectId: PROJECT_ID, databaseId: "(default)"});
});

after(async () => {
  if (firestore) await firestore.terminate();
});

beforeEach(async () => {
  if (EMULATOR_HOST) await clearFirestore();
});

test("rejects an empty writer resource set before Firestore access", async () => {
  await assert.rejects(
    inspectShiftPlanningNotificationWriterFences({
      firestore: null,
      transaction: null,
      root,
      resources: [],
      now: Timestamp.fromMillis(initialMillis),
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
});

test("allows missing and expired exact writer fences", {
  skip: !EMULATOR_HOST,
}, async () => {
  await firestore.doc(fencePath("member", "member-1")).set(
    resourceFence({
      scope: "member",
      resourceId: "member-1",
      acquiredAtMillis: initialMillis - 40_000,
    }),
  );
  const result = await firestore.runTransaction((transaction) =>
    inspectShiftPlanningNotificationWriterFences({
      firestore,
      transaction,
      root,
      resources: [
        {scope: "member", resourceId: "member-1"},
        {scope: "shift", resourceId: "shift-1"},
      ],
      now: Timestamp.fromMillis(initialMillis),
    })
  );
  assert.deepEqual(result, {kind: "writable"});
});

test("returns the latest active writer-fence deadline", {
  skip: !EMULATOR_HOST,
}, async () => {
  const batch = firestore.batch();
  batch.set(
    firestore.doc(fencePath("member", "member-1")),
    resourceFence({
      scope: "member",
      resourceId: "member-1",
      acquiredAtMillis: initialMillis - 10_000,
    }),
  );
  batch.set(
    firestore.doc(fencePath("shift", "shift-1")),
    resourceFence({
      scope: "shift",
      resourceId: "shift-1",
      acquiredAtMillis: initialMillis - 5_000,
    }),
  );
  await batch.commit();
  const result = await firestore.runTransaction((transaction) =>
    inspectShiftPlanningNotificationWriterFences({
      firestore,
      transaction,
      root,
      resources: [
        {scope: "shift", resourceId: "shift-1"},
        {scope: "member", resourceId: "member-1"},
        {scope: "shift", resourceId: "shift-1"},
      ],
      now: Timestamp.fromMillis(initialMillis),
    })
  );
  assert.equal(result.kind, "busy");
  assert.equal(result.retryAt.toMillis(), initialMillis + 25_000);
});

test("incident shift fence blocks only its affected shift until expiry", {
  skip: !EMULATOR_HOST,
}, async () => {
  await firestore.doc(incidentFencePath("shift-1")).set(incidentFence({
    shiftId: "shift-1",
    acquiredAtMillis: initialMillis - 1_000,
    expiresAtMillis: initialMillis + 3_600_000,
  }));
  const inspect = (shiftId, nowMillis = initialMillis) =>
    firestore.runTransaction((transaction) =>
      inspectShiftPlanningNotificationWriterFences({
        firestore,
        transaction,
        root,
        resources: [{scope: "shift", resourceId: shiftId}],
        now: Timestamp.fromMillis(nowMillis),
      })
    );

  const affected = await inspect("shift-1");
  assert.equal(affected.kind, "busy");
  assert.equal(affected.retryAt.toMillis(), initialMillis + 3_600_000);
  assert.deepEqual(await inspect("shift-2"), {kind: "writable"});
  assert.deepEqual(
    await inspect("shift-1", initialMillis + 3_600_000),
    {kind: "writable"},
  );
});

test("fails closed for a malformed writer fence", {
  skip: !EMULATOR_HOST,
}, async () => {
  await firestore.doc(fencePath("member", "member-1")).set({
    ...resourceFence({
      scope: "member",
      resourceId: "member-1",
      acquiredAtMillis: initialMillis - 40_000,
    }),
    unexpected: true,
  });
  await assert.rejects(
    firestore.runTransaction((transaction) =>
      inspectShiftPlanningNotificationWriterFences({
        firestore,
        transaction,
        root,
        resources: [{scope: "member", resourceId: "member-1"}],
        now: Timestamp.fromMillis(initialMillis),
      })
    ),
    (error) => error.code === "invalid_planning_transaction",
  );
});

test("guarded legacy shift write skips its mutation while dispatch is active", {
  skip: !EMULATOR_HOST,
}, async () => {
  const target = firestore.doc(`${root}/shifts/shift-1`);
  await target.set({revision: 1});
  await firestore.doc(fencePath("shift", "shift-1")).set(
    resourceFence({
      scope: "shift",
      resourceId: "shift-1",
      acquiredAtMillis: initialMillis,
    }),
  );
  let mutationCalled = false;

  const result = await runShiftPlanningNotificationGuardedShiftWrite({
    firestore,
    root,
    shiftId: "shift-1",
    clock: () => Timestamp.fromMillis(initialMillis),
    mutate: ({transaction, reference}) => {
      mutationCalled = true;
      transaction.update(reference, {revision: 2});
    },
  });

  assert.equal(result.kind, "busy");
  assert.equal(result.retryAt.toMillis(), initialMillis + 30_000);
  assert.equal(mutationCalled, false);
  assert.equal((await target.get()).get("revision"), 1);
});

test("guarded legacy shift write mutates from its transactional snapshot", {
  skip: !EMULATOR_HOST,
}, async () => {
  const target = firestore.doc(`${root}/shifts/shift-1`);
  await target.set({revision: 1});

  const result = await runShiftPlanningNotificationGuardedShiftWrite({
    firestore,
    root,
    shiftId: "shift-1",
    clock: () => Timestamp.fromMillis(initialMillis),
    mutate: ({transaction, reference, snapshot, checkedAt}) => {
      const priorRevision = snapshot.get("revision");
      transaction.update(reference, {
        revision: priorRevision + 1,
        checkedAt,
      });
      return priorRevision;
    },
  });

  assert.deepEqual(result, {kind: "writable", value: 1});
  const updated = await target.get();
  assert.equal(updated.get("revision"), 2);
  assert.equal(updated.get("checkedAt").toMillis(), initialMillis);
});

test("guarded writer revalidates its captured planning authority", {
  skip: !EMULATOR_HOST,
}, async () => {
  const target = firestore.doc(`${root}/shifts/shift-1`);
  const stateReference = firestore.doc(`${root}/shiftPlanningState/current`);
  await target.set({revision: 1});
  await stateReference.set(planningState());
  const captured = captureShiftPlanningWriterAuthority(
    (await stateReference.get()).data(),
  );
  const authorize = async (transaction) => {
    const current = await transaction.get(stateReference);
    assertShiftPlanningWriterAuthority({
      capturedValue: captured,
      currentStateValue: current.data(),
      changedCode: "shift_import_planning_authority_changed",
      changedMessage: "Import planning authority changed",
    });
  };

  const first = await runShiftPlanningNotificationGuardedShiftWrite({
    firestore,
    root,
    shiftId: "shift-1",
    clock: () => Timestamp.fromMillis(initialMillis),
    authorize,
    mutate: ({transaction, reference}) => {
      transaction.update(reference, {revision: 2});
    },
  });
  assert.equal(first.kind, "writable");
  assert.equal((await target.get()).get("revision"), 2);

  await stateReference.set(planningState({
    stateRevision: 5,
    writeEpoch: 8,
  }));
  let mutationCalled = false;
  await assert.rejects(
    runShiftPlanningNotificationGuardedShiftWrite({
      firestore,
      root,
      shiftId: "shift-1",
      clock: () => Timestamp.fromMillis(initialMillis),
      authorize,
      mutate: ({transaction, reference}) => {
        mutationCalled = true;
        transaction.update(reference, {revision: 3});
      },
    }),
    (error) => error.code === "shift_import_planning_authority_changed",
  );
  assert.equal(mutationCalled, false);
  assert.equal((await target.get()).get("revision"), 2);
});

test("a backend writer and racing claim serialize on the same fence", {
  skip: !EMULATOR_HOST,
}, async () => {
  const target = firestore.doc(`${root}/users/member-1`);
  await target.set({revision: 1});
  let releaseFirstRead;
  const release = new Promise((resolve) => {
    releaseFirstRead = resolve;
  });
  let firstReadObserved;
  const observed = new Promise((resolve) => {
    firstReadObserved = resolve;
  });
  const writer = firestore.runTransaction(async (transaction) => {
    const result = await inspectShiftPlanningNotificationWriterFences({
      firestore,
      transaction,
      root,
      resources: [{scope: "member", resourceId: "member-1"}],
      now: Timestamp.fromMillis(initialMillis),
    });
    firstReadObserved();
    await release;
    if (result.kind === "busy") return result;
    transaction.update(target, {revision: 2});
    return result;
  });

  await observed;
  let claimSettled = false;
  const claim = firestore.doc(fencePath("member", "member-1")).set(
    resourceFence({
      scope: "member",
      resourceId: "member-1",
      acquiredAtMillis: initialMillis,
    }),
  ).finally(() => {
    claimSettled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(claimSettled, false);
  releaseFirstRead();

  const result = await writer;
  assert.equal(result.kind, "writable");
  await claim;
  assert.equal((await target.get()).get("revision"), 2);
  assert.equal(
    (await firestore.doc(fencePath("member", "member-1")).get()).exists,
    true,
  );
});
