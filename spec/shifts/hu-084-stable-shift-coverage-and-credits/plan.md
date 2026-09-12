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
