# ADR-0016: Bind delivery spacing to ordinary planning history

## Status

Accepted for HU-089 local implementation on 2026-10-11 under the maintainer's
instruction to implement ten-week spacing and force-majeure exceptions.
Collective ratification and shared activation remain pending.

## Context

The continuous rotation fixes queue positions and published dates. Effective
assignees may change through coverage, and the immediately preceding delivery
alone cannot prove spacing against earlier rounds or seasons. Credit consumption
can also shorten the calendar distance between ordinary owner positions.

## Decision

- Validate the generated ordinary delivery plan against all captured published
  delivery positions, using immutable rotation owner, date and round. Require
  70 calendar days between the same owner's positions in different rounds when
  at least one position is newly generated. Helpers, markets and extraordinary
  coverage do not create ordinary positions; credit-rested positions have no
  dated physical delivery. Preserve every inherited published prefix position.
- Add an independent, explicit `hu089-delivery-spacing-v1` planning-source opt-in
  within the existing registered fixed emulator. The rule works with credits
  disabled. Legacy policy sources keep their previous semantics.
- Keep the canonical queue, credit algorithm and calendar unchanged. Reject a
  conflicting plan instead of inventing postponements or silently reordering
  people. This includes spacing conflicts caused by credit compression. A small
  weekly cohort may require multiple exact exceptions before it can be planned.
- Reuse the trusted administrative store for immutable reasoned exceptions.
  Bind each approval to one member, two exact dates/rounds, planning request,
  administrator, trusted approval time and canonical authority. Check current
  administrator authorization again when capturing and publishing. Exact command
  replay returns its original receipt; another operation cannot replace it.
  An exception never waives existing adjacent lead/helper safety. Approvals and
  operation receipts remain backend-only under strict and compatibility Rules.
- Bind complete history and approval evidence into the fairness snapshot and
  bundle digest. Forward publication checks current authority and source inside
  its transaction. Recovery checks the captured source, excluding only its own
  newly created, already verified public rows. Preexisting history stays checked.
  Bound retained history to 1,000 rows and approvals to 250 per authority;
  recovery additionally allows its verified operation's own rows within the
  existing 500-write bound. Oversized or incomplete evidence blocks processing.

## Consequences

There is no new scheduler or queue engine. Covered ordinary positions remain in
planning history, while effective substitutes do not acquire an ordinary
position. Approvals cannot be reused after canonical authority changes; a fresh
planning request requires fresh approval. Historical published conflicts alone
do not retroactively invalidate the existing calendar.

The ordinary planner and governed bundle/publication path enforce this contract.
The isolated legacy credit-unit rehearsal does not publish seasonal plans and
keeps its explicit old policy. Administrative native UI, live source composition,
legacy history migration and collective activation remain in HU-084 integration.
No public shift schema or native coverage projection changes in this block.

Integration note: the exception command's `planningRequestId` is the stable
`bundleId` shared by preview/stage/activate, not the individual request ID of a
phase. This clarifies the existing planning identity contract.

## Related work

- [ADR-0013](0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md)
- [ADR-0015](0015-record-explicit-coverage-membership-lifecycle.md)
- [HU-089 spec](../../spec/shifts/hu-089-coverage-policy-amendments/spec.md)
- GitHub issues [#279](https://github.com/JFrancoG/ReguertaPlus/issues/279) and [#268](https://github.com/JFrancoG/ReguertaPlus/issues/268)


## Native exact-pair proposals — 2026-10-26

Both Debug apps select a backend-derived pair from a persisted preview request,
retaining its stable bundle identity. Rebuild the governed source and reuse the
existing whole seasonal planner without spacing solely to diagnose its conflicts;
share the pure conflict enumerator with the production spacing validator. Never
persist, stage or publish this diagnostic output. Credits, membership and all
other planning rules remain in effect. Prefer the latest valid preview per bundle,
reject malformed stored evidence, and bound reads explicitly (20 previews,
250 proposals). Absence of a request/source yields an explicit empty state.

The approval transaction rederives the proposal and checks its exact pair and
complete source/request context. Clients cannot enter arbitrary identities,
dates, rounds or bundle IDs. Approval changes only its private record/receipt,
with authenticated UID-bound replay and current role checks. Collective approval,
real source composition and production activation remain separate gates.
