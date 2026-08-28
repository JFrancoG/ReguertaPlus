"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningClaimedNotificationAttempt,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");
const {
  createShiftPlanningNotificationResourceFences,
  parseShiftPlanningNotificationResourceFence,
  sameShiftPlanningNotificationResourceFence,
  shiftPlanningNotificationAttemptCanReleaseResourceFences,
  shiftPlanningNotificationResourceFenceId,
  shiftPlanningNotificationResourceFenceIsActive,
} = require("../lib/shift-planning-notification-resource-fence.js");

const initialMillis = 1_788_393_900_000;
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const claimedAttempt = () => createShiftPlanningClaimedNotificationAttempt({
  intentId: "intent-1",
  eventId: "event-1",
  attemptId: "attempt-1",
  workerId: "worker-1",
  attemptOrdinal: 1,
  acquiredAt: Timestamp.fromMillis(initialMillis),
  validation: {
    recipientUserId: "member-1",
    shiftId: "shift-1",
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
  },
});

test("creates exact deterministic member and shift resource fences", () => {
  const attempt = claimedAttempt();
  const fences = createShiftPlanningNotificationResourceFences({
    attempt,
    recipientUserId: "member-1",
    shiftId: "shift-1",
  });
  assert.equal(fences.length, 2);
  assert.equal(
    shiftPlanningNotificationResourceFenceId("member", "member-1"),
    "member:member-1",
  );
  assert.equal(
    shiftPlanningNotificationResourceFenceId("shift", "shift-1"),
    "shift:shift-1",
  );
  assert.deepEqual(fences.map(({scope, resourceId}) => ({scope, resourceId})), [
    {scope: "member", resourceId: "member-1"},
    {scope: "shift", resourceId: "shift-1"},
  ]);
  for (const fence of fences) {
    assert.equal(
      sameShiftPlanningNotificationResourceFence(
        parseShiftPlanningNotificationResourceFence(fence),
        fence,
      ),
      true,
    );
    assert.equal(
      shiftPlanningNotificationResourceFenceIsActive(
        fence,
        Timestamp.fromMillis(initialMillis + 29_999),
      ),
      true,
    );
    assert.equal(
      shiftPlanningNotificationResourceFenceIsActive(
        fence,
        Timestamp.fromMillis(initialMillis + 30_000),
      ),
      false,
    );
  }
});

test("retains only ambiguous terminal resource fences through expiry", () => {
  const claimed = claimedAttempt();
  const failed = terminalizeShiftPlanningNotificationAttempt({
    attempt: claimed,
    completedAt: Timestamp.fromMillis(initialMillis + 1_000),
    outcome: "failed",
    failureCode: "no_destination",
    acceptedTargetCount: 0,
  });
  assert.equal(
    shiftPlanningNotificationAttemptCanReleaseResourceFences(failed),
    true,
  );

  const unknown = terminalizeShiftPlanningNotificationAttempt({
    attempt: startShiftPlanningAuthenticatedSubmission({
      attempt: claimed,
      startedAt: Timestamp.fromMillis(initialMillis + 1_000),
    }),
    completedAt: Timestamp.fromMillis(initialMillis + 2_000),
    outcome: "unknown",
    failureCode: "transport_timeout",
    acceptedTargetCount: 0,
  });
  assert.equal(
    shiftPlanningNotificationAttemptCanReleaseResourceFences(unknown),
    false,
  );
});

test("rejects resource-fence schema and lease drift", () => {
  const [fence] = createShiftPlanningNotificationResourceFences({
    attempt: claimedAttempt(),
    recipientUserId: "member-1",
    shiftId: "shift-1",
  });
  assert.throws(
    () => parseShiftPlanningNotificationResourceFence({
      ...fence,
      expiresAt: Timestamp.fromMillis(initialMillis + 29_999),
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.throws(
    () => parseShiftPlanningNotificationResourceFence({
      ...fence,
      rawError: "must not persist",
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
});
