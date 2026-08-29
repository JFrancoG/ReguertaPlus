const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const {
  createFirestoreShiftPlanningRequestContextRepository,
} = require("../lib/shift-planning-firestore-request-context.js");

const PROJECT_ID = "demo-reguerta-hu082-request-context";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for this test");
}

const environment = "develop";
const statePath = `${environment}/plus-collections/shiftPlanningState/current`;
const activeDigest = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const openState = {
  schemaVersion: 1,
  stateRevision: 7,
  maintenanceStatus: "open",
  writeEpoch: 3,
  activeRevision: "bundle-2026-27-r1",
  activeDigest,
  intakeBarrier: null,
  lastTransitionId: "activate-2026-27-r1",
};

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
  app = initializeApp({projectId: PROJECT_ID}, "shift-request-context");
  firestore = getFirestore(app);
  repository = createFirestoreShiftPlanningRequestContextRepository(firestore);
});

after(async () => {
  await deleteApp(app);
});

beforeEach(clearFirestore);

test("reads one exact open request context without mutation", async () => {
  await firestore.doc(statePath).set(openState);
  assert.deepEqual(await repository.resolve({
    schemaVersion: 1,
    environment,
  }), {
    schemaVersion: 1,
    environment,
    expectedWriteEpoch: 3,
    expectedActiveRevision: "bundle-2026-27-r1",
  });
  assert.equal((await firestore.doc(statePath).get()).get("writeEpoch"), 3);
});

test("fails closed for missing or closed state", async () => {
  await assert.rejects(
    repository.resolve({schemaVersion: 1, environment}),
    (error) => error.code === "shift_planning_state_unavailable",
  );
  await firestore.doc(statePath).set({
    ...openState,
    maintenanceStatus: "closed",
    intakeBarrier: {
      revision: "barrier-1",
      digest: activeDigest,
      verifiedAtMillis: 1_798_000_000_000,
    },
  });
  await assert.rejects(
    repository.resolve({schemaVersion: 1, environment}),
    (error) => error.code === "shift_planning_maintenance",
  );
});
