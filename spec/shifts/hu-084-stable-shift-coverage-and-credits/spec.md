# HU-084 - Stable shift coverage and earned credits

## Metadata

- issue_id: #268
- priority: P1
- platform: both
- status: draft
- blocked_by: assembly ratification
- decision_gate: assembly ratification
- depends_on: HU-082 / #266, HU-083 / #267

## Context and problem

Continuous generation solves ordinary fairness but not membership changes or an
absence after dates have been published. Inserting or removing somebody and
then shifting every later assignment is mathematically simple but disrupts many
members' plans. Picking somebody opaquely is also unfair and unauditable.

The repository's authoritative requirements deliberately leave the final
post-publication absence policy to the assembly. This story records the concrete
proposal developed with the maintainer; it is not accepted merely because its
issue and planning artifacts exist.

## User story

As a cooperative member, I want a published shift vacancy to be covered fairly
without moving everybody else's dates so that exceptional changes do not
disrupt members' lives and the person who covers is compensated in a later
unpublished round.

## Stability principles

- Publishing freezes the dates and rotation ownership visible to unaffected
  members.
- A join, departure, absence, declined offer, or replacement never shifts every
  later published assignment.
- `rotationOwnerUserId` preserves the fair queue position;
  `assignedUserId`/`assignedUserIds` records who is currently expected to do the
  work.
- Coverage and reciprocal swaps are different workflows. HU-016 exchanges two
  assignments; coverage fills one vacancy and may earn a future credit.
- Every offer, response, selection, credit, consumption, expiry, and admin
  resolution is explicit, idempotent, and auditable.
- Nobody is silently forced by an opaque random selection.

## New and reactivated members

- A member is never inserted into an already published round.
- On activation, the member is appended to the current FIFO reserve pool.
  Receiving and accepting a reserve offer is voluntary unless the assembly
  decides otherwise.
- The proposed reserve entry does not reset in August. Its termination boundary
  is not yet ratified: candidates include immediate exit when any future normal
  cohort activates, exit when the first regular shift becomes due or is
  completed, or another explicit assembly boundary. Until that choice is made,
  cohort inclusion must not silently remove reserve eligibility. Becoming
  ineligible and the exact effect of an accepted, declined, or timed-out offer
  also require ratification.
- For normal rotation, the member is appended to the end of the first wholly new
  round whose cohort has not frozen, after all inherited carryover and already
  published rounds.
- A preview does not freeze a cohort. If the only plan for that future round is a
  preview, the roster change invalidates its digest and the next preview includes
  the member at the end. A non-public stage also remains invalidatable. Once any
  position in the round is activated for normal members, its cohort freezes and
  the member waits for the following unfrozen round.
- If several rounds have already been published, the member does not jump any
  of them; the reserve pool gives an earlier voluntary opportunity without
  changing other dates.
- Reactivation follows the same rule and cannot revive an obsolete historical
  queue position.

## Temporary absence and permanent departure

- A temporary absence opens one coverage case for the affected shift only.
- A permanent departure invalidates every affected preview/stage and makes the
  member ineligible for future still-unfrozen generation. Its already published
  positions become individual coverage cases.
- Unaffected published rows never move.
- Draft/unpublished positions may remove the departed member and regenerate freely
  only when their round cohort has not frozen. That action is versioned/audited.
- A frozen round never removes or reorders the departed `rotationOwnerUserId` or
  cohort. For an unpublished owner position, the safe proposal records an idempotent
  `excusedDeparture` tombstone and proposes advancing the historical cursor through
  that owner position without materializing a shift, only in the atomic activation
  described below. It regenerates only later unpublished
  positions. The next eligible owner receives the next real slot; no unrelated
  published assignment changes.
- The tombstone is terminal only for accounting/closing the frozen historical round.
  It is not a completed turn by the departed member, creates no coverage credit, and
  never transfers rotation ownership. The assembly may instead require coverage for
  the unpublished position, but must then define its date/slot, ownership, cursor,
  round completion, failure, and credit accounting before implementation.
- A tombstone never commits alone or consumes a calendar slot. Preview/stage keep it
  provisional. Activation atomically commits the tombstone(s), cursor/round closure,
  and the complete affected physical unit: one staffed delivery date satisfying
  adjacent-lead/helper invariants or one market event with three distinct assignees.
  The next eligible owner fills the still-required physical slot. If that unit is not
  planable—including delivery N=2, market N=3, or multiple losses—the operation makes
  no tombstone/cursor/round/shift/credit change and follows the ratified coverage/admin
  fallback or remains blocked.
- The original rotation owner remains in the historical row even when the
  effective assignment changes or the owner later leaves the cooperative.

## Eligibility changes without membership change

- The HU-082 predicate is authoritative on every versioned transition. An active
  common purchase manager remains eligible; changing to a real producer makes that
  member ineligible even if membership stays active. The reverse transition makes
  the member newly eligible again.
- Any eligibility drift invalidates affected preview/stage digests. If the round is
  still unfrozen, remove newly ineligible members and append newly eligible members
  under the ratified new/reactivated tie rule before replanning.
- A frozen round never mutates cohort/owner. A newly ineligible member's public
  positions open coverage. An unpublished frozen position follows the assembly's
  reason-specific temporary-coverage or terminal `excusedIneligible` rule;
  `excusedDeparture` is the permanent-departure reason. The same slot/cursor/round/
  completion/credit accounting requirements apply.
- A member who becomes eligible again never revives an old frozen/tombstoned owner
  position. They enter reserve and the first qualifying unfrozen round under the
  ratified reactivation rule. Every transition stores predicate inputs/reason,
  membership/role/company revision, effective time, and actor/provenance.

## Proposed coverage sequence

For each vacancy, the backend applies this order:

1. **Reserve FIFO**: offer the slot to eligible reserves in order, one governed
   offer window at a time or using the assembly-approved parallel rule.
2. **Volunteers**: publish a bounded request to eligible members. Select using
   the assembly-approved deterministic order if more than one volunteers.
3. **Compensated auditable draw**: if nobody volunteers, select from a persisted
   eligible candidate snapshot using a deterministic, reproducible input/seed whose
   source cannot be chosen after seeing the outcome. The selected member must still accept.
4. **Admin resolution**: if the candidate set is exhausted or the deadline makes
   automation unsafe, require an explicit documented administrator action.

If a selected member cannot accept, rerun only among the remaining candidate
snapshot after recording the reason. Never call an opaque `Math.random()` or
silently rebuild a candidate set to favor a result.

Before selection, persist/commit the immutable candidate snapshot, algorithm version,
and seed derivation. The assembly must choose a non-manipulable mechanism, such as a
commit-reveal protocol or a hash combining the case/snapshot digest with a public
value unavailable when committed. The same committed inputs produce one ordering;
administrators cannot trial seeds, reroll, or replace the snapshot after previewing a
winner.

## Eligibility for one coverage case

At minimum exclude:

- inactive members and real producers under the HU-082 predicate;
- the current effective assignee and, for market, everyone already assigned to
  that same event;
- for delivery, the effective leads of the immediately preceding and following
  materialized deliveries. This is a hard lead/helper invariant, not an optional
  proximity preference;
- members with an unconsumed same-type coverage credit;
- under the safe proposal, members with an accepted but incomplete same-type
  coverage, preventing overlapping acceptances from accumulating later credits;
- members whose same-type assignments are too close when a less disruptive
  eligible alternative exists;
- anyone forbidden by a conflict or policy field approved by the assembly.

The persisted draw record includes the vacancy, candidate snapshot, exclusions
and reasons, deterministic input/seed and algorithm version, selected member,
retries, offer deadlines, responses, final assignment, and actor/admin action.

The assembly may amend the no-stacking proposal only by defining the maximum number
and proximity of accepted/incomplete coverages and unconsumed credits, eligibility
while any are pending, deterministic ordering of multiple earned credits, and
consumption/cancellation behavior. Implementation cannot leave the accepted-before-
completion interval unbounded.

## Earned coverage credit

- A credit is scoped to `delivery` or `market` and belongs to one member.
- It is awarded only after the covered shift is completed, not when a member
  volunteers or merely accepts.
- One completed coverage earns one skipped occurrence of the same type.
- Consumption is first attempted when the member reaches their first eligible
  position in the first not-yet-activated round of that type. If safe staffing
  defers it, the credit remains pending and is retried at the member's first
  eligible occurrence in each later not-yet-activated round until consumed.
- Preview/stage may propose consumption but do not mutate the ledger. The credit
  and owner position are consumed atomically only when that exact candidate
  revision activates; invalidated/removed candidates leave the credit untouched.
- The complete same-type credit-ledger version is part of the planner snapshot
  and digest. Issuing, consuming, cancelling, or otherwise changing any relevant
  credit after stage invalidates the candidate; activation transactionally
  rechecks the ledger version and commits its exact planned transitions.
- If the next round is already active/public, the credit waits for the first
  later unactivated round; it never removes or moves an active assignment.
- Consumption records that owner's rotation position as served for fairness but
  does not consume a calendar slot. Credits and replacement owners are therefore
  solved for one complete calendar unit at a time: one delivery slot or all
  three positions of one market event.
- The proposed deterministic solver traverses the queue in order and tentatively
  consumes credits as their owners are reached. Every tentatively resting owner
  is excluded from effective assignment anywhere in that same unit. The solver
  then fills the unit from subsequent eligible owners, also excluding existing
  market assignees so all three remain distinct. A delivery filler must also differ
  from both adjacent materialized effective leads under the HU-082 helper invariant.
- If the unit cannot be staffed, tentative consumptions are rolled back in
  reverse queue order until staffing becomes feasible. Each rolled-back credit
  remains pending; its owner works the ordinary position that made the unit
  feasible, that position is recorded as served, and the cursor advances
  normally. Only the credit retries at the owner's next eligible unactivated
  occurrence. This handles the minimum two-person delivery cohort by deferring a
  credit when its only filler would duplicate an adjacent delivery lead. It also
  handles every eligible member holding a credit, consecutive credits, and queue
  wrap without assigning a person whose credit was actually consumed.
- Planning and activation commit the final unit assignment, served owner
  positions, cursor, and selected credit consumptions atomically. A credit is
  never lost, a worker is never duplicated within the unit, and a physical slot
  is never left empty. The assembly must ratify this reverse-order backtracking
  rule or choose an explicit reserve/coverage fallback before implementation.
  Backtracking is the complete safe proposal. A coverage fallback is not
  implementable until the assembly also defines when the resting credit is
  consumed, whether an accepted/completed replacement earns another credit, how
  failed coverage affects both ledgers, and what happens if the original owner
  ultimately works.
- Credits cannot be transferred across members or shift types, duplicated,
  manually self-awarded, or silently expire unless the assembly defines an
  explicit expiry rule.

## Market and delivery invariants

- A covered market event still has exactly three distinct effective assignees.
- One person cannot cover two positions in the same market event.
- HU-082/HU-063 require distinct adjacent delivery leads. Coverage/credit candidate
  snapshots and activation CAS include predecessor/current/successor assignment,
  completion, and revision; an equal-adjacent or stale result fails/defer/backtracks.
- For an uncompleted predecessor, coverage, credit, or HU-016 swap recomputes its
  planned helper from the next effective lead. Once completed, actual helper UID/
  source revision/time is frozen and a later assignment change never rewrites it.
  This helper/ownership/history invariant is not an assembly decision.
- Completion and credit issuance use the authoritative final effective assignee.

## Assembly decisions required

The assembly must ratify or amend, at minimum:

- whether new/reactivated members join the first wholly new still-unfrozen normal
  round at its tail as proposed, and the deterministic order for simultaneous
  joins;
- whether a departed owner's unpublished position in an already frozen round uses
  the proposed `excusedDeparture` tombstone/skip or becomes a coverage case, including
  exact physical-slot, owner, cursor, round-closure, completion, failure, and credit
  effects;
- how each non-membership eligibility loss reason (real-producer transition,
  inactive status, or future predicate input) maps to temporary coverage versus a
  terminal `excusedIneligible` tombstone, and how a later eligible transition enters
  reserve/unfrozen rotation without reviving the frozen position;
- whether reserve participation is voluntary and its FIFO semantics;
- whether reserve entries cross the August boundary, and how
  acceptance/decline/timeout changes their FIFO lifecycle;
- exactly when reserve status ends after inclusion in a future normal cohort:
  at that cohort's activation, when the first regular turn is due/completed, or
  another explicit boundary;
- reserve, volunteer, selected-member, and admin response windows;
- deterministic ordering when multiple volunteers respond;
- whether an auditable draw may select a member subject to acceptance, and the exact
  committed non-manipulable seed/entropy derivation, no-reroll rule, and evidence;
- the final admin fallback when nobody accepts;
- whether every completed coverage equals exactly one skipped same-type
  occurrence;
- whether credits expire and how prolonged leave interacts with them;
- whether the proposed one-pending-coverage/one-unconsumed-credit exclusion is
  accepted; otherwise the stacking cap/proximity, offer eligibility, credit order,
  and cancellation/consumption rules;
- whether the atomic unit solver defers credits by reverse-order backtracking as
  proposed; if it instead opens a reserve/coverage case, the complete accounting
  for acceptance, completion, failure, replacement credit, original credit, and
  the original owner ultimately working;
- who may open/cancel a vacancy and confirm completion.

No implementation phase starts before the decision is reflected in the English
and Spanish authoritative requirements.

## Scope after approval

### In scope

- Coverage-case, offer, acceptance, draw, reserve, and credit contracts.
- Versioned frozen-round departure tombstones or the fully ratified alternative.
- Versioned eligible-to-ineligible and ineligible-to-eligible transitions for every
  HU-082 predicate input, with frozen/unfrozen and preview/stage/public behavior.
- Transactional/idempotent backend orchestration and security Rules.
- Notifications and deadlines/retry behavior.
- Admin and member flows with Android/iOS parity.
- Integration with HU-082 ownership/state and HU-083 seasonal projection.
- Tests for joins, reactivation, temporary absence, permanent departure,
  candidates, retries, credit issuance/consumption, and authorization.
- Bilingual requirements, Firestore documentation, and operational guidance.

### Out of scope

- Mass shifting of published assignments.
- Treating a unilateral coverage as an HU-016 reciprocal swap.
- Opaque or client-side random selection.
- Consuming a credit by removing an already published assignment.
- Implementing any unresolved policy before assembly ratification.

## Linked functional requirements

- RF-TURN-03, RF-TURN-04, RF-TURN-07
- RF-IA-03
- HU-015, HU-016, HU-017, HU-020, HU-082
- Existing open decision on post-publication absence replacement

## Acceptance criteria after approval

- [ ] Unaffected published dates and assignments never move because another
  member joins, leaves, or becomes unavailable.
- [ ] New/reactivated members enter the reserve FIFO and the first wholly new,
  still-unfrozen round at deterministic positions, and reserve status ends only
  at the ratified boundary.
- [ ] Permanent departures are excluded from future unpublished generation and
  each affected published position becomes an independent coverage case.
- [ ] A departure regenerates membership/order only for an unfrozen round. In a
  frozen round, owner/cohort never change: a published position opens coverage and
  an unpublished position follows the ratified tombstone/skip or fully accounted
  coverage rule without moving any unrelated published assignment.
- [ ] Under the proposed tombstone rule, `excusedDeparture` advances/terminates the
  departed owner's frozen-round position idempotently only with the complete-unit
  activation below, without a physical shift,
  member completion, credit, or replacement rotation owner; cursor/round closure
  and the next real slot remain deterministic under retry/concurrency.
- [ ] Tombstone/`excusedIneligible`, cursor/round transition, and the next complete
  physical unit commit only in one exact preview/stage/activation candidate. If a
  delivery cannot preserve its adjacent-lead/helper invariant or a market cannot
  supply three distinct assignees, activation makes no mutation and uses the ratified
  fallback/blocked state.
- [ ] Eligibility drift without membership exit uses the live HU-082 predicate.
  Preview/stage invalidates; an unfrozen round replans by deterministic remove/append;
  a frozen round preserves owner/cohort and applies ratified coverage or reason-coded
  `excusedIneligible`; later re-eligibility never revives an old position.
- [ ] `Compras Regüerta` common purchase managers remain eligible, real producers
  remain ineligible, and role/company/status revision races fail without partial
  coverage, tombstone, cursor, credit, or notification effects.
- [ ] The reserve, volunteer, compensated draw, and admin sequence follows the
  ratified policy and every transition is traceable.
- [ ] Coverage changes effective assignment while preserving rotation ownership.
- [ ] A delivery coverage candidate differs from both adjacent materialized leads.
  Coverage/credit activation CAS validates predecessor/current/successor assignment,
  completion, and revision; equal-adjacent/stale results fail with no side effect.
- [ ] Helper recomputation is prospective only: an uncompleted predecessor updates
  planned helper, while a completed predecessor's actual helper/revision/time stays
  frozen. Completion-versus-coverage/credit/swap races retry deterministically and
  cannot rewrite history.
- [ ] Draw candidates, exclusions, algorithm version/input, retries, and result
  are reproducible from persisted evidence; snapshot/seed derivation is committed
  before selection and cannot be rerolled or admin-chosen after outcome preview.
- [ ] No candidate is silently imposed; acceptance/decline/timeout is explicit.
- [ ] A credit is issued only after completion and cannot be lost, duplicated,
  transferred, forged, or consumed in an active/public round.
- [ ] Accepted/incomplete coverage and credit stacking follow the ratified cap,
  proximity, eligibility, ordering, cancellation, and consumption policy. The safe
  default excludes a second same-type acceptance while the first coverage is
  accepted/incomplete and, after completion, while its earned credit remains pending.
  Cancellation/failure with no earned credit releases eligibility unless the
  ratified terminal transition explicitly defines another bounded outcome.
- [ ] Preview/stage never consumes a credit; the full ledger version is digested,
  any post-stage change invalidates the candidate, and activation commits only
  the exact candidate ledger transition atomically.
- [ ] Credit consumption is attempted at each first eligible unactivated
  occurrence until safe, records one same-type owner position served, and
  preserves both round fairness and complete staffing.
- [ ] Delivery and market plan each full calendar unit atomically, exclude every
  tentatively resting owner, and apply reverse-order rollback so a restored owner
  works/serves the position while only their credit stays pending, or apply a
  fully specified ratified coverage/accounting fallback, without losing credits,
  duplicating workers, or leaving a slot empty.
- [ ] For N=2 delivery, a credit whose only filler would equal an adjacent lead is
  rolled back/deferred; the owner works and the credit remains pending. Cross-season
  boundaries, coverage, credits, and HU-016 swaps never yield lead = planned helper.
- [ ] Market retains three distinct effective assignees and delivery operational
  handover remains correct.
- [ ] Existing HU-016 reciprocal swaps continue to work independently.
- [ ] Android and iOS show equivalent vacancy, offer, volunteer/selection,
  deadline, acceptance, credit, final assignment, failure, and retry states.
- [ ] Rules prove clients cannot award credits, rewrite rotation ownership,
  manipulate candidate snapshots, or self-assign outside the workflow.
- [ ] Local/emulator acceptance covers all ratified edge cases before a separate
  shared-project activation story is proposed.

## Dependencies

- HU-082 / issue #266 supplies rotation ownership, cohorts, and unpublished-round
  semantics.
- HU-083 / issue #267 must be integrated and preserve effective assignment
  separately in Sheets.
- Assembly ratification and bilingual requirements are hard blockers.
- HU-085 production activation for the base planner is independent and need not
  wait for HU-084.

## Risks and mitigations

- **Policy implemented by accident**: keep issue/spec blocked and all
  implementation tasks unchecked until assembly evidence is linked.
- **Life disruption**: freeze unaffected published rows and require explicit
  responses.
- **Gaming volunteers/credits**: issue credits only from completed authoritative
  coverage and consume transactionally once.
- **Biased draw**: persist the complete snapshot/input/version and use a
  reproducible algorithm.
- **Queue corruption**: never derive ownership from the effective assignee.
- **Notification races**: version every case/offer and fence late responses.

## Definition of Done

- [ ] Assembly decision and date are linked.
- [ ] English/Spanish requirements contain the ratified policy.
- [ ] Every acceptance criterion has automated or recorded manual evidence.
- [ ] Functions lint/build, contract, security, Rules, and workflow suites pass.
- [ ] Android and iOS unit/lint/build/UI gates pass with parity.
- [ ] Local/emulator workflow, notification, projection, and mobile read-back
  acceptance pass without a shared-project deploy.
- [ ] Any live activation remains open in a separately authorized rollout story.
- [ ] ADR/data documentation is aligned where architecture changed.
- [ ] Issue, branch, commits, and PR are linked.
