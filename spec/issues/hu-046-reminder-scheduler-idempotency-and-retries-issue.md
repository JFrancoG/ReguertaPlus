# [HU-046] Reminder scheduler idempotency and retries

## Summary

As a member with commitments I want reminder jobs to run reliably and only once per slot so I can trust pending-order notifications.

## Links
- Spec: spec/notifications/hu-046-reminder-scheduler-idempotency-and-retries/spec.md
- Plan: spec/notifications/hu-046-reminder-scheduler-idempotency-and-retries/plan.md
- Tasks: spec/notifications/hu-046-reminder-scheduler-idempotency-and-retries/tasks.md

## Acceptance criteria

- Reminder jobs execute at configured weekly slots in Europe/Madrid timezone.
- A user receives at most one reminder per slot for the same target week.
- Transient failures trigger bounded retries and are observable in logs/metrics.
- Operators can inspect run-level outcomes (processed, sent, skipped, failed).

## Scope
### In Scope
- Implement story HU-046 within MVP scope.
- Satisfy linked RFs: RF-NOTI-02, RF-NOTI-03.

### Out of Scope
- Redesign of reminder content/copy.
- Full campaign-management features.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Implementation notes (2026-04-17)
- Added per-user idempotent dispatch markers at:
  `{env}/plus-collections/orderReminderDispatchMarkers/{markerId}` with
  `markerId = order_reminder_{weekKey}_{slotHH}_{userId}`.
- Added bounded retry policy for transient FCM errors:
  - max attempts (`ORDER_REMINDER_RETRY_MAX_ATTEMPTS`, default `3`)
  - exponential backoff base delay
    (`ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES`, default `15`)
  - retry batch cap (`ORDER_REMINDER_RETRY_BATCH_SIZE`, default `200`)
- Added `retryPendingOrderReminderDispatches` scheduler (every 15 minutes,
  `Europe/Madrid`) and retry run summaries at:
  `{env}/plus-collections/orderReminderRetryRuns/{runId}`.
- Extended `notificationEvents.dispatch` telemetry for order reminders with
  user-level outcomes (`processed`, `sent`, `skipped`, `failed`, `retryQueued`)
  and token counters.
- Added unit tests for slot identity and retry helpers:
  `functions/test/order-reminder-scheduler.test.cjs`.

## Suggested labels
- type:feature
- area:notifications
- platform:cross
- priority:P1

## Dependencies
- #10 (HU-006)
