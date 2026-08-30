# [HU-084] Stable shift coverage and earned credits

## Tracking

- GitHub issue: #268
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/268
- State: DRAFT / BLOCKED BY ASSEMBLY
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation branch: forbidden until the assembly gate is satisfied
- Depends on: HU-082 / #266 and HU-083 / #267
- Independent production activation: HU-085 / #269

## Summary

Keep every unaffected published assignment stable. Resolve one vacancy through
the proposed sequence `reserve FIFO -> volunteers -> compensated auditable draw
-> admin`, always with explicit acceptance. A completed coverage earns one
same-type credit whose first skip attempt is the owner's first eligible
unactivated occurrence; safe staffing may defer it for retry.

This is a proposal derived from the maintainer's joins/departures/volunteer
questions. The authoritative requirements reserve the final policy for the
assembly, so issue creation is traceability, not approval.

## Non-negotiable safety properties in the proposal

- Never shift everybody's published dates after a join/departure/absence.
- Keep immutable rotation ownership separate from effective assignment.
- Never use opaque random selection or silently force a candidate.
- Commit the candidate snapshot and non-manipulable seed derivation before drawing;
  forbid admin seed grinding, snapshot replacement, and reroll after outcome preview.
- Award credit only after completed coverage; consume it once and never in a
  previously active/public round.
- A credit is first attempted at the owner's first eligible unactivated
  occurrence; a safely deferred credit stays pending and retries later.
- Safe default: one accepted/incomplete same-type coverage or unconsumed credit at a
  time. The assembly must ratify it or define the stacking cap/proximity, eligibility,
  ordering, cancellation, and consumption rules.
- One whole delivery slot or three-person market is solved atomically. Resting
  credited owners cannot work that unit; if staffing is impossible, tentative
  consumptions roll back in reverse queue order until feasible. A restored owner
  works and serves that position; only their credit stays pending for retry.
- Delivery coverage/credit candidates must differ from both adjacent effective
  leads. CAS includes adjacent assignment/completion revisions; if N=2 or any other
  case has no valid filler, the credit defers/backtracks or coverage escalates rather
  than creating the same lead/helper.
- Backtracking is the complete safe proposal. Any alternative coverage fallback
  requires assembly-approved accounting for both credits, completion/failure,
  and the original owner ultimately working.
- The full same-type ledger version is in the stage digest. Any intervening
  issue/consume/cancel change invalidates activation, which commits selected
  credit and cursor transitions atomically.
- Preview/stage do not freeze a future cohort. A round freezes on first public
  activation, and a new member joins the next still-unfrozen round.
- A departure may regenerate only a still-unfrozen round. In a frozen round, owner/
  cohort never change: public positions use coverage; the safe proposal gives an
  unpublished owner position an `excusedDeparture` tombstone that proposes round
  advancement only through the complete-unit atomic activation below, without a
  shift, completion, credit, or replacement owner. The
  assembly may choose coverage instead only with complete slot/cursor/credit rules.
- A tombstone never advances alone: it commits atomically with cursor/round closure
  and a complete affected physical unit. If delivery N=2, market N=3, or multiple
  losses cannot staff that unit under all invariants, nothing changes and the
  ratified coverage/admin fallback or blocked state applies.
- Eligibility can change without membership exit. The live HU-082 predicate governs:
  unfrozen rounds deterministically remove/append after invalidating preview/stage;
  frozen rounds preserve owner/cohort and use ratified reason-specific coverage or
  `excusedIneligible`. Re-eligibility enters reserve/next unfrozen round and never
  revives an old tombstone. `Compras Regüerta` remains eligible; real producers do not.
- The proposed reserve FIFO crosses the seasonal boundary. The assembly must
  decide whether reserve status ends on future-cohort activation, when the first
  regular turn is due/completed, or at another explicit boundary.
- Helper recomputation is prospective: an uncompleted predecessor follows the next
  effective lead; completion freezes its actual helper/revision/time. Later coverage/
  credit or HU-016 swap preserves completed history and rotation ownership.
- Keep HU-016 reciprocal swaps separate.
- Keep Android/iOS behavior and notifications equivalent.

## Links

- Spec: `spec/shifts/hu-084-stable-shift-coverage-and-credits/spec.md`
- Plan: `spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md`
- Tasks: `spec/shifts/hu-084-stable-shift-coverage-and-credits/tasks.md`

## Hard gate

- [ ] Assembly decision/date and accepted wording linked.
- [ ] Normal-round tail placement and simultaneous-join ordering explicitly
  ratified or amended.
- [ ] Frozen-round unpublished departure handling is ratified: proposed audited
  tombstone/skip or a complete coverage alternative with physical-slot, owner,
  cursor, round-closure, completion/failure, and credit accounting.
- [ ] Tombstone/eligibility skip atomicity with the next complete physical unit and
  the zero-mutation N=2 delivery/N=3 market/multiple-loss fallback is ratified.
- [ ] Every HU-082 eligibility-transition reason is mapped across unfrozen/frozen
  and preview/stage/public states, including re-entry ordering and whether frozen
  unpublished positions use coverage or reason-coded `excusedIneligible`.
- [ ] Reserve-exit boundary and deterministic whole-unit credit rollback or
  fully accounted coverage fallback explicitly ratified.
- [ ] English/Spanish requirements updated.
- [ ] Spec/issue reconciled and maintainer-approved.
- [ ] Only then may an implementation branch or code change begin.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:cross`
- `priority:P1`
