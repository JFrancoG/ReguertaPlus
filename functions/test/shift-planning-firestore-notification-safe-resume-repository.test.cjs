"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createFirestoreShiftPlanningNotificationSafeResumeRepository,
  parseShiftPlanningNotificationSafeResumeCommand,
} = require(
  "../lib/shift-planning-firestore-notification-safe-resume-repository.js"
);
const {
  createShiftPlanningClaimedNotificationAttempt,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");

const PROJECT_ID = "demo-reguerta-hu082-notification-safe-resume";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const emulatorTest = EMULATOR_HOST ? test : test.skip;
const environment = "develop";
const root = `${environment}/plus-collections`;
const bundleRevision = "bundle-v2-notification-safe-resume";
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const bundleDigest = digest("a");
const enteredAtMillis = 1_788_652_800_000;

const cursor = (type) => ({
  schemaVersion: 1,
  type,
  cohortUserIds: ["member-1", "member-2"],
  roundNumber: 2,
  nextMemberIndex: 0,
});

const releaseLease = (type) => ({
  type,
  bundleId: "bundle-notification-safe-resume",
  bundleRevision,
  bundleDigest,
  leaseEpoch: 9,
  ownerOperationId: "activate-notification-safe-resume",
  state: type === "delivery" ? "releasing" : "sealed",
  acquiredAtMillis: enteredAtMillis - 120_000,
  deadlineAtMillis: enteredAtMillis - 60_000,
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
  lastIdempotencyKey: "activate-notification-safe-resume",
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
    revision: "barrier-notification-safe-resume",
    digest: digest("c"),
    verifiedAtMillis: enteredAtMillis - 200_000,
  },
  lastTransitionId: "activate-notification-safe-resume",
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
    bundleId: "bundle-notification-safe-resume",
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
  operationKind: "notificationSafeResumeEntry",
  environment,
  incidentId: "incident-safe-resume-1",
  bundleRevision,
  ownerUserId: "operator-safe-resume",
  escalationTargetId: "operations-on-call",
  ttlMillis: 3_600_000,
  attemptBindings: [
    {
      intentId: `${bundleRevision}-notification-1`,
      attemptIds: ["attempt-1"],
    },
    {
      intentId: `${bundleRevision}-notification-2`,
      attemptIds: [],
    },
  ],
  ...overrides,
});

const failedAttempt = () => {
  const acquiredAt = Timestamp.fromMillis(enteredAtMillis - 40_000);
  const claimed = createShiftPlanningClaimedNotificationAttempt({
    intentId: `${bundleRevision}-notification-1`,
    eventId: `${bundleRevision}-notification-1`,
    attemptId: "attempt-1",
    workerId: "worker-safe-resume",
    attemptOrdinal: 1,
    acquiredAt,
    validation: {
      assignmentRevision: 1,
      membershipRevision: 4,
      eligibilityRevision: 5,
      destinationRevision: 6,
      messagingTargets: {
        firebaseInstallationIds: [],
        fcmTokens: [],
      },
      destinationDigest: digest("d"),
      validationDigest: digest("e"),
    },
  });
  return terminalizeShiftPlanningNotificationAttempt({
    attempt: claimed,
    completedAt: Timestamp.fromMillis(enteredAtMillis - 20_000),
    outcome: "failed",
    failureCode: "no_destination",
    acceptedTargetCount: 0,
  });
};

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
    batch.set(intentReference, heldIntent);
    batch.set(intentReference.collection("dispatchState").doc("current"), {
      schemaVersion: 1,
      operationKind: "notificationDispatchState",
      intentId: heldIntent.intentId,
      eventId: heldIntent.intentId,
      attemptCount: index === 0 ? 1 : 0,
      lastLeaseEpoch: index === 0 ? 1 : 0,
      activeLease: null,
    });
    if (index === 0) {
      batch.set(
        intentReference.collection("dispatchAttempts").doc("attempt-1"),
        failedAttempt(),
      );
    }
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
  repository = createFirestoreShiftPlanningNotificationSafeResumeRepository(
    firestore,
    () => Timestamp.fromMillis(enteredAtMillis),
  );
});

test("parses and canonicalizes the exact safe-resume command", () => {
  const reordered = command({
    attemptBindings: [...command().attemptBindings].reverse(),
  });
  assert.deepEqual(
    parseShiftPlanningNotificationSafeResumeCommand(reordered),
    command(),
  );
  for (const invalid of [
    {...command(), requestedBy: "admin"},
    command({ttlMillis: 86_400_001}),
    command({attemptBindings: [command().attemptBindings[1]]}),
  ]) {
    assert.throws(
      () => parseShiftPlanningNotificationSafeResumeCommand(invalid),
      (error) => error.code === "invalid_planning_transaction",
    );
  }
});

emulatorTest("enters degraded mode and replays without another write", async () => {
  await seed();

  const committed = await repository.enter(command());
  assert.equal(committed.kind, "committed");
  assert.deepEqual(committed.record.safeResume.affectedShiftIds, [
    "shift-1",
    "shift-2",
  ]);
  const [state, delivery, market] = await authoritativeDocuments();
  assert.equal(state.get("writeEpoch"), 10);
  assert.equal(state.get("stateRevision"), 13);
  assert.equal(delivery.get("stateRevision"), 6);
  assert.equal(market.get("stateRevision"), 9);
  assert.equal(delivery.get("releaseLease.state"), "degraded");
  assert.equal(market.get("releaseLease.state"), "degraded");
  assert.equal(delivery.get("releaseLease.leaseEpoch"), 9);
  assert.equal(market.get("releaseLease.leaseEpoch"), 9);
  const fenceSnapshots = await Promise.all(["shift-1", "shift-2"].map(
    (shiftId) => firestore.doc(
      `${root}/shiftPlanningNotificationIncidentFences/shift:${shiftId}`,
    ).get(),
  ));
  assert.equal(fenceSnapshots.every(({exists}) => exists), true);

  const updateTimes = [state, delivery, market, ...fenceSnapshots]
    .map(({updateTime}) => updateTime);
  const replayed = await repository.enter(command());
  assert.equal(replayed.kind, "replayed");
  assert.deepEqual(replayed.record, committed.record);
  const replayedDocuments = [
    ...await authoritativeDocuments(),
    ...await Promise.all(["shift-1", "shift-2"].map((shiftId) =>
      firestore.doc(
        `${root}/shiftPlanningNotificationIncidentFences/shift:${shiftId}`,
      ).get())),
  ];
  replayedDocuments.forEach((snapshot, index) => {
    assert.equal(snapshot.updateTime.isEqual(updateTimes[index]), true);
  });
  await assert.rejects(
    repository.enter(command({ttlMillis: 7_200_000})),
    (error) => error.code === "request_intent_conflict",
  );
});

emulatorTest("rejects a partial incident fence with zero writes", async () => {
  await seed();
  await firestore.doc(
    `${root}/shiftPlanningNotificationIncidentFences/shift:shift-1`,
  ).set({partial: true});
  const beforeDocuments = await authoritativeDocuments();

  await assert.rejects(
    repository.enter(command()),
    (error) => error.code === "planning_release_lease_conflict",
  );
  const afterDocuments = await authoritativeDocuments();
  afterDocuments.forEach((snapshot, index) => {
    assert.deepEqual(snapshot.data(), beforeDocuments[index].data());
  });
  assert.equal((await firestore.doc(
    `${root}/shiftPlanningOperations/` +
      "notification-safe-resume-incident-safe-resume-1",
  ).get()).exists, false);
});

emulatorTest("rejects dispatch counter drift with zero writes", async () => {
  await seed();
  await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/` +
      `${bundleRevision}-notification-2/dispatchState/current`,
  ).update({attemptCount: 1, lastLeaseEpoch: 1});
  const beforeDocuments = await authoritativeDocuments();

  await assert.rejects(
    repository.enter(command()),
    (error) => error.code === "planning_release_lease_conflict",
  );
  const afterDocuments = await authoritativeDocuments();
  afterDocuments.forEach((snapshot, index) => {
    assert.deepEqual(snapshot.data(), beforeDocuments[index].data());
  });
});
