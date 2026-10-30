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

The three provisional local outcome groups are implemented under the maintainer
authorization of 2026-09-12 and have passed the bounded final review and validation
recorded on 2026-09-13, with the documented baseline/toolchain diagnostic residuals.
`review.md` is the current acceptance matrix. Dated sections below retain their
historical scope; their old pending statements do not override later checkpoints.
The bounded native manual matrix is complete as of 2026-10-04, including physical
accessibility and real push receipt/opening on both platforms. Ratification and
live integration remain open; the final pre-PR revision still needs its complete
iOS release gate, with unaffected recent validation reused explicitly.

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
  first rehearsal it was seeded with synthetic entries. The membership checkpoint
  below now manages observed local enrollment, ineligibility exit and re-entry;
  normal-cohort inclusion still does not decide the unratified reserve-exit boundary.

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

### Governed seasonal publication and inverse — 2026-09-12

Seasonal planning was committed and pushed as `e86ef80`. This checkpoint connects
credits to the existing HU-082 source producer, bundle, forward materializer,
inverse resolver/materializer and transaction admission/fence adapter. It does
not introduce another publication engine or a new public endpoint.

- An explicit local `sourcePolicy.creditLedger` setting contains only `enabled`
  and `policyRevision = hu084-provisional-v1`. The source producer reads both
  complete credit/claim collections and ledger generations inside its transaction;
  policy cannot inject balances or lower the frozen/public round boundary.
  Credited carryover is read from the active bundle with matching rotation lineage
  and artifact digest, then checked against the actual consumed-credit ledger.
- Preview/stage retain provisional ledger effects. The bundle digest binds the
  whole source, including deferred/out-of-cohort credits and claims. Manifest write
  counts are derived from the actual credit/claim/ledger changes, not an input count.
- Forward activation writes public delivery/market rows, prospective helpers,
  canonical cursors/maintenance, credit consumption, claim release, ledger
  increments, before images, held notification intents, sync commands and the
  ordinary terminal request/operation in the same existing transaction.
- A consumed claim is updated to `released`, retaining plan/time evidence for exact
  recovery CAS. It no longer excludes the member from selection or another offer;
  a subsequent acceptance replaces it normally. This is technical accounting, not
  a new stacking policy. The earlier private one-unit rehearsal retains its own
  historical deletion behavior; seasonal publication uses the shared HU-082 path.
- Inverse recovery verifies the complete post-activation ledger/claim set in the
  same transaction. Drift in a deferred credit, a newly issued credit, a reused
  claim or a ledger generation rejects recovery before any write. It restores
  exact credit/claim before images and advances ledger generations monotonically;
  it never resets a generation to the old number. The existing active-lineage,
  public-marker, sealed-lease, increasing-write-epoch and request replay checks
  remain in force.
- Existing logical write/byte admission and notification writer resource fences
  apply to the combined mutation set. Ordinary no-credit fixtures still pass,
  including inverse fixtures that predate the optional credit manifest.
- All enabled-credit planning requires the fixed demo project/loopback environment.
  Applying it additionally requires a Firestore instance constructed by the fixed
  local factory. Shared develop/production remain disabled, with no deploy, Sheets
  execution, notification dispatch or native changes.

Validation: build/lint passed without diagnostics; 25 coverage/seasonal unit tests
and 294 HU-082 unit/regression tests passed (51 existing cases require their other
emulator suites and were skipped). The expanded coverage/Rules emulator command
passed 60 tests; a subsequent focused publication run passed all 12 tests including
one added active-bundle carryover case (61 distinct emulator scenarios in total).
These cover real public publication and inverse through the common resolvers,
zero-write source drift/replay rejection, competing activation, eligibility drift,
write-budget rejection, exact before images, released-claim reuse and carryover.
No native tests ran because neither app changed. Both coverage product flows remain
pending, rather than a one-platform parity exception.

### Remaining integration boundary

The provisional coverage lifecycle is implemented locally through draw/admin
resolution. Outcome group 1 still lacks the real entropy provider and live backend
integration; local proofs do not close the production backend acceptance gate.
Proximity preferences beyond immediate delivery neighbors also remain a business
policy decision; the local implementation enforces the hard neighbor invariant.
The local adapter bounds shifts to 1,000 documents and selection inputs to 250
users/reserves/claims per queried source. The coverage lifecycle itself has no HTTP endpoint or native product projection.
The local seasonal publication path now creates ordinary public rows, held intents
and sync commands; no notification dispatch or Sheets execution has occurred. Before any live
endpoint, integrate authenticated identity, existing writer resource fences,
admission limits and public-event/notification authority. The unit credit solver
and local atomic consumption rehearsal are implemented, and complete seasonal
credit planning and governed HU-082 forward/inverse publication are integrated
locally. Membership reconciliation now manages reserve transitions and published
coverage cases locally. The following admission checkpoint now integrates new
unfrozen cohorts into governed publication and inverse. The frozen-unit checkpoint
below completes local outcome group 2 with whole-unit omissions and inverse
evidence. Both native clients and coverage notification/Sheets product integration
remain unfinished. Shared-project credit activation, assembly decisions and
deployment remain separate gates.

### Local membership and reserve reconciliation — 2026-09-12

- A trusted administrator reconciles one member against current Firestore user,
  both rotation aggregates, open maintenance authority, both reserve records and
  published shifts in a single transaction. CAS revision and actor-bound receipt
  prevent duplicate/conflicting operations. The audit keeps previous/current
  predicate inputs, source update timestamp, observed time, reason and reserve
  changes. Missing users are departures; malformed present users fail closed.
- Initial eligible cohort members establish a baseline without becoming new
  reserves. Eligible members outside the cohort and observed re-entries join both
  pools at the trusted observation time; same-time FIFO still uses ordinal UID.
  This is local observation provenance, not reconstructed historical activation
  dates. Ineligibility deactivates existing reserve entries; re-entry increments
  revision and resets FIFO time, invalidating outstanding reserve offers. Neither
  August nor normal-cohort inclusion removes an otherwise eligible reserve.
- An ineligible effective assignee gets one ordinary coverage case for each
  uncompleted future public position, preserving public dates, historical owners,
  completed helpers, rotations and credits. Existing occupied cases are reused;
  pending swaps are returned for administrative resolution. Accepted coverage
  that becomes ineligible also remains an existing case requiring resolution;
  this command never silently cancels or substitutes it. The shared opening
  constructor keeps subsequent selection/acceptance/completion on the existing
  workflow. All state/reserve/case/slot/receipt writes commit together; more than
  the canonical 500 writes or an oversized audit rejects with zero mutations.
- `shiftMembershipState` and `shiftMembershipOperations` are private under strict
  and phase1 Rules. The local adapter remains composed only by the fixed emulator
  store, with no deployed trigger, live user-write interception or native UI.
  User changes not observed between reconciliations cannot be reconstructed;
  live integration must observe each authoritative transition.
- Pending queue transitions retain a lower bound after every published/frozen
  round. They are not applied by this checkpoint: no cohort reordering, cursor
  advance or standalone tombstone occurs. Governed source capture, forward and
  inverse publication and the private unit rehearsal reject pending transitions;
  even disabling credits cannot revive an old position after reactivation.
  At this checkpoint both new-round admission and frozen unpublished skips were
  pending. The admission checkpoint below supersedes the new-round restriction;
  frozen unpublished skips still require full physical units and inverse evidence.

Validation: build/lint clean, 25 coverage/credit unit passes, 294 HU-082 regression
passes (51 tests for other emulator configurations skipped), and 73 passing local
emulator/Rules scenarios. These include FIFO re-entry, stale offers, real-producer
versus common-purchase-manager transitions, per-position departure coverage,
concurrency, oversized zero-write rejection, pending swaps/orphan claims, and
pending membership blocking both credited and credit-disabled publication.
The shared activation fixture now copies its cohort so one carryover test cannot
mutate the roster used by subsequent scenarios. Native clients are unchanged;
no Android/iOS runtime evidence is claimed by this backend checkpoint.

### Local new-round admission and publication — 2026-09-12

The reconciliation block is committed/pushed as `6706c5c`. This checkpoint reuses
its private state and both seasonal planners; it adds no alternative publisher.

- Reconciliation now records `admissionRequired` independently for delivery and
  market. A pending older record lacking this evidence fails closed; reconciling
  it cannot guess whether to keep or append an old position. This is a local
  provisional schema addition, not a deployed data migration.
- Governed enabled-ledger source capture includes all membership state and reserve
  records (250/500 limits). Every observed member predicate must still match the
  current roster. The source policy cannot supply ordering, reserve timestamps,
  or acknowledged states. Ordinary credit-disabled planning retains its pending
  membership fence; an enabled local ledger may admit members even with no credits.
- Admission requires both cursors at index zero strictly after all public/frozen
  rounds and every pending member's recorded admission boundary. Retained owners
  keep their exact order. Reconciled departures leave only the unfrozen cohort;
  new/re-entering members append by same-type reserve time then ordinal UID.
  Per-type flags prevent a market-only admission from moving a delivery owner.
  Missing reserve evidence, unobserved departures, inconsistent predicates, fewer
  than two delivery/three market members, or a frozen source reject the proposal.
- Each existing seasonal planner validates its inherited prefix against the original
  cursor, then starts the new cohort at the same new round. Whole physical units,
  credit deferral, cross-season overflow and prospective helper updates use the
  existing solver. Completed helpers stay historical; an equal adjacent delivery
  lead blocks generation instead of silently changing the new queue order.
- The existing forward manifest includes exact membership acknowledgement images
  alongside credits/claims. Acknowledgements, both cursors, both public calendars,
  before images, held intents and sync commands share the existing transaction
  admission. The full membership/reserve snapshot and live member predicates are
  reread on each forward/inverse retry, including records not acknowledged by the
  candidate. Changes after stage/activation reject without partial publication.
- Inverse restores the former cohorts and pending admissions with the original
  per-type evidence while advancing membership revisions, preventing stale
  reconciliation commands from becoming valid again. Reserve entries stay active
  and retain their FIFO time: cohort inclusion does not invent a reserve-exit rule.

Validation: clean build/lint, 32 coverage/credit/admission unit tests, 294 HU-082
regressions (51 cases for other emulator configurations skipped), and 81 local
emulator/Rules scenarios. New evidence covers simultaneous admission/publication,
credit plus membership consumption, exact inverse, full-source drift in both
directions, new-cohort carryover, insufficient staffing, old pending records,
per-type ordering and helper history. Under an emulator retry-token closure during
contention, the race test checks the exact transport error and retries the losing
command to prove its revision conflict and absence of duplicate writes; no SDK
workaround was added to production code.

At that checkpoint, frozen unpublished positions were still blocked. The following
whole-unit checkpoint supersedes this restriction only in the fixed local emulator.

### Local frozen-unit publication and inverse — 2026-09-12

The new-round admission checkpoint was committed and pushed as `859ede8`.
This checkpoint completes the provisional planning integration outcome locally:

- Traverse frozen owner positions without changing their historical cohort/order.
  Reconciled departures and eligibility loss retain `excusedDeparture` or
  `excusedIneligible`, original owner, round, position and membership revision in
  the activated bundle's complete-unit traversal. Re-entry preserves its prior
  exclusion evidence and can work only a new admitted position.
- Each omission commits with a complete delivery slot or three distinct market
  workers through the existing HU-082 activation. It creates no dated omission
  row, completion or credit. No separate tombstone collection or writer is added.
  Existing credits remain pending at omitted positions; a later eligible normal
  position may redeem them under the existing rules.
- Change cohort only at the first permitted new-round boundary. A market group
  can cross that boundary; its traversal records the new cohort so next-season
  carryover can replay both the old positions and the transition. A delivery
  boundary omission requires the next real slot; a trailing credit alone still
  cannot force an extra round. Prospective helper updates preserve completed
  helper history and all neighborhood constraints.
- Track pending acknowledgement independently per rotation. A plan ending before
  the first complete new-cohort unit leaves that type pending, without generating
  another round merely to clear an admission flag. Retained owner order and
  reserve FIFO are preserved when the remaining type is admitted later.
- Bind the complete membership/reserve/credit source and current user predicates
  during preview/stage/activation. Forward and inverse also read public owner
  positions in the same transaction: an already published position requires its
  coverage workflow and cannot be omitted, including publication after preview.
- Inverse restores prior public rows, frozen cursors, pending intent and credits
  atomically while advancing membership revisions. Repeat/racing activation cannot
  acknowledge twice. Insufficient cohorts or a unit that violates unique staffing
  or delivery adjacency reject with no cursor, omission, acknowledgement or credit
  writes; no unratified replacement algorithm is invented.

Validation: build/lint clean; 39 coverage/credit/membership unit passes, 294 HU-082
regression passes (51 other-emulator cases skipped), and 87 distinct emulator/Rules
scenarios validated across the full suite and focused publication rerun. Coverage
includes frozen departures/reactivation, producer/common-purchase-manager reasons,
minimum staffing, group transitions, published-position rejection in both directions,
large-cohort carryover and deferred per-type admission.

Next grouped outcome: member/admin product and local integration across Android,
iOS, authenticated coverage transport, Sheets projection and notification navigation.
Real entropy/provider policy, assembly ratification and deployment remain separate
gates. No live Firestore/Sheets, notification dispatch or shared-project deployment
was performed; this is not completion of the live HU-084 story.

### App integration: authenticated local access — 2026-09-12

The frozen-unit block was committed and pushed as `1ea675f`. The next authorized
implementation groups command transport, member/admin read models and identity/
privacy tests. This security boundary precedes native UI: the current engine accepts
already resolved member IDs and returns internal selection snapshots, so exposing
it directly would trust client identity and disclose candidate/exclusion evidence.
Verify bearer tokens per request and resolve canonical Auth links and current
members inside the same transaction as commands/replays. Project only client-safe
information.
Use real Auth and Firestore emulators in the fixed demo project. No deployable
function is exported and native integration remains pending until this contract is
verified. This is an independently reviewable access boundary, not a per-helper cut.

### Authenticated local access result — 2026-09-12

- `createProvisionalShiftCoverageApp` composes actual Admin Auth token verification
  (`checkRevoked: true`) and the existing coverage engine. Both Auth (9098) and
  Firestore (8798) must be on exact loopback addresses in the fixed demo project.
  Environment checks precede SDK composition and run before/after verification.
  No deployed export, production endpoint or identity bypass is introduced.
- Every query and command resolves `authLinks/{uid}` and the linked member's
  `authUid`, active status and roles in its Firestore transaction. Retry/replay
  re-reads that authority; receipts bind Auth UID, member, command and operation ID.
  A newly linked UID cannot replay the former session's receipt for the same member.
- Overview/detail return dates, statuses, case/current-shift revisions, own offer
  and volunteering, own credits/reserves, server time and configured deadlines.
  Administrators additionally receive the case reason/opener and volunteer count.
  No candidate snapshot, exclusion list, draw input, full ledger, token or internal
  SDK error is returned. Closed cases are visible only to participants/admins;
  real producers cannot browse vacancies, while common purchase managers remain eligible.
- Reads remain available during valid maintenance with `writable: false`. The flag
  indicates current planning authority, not advance authorization of a command:
  the engine still rechecks state, eligibility, deadlines, claims and neighbors.
  An oversized overview (over 250 cases/own credits) rejects explicitly; detail
  remains available. The provisional contract does not silently truncate data.
- The included local HTTP server binds only `127.0.0.1`, requires a policy JSON
  and port, limits JSON bodies to 16 KiB and exposes `/coverage`. Actual network
  tests run all app scenarios through it. It starts only when explicitly invoked;
  importing the module starts nothing, and cleanup releases listener/SDK resources.
- HTTP accepts POST with an exact command or `overview`/`detail` query and bearer
  token. Mutation acknowledgements contain only operation/case IDs, revision and
  replay status; clients must reload current state and retain the same operation
  ID when retrying an uncertain result. See the spec's local-client contract.

Validation: build/lint clean; 45 coverage/HTTP unit tests, 31 backend-security tests,
294 planning regressions (51 cases requiring other emulator configurations skipped),
87 existing coverage/publication/Rules emulator cases, and 17 new HTTP/real Auth plus
Firestore integration scenarios. Native sources are untouched; no native build or
UI evidence is claimed. Android/iOS presentation/session fencing, notification/Sheets
product effects and real entropy remain pending. The next
coherent implementation is the two native member/admin flows against this contract;
activation/ratification remains a separate gate.

## 2. Technical approach after approval

Build coverage as a separate state machine, not as a special reciprocal swap or
a mutation of rotation order. Reuse HU-082 identity, authorization, environment,
and notification infrastructure where the contracts match, while keeping
coverage cases, offers, candidate evidence, and credits explicit.

Suggested backend modules:

- `functions/src/shift-coverage.ts`
- `functions/src/shift-credit-unit.ts`, `shift-credit-season.ts` and
  `shift-credit-publication.ts`; `shift-credit-rehearsal.ts` is the earlier private
  single-unit test adapter.
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


## Native client and session checkpoint — 2026-09-12

The authenticated loopback API was committed and pushed as `70a1778` before this
step. The two existing apps use real Firebase authentication. Reusing their live
functions client would mix live credentials and a provisional local endpoint, so
this checkpoint groups the native contracts, local repositories, presentation
operation ownership and their tests before any route is exposed.

Both platforms now have typed overview/detail, case/offer/selection, own reserve
and credit projections plus command acknowledgements. Their coverage ViewModels
own one inbox and one in-flight mutation for an explicit UID/member/authorization
revision. The caller must replace that revision on logout/relogin, environment,
identity or authorization changes; responses from older revisions cannot publish
state or clear a newer operation. Tokens stay in Data, never in the ViewModel.

A lost response, cancellation after sending, invalid acknowledgement or transient
failure preserves the exact command/operation/revisions for explicit retry. An
acknowledgement followed by failed read-back clears the command and requires a new
read; it must not issue a second mutation. Definitive 400/409 failures discard the
intent and stale inbox; 401/403 also detach the local session and private state.
No optimistic assignment/credit is synthesized, and no retry changes the operation
ID. Eligibility, deadlines, selection, CAS and credit accounting remain backend-owned.

Local repositories are excluded from Release (`src/debug` / `#if DEBUG`) and have
no live composition call site. They accept only the fixed demo project's unsigned
Auth-emulator token for the captured UID, reject signed/foreign tokens before HTTP,
use only loopback (Android emulator host alias when needed), refuse redirects and
avoid response caching. The iOS adapter uses Foundation's documented stateless
redirect delegate with immediate `completionHandler(nil)`; async/await still owns
the request. No unsafe concurrency annotation or deprecated API was added.

The shared JSON oracle lives under iOS test resources and is also loaded as an
Android test resource. Repository-to-ViewModel tests cover inbox/offer/accounting,
accept/read-back, identical-intent retries, cancellation, UID/session changes during
token/HTTP suspension, invalid receipts/projections and definitive rejection.
An independent read-only architecture/style review found a byte-order-dependent
JSON assertion; it was replaced by comparison of decoded command fields.

Next grouped step: compose a separate emulator-auth rehearsal session and connect
both native member/admin routes, with action/deadline affordances, localized copy,
accessibility and UI/emulator journeys. These adapters and presentation models are
not yet user-accessible screens. Real native HTTP, connected UI, notification/Sheets
effects, entropy selection, ratification and activation remain pending.


Validation for this native checkpoint:

- Android `app:testDebugUnitTest`: 490 tests, zero failures/errors/skips, including
  ten new repository/presentation pipeline tests.
- Android `app:lintDebug`: successful, 136 warnings and two hints in unchanged
  files; zero diagnostics in the new coverage sources. This is not a global
  zero-warning claim, and no unrelated lint cleanup/dependency update is included.
- iOS repository `fast-unit` runner, iPhone 17 / iOS 26.5: 893 passed, zero failed,
  one skipped (existing opt-in HU-083 emulator test). The native result bundle reports
  1,365 successful parameterized/device executions; these are not 1,365 distinct tests.
- SwiftLint: zero violations in 493 files. Changed-diff Swift style audit: six
  files inspected, no remaining candidates/findings. `git diff --check` clean.
- Xcode MCP was queried first, but did not expose this worktree; validation used
  the repository-authorized runner and inspected its closed native `.xcresult`.
- No UI route/composition changed. Connected/native HTTP/UI-smoke and full release
  acceptance remain assigned to the next UI/emulator integration step. The connected
  Android device is a physical phone; it was not used to run an incomplete local
  rehearsal through the existing real-auth application graph.
- No Functions code changed after `70a1778`, so its already-recorded backend suites
  were not repeated. No shared Firebase/Sheets writes or notification dispatch.


## Native UI rehearsal checkpoint — 2026-09-12

Commit `99c5777` delivered the preceding native repositories/session block. The
current working tree connects member and administrator screens through separate,
Debug-only Auth-emulator sessions on both platforms. Tokens remain memory-only;
canonical membership is resolved by the server. iOS selects its existing test
composition; Android launches a separate process without the normal Firebase
provider or MainActivity graph. No Release route or live endpoint is enabled.

The grouped UI includes inbox/detail, absence forms, offer responses, volunteer
withdrawal, reserve/draw/manual actions, completion/failure, credits/reserves,
localized errors and deadlines, explicit uncertain-operation retry and logout.
Form confirmation rechecks session, current revisions, action availability and
expiry. Names distinguish concurrent market absences. Future inactive owners remain
selectable as absent members for admins while never becoming offer candidates.
Selections and accounting remain backend-owned; no extra domain workflow layer was
introduced. iOS date/time and Android minute inputs share the same deadline contract.

The bounded read model adds future assigned slots and minimal names, with eligibility
hints only for administration. Existing transactions still authorize reads and
commands. It never publishes private candidate snapshots, exclusions, emails or
Auth UIDs. The server supports up to 500 future slots and 500 member labels, with
an explicit limit error rather than truncation.

Reproducible setup and accounts: [native rehearsal](../../../docs/testing/hu084-native-rehearsal.md)
and [Spanish guide](../../../docs-es/testing/hu084-ensayo-nativo.md). The fixture
seeds only the fixed demo emulators and supplies a future market offer plus an
accepted past delivery. Native runtime demonstrated iOS member acceptance and
Android admin completion followed by the replacement's own earned-credit read.
Direct Firestore read-back confirmed market accepted revision 3, delivery completed
revision 4 and exactly one pending delivery credit for the replacement.

Validation:

- Functions lint/build and 45 unit scenarios pass. The final Auth/Firestore suite
  passes 20 scenarios, including inactive-owner and choice privacy regressions.
- Android: 495 unit tests, zero failures/skips; 23 connected tests pass on Pixel 8 Pro
  API 35. The separately opt-in HU-083 Sheets fixture was explicitly excluded after
  its missing-fixture assumption was reported as a failure by the runner. An initial
  UI automation collision was resolved by running the connected gate without any
  concurrent layout inspector. Lint passes with no diagnostics in coverage files;
  pre-existing unrelated diagnostics remain.
- iOS iPhone 17 / iOS 26.5: 900 passed, one existing HU-083 opt-in skip, zero failures;
  four UI-smoke tests pass. The explicit local HTTP acceptance test and own-credit read in AX5 also pass.
  The AX5 screenshot was inspected: names/state/credit wrap without truncation.
  Closed native result bundles were inspected. SwiftLint has zero violations.
- Independent read-only architecture/UI reviews corrected draft expiry/session
  validation, withdrawn volunteer and committed draw affordances, pending-operation
  guards, inactive-owner labels and deterministic previews. The design review found
  no need for more abstraction layers.

The next grouped integration is coverage effects through existing HU-083 Sheets and
notification infrastructure, with cross-platform reconciliation/regression. Complete
assistive-technology/device acceptance, real entropy selection, assembly ratification,
full release acceptance and HU-085 activation remain open. No shared Firebase/Sheets
writes, deployment, notification dispatch or production mutation occurred.

## Local coverage effects checkpoint — 2026-09-12

Commit `455d27a` published the native rehearsal screens. The current grouped backend
change connects successful coverage commands to a private atomic effects record,
the existing HU-083 readable Sheets adapter and generic notification inbox records.
The command receipt binds the effect digest; exact command replay creates no second
outbox. Rotation ownership, credit accounting and historical public-write markers
remain under their existing authorities.

Delivery acceptance updates the effective lead and prospective predecessor helper
across seasonal tabs; market replaces one person in the existing four-row layout.
The existing identity resolver is shared with import to reject ambiguous new labels.
Manual assignee/helper conflicts stop before overwriting, while notes, formulas and
formatting survive. Only changed public projections require a Sheet operation.
Completing coverage never writes Sheets again or grants another credit in this worker.

The fixed-demo worker reserves the workbook per projection operation and persists
exact human before/after images with complete bounded source document versions.
Authority, case and source checks precede external mutation and notification release.
Unknown acknowledgements retain the same submission; read-back can recover without
another mutation. Source drift retains the unresolved reservation for explicit
reconciliation. This deliberately bounded mechanism is not production multi-writer
recovery or a replacement for HU-082 admission/fences. Operations superseded before
processing are rejected; they are not silently marked delivered or re-prepared.

Generic inbox delivery and effect completion share one Firestore transaction, with
stable per-recipient IDs and inactive-user exclusion. The private record contains
case/revision references; no reasons or candidate/credit evidence enter Sheets or
notification copy. No notificationEvents fan-out event, FCM send, deployed function
or live Google client is constructed. The native UI fixture does not auto-drain the
in-memory workbook: this checkpoint proves the integration through automated local
scenarios, not a shared-project or physical-device end-to-end acceptance.

Validation:

- Functions build and lint pass without diagnostics.
- 45 coverage units and 72 Sheets scenarios pass.
- 101 Firestore/Rules scenarios pass, including 14 new effects cases: cross-season
  helper/lead projection, market round-trip, note/formula preservation, ambiguous
  labels, manual conflicts, uncertain transport before/after apply, drift, expiry,
  concurrent drains, replay, private collections and unchanged earned credits.
- 20 Auth/Firestore HTTP scenarios pass with zero-write snapshots now including
  effects and workbook reservations.
- 31 backend/security/HU-016 scenarios and 294 HU-082 planning units pass. The latter
  reports 51 emulator-dependent skips in its unit-only lane; these are not passes.
- Android/iOS sources are unchanged since `455d27a`; their native gates were not
  repeated. This backend checkpoint does not close the pending physical/assistive
  acceptance matrix. `git diff --check` is clean.

Next grouped outcome: authenticated case-specific notification detail/navigation
in both native rehearsals and integrated reconciliation, then the complete release
and device acceptance matrix. Real notification dispatch, external multi-writer
recovery and entropy provider selection require their governed integration; assembly
ratification and HU-085 remain the live activation boundary. No production data or
shared workbook was modified. The bilingual rehearsal guides document these limits.

## Authenticated notification rehearsal checkpoint — 2026-09-13

Commit `c672c76` (`feat(shifts): rehearse coverage effects`) is pushed. The next
local block implements and validates equivalent iOS/Android inbox-to-case navigation. The server resolves only an authenticated
recipient's delivered event, binding the completed effect and receipt to the
current minimal case. Affected helpers/market companions can read that projection
without administrative reasons, other members' credits or new command privileges.
Old offers show current state; copied, forged, pending and inactive-user references
are denied. Refresh retains notification scope, and Back restores the full overview
even during a pending request, without replaying or discarding an uncertain command.
Session changes invalidate late reads and navigation intent.

The native fixture now seeds a readable in-memory workbook and drains new effects
automatically. Native iOS market acceptance produced a completed effect and a third
simulated workbook batch. A further September 8 delivery vacancy makes restoration
of the full overview observable. No shared workbook, real Firebase project, FCM
send or notificationEvents fan-out is involved.

Validation:

- Functions build/lint and 45 coverage units pass; 103 Firestore/Rules and 22 real
  local Auth/HTTP scenarios pass, including recipient-reference authorization.
- Android passes 501 unit tests, lint (no coverage findings; unrelated baseline
  findings remain), and 23 connected tests on Pixel 8 Pro/API 35. The opt-in HU-083
  Sheets acceptance class is excluded because its separate fixture is not running.
  Runtime inspection confirms local notices open and refresh accepted delivery.
- iOS passes 906 tests with one existing opt-in HU-083 skip on iPhone 17/iOS 26.5,
  four UI-smoke journeys and explicit notification-to-market acceptance. That UI
  journey verifies Back both before and after acceptance. The final pending-request
  correction is additionally covered in both native unit suites, including response
  loss without command replay. SwiftLint is clean.
- Independent source review resolved recipient access, refresh scope and Back-during-
  request findings. Xcode MCP did not expose this worktree, so the repository runner
  and closed native xcresult bundles provide the build/test evidence; no new MCP
  previews or VoiceOver acceptance are claimed. `git diff --check` is clean.

Next grouped work: reconcile the remaining acceptance matrix and run the full release
validation, grouping simulator/device, accessibility and role scenarios. Real OS push
routing/dispatch, governed shared-writer recovery and entropy-provider selection
still need their integrations and decisions; assembly ratification and HU-085 retain
the live activation boundary. The story stays open; this is local integration evidence.


## Native acceptance and release checkpoint — 2026-09-13

Commit `d0dbec5` (`feat(shifts): open authenticated coverage notifications`) is
pushed. The native acceptance block was subsequently committed and pushed as
`3dcc84c`; it adds opt-in native acceptance tests and documentation. Product behavior and the fixed-demo backend are unchanged.
Both platforms authenticate real local demo roles, open/cancel acceptance and
completion forms, restore the full overview and read current server state again.
Android uses production Compose at font scale 2; iOS uses Spanish and AX5.
The existing Android drawer test now scrolls before checking its offscreen rows.

Validation:

- Android: 501 unit tests pass; lint passes with 137 existing unrelated findings
  and zero shiftcoverage findings. All 25 connected tests pass on both Pixel 8 Pro
  and Small Phone, API 35, including the two new opt-in scenarios. The separate
  HU-083 Sheets acceptance class is excluded because its fixture is not running.
- iOS canonical release gate: 917 passes, five expected skips, zero failures on
  iPhone 17/iOS 26.5; Debug/Release builds and SwiftLint (509 files, zero violations)
  pass. Skips are three local HU-084 opt-in journeys, the HU-083 opt-in journey and
  the conditional launch/performance test. Strict Swift 6/nonisolated settings
  remain intact. Test-harness-only adjustments were rebuilt in the focused lane.
- Spanish AX5 role/cancellation acceptance passes on iPhone SE (3rd generation),
  and iPad mini (A17 Pro) in landscape, iOS 26.5. The xcresult retains
  admin confirmation, replacement detail and member
  offer screenshots. Controls and body content remain reachable by scrolling;
  native navigation titles abbreviate at this size. This does not certify
  VoiceOver, TalkBack, physical devices or Android API 29.
- Final recursive Firestore read-back matches all 45 baseline demo documents: cases,
  credits, effects and inbox records are unchanged after the cancellation journeys.
  iPad gestures target the list, and screenshots capture the full screen so window
  coordinates do not crop the evidence. The final iPad rerun passes with all three
  screenshots reviewed; its long admin navigation title also abbreviates at AX5.

Evidence is local: `/tmp/hu084-acceptance-release-final.xcresult`,
`/tmp/hu084-acceptance-iphone-se-6.xcresult`,
`/tmp/hu084-acceptance-ipad-3.xcresult`, and Android connected-result XML/logs.
The bilingual rehearsal guides retain reproducible opt-in commands.

Next grouped outcome: integrate and test actual OS notification routing and dispatch
through the existing notification pipeline, keeping the isolated/live boundary.
Physical assistive-technology acceptance remains pending; shared-writer recovery,
real entropy selection, assembly ratification and HU-085 still gate live activation.
No production/shared workbook or real notification service was modified. Issue #268
stays open.


## Coverage push rehearsal checkpoint — 2026-09-13

Commit `3dcc84c` (`test(shifts): validate native coverage acceptance`) is pushed.
The push block is committed and pushed as `2779b2e`. It reuses
our generic Messaging transport with injected demo destinations and simulated SDK
submission. A verified inbox/effect is required; membership, offer expiry, case
revision and writer authority are checked again before claiming a send. Each
recipient has one durable submission receipt, with no raw tokens. Replays return
that receipt even if the case or destinations later change; submitting/unknown
outcomes never trigger automatic resend. APNs collapse identifiers are 64 bytes;
the longer opaque event ID remains intact in the generic payload.

Both native rehearsal routes defer coverage push opening until authentication and
until an active draft or uncertain command is resolved. Logout invalidates late
responses. Opening a notice already on screen preserves case navigation. Normal
live routes do not forward coverage events into the seasonal-planning detail.
The iOS system-tap journey exposed a UIKit main-thread assertion in the existing
async delegate completion bridge. The supported completion-handler signature now
copies the immutable reference and finishes on MainActor, including invalid payloads.
No SDK notification crosses the actor boundary.

Validation:

- Functions lint/build and 45 coverage unit tests pass; 108 coverage/Rules emulator
  scenarios pass, including concurrent submission, unknown SDK outcome, expired
  offers, source/writer drift and receipt replay after state/destination changes.
- Android: 502 unit tests, lint and all 25 connected tests pass on Pixel 8 Pro/API
  35, with both HU-084 opt-in journeys. The separate HU-083 fixture class is excluded.
  Cold activity Intent before login and warm `onNewIntent` both open the correct
  offered market case. Android shell notification posting is denied by the OS;
  notification-tray and real FCM delivery are not certified by those Intent checks.
- iOS: fast-unit passes 908 tests with one existing HU-083 opt-in skip; four UI-smoke
  journeys pass on iPhone 17/iOS 26.5. The final callback/composition change passes
  18 focused tests (19 parameterized executions), simulator build, Xcode MCP build
  and zero MCP warnings. The prior full release-gate evidence belongs to `3dcc84c`.
- On iPhone SE (3rd generation)/iOS 26.5, `simctl push` plus an actual Notification
  Center Open action retains the reference before login and opens the September 4
  market offer after authenticating as `d@example.test`, without accepting it.
  A second system tap with detail open preserves that case. The callback no longer
  crashes. This proves simulated OS routing, not APNs delivery or a cold-process launch.
- Recursive fixed-demo read-back contains 51 documents: the original three cases
  retain accepted/revision 3, offered/revision 2 and open/revision 1 states; six new
  receipts record simulated accepted submissions. All 51 documents remain unchanged
  after the final iOS journeys. No credit is created.
- Independent source review and Swift source-style audit pass after resolving the
  collapse-key, navigation, receipt-replay and callback findings. `git diff --check`
  is clean. No shared Firebase project, workbook or real Messaging endpoint is used.

Next grouped outcome: governed reconciliation for uncertain notification/projection
outcomes and shared-writer recovery. Real destination admission, provider selection,
physical assistive-technology/device evidence, assembly ratification and HU-085
remain explicit live gates. Issue #268 stays open. Reproduction instructions and
local evidence limits are in the bilingual native rehearsal guides.


## Governed recovery implementation — 2026-09-13

Approved next grouped outcome: recover fixed-demo projection and push effects using
HU-082's trusted closed-intake barrier and backend-owned, operator-bound authorization.
Bind authorization to the exact current evidence, require closed maintenance, verify
external evidence before committing, and preserve operation history. Reuse HU-083
read-only inspection: recovery cannot patch Sheets or resend push. Verified current
projections can release their generic inbox; superseded effects can be retired only
with exact projected rows still matching canonical assignments. Unverifiable rows
keep their reservation. Interrupted push submissions remain unknown, never delivered.
Replays and concurrent recovery must not duplicate inbox, alter credits or reopen
writers. Validate denial, drift, crashes/unknown outcomes and cross-season projection
recovery in the existing emulator suites. This does not supply live IAM/Drive controls,
real destination admission or new client/operator endpoints; those remain HU-085.


## Governed recovery checkpoint — 2026-09-13

This checkpoint builds on pushed commit `2779b2e` (coverage push dispatch and
routing) and implements and validates the grouped local recovery block.
It reuses the HU-082 trusted closed-intake adapter, evidence verifier and immutable
failure journal, plus HU-083 read-only projection inspection. No alternate lock,
live endpoint, IAM/Drive controller or automatic retry scheduler is introduced.

Backend-owned authorization beneath the exact effect binds an active administrator,
closed maintenance, workbook and source versions. Source, role and authorization
changes reject before effect completion. Matching canonical assignments and exact
Sheet read-back can atomically complete the effect, release its generic inbox and
remove its reservation without a new Sheets write. Shared inbox construction retains
the ordinary worker's behavior. Superseded/expired notification-only effects retire;
missing/conflicting projections or changed assignments keep the reservation.

Recovery preserves accepted, failed and unknown push history; an interrupted
submitting record becomes unknown with the original attempt and destination digest.
Recipients with no submission are listed separately. None is automatically resent.
Concurrent/repeated recovery produces one receipt/inbox release. A failed final
barrier check after commit leaves the receipt and a durable incident; retry cannot
claim clean completion. Writers remain closed, and the original effect authority is
not renewed. Future push admission after a new epoch requires its governed path.

Validation:

- Functions build and lint pass.
- 122 fixed-demo emulator/Rules scenarios pass, zero failures/skips, including
  14 new recovery scenarios. This covers lost projection acknowledgement, roster
  and writer drift, manual conflicts, canonical assignment drift, expired evidence,
  active/inactive administrator, missing/forged/revoked authorization, in-flight
  writers, another workbook, concurrent recovery, malformed push evidence, missing
  submissions and a lost final barrier acknowledgement. Nested authorization,
  recovery and push records deny client reads/writes under strict and phase1 Rules.
- 86 units pass, zero failures/skips: coverage/credits plus intake-barrier,
  trusted-adapter and notification-reconciliation regressions. The barrier fixture
  is shared with the pre-existing HU-082 tests rather than copied into a new framework.
- Source review and `git diff --check` pass. No Android/iOS code changed in this
  block, so their accepted push-block validations are retained without rerunning
  native builds. There is no new platform parity gap.

Evidence logs: `/tmp/hu084-recovery-emulator-final.log`,
`/tmp/hu084-recovery-units-final.log`, `/tmp/hu084-recovery-lint-final.log`.
Tests use real local Firestore/Rules and a stateful Sheets fake; the external
control-plane proof is simulated, not evidence of deployed IAM or Drive fencing.
No production/shared data or real notification endpoint was accessed.

Next: review the HU-084 acceptance matrix for closeout and consolidate remaining
local/manual evidence versus HU-085 activation work. Physical assistive-technology,
API 29, Android tray/FCM, iOS cold-process/APNs delivery, real entropy/provider and
assembly decisions remain explicit gaps. Issue #268 remains open.


## Pre-PR assessment — 2026-09-13

The next recommended step is one final branch review and validation pass, not more
independent feature cuts. A PR may review the explicitly provisional, demo-only
implementation with `Refs #268`. It must not claim the assembly-approved Definition
of Done or close #268. No PR, merge or activation is authorized by this checkpoint.

Before presenting that PR as ready for review:

1. Reconcile the full branch against the acceptance criteria in one current matrix;
   review cross-feature regressions, source/ownership boundaries and unnecessary
   complexity. Historical checkpoints and unchecked live tasks are not that matrix.
2. Validate the final revision: Functions suites including HU-016/HU-082 regressions,
   Android unit/lint/connected gates, and the canonical iOS release gate. Reuse
   unaffected recent evidence explicitly. The last full iOS release gate predates
   the final push callback; later focused/smoke tests do not replace that full gate.
   Separate the 137 recorded Android baseline lint findings from new diagnostics.
3. Attach the exact residual acceptance list: physical VoiceOver/TalkBack, Android
   API 29, Android notification-tray opening and iOS cold-process notification
   opening. Run feasible local checks; an unperformed check stays visible and cannot
   be marked passed. Real APNs/FCM delivery is also unverified.

Full HU-084 closure additionally requires the linked assembly decision and bilingual
ratified requirements, reconciliation/testing of any policy amendments (reserve exit,
windows/order, eligibility/departures, draw and credits), the real entropy-provider
contract, and completion or explicit disposition of operational observability:
structured logs/metrics for stuck cases, exhaustion, retries and credit failures.
Persisted audit receipts alone do not complete that observability task. Live backend,
mobile composition, destination admission and operational recovery remain unwired;
they need an explicitly scoped coverage activation handoff after ratification.

HU-085/#269 currently owns the base planner/workbook rollout and is independent of
HU-084. Its existing scope must not be treated as implicit completion or automatic
ownership of every remaining coverage task. Real IAM/Drive fencing, deployment and
production writes remain separately authorized activation work.

## Final review and validation — 2026-09-13

The maintainer authorized review/validation before considering the remaining manual
matrix. `review.md` now maps all 25 criteria to local evidence and unresolved policy
or manual boundaries. No functional defect was confirmed; new Swift layout findings
and stale current-status documentation are corrected. The independent 26-file Swift
reaudit passes, and no structural rewrite is recommended.

Functions: lint/build pass; 420 unit/regression passes plus 51 explicitly skipped
other-emulator cases, 122 HU-084 Firestore/Rules passes and 22 Auth/HTTP passes.
Android: 502 units and 25 connected tests pass on Pixel 8 Pro/API 35; lint retains
135 baseline warnings and two hints, none on HU-084 changed lines. iOS: canonical
release gate 919 passes, five expected skips, no failures; SwiftLint 509 files clean
and closed result build warnings/errors zero. Xcode MCP Release/iphoneos also
builds, with one raw AppIntents extraction warning documented in `review.md`.

At this checkpoint, the AVD named API29 actually ran API31 and a genuine API29
image/device was unavailable; the 2026-09-28 follow-up below resolves that gap. No new feature
cut, commit, push, PR, merge, issue closure or production action is part of this
review checkpoint. Corrections and report remain local pending delivery.


## API 29 acceptance follow-up — 2026-09-28

The new `Pixel_4_A10_API_29` runtime is verified as Android 10 / SDK 29. All 25
connected tests pass, with zero failures/errors/skips, including both opt-in HU-084
member/admin cancellation journeys at font scale 2 against the isolated local
fixture. No Android implementation change was needed. See `review.md` for the
command and evidence. Remaining device/manual checks: physical VoiceOver/TalkBack,
Android notification tray, iOS cold-process notification opening and real APNs/FCM.
Next recommended group: the two notification-opening checks, then physical
accessibility and isolated real transport. At the time of this run, changes remained uncommitted.


## Review checkpoint delivery — 2026-09-28

The maintainer authorized commit/push of the already validated Swift layout
corrections and bilingual review/API 29 evidence before the remaining manual tests.
This checkpoint records those changes; it does not open a PR, close #268 or complete
the outstanding acceptance gates. Android dependency updates were delivered
separately in `a50ec52`, with 502 unit tests and 25 connected API 29 tests passing;
lint retains 135 prior warnings and two hints. No business logic changed after the
recorded iOS gate; no additional full-suite run is needed for this checkpoint.


## Guided OS notification opening — 2026-09-28

The maintainer confirmed all three local Android tray variants on API 29 and the
iOS cold-process tray/login route on iPhone 17/iOS 27.0. Debug-only preparation,
validation and cleanup are recorded in `review.md` and both rehearsal guides.
The iOS simulator preference has been removed. Next: physical TalkBack/VoiceOver
journeys and separately configured isolated real APNs/FCM delivery. These results
do not complete policy ratification or live activation. No commit/push is included.


## Notification checkpoint delivery — 2026-09-28

The maintainer authorized commit/push of the completed local notification opening
block. Android Debug posts an app-owned tray notice; iOS Debug simulator uses an
explicit temporary preference for cold opening. Both guided outcomes and all
validation limits are recorded in `review.md`. The owned local Firebase services
are stopped and the temporary dependency symlink removed after the completed
rehearsal. No shared Firebase/Sheets resources or real APNs/FCM were used.

The proposed next physical device is iPhone 11 for VoiceOver. The current iOS
rehearsal transport deliberately accepts only loopback on ports 8799/9098; on a
physical iPhone those addresses refer to the phone, not this Mac. Therefore a
physical-device test setup must be prepared before using this local login there.
Opening the normal app does not validate the provisional coverage UI.


## Real transport preparation — 2026-10-04

The maintainer authorizes preparing both Debug clients for real notification
receipt. Previous notification delivery is a baseline, not a newly failed
capability. This block verifies the coverage-specific event and tap route using
a fixed read-only sample case, while keeping business data offline.

- Android: explicit opt-in Debug build; launcher routes to the rehearsal, token
  callbacks cannot upload business device records, and foreground/background
  receipts preserve the same fixed coverage reference.
- iOS: explicit persistent Debug launch opt-in for cold notification launch;
  real Messaging/APNs with the in-memory graph and a read-only sample case.
- Export only the opted-in installation destination to private local storage;
  a one-device sender defaults to an offline plan and verifies exact project/app.
- Validate routing, unknown-event rejection, command rejection and sender guards
  locally. Actual registration/delivery and APNs setup remain separate live checks.
- Use existing Debug app registrations in reguerta-9f27f. No deploys, Auth/Firestore
  writes, topic sends or notifications to members are included in preparation.

Execution completed on 2026-10-04 under separate, explicit per-device
authorizations: iPhone 11 and Xiaomi Android 14 each pass foreground, background
and process-closed receipt/tap/opening. The maintainer configured the missing
Debug development APNs key before the successful iPhone deliveries. Both devices'
rehearsal cleanup is verified; the previous Android Debug APK was restored without
clearing app data. See `review.md` and the bilingual native rehearsal guides for
receipts, boundaries and physical confirmations. This closes the isolated real
transport checks, not live business wiring or production activation.

## Provisional PR preparation — 2026-10-04

The maintainer authorized the recommended final review, iOS release gate, issue
reconciliation and provisional PR. The independent Android/Functions and iOS delta
reviews found no functional blocker. The current spec and bilingual guide summaries
now agree with the completed manual matrix. A minimal Swift standards correction
uses `JSONEncoder`/`JSONDecoder` for the existing Debug destination dictionary; the
follow-up changed-source audit is clean. No new abstraction or business behavior
is introduced.

The canonical final iOS release gate passes on iPhone 17/iOS 26.5
(`091D93C1-5A53-40D0-887E-83F81A8E0326`): 922 passed, five expected skips,
zero failures. Debug/Release, strict SwiftLint over 511 files and the concurrency
settings check pass; the closed result has zero build/analyzer/runtime warnings
and errors. The raw Xcode debugger-version lookup messages and reused Android /
Functions counts are retained explicitly in `review.md`. Temporary synthetic
Firebase configuration was cleaned up and the original Debug configuration restored.

Recent unaffected Android and Functions evidence is reused explicitly in
`review.md`, along with the completed physical matrix. The PR must use `Refs #268`
and retain the outstanding ratification, real entropy, observability and live
composition/admission/recovery gates. HU-085 owns only its explicit planner/workbook
rollout scope. Merge, issue closure, branch deletion and activation are outside
this delivery checkpoint.


## Grouped native administration — 2026-10-26

Approved by the maintainer: implement reserves, explicit permanent departures and
exact ten-week force-majeure exceptions together in Android/iOS and the existing
authenticated local HTTP adapter. Reuse #268 / draft #278 and the current HU-084
branch. HU-089 remains closed; its backend policy is the authority.

1. Add administrator-only minimal membership/accounting projections and separate
   typed administrative commands/receipts, preserving current coverage wire. Bind
   confirmation to current transactional source, accounting and authority. Resolve
   UID/member links and current roles inside each write transaction, including replay.
2. Reuse reconciliation to persist derived reserve entry/exit. Inactivity alone
   retains credits; explicit permanent departure requires inactive/missing source
   and cancels pending credits without restoring them on re-entry. Never edit user
   activation or offer a manual reserve toggle in these forms.
3. Derive exact spacing choices from current governed source and persisted preview
   intents using the same planner solely for diagnosis. Never store, stage or publish
   the diagnostic plan. Native clients select a bound pair and provide a reason;
   the approval transaction rechecks the original pair and context.
4. Add equivalent localized native forms with confirmation, shared mutation/session
   fences, exact uncertain retry and stale-state rejection. Validate backend pure,
   Auth/Firestore workflows, Android unit/lint/connected and the canonical iOS gate;
   independently review source and accessibility before handoff.

This block remains fixed-demo/emulator-only. Real Firebase/Sheets composition,
migration, provider selection, collective ratification, activation, main merge and
HU-084 closure remain separate. Existing main-checkout dependency edits are untouched.
Maintainer action: later guided native form validation; none needed to implement.


### Validated local outcome — 2026-10-26

The grouped administrative implementation is complete locally, with Android/iOS
parity and independent review closed. Functions: lint/build, 65 pure, 174 workflow
and 39 real emulator Auth/HTTP passes; planning regressions 295 passes/51 existing
skips. Both manual fixture modes pass their Auth/HTTP preparation smoke. Android
518 unit passes, 25 connected passes/four existing opt-in assumption exits, zero
lint errors (142 unrelated warnings/two hints). iOS canonical release gate passes
936 tests/five expected skips/zero failures and app/compiler/runtime warnings,
with 520-file lint and all concurrency/build checks clean. Detailed result paths,
preview evidence and incidental cleanup are recorded in `review.md`.

Next gate: guided physical accessibility/text/keyboard checks of these new forms,
starting with the iPhone offline sample. These are not equivalent to authenticated
business writes. The implementation remains local/uncommitted at this checkpoint;
#268 and draft #278 stay open. No new live-service activation is inferred.


### Guided focus correction — 2026-10-26

Physical testing found cancellation returning VoiceOver to navigation Back.
A two-View, one-shot typed SwiftUI focus return fixes the invoking administrative
button, guarded by current session and rendered/enabled state. The maintainer
confirms Update situation now returns correctly. Physical build and 19 focused
regression/UI-smoke results pass; independent source/style review is clean.
Permanent departure, spacing and text/keyboard manual checks remain in progress.
The prior full 936-pass gate predates this correction; no later full-gate run is
implied by the focused result. No new issue, commit, push or activation is created.


### Keyboard and independent touch actions — 2026-10-26

Physical editing confirms the permanent-departure reason/acknowledgement guard.
An explicit native Hide keyboard control now closes editing without losing the
reason; the maintainer confirms this on iPhone 11. Maximum-text departure reads
and controls are confirmed; spacing and maximum-text keyboard remain in progress.
New unchanged UI tests identify/fix automatic multi-button List-row activation
through independent borderless/scaled touch targets. Their corrected 2/2 run
checks both modal forms and actual software-keyboard behavior. Four prior UI-smoke
results remain valid separately. Independent reviews are clean. Next: finish
physical maximum-text checks, install/spot-check latest touch correction, then
refresh the final gate when all in-scope corrections are frozen. No delivery or
activation is implied; all changes remain local.


### iPhone administrative acceptance closed — 2026-10-26

The maintainer confirms direct-touch routing and cancellation of all three latest
forms. This completes the bounded iPhone 11 reader/focus/reason/acknowledgement/
text/keyboard/touch matrix. Freeze current source and refresh the canonical iOS
release gate; prepare the separate Android physical matrix. Parent story/PR remain
open and local changes uncommitted. No offline sample observation authorizes live
activation or establishes authenticated physical backend writes.


### Android physical continuation deferred by maintainer — 2026-10-26

The Android phone has no battery. The maintainer will charge it and continue the
new-form physical checks the next morning. Do not begin Android installation or
start its demo services until that continuation. No Android device is currently
connected; current ordinary Debug APK is already built and remote-push rehearsal
is disabled. Preserve this preparation, not an assumption of device acceptance.

Resume with exact device discovery/USB debugging, preserve installed Debug app
data, install the prepared ordinary Debug APK and prepare only the fixed local
Auth/Firestore administration fixture. Bind USB reverse 8799/9098 to that exact
device and launch CoverageRehearsalActivity with coverageUsbRehearsal=true. Start
with membership mode/admin example session, then new-form TalkBack, reason/guard,
text/keyboard and cancellation checks. Spacing mode remains the second fixture.
The iPhone bounded physical matrix is complete and need not be repeated. Current
iOS final release-gate execution continues independently; no commit/push or
shared-service activation is authorized by this deferral.

### Final iOS gate closed with an explicit diagnostic follow-up — 2026-10-26

The refreshed canonical gate covers the frozen current iOS source: 943 total,
938 passes, five expected skips and zero failures; lint (521 files), settings and
Debug/Release builds pass. Source/configuration restoration is verified. Its
closed result also records two `Invalid frame dimension (negative or non-finite)`
runtime warnings in the new keyboard UI tests. Preserve those diagnostics and
their result bundle in `review.md`; test success is not a zero-warning handoff.
Diagnose the exact source before claiming a clean gate or applying any fix.

The maintainer need not perform more iPhone steps tonight. Android new-form
TalkBack/text/keyboard acceptance resumes when the charged phone is connected the
next morning. Existing local changes remain uncommitted, #268 and draft #278 stay
open, and no activation or production action is inferred.

### Android physical preparation resumed — 2026-10-27

The maintainer connects/unlocks the charged Xiaomi 21081111RG, Android 14.
The ordinary Debug APK still matches the prepared SHA-256 recorded in review;
its remote-push flag is false. Preserve the installed APK and original device
settings privately before replacement; installation succeeds with existing app
data retained. Initial font scale is 1.5 and TalkBack is not enabled.

Functions build passes. Only fixed-demo Auth/Firestore and the local membership
fixture are started; its authenticated administration read-back is HTTP 200,
membership writable, eight synthetic members and no spacing candidates. USB
reverse binds only 8799/9098 to this device, and the explicit rehearsal Activity
opens. Xiaomi rejects shell input injection, so the maintainer must enter the
local example credentials manually. No physical acceptance or business command
has yet been recorded. Resume with the local login, then guided TalkBack checks;
keep the separate iOS runtime diagnostics open.

### Android membership observations and spacing preparation — 2026-10-27

The maintainer confirms the new membership forms with TalkBack: complete reading,
cancellation returning to each invoking button, reason validation, keyboard
dismissal preserving text, and Back reachable with the keyboard open. The native
font control already has its largest option XXL selected, measured scale 1.5;
do not claim a 200-percent physical run. Both reserve activations, unchanged
entries/revision on repetition, retained pending compensation for inactivity, and
explicit permanent-departure cancellation are observed physically and checked
through authenticated local read-back. Evidence is recorded in review and both
native rehearsal guides. Direct-touch checks remain pending.

After preserving membership read-back, stop the owned rehearsal and restart the
same fixed demo in spacing mode. Preparation confirms maintenance closed and
48 exact exception pairs; Ana's first pair is 03/09/2026 round 1 to 15/10/2026
round 2. Dates remain future relative to the fixture's virtual 01/06/2026 clock.
No public shifts or persisted planning candidates exist before the new physical
checks. The phone is reopened at local login; request fresh authentication and
verification of the disabled membership actions before the spacing form.

### Android physical matrix complete; next local gate — 2026-10-27

The maintainer completes spacing TalkBack reading, reason/disabled-confirm guard,
return focus, XXL/1.5 readability and keyboard handling, then reopens the exact
Ana pair by direct touch with TalkBack disabled and authorizes it. Read-back moves
48 pairs to 47, removes only the chosen dates/rounds, and records one exception
and operation with the expected member, bundle, reason and actor. Existing source,
request, configuration and rotations remain unchanged; no public shift or
persisted planning candidate is created.

After a deliberate membership-fixture reset, the maintainer opens/cancels both
membership forms by direct touch without submitting. The full administrative
snapshot remains unchanged. The bounded Android physical matrix is complete.
The exact original APK is restored and verified; TalkBack is off and display
size/density are unchanged. Preserve the final normal font scale 1.0 (initial
XXL/1.5); no shell font write succeeded. Demo services and owned USB reverse/
dependency links are removed. Definitive cleanup is recorded in review.
Both native physical matrices are now accepted
within their documented offline/emulator boundaries.

Next: diagnose and resolve or explicitly attribute the two invalid-frame runtime
warnings in the latest iOS keyboard UI tests before claiming a clean validation
handoff. No new Git delivery is performed: all grouped administration changes
remain local/uncommitted, and parent #268/draft #278 stay open. No production
activation is implied by completion of these physical checks.

### iOS keyboard runtime correction authorized — 2026-10-27

The maintainer authorizes correcting the two invalid-frame runtime warnings
before Git delivery. Reuse the current HU-084 branch/worktree and open parent
issue; preserve all pending feature and unrelated main-checkout changes. One
operator owns stable-Xcode runtime sessions and temporary configuration, while
independent source review remains read-only.

The same two keyboard UI tests reproduce exactly two runtime warnings without
changing their expectations. The focus-condition experiment does not fix them
and is reverted exactly. Unified logs retain usable backtraces; symbolication and
a live breakpoint identify InputAccessoryBar.body in native SwiftUI 26.5 passing
fixed width +infinity to FrameLayout. No application geometry supplies that value.
The next scoped candidate moves the existing dismiss-keyboard action from the
keyboard accessory to the trailing navigation bar, preserving its focus condition,
action, text and identifier. Check the same tests and maximum-text presentation.
Do not suppress diagnostics, clamp unrelated geometry or remove deadline refresh.
The placement comparison passes both unchanged keyboard tests with zero issue
summaries. Interactive AX5 shows complete Back/Hide keyboard actions but elided
central titles. Reuse the other command sheet's established accessibility-title
pattern: a wrapping header in Form and empty navigation title for accessibility
sizes. Independent source/style review is clean; six focused UI tests pass with
zero issues, and updated AX5 runtime/preview checks confirm complete headers and
reachable Back/Hide keyboard actions. The physical iPhone spot check is now
confirmed in the follow-up below.

The canonical gate on final freeze 8877b7c316e1658e4ea4297f76ec2785ccb13859357fffcbabe7c47ad4afaa04
is now closed: 938 passed, five expected skips, zero failures and zero compiler,
analyzer or runtime issue summaries. SwiftLint (521 files), all six settings
checks and Debug/Release builds pass. Five original configuration/resource files
and 531 hashes are restored exactly; no Git delivery is performed. Keep previous
physical observations distinct from acceptance of the new navigation-bar
placement. That targeted physical check is now confirmed below; parent HU-084's
live/ratification gates remain separate.

### Physical follow-up connected and prepared — 2026-10-27

The maintainer confirms the connected/unlocked iPhone 11. Current device discovery
confirms the expected phone on iOS 27.2. The frozen corrected Debug source is
built, installed and launched with the explicit offline sample, Spanish and
process-only AX5 arguments. Five configuration/resource originals and 531 hashes
are restored exactly; no global phone setting is changed. The physical build has
zero source compiler diagnostics and one Apple AppIntents metadata-extraction
tool warning (no framework dependency), recorded separately from the clean
canonical Simulator gate. No suppression or unrelated configuration fix is made.

The attached-run screenshot shows text and maximum size. Two detached screenshots
omit text despite the expected process/arguments remaining alive. The maintainer
confirms that the actual phone displays the offline text with very large letters;
the capture omission is not evidence that the visible app is blank.

With VoiceOver, the maintainer reads the complete departure title and the
navigation-bar Hide keyboard action, enters Prueba, hides the keyboard retaining
the reason and cancels. Focus returns to Register permanent departure; no command
is confirmed. This closes the targeted physical regression for the shared control
and accessibility header. Post-fix spacing layout evidence remains the documented
Simulator check. Source still matches the accepted full gate; recording this
observation needs no new build/test. Git delivery remains pending. The separate
Apple AppIntents metadata warning is recorded in review without suppression or
an unrelated dependency/configuration change.

### Administration delivery preparation and AppIntents investigation — 2026-10-27

The maintainer now explicitly authorizes commit and push of the grouped native
administration block and requests a supported correction of the separate
AppIntents warning if possible. Inspection of the installed Xcode 27.1 extractor
specification and a bounded processor probe find no suitable correction:
`LM_ENABLE_LINK_GENERATION=NO` supplies `-d` and replaces the original warning
with `Metadata extraction disabled by --disable`. The probe exits zero and keeps
the original app/resources unchanged. Warning filtering and the undocumented
internal metadata-skipping macro are not adopted. No framework import, build
setting or product source changes for this investigation.

Reuse the corrected canonical gate, both physical acceptance records and the
unchanged Functions/Android checks for the feature commit. The Apple tool warning
remains an explicit physical-build limitation. The maintainer additionally
authorizes their Android library updates; carry those into a separate commit
after checking the exact user delta and validating Android on the resulting
versions. Preserve the unrelated main-checkout iOS project edit. Git delivery
updates the existing draft #278; parent #268 and all live/ratification gates remain
open. No merge, closure, branch deletion or shared-service action is authorized.

### Maintainer Android library refresh — 2026-10-27

Native administration is committed as `1ad781d`. Apply the maintainer's Android
catalog delta in a separate build commit. Five requested versions already exist
on this branch; the remaining updates are Kotlin 2.4.21, Firebase BoM 35.1.0,
DataStore 1.3.0, serialization 1.12.0, ML Kit prompt beta5 and Tink 1.24.0. The final
catalog matches the maintainer's file without reverting prior branch updates.

Use the supported Gradle resources `directories` set instead of deprecated
`srcDir`. Four existing encrypted-storage migration test calls now pass their
already-created registry configuration to Tink's supported overload; parameters,
assertions and cryptographic behavior remain unchanged. No suppression or new
abstraction is introduced. Preserve the main checkout's original files.

### Authenticated normal-app composition — approved 2026-10-27

The maintainer authorizes integrating both normal apps with the real backend
composition. Continue in the existing HU-084 branch and issue; no duplicate story
or branch is needed. Preserve the two local edits in the separate main checkout.

Implement one grouped result:

1. Reuse the coverage state machine with an injected Firestore client and explicit
   environment. Keep the existing demo wrapper fixed to its project/ports and
   prohibit direct actor IDs in shared composition. Bind case, effects, reads and
   administrative receipts to the selected environment.
2. Add authenticated `resolveShiftCoverageAccess` and `shiftCoverage` HTTP
   boundaries using the already-owned Admin SDK clients. Validate transport before
   Auth, resolve current account links and roles, reject environment rerouting and
   recheck readiness inside each transaction, including replay.
3. Add equivalent Android/iOS normal-session repositories and navigation, reusing
   the existing forms/controllers. Bind UID, canonical member, environment and
   session revision; reject impersonation and late token/read/write continuations.
   Keep emulator credentials and login UI confined to rehearsals.
4. Validate shared environment isolation, disabled access, role/session changes,
   mutation/replay and native navigation. Run platform checks and independent
   review; record actual results and limitations without substituting them for a
   deployed or physical shared-backend journey.

The private optional `sourcePolicy.coverage` namespace supplies an exact
environment-bound activation record, supported policy revision, ratification
reference and explicit maximum offer window. Missing/invalid/disabled policy
stays closed. The exported composition additionally remains operationally closed
by construction: coverage effect ownership versus the ordinary write trigger,
HU-083 workbook leases, writer-intake inventory, real entropy and authoritative
credit/membership migration are not completed by this transport/UI integration.
Do not lift the existing provisional planner/publication guards to make the
endpoint appear usable. No shared configuration write, deployment, notification,
production mutation, merge or issue closure is authorized by this implementation
step. When a deployment or real-device shared journey is concrete and validated,
present its exact scope to the maintainer as the next external-action gate.

### Normal-app composition validated — 2026-10-27

The grouped source implementation and independent reviews are complete locally.
Functions pass lint/build, 68 pure, 47 Auth/SDK and 174 workflow/Rules/publication
tests; planning passes 295 with 51 existing emulator-only skips. Android passes
542 units and final lint with no findings in touched files; 27 API 29 instrumented
passes and four known opt-in exits remain bounded component/transport evidence.
The final metadata-scope change repeats unit/lint and test-APK compilation.

iOS completes a corrected canonical gate on Xcode 27.1/iPhone 17/iOS 26.5:
951 passed, five expected skips, zero failures and zero compiler/analyzer/runtime
issues. The first full attempt caught one preview's forbidden Data-type reference;
replace only that unused dependency with its existing preview double, then rerun
the complete canonical gate successfully. Keep the failed attempt as historical
diagnostic evidence. All 538 protected inputs, five originals and the updated
47-file freeze restore exactly; the catalogue adds one key and changes no prior
key. No validation is represented as new physical shared-backend acceptance.

Normal UID/member/environment/authorization and SDK token fences, immutable
uncertain retries, exact-session admission, and typed Android metadata scope are
reviewed. No workflow duplication or global Auth-pipeline refactor is introduced.
Read-only inspection confirms that the shared Firebase project still lacks the
two new endpoints. The source is not deployed or activated, and this implementation
step performs no commit/push. Next: checkpoint the coherent change, then complete
one owner for coverage versus ordinary Sheets/notification effects and their
shared workbook/intake controls before a rollout can be considered. Collective
ratification, real entropy and authoritative migration remain explicit parent
requirements; the maintainer needs no phone action at this checkpoint.

### Git checkpoint authorized — 2026-10-27

The maintainer explicitly authorizes commit/push of the validated normal-app
composition and then the grouped Sheets/notification writing-coordination work.
Reuse the unchanged accepted platform/backend evidence above, stage only this
worktree's intended implementation and matching changelog, and retain the existing
draft PR and open parent issue. Preserve unrelated main-checkout edits. Definitive
Git delivery is recorded in the canonical issue/PR after remote verification.
Begin the next implementation only after this source checkpoint is pushed.

### Shared projection and notification coordination — 2026-10-27

The normal-app source checkpoint is delivered as `be3fde49`; exact remote hash
matches and issue #268/draft PR #278 reflect that delivery. The maintainer
authorizes the next grouped backend implementation on this branch:

1. Give coverage public events one historical effects owner without changing
   planner provenance; bind receipt/outbox and exact server commit metadata.
2. Share HU-083 workbook submission and partition authority with coverage,
   imports and ordinary export entrypoints. Close the command-to-worker gap and
   reject stale ordinary events before external writes.
3. Persist possible submission identity before I/O. Inspect-only retries and
   governed recovery retain uncertain outcomes; release inbox only after exact
   verified coverage projection. Keep the existing per-recipient push owner.
4. Generalize backend workers through injected SDK/environment authority while
   retaining fixed-demo wrappers; version the affected-writer inventory.
5. Run local SDK/Rules race/failure checks and HU-082/HU-083 regressions, independent
   review and Functions gates. Reuse accepted native evidence because no native
   code changes. Record actual findings/results below and in review/tasks.

ADR-0019 records the alternatives, retention and acknowledged ordinary-export
limits. This block does not enable `operationalReady`, deploy, send real push,
modify shared workbooks/data, merge or close the parent story. The maintainer
does not need to connect or operate either phone during this backend validation.

### Coordination validation and handoff — 2026-10-27

The grouped block passes Functions lint/build, 75 pure, 297 planning (51 existing
emulator skips), 47 Auth/SDK and 204 workflow/Rules cases. HU-083's combined
108-pass regression gate and the final 28-pass isolated trigger fixture retain
81 unchanged sync/import/consumer cases; review.md avoids double-counting.
Independent review closes ownership, batch/fencing, first-governed-Drive-base,
lost-Firestore-ack and fixture-isolation findings. No native source changes; reuse
the accepted Android/iOS gates. Owned emulator processes and dependency symlink
are removed; no phone action is required. The new block remains local after
pushed be3fde49 and is ready for its next source checkpoint. Shared activation
remains false. Next recommended work is authoritative initial source/credit
migration and shared destination/operator admission before a bounded shared
rehearsal; deployment/data changes require their concrete authorized handoff.
### Initial coverage-state bootstrap — authorized 2026-10-27

The coordination block is committed/pushed as `fd225f35`; exact remote identity
matches and the delivery worktree was clean. The maintainer authorizes initial
membership/reserve/credit preparation next and explicitly declares zero initial
outstanding credits and no known prior active reserves.

Reuse each environment's canonical Firestore `users`, current rotation aggregates
and ordinary public ownership evidence. Initialize missing private coverage state
only; retain users/Auth, rotation order, published dates/assignments and valid
existing private history. A missing collection does not itself prove a zero
balance. Contradictory pending credit/reserve, source/roster ambiguity or malformed
legacy evidence blocks application and produces a reviewable report.

Implement one grouped result on the existing HU-084 branch/issue:

1. A deterministic read-only plan binds complete bounded source sets/versions,
   explicit zero declarations, cutoff, proposed creates and blockers to a digest.
   Existing cohort members start as baseline members, without joining the reserve
   at migration time. Do not bulk-run the ordinary reconciler or recreate queues.
2. An injected Firestore adapter rechecks reciprocal current administrator identity,
   exact source sets and absence preconditions in one create-only transaction
   under the existing trusted closed-intake barrier. Respect transaction budgets,
   persist one immutable receipt/current pointer and retain incident evidence on
   uncertain final acknowledgement. Exact replay never reinitializes live state.
3. The normal backend additionally requires a verified bootstrap receipt for
   admission; preserve `operationalReady:false` and all ratification/provider gates.
4. Supply an offline JSON review tool, concise bilingual operator/user guidance,
   pure/SDK/Rules denial, drift, race and replay checks. No new native wire shape
   or UI behavior; accepted Android/iOS evidence remains applicable if unchanged.

No live migration, shared-data write, deployment, notification, merge or closure
is authorized by this preparation. The CLI first version has no cloud SDK or
apply mode; the injected apply adapter is exercised only in fixed-demo tests.
The maintainer has answered the two initial-balance questions; no phone action
is needed. Actual shared snapshot review/application will require its concrete
bounded operational handoff after the source implementation is ready.

### Initial-state validation and real develop readiness — 2026-10-27

The initial-state implementation and independent review pass locally: Functions
build/lint, 103 pure, 297 planning (51 existing skips), 215 workflow/Rules, 50
Auth/SDK and 109 HU-083 regressions. The 28 focused pure/CLI and 22 focused SDK
cases are included in the full gates; do not count them again. No native source
changes, so accepted Android/iOS evidence is reused. Review records fixture/type
corrections and all actual scope limits. The code remains local after fd225f35.

A bounded Firebase MCP read in reguerta-9f27f finds exactly the four masked develop
configuration documents absent (current, sourcePolicy and both rotations). No
users, production or workbook is accessed, and no shared write occurs. Shared
application therefore needs the base-planner rotation/state preparation from
existing published history before this create-only initializer can run. Retain
published dates/order; do not invent a baseline inside this migration. This is
the established HU-082/HU-083/HU-085 rollout boundary. No additional member-input
or phone action is currently required; real source review and bounded application
will have their concrete operational handoff.

### Develop planner base preparation — 2026-10-27

The maintainer requests commit/push followed by base preparation retaining the
published dates and order. Initial-state source is delivered as `537188bd`, with
the exact remote hash verified. No new live application is requested by this step.

Fresh bounded develop reads and metadata-first workbook inspection identify the
same 72 published turns/108 ordered places and corrected 48-user/32-eligible
scenario retained by HU-083. Reuse that explicitly approved synthetic ownership
lineage and both continuation cursors (54 consumed positions each; round 2/index
22), without creating a new roster order or generating another season. A private
semantic proposal and offline contract validation bind the preserved content.

The [preparation report](develop-planner-base-preparation.md) distinguishes three
unresolved content concerns: 53 blank visible helper cells against the canonical
helper proposal, July/August 2027 absent from Market, and the 62 legacy Firestore
rows that still fail the canonical contract. Business fields of those legacy rows
are unchanged, but their import/update metadata and server versions have changed;
the September inverse/CAS guards cannot be reused. Do not execute the old reset.

The Drive connector provides no numeric version, and all five planning-state
paths remain absent. No full v2 cross-store audit, post-drain capture, live
initializer or ready-for-activation claim is made. Reuse existing HU-082/HU-083
contracts; no new planner/parser/live writer is needed for this preparation.
Functions build/lint and 47 focused cases pass. No native source changes or new
physical checks; no shared write, deploy, FCM send or production access. Continue
with the exact governed develop migration/inverse preparation under HU-085;
neither parent is closed and no phone action is currently required.

### Controlled develop migration rehearsal — authorized 2026-10-27

The maintainer requests delivery of the previous preparation, then preparation
and rehearsal of a controlled develop migration and its inverse, retaining the
published dates and order. Preparation is delivered as `73001988`; exact remote
identity is verified. Continue on this branch with HU-084/#268 and the existing
HU-085/#269 rollout dependency; no new story, shared apply or deployment is opened.

Build one emulator-only acceptance path from the retained private captures and
semantic proposal. Preserve 62 raw legacy payloads in immutable before-images,
retire only their exact guarded versions, and promote the 72 reviewed canonical
rows without regenerating dates, participants or ownership. Use a newly prepared
activation terminal and retained recovery authority for the 72 canonical rows;
do not submit the old 139-write fixture or force raw history through the general
canonical inverse materializer. The thin rehearsal resolver must compose the
explicit legacy restoration and canonical recovery in one measured transaction.
Keep the security state closed at an advanced epoch after recovery and retain
the archive and operation/event evidence.

Reuse the existing trusted closed-intake barrier, transaction admission and
notification fences, publication/retention contracts and stateful Sheets adapter.
Measure the materialized forward and inverse separately. Check exact source
sets and versions again inside each SDK attempt; prove replay, stale/extra source,
ambiguous acknowledgement and delayed/duplicate event behavior. The raw legacy
events have an explicit ordinary no-effect disposition by Sheets origin; do not
claim that they pass the canonical public-event auditor. Exercise the actual
trigger handlers with external transports trapped.

Project and endpoint guards must run before constructing an SDK client:
`demo-reguerta-hu084-migration`, loopback Firestore only. All workbook versions,
control-plane/index authority and retention time in the clone are labeled local
test evidence; none replaces the unavailable real Drive version or live writer
containment. Apply/reverse only the 53 proposed helper cells in the Sheets double,
leaving the two unpublished market months explicit and the annual frontier open.
No Android/iOS change, new phone task, production read, shared mutation or FCM send
is part of this rehearsal.

The [completed rehearsal](../../../docs/testing/hu084-develop-migration-rehearsal.md)
passes locally: 203 forward writes/1,813,600 estimated bytes and 140 inverse
writes/530,196 bytes under the existing admission adapter; exact 62-document
restoration, 72 ordered canonical rows/108 places, closed epoch 2 and retained
archives/terminal/retention. Actual exported handlers record 72 activation and
72 recovery decisions, including 36 first deliveries after recovery, with no
external calls. Raw legacy events retain their separate ordinary no-effect
disposition. The real Sheets reader/adapter separately reverses the 53 helper
cells without changing the 399 prior literals or completing the market gaps.

Independent review corrects owner-sequence and constructor validation, hashes
binding private inputs, the actual multicast transport trap, immutable afterimage
adoption, current roster/workbook-pointer conflicts and workbook revision binding.
Final gates: build/lint, targeted CJS checks, 8 pure/62 unchanged-contract
regressions/15 portable SDK/one private SDK/five captured Sheets = 91 passes,
zero skips/failures. Actual SDK commit acknowledgement loss and a seven-day
fixture clock advance leave the committed state closed with no resubmission.
No application source changes or new parity gap. This local prototype supplies
neither a deployed migration endpoint nor real writer/Drive/index authority;
both parent stories and the draft PR remain open. No phone action is needed.

### Develop operational entry preparation — 2026-10-27

The preceding 91-pass migration/inverse rehearsal is delivered as
`0b5ceabb581c0649084499e9de60b417eac22bbc`, with the exact remote head verified.
The maintainer authorizes preparing the develop operational entry and inspecting
real Sheets/writer controls, preserving published dates and assignment order.
Continue on this branch and #268/#269; no live apply or deployment is authorized.

Prepared one IAM-only `inspectDevelopShiftMigration` source export: exact develop
configuration, read-only Sheets/Drive scopes, bounded version-stable grids and
complete visible ACL pagination. It returns only a sanitized observation with
`canApply:false` and `Cache-Control:no-store`. Cell fingerprints remain distinct
from the reviewed migration's semantic digest. No private cells or identities
cross the HTTP boundary. The demo migration runner remains unchanged.

Fresh read-only observations find 19 active shared-project Functions, one current
runtime identity, five missing develop state/rotation/submission documents and
one owner plus two service-account writers on the develop workbook. The connector
omits numeric Drive version; ADC Drive reads fail with insufficient scopes.
The planned operator identity does not exist. Live Rules still have authenticated
generic writes outside orders; local turn/planning restrictions are not deployed.
Returned index metadata describes five unrelated indexes and does not establish
the required planning-index readiness. Four bounded develop work-collection reads
returned no documents; this is not proof of invocation drain or held controls.

The [bilingual inspection runbook](../../../docs/testing/hu084-develop-operative-inspection.md)
records the exact source contract and observation limits. Writer inventory v3 now
matches all 26 compiled logical writers (20 barriers and six version rechecks).
Validation: 58 backend tests pass without skips/failures, including loopback HTTP
composition with Google read doubles; build/lint and focused CJS checks pass.
Independent provider, HTTP and composition reviews have no remaining findings.

This new block is local pending Git delivery. Next resolve the reviewed read
identity/invoker/deployment scope, then renew the actual workbook-version and
writer observations. Effective owner/editor/automation exclusion, real control-
plane closure/drain bindings, post-drain backup and exact forward/inverse
authorization remain open. No shared mutation, credential replacement, IAM/ACL
change, production business-data read or notification occurred. Native apps are
unchanged, with no new parity gap; no phone action is needed for this block.

### Dedicated inspection identity and isolated deployment — 2026-10-27

Inspection source is delivered as `4b179d10`. The maintainer now authorizes the
identities/permissions for deploying only the private develop inspection in
`reguerta-9f27f`. This does not authorize changing existing Functions, Rules,
indexes, writer permissions or production configuration, or applying migration.

The runtime and inspection invoker use separate dedicated accounts; neither has
user-managed keys or direct project roles. The runtime requires reader access
only to the develop workbook. Deployment `actAs` is inherited; no new binding is
added for it. A one-hour conditional OIDC-only binding on the invoker permits the
bounded verification and is removed afterward. OAuth token creation and signing
are not granted. The connector's `appNotAuthorizedToFile` denial leaves reader
sharing to the maintainer; never promote the runtime to writer for inspection.

Source explicitly fixes both identities. The private deployment configuration
isolates the two develop parameters, disables legacy Runtime Config loading and
selects exactly one HTTPS endpoint, with no event trigger or secret. All ten
required/prepared APIs are enabled and the existing Artifact Registry cleanup
policy is preserved. Local validation: 58 passes, no skips/failures, lint/build,
package/schema/filter checks and independent source/deployment reviews.

The isolated deployment is now verified: the dedicated runtime and sole explicit
service invoker match source, with no public binding or direct project roles for
the new accounts. All 19 existing Function revisions and compared metadata remain
unchanged; unordered Eventarc filter entries are normalized for that comparison.
The maintainer's reader grant is verified independently by owner-side metadata.

The first valid read returned 503. Reader-aware inspection now omits the detailed
permission API when sharing authority is unavailable, reports null permission/
owner counts with an explicit blocker, and retains the bounded version/grid
reads. Safe logs use fixed local failure codes/stages only. All 63 local tests,
lint/build and the one-target package gate pass, with independent review.
Real HTTP checks return 403 anonymously, 405 for authenticated GET, 400 for
production and workbook selectors, and 200 for the valid read of six tabs under
unchanged Drive version 259. No raw cells or identities cross the HTTP boundary.

The temporary OIDC binding is removed. Direct policy is empty and a subsequent
real token-creation request is denied with 403; the permission-test observation
is retained separately rather than used as the closure proof. Both identities
still have zero user-managed keys, and Artifact Registry cleanup is unchanged.
Actual writer exclusion, maintenance/drain bindings, admission and migration
remain open. No application-data write, production workbook access, notification
or change to existing writers/Rules/indexes occurred. No further phone or manual
sharing action is needed for this completed inspection block.

### Reversible develop writer-control preparation — 2026-10-27

The maintainer authorizes preparation, preserving published dates/order. Reuse
this branch, #268 and #269. No writer closure, Rules/Functions deployment,
IAM/Drive permission change, new OIDC grant or migration is authorized here.

Prepared a temporary Rules candidate from the exact deployed 6,712-byte source
(`bb87cdacc63dc4e285ac24d50b8f2f8c64eff3def1e4fcf24265030059591dfa`).
The active release and immutable prior ruleset were read back and match it.
The candidate denies all develop client writes, including private collections,
users, orders and the legacy tree; reads and production predicates are preserved.
Twelve isolated Firestore-emulator cases pass without failures/skips, checking
actual stored date/order/epoch images, production/read parity, Admin bypass and
Rules-only pre-write restoration. Functions build/lint and focused CJS checks pass.
No default deployment configuration is changed.

Fresh read-only metadata covers 20 Functions and the two visible workbook service
writers. Both writers are active and have zero user-managed keys, but their
shared/broad roles do not constitute a fence. The six relevant legacy handlers
were audited from immutable GCS sources: one identical 152,987-byte archive,
SHA-256 `07cd231c91df1e7bd31ab6a9f6a711559536aca3e7de697e641628d6c8216b49`.
Both executable JS and TS lack develop pause, maintenance/epoch or in-flight
guards. Sheets config has a generic fallback, so deleting develop parameters is
not a safe closure. The current branch is not production-equivalent source.

The bilingual [writer-control proposal](../../../docs/testing/hu084-develop-writer-controls.md)
maps all 26 inventory writers to exact scope, prior state, restoration and
remaining evidence. The private preparation packet remains `canApply:false` and
cannot enter maintenance. The compiled v3 client groups/targets still need
reconciliation with the deployed catch-all's private-state authority before any
barrier checkpoint; this preparation does not change that inventory. Known workbook ACL changes lack permission IDs and
inheritance/expiry evidence. A whole-file owner content lock is only a conditional
copy-rehearsal candidate; it also blocks the intended runtime and does not itself
solve owner unlocking or held handover. No transfer or Workspace purchase is chosen.

The maintainer declares no other known automation beyond the app and actions here;
this is operational input, not technical exclusion of every possible writer.
Drive version 259 and the inspector's 63-case evidence are retained, not renewed.
Restoring old permissive controls after authoritative writes, epoch advancement
or uncertainty is forbidden: keep closed and use governed recovery instead.

This preparation is committed and pushed as `f105ca5c`; the exact local/remote
hash is verified. The next authorized group designs and locally rehearses a
selective bridge against the audited legacy baseline and tests the owner lock on
an isolated copy, before proposing actual controls. Native sources are unchanged.

## Selective pause and isolated-copy experiment — 2026-10-28

The maintainer authorizes this bounded follow-up and preserving published dates
and order. The [bilingual design](../../../docs/testing/hu084-selective-develop-pause.md)
uses the exact captured deployed executable, demo-only Firestore and recording
Sheets/FCM ports. Production bypasses the ledger entirely. Missing/invalid state,
unknown legacy work, deferred deliveries and uncertain effects cannot produce an
admissible closure. No actual deploy, pause, migration or notification is included.

A separate private native Sheet has all six copied tabs plus a dedicated canary
tab. Actual owner capabilities and absent prior restrictions were verified.
The maintainer separately approved a keyless copy-only service writer, a
twenty-minute token grant and temporary owner `drive.metadata`/`drive.file`
access through Google OAuth Playground. Both Sheets writers succeeded before
the owner-only lock, were denied with 403 during it, and succeeded after its
exact reversal; canary values are restored. A separate successful Drive
authorization probe precedes the accepted service-account unlock denial:
403 `insufficientFilePermissions`, with the full restriction unchanged.
`appNotAuthorizedToFile` failures are excluded from this evidence.
Four captures of selected cell/format/metadata images across seven tabs are
identical, independently recomputed. Identifiers/provider details remain private.
Original develop/production data remain untouched.

The design also records two live blockers: the current trigger retry policy
cannot guarantee durable deferral when the retention write itself fails, and a
new journal cannot account for invocations admitted by old deployed revisions.
The broader private/legacy client authority still needs compiled inventory
reconciliation. This local experiment stays `canApply:false`; it does not add a
rollout controller or satisfy `closeAndCollect`.

Final backend acceptance: 20 emulator passes, zero failures/skips, Functions
build/lint, focused CJS syntax and independent read-only review. Positive outcomes
anchor all six original production callbacks; their traces and stored business
images match with zero pause-ledger access. Actual commit-ack loss retains an
uncertain after-image. The emulator is stopped. The initial legacy fixture's
twelve-month expectation is corrected to the exact deployed algorithm's ten
months, with the first failed attempt retained as diagnostic evidence. This is
compatibility evidence, not a change in the future planner's requirements.

Final copy cleanup: no restrictions, only its owner in the ACL, former writer
file access denied with 404 before disabling it. The exact temporary IAM binding
is removed; the owned test account is disabled, with zero user-managed keys and
direct project data roles, and actual token generation denied with 404. Its
twenty-minute grant was not extended. Both temporary owner OAuth sessions are
revoked (actual 401), the connection is absent and UI token/request fields are
cleared. The first inspection's accidental token transcript exposure remains
recorded separately; that token was already revoked before the later copy test.
No reusable credentials are added to project files. This follow-up is delivered
in `f5c3b5db`, with exact local/remote HEAD verified. Passing the copy mechanism
does not establish a held owner fence or exclusive runtime handoff.

## Exclusive backend handoff design and rehearsal — 2026-10-28

The maintainer authorizes one grouped local design/rehearsal covering pending
events and invocations admitted by old code. Reuse #268/#269, the same branch,
the exact legacy VM, existing epoch/revision admission and trusted barrier.
Do not deploy a collector/bridge, alter shared retries or IAM, move/transfer a
workbook, change its link or mutate shared business data. The later explicit
owner-cooperation decision below amends only HU-085's owner-exclusion policy.
No new operational controller is needed: the implementation is confined to demo
test helpers and an emulator suite, with `canApply:false` in every result.

The finite group separates three questions:

1. Capture each develop event durably before acknowledgement, bind its original
   content/source/versions, and retain conflicting or repeated deliveries without
   replaying legacy callbacks.
2. Reconcile the finite known demo invocation/effect set, including an old callback
   started before the pause, a provider-accepted late write, uncertain FCM delivery,
   retained causal work and stale observations. Missing legacy dispatch does not
   prove a notification was never sent.
3. Rehearse executor ownership against initialized current epoch/revision and
   reject stale or incomplete transitions. A hypothetical closed demo authority
   cannot stand in for missing live runtime, queue or workbook custody evidence.

Read-only provider metadata is refined for the same six audited legacy functions,
their Run services/revisions and four Eventarc/subscription configurations. Their
audited source/revisions are unchanged. All six have 60-second request timeouts,
maximum 20 instances, concurrency one and all traffic on the latest revision;
omitted minimum instance counts remain unknown. The four shared wildcard triggers
retain Functions `DO_NOT_RETRY`, while transport subscriptions are active with
600-second acknowledgements, 86,400-second retention and 10–600-second backoff.
These are configuration observations, not a queue/invocation census or drain proof.
No payload, pull/ack, application log or metrics access is used.

The connected Drive account lists no accessible Shared Drives. This does not prove
the association lacks Workspace elsewhere. The maintainer believes only personal
accounts are used, but is not fully certain; retain that provisional assumption.
The My Drive owner can write again when the global lock is removed; the local
rehearsal never proves physical exclusion. No custody or replacement projection
is selected. The [bilingual design](../../../docs/testing/hu084-backend-handoff-rehearsal.md)
records their tradeoffs and the eight actually exercised cases. Native sources
remain unchanged.

The maintainer explicitly accepted bounded maintenance with owner cooperation.
The aligned HU-085 specification and bilingual ADR-0021 replace only absolute
exclusion of the named owner's manual capability: preserve file/link, published
dates/order, temporarily restrict other editors, close all automation including
owner-credential workloads, bind online/closed/no-offline/no-edit confirmation to
the window/deadline, and check observed authority/revision/content before and
after batches. Retained capability and undetectable/interleaved-edit risks remain
explicit. Expiry, reported owner edits, observed drift or uncertain submission
stops automatic progression; reconcile rather than blindly retry or restore.
All other writer, old-effect, epoch/revision and notification gates remain intact.

This is policy acceptance, not operational readiness or live authorization. The
current inventory/barrier still expects technical `fenced` evidence for humans/
offline editors. A revised packet/adapter must represent this exact exception,
owner/file/window/confirmations and aborts; neither a boolean nor the local fixture
can substitute for its implementation and rehearsal. If the permission controller
is also the owner, close its ACL workflow/temporary credentials without claiming
revoked ownership. No new source or infrastructure change follows from this choice.

Accepted local evidence: Node 22.23.4, Functions build/lint, both CJS syntax checks
and a joint emulator run with 28 passes (eight new plus 20 unchanged pause/positive
production cases), zero failures/skips. Independent read-only review found no
remaining blockers for this finite scope. The owned emulator is stopped. Exact
commands, deployed-source binding, file hashes, TAP and bounded provider readbacks
remain private. These results were captured against baseline `f5c3b5db`.

The positive result is only `knownFixtureReconciliationReady`: captured event and
disposition manifests, old terminal evidence and current-source projection agree
in the declared demo universe. Every assessment retains `legacyUntracked:true`,
`physicalHandoffReady:false`, `canApply:false` and `canClaimClosure:false`;
the actual barrier rejects it. The suite does not implement a deployed collector,
the real Sheets worker, a broker guarantee, lease-expiry transitions or a physical
before/after handoff. A recording provider's delayed real Firestore afterimage
does not prove a real provider's cancellation behavior.

Next operational gates remain durable develop intake, effective isolation of old
Admin SDK writers and their submitted/causal effects, complete writer-authority
bindings and the accepted workbook maintenance procedure/adapter. Selective isolation or the existing
separately authorized bounded shared-project window must be demonstrated; Rules,
traffic metadata and quiet intervals cannot substitute. No live operation is authorized.

## Owner maintenance contract adaptation and local rehearsal — 2026-10-28

The preceding handoff/policy group is delivered as `3aafe4e8`, with exact remote
HEAD verified. The maintainer authorizes adaptation and local rehearsal of the
accepted ADR-0021 policy on this branch under #268/#269. Shared deployment,
permissions, workbook writes, migration and notification release remain outside
this group; no action is required from the maintainer during the local work.

Integrate an explicit versioned owner-agreement variant into the existing
inventory, barrier, trusted adapter and evidence/CAS path. Keep the original
strict version exact by default. Separate the retained named-owner capability
from technically controlled non-owner/offline editors; preserve every other
writer, Rules, causal-drain, epoch/revision and notification requirement. Use
the existing external-operation guard rather than a parallel controller or ledger.

Acceptance covers exact file/environment/owner/window/operation/authority
bindings and recorded confirmations; rejection of missing, stale or expired
agreement and editor/authority/content drift; reported owner edits; uncertain
external results; immutable retention/replay; and the same maintenance CAS.
Failures keep technical controls closed and retain incidents without claiming an
expired agreement remains valid, automatically retrying, reversing or sending push.
Use deterministic local ports and the fixed demo Firestore emulator, then run
relevant regression, Functions build/lint and independent source/evidence review.
No local result establishes provider control or live operational readiness.

Accepted local implementation: version 1 keeps its exact inventory/digest and
strict default factory; the explicit version 2 has 27 inventory groups/21 intake
controls, splitting retained owner capability from non-owner/offline controls.
It reuses the current evidence repository and maintenance CAS, adds fresh owner
observations around the callback, and retains typed incidents in the same journal.
Historical CAS replay checks the retained intent, current ownership and failure
records without control-plane calls or another CAS; it does not renew admission
or prove completion of the original final read-back. No new controller/ledger or
state migration is added, and no Function/deployment export changes.

Final acceptance: Node 22.23.4, Functions build/full lint, 438 joint emulator
passes with zero failures/skips, focused CJS syntax and independent source review.
The full planning list, existing state/barrier repositories and earlier 28 cases
run together, enabling all 51 cases skipped without an emulator. Six contract and
18 real-persistence entry cases exercise the new mode. Private initial/final TAP,
commands, hashes and unchanged strict/deployment-surface comparisons are retained.
The first run exposed a 21/27 test-count error, an incomplete inverse-only fixture
and a typed provisional-credit source error escaping durable fairness rejection.
Their narrow corrections preserve the provisional credit guard and unrelated
error propagation; the final source-producer/inverse cases pass.

This group was validated against `3aafe4e8`. The remaining concrete work
is composition of the real control-plane/owner observation sources and reviewed
per-batch Sheets postimage guards, followed by separately authorized safe-copy
procedure and live operations. Durable event delivery, actual old-work control,
complete deployed authority bindings and all notification gates remain open.

## Real control read-backs and guarded Sheets operations — 2026-10-28

The owner-entry contract is delivered as `2690528e`, exact remote HEAD verified.
The maintainer authorizes connecting the real control readers and protecting
Sheets operations, preparing the copy rehearsal. Reuse #268/#269/current branch,
the existing Sheets adapter/consumer/executor, workbook submission exclusion and
receipts. No second controller/ledger or broad Cloud metadata observer is needed.
Shared deployment, grants, re-enabling the former disabled test identity,
original workbook writes, migration and notification release are not included.

Read Drive/Sheets controls through pinned public Google resources and exact field
masks, including restrictions/capabilities, permissions and protected ranges.
Unknown/denied/incomplete information must block, not become empty authority.
Join those facts to the reviewed immutable agreement and existing technical
closure prerequisites; metadata is not old-work drain or effective-IAM proof.
Keep those independent prerequisites open rather than adding another config-only
collector that cannot establish them.

Bind each explicitly authorized Sheets batch to command/claim/epoch/lineage,
workbook, request/projection digests and reviewed before/expected-after images.
The owner baseline may change only through that exact batch. Revalidate fresh
controls before submission and before evidence/completion, including cached and
uncertain inspections. Preserve the single physical batch with retries disabled;
after submission uncertainty, receipts permit inspection only. A sticky incident
in the existing receipt/workbook-pointer path must prevent digest-restored or
unguarded-legacy completion/retry bypasses.

Read-only connector preparation locates the previously created native copy and
its seven tabs. It reports one visible owner permission, but normalizes away the
requested version/capabilities/content restrictions; those observations remain
unknown and cannot admit runtime writes. The copy-only packet must pin its exact
identity, bounded operations/window and required runtime access before any user
action or real rehearsal is requested. Original file identifiers and provider
evidence remain private. No live business data or original Sheet is read here.

Accepted local implementation reuses the existing authorization, schema3
submission receipt and workbook pointer. It binds the full preservation manifest,
current owner-report/document version and known control deadlines to each phase.
The final repository CAS follows all remote reads; a synchronous pre-send check
closes known deadline drift. Any observed registry change inside a read cycle,
including change-and-restore, fails closed. Expected batch changes may advance
the Drive version; untouched observed cells/controls must remain preserved.
Cached evidence and lost acknowledgements cannot bypass fresh guard checks or
cause another physical batch. The independent current technical hold is mandatory;
retained historical evidence alone cannot admit execution.

Final acceptance: Node 22.23.4, Functions build/full lint, five CJS syntax checks,
622 joint emulator/regression passes with zero failures/skips, local Markdown
links/diff checks and independent cross-review. The 29 new real-Firestore cases
use recorded Google protocol through the actual adapter, not real Google writes.
The first run had five JSON-null/sparse-array comparison failures, corrected
without weakening content assertions; all diagnostics and final hashes remain
private. The owned emulator is stopped. This group is local/uncommitted against
delivered `2690528e`; native/deployment exports and shared resources are unchanged.

The private packet proposes one synthetic canonical delivery tab on the existing
seven-tab copy (eight total), a new copy-only keyless test identity and a maximum
20-minute owner window. No identity/grant/window confirmation is applied. The
read-only preparation method always returns `canApply:false`, performs no claim
or receipt/incident write and has no physical batch route. Next is separate
authorization and real-copy rehearsal, with fresh raw SDK/authority evidence and
owner confirmation; original develop/production migration, old-writer/drain,
durable intake and notification gates remain open. No maintainer action was
needed for this local group.


## Authorized physical copy checkpoint — 2026-10-28

The separately authorized Google-provider rehearsal is complete on the existing
isolated copy. The explicit schema 2 copy agreement names the human owner and
the actual local runner; its technical branch does not fabricate the shared
27-group barrier. Fixed copy/runtime/token/lock authority and localhost demo
Firestore reuse the existing authorization, receipt/pointer and command CAS.
Shared/default admission remains unchanged.

One SDK `batchUpdate` sent 45 requests for ten synthetic market rows in one new
tab. Complete raw before/after digests of the seven existing tabs were identical
and checked before completion. The actual emulator command completed, its market
lease was released and no notification event was created. Earlier blocked
zero-submission attempts retain their incidents. The owner-only inherited writer
exception is limited to the exact file/agreement owner; runtime inheritance,
write groups and extra writers remain denied. The token-only client explicitly
uses a 1 ms eager-refresh threshold and no force-refresh, accommodating the
installed SDK's five-minute default without renewing the 300-second token.

Cleanup verifies owner-only copy sharing, disabled fresh keyless identity, zero
project roles/temporary bindings, rejection of the still-valid bearer and denial
of another mint. Evidence stays in the private
`2026-10-28-isolated-copy-rehearsal` packet. Final acceptance passes Functions
build/full lint and 661 joint emulator/regression tests with zero failures/skips;
the earlier 622-case history is unchanged. An initially stale IAM read was resolved
by repeated idempotent cleanup and fresh disabled/no-binding read-back.

No original/production workbook I/O, shared data operation, deploy or notification
release occurred. Both reviewed groups are included in the maintainer-authorized
delivery checkpoint; exact Git/remote verification is recorded in #268/#269 and
draft PR #278. All 28 accepted file hashes were checked before the delivery-only
documentation/changelog edits, so the 661-test/build/lint acceptance is reused.
Next is durable shared develop intake and effective old-writer/effect/authority
control. The copy result does not admit a shared maintenance packet or close
HU-084/HU-085.

## Authorized develop intake and compatibility bridge — 2026-10-28

The maintainer authorizes the next grouped result after the roadmap review:
durable develop capture and selective containment of the actual legacy writers.
Reuse #268/#269, the existing HU-084 worktree and the closed-barrier contracts.
Do not deploy this branch's replacement index over the six old shared handlers:
its production behavior differs from the audited deployed executable.

Prepare one bounded source package from the byte-pinned legacy archive, keeping
its dependency lock and production callbacks. Four new develop-only retryable
collectors and the four wrapped legacy event callbacks retain original events
before ACK; the two wrapped HTTP callbacks reject develop before business work.
All captured work remains pending reconciliation, without automatic replay,
Sheets writes or notification sends. The collectors must be installed and
verified before switching the six shared handlers. Missing/unknown old work,
external results and effective authority still block shared barrier admission.

The intake owns an explicitly addressed Firestore client and uses the private
root `shiftPlanningDevelopIntake/current`: the deployed broad client Rules must
not expose its events or let members/admins forge capture receipts. Verify
transaction acknowledgement loss, concurrent/aliased deliveries, contradictory
payloads, supported typed fields, bounded chunks and client denial against both
the captured baseline and the prepared Rules. Run the six exact production
callbacks against their original traces/data; production must not construct or
access the develop journal. Preserve `legacyUntracked:true` and `canApply:false`.

Actual shared deployment, Rules/Drive changes and legacy-effect reconciliation
need their concrete reviewed operational handoff. This authorization does not
activate production, run a migration, publish turn changes or send notifications.

Acceptance is complete locally: Functions build/full lint and 697 joint tests
pass with no failures/skips. The eight generated-JavaScript production cases
include both HTTP defaults resolved to production. An independently installed
packaged runtime uses the actual locked Firestore 7.11.1/Functions 6.3.2/Admin
13.4.0 SDKs and executes 20 capture callbacks against loopback Firestore,
including raw protobuf and retaining ten events/ten deliveries without Sheets/FCM.
The code/test freeze is unchanged throughout final acceptance. An initial
692-case run preceded the final packaged-runtime preservation and stronger
generated-source checks; neither it nor the earlier 695-case result replaces
the corrected 697-case provider-boundary acceptance.

Review corrections keep the journal outside public client routes, preserve
source SDK precision rather than assuming unpersisted sub-microsecond values,
disable buildpack recompilation of the generated entrypoint, and add exactly one
audited `preserveExternalChanges:true` global option so an update does not reset
the existing runtime limits/identity/ingress. New collectors explicitly cap
instances at 20. Original business bodies and constructor arguments remain
byte-preserved inside their six wrappers. Source package, fresh configuration
observations, raw results and hashes remain in the private
`2026-10-28-durable-develop-intake` packet. Shared deployment still requires its
reviewed scope/authorization; no previous operation is terminalized by this work.


### Authorized shared first phase: verified result

The maintainer explicitly authorizes only four new develop collectors, their
existing runtime account and four temporary create-only/CAS-cleaned probes.
CLI 15.15.0 creates then repairs only those four named Functions; both-generation,
all-region inventory excludes selector-prefix collisions. The six original
Functions retain complete source/configuration. Private IAM invocation, exact
develop filters, retry policy, maximum 20 instances and immutable deployed source
are read back. Every accepted package file matches in all four repaired sources.

The real protobuf boundary initially rejected readTime on local SDK snapshots.
The four probes were cleaned at the initial timeout without losing their queued
messages. A narrow public-DocumentSnapshot/exact-error fallback stores null only
for that absent observational time, preserving all source-version/error checks.
Two meaningful raw-protobuf regressions and an actual SDK-6 packaged smoke close
the validation gap; the main suite has 697 passes/zero skips/failures, and the
separate smoke executes 20 callbacks. A private fixture path correction was
validated independently without rerunning unchanged passing tests.

The same transports redeliver all four original creations and two deletions;
versions, contents/hashes and absence of all four source probes are verified.
No new canary creation, manual replay, pull/seek or ACK occurred. Private counts
are six events/deliveries and revision six with legacyUntracked true. This is a
positive bounded delivery result, not exhaustive broker/error-history or old-work
closure. The broker has ACK600/retention86400/backoff10–600 seconds. Migration,
Sheets maintenance, notifications and HU-084/HU-085 closure remain blocked.
The maintainer authorizes delivery of the accepted source; exact commit/remote
verification is recorded in #268/#269. Next is the separately scoped selective
pause/containment of old develop writers and their effects.

### Selective legacy containment and finite census — 2026-10-28

The accepted capture group is delivered at `76a96826`; remote and draft PR #278
heads match. The maintainer requests the next grouped outcome: contain the six
legacy develop entry points and reconcile their outstanding work. Reuse the
accepted generated package, not the current application index. A fresh all-region,
both-generation inventory confirms exactly six existing updates, zero creates or
deletes, and four unchanged active collectors. All ten serve their latest revision.

Deployment is a separate concrete shared-Firebase approval: keep the existing
runtime identity, limits, environment, ingress, IAM, filters and retries. The six
production callback bodies remain byte-preserved. Updating shared services still
has ordinary deployment/cold-start risk. The notification wrapper holds **all**
develop notifications, including order reminders; it is not limited to shifts.
Update that dispatcher first, then the other five, and read back every source,
configuration and traffic assignment before making a containment claim. Stop on
partial failure; repair forward while retaining capture and closed develop.
Never automatically restore unwrapped callbacks or reopen on an elapsed timeout.

A bounded read-only census uses a common Firestore readTime, exact develop paths,
private intake events/deliveries/chunks, version fingerprints and capture revision.
The initial observation contains zero planning requests, 62 planned shifts, four
calendar overrides and 117 historical notices: 55 no_tokens, 34 partial_success,
25 success and three without dispatch metadata. These are observations, not proof
of previous external effects. No_tokens does not establish an entire no-send
history; missing dispatch can follow an actual send. No historical notice may be
resent automatically. Current planning failures can follow Sheets writes.

The offline inspection must validate the retained hashes/identities, reject
partial or inconsistent input, and distinguish present, changed and absent
sources without executing/replaying callbacks. A captured probe prefix alone is
not proof of authorization or exemption. Raw documents stay private. The report
binds the observed set and versions, never future state or complete pre-journal
history. Keep legacyUntracked true, legacy outstanding effects unknown and shared
maintenance/migration admission closed. Client writes, users/config authority,
manual edits and other services remain outside these six wrappers.

The concrete scope was subsequently authorized and completed. Six immutable
sources match the accepted package, with preserved runtime/configuration/IAM and
100% traffic on their new revisions; four collectors and 14 other Functions are
unchanged. Two HTTP 503 checks, six successful event requests on the updated
revisions, six retained probe events and four CAS-cleaned sources pass. Both
183-document business sets remain identical. Twelve total captures/deliveries and
revision twelve are verified by the offline inspector, whose 16 new tests plus
Functions build/full lint pass. The accepted nine executable inputs are unchanged,
so their 697-test baseline is reused. Raw evidence remains private. The maintainer
authorizes delivery of the new offline inspector/tests and operational documents;
exact commit/remote verification is recorded in #268/#269 and draft PR #278.
No original/production Sheet I/O, production business mutation or test FCM send
occurred. Historical external effects stay unknown and shared admission closed.

### Remaining operational controls — 2026-10-28

The preceding inspector/pause evidence is delivered at `f141a902`, with matching
local/remote/draft PR #278 heads. The maintainer authorizes continued work on
direct-client Rules, remaining server authority and existing maintenance controls.

Fresh read-back confirms the deployed 6,712-byte baseline Rules, hash
`bb87cdacc63dc4e285ac24d50b8f2f8c64eff3def1e4fcf24265030059591dfa`.
The exact reviewed candidate changes only develop write admission; it keeps reads
and production predicates. It closes all develop app writes, including orders,
products, users/config, devices and notices. A new offline preparer pins both
sources and the observed immutable release, creates a private Rules-only config
and requires fresh-before/own-after observations and one publisher. Publication
is not CAS; permissive Rules are never restored automatically or on a timer.

The real IAM census has 27 direct bindings, no conditions and two Owner user
principals. Twenty-three of 24 Functions use Compute, including production; its
Editor grant and the other observed server writer grants remain unchanged.
Four relevant service accounts have no user-managed keys; this does not exclude
project impersonation, administrative sessions or unobserved workloads. Rules
cannot close those privileged paths. The read-only census explicitly does not
certify exclusive authority or maintenance admission.

The inspector now exposes a stable complete-set digest independent of readTime,
while preserving its old provenance fingerprint. This can bind the existing causal
set fields; it cannot manufacture the eight required zero drain counters. Two
negative integration cases prove that a valid census, even rewrapped/rehashed,
is not a trusted hold and that retained does not mean disabled/isolated. No new
operation ledger, replay driver or parallel scheduler is introduced.

Functions build/full lint and 159 joint emulator/regression tests pass, with no
failures/skips. An independent review accepts the bounded one-account/one-document
client-ID-token probe, conditional cleanup, private CLI cwd and exclusive receipt.
Live Rules/Auth/probe application awaits its concrete authorization. ADR-0022 is
proposed separately for develop administrator cooperation; ADR-0021's owner-only
exception and current strict contracts remain unchanged until explicitly decided.
Existing service admission, old operations and uncertain external effects still
require technical controls under either policy choice.

The remaining-source audit reads twelve immutable archives/configurations without
mutation. Eight of nine HTTP sources match the original legacy module;
resolveAuthorizedMember instead uses its newer Functions/Admin/Firestore boundary
and must be preserved separately. The three scheduled reminder jobs are enabled
and their actual resolver/configuration targets develop only. Configuring them as
production would enable behavior they do not currently perform.

The compiled writer inventory is corrected to v4: three explicit Scheduler IDs
require disabled ingress before causal capture, with pending/in-flight evidence
still independent. Strict/owner inventories contain 29/30 writers and 23/24 intake
controls. Missing/enabled/undrained jobs and the old v3 evidence cannot admit a new
hold. The jobs themselves are unchanged; their exact pause needs its own concrete
live scope. After this core correction the broader gate passes 394 planning tests
and a 155-case controls/regression run, both with zero failures/skips, plus build/
full lint. These suite counts are recorded separately rather than claiming a
distinct-test sum. At that preparation checkpoint Rules/Auth/probe consent and
ADR-0022 remained pending.

### Approved client Rules and develop administrator policy: result

The maintainer approves the exact Rules/Auth/probe phase and selects ADR-0022.
Only the reviewed Firestore Rules are published/read back. The genuine Firebase
ID-token probe proves baseline create200 then update403/read200/delete403/create403.
Exact owned source/Auth cleanup succeeds inside the twenty-minute window. The
current complete 183-document/twelve-event set stays unchanged. Independent audit
verifies 24 Functions, IAM, nine service accounts, inspected policies/key inventories
and three enabled jobs unchanged. No production business/Sheet/FCM action occurs.

ADR-0022 is accepted as policy for develop only. It does not label administrative
capability technically fenced or complete the absent versioned contract/current
participant confirmations. Direct client writes are closed; server ingress,
explicit Scheduler containment and earlier-effect proof remain separate. Shared
maintenance stays canApply/canEnterMaintenance false and legacyUntracked true.
Frozen executable inputs preserve build/lint and the 394/155 test runs. The
maintainer authorizes this source delivery; exact Git/remote verification is
recorded in #268/#269 and draft PR #278.

### Grouped administrator/server closure — 2026-10-28

Delivered `e29b6bdd` before starting the next grouped work. Implement explicit
ADR-0022 v3 through the existing intake/Sheets paths while preserving v1/v2.
Prepare exact-source HTTP packs (legacy eight/newer member resolver one), with
both direct/effective develop routing closed and original production callbacks.
Pause only the three actual develop-only reminders; retain receipts, source/config/
authority comparisons and earlier-work uncertainty. All three pause operations are accepted (one attempt each), with fresh
semantic config/source/IAM read-back and preserved earlier-work uncertainty. No native changes,
production activation, replay or maintenance admission is implied. Detailed
acceptance is maintained in the bilingual selective-pause guide.

The maintainer separately authorizes the existing nine HTTP updates. Both scoped
packs deploy and all nine immutable archives match reviewed files. Runtime/IAM/
identity/environment/secrets/traffic and the other fifteen Function configurations
are preserved. Seven real develop requests return application503; two existing
private endpoints return IAM403 before the callback (no permission relaxation).
Final reads preserve all three PAUSED jobs, accepted Rules and the complete
183-document/twelve-event captured payloads. The maintainer authorizes this source delivery; exact commit/remote evidence is
recorded in #268/#269 and draft PR #278. No maintenance/migration admission, old-work drain or production
business/Sheets/FCM action is implied. Actual complete participant commitments,
automated authority and earlier effects are the remaining operational boundary.

### Prior develop operations: approved reconciliation — 2026-10-28

Deliver the accepted administrator/server closure as `afbcd098` before beginning
this grouped investigation. Reuse the current validated census and exact deployed
source/receipts to classify every observed source and retained delivery offline.
Bind conclusions to source versions, set digest and evidence bytes. Correlate the
twelve captures with accepted synthetic probe receipts/cleanup and bounded real
legacy logs; retain all 117 notifications as possibly delivered and unreplayable.
Inspect the three develop-only reminder services and provider log retention with
finite read-only queries. Distinguish current baseline, attributed terminal work,
external uncertainty and missing historical evidence. No replay, new shared ledger,
legacyUntracked reset or maintenance/migration admission is part of this group.
Finish with a finite evidence-bound report, relevant regression tests and a clear
residual list; ask for a human decision only if that concrete residual requires it.

The approved read-only group is now accepted:12 captures bind to exact synthetic
receipts;5 old-revision runtime logs confirm probe exits; one observed import62
terminal/HTTP200 agrees with current versions;12 recent reminder terminals/HTTP200s
agree with recent notices. All117 notices remain possibly delivered/unreplayable;
75 reminders lie outside the observed30-day retention window. The four seasonal
workbook grids retain399 exact typed literals. Before/after source/journal payloads
are identical; all three jobs remain PAUSED. The bounded offline inspector passes
40 tests and Functions build/full lint; independent receipt/census monotonicity
finding is fixed. See `docs/testing/hu084-develop-legacy-reconciliation.md` and its
Spanish counterpart for the finite residual list. Investigation completeness is
not physical handoff: no admission/legacyUntracked flag is relaxed. Actual automated
control/queue/in-flight evidence and the participant/window agreement are next.

### Develop queues and maintenance-window preparation — 2026-10-28

Deliver prior reconciliation as `4cb216824dc908293311a4f9c496fc2326c0f350`,
with remote/PR verification and matching six-input validation (build/full/focused
lint and40 offline tests). Inspect actual Eventarc/PubSub/service bindings and
bounded provider metrics without pulling/ACKing/seeking messages or changing IAM.
Prepare a concrete future window; preparation does not open maintenance.

The first real observation finds four private collectors each with backlog1 and
repeated event_payload_conflict/HTTP500. Shared subscriptions provide no series,
which remains unknown. Existing canonical event/delivery keys collapse differing
metadata observations; the exact conflicting field is not yet proven. Prepare a
single lossless metadata-observation fix and four-only deployment packet under
proposed ADR-0023: preserve twelve schema1 deliveries/first envelopes, append
schema2 observations in the same collection only for identical core and immutable
CloudEvent identity, and retain rejection/diagnostics for other conflicts. Reuse
existing counters/CAS/inspector; never ACK without durable retention or run legacy
business logic. Review/test/freeze the packet before requesting its scoped live
authorization. After authorized update, inspect natural retries/journal/provider
observations rather than manually consuming or replaying messages.

The window remains NOT READY. Five exact planning-authority paths are absent;
bootstrap cannot be replaced by epoch0. Shared ACTIVE production triggers cannot
be reported physically disabled, and the existing v4 admission contract lacks the
provider-backed capture-only scope. Future admission needs those explicit controls,
actual participants/operator identity, refreshed source/IAM/workbook/set bindings
and separate authorization. A provisional20-minute work plus20-minute recovery
budget has no date, confirmation or live effect.

Local preparation is complete: full Functions build/lint and147 joint tests pass
with no failures/skips. The exact four-export/seven-file packet, backwards-compatible
inspector and GET-only guard/post verifier pass independent review. Real archived
SDK discovery confirms four retry-enabled exports; a fresh guard binds all24
unchanged Functions and the final manifest. The bilingual queue/window guide fixes
the future prerequisites and provisional budget. Scoped deployment approval is
requested; no cloud update, natural-retry acceptance or maintenance entry is yet claimed.

## Authorized four-collector update — 2026-10-29

The authorized deployment succeeds for exactly four private collectors. Immutable
source archives match the reviewed packet; runtime configuration, identity,
permissions, filters, retries and traffic are preserved, as are the other twenty
Functions. Natural retries retain four schema2 observations: each differs from
its canonical record only in traceparent. The source183 documents, twelve original
events/deliveries and chunks remain byte-equivalent including source versions.
Root captureRevision/deliveryCount advance12→16; eventCount stays12 and
legacyUntracked stays true. No business callback, Sheets write, FCM send, manual
message consumption, maintenance entry or migration is performed.

The 147-test/build/lint gate is reused with unchanged executable inputs. The
Firebase CLI warns about the intentionally preserved archived SDK; this scoped
update does not upgrade runtime dependencies. Native code is unchanged.

## Delivered repair and residual reconciliation — 2026-10-29

Repair delivered as `3977fd6f2df13d87748c7db1e3dd31ed36b8db1d`; remote and draft
PR match. Read-only residual reconciliation observes one provider ack_204/push ACK
in00:30–00:31 UTC and backlog/oldest-age0 at00:36/00:37 UTC for the private shift
subscription. Fresh183-source/12-event/16-delivery census is unchanged; no new
requests/errors in the later bounded query. Historical residual reconciled; recent
missing metrics remain UNKNOWN and do not admit maintenance. Next: provider/sourceScope
control and controlled bootstrap before participant/window commitments. See the
bilingual queue/window guide. Only this new evidence documentation remains local.


### Shared-trigger control and bootstrap preparation — 2026-10-29

Residual reconciliation is delivered as `3dbbd4da`. The new offline preparer pins
four shared capture-only develop routes and four private collectors to reviewed
immutable sources and provider configuration, retaining production transport ACTIVE.
Fresh census matches and five planner paths remain absent. Reuse the72-turn proposal,
existing rotation checker and round2/index22 cursors; sheetsSubmission stays absent.
No change to ADR-0022 admission rules: this review cannot represent ACTIVE shared
transport as disabled, invent epoch0 or infer causal drain. Next group integrates
trusted source-scoped controls with atomic initial-state admission and its recovery
checks; refresh source-policy/workbook/cohort evidence before applying it. See the
bilingual queue/window guide for the concrete preparation and60-test local gate.


### Integrated develop capture barrier and recovery rehearsal — 2026-10-29

Preparation delivered as `51b9c514`. ADR-0024 adds an explicit four-pair capture-only
control binding to the existing verifier without changing production or fabricating
disabled transports. Existing adapter and repository retain/check its evidence and
incidents. The fixed-loopback rehearsal now exercises this path through initial
creation, inverse and restart after uncertain acknowledgement.72 local and33 emulator
tests pass; build/lint clean. No new migration engine, deployed endpoint or native
change. Next compose real source/control and independent causal-drain observations,
refresh policy/workbook/cohort bindings, then request the concrete maintenance window
when all evidence is ready. Local fixtures must never substitute live observations.


### Real observations connected; window still not ready — 2026-10-29

`f7ef299a` delivers ADR-0024 integration. The new read-only observation adapter
reuses the preparer verifier, downloads generation-bound reviewed archives, creates
four capture proofs and rechecks deployment after queue reads. Actual measurements
confirm unchanged controls and published source projections. Metrics remain UNKNOWN;
the shifts index response is outside requested scope. Neither is converted to proof.
The explicitly authorized private inspector returned HTTP200 on its sole invocation:
six tabs, stable numeric version259, canApply:false. Initial OIDC mint403 was retried
within the original ten-minute deadline; both grants were removed and independent
IAM verification finds zero direct bindings. Detailed ACL/owner inventory remains
unknown to this reader. No window starts until separate drain, index authority,
workbook/source policy and current owner/admin commitments are bound. See the bilingual
queue/window guide. Build/lint and73 local regressions pass; no native/deployed change.

### Index authority resolved; deployment omission and drain limit — 2026-10-29

Database-wide index enumeration/exact GETs bind five READY composites and inherited
automatic shifts indexing. Both native latest-request queries need the separately
declared but undeployed shiftPlanningRequests composite; develop plan-only Explain
confirms FAILED_PRECONDITION. One-index creation is prepared with preservation of
the five existing indexes and explicit authorization pending. The fresh census
retains183 sources,12 accepted probe captures and16 deliveries. All eight queues
have historical zeros, but no current causal counters.23 services route100% to
reviewed revisions;20 retain old revisions. Stop repeating the same telemetry reads;
next resolve writer-specific terminality/isolation and the provider/contract gap,
without silently weakening ADR-0024. No shared mutation or window admission.

### Authorized missing-index rollout — 2026-10-29

One explicit authorized create adds the declared shiftPlanningRequests composite.
READY, exact field/scope binding, five old indexes and field overrides unchanged.
Develop plan-only Explain now returns200 and uses the new index after an initial
propagation failure. Update the configuration binding before admission; this closes
the missing-index gate, not drain/old-effects/source-policy/window admission.
No native/runtime source change or business write. Evidence/docs remain local.

### Contained delivery versus old business work — 2026-10-29

The finite 31-writer assessment replaces repeated missing-metric queries as the
next decision gate. ADR-0025 is Proposed only: a scoped evidence alternative for
the four reviewed capture pairs, preserving independent old-business-effect and
automated-authority requirements. Runtime metadata observes 284 retired historical
revisions, not external-call terminality. Archived cloneGlobalConfig writes production,
not develop; no invocation or source change is made. Next obtain the maintainer's
policy decision, then implement/rehearse the grouped evidence change if accepted.
Maintenance remains NOT_READY; do not clear legacyUntracked or replay old notices.
See docs/testing/hu084-develop-old-work-boundary.md and its Spanish counterpart.

### ADR-0025 implementation acceptance — 2026-10-29

Maintainer explicitly accepted local implementation/rehearsal. Four control opt-ins
bind the new evidence alternative into the approved manifest. Eight-route nullable/
nonzero observations and source/core/history bindings cannot relax old business-work,
quiet business-effect, owner/admin or production checks. Offline census projection
preserves append-only captures and legacyUntracked; it never authorizes live entry.
Held receipt drift still stops progression instead of silently refreshing evidence.
174 local tests and37 emulator tests pass without skips, plus build/full lint and
focused CJS lint under Node22.23.4. Initial creation/inverse, late classified versus
unseen events, retained evidence and lost-ACK restart are covered. No native/shared
service change. Work remains local/uncommitted. Next resolve real old business effects
and automated authority before workbook/source-policy/window admission.

### Direct reminder admission correction prepared — 2026-10-29

ADR-0025/observations are delivered as `5f648963398d2e600f70129bc8fdec19317b77aa`.
Read-only authority inspection found that all three PAUSED reminder jobs still target
ACTIVE, directly invocable original develop callbacks. The existing source preparer
now wraps those three callbacks, preserving original production-only behavior and
rejecting whole develop/mixed target sets before data access. New work remains local.
Build/full lint/focused CJS lint,15 local and24 emulator tests pass without skips.
The exact reviewed ZIP and build-source-only update plan preserve all jobs PAUSED,
all other21 Functions, runtime configuration and IAM; no live invocation is proposed.
Deployment requires explicit approval. It closes new admission, not old-call or
external-effect uncertainty. All117 notices remain unreplayed, legacyUntracked stays
true and live maintenance/migration stays NOT_READY. No native changes/parity gap.
See the bilingual `docs/testing/hu084-develop-old-work-boundary.md` guide for package
hashes, preflight/readback requirements and stopping rules.

### Authorized reminder closure deployed — 2026-10-29

The maintainer explicitly authorized the three reminder Function updates in
`reguerta-9f27f`. Sequential build-source-only patches completed and exact source
ZIP/readiness/traffic were verified for all three. Jobs remain PAUSED; effective
runtime configuration/IAM and all other 21 Functions are unchanged. Provider-added
identity metadata is checked against exact function/region values. No Function was
invoked; no business data, Sheets or FCM was written. Private operation/readback
records retain the result; bilingual old-work-boundary guide records revisions and
reconciled preparation incidents. Reuse the unchanged 15 local/24 emulator tests and
build/lint; this turn adds real deployment verification and negative verifier checks.
Code/docs remain uncommitted after `5f648963`. Old work/automated authority and
workbook/window evidence remain open; no replay or maintenance/migration admission.

### Post-reminder effects reconciliation — 2026-10-29

Reminder closure delivered/pushed as `34aa7aaec1b9ddcd44b970b540ec700a4f4e80c1`.
Read-only reconciliation joins12 recent FCM attempt terminals to exact traces,
reviewed revisions and matching Firestore summaries: six token sends reported successful/six
failed by the SDK, without claiming device receipt, non-delivery or replay safety. Three62-row imports
and five probe exits have matching HTTP200s. Current183 sources/12 captures/16
recorded deliveries and six inspected Sheets ranges (742 typed values) are unchanged.
Five negative correlation checks pass; reuse unchanged application acceptance.
The105 older notices are unreplayable/unverifiable history, not a pending-send count.
Stop repeating expired-log searches; next bind actual automated credential/destination
and workbook-writer authority to old-work completion or effective isolation. Keep
legacyUntracked and maintenance/migration NOT_READY. New documentation remains local;
no cloud mutation, production data access or native change. See bilingual legacy-
reconciliation guide for exact bounds, evidence and limitations.

### Effective writer authority reviewed — 2026-10-29

Prior reconciliation delivered/pushed as `713c09020b46d0317399a1dd3fb0d60f8e952286`.
Owner-side metadata identifies one owner, two service-account writers and one inspector
reader on the develop workbook; parent My Drive shows only its owner. Compute runs23
of24 Functions; SDK is a file writer without a Function runtime assignment. All24
source/runtime bindings remain unchanged. Four reviewed accounts have no USER_MANAGED
keys but project delegation/data authority persists. Three jobs PAUSED; no extra Run
service/job in europe-west1, no Build triggers in global/europe-west1, no App Engine
services. Compute inventory is unknown because its API is disabled; no API enabled.
Prepared exact-file writer-to-reader changes for the two service accounts, preserving
production/IAM/owner/inspector. Not authorized/applied; exact permission IDs and fresh
reversible readback are required before mutation. Two human project owners identified
privately for the later window. No source/platform change; docs checks only. New docs
local; maintenance NOT_READY. See bilingual develop-writer-controls guide.


### Fenced maintenance preparation — 2026-10-29

Fence evidence delivered/pushed as `e6d02cc2`. Local offline preparation joins the
two-account probe/credential cleanup to normalized owner roles and validated old/current
censuses without producing barrier admission or zero work counts. The real packet
matches183 sources/12 captures/16 deliveries, all24 Function bindings, three PAUSED
jobs and742 typed workbook values. The connector metadata timestamp regresses versus
the direct probe and has no raw version; this is an explicit remaining gate.
114 focused tests (19 new), Functions build/lint pass. No native change/parity gap,
cloud mutation, production-data access or renewed impersonation. Local code/docs remain
uncommitted. Next resolve prior external-call completion/isolation and complete automatic
writer authority, then fresh consistent workbook/control evidence and owner/admin window
agreements. Do not reinterpret retained historical notices as pending sends or revisit
expired logs. Maintenance/migration remain NOT_READY; see bilingual writer-controls guide.


### Old containers retired; owner isolation prepared — 2026-10-29

Previous preparation delivered as `9f01bae8`. Provider-bound inspection confirms288
old revisions across24 services are RETIRED, current traffic100% with no tags and
stable service readbacks. Added15 tests;129 focused tests/build/lint pass. This closes
old-container execution only; previously submitted effects and other writers remain
independent. Owner OAuth grants include broad Sheets/Drive write access; the known
test account's Google UI reports no linked apps. Prepared transfer of only the same
develop file to that account, demotion of the former owner to reader, parent-inheritance
check, connector probe/value comparison and conditional reverse-transfer recovery.
No ownership/permission change authorized or performed yet. New code/docs local;
maintenance/migration NOT_READY. See bilingual writer-controls guide for scope.


### Owner isolation executed with authorization — 2026-10-29

The exact develop workbook transfer was accepted by the test account; the former
owner is now a reader alongside the three service readers, with restricted sharing.
Same-value Fecha/A1 connector write succeeded before and returns 403 PERMISSION_DENIED
after; reads remain available and all 742 typed values across six ranges are unchanged.
No move was necessary for the observed denial. Parent/permission metadata is now
unavailable to the reader connector; do not fabricate a parent ACL or refresh the
historical owner API record. The preparation binds current UI/probe evidence separately.
141 focused tests/build/lint pass; actual combined evidence remains NOT_READY with
unknown prior effects/other writers and explicit current-parent/version/control gates.
No new OAuth/IAM, global revocation, deployment, FCM or production change. No native
parity gap. New changes remain local after `9f01bae8`. See bilingual writer-controls guide
and private `2026-10-29-develop-owner-transfer` evidence. Next complete remaining automatic
authority/prior effects before a bounded agreed window; HU-084/HU-085 and draft PR #278
remain open. Recovery would require reverse transfer and acceptance.


### Remaining access/effects audit — 2026-10-29

`b69dcf5b` delivered and remote verified. Fresh provider inventory confirms only 24
reviewed Run services globally, no Run jobs/worker pools/instances, three paused
Scheduler jobs, no Build triggers/active builds across 44 locations, nine keyless
service accounts and unchanged project IAM/Rules. Census remains 183 sources plus
12 captures/16 deliveries. Two known calendar probes have exact HTTP 200 terminals
and no Sheets/notice effects. No global old-effect closure is inferred.
The maintainer identifies the existing apps/Functions using `collections`, distinct
from `plus-collections`. Both use the same project; current develop Rules cover both
namespaces and legacy HTTP endpoints are shared. This identifies known callers, not
an exhaustive external-credential inventory. The 105 older notices remain unreplayed
history and residual effects still block admission.
No cloud mutation or production-data read. This audit is documentation only; prior 141 tests/
build/lint reused unchanged. See bilingual writer-controls guide for finite next
steps and private 2026-10-29-remaining-authority-effects evidence. No native parity gap.


### Historical-effect decision pending — 2026-10-29

Access/namespace audit delivered in `d3ae12d9`, remote verified. Offline disposition
of all 117 retained notices passes: 55 no-token, 34 partial, 25 success, three missing
April outcomes; 12 send summaries have correlated terminal receipts. Three imports
and two calendar probes retain separate completion evidence. No replay, fresh cloud
observation or live mutation. Complete historical termination remains unproved.
Proposed [ADR-0026](../../../docs/decisions/0026-accept-bounded-develop-historical-effect-risk.md)
requires an explicit policy decision before local implementation: accept the scoped
develop historical risk or retain strict blocked admission. It does not open a
window. Details and private evidence are in the bilingual writer-controls guide.
New documentation remains local; assertions/links/diff pass, no native parity change.


### ADR-0026 accepted; local implementation/rehearsal complete — 2026-10-30

Explicit maintainer acceptance covers develop historical risk, local implementation
and rehearsal only. The existing v3 barrier now binds exact risk acceptance and
preserves historical unknowns. The fixed-demo migration/inverse runner verifies both
plans and notices in its transaction source set; no shared entry point is enabled.
137 local + 26 emulator passes, build/lint/syntax/diff pass. See bilingual
[ADR-0026](../../../docs/decisions/0026-accept-bounded-develop-historical-effect-risk.md)
for rejection cases, post-commit failure and limits. Work remains local after
`d3ae12d9`; no commit/push, shared maintenance, production change or native parity
gap. Next prepare fresh real authority and exact operation acceptance, then request
its separately authorized window. HU-084/HU-085 and draft PR #278 stay open.


### Real develop evidence refreshed; window remains closed — 2026-10-30

ADR-0026 delivered in `0539ee40`, remote/draft PR #278 verified. Reused unchanged
137 local + 26 emulator tests, build/lint after checking all seven source hashes.
New read-only packet `2026-10-30-maintenance-evidence`: unchanged 24 Functions,
Rules/IAM, three paused jobs, 288 retired revisions, six READY indexes; unchanged
62 shifts/four calendars/117 notices and 12 captures/16 deliveries; 48 projected users;
five absent authority documents; 742 unchanged typed workbook cells and renewed UI
showing one owner/four readers. Offline assertions pass. No shared writes or native gap.
A separately authorized owner Online-only metadata-read session confirms stable Drive
version 278 and the test owner's My Drive root: one owner/four direct readers on the
file, only that owner on its parent. Authorization removed; Connections empty and same
GET denied with 401. No retained credentials or IAM changes. Bind real source policy/
plans and refresh remaining authority/queue controls before the separately authorized
owner/admin/risk window; the observations are not a held barrier. NOT_READY, no window
or operation acceptance fabricated. See bilingual writer-controls guide for scope and
historical-evidence limits. New documentary work remains uncommitted; issues stay open.

### Evidence-bound migration review package — 2026-10-30

Previous real-evidence documentation delivered/pushed as `3c06b28d`; draft PR #278
head verified. New offline preparer and 19 focused tests remain local. It binds
thirteen private evidence files, reviewed proposal/content, version 278, exact
permissions/index/control/source observations, 62 raw before-images, 72 published
semantic creates and 53 helper cells to one source-policy binding and both intents.
117 notices remain preserved without replay; dates and all 108 positions unchanged.
Raw inverse fields are exact; original service timestamps cannot be restored.

Package `ee465d0e2adb646111336d19356d685196c49ed4954834d7e320eeec49d7ac75`
is PREPARED_NOT_ADMITTED, not an executable manifest. Runtime policy, held source
versions, actual receipts/markers, live budget and window/risk agreements remain
explicitly unbound. No provider calls, maintenance entry, migration or production
access. 83 local tests, build/lint and focused CJS lint pass; no native changes or
parity gap. Emulator executor unchanged, not rerun. See the bilingual migration
rehearsal guide. Next materialize/rehearse the closed runtime policy and exact
transaction manifests locally; obtain fresh admission evidence and explicit window
only afterwards. HU-084/HU-085 remain open, PR #278 draft.

### Closed policy and final local migration/inverse accepted — 2026-10-30

Review package delivered/pushed in `e9fb31e5`, remote/PR #278 head verified. New
local implementation materializes an explicitly closed source policy and complete
forward/inverse transaction manifests with the existing serializer/barrier/CAS.
Execution reconstructs and compares every mutation/precondition; inverse requires
the actual forward receipt. Raw/guard drift, rounded clone fields, missing final
manifest, future/stale time and substituted writes reject. Reviewed operation IDs
are explicitly mapped to the existing canonical request-operation identity.
Annual production rejects the closed policy even after accidental local opening.

92 local + 39 SDK-emulator + 1 captured Sheets acceptance pass, build/full lint
and CJS lint pass. Real retained input roundtrip: 203/140 writes; exact 62 originals,
72 published rows/108 positions, 48 users, four calendars and 117 notices preserved.
Sheets: 53 helpers plus two markers per batch; 742 observed cells/notes restored.
Evidence `2026-10-30-final-migration`; see bilingual migration guide for exact
digests, byte estimates and limitations. All final receipts/times/controls are local
rehearsal authority, not live admission. No shared executor, maintenance opening,
deployment or production access; no native parity gap. Next connect controlled
develop execution and prepare read-only admission before a separately authorized
window. New changes remain local; HU-084/HU-085/PR #278 stay open/draft.

### Controlled executor connected; real admission remains blocked — 2026-10-30

Previous materializer delivered/pushed as `9a83203f`; remote and draft PR #278
head verified. New local composition reuses the extracted migration engine with
fixed develop project/database/namespace and exact original service versions.
Passive admission does not close controls or write incidents; execution consumes
an already-held barrier, rechecks source/human observations and rejects inspection
older than 60 seconds. Reports never authorize application or maintenance entry.

102 unit + 47 SDK-emulator passes, build/full lint and CJS lint. Retained-input
203/140-write roundtrip restores 62 originals and preserves 117 notices. Actual
read-only develop inspection detects two unreviewed config documents (member/public);
config/global itself is unchanged. Admission blocks with zero shared writes or
control reads. Next extend/review the exact config census and regenerate the bound
packet before repeating passive admission and preparing the separately authorized
window. See bilingual migration guide and private `2026-10-30-controlled-executor`.
No deployment, maintenance opening, production access or native parity gap.
New work remains uncommitted; HU-084/HU-085 open, PR #278 draft.

### Complete config census; real passive source match — 2026-10-30

Controlled composition delivered/pushed in `eb073e0e`, exact remote/PR #278 head
verified. New local correction requires all three config documents and binds whole
payloads/versions to the reviewed policy and materializer. The fresh atomic census
preserves every previously reviewed source/receipt; config/member and config/public
were pre-existing omissions. Regenerated packet preserves all business mutations,
published dates/order and 53 helper intents; identities change with new evidence.

Actual SDK read-only source inspection passes and stops at window_scope_missing:
one transaction, zero control reads/close calls/writes, no maintenance permission.
Other technical/Sheets authorities remain retained observations, not fresh admission.
113 unit + 50 SDK-emulator tests, build/lint and CJS lint pass. Exact 203/140-write
recovery and config drift/ABA refusal are covered; no native parity gap.
See bilingual migration guide and private `2026-10-30-config-census` for digests
and limits. Next prepare/refresh current technical and Sheets writer/destination
admission for this exact package before requesting the explicit window. No shared
mutation, deploy, maintenance opening or production access. New work remains local;
HU-084/HU-085 remain open and PR #278 draft.

### Current technical controls and Sheets destination reviewed — 2026-10-30

Config-census correction delivered/pushed as `27920b02`; prior 113 unit/50 emulator
gates reused with all seven code/test hashes verified. New work is documentary and
read-only evidence. All 24 Functions, Rules/IAM and six READY indexes match; three
jobs stay paused, 288 old revisions retired; four exact capture proofs/eight transport
bindings verified. Queue metrics UNKNOWN are not drain proof. Nine accounts have no
user keys/direct bindings; no global Run jobs/pools/instances. Cloud Asset disabled;
other automation inventory remains labelled historical.

Develop destination/tab IDs and 742 cells/notes match. The explicitly authorized
Online metadata-only owner session confirms stable Drive version 278, all five file
permissions and the returned owner-only My Drive root. Four direct readers; the only
inherited writer detail is the owner itself. No extra writer or content restriction.
Both the stalled first session and successful clean-tab retry were revoked; final
connection absent and same GET denied401, no refresh token, Playground fields cleared.
No controlled Sheets worker is deployed; existing runtime has general project data/FCM
roles and no file grant. No service-account grant/token or write probe. See bilingual
writer-controls guide and private `2026-10-30-technical-sheets-review`; owner evidence
assertions pass. Next prepare the scoped writer grant/probe proposal before any
separately authorized window. No maintenance, business/Sheets write, FCM or production
data access; no native gap.
New docs remain local; stories open, PR #278 draft.
