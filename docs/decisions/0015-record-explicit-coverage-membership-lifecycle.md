# ADR-0015: Record explicit coverage membership lifecycle

## Status

Accepted for HU-089 local implementation on 2026-10-11 under the maintainer's
instruction to implement reserve exit and permanent-departure compensation.
Collective policy ratification and shared activation remain pending.

## Context

`isActive` cannot distinguish temporary suspension from permanent departure.
Coverage changes effective assignments while retaining ordinary rotation owners.
Re-entry also retains older frozen positions. Cancelling credits by inactivity,
using effective assignees, or using a moving admission frontier would therefore
lose valid balances or end a newly entered reserve at the wrong turn.

## Decision

- Reuse administrative membership reconciliation. An explicit
  `permanentDepartureReason` requires an inactive/missing member and a current
  administrator. Persist its operation, reason and trusted time; inactivity alone
  retains credits. Active re-entry clears the current declaration and preserves
  its receipt and previously cancelled credits.
- Freeze `admissionAfterRound` on each HU-089 reserve entry. Only a published
  ordinary owner position of that type, after that boundary and entry time, ends
  reserve at its due date. Helpers and effective substitutions do not count.
- Selection, reserve acceptance and native read projections derive expiry from
  the same predicate. Reconciliation persists the exit and its ordinary-shift
  evidence. Safety does not depend on a punctual scheduler or administrative run.
- Cancel only pending credits, retaining earned-service data. Release matching
  claims and advance each affected type ledger once in the same transaction as
  membership/reserve changes and its receipt. Completed/consumed history remains.
- A later recorded completion retains the service as an already cancelled credit
  while the permanent-departure declaration applies. Membership time, complete
  source/ledger checks and inverse checks prevent resurrection or stale writes.

## Consequences

Existing `fifo-signup-v1` rehearsals keep their semantics. Active legacy reserves
without an entry boundary cannot be guessed under HU-089; amended processing
rejects them until authoritative migration evidence is supplied. Both native
clients display cancelled credits distinctly from used credits. Administrative
UI and shared activation remain part of the pending HU-084 integration; this
local contract introduces no public writer, scheduler or production migration.

## Related work

- [ADR-0013](0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md)
- [HU-089 spec](../../spec/shifts/hu-089-coverage-policy-amendments/spec.md)
- GitHub issues [#279](https://github.com/JFrancoG/ReguertaPlus/issues/279) and [#268](https://github.com/JFrancoG/ReguertaPlus/issues/268)


## Native administrative integration — 2026-10-26

HU-084 exposes this existing policy through administrator-only projections and
separate typed commands on both Debug rehearsal apps. The authenticated local
writer resolves UID/member links and roles inside its transaction, including
replays. A confirmation token binds source document versions, accounting and
planning evidence; stale confirmation rejects without mutation. Exact replay
returns the original result while retaining current authorization checks.

Native forms observe existing account activity rather than editing it. Updating
the situation derives reserve transitions; permanent departure is a separate
reasoned confirmation. Read models expose counts and status, never private
departure reasons or raw credit/claim documents. This remains provisional local
integration; collective ratification and shared activation are still pending.
