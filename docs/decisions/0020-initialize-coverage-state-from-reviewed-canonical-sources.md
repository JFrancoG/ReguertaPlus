# ADR-0020: Initialize coverage state from reviewed canonical sources

## Status

Accepted for the preparation authorized on 2026-10-27. The maintainer explicitly
confirms zero outstanding opening credits and no known prior active reserves.
Shared application and feature activation remain separate operational gates.

## Context

Accounts and members already exist in each environment's Firestore `users`.
Coverage additionally needs private membership observations, reserve evidence
and credit generations. Ordinary membership reconciliation can create reserves,
open future cases and cancel credits after explicit permanent departure. Running
it across all users would therefore change business state during initialization.
An empty collection also cannot prove that no earlier entitlement exists.

## Decision

- Use the existing canonical users, ordinary rotation aggregates and public
  ownership history in the same environment. Auth links authorize the current
  operator; having a login is not a membership/rotation eligibility requirement.
  Existing accounts, user flags, queues and public assignments remain unchanged.
- Bind a complete bounded snapshot and document update versions to an explicit
  administrative decision: environment, operation ID, initial observation time,
  confirmation reference, zero credits and no prior reserves. Generate a
  deterministic plan with proposed creates and actionable blockers.
- Existing eligible cohort members receive baseline observations, without a new
  reserve entry date. Preserve valid existing private records and consumed or
  cancelled credit history. Initialize a missing credit generation at zero only
  when consistent with its complete history. Do not fabricate a completed case,
  FIFO date, reserve boundary or permanent departure from current inactivity.
- Contradictory active reserves, pending credits/claims, unreconciled cohorts,
  invalid history and in-flight work block the whole plan. Existing records are
  never overwritten or deleted. Published-owner and effective-participant
  evidence remain distinct; an earlier substitution or swap is not proof of a
  pending entitlement.
- Apply through an injected backend adapter under the existing trusted closed
  intake barrier, with a reciprocal current administrator and exact expected
  plan digest. Recapture complete source sets in the same transaction as
  create-only writes, enforce the existing budget and create one immutable
  receipt plus its fixed current pointer. Source changes, new documents and
  competing initializers cannot produce a partial initialization.
- Exact replay returns the original receipt without resetting later membership
  or accounting changes. A lost final barrier acknowledgement retains the
  existing durable incident and does not claim clean completion. A Firestore
  maintenance flag alone cannot attest external writer drain.
- Normal backend admission additionally requires the matching verified initial
  receipt/pointer; bind it into the captured readiness digest. This does not
  switch `operationalReady` on or change the native wire contract.
- The first command-line tool prepares a review from local JSON only. It creates
  no SDK client, has no apply mode and cannot silently select a cloud project.
  Exercise the injected apply adapter through fixed-demo SDK/Rules tests.

## Consequences

The initial migration is a traceable initialization of private shift state, not
an account import or a new planner. The explicit zero declarations make a manual
legacy-credit model unnecessary for this scope. Contradictions require review
of concrete records before a new plan can be applied.

Local proof establishes transaction ordering, history preservation and denial
behavior. Actual shared source capture, operator/control-plane admission, bounded
application and read-back need their own concrete authorized handoff. Real entropy,
ratification and rollout remain necessary before coverage is available to members.

## Related work

- [ADR-0015](0015-record-explicit-coverage-membership-lifecycle.md)
- [ADR-0018](0018-bind-native-coverage-to-authenticated-backend-readiness.md)
- [ADR-0019](0019-coordinate-coverage-projections-and-notifications.md)
- [HU-084 plan](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
