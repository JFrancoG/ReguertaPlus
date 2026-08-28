"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS,
  createShiftPlanningNotificationSafeResume,
  createShiftPlanningNotificationTerminalIncident,
} = require(
  "../lib/shift-planning-notification-terminal-incident.js"
);
const {
  createShiftPlanningClaimedNotificationAttempt,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const bundleRevision = "bundle-v1-incident";
const bundleDigest = digest("a");
const enteredAtMillis = 1_788_566_400_000;
const ttlMillis = 3_600_000;
const terminalizedAtMillis = enteredAtMillis + ttlMillis;

const lease = (type, overrides = {}) => ({
  type,
  bundleId: "bundle-incident",
  bundleRevision,
  bundleDigest,
  leaseEpoch: 12,
  ownerOperationId: "activate-incident",
  state: type === "delivery" ? "releasing" : "sealed",
  acquiredAtMillis: enteredAtMillis - 120_000,
  deadlineAtMillis: enteredAtMillis - 60_000,
  ...overrides,
});

const intent = (ordinal, shiftId = `shift-${ordinal}`) => ({
  intentId: `${bundleRevision}-notification-${ordinal}`,
  idempotencyKey: `${bundleRevision}:notification:${ordinal}`,
  state: "held",
  recipientUserId: `member-${ordinal}`,
  shiftId,
  shiftType: ordinal % 2 === 0 ? "market" : "delivery",
  expectedAssignmentRevision: 1,
  expectedMembershipRevision: 4,
  expectedEligibilityRevision: 5,
  expectedDestinationRevision: 6,
  canonicalEventType: "shift_assignment_updated",
  payloadPolicy: "genericReferenceOnly",
  bundleRevision,
  bundleDigest,
  writeEpoch: 12,
});

const validation = () => ({
  assignmentRevision: 1,
  membershipRevision: 4,
  eligibilityRevision: 5,
  destinationRevision: 6,
  messagingTargets: {
    firebaseInstallationIds: [],
    fcmTokens: ["token-1"],
  },
  destinationDigest: digest("b"),
  validationDigest: digest("c"),
});

const claimedAttempt = (ordinal, attemptOrdinal = 1) =>
  createShiftPlanningClaimedNotificationAttempt({
    intentId: `${bundleRevision}-notification-${ordinal}`,
    eventId: `${bundleRevision}-notification-${ordinal}`,
    attemptId: `attempt-${ordinal}-${attemptOrdinal}`,
    workerId: "worker-incident",
    attemptOrdinal,
    acquiredAt: Timestamp.fromMillis(
      enteredAtMillis - 90_000 + ordinal * 1_000,
    ),
    validation: validation(),
  });

const submittingAttempt = (ordinal, attemptOrdinal = 1) =>
  startShiftPlanningAuthenticatedSubmission({
    attempt: claimedAttempt(ordinal, attemptOrdinal),
    startedAt: Timestamp.fromMillis(
      claimedAttempt(ordinal, attemptOrdinal).lease.acquiredAt.toMillis() +
        1_000,
    ),
  });

const terminalAttempt = (ordinal, outcome) => {
  const claimed = claimedAttempt(ordinal);
  if (outcome === "failedBeforeStart") {
    return terminalizeShiftPlanningNotificationAttempt({
      attempt: claimed,
      completedAt: Timestamp.fromMillis(
        claimed.lease.acquiredAt.toMillis() + 1_000,
      ),
      outcome: "failed",
      failureCode: "no_destination",
      acceptedTargetCount: 0,
    });
  }
  const submitting = startShiftPlanningAuthenticatedSubmission({
    attempt: claimed,
    startedAt: Timestamp.fromMillis(
      claimed.lease.acquiredAt.toMillis() + 1_000,
    ),
  });
  return terminalizeShiftPlanningNotificationAttempt({
    attempt: submitting,
    completedAt: Timestamp.fromMillis(
      outcome === "unknown" ?
        submitting.lease.expiresAt.toMillis() :
        submitting.lease.acquiredAt.toMillis() + 2_000,
    ),
    outcome: outcome === "failedAfterStart" ? "failed" : outcome,
    failureCode: outcome === "failedAfterStart" ?
      "transport_rejected" : null,
    acceptedTargetCount: outcome === "accepted" ? 1 : 0,
  });
};

const dispatchState = (ordinal, attempts, activeLease = null) => ({
  schemaVersion: 1,
  operationKind: "notificationDispatchState",
  intentId: `${bundleRevision}-notification-${ordinal}`,
  eventId: `${bundleRevision}-notification-${ordinal}`,
  attemptCount: attempts.length,
  lastLeaseEpoch: attempts.length,
  activeLease,
});

const evidence = (ordinal, attempts) => ({
  intentId: `${bundleRevision}-notification-${ordinal}`,
  dispatchState: dispatchState(ordinal, attempts),
  attempts,
});

const allIntents = [
  intent(1),
  intent(2, "shared-market-shift"),
  intent(3, "shared-market-shift"),
  intent(4),
  intent(5),
  intent(6),
  intent(7),
];

const allEvidence = [
  evidence(1, []),
  evidence(2, [claimedAttempt(2)]),
  evidence(3, [submittingAttempt(3)]),
  evidence(4, [terminalAttempt(4, "accepted")]),
  evidence(5, [terminalAttempt(5, "unknown")]),
  evidence(6, [terminalAttempt(6, "failedBeforeStart")]),
  evidence(7, [terminalAttempt(7, "failedAfterStart")]),
];

const safeResumeInput = (overrides = {}) => ({
  environment: "develop",
  incidentId: "notification-incident-1",
  ownerUserId: "operator-1",
  escalationTargetId: "operations-on-call",
  deliveryLease: lease("delivery"),
  marketLease: lease("market"),
  intents: allIntents,
  dispatchEvidence: allEvidence,
  enteredAtMillis,
  ttlMillis,
  ...overrides,
});

const cancellation = (ordinal, overrides = {}) => ({
  action: "cancelAndSupersede",
  intentId: `${bundleRevision}-notification-${ordinal}`,
  incidentId: "notification-incident-1",
  cancelledAtMillis: terminalizedAtMillis,
  ...overrides,
});

const terminalInput = (overrides = {}) => {
  const safeResume = createShiftPlanningNotificationSafeResume(
    safeResumeInput(),
  );
  return {
    safeResume,
    deliveryLease: safeResume.releaseLeaseActions[0].replacementLease,
    marketLease: safeResume.releaseLeaseActions[1].replacementLease,
    intents: allIntents,
    dispatchEvidence: allEvidence,
    cancellations: [cancellation(1), cancellation(2), cancellation(6)],
    terminalizedAtMillis,
    ...overrides,
  };
};

const errorCode = (code) => (error) => error.code === code;

test("enters bounded degraded mode and fences only affected shifts", () => {
  const result = createShiftPlanningNotificationSafeResume(
    safeResumeInput(),
  );

  assert.equal(result.state, "degraded");
  assert.equal(result.resolution, "operatorRequired");
  assert.equal(result.abandonedOwnerOperationId, "activate-incident");
  assert.equal(result.expiresAtMillis, terminalizedAtMillis);
  assert.deepEqual(
    result.intents.map(({dispatchDisposition}) => dispatchDisposition),
    [
      "pending",
      "claimed",
      "submitting",
      "accepted",
      "unknown",
      "demonstrablyUnsubmitted",
      "definitivelyFailed",
    ],
  );
  assert.deepEqual(result.affectedShiftIds, [
    "shared-market-shift",
    "shift-1",
    "shift-4",
    "shift-5",
    "shift-6",
    "shift-7",
  ]);
  assert.deepEqual(
    result.releaseLeaseActions.map(({replacementLease}) => ({
      ownerOperationId: replacementLease.ownerOperationId,
      state: replacementLease.state,
      deadlineAtMillis: replacementLease.deadlineAtMillis,
    })),
    [
      {
        ownerOperationId: "notification-incident-1",
        state: "degraded",
        deadlineAtMillis: terminalizedAtMillis,
      },
      {
        ownerOperationId: "notification-incident-1",
        state: "degraded",
        deadlineAtMillis: terminalizedAtMillis,
      },
    ],
  );
  assert.match(
    result.safeResumeDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
});

test("terminalizes only after TTL with exact unsubmitted cancellations", () => {
  const result = createShiftPlanningNotificationTerminalIncident(
    terminalInput(),
  );

  assert.equal(result.state, "terminal");
  assert.deepEqual(result.cancelledIntentIds, [
    `${bundleRevision}-notification-1`,
    `${bundleRevision}-notification-2`,
    `${bundleRevision}-notification-6`,
  ]);
  assert.deepEqual(result.possibleDeliveryIntentIds, [
    `${bundleRevision}-notification-3`,
    `${bundleRevision}-notification-4`,
    `${bundleRevision}-notification-5`,
  ]);
  assert.deepEqual(
    result.correctionRequiredIntentIds,
    result.possibleDeliveryIntentIds,
  );
  assert.deepEqual(result.definitivelyFailedIntentIds, [
    `${bundleRevision}-notification-7`,
  ]);
  assert.deepEqual(
    result.releaseLeaseActions.map(({action, type}) => ({action, type})),
    [
      {action: "clear", type: "delivery"},
      {action: "clear", type: "market"},
    ],
  );
});

test("preserves a prior unknown when a later retry was only claimed", () => {
  const unknown = terminalAttempt(2, "unknown");
  const retry = claimedAttempt(2, 2);
  const changedEvidence = allEvidence.map((item) =>
    item.intentId === `${bundleRevision}-notification-2` ?
      evidence(2, [unknown, retry]) : item);
  const result = createShiftPlanningNotificationSafeResume(safeResumeInput({
    dispatchEvidence: changedEvidence,
  }));

  assert.equal(result.intents[1].dispatchDisposition, "unknown");
  assert.equal(result.intents[1].authenticatedSubmissionPossible, true);
});

test("rejects entry before expiry, oversized TTL, and active dispatch", () => {
  assert.throws(
    () => createShiftPlanningNotificationSafeResume(safeResumeInput({
      enteredAtMillis: lease("delivery").deadlineAtMillis - 1,
    })),
    errorCode("planning_release_lease_conflict"),
  );
  assert.throws(
    () => createShiftPlanningNotificationSafeResume(safeResumeInput({
      ttlMillis:
        SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS + 1,
    })),
    errorCode("invalid_planning_transaction"),
  );
  const attempt = claimedAttempt(2);
  const activeEvidence = allEvidence.map((item) =>
    item.intentId === `${bundleRevision}-notification-2` ? {
      ...item,
      dispatchState: dispatchState(2, [attempt], attempt.lease),
    } : item);
  assert.throws(
    () => createShiftPlanningNotificationSafeResume(safeResumeInput({
      dispatchEvidence: activeEvidence,
    })),
    errorCode("planning_release_lease_conflict"),
  );
  assert.throws(
    () => createShiftPlanningNotificationSafeResume(safeResumeInput({
      deliveryLease: lease("delivery", {state: "degraded"}),
      marketLease: lease("market", {state: "degraded"}),
    })),
    errorCode("planning_release_lease_conflict"),
  );
});

test("retains both leases before TTL or with incomplete cancellation", () => {
  assert.throws(
    () => createShiftPlanningNotificationTerminalIncident(terminalInput({
      terminalizedAtMillis: terminalizedAtMillis - 1,
    })),
    errorCode("planning_release_lease_conflict"),
  );
  assert.throws(
    () => createShiftPlanningNotificationTerminalIncident(terminalInput({
      cancellations: [cancellation(1), cancellation(2)],
    })),
    errorCode("planning_release_lease_conflict"),
  );
});

test("never permits cancelling possible-delivery or definitive failure", () => {
  for (const forbiddenOrdinal of [3, 4, 5, 7]) {
    assert.throws(
      () => createShiftPlanningNotificationTerminalIncident(terminalInput({
        cancellations: [
          cancellation(1),
          cancellation(2),
          cancellation(6),
          cancellation(forbiddenOrdinal),
        ],
      })),
      errorCode("planning_release_lease_conflict"),
    );
  }
});

test("rejects canonical intent identity drift during degraded mode", () => {
  const changedIntents = allIntents.map((item) =>
    item.intentId === `${bundleRevision}-notification-3` ?
      {...item, shiftId: "drifted-shift"} : item);

  assert.throws(
    () => createShiftPlanningNotificationTerminalIncident(terminalInput({
      intents: changedIntents,
    })),
    errorCode("planning_release_lease_conflict"),
  );
});

test("is deterministic regardless of batch evidence input order", () => {
  const original = createShiftPlanningNotificationSafeResume(
    safeResumeInput(),
  );
  const reordered = createShiftPlanningNotificationSafeResume(
    safeResumeInput({
      intents: [...allIntents].reverse(),
      dispatchEvidence: [...allEvidence].reverse(),
    }),
  );

  assert.deepEqual(reordered, original);
});
