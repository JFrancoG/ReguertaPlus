"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningNotificationBatchReconciliation,
} = require(
  "../lib/shift-planning-notification-batch-reconciliation.js"
);
const {
  createShiftPlanningClaimedNotificationAttempt,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const bundleRevision = "bundle-v1-terminal";
const bundleDigest = digest("a");
const reconciledAtMillis = 1_788_480_100_000;

const lease = (type, overrides = {}) => ({
  type,
  bundleId: "bundle-terminal",
  bundleRevision,
  bundleDigest,
  leaseEpoch: 9,
  ownerOperationId: "activate-terminal",
  state: type === "delivery" ? "releasing" : "degraded",
  acquiredAtMillis: 1_788_480_000_000,
  deadlineAtMillis: 1_788_480_060_000,
  ...overrides,
});

const intent = (ordinal, shiftType = "delivery") => ({
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
    workerId: "worker-terminal",
    attemptOrdinal,
    acquiredAt: Timestamp.fromMillis(
      1_788_480_010_000 + ordinal * 1_000,
    ),
    validation: validation(),
  });

const terminalAttempt = (ordinal, outcome) => {
  const claimed = claimedAttempt(ordinal);
  if (outcome === "failed") {
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
  const failedAfterStart = outcome === "failedAfterStart";
  return terminalizeShiftPlanningNotificationAttempt({
    attempt: submitting,
    completedAt: Timestamp.fromMillis(
      outcome === "unknown" ?
        claimed.lease.expiresAt.toMillis() :
        claimed.lease.acquiredAt.toMillis() + 2_000,
    ),
    outcome: outcome === "unknown" ? "accepted" :
      failedAfterStart ? "failed" : outcome,
    failureCode: failedAfterStart ? "transport_rejected" : null,
    acceptedTargetCount: failedAfterStart ? 0 : 1,
  });
};

const input = (overrides = {}) => ({
  environment: "develop",
  reconciliationId: "reconcile-terminal-1",
  deliveryLease: lease("delivery"),
  marketLease: lease("market"),
  intents: [
    intent(1),
    intent(2, "market"),
    intent(3),
    intent(4, "market"),
  ],
  attemptHistories: [
    {intentId: `${bundleRevision}-notification-1`, attempts: [
      terminalAttempt(1, "accepted"),
    ]},
    {intentId: `${bundleRevision}-notification-2`, attempts: [
      terminalAttempt(2, "unknown"),
    ]},
    {intentId: `${bundleRevision}-notification-3`, attempts: [
      terminalAttempt(3, "failed"),
    ]},
    {intentId: `${bundleRevision}-notification-4`, attempts: [
      terminalAttempt(4, "failedAfterStart"),
    ]},
  ],
  reconciledAtMillis,
  ...overrides,
});

const errorCode = (code) => (error) => error.code === code;

test("plans one terminal reconciliation and clears both exact leases", () => {
  const result = createShiftPlanningNotificationBatchReconciliation(input());

  assert.equal(result.state, "terminal");
  assert.equal(result.resolution, "reconciled");
  assert.deepEqual(result.possibleDeliveryIntentIds, [
    `${bundleRevision}-notification-1`,
    `${bundleRevision}-notification-2`,
  ]);
  assert.deepEqual(result.demonstrablyUnsubmittedIntentIds, [
    `${bundleRevision}-notification-3`,
  ]);
  assert.deepEqual(
    result.intents.map(({disposition}) => disposition),
    [
      "accepted",
      "unknown",
      "demonstrablyUnsubmitted",
      "definitivelyFailed",
    ],
  );
  assert.deepEqual(result.definitivelyFailedIntentIds, [
    `${bundleRevision}-notification-4`,
  ]);
  assert.deepEqual(result.releaseLeaseActions, [
    {action: "clear", type: "delivery", expectedLease: lease("delivery")},
    {action: "clear", type: "market", expectedLease: lease("market")},
  ]);
  assert.match(
    result.reconciliationDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
});

test("is deterministic regardless of evidence input order", () => {
  const original = input();
  const reordered = input({
    intents: [...original.intents].reverse(),
    attemptHistories: [...original.attemptHistories].reverse(),
  });

  assert.deepEqual(
    createShiftPlanningNotificationBatchReconciliation(original),
    createShiftPlanningNotificationBatchReconciliation(reordered),
  );
});

test("rejects pending, claimed, or submitting intent history", () => {
  for (const attempts of [
    [],
    [claimedAttempt(1)],
    [startShiftPlanningAuthenticatedSubmission({
      attempt: claimedAttempt(1),
      startedAt: Timestamp.fromMillis(1_788_480_012_000),
    })],
  ]) {
    const value = input();
    value.attemptHistories[0] = {
      intentId: `${bundleRevision}-notification-1`,
      attempts,
    };
    assert.throws(
      () => createShiftPlanningNotificationBatchReconciliation(value),
      errorCode("planning_release_lease_conflict"),
    );
  }
});

test("rejects incomplete or duplicate intent evidence", () => {
  const missing = input();
  missing.attemptHistories.pop();
  assert.throws(
    () => createShiftPlanningNotificationBatchReconciliation(missing),
    errorCode("invalid_planning_transaction"),
  );

  const duplicate = input();
  duplicate.attemptHistories[2] = duplicate.attemptHistories[1];
  assert.throws(
    () => createShiftPlanningNotificationBatchReconciliation(duplicate),
    errorCode("invalid_planning_transaction"),
  );
});

test("rejects lease ownership, lineage, and intent epoch drift", () => {
  for (const value of [
    input({marketLease: lease("market", {ownerOperationId: "other-owner"})}),
    input({marketLease: lease("market", {bundleDigest: digest("d")})}),
    input({marketLease: lease("market", {leaseEpoch: 10})}),
    (() => {
      const changed = input();
      changed.intents[1] = {...changed.intents[1], writeEpoch: 10};
      return changed;
    })(),
  ]) {
    assert.throws(
      () => createShiftPlanningNotificationBatchReconciliation(value),
      errorCode("planning_release_lease_conflict"),
    );
  }
});
