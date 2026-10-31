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

## References

- [ADR-0018](0018-bind-native-coverage-to-authenticated-backend-readiness.md)
- [HU-084 plan](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
- [Firestore commit-time isolation](https://firebase.google.com/docs/firestore/transaction-data-contention#serializable_isolation_by_commit_time)
- [Firestore WriteResult](https://firebase.google.com/docs/firestore/reference/rest/v1/WriteResult)
