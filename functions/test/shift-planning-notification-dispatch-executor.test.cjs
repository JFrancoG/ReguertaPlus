"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  createFirebaseShiftPlanningNotificationTransport,
} = require("../lib/shift-planning-firebase-notification-transport.js");
const {
  createShiftPlanningNotificationDispatchExecutor,
} = require("../lib/shift-planning-notification-dispatch-executor.js");
const {
  createShiftPlanningClaimedNotificationAttempt,
  genericShiftPlanningPush,
  notificationDispatchToken,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} = require("../lib/shift-planning-notification-dispatch.js");

const initialMillis = 1_788_393_900_000;
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const validation = (targetCount = 2) => ({
  recipientUserId: "member-1",
  shiftId: "shift_delivery_20260902",
  shiftType: "delivery",
  assignmentRevision: 1,
  membershipRevision: 2,
  eligibilityRevision: 3,
  destinationRevision: 4,
  destinationDigest: digest("d"),
  messagingTargets: {
    firebaseInstallationIds: targetCount > 1 ? ["fid-1"] : [],
    fcmTokens: targetCount > 0 ? ["token-1"] : [],
  },
  validationDigest: digest("f"),
});

const successfulResponse = (count) => ({
  successCount: count,
  failureCount: 0,
  responses: Array.from({length: count}, (_, index) => ({
    success: true,
    messageId: `message-${index + 1}`,
  })),
});

const failedResponse = (count) => ({
  successCount: 0,
  failureCount: count,
  responses: Array.from({length: count}, () => ({
    success: false,
    error: {code: "messaging/registration-token-not-registered"},
  })),
});

const transportRequest = () => ({
  push: genericShiftPlanningPush("event-1"),
  targets: {
    firebaseInstallationIds: ["fid-1"],
    fcmTokens: ["token-1"],
  },
});

test("Firebase transport sends only generic collapsed token and FID messages", async () => {
  const calls = [];
  const transport = createFirebaseShiftPlanningNotificationTransport({
    async sendEachForMulticast(message) {
      calls.push(message);
      return successfulResponse(1);
    },
  });
  const result = await transport.submit(transportRequest());

  assert.deepEqual(result, {outcome: "accepted", acceptedTargetCount: 2});
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].tokens, ["token-1"]);
  assert.equal("fids" in calls[0], false);
  assert.deepEqual(calls[1].fids, ["fid-1"]);
  assert.equal("tokens" in calls[1], false);
  for (const message of calls) {
    assert.deepEqual(message.notification, {
      title: "Turnos actualizados",
      body: "Consulta la aplicación para ver la información actualizada.",
    });
    assert.deepEqual(message.data, {
      eventId: "event-1",
      type: "shift_updated",
      target: "users",
    });
    assert.equal(message.android.collapseKey, "event-1");
    assert.equal(message.apns.headers["apns-collapse-id"], "event-1");
    assert.equal(JSON.stringify(message).includes("member-1"), false);
    assert.equal(JSON.stringify(message).includes("20260902"), false);
  }
});

test("Firebase transport distinguishes explicit rejection from ambiguity", async () => {
  const rejected = createFirebaseShiftPlanningNotificationTransport({
    async sendEachForMulticast() {
      return failedResponse(1);
    },
  });
  assert.deepEqual(await rejected.submit(transportRequest()), {
    outcome: "failed",
    failureCode: "all_targets_rejected",
  });

  const mismatch = createFirebaseShiftPlanningNotificationTransport({
    async sendEachForMulticast() {
      return {successCount: 0, failureCount: 0, responses: []};
    },
  });
  assert.deepEqual(await mismatch.submit(transportRequest()), {
    outcome: "unknown",
    failureCode: "transport_response_mismatch",
  });
});

test("Firebase transport preserves known acceptance across a later error", async () => {
  let callCount = 0;
  const transport = createFirebaseShiftPlanningNotificationTransport({
    async sendEachForMulticast() {
      callCount += 1;
      if (callCount === 1) return successfulResponse(1);
      throw new Error("private transport detail");
    },
  });
  assert.deepEqual(await transport.submit(transportRequest()), {
    outcome: "accepted",
    acceptedTargetCount: 1,
  });
});

const harness = (options = {}) => {
  const currentValidation = validation(options.targetCount ?? 2);
  const claimed = createShiftPlanningClaimedNotificationAttempt({
    intentId: "intent-1",
    eventId: "event-1",
    attemptId: "attempt-1",
    workerId: "worker-1",
    attemptOrdinal: 1,
    acquiredAt: Timestamp.fromMillis(initialMillis),
    validation: currentValidation,
  });
  const calls = {authorize: 0, complete: [], fail: 0, transport: 0};
  const repository = {
    async claim() {
      if (options.claimResult) return options.claimResult;
      return {
        kind: "claimed",
        attempt: claimed,
        token: notificationDispatchToken(claimed),
      };
    },
    async authorizeAuthenticatedSubmission({token}) {
      calls.authorize += 1;
      const attempt = startShiftPlanningAuthenticatedSubmission({
        attempt: claimed,
        startedAt: Timestamp.fromMillis(initialMillis + 1_000),
      });
      return {
        attempt,
        token: notificationDispatchToken(attempt),
        push: genericShiftPlanningPush("event-1"),
        targets: currentValidation.messagingTargets,
      };
    },
    async failBeforeSubmission({failureCode}) {
      calls.fail += 1;
      const attempt = terminalizeShiftPlanningNotificationAttempt({
        attempt: claimed,
        completedAt: Timestamp.fromMillis(initialMillis + 1_000),
        outcome: "failed",
        failureCode,
        acceptedTargetCount: 0,
      });
      return {kind: "committed", attempt};
    },
    async completeSubmission({result}) {
      calls.complete.push(result);
      const submitting = startShiftPlanningAuthenticatedSubmission({
        attempt: claimed,
        startedAt: Timestamp.fromMillis(initialMillis + 1_000),
      });
      const attempt = terminalizeShiftPlanningNotificationAttempt({
        attempt: submitting,
        completedAt: Timestamp.fromMillis(initialMillis + 2_000),
        outcome: result.outcome,
        failureCode: result.failureCode ?? null,
        acceptedTargetCount: result.acceptedTargetCount ?? 0,
      });
      return {kind: "committed", attempt};
    },
  };
  const transport = {
    async submit(request) {
      calls.transport += 1;
      return options.submit(request);
    },
  };
  const executor = createShiftPlanningNotificationDispatchExecutor({
    repository,
    transport,
    nowMillis: () => options.nowMillis ?? initialMillis + 1_000,
    transportTimeoutMillis: options.timeoutMillis ?? 10,
  });
  return {calls, executor};
};

const execute = (executor) => executor.execute({
  environment: "develop",
  intentId: "intent-1",
  workerId: "worker-1",
  attemptId: "attempt-1",
});

test("executor persists accepted and definitive failed outcomes", async () => {
  const accepted = harness({
    submit: async () => ({outcome: "accepted", acceptedTargetCount: 2}),
  });
  const acceptedResult = await execute(accepted.executor);
  assert.equal(acceptedResult.kind, "completed");
  assert.equal(acceptedResult.attempt.terminal.outcome, "accepted");

  const failed = harness({
    submit: async () => ({
      outcome: "failed",
      failureCode: "all_targets_rejected",
    }),
  });
  const failedResult = await execute(failed.executor);
  assert.equal(failedResult.attempt.terminal.outcome, "failed");
  assert.equal(failedResult.attempt.terminal.possiblyDelivered, false);
});

test("executor turns timeout and thrown transport into unknown", async () => {
  let resolveLateTransport;
  const timedOut = harness({
    timeoutMillis: 5,
    submit: () => new Promise((resolve) => {
      resolveLateTransport = resolve;
    }),
  });
  const timeoutResult = await execute(timedOut.executor);
  assert.equal(timeoutResult.attempt.terminal.outcome, "unknown");
  assert.deepEqual(timedOut.calls.complete, [{
    outcome: "unknown",
    failureCode: "transport_timeout",
  }]);
  resolveLateTransport({outcome: "accepted", acceptedTargetCount: 2});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(timedOut.calls.complete.length, 1);

  const rejected = harness({
    submit: async () => {
      throw new Error("private transport detail");
    },
  });
  const rejectedResult = await execute(rejected.executor);
  assert.equal(rejectedResult.attempt.terminal.outcome, "unknown");
  assert.deepEqual(rejected.calls.complete, [{
    outcome: "unknown",
    failureCode: "transport_ambiguous_error",
  }]);
});

test("executor rejects malformed acknowledgement as unknown", async () => {
  const invalid = harness({
    submit: async () => ({outcome: "accepted", acceptedTargetCount: 3}),
  });
  const result = await execute(invalid.executor);
  assert.equal(result.attempt.terminal.outcome, "unknown");
  assert.deepEqual(invalid.calls.complete, [{
    outcome: "unknown",
    failureCode: "transport_response_invalid",
  }]);

  const unapprovedCode = harness({
    submit: async () => ({
      outcome: "unknown",
      failureCode: "private_transport_detail",
    }),
  });
  await execute(unapprovedCode.executor);
  assert.deepEqual(unapprovedCode.calls.complete, [{
    outcome: "unknown",
    failureCode: "transport_response_invalid",
  }]);
});

test("executor fails empty destinations before authenticated submission", async () => {
  const empty = harness({targetCount: 0, submit: async () => assert.fail()});
  const result = await execute(empty.executor);
  assert.equal(result.attempt.terminal.outcome, "failed");
  assert.equal(empty.calls.fail, 1);
  assert.equal(empty.calls.authorize, 0);
  assert.equal(empty.calls.transport, 0);
});

test("executor consumes no transport after its authenticated lease budget", async () => {
  const expired = harness({
    nowMillis: initialMillis + 30_000,
    submit: async () => assert.fail(),
  });
  const result = await execute(expired.executor);
  assert.equal(result.attempt.terminal.outcome, "unknown");
  assert.equal(expired.calls.transport, 0);
  assert.deepEqual(expired.calls.complete, [{
    outcome: "unknown",
    failureCode: "lease_budget_exhausted",
  }]);
});

test("executor short-circuits busy and terminal claim results", async () => {
  const busy = harness({
    claimResult: {
      kind: "busy",
      retryAt: Timestamp.fromMillis(initialMillis + 30_000),
    },
    submit: async () => assert.fail(),
  });
  assert.deepEqual(await execute(busy.executor), {
    kind: "busy",
    retryAtMillis: initialMillis + 30_000,
  });
  assert.equal(busy.calls.transport, 0);

  const terminalAttempt = terminalizeShiftPlanningNotificationAttempt({
    attempt: createShiftPlanningClaimedNotificationAttempt({
      intentId: "intent-1",
      eventId: "event-1",
      attemptId: "attempt-1",
      workerId: "worker-1",
      attemptOrdinal: 1,
      acquiredAt: Timestamp.fromMillis(initialMillis),
      validation: validation(),
    }),
    completedAt: Timestamp.fromMillis(initialMillis + 1_000),
    outcome: "failed",
    failureCode: "no_destination",
    acceptedTargetCount: 0,
  });
  const replay = harness({
    claimResult: {kind: "terminalReplay", attempt: terminalAttempt},
    submit: async () => assert.fail(),
  });
  const result = await execute(replay.executor);
  assert.equal(result.kind, "terminalReplay");
  assert.equal(replay.calls.transport, 0);
});
