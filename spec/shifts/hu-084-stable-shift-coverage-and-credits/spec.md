# HU-084 - Stable shift coverage and earned credits

## Metadata

- issue_id: #268
- priority: P1
- platform: both
- status: member text approved on 2026-11-18 as reported by the maintainer; normal-app composition locally validated; technical reconciliation, operational integration, shared acceptance and activation remain open
- blocked_by: technical reconciliation and operational acceptance for live activation
- decision_gate: [assembly decision record](ratification.md#decision-record-and-follow-up)
- depends_on: HU-082 / #266, HU-083 / #267

## Local implementation authorization — 2026-09-12

The maintainer explicitly authorized implementing this proposal provisionally for
local tests. This authorizes the implementation branch and emulator-only behavior;
it does not ratify the proposal or authorize deployment/live activation. The
administrative lifecycle includes frozen reserve FIFO, bounded volunteers and a
committed draw using a synthetic signed future-round issuer. The explicit test
settings are `fifo-signup-v1`, `hu084-local-beacon-v1` and `sha256-rank-v1`. Reserve
exit, the real entropy provider, proximity preferences, response windows and final
ordering remain pending business decisions. The tested provisional behavior is not
the ratified live policy.
The pure whole-unit credit solver and atomic consumption rehearsal are also
implemented locally. The rehearsal records private units and does not publish
seasonal bundles/public shifts. Existing delivery/market planners now also support
provisional full-season credit traversal, credited carryover and exact ledger
before/after images. Governed HU-082 source capture, bundle persistence and shared
forward/inverse credit activation now work in the fixed local emulator, including
released claims and monotonic ledger generations. Shared-project activation stays
disabled. Membership/eligibility transitions, both native rehearsal clients,
readable Sheets projection, generic inbox/push and governed recovery are now
implemented locally at the later 2026-09-13 checkpoint. The bounded native manual
matrix is complete as of 2026-10-04, including physical accessibility and isolated
real push receipt/opening on both platforms. Ratification and live coverage
integration remain open. See `review.md` for the current criterion matrix and
`plan.md` for historical evidence and limits.

## Native administrative integration — 2026-10-26

The maintainer authorized the complete reserve/permanent-departure/ten-week
exception block in both apps and the existing authenticated local API. Native
forms now observe account activity, derive reserve transitions through the existing
reconciler, require an explicit reasoned permanent departure, and select an exact
backend-derived spacing pair. They cannot toggle membership activity, freely edit
plan identifiers/dates or publish a plan. Context and current authorization are
rechecked inside the writer transaction; uncertain commands retain exact retry.

This completes the local native administrative connection of HU-089 under HU-084,
with current validation in `review.md`. Its new physical accessibility/text/keyboard
checks are separate from the earlier completed coverage matrix. Collective
ratification, live composition/migration and activation remain open.

## Normal-app authenticated composition — authorized 2026-10-27

The maintainer authorizes reusing the coverage implementation in both normal
session graphs and the authenticated backend composition. The shared contract
accepts `develop` or `production` explicitly; the fixed-demo wrapper remains
develop-only. `resolveShiftCoverageAccess` accepts exactly `schemaVersion: 1`
and `environment`, returning schema/environment/member plus `enabled` and nullable
`policyRevision`. Disabled access has a null revision and grants no normal entry
or business operation. `shiftCoverage` retains the existing exact action bodies
and success envelope; shared errors use the normal backend error contract.

Bind drafts and requests to the canonical authenticated UID/member/environment
and session revision, reject impersonation and fence token acquisition, transport
and response handling. Resolve current account links and permissions in the
server transaction; receipt replay does not bypass current readiness. No caller
can choose a backend actor or silently reroute a production intent to develop.

The optional private `sourcePolicy.coverage` record contains exact activation
inputs: enabled, environment, supported policy revision, ratification reference
and an explicit maximum offer window. Missing or invalid policy stays closed.
Exported services additionally remain operationally closed in code pending
effect ownership, shared workbook leases, writer intake, real entropy and
authoritative credit/membership migration. This composition does not remove the
existing provisional planner/publication guards, ratify policy or activate any
shared service. See [ADR-0018](../../../docs/decisions/0018-bind-native-coverage-to-authenticated-backend-readiness.md).

## Public draw integration — 2026-11-21

The authenticated service uses drand Quicknet for D09. It records the pool and future round before publication. An outage alert keeps that same round available for recovery. The operator and members retain the ordinary offer and consent flow. [Implementation and local acceptance](review.md#d09-public-draw-on-21-november-2026).

## Assembly approval — 2026-11-18

The maintainer reported that the assembly approved the [member-facing text](propuesta-turnos-para-socios.md).
The [English](ratification.md) and [Spanish](ratification-es.md) matrices map the
approved rules to D01–D15. The official minutes reference and effective date are
pending. The approval covers the member-facing rules. Engineering still needs to
verify their correspondence to technical contracts, code and tests before rollout.

With at least 14 days left, the reserve, volunteer and draw phases have maximums
of 2, 7 and 2 days, and administration has a 3-day resolution target. From 5 to
less than 14 days the corresponding values are 1, 2, 1 and 1 days. Below 5 days
administration handles the case from the start. Days mean 24 hours from phase
start. Search phases do not restart per candidate, and a valid acceptance ends
the search. Administrative resolution can continue after its original target.
Each offer has its own response deadline within the applicable maximum and
before the shift starts. The approved values apply initially. After members have
experience with the workflow, extending or shortening deadlines or making other
adjustments through app updates requires agreement from all members.

Ordinary delivery-lead assignments for the same member in different rounds must
be at least 10 weeks apart. Helpers, market shifts and substitutions are outside
that minimum. Administrators may authorize a recorded force-majeure exception
while preserving role compatibility and other members' published dates.

## Context and problem

Continuous generation solves ordinary fairness but not membership changes or an
absence after dates have been published. Inserting or removing somebody and
then shifting every later assignment is mathematically simple but disrupts many
members' plans. Picking somebody opaquely is also unfair and unauditable.

HU-084 translates the member-facing policy for absences after publication into
delivery and market coverage rules, alongside the existing reciprocal swap flow.

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
- In [HU-016](../hu-016-request-shift-swap/spec.md), a member responds that they
  are available and the requester confirms one concrete exchange. That confirmation
  exchanges the two effective assignments. In HU-084, a valid acceptance assigns
  one vacancy and the substitute keeps their existing assignments. A future credit
  is earned only after administration confirms actual completion.
- Every offer, response, selection, credit, consumption, expiry, and admin
  resolution is explicit, idempotent, and auditable.
- Nobody is silently forced by an opaque random selection.

## New and reactivated members

- A member is never inserted into an already published round.
- On activation, the member enters the FIFO reserve pool for each eligible shift
  type. Accepting an offer is voluntary. The reserve carries across August.
  Declining or letting a particular offer expire leaves the member's queue place
  for later vacancies. Acceptance keeps the entry and blocks overlapping same-type
  coverage while the accepted substitution or credit is pending.
- Reserve status ends when the member's first ordinary same-type shift becomes
  due, even if someone else covers it, or earlier if the member loses eligibility.
  Publishing a future season does not advance that boundary.
- For normal rotation, the member is appended to the end of the first wholly new
  round whose cohort has not frozen, after all inherited carryover and already
  published rounds. Simultaneous entrants are ordered by when they became eligible,
  with a stable recorded tie-break for exact ties.
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
  never transfers rotation ownership. The technical review must verify that this
  representation implements the member-facing rule for future unpublished turns,
  including physical slot, cursor and round-closure accounting.
- A tombstone never commits alone or consumes a calendar slot. Preview/stage keep it
  provisional. Activation atomically commits the tombstone(s), cursor/round closure,
  and the complete affected physical unit: one staffed delivery date satisfying
  adjacent-lead/helper invariants or one market event with three distinct assignees.
  The next eligible owner fills the still-required physical slot. If that unit is not
  planable—including delivery N=2, market N=3, or multiple losses—the operation makes
  no tombstone/cursor/round/shift/credit change. Administration handles the
  unresolved staffing issue before a complete plan can be activated.
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
  positions open coverage. For unpublished positions, the technical reconciliation
  must map each eligibility reason and round state to the agreed policy. Where the
  proposed accounting uses `excusedIneligible` or `excusedDeparture`, the same
  slot, cursor, round, completion and credit accounting requirements apply.
- A member who becomes eligible again never revives an old frozen/tombstoned owner
  position. They enter reserve and the first qualifying unfrozen round under the
  ratified reactivation rule. Every transition stores predicate inputs/reason,
  membership/role/company revision, effective time, and actor/provenance.

## Coverage sequence

For each vacancy, the backend applies this order:

1. **Reserve FIFO**: offer the slot to eligible reserves in order within the
   phase maximum.
2. **Volunteers**: publish a bounded request to eligible members. Give priority
   to the first eligible volunteer and use a fixed, recorded order for exact ties.
3. **Compensated auditable draw**: if nobody volunteers, select from a persisted
   eligible candidate snapshot using a deterministic, reproducible input/seed whose
   source cannot be chosen after seeing the outcome. The selected member must still accept.
4. **Admin resolution**: if the candidate set is exhausted or the deadline makes
   automation unsafe, require an explicit documented administrator action.

If a selected member cannot accept, record the reason and advance through the
same draw order. When the draw cannot provide the agreed guarantees, record the
reason and pass the case to administration.

Before selection, commit the immutable candidate snapshot, algorithm version and
seed derivation. The chosen technical mechanism must be verifiable, using a
source whose outcome is unavailable when the snapshot is committed. The same
committed inputs produce one ordering. Reject seed trials, rerolls and snapshot
replacement after selection.

## Eligibility for one coverage case

At minimum exclude:

- inactive members and real producers under the HU-082 predicate;
- the current effective assignee and, for market, everyone already assigned to
  that same event;
- for delivery, the effective leads of the immediately preceding and following
  materialized deliveries. This is a hard lead/helper invariant, not an optional
  proximity preference;
- members with an unconsumed same-type coverage credit;
- members with an accepted but incomplete same-type coverage, preventing
  overlapping acceptances from accumulating later credits;
- anyone forbidden by a conflict or policy field approved by the assembly.

The maintainer-refined 10-week rule concerns ordinary delivery-lead assignments
in different rounds. It does not add a spacing exclusion to coverage candidates;
the adjacent lead/helper incompatibility above still applies.

The persisted draw record includes the vacancy, candidate snapshot, exclusions
and reasons, deterministic input/seed and algorithm version, selected member,
retries, offer deadlines, responses, final assignment, and actor/admin action.

An accepted same-type coverage that ends without credit releases the block.
Member-approved future changes to accumulation would require corresponding
eligibility, credit ordering, consumption and cancellation rules.

## Earned coverage credit

- A credit is scoped to `delivery` or `market` and belongs to one member.
- Administration awards it by confirming actual completion after the shift.
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
  never lost through deferral, a worker is never duplicated within the unit, and a
  physical slot is never left empty. If reverse-order deferral still leaves the unit
  unstaffable, block activation and escalate to administration.
- Credits belong to the person who earns them and stay within the original shift
  type. They carry through temporary suspension and season changes. Permanent
  departure cancels pending credits, preserves history and grants no restoration
  on re-entry.

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

## Assembly decision and technical reconciliation

The [approved member-facing text](propuesta-turnos-para-socios.md) and its
[English](ratification.md) and [Spanish](ratification-es.md) matrices are the policy
reference. Before shared acceptance:

- Verify the approved rules against the candidate, with particular attention to
  reserve exit, phase and offer timing, volunteer priority, eligibility, credit
  expiry and deferral, and administrative permissions.
- Verify the exact transition and atomic accounting for cohort changes, frozen
  unpublished positions, temporary absence and re-entry, including the unstaffable
  unit fallback. Internal state names and persistence choices require technical review.
- Choose and validate the verifiable draw provider, failure handling and operational
  controls. Reconcile production projections, notifications and recovery.

## Scope after approval

### In scope

- Coverage-case, offer, acceptance, draw, reserve, and credit contracts.
- Versioned frozen-round departure accounting aligned with the approved rules.
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
- Activating coverage before shared acceptance and separate rollout approval.

## Linked functional requirements

- RF-TURN-03, RF-TURN-04, RF-TURN-07
- RF-IA-03
- HU-015, HU-016, HU-017, HU-020, HU-082
- [Assembly decision on post-publication absence replacement](ratification.md#decision-record-and-follow-up)

## Acceptance criteria after approval

- [ ] Unaffected published dates and assignments never move because another
  member joins, leaves, or becomes unavailable.
- [ ] New/reactivated members enter the reserve FIFO and the first wholly new,
  still-unfrozen round at deterministic positions, and reserve status ends only
  when the first ordinary same-type shift becomes due or the member loses eligibility.
- [ ] Permanent departures are excluded from future unpublished generation and
  each affected published position becomes an independent coverage case.
- [ ] A departure regenerates membership/order only for an unfrozen round. In a
  frozen round, owner/cohort never change: a published position opens coverage and
  an unpublished position is accounted for in line with the approved departure
  rule while preserving all unrelated published assignments.
- [ ] Under the proposed tombstone rule, `excusedDeparture` advances/terminates the
  departed owner's frozen-round position idempotently only with the complete-unit
  activation below, without a physical shift,
  member completion, credit, or replacement rotation owner; cursor/round closure
  and the next real slot remain deterministic under retry/concurrency.
- [ ] Tombstone/`excusedIneligible`, cursor/round transition, and the next complete
  physical unit commit only in one exact preview/stage/activation candidate. If a
  delivery cannot preserve its adjacent-lead/helper invariant or a market cannot
  supply three distinct assignees, activation makes no mutation and the staffing
  issue is escalated to administration.
- [ ] Eligibility drift without membership exit uses the live HU-082 predicate.
  Preview/stage invalidates; an unfrozen round replans by deterministic remove/append;
  a frozen round preserves owner/cohort and applies the reconciled coverage or reason-coded
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
- [ ] Coverage requires explicit acceptance by an eligible member within the
  offer deadline and before the shift starts. Decline or expiry moves the case forward.
- [ ] Administration issues one same-type credit on confirming actual completion.
  Credits cannot be duplicated, transferred, forged or consumed in an active round.
  Temporary suspension preserves the credit. Permanent departure cancels it with
  history retained.
- [ ] A new same-type acceptance is blocked while prior coverage is incomplete
  or while its credit is pending. Cancellation or failure without an earned credit
  releases the block.
- [ ] Preview/stage never consumes a credit; the full ledger version is digested,
  any post-stage change invalidates the candidate, and activation commits only
  the exact candidate ledger transition atomically.
- [ ] Credit consumption is attempted at each first eligible unactivated
  occurrence until safe, records one same-type owner position served, and
  preserves both round fairness and complete staffing.
- [ ] Delivery and market plan each full calendar unit atomically, exclude every
  tentatively resting owner, and apply reverse-order rollback so a restored owner
  works/serves the position while only their credit stays pending. Preserve
  credits through deferral and escalate any still unstaffable unit to administration.
- [ ] For N=2 delivery, a credit whose only filler would equal an adjacent lead is
  rolled back/deferred; the owner works and the credit remains pending. Cross-season
  boundaries, coverage, credits, and HU-016 swaps never yield lead = planned helper.
- [ ] Market retains three distinct effective assignees and delivery operational
  handover remains correct.
- [ ] In HU-016, the requester's confirmation exchanges both effective
  assignments. In HU-084, accepting coverage changes only the affected assignment.
- [ ] Android and iOS show equivalent vacancy, offer, volunteer/selection,
  deadline, acceptance, credit, final assignment, failure, and retry states.
- [ ] Rules prove clients cannot award credits, rewrite rotation ownership,
  manipulate candidate snapshots, or self-assign outside the workflow.
- [ ] Local/emulator acceptance covers all ratified edge cases before a separate
  shared-project activation story is proposed.

## Provisional local-client contract — 2026-09-12

This contract supports the authorized local implementation only. Construct
`createProvisionalShiftCoverageApp` with an explicit offer window, trusted clock
and any configured selection/beacon policy. Its `handle` adapter starts no listener.
The explicit `startProvisionalShiftCoverageServer` wrapper binds only loopback and
exports no deployable Cloud Function. Auth and Firestore must use
`demo-reguerta-hu084-coverage` at `127.0.0.1:9098` and `127.0.0.1:8798` respectively.
Real SDK verification is tested against Auth emulator tokens; this is not proof of
production token/IAM deployment configuration.

Requests use POST and an Authorization bearer token. They accept no query-string
fields, actor ID, role, balance, candidate evidence or alternate environment.
The existing exact `ShiftCoverageCommand` is the mutation body, including case,
operation and expected case/shift revisions. Queries are:

```json
{"schemaVersion":1,"environment":"develop","action":"overview"}
{"schemaVersion":1,"environment":"develop","action":"detail","caseId":"case-id"}
```

Success is `{ok: true, data: ...}`. A mutation's data contains `schemaVersion`,
`environment`, `operationId`, `caseId`, `revision` and `replayed`. Retry an uncertain
mutation with the same operation ID/body; reload current query state afterward.
A read includes resolved `memberId`, current admin/eligibility flags, server time,
explicit policy windows/capability, case views and only the caller's credits and
reserves. Every case includes its public date/type/position, current revisions,
status, own offer/volunteering and planning-authority availability. Admin-only
context contains reason, opener and volunteer count; candidate/exclusion/draw
records are not exposed. A case is visible to its participants/admins, or to an
eligible member while it is open/offered. Missing and hidden detail share one error.

Auth UID-to-member binding is re-read transactionally, including on replay. Native
clients must additionally fence asynchronous results to their captured session,
member and environment. `writable` only reports the planning authority: each command
still enforces permissions, state, time and physical-unit rules server-side. Valid
maintenance allows reads but disables mutations. Overview rejects over 250 cases or
250 caller credits; it never returns a partial board disguised as complete. Detail
bypasses the overview case-count bound; the same own-account limits still apply.

Errors return `{ok: false, code: ...}` without token, reason, stack or SDK messages:
401 for token failure, 403 for account-link/member authorization, 400 for malformed
transport/body, 409 for domain/source conflicts, 405 for unsupported method and
413 for bodies over 16 KiB, 415 for non-JSON POST bodies and 500 for unexpected
infrastructure failure. No notification or Sheets execution is implied by the
local handler alone. The separate local effects worker and native rehearsal now
exercise those integrations; real deployment is not implied. See `review.md` for
the separately recorded manual acceptance and current integration boundary.

Run the explicit local server from `functions` after starting Auth/Firestore with
`firebase.coverage-emulator.json` and the fixed demo project:

```sh
GCLOUD_PROJECT=demo-reguerta-hu084-coverage \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8798 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098 \
npm run serve:shift-coverage:local -- /absolute/path/policy.json 8789
```

The policy JSON must contain `maximumOfferWindowMillis` and may contain the existing
`selectionPolicy`/`beaconPolicy` objects. No duration, real beacon or assembly choice
is inferred by the runner. Tests supply synthetic policy explicitly. The server
prints only its loopback URL and closes its owned resources on SIGINT/SIGTERM.


## Dependencies

- HU-082 / issue #266 supplies rotation ownership, cohorts, and unpublished-round
  semantics.
- HU-083 / issue #267 must be integrated and preserve effective assignment
  separately in Sheets.
- Technical reconciliation with the approved policy and bilingual requirements, shared acceptance and rollout approval are live-activation gates.
- HU-085 production activation for the base planner is independent and need not
  wait for HU-084.

## Risks and mitigations

- **Policy activated by accident**: keep the provisional adapter demo/loopback-only,
  without production endpoint imports. Verify the policy mapping and integration
  before recording live acceptance.
- **Life disruption**: freeze unaffected published rows and require explicit
  responses.
- **Gaming volunteers/credits**: issue credits only from completed authoritative
  coverage and consume transactionally once.
- **Biased draw**: persist the complete snapshot/input/version and use a
  reproducible algorithm.
- **Queue corruption**: never derive ownership from the effective assignee.
- **Notification races**: version every case/offer and fence late responses.

## Definition of Done

- [x] The reported [assembly decision and date](ratification.md#decision-record-and-follow-up) are linked.
- [ ] Link the official minutes reference when available.
- [x] [English](../../../docs/requirements/mvp-requirements-reguerta-v1.md) and [Spanish](../../../docs-es/requirements/requisitos-mvp-reguerta-v1.md) requirements link the approved policy.
- [ ] Verify and test the implementation against the approved policy.
- [ ] Every acceptance criterion has automated or recorded manual evidence.
- [ ] Functions lint/build, contract, security, Rules, and workflow suites pass.
- [ ] Android and iOS unit/lint/build/UI gates pass with parity.
- [ ] Local/emulator workflow, notification, projection, and mobile read-back
  acceptance pass without a shared-project deploy.
- [ ] Any live activation remains open in a separately authorized rollout story.
- [ ] ADR/data documentation is aligned where architecture changed.
- [ ] Issue, branch, commits, and PR are linked.


### Native provisional boundary — 2026-09-12

The native repository accepts a session value containing Auth UID, member ID and
an authorization revision. Composition must advance the revision for every
logout/relogin (including the same UID), member/environment/role change. A response
is usable only if the captured session is still current after token retrieval and
after HTTP; presentation also fences completion/cleanup against its own generation.
The fixed local contract always targets `develop`. Release contains no local
repository, and the live app graph does not construct one.

Only unsigned Auth-emulator JWTs for `demo-reguerta-hu084-coverage`, with the exact
issuer and captured UID, may be sent to the local host. This is a client credential
routing guard, **not** token verification; the actual server verifies Auth and
canonical membership on every request. Token providers must return current emulator
credentials and must not persist them in presentation state. Native HTTP refuses
redirects and does not cache the private response.

Retain the full command, operation ID and both revisions on uncertain completion;
block different mutations until explicit replay resolves it. Do not regenerate an
ID or infer rollback from cancellation. A valid matching acknowledgement settles
the write even when subsequent read-back fails. Clear stale displayed state until
a fresh read succeeds. Definitive 400/409 rejections settle the rejected intent;
401/403 additionally remove the bound session and private state. These rules are
shared by both native ViewModels; business authorization remains server-side.
