"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");

const {
  createFirestoreShiftPlanningNotificationReleaseRepository,
} = require(
  "../lib/shift-planning-firestore-notification-release-repository.js"
);
const {
  deriveShiftPlanningMemberRevision,
} = require("../lib/shift-planning-member-revision.js");
const {
  createShiftPlanningNotificationReleaseArtifacts,
} = require("../lib/shift-planning-notification-release.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
} = require("../lib/shift-planning-publication-contract.js");
const {
  createShiftPlanningCompletedSyncCommand,
  createShiftPlanningProcessingSyncCommand,
} = require("../lib/shift-planning-sync-command.js");

const PROJECT_ID = "demo-reguerta-hu082-notification-release";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const environment = "develop";
const root = `${environment}/plus-collections`;
const bundleRevision = "bundle-v2-1234567890abcdef12345678";
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const bundleDigest = digest("a");
const releasedAt = Timestamp.fromMillis(1_788_393_900_000);

const memberSource = (overrides = {}) => ({
  userId: "member-1",
  roles: ["member"],
  isActive: true,
  isCommonPurchaseManager: false,
  devices: [{
    deviceId: "device-1",
    fcmToken: "token-1",
    firebaseInstallationId: "fid-1",
    tokenUpdatedAt: Timestamp.fromMillis(1_788_393_000_000),
    registrationUpdatedAt: Timestamp.fromMillis(1_788_393_000_000),
  }],
  ...overrides,
});

const completedSync = (type) => {
  const expectedPartitionEpoch = type === "delivery" ? 11 : 15;
  const command = {
    schemaVersion: 1,
    operationKind: "sheetsSync",
    commandId: `${bundleRevision}-${type}`,
    idempotencyKey: `${bundleRevision}:sheets:${type}`,
    state: "pending",
    type,
    bundleRevision,
    bundleDigest,
    writeEpoch: 8,
    workbookId: "workbook-production",
    workbookRevision: "workbook-revision-7",
    partitionKey: type,
    expectedPartitionStateRevision: type === "delivery" ? 4 : 6,
    expectedPartitionEpoch,
    commandPartitionEpoch: expectedPartitionEpoch + 1,
    expectedCurrentLease: null,
    leaseIntent: {
      ownerOperationId: `${bundleRevision}:sheets:${type}`,
      leaseEpoch: expectedPartitionEpoch + 1,
      state: "claimed",
      durationMillis: 120_000,
    },
    expectedActiveRevision: bundleRevision,
    expectedActiveDigest: bundleDigest,
    targetSeasonStartYear: 2026,
    affectedProjectionSeasonStartYears: [2026, 2027],
  };
  const processing = createShiftPlanningProcessingSyncCommand({
    command,
    claim: {
      workerId: `sync-worker-${type}`,
      attemptId: `sync-attempt-${type}`,
      fencingEpoch: expectedPartitionEpoch + 1,
      acquiredAt: Timestamp.fromMillis(1_788_393_600_000),
      expiresAt: Timestamp.fromMillis(1_788_393_720_000),
    },
  });
  return createShiftPlanningCompletedSyncCommand({
    command: processing,
    completedAt: Timestamp.fromMillis(1_788_393_660_000),
    evidence: {
      workbookRevision: `workbook-revision-8-${type}`,
      partitionDigest: digest(type === "delivery" ? "d" : "e"),
    },
  });
};

const intentFor = (member = deriveShiftPlanningMemberRevision(memberSource())) => ({
  intentId: `${bundleRevision}-notification-1`,
  idempotencyKey: `${bundleRevision}:notification:1`,
  state: "held",
  recipientUserId: member.userId,
  shiftId: "shift_delivery_20260902",
  shiftType: "delivery",
  expectedAssignmentRevision: 1,
  expectedMembershipRevision: member.membershipRevision,
  expectedEligibilityRevision: member.eligibilityRevision,
  expectedDestinationRevision: member.destinationRevision,
  canonicalEventType: "shift_assignment_updated",
  payloadPolicy: "genericReferenceOnly",
  bundleRevision,
  bundleDigest,
  writeEpoch: 8,
});

const publicShift = () => {
  const materialization = buildShiftPlanningPublicShiftMaterialization({
    environment,
    position: {
      schemaVersion: 1,
      positionId: "shift_delivery_20260902",
      candidateId: "bundle-candidate-1",
      type: "delivery",
      shiftId: "shift_delivery_20260902",
      scheduledDate: "2026-09-02",
      projectionSeasonStartYear: 2026,
      rotationOwnerUserIds: ["member-1"],
      assignedUserIds: ["member-1"],
      rotationPositions: [{
        rotationOwnerUserId: "member-1",
        effectiveAssigneeUserId: "member-1",
        roundNumber: 1,
        positionInRound: 1,
        planningReason: "target",
      }],
      helperUserId: "member-2",
      source: "app",
      origin: "planner",
      planningRequestId: "activate-request-1",
      bundleRevision,
      bundleDigest,
      writeEpoch: 8,
    },
    attemptedAt: Timestamp.fromMillis(1_788_307_200_000),
  });
  const terminal = createShiftPlanningActivationOperationTerminal({
    operationId: "activate-operation-1",
    environment,
    requestId: "activate-request-1",
    candidateId: "bundle-candidate-1",
    bundleRevision,
    bundleDigest,
    forwardManifestDigest: digest("b"),
    expectedStateDigest: digest("c"),
    writeEpoch: 8,
    attemptedAt: Timestamp.fromMillis(1_788_307_200_000),
    publicMutations: [{
      mutationKind: "create",
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    }],
    beforeImages: [],
  });
  return attachShiftPlanningBackendMutationMarker({materialization, operation: terminal});
};

test("builds one generic compatible event with explicit at-least-once policy", () => {
  const intent = intentFor();
  const artifacts = createShiftPlanningNotificationReleaseArtifacts({
    intent,
    deliverySync: completedSync("delivery"),
    marketSync: completedSync("market"),
    releasedAt,
  });

  assert.equal(artifacts.eventId, intent.intentId);
  assert.deepEqual(artifacts.event, {
    schemaVersion: 1,
    operationKind: "shiftPlanningNotification",
    contentPolicy: "genericReferenceOnly",
    title: "Turnos actualizados",
    body: "Consulta la aplicación para ver la información actualizada.",
    type: "shift_updated",
    target: "users",
    targetPayload: {userIds: ["member-1"]},
    sentAt: releasedAt,
    createdBy: "system",
  });
  assert.equal(artifacts.inbox.notificationEventId, intent.intentId);
  assert.equal(artifacts.inbox.schemaVersion, 1);
  assert.equal(
    artifacts.inbox.operationKind,
    "shiftPlanningNotification",
  );
  assert.equal(artifacts.inbox.contentPolicy, "genericReferenceOnly");
  assert.deepEqual(artifacts.receipt.dispatchPolicy, {
    deliveryGuarantee: "atLeastOnce",
    duplicatePresentationPossible: true,
    stableEventId: intent.intentId,
    collapseKey: intent.intentId,
  });
  const publicPayload = JSON.stringify({
    event: artifacts.event,
    inbox: artifacts.inbox,
  });
  assert.equal(publicPayload.includes(intent.shiftId), false);
  assert.equal(publicPayload.includes("20260902"), false);
});

test("rejects release unless both read-backs belong to the same bundle", () => {
  const market = completedSync("market");
  assert.throws(
    () => createShiftPlanningNotificationReleaseArtifacts({
      intent: intentFor(),
      deliverySync: completedSync("delivery"),
      marketSync: {...market, bundleDigest: digest("f")},
      releasedAt,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
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

const seed = async (overrides = {}) => {
  const member = deriveShiftPlanningMemberRevision(memberSource());
  const intent = intentFor(member);
  const batch = firestore.batch();
  batch.set(
    firestore.doc(`${root}/shiftPlanningNotificationIntents/${intent.intentId}`),
    intent,
  );
  batch.set(firestore.doc(`${root}/shiftPlanningState/current`), {
    schemaVersion: 1,
    stateRevision: 12,
    writeEpoch: 8,
    maintenanceStatus: "closed",
    activeRevision: bundleRevision,
    activeDigest: bundleDigest,
    intakeBarrier: {
      revision: "barrier-2026",
      digest: digest("9"),
      verifiedAtMillis: 1_788_393_000_000,
    },
    lastTransitionId: "request-activate-2026",
  });
  batch.set(firestore.doc(`${root}/shifts/${intent.shiftId}`), publicShift());
  batch.set(firestore.doc(`${root}/users/member-1`), {
    roles: ["member"],
    isActive: overrides.isActive ?? true,
    isCommonPurchaseManager: false,
  });
  batch.set(firestore.doc(`${root}/users/member-1/devices/device-1`), {
    fcmToken: "token-1",
    firebaseInstallationId: "fid-1",
    tokenUpdatedAt: Timestamp.fromMillis(1_788_393_000_000),
    registrationUpdatedAt: Timestamp.fromMillis(1_788_393_000_000),
  });
  batch.set(
    firestore.doc(`${root}/shiftPlanningSyncCommands/${bundleRevision}-delivery`),
    completedSync("delivery"),
  );
  batch.set(
    firestore.doc(`${root}/shiftPlanningSyncCommands/${bundleRevision}-market`),
    completedSync("market"),
  );
  await batch.commit();
  return intent;
};

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
  repository = createFirestoreShiftPlanningNotificationReleaseRepository(
    firestore,
    () => releasedAt,
  );
});

test("commits one canonical event and inbox then replays without duplicates", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const committed = await repository.release({
    environment,
    intentId: intent.intentId,
  });
  assert.equal(committed.kind, "committed");
  const replayed = await repository.release({
    environment,
    intentId: intent.intentId,
  });
  assert.equal(replayed.kind, "replayed");
  assert.deepEqual(replayed.artifacts, committed.artifacts);

  const events = await firestore.collection(`${root}/notificationEvents`).get();
  const inbox = await firestore.collection(
    `${root}/users/member-1/notificationInbox`,
  ).get();
  const receipts = await firestore.collection(
    `${root}/shiftPlanningNotificationIntents/${intent.intentId}/releases`,
  ).get();
  assert.equal(events.size, 1);
  assert.equal(inbox.size, 1);
  assert.equal(receipts.size, 1);
});

test("stale membership writes no canonical release effect", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed({isActive: false});
  await assert.rejects(
    repository.release({environment, intentId: intent.intentId}),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.equal(
    (await firestore.collection(`${root}/notificationEvents`).get()).size,
    0,
  );
  assert.equal(
    (await firestore.collection(
      `${root}/users/member-1/notificationInbox`,
    ).get()).size,
    0,
  );
});

test("stale assignment or destination writes no canonical release effect", {
  skip: !EMULATOR_HOST,
}, async () => {
  const assignmentIntent = await seed();
  await firestore.doc(`${root}/shifts/${assignmentIntent.shiftId}`).update({
    assignedUserIds: ["member-2"],
  });
  await assert.rejects(
    repository.release({environment, intentId: assignmentIntent.intentId}),
    (error) => error.code === "invalid_planning_publication_contract",
  );
  assert.equal(
    (await firestore.collection(`${root}/notificationEvents`).get()).size,
    0,
  );

  await clearFirestore();
  const destinationIntent = await seed();
  await firestore.doc(`${root}/users/member-1/devices/device-1`).update({
    fcmToken: "token-2",
  });
  await assert.rejects(
    repository.release({environment, intentId: destinationIntent.intentId}),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.equal(
    (await firestore.collection(`${root}/notificationEvents`).get()).size,
    0,
  );
});

test("partial pre-existing canonical effect fails without repair", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  await firestore.doc(`${root}/notificationEvents/${intent.intentId}`).set({
    type: "shift_updated",
  });
  await assert.rejects(
    repository.release({environment, intentId: intent.intentId}),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.equal((await firestore.doc(
    `${root}/users/member-1/notificationInbox/${intent.intentId}`,
  ).get()).exists, false);
  assert.equal((await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/${intent.intentId}/` +
      "releases/canonical",
  ).get()).exists, false);
});
