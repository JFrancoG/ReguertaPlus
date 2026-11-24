# ADR-0019: Coordinate coverage projections and notifications

## Status

Accepted for the implementation authorized on 2026-10-27. Shared activation
remains closed under ADR-0018.

## Context

Coverage preserves a public shift's historical planning marker. Its Firestore
event therefore also entered the ordinary Sheets exporter, while the coverage
outbox had its own reservation. Two owners could write the same workbook and
emit different notices. HU-083 already supplies a durable workbook pointer,
partition fences and exact-cell read-back. Reusing these is smaller than adding
a second scheduler or pretending a coverage operation is a planner repair.

## Decision

- Persist private ownership bindings in the coverage transaction alongside its
  public writes, receipt and outbox. Bind exact environment/path, before/after
  bodies and revisions, effects digest and server commit metadata. Include
  completion writes even when no Sheets cell changes. Keep the planning marker
  and its existing audit first in the public trigger.
- Verify historical ownership before ordinary effects. A later manual edit or
  identical body reapplied at a different commit remains ordinary. Partial or
  corrupt evidence fails closed. Receipt/outbox claims detect a missing binding.
  Keep this evidence indefinitely; no cleanup or TTL is introduced. Total
  administrative removal of every private record cannot be distinguished from
  an ordinary write and is outside the admitted writer contract.
- Extend the existing `shiftPlanningState/sheetsSubmission` pointer with typed
  coverage and ordinary submissions. Coverage uses HU-083 partition fencing;
  import and planner consumers reject unfinished foreign submissions. Ordinary
  full exports, single-shift events and calendar exports reserve before loading
  sources. Public coverage writes reject an active ordinary reservation;
  ordinary exports reject pending/frozen coverage projections. This closes the
  gap before a coverage worker starts.
- Record every possible external batch before calling Sheets. Concurrent workers
  share that identity. Once recorded, retries inspect only, including after a
  crash before the apparent SDK call or after lease expiry. Ambiguous coverage
  effects become `reconciliationRequired`, retain their pointer and require
  the existing governed read-only recovery. Never infer rejection from timeout.
- Coverage releases inbox entries only after exact Sheets read-back and stable
  advanced Drive version, then its existing per-recipient push dispatcher owns
  delivery. Do not also enqueue generic `notificationEvents`. Shared effects,
  recovery and push use injected Firestore/environment authority; fixed-demo
  wrappers preserve their original project/workbook guards.
- Ordinary exports retain their previous SDK acknowledgement semantics. Their
  terminal receipt also observes a stable advanced Drive version to preserve the
  shared version chain. This is not exact-cell coverage read-back. An uncertain
  ordinary outcome keeps the pointer; a new invocation cannot resend or release
  it. A proven no-submission failure restores the predecessor. Ordinary event
  export also checks the event snapshot is still the current public version.
- Version the affected-writer inventory with coverage ingress, effects and push.
  A retained uncertain receipt is not proof of an executing process. Closed
  intake still requires independent control-plane evidence that runnable work
  and actual in-flight invocations are exhausted. Frozen effects are excluded
  from normal dispatch in code; recovery retains its closed-barrier authority.

## Consequences

One transactionally coordinated workbook authority replaces independent locks.
Unknown outcomes can stop later exports until governed reconciliation; that is
an explicit operational cost. A Firestore fence detects admitted-writer drift
but cannot turn Sheets into a transactional CAS or fence human/offline edits.
External IAM/Drive controls, authoritative migration, real entropy, collective
ratification, operator admission and authorized rollout remain required.

Local SDK/Rules tests and injected Sheets/push transports can verify ordering,
races and failure retention without changing shared data or sending real push.
They do not establish deployed IAM fencing or real provider delivery. Native
code is unchanged by this backend block.

## Completion delivery on 21 November 2026

Acceptance owns the Sheets batch that changes the effective assignee and, for a delivery, the preceding helper where applicable. Completion stores the acceptance operation ID and waits for verified read-back before it releases the completion inbox entries. A pending older completion resolves its acceptance from the case and preceding revision and checks both receipts. If completion arrives first, the worker projects the assignment once and suppresses the superseded acceptance notice. Replaying a historical completion whose notice had already been released can repair the missing projection while preserving the inbox entry and its original time. [Projection and receipts](../../functions/src/shift-coverage-projection.ts).

The Firestore creation triggers `onShiftCoverageEffectCreated` and `onShiftCoverageInboxCreated` run the existing inventory workers `worker-shift-coverage-effects` and `worker-shift-coverage-push`, respectively. Each uses the event environment and server-side activation policy. A coverage push requires the member's released inbox entry and its stable event ID. Event redelivery consults the same operation and recipient receipts. The exported operational switch remains disabled. [Composition](../../functions/src/index.ts) · [Event routing](../../functions/src/shift-coverage-delivery.ts).

The authenticated administration API lists completion delivery incidents and checks the linked administrator again on recovery. An unsent operation can resume. A pending Sheets operation with a recorded batch can be inspected against its marker, exact cells, advanced stable Drive version and current lease. A frozen operation retains its reservation for recovery under the closed intake barrier. Positive verification of the acceptance is required there too before the completion notice can be released. A new push attempt requires a recorded, definitive rejection of every submitted destination and the expected attempt ID. An acknowledged acceptance by any target completes the push for that member. If the provider response leaves all acceptances uncertain, the receipt stays unconfirmed. Both outcomes preserve the original inbox entry and prevent resubmission. A provider acknowledgement records acceptance by the provider. Device receipt is checked separately. [Administration](../../functions/src/shift-coverage-delivery-administration.ts) · [Emulator cases](../../functions/test/shift-coverage-effects.emulator.test.cjs).

## References

- [ADR-0018](0018-bind-native-coverage-to-authenticated-backend-readiness.md)
- [HU-084 plan](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
- [Firestore commit-time isolation](https://firebase.google.com/docs/firestore/transaction-data-contention#serializable_isolation_by_commit_time)
- [Firestore WriteResult](https://firebase.google.com/docs/firestore/reference/rest/v1/WriteResult)
