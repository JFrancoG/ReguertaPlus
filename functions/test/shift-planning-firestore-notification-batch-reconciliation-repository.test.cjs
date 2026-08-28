"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createFirestoreShiftPlanningNotificationBatchRepository,
  parseShiftPlanningNotificationBatchReconciliationCommand,
} = require(
  "../lib/shift-planning-firestore-notification-batch-reconciliation-repository.js"
);
const {
  createShiftPlanningClaimedNotificationAttempt,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");

const PROJECT_ID = "demo-reguerta-hu082-notification-batch";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const emulatorTest = EMULATOR_HOST ? test : test.skip;
const environment = "develop";
const root = `${environment}/plus-collections`;
const bundleRevision = "bundle-v2-notification-terminal";
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const bundleDigest = digest("a");
const attemptedAtMillis = 1_788_566_500_000;

const cursor = (type) => ({
  schemaVersion: 1,
  type,
  cohortUserIds: ["member-1", "member-2"],
  roundNumber: 2,
  nextMemberIndex: 0,
});

const releaseLease = (type) => ({
  type,
  bundleId: "bundle-notification-terminal",
  bundleRevision,
  bundleDigest,
  leaseEpoch: 9,
  ownerOperationId: "activate-notification-terminal",
  state: type === "delivery" ? "releasing" : "degraded",
  acquiredAtMillis: attemptedAtMillis - 100_000,
  deadlineAtMillis: attemptedAtMillis - 40_000,
});

const rotation = (type, overrides = {}) => ({
  schemaVersion: 1,
  type,
  stateRevision: type === "delivery" ? 5 : 8,
  cursor: cursor(type),
  planningFrontierSeasonStartYear: 2027,
  cohortFrozen: false,
  frozenCohortUserIds: [],
  activeRevision: bundleRevision,
  activeDigest: bundleDigest,
  lastIdempotencyKey: "activate-notification-terminal",
  migrationBaseline: {
    revision: "baseline-1",
    digest: digest("b"),
  },
  releaseLease: releaseLease(type),
  ...overrides,
});

const maintenance = (overrides = {}) => ({
  schemaVersion: 1,
  stateRevision: 12,
  writeEpoch: 9,
  maintenanceStatus: "closed",
  activeRevision: bundleRevision,
  activeDigest: bundleDigest,
  intakeBarrier: {
    revision: "barrier-notification-terminal",
    digest: digest("c"),
    verifiedAtMillis: attemptedAtMillis - 200_000,
  },
  lastTransitionId: "activate-notification-terminal",
  ...overrides,
});

const intent = (ordinal, shiftType) => ({
  intentId: `${bundleRevision}-notification-${ordinal}`,
  idempotencyKey: `${bundleRevision}:notification:${ordinal}`,
  state: "held",
  recipientUserId: `member-${ordinal}`,
  shiftId: `shift-${ordinal}`,
  shiftType,
  expectedAssignmentRevision: 1,
  expectedMembershipRevision: 4,
  expectedEligibilityRevision: 5,
  expectedDestinationRevision: 6,
  canonicalEventType: "shift_assignment_updated",
  payloadPolicy: "genericReferenceOnly",
  bundleRevision,
  bundleDigest,
  writeEpoch: 9,
});

const intents = () => [intent(1, "delivery"), intent(2, "market")];

const validation = () => ({
  assignmentRevision: 1,
  membershipRevision: 4,
  eligibilityRevision: 5,
  destinationRevision: 6,
  messagingTargets: {
    firebaseInstallationIds: [],
    fcmTokens: ["token-terminal"],
  },
  destinationDigest: digest("d"),
  validationDigest: digest("e"),
});

const terminalAttempt = (ordinal, accepted) => {
  const acquiredAt = Timestamp.fromMillis(
    attemptedAtMillis - 30_000 + ordinal * 1_000,
  );
  const claimed = createShiftPlanningClaimedNotificationAttempt({
    intentId: `${bundleRevision}-notification-${ordinal}`,
    eventId: `${bundleRevision}-notification-${ordinal}`,
    attemptId: `attempt-${ordinal}`,
    workerId: "worker-terminal",
    attemptOrdinal: 1,
    acquiredAt,
    validation: validation(),
  });
  const attempt = accepted ? startShiftPlanningAuthenticatedSubmission({
    attempt: claimed,
    startedAt: Timestamp.fromMillis(acquiredAt.toMillis() + 1_000),
  }) : claimed;
  return terminalizeShiftPlanningNotificationAttempt({
    attempt,
    completedAt: Timestamp.fromMillis(acquiredAt.toMillis() + 2_000),
    outcome: accepted ? "accepted" : "failed",
    failureCode: accepted ? null : "no_destination",
    acceptedTargetCount: accepted ? 1 : 0,
  });
};

const expectedState = () => buildShiftPlanningAuthoritativeState({
  environment,
  maintenance: maintenance({
    stateRevision: 11,
    writeEpoch: 8,
    activeRevision: "active-before",
    activeDigest: digest("f"),
    lastTransitionId: "before-activation",
  }),
  rotations: {
    delivery: rotation("delivery", {
      stateRevision: 4,
      activeRevision: "active-before",
      activeDigest: digest("f"),
      releaseLease: null,
    }),
    market: rotation("market", {
      stateRevision: 7,
      activeRevision: "active-before",
      activeDigest: digest("f"),
      releaseLease: null,
    }),
  },
});

const persistedBundle = () => {
  const artifact = {
    schemaVersion: 2,
    bundleId: "bundle-notification-terminal",
    environment,
    bundleRevision,
    bundleDigest,
    expectedWriteEpoch: 8,
    activationWriteEpoch: 9,
    expectedActiveRevision: "active-before",
    expectedState: {
      schemaVersion: 2,
      authoritativeState: expectedState(),
      transactionMeasurementAuthority: {
        adapterRevision: "firestore-adapter-v1",
        indexConfigurationDigest: digest("1"),
      },
    },
    frontiers: {},
    delivery: {},
    market: {},
    manifests: {},
    budgets: {},
    releaseLeaseIntents: [],
    syncCommands: [],
    heldNotificationIntents: intents(),
    transactionRequirements: {},
  };
  return {
    schemaVersion: 1,
    environment,
    bundleId: artifact.bundleId,
    bundleRevision,
    bundleDigest,
    artifactDigest: createShiftPlanningDigest(artifact),
    artifact,
  };
};

const command = (overrides = {}) => ({
  schemaVersion: 1,
  operationKind: "notificationBatchReconciliation",
  environment,
  reconciliationId: "reconcile-notification-terminal",
  bundleRevision,
  attemptBindings: [
    {
      intentId: `${bundleRevision}-notification-1`,
      attemptIds: ["attempt-1"],
    },
    {
      intentId: `${bundleRevision}-notification-2`,
      attemptIds: ["attempt-2"],
    },
  ],
  ...overrides,
});

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

const seed = async () => {
  const batch = firestore.batch();
  batch.set(firestore.doc(`${root}/shiftPlanningState/current`), maintenance());
  batch.set(
    firestore.doc(`${root}/shiftRotations/delivery`),
    rotation("delivery"),
  );
  batch.set(firestore.doc(`${root}/shiftRotations/market`), rotation("market"));
  batch.set(
    firestore.doc(`${root}/shiftPlanningBundles/${bundleRevision}`),
    persistedBundle(),
  );
  intents().forEach((heldIntent, index) => {
    const intentReference = firestore.doc(
      `${root}/shiftPlanningNotificationIntents/${heldIntent.intentId}`,
    );
    const attempt = terminalAttempt(index + 1, index === 0);
    batch.set(intentReference, heldIntent);
    batch.set(intentReference.collection("dispatchState").doc("current"), {
      schemaVersion: 1,
      operationKind: "notificationDispatchState",
      intentId: heldIntent.intentId,
      eventId: heldIntent.intentId,
      attemptCount: 1,
      lastLeaseEpoch: 1,
      activeLease: null,
    });
    batch.set(
      intentReference.collection("dispatchAttempts").doc(attempt.attemptId),
      attempt,
    );
  });
  await batch.commit();
};

const authoritativeDocuments = async () => Promise.all([
  firestore.doc(`${root}/shiftPlanningState/current`).get(),
  firestore.doc(`${root}/shiftRotations/delivery`).get(),
  firestore.doc(`${root}/shiftRotations/market`).get(),
]);

before(async () => {
  if (!EMULATOR_HOST) return;
  firestore = new Firestore({projectId: PROJECT_ID, databaseId: "(default)"});
});

after(async () => {
  if (firestore) await firestore.terminate();
});

beforeEach(async () => {
  if (!EMULATOR_HOST) return;
  await clearFirestore();
  repository = createFirestoreShiftPlanningNotificationBatchRepository(
    firestore,
    () => Timestamp.fromMillis(attemptedAtMillis),
  );
});

test("parses and canonicalizes the exact reconciliation command", () => {
  const reordered = command({
    attemptBindings: [...command().attemptBindings].reverse(),
  });
  assert.deepEqual(
    parseShiftPlanningNotificationBatchReconciliationCommand(reordered),
    command(),
  );
  assert.throws(
    () => parseShiftPlanningNotificationBatchReconciliationCommand({
      ...command(),
      requestedBy: "admin",
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
});

emulatorTest("commits both lease clears and replays without another write", async () => {
  await seed();

  const committed = await repository.reconcile(command());
  assert.equal(committed.kind, "committed");
  assert.deepEqual(committed.record.reconciliation.possibleDeliveryIntentIds, [
    `${bundleRevision}-notification-1`,
  ]);
  assert.deepEqual(
    committed.record.reconciliation.demonstrablyUnsubmittedIntentIds,
    [`${bundleRevision}-notification-2`],
  );
  const [state, delivery, market] = await authoritativeDocuments();
  assert.equal(state.get("writeEpoch"), 10);
  assert.equal(state.get("stateRevision"), 13);
  assert.equal(delivery.get("stateRevision"), 6);
  assert.equal(market.get("stateRevision"), 9);
  assert.equal(delivery.get("releaseLease"), null);
  assert.equal(market.get("releaseLease"), null);

  const updateTimes = [state, delivery, market].map(({updateTime}) => updateTime);
  const replayed = await repository.reconcile(command());
  assert.equal(replayed.kind, "replayed");
  assert.deepEqual(replayed.record, committed.record);
  const replayedDocuments = await authoritativeDocuments();
  replayedDocuments.forEach((snapshot, index) => {
    assert.equal(snapshot.updateTime.isEqual(updateTimes[index]), true);
  });
});

emulatorTest("rejects a retained dispatch lease with zero writes", async () => {
  await seed();
  const stateReference = firestore.doc(
    `${root}/shiftPlanningNotificationIntents/` +
      `${bundleRevision}-notification-1/dispatchState/current`,
  );
  await stateReference.update({
    activeLease: terminalAttempt(1, true).lease,
  });
  const beforeDocuments = await authoritativeDocuments();

  await assert.rejects(
    repository.reconcile(command()),
    (error) => error.code === "planning_release_lease_conflict",
  );
  const afterDocuments = await authoritativeDocuments();
  afterDocuments.forEach((snapshot, index) => {
    assert.deepEqual(snapshot.data(), beforeDocuments[index].data());
  });
  assert.equal((await firestore.doc(
    `${root}/shiftPlanningOperations/` +
      "notification-reconciliation-reconcile-notification-terminal",
  ).get()).exists, false);
});

emulatorTest("rejects an intent outside the canonical bundle with zero writes", async () => {
  await seed();
  await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/` +
      `${bundleRevision}-notification-3`,
  ).set(intent(3, "delivery"));
  const beforeDocuments = await authoritativeDocuments();

  await assert.rejects(
    repository.reconcile(command()),
    (error) => error.code === "planning_release_lease_conflict",
  );
  const afterDocuments = await authoritativeDocuments();
  afterDocuments.forEach((snapshot, index) => {
    assert.deepEqual(snapshot.data(), beforeDocuments[index].data());
  });
});

emulatorTest("rejects partial attempt evidence with zero writes", async () => {
  await seed();
  await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/` +
      `${bundleRevision}-notification-2/dispatchAttempts/attempt-2`,
  ).delete();
  const beforeDocuments = await authoritativeDocuments();

  await assert.rejects(
    repository.reconcile(command()),
    (error) => error.code === "invalid_planning_transaction",
  );
  const afterDocuments = await authoritativeDocuments();
  afterDocuments.forEach((snapshot, index) => {
    assert.deepEqual(snapshot.data(), beforeDocuments[index].data());
  });
});
