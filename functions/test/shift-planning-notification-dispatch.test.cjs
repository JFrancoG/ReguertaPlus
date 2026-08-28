"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");

const {
  createFirestoreShiftPlanningNotificationDispatchRepository,
} = require(
  "../lib/shift-planning-firestore-notification-dispatch-repository.js"
);
const {
  createShiftPlanningNotificationDispatchExecutor,
} = require(
  "../lib/shift-planning-notification-dispatch-executor.js"
);
const {
  createShiftPlanningClaimedNotificationAttempt,
  deriveShiftPlanningNotificationDispatchAggregate,
  genericShiftPlanningPush,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");
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

const PROJECT_ID = "demo-reguerta-hu082-notification-dispatch";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const environment = "develop";
const root = `${environment}/plus-collections`;
const bundleRevision = "bundle-v2-1234567890abcdef12345678";
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const bundleDigest = digest("a");
const initialMillis = 1_788_393_900_000;
const releasedAt = Timestamp.fromMillis(initialMillis - 60_000);

const memberSource = () => ({
  userId: "member-1",
  roles: ["member"],
  isActive: true,
  isCommonPurchaseManager: false,
  devices: [{
    deviceId: "device-1",
    fcmToken: "token-1",
    firebaseInstallationId: "fid-1",
    tokenUpdatedAt: Timestamp.fromMillis(initialMillis - 120_000),
    registrationUpdatedAt: Timestamp.fromMillis(initialMillis - 120_000),
  }],
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
      acquiredAt: Timestamp.fromMillis(initialMillis - 240_000),
      expiresAt: Timestamp.fromMillis(initialMillis - 120_000),
    },
  });
  return createShiftPlanningCompletedSyncCommand({
    command: processing,
    completedAt: Timestamp.fromMillis(initialMillis - 180_000),
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
  const attemptedAt = Timestamp.fromMillis(initialMillis - 300_000);
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
    attemptedAt,
  });
  const operation = createShiftPlanningActivationOperationTerminal({
    operationId: "activate-operation-1",
    environment,
    requestId: "activate-request-1",
    candidateId: "bundle-candidate-1",
    bundleRevision,
    bundleDigest,
    forwardManifestDigest: digest("b"),
    expectedStateDigest: digest("c"),
    writeEpoch: 8,
    attemptedAt,
    publicMutations: [{
      mutationKind: "create",
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    }],
    beforeImages: [],
  });
  return attachShiftPlanningBackendMutationMarker({materialization, operation});
};

const validation = () => ({
  recipientUserId: "member-1",
  shiftId: "shift_delivery_20260902",
  shiftType: "delivery",
  assignmentRevision: 1,
  membershipRevision: 2,
  eligibilityRevision: 3,
  destinationRevision: 4,
  destinationDigest: digest("d"),
  messagingTargets: {
    firebaseInstallationIds: ["fid-1"],
    fcmTokens: ["token-1"],
  },
  validationDigest: digest("f"),
});

test("derives accepted and sticky unknown state from append-only attempts", () => {
  const claimed = createShiftPlanningClaimedNotificationAttempt({
    intentId: "intent-1",
    eventId: "event-1",
    attemptId: "attempt-1",
    workerId: "worker-1",
    attemptOrdinal: 1,
    acquiredAt: Timestamp.fromMillis(initialMillis),
    validation: validation(),
  });
  const submitting = startShiftPlanningAuthenticatedSubmission({
    attempt: claimed,
    startedAt: Timestamp.fromMillis(initialMillis + 1_000),
  });
  const unknown = terminalizeShiftPlanningNotificationAttempt({
    attempt: submitting,
    completedAt: Timestamp.fromMillis(initialMillis + 30_000),
    outcome: "accepted",
    failureCode: null,
    acceptedTargetCount: 1,
  });
  assert.equal(unknown.terminal.outcome, "unknown");
  assert.equal(unknown.terminal.possiblyDelivered, true);

  const retry = createShiftPlanningClaimedNotificationAttempt({
    intentId: "intent-1",
    eventId: "event-1",
    attemptId: "attempt-2",
    workerId: "worker-2",
    attemptOrdinal: 2,
    acquiredAt: Timestamp.fromMillis(initialMillis + 31_000),
    validation: validation(),
  });
  const failedRetry = terminalizeShiftPlanningNotificationAttempt({
    attempt: retry,
    completedAt: Timestamp.fromMillis(initialMillis + 32_000),
    outcome: "failed",
    failureCode: "no_destination",
    acceptedTargetCount: 0,
  });
  assert.equal(
    deriveShiftPlanningNotificationDispatchAggregate([unknown, failedRetry]),
    "unknown",
  );

  const acceptedRetry = terminalizeShiftPlanningNotificationAttempt({
    attempt: startShiftPlanningAuthenticatedSubmission({
      attempt: retry,
      startedAt: Timestamp.fromMillis(initialMillis + 32_000),
    }),
    completedAt: Timestamp.fromMillis(initialMillis + 33_000),
    outcome: "accepted",
    failureCode: null,
    acceptedTargetCount: 1,
  });
  assert.equal(
    deriveShiftPlanningNotificationDispatchAggregate([unknown, acceptedRetry]),
    "accepted",
  );
});

test("builds only a stable generic event-reference push", () => {
  const push = genericShiftPlanningPush("event-1");
  assert.deepEqual(push, {
    collapseKey: "event-1",
    notification: {
      title: "Turnos actualizados",
      body: "Consulta la aplicación para ver la información actualizada.",
    },
    data: {eventId: "event-1", type: "shift_updated", target: "users"},
  });
  assert.equal(JSON.stringify(push).includes("member-1"), false);
  assert.equal(JSON.stringify(push).includes("20260902"), false);
});

let firestore;
let nowMillis;
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
  const source = memberSource();
  const member = deriveShiftPlanningMemberRevision(source);
  const intent = intentFor(member);
  const deliverySync = completedSync("delivery");
  const marketSync = completedSync("market");
  const release = createShiftPlanningNotificationReleaseArtifacts({
    intent,
    deliverySync,
    marketSync,
    releasedAt,
  });
  const batch = firestore.batch();
  const intentPath = `${root}/shiftPlanningNotificationIntents/${intent.intentId}`;
  batch.set(firestore.doc(intentPath), intent);
  batch.set(firestore.doc(`${intentPath}/releases/canonical`), release.receipt);
  batch.set(firestore.doc(`${root}/notificationEvents/${release.eventId}`), release.event);
  batch.set(firestore.doc(
    `${root}/users/member-1/notificationInbox/${release.eventId}`,
  ), release.inbox);
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
      verifiedAtMillis: initialMillis - 600_000,
    },
    lastTransitionId: "request-activate-2026",
  });
  batch.set(firestore.doc(`${root}/shifts/${intent.shiftId}`), publicShift());
  batch.set(firestore.doc(`${root}/users/member-1`), {
    roles: source.roles,
    isActive: source.isActive,
    isCommonPurchaseManager: source.isCommonPurchaseManager,
  });
  batch.set(firestore.doc(`${root}/users/member-1/devices/device-1`), {
    fcmToken: source.devices[0].fcmToken,
    firebaseInstallationId: source.devices[0].firebaseInstallationId,
    tokenUpdatedAt: source.devices[0].tokenUpdatedAt,
    registrationUpdatedAt: source.devices[0].registrationUpdatedAt,
  });
  batch.set(
    firestore.doc(`${root}/shiftPlanningSyncCommands/${bundleRevision}-delivery`),
    deliverySync,
  );
  batch.set(
    firestore.doc(`${root}/shiftPlanningSyncCommands/${bundleRevision}-market`),
    marketSync,
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
  nowMillis = initialMillis;
  repository = createFirestoreShiftPlanningNotificationDispatchRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis),
  );
});

test("claims, revalidates, submits, and terminalizes one accepted attempt", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const claimed = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  assert.equal(claimed.kind, "claimed");
  const replay = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  assert.equal(replay.kind, "replayed");
  const busy = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-2",
    attemptId: "dispatch-attempt-2",
  });
  assert.equal(busy.kind, "busy");

  nowMillis += 1_000;
  const authorized = await repository.authorizeAuthenticatedSubmission({
    environment,
    token: claimed.token,
  });
  assert.deepEqual(authorized.targets, {
    firebaseInstallationIds: ["fid-1"],
    fcmTokens: ["token-1"],
  });
  assert.deepEqual(authorized.push.data, {
    eventId: intent.intentId,
    type: "shift_updated",
    target: "users",
  });
  nowMillis += 1_000;
  const completed = await repository.completeSubmission({
    environment,
    token: authorized.token,
    result: {outcome: "accepted", acceptedTargetCount: 2},
  });
  assert.equal(completed.kind, "committed");
  assert.equal(completed.attempt.terminal.outcome, "accepted");

  nowMillis += 60_000;
  const lateReplay = await repository.completeSubmission({
    environment,
    token: authorized.token,
    result: {outcome: "unknown", failureCode: "late_transport_result"},
  });
  assert.equal(lateReplay.kind, "terminalReplay");
  assert.equal(lateReplay.attempt.terminal.outcome, "accepted");
});

test("expires submitting as immutable unknown before a revalidated retry", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const first = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  nowMillis += 1_000;
  await repository.authorizeAuthenticatedSubmission({
    environment,
    token: first.token,
  });
  nowMillis += 30_000;
  const retry = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-2",
    attemptId: "dispatch-attempt-2",
  });
  assert.equal(retry.kind, "claimed");
  assert.equal(retry.attempt.attemptOrdinal, 2);
  const firstSnapshot = await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/${intent.intentId}/` +
      "dispatchAttempts/dispatch-attempt-1",
  ).get();
  assert.equal(firstSnapshot.get("terminal.outcome"), "unknown");
  assert.equal(firstSnapshot.get("terminal.possiblyDelivered"), true);

  const late = await repository.completeSubmission({
    environment,
    token: first.token,
    result: {outcome: "accepted", acceptedTargetCount: 2},
  });
  assert.equal(late.kind, "terminalReplay");
  assert.equal(late.attempt.terminal.outcome, "unknown");
});

test("expires an unsubmitted lease as failed before takeover", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  nowMillis += 30_000;
  const retry = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-2",
    attemptId: "dispatch-attempt-2",
  });
  assert.equal(retry.kind, "claimed");
  const expired = await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/${intent.intentId}/` +
      "dispatchAttempts/dispatch-attempt-1",
  ).get();
  assert.equal(expired.get("authenticatedStartedAt"), null);
  assert.equal(expired.get("terminal.outcome"), "failed");
  assert.equal(
    expired.get("terminal.failureCode"),
    "lease_expired_before_submission",
  );
  assert.equal(expired.get("terminal.possiblyDelivered"), false);
});

test("rejects destination drift before authenticated submission", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const claimed = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  await firestore.doc(`${root}/users/member-1/devices/device-1`).update({
    fcmToken: "token-2",
  });
  nowMillis += 1_000;
  await assert.rejects(
    repository.authorizeAuthenticatedSubmission({
      environment,
      token: claimed.token,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  const snapshot = await firestore.doc(
    `${root}/shiftPlanningNotificationIntents/${intent.intentId}/` +
      "dispatchAttempts/dispatch-attempt-1",
  ).get();
  assert.equal(snapshot.get("state"), "claimed");
  assert.equal(snapshot.get("authenticatedStartedAt"), null);
});

test("terminalizes an unsubmitted attempt without possible delivery", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const claimed = await repository.claim({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  const failed = await repository.failBeforeSubmission({
    environment,
    token: claimed.token,
    failureCode: "no_destination",
  });
  assert.equal(failed.kind, "committed");
  assert.equal(failed.attempt.authenticatedStartedAt, null);
  assert.equal(failed.attempt.terminal.outcome, "failed");
  assert.equal(failed.attempt.terminal.possiblyDelivered, false);
});

test("bounded executor persists an accepted fake transport result", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const executor = createShiftPlanningNotificationDispatchExecutor({
    repository,
    transport: {
      async submit(request) {
        assert.deepEqual(request.push.data, {
          eventId: intent.intentId,
          type: "shift_updated",
          target: "users",
        });
        return {outcome: "accepted", acceptedTargetCount: 2};
      },
    },
    nowMillis: () => nowMillis,
    transportTimeoutMillis: 10,
  });
  const result = await executor.execute({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  assert.equal(result.kind, "completed");
  assert.equal(result.attempt.terminal.outcome, "accepted");
});

test("bounded executor persists a timed-out fake transport as unknown", {
  skip: !EMULATOR_HOST,
}, async () => {
  const intent = await seed();
  const executor = createShiftPlanningNotificationDispatchExecutor({
    repository,
    transport: {submit: () => new Promise(() => {})},
    nowMillis: () => nowMillis,
    transportTimeoutMillis: 5,
  });
  const result = await executor.execute({
    environment,
    intentId: intent.intentId,
    workerId: "dispatch-worker-1",
    attemptId: "dispatch-attempt-1",
  });
  assert.equal(result.kind, "completed");
  assert.equal(result.attempt.terminal.outcome, "unknown");
  assert.equal(result.attempt.terminal.failureCode, "transport_timeout");
  assert.equal(result.attempt.terminal.possiblyDelivered, true);
});
