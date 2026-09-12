# Plan - HU-084 (Stable shift coverage and earned credits)

## Start checkpoint — 2026-09-12

The maintainer requested the implementation branch and fewer, larger delivery
blocks. Branch `codex/hu-084-stable-shift-coverage-and-credits` starts from merged
HU-083 (`327e563`). Existing changes in the main checkout remain untouched.
The maintainer subsequently authorized provisional local implementation on
2026-09-12. Assembly ratification remains pending for live activation. Unresolved
selection rules and deadlines must remain explicit rather than silently defaulted.

Use three cohesive delivery blocks, not a new cut for each contract or test:

1. **Coverage backend:** lifecycle, candidate eligibility, reserve/volunteer/draw
   transitions, acceptance, cancellation, completion and credit issuance together
   with transactional persistence, authorization and emulator tests. Finalize the
   policy inputs before committing behavior that depends on them.
2. **Planning integration:** credit consumption and whole-unit staffing, membership
   transitions, immutable published ownership and atomic ledger/cursor publication
   with inverse/retry tests. Reuse the existing HU-082 planning/activation authority.
3. **Member/admin product and integration:** equivalent Android/iOS flows, Sheets
   projection, notification navigation and complete native/emulator validation.

Commit at coherent validated milestones. Split a block only for a demonstrated
independent risk or an unresolved product decision, not because a chat turn ended.
These are outcome groups, not a promise that each is one short session.

### Reuse identified before policy implementation

- `shift-eligibility.ts`: canonical active/common-purchase-manager predicate.
- `shift-planning-contract.ts`: queue cursor and owned positions.
- `shift-planning-bundle.ts` and source producer: credits currently reject when
  enabled; preserve that production boundary until the approved integration exists.
- `shift-sheets-import-plan.ts`: prospective helper and neighborhood revision
  contract; coverage must preserve the same completed-history invariant.
- Existing writer authorization, operation/event retention and transactional CAS
  boundaries remain the integration points. Do not add a parallel generic workflow
  or migration engine to implement this story.

## 1. Current state

Provisional local implementation is in progress under the maintainer
authorization of 2026-09-12. Live activation remains gated by assembly ratification.
The administrative lifecycle below is implemented; the full coverage backend,
planning integration and native product groups remain unfinished.

### Implemented local administrative lifecycle — 2026-09-12

- Open a stable vacancy, offer explicitly as administrator, accept/decline as the
  offered member, expire/cancel, record failure, and confirm completed coverage.
- Firestore transactions re-read active membership/admin roles, canonical target
  and delivery neighbors, maintenance authority and same-type member claims.
  Expected case/public revisions and operation receipts prevent stale writes and
  duplicate effects; rotation ownership and completed helper history are retained.
- Accepted coverage holds one same-type claim. Only completion creates a pending
  credit and advances that type's ledger revision; failure releases the claim
  without credit and retains the effective assignment for explicit re-resolution.
- Private cases, operation receipts, slot/member claims, credits and ledger state
  deny client access under both Rules policies. No Rules were deployed.
- `shift-coverage-provisional-store.ts` requires the fixed demo project and
  loopback emulator. No production entrypoint imports it. The trusted caller
  supplies a resolved member ID, clock and maximum offer window; no HTTP identity
  boundary or assembly deadline is implied by the test adapter.

Run from `functions`: `npm run test:shift-coverage` and
`npm run test:shift-coverage:emulator` (Java 21+ on PATH/JAVA_HOME).
The latter uses `firebase.coverage-emulator.json`, with Firestore on port 8798.
Fixtures are synthetic; no live develop/production data or Sheets are read/written.

### Validation of administrative lifecycle — 2026-09-12

- `npm run lint` and `npm run build`: passed, no compiler/lint diagnostics.
- Coverage input/eligibility/isolation plus existing swap/publication/writer tests:
  20 passed, zero failures/skips.
- `npm run test:shift-coverage:emulator`: 22 passed, zero failures/skips
  (12 coverage scenarios, 2 Rules matrices and 8 existing phase-1 compatibility
  tests). Real Firestore transactions cover simultaneous opens/accepts, replay,
  stale revisions/authority, eligibility drift, seasonal helper history, distinct
  market coverage, same-type exclusions and cross-type independence.
- Android/iOS are unchanged and not validated in this checkpoint. Their coverage
  product flows remain pending on both platforms.

### Local reserve/volunteer selection — 2026-09-12

The administrative lifecycle was committed and pushed as `b8ce4ea`. The next
cohesive implementation adds selection to that same lifecycle:

- An administrator starts selection once, immediately after opening the case;
  previous administrative offers cannot be erased by restarting selection. The
  case retains a sorted candidate
  snapshot, predicate digest, initial exclusions, reserve entry/revision and policy
  digest. Attempts never replace that pool; operation receipts retain successive
  exclusions and responses. Member/admin identities remain trusted adapter inputs.
- `fifo-signup-v1` is an explicit provisional test policy: reserves sort by server
  entry time then ordinal user ID; volunteers sort by server registration time then
  the same tie-break. `volunteerWindowMillis` is required configuration. These
  choices are not assembly ratification. A backwards server clock is rejected.
- Each `offerNext` selects at most one currently eligible member from the frozen
  pool. Acceptance still rechecks claims, membership, public revisions and delivery
  neighbors. A reserve exit/re-entry revision invalidates an outstanding reserve
  offer; late reserve entrants cannot enter the frozen FIFO. Decline/expiry advances
  to remaining candidates, never repeats a previously offered member.
- Exhausting reserve opens the configured volunteer window. Members register or
  withdraw themselves before the deadline; selection waits until that deadline.
  Missing/inactive/real-producer, assigned/adjacent and same-type-claim exclusions
  are explicit. Completed credits continue to block more same-type coverage.
- Exhausting volunteers records `drawRequired` without assigning anyone. The
  subsequent commitment/reveal and administrative paths are described below.
- `shiftCoverageReserves` is backend-private under both Rules policies. In this
  local rehearsal it is seeded with synthetic entries. Automatic reserve enrollment,
  exit and membership transitions are still pending; the entry schema does not
  decide when a real member enters/leaves the reserve pool.

Validation of the extended lifecycle: `npm run lint` and `npm run build` passed;
23 unit/regression tests and 31 emulator/Rules tests passed, with no failures or
skips (21 lifecycle scenarios, 2 access matrices, 8 phase-1 regressions). The new
scenarios cover full FIFO-to-volunteer completion, stable snapshots, eligibility
and reserve drift, withdrawal/deadlines/ties, simultaneous offers, same-type
claims, market parity, backwards clocks and attempts to reset selection history.
No native files were changed; native coverage screens remain pending on both apps.

### Local committed draw and administrative resolution — 2026-09-12

Reserve/volunteer selection was committed and pushed as `67f16ce`. This subsequent
implementation extends the same lifecycle rather than adding a parallel workflow:

- `commitDraw` fixes remaining candidates/exclusions, the original selection
  digest, public-neighborhood context, `sha256-rank-v1`, issuer public key and a
  future round. The round is computed from trusted genesis/period configuration
  with at least one complete period of lead time; no command accepts a candidate
  list, seed, round or signing key. An already published round is rejected.
- The demo `hu084-local-beacon-v1` evidence has a source, round, scheduled publication
  time, 32-byte hex value and Ed25519 signature over its canonical digest.
  `revealDraw` verifies those fields, the signature, commitment and current public
  context before persisting the signed evidence and one complete candidate order.
  Only the public signing key is persisted. Test-only signing keys exist in memory.
- An offer consumes the next currently eligible entry in that order. Declines,
  expiry, deactivation and same-type claims never change the committed evidence
  or add later candidates. Assignment/credit effects still require acceptance and
  actual completion. Replayed operations return the same result without writes.
- An empty eligible pool or exhausted draw records `adminRequired`. `offerAdmin`
  requires an explicit reason, current eligibility and member acceptance; the
  administrator cannot silently assign somebody or issue a credit directly.
- Cancelling a case with a committed draw preserves its slot claim. Creating a
  replacement case for the same vacancy therefore cannot obtain another draw.
  `resumeAdmin` permits explicit administrator recovery of that cancelled case,
  retaining the original commitment, evidence and attempts. This is an audited
  exception, not a claim that every drawn candidate was exhausted. Failed accepted
  coverage releases its slot normally; the effective assignment has already changed.
- No real beacon/source has been chosen. The signing issuer is synthetic and
  trusted in this emulator rehearsal. Authentication alone does not prove fairness
  or unpredictability. A production provider, its assurance/IAM boundary, failure
  deadlines and assembly agreement remain prerequisites to live activation.
  If a draw cannot be committed before the shift, it rejects; a reasoned cancel and
  separate manual arrangement remains available before a commitment exists.
- `shiftCoverageBeaconRounds` is backend-private under both Rules policies and is
  populated only by test fixtures here. No HTTP/feed publisher or deployment exists.

Validation: lint/build passed; 9 coverage/draw unit tests, 17 existing
swap/publication/writer regressions and 39 emulator/Rules tests passed, zero failures
or skips (29 lifecycle scenarios, 2 access matrices and 8 phase-1 regressions).
The scenarios include signatures/rounds/publication-time failures, altered
commitments, repeat reveal, competing commitments, cancellation/restart, source and
eligibility drift, exhaustion/admin acceptance and full draw-to-credit completion.

### Whole-unit credits and atomic local rehearsal — 2026-09-12

The draw/admin block was committed and pushed as `730e148`. The next implementation
reuses `consumeRotationPositions` and `ShiftRotationCursor` for a pure unit solver:

- Traverse owners in queue order. A pending same-type credit may serve its owner's
  first reached position only beyond the frozen/public round boundary. It consumes
  no calendar slot and its resting owner cannot also work that unit.
- Fill one delivery lead or three distinct market owners. If staffing fails,
  retry from the original cursor after disabling the last tentative credit;
  repeat until feasible or reject without a partial result. Disabled/frozen credits
  remain pending. Uncredited owners are never silently skipped to make a plan fit.
- The result records every served position, actual worker positions, next cursor,
  consumed credits and deferred credits. The strict ledger reader supports pending
  and consumed records, preserves the earning evidence and rejects duplicate
  pending same-type credits for a member.

`shift-credit-rehearsal.ts` is composed only into the existing fixed-demo/loopback
store. Its `previewCreditUnit` writes nothing. `stageCreditUnit` creates a private,
immutable proposal bound to the complete same-type ledger contents/revision,
claims, canonical rotation aggregate, membership, public shifts and maintenance
authority. Changed source data invalidates activation even if a credit's revision
was incorrectly left unchanged. Missing ledger/claim evidence fails closed.

`activateCreditUnit` is explicitly a **local transaction rehearsal**, not the
HU-082 production activation path. It atomically records the complete physical unit
under `shiftCoverageCreditUnits` with `scope = localRehearsal`, advances the existing
canonical rotation aggregate, marks selected credits consumed, releases their
claims, increments the ledger revision and marks the proposal `activatedLocal`.
Replay changes nothing; competing candidates cannot spend twice. It checks the
repository's document-write cap before writing. This rehearsal has no production
request-size admission/manifest/inverse integration and cannot authorize rollout.

For delivery it binds both public neighboring leads, includes a helper projection
and retains completed predecessor history. Already public dates are rejected.
**No public shift, predecessor helper, Sheets row, notification, seasonal bundle,
or app state is published by this rehearsal.** The next integration must put those
real projection mutations and credit/cursor effects in the existing HU-082 forward
and inverse manifests; a private unit record is not a substitute for public
activation. The subsequent checkpoint implements calendar continuity and complete
seasonal planning locally, as detailed below.

Both `shiftCoverageCreditPlans` and `shiftCoverageCreditUnits` deny direct client
access under strict and compatibility Rules. The only writes run on synthetic
emulator data; shared develop/production remain unchanged.

Validation: build/lint passed; 14 coverage/draw/credit unit tests, 17 existing
swap/publication/writer regressions, and 48 emulator/Rules tests passed with no
failures or skips. One unit test enumerates 1,272 small-cohort combinations of
credit subsets and cursor starts. Emulator cases cover earned-credit consumption,
preview/stage purity, whole-ledger drift, competing activation, demotion/membership/
authority changes, minimum-cohort deferral, frozen rounds, public-date rejection,
forged proposals, delivery neighbors/history, and missing ledger/claim records.

### Complete seasonal credit planning — 2026-09-12

The whole-unit rehearsal was committed and pushed as `00b3628`. The next local
checkpoint integrates credit traversal into the existing `planDeliveryShifts`
and `planMarketShifts`, using an explicit internal `provisionalCredits` input.
Calendars, projection dates, provenance, physical groups and ordinary output
remain owned by those planners. With an empty ledger their ordinary output is
identical across delivery cohorts of 2–35 and market cohorts of 3–35 members.

- Plan every target delivery date / all ten market dates, then close the actual
  served boundary round. Keep every skipped credit position alongside physical
  assignments so the cursor never advances by just the visible row count.
- Retry deferred credits at later eligible positions, preserve frozen rounds,
  distinct market workers and consecutive delivery leads. Closing delivery cannot
  spill into another round merely to compensate its final owner: defer that credit
  and let the restored owner close the existing round. Market still completes its
  final physical group, recording boundary and padding worker positions separately.
- Verify a persisted delivery helper against the canonical owner cursor before
  credits. A compensated first owner can change an uncompleted predecessor's
  prospective helper; completed actual helper/revision/time remain untouched.
- Carry credited overflow into the following season using complete served units,
  the ordinary calendar/physical-owner prefix and consumed ledger evidence. Reject
  missing/reordered positions, repeated credit IDs, unbound resting owners and
  attempts to thaw those published rounds. Ordinary prefix validation continues
  to reject skipped ownership without this explicit evidence.
- Return the full same-type ledger digest, consumed/pending IDs and every unit's
  traversal. A pure builder prepares exact before/after credit documents and binds
  even deferred/out-of-cohort ledger entries. These values support a future inverse
  manifest; they are **not an implemented activation or recovery transaction**.

The HU-082 bundle intake still rejects enabled/non-zero credit transitions. This
checkpoint adds no Firestore schema, endpoint, public writes, deployment or native
changes. The pending integration is concrete: capture this evidence in the bundle
source/wire contract, include public rows/helpers plus credit/claim/cursor changes
in forward/inverse manifests, validate transaction admission and demonstrate CAS,
rollback and replay together in the existing HU-082 runtime. Membership transitions
remain part of outcome group 2 after that publication integration.

Validation: `npm run build` and `npm run lint` passed without diagnostics.
`test:shift-coverage` passed 25 tests (11 new seasonal scenarios); the seasonal
suite checks 500 credit-subset/cohort combinations and 67 empty-ledger comparisons,
including complete two-season delivery and market carryover. Focused existing
planner/bundle/swap/publication/writer regression passed 69 tests. The broad HU-082
unit command passed 294 tests, with 51 existing emulator-dependent tests skipped;
this is not evidence that those 51 integration cases ran. The separate coverage
emulator/Rules command passed all 48 tests, with zero failures/skips. No native code
changed; Android/iOS feature parity remains pending on both platforms.

### Remaining integration boundary

The provisional coverage lifecycle is implemented locally through draw/admin
resolution. Outcome group 1 still lacks the real entropy provider and live backend
integration; local proofs do not close the production backend acceptance gate.
Proximity preferences beyond immediate delivery neighbors also remain a business
policy decision; the local implementation enforces the hard neighbor invariant.
The local adapter bounds shifts to 1,000 documents and selection inputs to 250
users/reserves/claims per queried source. It deliberately has no HTTP endpoint,
public user-facing projection, notifications or Sheets effects. Before any live
endpoint, integrate authenticated identity, existing writer resource fences,
admission limits and public-event/notification authority. The unit credit solver
and local atomic consumption rehearsal are implemented, and complete seasonal
credit planning now reuses the existing pure planners. HU-082 forward/inverse
publication, membership transitions and both native clients remain unfinished.
Production bundle intake still rejects non-zero credits. Assembly decisions and
deployment remain separate gates.

## 2. Technical approach after approval

Build coverage as a separate state machine, not as a special reciprocal swap or
a mutation of rotation order. Reuse HU-082 identity, authorization, environment,
and notification infrastructure where the contracts match, while keeping
coverage cases, offers, candidate evidence, and credits explicit.

Suggested backend modules:

- `functions/src/shift-coverage.ts`
- `functions/src/shift-credit-unit.ts` and `shift-credit-rehearsal.ts`
- `functions/src/shift-coverage-draw.ts` (local protocol implemented)

Suggested collections are frozen only after policy approval and threat-model
review. Likely concepts include coverage cases/offers, reserve membership, and
a credit ledger. Every mutable aggregate needs a version and idempotency key.

## 3. Layer impact

### Functions/Firestore

- Authoritative workflow and deadlines.
- Candidate snapshot/exclusion policy and deterministic draw.
- Atomic effective-assignment transition.
- Completion-based credit issue and later single consumption while the next
  eligible owner fills the same physical slot.
- Snapshot/digest binding to the complete same-type ledger version, with any
  post-stage ledger change invalidating activation.
- Atomic whole-unit credit planning for one delivery slot or one market group,
  with reverse-order rollback of tentative credit consumptions until the unit is
  staffable under the proposed safe fallback.
- Notification event creation and late-response fencing.
- Security Rules and backend-owned fields.

### Android

- Domain models/repository for coverage cases, offers, responses, and credits.
- Member vacancy/volunteer/offer UI and admin resolution UI.
- Session/environment/authorization fencing, localized errors, accessibility,
  and notification deep links.

### iOS

- Equivalent Domain/Data contracts and SwiftUI flows.
- Main-actor presentation ownership, cancellation, session/environment fencing,
  localized errors, accessibility, previews, and notification deep links.
- Swift 6 strict concurrency and the repository's construction/Sendability
  rules remain unchanged.

### Sheets

- Project final effective assignment and coverage metadata required for human
  review.
- Never allow Sheet edits to issue credits, replace candidate evidence, or
  mutate rotation ownership.

## 4. Phased sequence

### Phase 0 - Assembly gate

- Present the decision list from the spec with concrete examples.
- Include normal-round placement/tie order for joins and reactivations; do not
  treat the proposed tail placement as already accepted.
- Include frozen-round departure handling: free regeneration only before cohort
  freeze; after freeze, proposed `excusedDeparture` tombstone for an unpublished
  owner position versus a fully accounted coverage alternative.
- Include eligibility drift without membership exit: reason mapping, unfrozen
  remove/append order, frozen coverage/tombstone behavior, and re-entry without
  reviving prior owner positions.
- Record accepted wording, thresholds, deadlines, authorities, and any rejected
  option.
- Update English/Spanish requirements and user stories.
- Re-review this spec and issue before authorizing live activation.

### Phase 1 - Threat model and RED contract

- Model unauthorized self-assignment, forged completion, duplicate credit,
  replayed response, late response, demotion, environment change, and candidate
  manipulation, admin seed grinding/reroll, and overlapping accepted coverages.
- Model departure across unfrozen/frozen rounds and preview/stage/public positions,
  including tombstone replay/concurrency, cursor/round closure, and no false credit.
- Add failing pure state-machine, eligibility, ordering/draw, and ledger tests.
- Add failing Rules/security tests for every actor and backend-owned field.
- Add shared Android/iOS wire fixtures and lifecycle examples.

### Phase 2 - Backend workflow

- Implement versioned coverage cases and offer transitions.
- Implement the ratified frozen-round departure transition without mutating cohort/
  ownership: tombstone/skip as proposed, or the fully specified coverage alternative.
- Keep tombstones provisional through preview/stage. Activate tombstone(s), cursor/
  round closure, and one complete affected delivery/market unit atomically; on
  insufficient/distinctness/adjacent-helper failure, commit nothing and enter the
  ratified coverage/admin fallback or blocked state.
- Implement versioned HU-082 predicate transitions. Invalidate preview/stage; replan
  unfrozen rounds, preserve frozen cohort/owner, apply the ratified reason-specific
  coverage/`excusedIneligible` transition, and route later eligibility to reserve/
  next unfrozen round.
- Implement reserve and volunteer selection under the ratified ordering.
- Implement reproducible compensated draw and remaining-candidate retries.
- Implement effective assignment and notification publication atomically or
  through a resumable idempotent boundary.
- Implement completion-based credit issuance and unactivated-round consumption.
- Keep candidate credit effects provisional during preview/stage and commit them
  atomically only with exact revision activation; include the full ledger
  version in the snapshot/digest so any intervening issue/consume/cancel change
  invalidates that candidate.
- Attempt each pending credit at the owner's first eligible unactivated
  occurrence and retry it at the next such occurrence whenever safe staffing
  defers consumption.
- Plan one delivery slot or one market group as an atomic unit. Traverse the
  queue in order, exclude every tentatively resting credited owner from that
  unit, and fill from subsequent eligible owners with market distinctness. For
  delivery, exclude both adjacent effective leads and digest their assignment,
  completion, and revision.
- If staffing is impossible, roll back tentative consumptions in reverse queue
  order until feasible. The restored owner works and serves that position while
  only the credit remains pending for a later eligible occurrence. Use an
  alternative coverage fallback only if the assembly ratifies its complete
  original-credit/replacement-credit/failure accounting.
- CAS the complete affected delivery predecessor/current/successor chain at coverage/
  credit activation. Recompute only an uncompleted predecessor's planned helper;
  preserve completed actual helper history and reject equal-adjacent/stale results.
- Preserve HU-016 swaps and HU-082 rotation state.

### Phase 3 - Mobile parity

- Add member vacancy, volunteering, offer response, final assignment, and credit
  visibility on Android and iOS.
- Add administrator oversight/resolution without client authority over draw or
  credit.
- Handle deadlines, cancellation, stale context, notification deep links,
  localized failures, accessibility, and adaptive layouts.
- Refresh from Firestore after backend terminal state before showing success.

### Phase 4 - Projection and integrated validation

- Project effective assignment safely through the HU-083 Sheets adapter.
- Validate temporary absence, permanent departure across frozen/unfrozen and
  preview/stage/public states, join/reactivation, all
  selection stages, retries, market distinctness, delivery handover, completion,
  and credit consumption locally/in emulators.
- Reconcile emulator Firestore, Sheets adapter fixtures, notification outbox,
  Android, and iOS without a shared-project deploy.

### Phase 5 - Closure

- Run full platform/backend gates and an independent security/fairness review.
- Attach assembly decision, automated evidence, manual journeys, and parity
  matrix.
- Keep production deployment/live mutation outside scope until separately
  authorized with a HU-085-equivalent rollout gate.
- Create that activation story only after assembly ratification and integrated
  local/emulator evidence; HU-085 does not implicitly activate HU-084.

## 5. Test matrix

- Join/reactivation before and after one or multiple active/public rounds,
  including every proposed reserve-exit boundary.
- Reserve accepts, declines, times out, becomes ineligible, or changes context.
- Zero/one/multiple volunteers and ratified tie-breaking.
- Draw with committed snapshot/non-manipulable seed, no reroll, exclusions, retry
  among the committed remaining ordering, and exhausted set.
- Temporary absence versus permanent departure across delivery/market and the
  `unfrozen|frozen x preview|stage|public` matrix, with unaffected rows unchanged.
- `excusedDeparture` tombstone idempotency/replay/concurrency, deterministic cursor/
  round closure and next real slot, no completion/credit, and no replacement owner;
  if assembly chooses coverage instead, test its complete accounting.
- Atomic tombstone plus next-unit planning for delivery N=2, market N=3, larger and
  multiple-loss cohorts; prove no cursor/round/tombstone/credit mutation on an
  unstaffable unit and no unfilled calendar date/group.
- Eligible-to-ineligible and reverse transitions for active member, inactive status,
  common purchase manager, and real producer across the complete frozen/unfrozen x
  preview/stage/public matrix; re-entry never revives old tombstones/positions.
- Delivery/market credit issue only after completion.
- Pending accepted coverage and multiple-credit cases follow the ratified stacking
  cap/proximity/eligibility/order. Safe-default tests exclude a second acceptance
  while accepted/incomplete or while its completed credit is pending, then prove
  cancel/failure without earned credit releases eligibility under the terminal rule.
- Credit waits past an active round, retries after deterministic deferral,
  consumes once, stays type-scoped, and never leaves a delivery date or market
  position unfilled.
- Post-stage credit issue/consume/cancel invalidates the candidate by ledger
  version before any cursor or credit transition commits.
- Delivery/market unit solving covers the two-person delivery minimum, all members credited,
  consecutive credits, queue wrap, reverse-order rollback tie-breaking, the
  restored owner's served position, and pending-credit retry.
- N=2 credit deferral when the only filler is an adjacent lead; delivery coverage/
  credit/swap at previous/next, round, tab, and season boundaries; completion wins/
  loses the CAS race without history rewrite or lead = planned helper.
- Concurrent offers/responses/completion and idempotent replay.
- Admin demotion, member deactivation, UID/environment/session change.
- Market retains three distinct members; delivery handover stays operational.
- Prospective helper recomputation from the next effective lead before predecessor
  completion, actual-helper freeze afterward, and unchanged rotation ownership under
  coverage, credit, or HU-016 swap.
- HU-016 swap regression and HU-082 cursor invariants.

## 6. Validation gates after approval

### Functions

- `npm run lint`
- `npm run build`
- focused coverage, credit, draw, notification, backend-security, and Rules tests

### Android

- `./gradlew app:testDebugUnitTest`
- `./gradlew app:lintDebug`
- connected UI tests because member/admin workflow changes

### iOS

- focused Swift Testing cohorts
- canonical `fast-unit`, `ui-smoke`, and `release-gate`
- repository-pinned SwiftLint and relevant Xcode MCP preview/UI inspection

### Integrated

- Local/emulator workflow across Firestore, notification outbox, Sheets adapter,
  Android, and iOS.
- Manual accessibility/adaptive/parity matrix for member and admin roles.

## 7. Rollout and rollback principles

- No production rollout is authorized by this planning story.
- Enable the workflow behind an explicit backend capability/config gate if the
  implementation design demonstrates that staged rollout needs one.
- A rollback stops new coverage cases but preserves completed assignment and
  ledger evidence; it never deletes credits or rewrites published rows blindly.
- Reconcile any in-flight offer by version and state before disabling the path.

## 8. Main risks

- **Unratified business behavior**: hard stop at Phase 0.
- **Hidden coercion**: explicit acceptance and admin escalation.
- **Credit double-spend**: append-only ledger plus transactional consumption.
- **Stale staged fairness**: digest and recheck the complete relevant ledger
  version, not only the credit IDs selected by the old candidate.
- **Queue drift**: immutable rotation owner distinct from assignee.
- **Bias or non-reproducibility**: persisted candidates/exclusions/input/version.
- **Cross-platform divergence**: shared lifecycle fixtures and parity criteria.
