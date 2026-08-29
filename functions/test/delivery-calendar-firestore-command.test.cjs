const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

const {
  createFirestoreDeliveryCalendarCommandRepository,
} = require("../lib/delivery-calendar-firestore-command.js");

const PROJECT_ID = "demo-reguerta-hu082-delivery-calendar";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for this test");
}

const environment = "develop";
const root = `${environment}/plus-collections`;
const activeDigest = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const nowMillis = 1_798_000_000_000;
const authority = {
  schemaVersion: 1,
  stateRevision: 7,
  writeEpoch: 3,
  activeRevision: "bundle-2026-27-r1",
  activeDigest,
};
const actor = {uid: "admin-uid", memberId: "admin-member"};
const openState = {
  ...authority,
  maintenanceStatus: "open",
  intakeBarrier: null,
  lastTransitionId: "activate-2026-27-r1",
};
const command = (overrides = {}) => ({
  schemaVersion: 1,
  environment,
  operationId: "calendar-2026-W44-tue",
  action: "upsert",
  weekKey: "2026-W44",
  expectedPlanningAuthority: authority,
  expectedOverrideDigest: null,
  deliveryWeekday: "TUE",
  ...overrides,
});

let app;
let firestore;
let repository;

const clearFirestore = async () => {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
};

before(async () => {
  app = initializeApp({projectId: PROJECT_ID}, "delivery-calendar-command");
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clearFirestore();
  await Promise.all([
    firestore.doc(`${root}/shiftPlanningState/current`).set(openState),
    firestore.doc(`${root}/authLinks/${actor.uid}`).set({
      memberId: actor.memberId,
    }),
    firestore.doc(`${root}/users/${actor.memberId}`).set({
      authUid: actor.uid,
      isActive: true,
      roles: ["member", "admin"],
    }),
  ]);
  repository = createFirestoreDeliveryCalendarCommandRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis),
  );
});

test("resolves one exact open mutation context", async () => {
  assert.deepEqual(await repository.resolveMutationContext({
    schemaVersion: 1,
    environment,
    weekKey: "2026-W44",
  }), {
    schemaVersion: 1,
    environment,
    weekKey: "2026-W44",
    planningAuthority: authority,
    overrideDigest: null,
  });
});

test("upserts atomically with server actor/time and an immutable receipt", async () => {
  const result = await repository.transition(command(), actor);
  assert.equal(result.replayed, false);
  assert.equal(result.override.updatedBy, "admin-member");
  assert.equal(result.override.updatedAtMillis, nowMillis);
  assert.match(
    result.overrideDigest,
    /^delivery-calendar:v1:sha256:[a-f0-9]{64}$/,
  );

  const [calendar, receipt] = await Promise.all([
    firestore.doc(`${root}/deliveryCalendar/2026-W44`).get(),
    firestore.doc(
      `${root}/deliveryCalendarMutationReceipts/` +
        "calendar-2026-W44-tue",
    ).get(),
  ]);
  assert.equal(calendar.get("updatedBy"), "admin-member");
  assert.equal(calendar.get("updatedAt").toMillis(), nowMillis);
  assert.equal(receipt.get("actorMemberId"), "admin-member");
  assert.equal(receipt.get("commandDigest"), result.commandDigest);
});

test("an exact replay converges after later planning-state drift", async () => {
  const first = await repository.transition(command(), actor);
  await firestore.doc(`${root}/shiftPlanningState/current`).update({
    stateRevision: 8,
    writeEpoch: 4,
    maintenanceStatus: "closed",
    intakeBarrier: {
      revision: "barrier-1",
      digest: activeDigest,
      verifiedAtMillis: nowMillis,
    },
    lastTransitionId: "maintenance-1",
  });
  const replay = await repository.transition(command(), actor);
  assert.deepEqual(replay, {...first, replayed: true});
});

test("rejects operation collisions, stale authority and override drift", async () => {
  await repository.transition(command(), actor);
  await assert.rejects(
    repository.transition(command({deliveryWeekday: "THU"}), actor),
    (error) => error.code === "delivery_calendar_operation_conflict",
  );

  await assert.rejects(
    repository.transition(command({
      operationId: "calendar-stale-authority",
      expectedPlanningAuthority: {...authority, writeEpoch: 2},
      expectedOverrideDigest: null,
    }), actor),
    (error) => error.code === "delivery_calendar_authority_changed",
  );

  await assert.rejects(
    repository.transition(command({
      operationId: "calendar-stale-override",
      expectedOverrideDigest: null,
    }), actor),
    (error) => error.code === "delivery_calendar_override_conflict",
  );
  assert.equal((await firestore.collection(
    `${root}/deliveryCalendarMutationReceipts`,
  ).get()).size, 1);
});

test("deletes only the digest-bound current override", async () => {
  const created = await repository.transition(command(), actor);
  const {deliveryWeekday: _deliveryWeekday, ...base} = command({
    operationId: "calendar-2026-W44-delete",
    expectedOverrideDigest: created.overrideDigest,
  });
  const deleted = await repository.transition({
    ...base,
    action: "delete",
  }, actor);
  assert.equal(deleted.override, null);
  assert.equal(deleted.overrideDigest, null);
  assert.equal(
    (await firestore.doc(`${root}/deliveryCalendar/2026-W44`).get()).exists,
    false,
  );
});

test("revalidates the linked active admin inside the mutation transaction", async () => {
  await firestore.doc(`${root}/users/${actor.memberId}`).update({
    roles: ["member"],
  });
  await assert.rejects(
    repository.transition(command(), actor),
    (error) => error.code === "admin_required",
  );
  assert.equal(
    (await firestore.doc(`${root}/deliveryCalendar/2026-W44`).get()).exists,
    false,
  );
  assert.equal((await firestore.collection(
    `${root}/deliveryCalendarMutationReceipts`,
  ).get()).empty, true);
});
