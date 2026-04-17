const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const {__testOnly} = require("../lib/index.js");

test("builds deterministic reminder ids", () => {
  assert.equal(
    __testOnly.buildOrderReminderEventId("2026-W16", 20),
    "order_reminder_2026-W16_20"
  );
  assert.equal(
    __testOnly.buildOrderReminderDispatchMarkerId("2026-W16", 20, "user_1"),
    "order_reminder_2026-W16_20_user_1"
  );
});

test("parses reminder context from event payload", () => {
  const context = __testOnly.parseOrderReminderEventContext(
    "order_reminder_2026-W16_22",
    {
      weekKey: "2026-W16",
      reminderSlotHour: 22,
    }
  );

  assert.deepEqual(context, {
    weekKey: "2026-W16",
    reminderHour: 22,
  });
});

test("parses reminder context from event id fallback", () => {
  const context = __testOnly.parseOrderReminderEventContext(
    "order_reminder_2026-W16_23",
    {}
  );

  assert.deepEqual(context, {
    weekKey: "2026-W16",
    reminderHour: 23,
  });
});

test("computes exponential backoff retry timestamps", () => {
  const previous = process.env.ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES;
  process.env.ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES = "5";

  try {
    const now = admin.firestore.Timestamp.fromMillis(1_000);
    const firstRetry = __testOnly.computeOrderReminderNextRetryAt(1, now);
    const secondRetry = __testOnly.computeOrderReminderNextRetryAt(2, now);
    const thirdRetry = __testOnly.computeOrderReminderNextRetryAt(3, now);

    assert.equal(firstRetry.toMillis(), 1_000 + 5 * 60 * 1_000);
    assert.equal(secondRetry.toMillis(), 1_000 + 10 * 60 * 1_000);
    assert.equal(thirdRetry.toMillis(), 1_000 + 20 * 60 * 1_000);
  } finally {
    if (previous === undefined) {
      delete process.env.ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES;
    } else {
      process.env.ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES = previous;
    }
  }
});

test("resolves retry-pending status when only queued retries remain", () => {
  const status = __testOnly.resolveOrderReminderRunStatus({
    processedUsersCount: 2,
    sentUsersCount: 0,
    skippedUsersCount: 0,
    failedUsersCount: 0,
    retryQueuedUsersCount: 2,
    deliveredTokensCount: 0,
    failedTokensCount: 2,
  });

  assert.equal(status, "retry_pending");
});
