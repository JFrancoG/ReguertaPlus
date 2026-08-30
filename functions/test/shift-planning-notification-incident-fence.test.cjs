"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningNotificationIncidentShiftFence,
  parseShiftPlanningNotificationIncidentShiftFence,
  sameShiftPlanningNotificationIncidentShiftFence,
  shiftPlanningNotificationIncidentShiftFenceId,
  shiftPlanningNotificationIncidentShiftFenceIsActive,
} = require(
  "../lib/shift-planning-notification-incident-fence.js"
);

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const enteredAtMillis = 1_788_652_800_000;

const safeResume = (overrides = {}) => ({
  schemaVersion: 1,
  operationKind: "notificationSafeResume",
  incidentId: "incident-fence-1",
  environment: "develop",
  state: "degraded",
  resolution: "operatorRequired",
  bundleId: "bundle-fence",
  bundleRevision: "bundle-fence-v1",
  bundleDigest: digest("a"),
  writeEpoch: 7,
  abandonedOwnerOperationId: "activation-fence",
  ownerUserId: "operator-fence",
  escalationTargetId: "operations-on-call",
  enteredAtMillis,
  expiresAtMillis: enteredAtMillis + 3_600_000,
  intents: [],
  affectedShiftIds: ["shift-1", "shift-2"],
  releaseLeaseActions: [],
  safeResumeDigest: digest("b"),
  ...overrides,
});

test("derives one exact incident fence from the safe-resume scope", () => {
  const fence = createShiftPlanningNotificationIncidentShiftFence({
    safeResume: safeResume(),
    shiftId: "shift-1",
  });

  assert.equal(fence.operationKind, "notificationIncidentShiftFence");
  assert.equal(fence.shiftId, "shift-1");
  assert.equal(fence.incidentId, "incident-fence-1");
  assert.equal(fence.acquiredAt.toMillis(), enteredAtMillis);
  assert.equal(fence.expiresAt.toMillis(), enteredAtMillis + 3_600_000);
  assert.equal(
    shiftPlanningNotificationIncidentShiftFenceId("shift-1"),
    "shift:shift-1",
  );
  assert.equal(
    shiftPlanningNotificationIncidentShiftFenceIsActive(
      fence,
      Timestamp.fromMillis(enteredAtMillis),
    ),
    true,
  );
  assert.equal(
    shiftPlanningNotificationIncidentShiftFenceIsActive(
      fence,
      Timestamp.fromMillis(enteredAtMillis + 3_600_000),
    ),
    false,
  );
});

test("round-trips exact evidence and rejects scope drift", () => {
  const fence = createShiftPlanningNotificationIncidentShiftFence({
    safeResume: safeResume(),
    shiftId: "shift-2",
  });

  assert.equal(
    sameShiftPlanningNotificationIncidentShiftFence(
      fence,
      parseShiftPlanningNotificationIncidentShiftFence(fence),
    ),
    true,
  );
  assert.throws(
    () => createShiftPlanningNotificationIncidentShiftFence({
      safeResume: safeResume(),
      shiftId: "shift-3",
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
});

test("rejects malformed fields and a duration beyond 24 hours", () => {
  const fence = createShiftPlanningNotificationIncidentShiftFence({
    safeResume: safeResume(),
    shiftId: "shift-1",
  });
  for (const value of [
    {...fence, unexpected: true},
    {...fence, shiftId: "invalid/shift"},
    {
      ...fence,
      expiresAt: Timestamp.fromMillis(
        enteredAtMillis + 86_400_000 + 1,
      ),
    },
  ]) {
    assert.throws(
      () => parseShiftPlanningNotificationIncidentShiftFence(value),
      (error) => error.code === "invalid_planning_transaction",
    );
  }
});
