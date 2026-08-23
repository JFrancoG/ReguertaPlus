# HU-081 - Consolidate the iOS Shifts/Planning/Swaps/Delivery Calendar/Settings slice

## Metadata

- issue_id: #264
- priority: P1
- platform: ios
- status: in_progress
- plan_state: approved
- branch: `codex/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings`
- base: `35a874288e3844d9c3d88abbaa39e2fb6fef42b2`

## Authorization and delivery boundary

The maintainer activated the third Phase 6 slice on 2026-08-23 with:

> Ok. Abre issue, rama y comenzamos con el siguiente paso

This authorized issue, branch, audit, specification, baseline, plan, tasks,
tests, previews, and in-scope implementation. The maintainer later authorized
the first checkpoint and the next cut with:

> ok. Haz commit y push, y comenzamos a implementar el siguiente corte

That instruction authorized commit and push of the completed Phase 1A
checkpoint and implementation of Phase 1B. The maintainer then authorized the
next checkpoint and cut with:

> commit y push, y comenzamos el siguiente corte

This authorizes commit and push of completed Phase 1B plus implementation of
Phase 2. It does not authorize pull request, merge, issue closure, branch
deletion, live-data mutation, Firebase deployment, or Google Sheets changes.

The maintainer then authorized the Phase 2 checkpoint and Phase 3 with:

> ok. commit y push, y phase 3

This authorizes commit and push of completed Phase 2 plus Phase 3
implementation. It does not authorize pull request, merge, issue closure,
branch deletion, live-data mutation, Firebase deployment, or Google Sheets
changes.

The maintainer then authorized the Phase 3 checkpoint and Phase 4 with:

> pues commit y push y comenzamos fase 4

This authorizes commit and push of completed Phase 3 plus Phase 4
implementation. It does not authorize the Phase 4 checkpoint, pull request,
merge, issue closure, branch deletion, live-data mutation, Firebase deployment,
or Google Sheets changes.

The maintainer then authorized the Phase 4 checkpoint with:

> pues commit y push

This authorizes commit and push of completed Phase 4 only. It does not authorize
Phase 5 implementation, pull request, merge, issue closure, branch deletion,
live-data mutation, Firebase deployment, or Google Sheets changes.

## Context and problem

Phase 6 modernizes one vertical slice at a time. HU-079 closed Auth/session and
HU-080 closed Products/Orders/Home/Freshness. HU-081 owns the existing iOS
Shifts, Planning, Swaps, Delivery Calendar, and Settings implementation without
reopening their delivered product behavior or the preceding session/runtime
contracts.

The primary slice contains 30 Swift files and 4,244 lines across Domain, Data,
App, Shifts Presentation, and Settings Presentation. Its directly supporting
localization, preview gallery, and develop-time seams bring the activation
surface to 36 files and 5,885 lines. Size is only an audit signal; executable
defects and ownership contracts determine every cut.

## Source-backed activation defects

### P1 - active members do not load Delivery Calendar exceptions

`refreshDeliveryCalendar` currently resets calendar state unless the authorized
member is an admin. That contradicts both the Firestore contract, which permits
every active member to read `deliveryCalendar`, and HU-042, which requires the
effective exception date to be visible to members. `My Order`, `Received
Orders`, and Home consume this shared state for every authorized session, so a
regular member silently falls back to Wednesday and an empty exception set.

The first RED must prove that an active regular member loads the default and
weekly exceptions while calendar mutation and planning remain admin-only.

### P1 - Delivery Calendar uses the device timezone

`Presentation/Settings/DeliveryCalendarSupport.swift` derives ISO week starts,
delivery dates, blocked dates, and order-window timestamps with
`Calendar.current` and `TimeZone.current`. `ShiftAssignment.weekKey` and the
Orders consumers use the canonical Madrid business calendar. A device outside
Madrid can therefore write different milliseconds for the same `weekKey`,
which Orders later interprets in Madrid.

The next Calendar RED must prove that override construction is independent of
the device timezone and that the resulting delivery/block/open/close instants
use the shared `Europe/Madrid` authority.

### P1 - stale client data can deny a swap owned by Functions

The client computes candidates from its current `shiftsFeed` and refuses to
call the repository when that local snapshot has no candidates. The
`transitionShiftSwap` Function is the authoritative transaction: it rereads
all shifts and active members, validates ownership/timing, computes candidates,
applies swaps, recomputes helpers, and creates notifications. A stale client
feed can reject a request that the backend would accept.

`ShiftSwapTransition` also transports complete `ShiftSwapRequest` values even
though Data serializes only action-specific identifiers, reason, candidate, or
response fields and Functions ignores client-side mutations. HU-081 must make
the command boundary truthful without changing the existing Function contract.

### P2 - business policy and infrastructure ownership leak into Presentation

Candidate projection, member replacement, helper recomputation, and Delivery
Calendar window construction live in Presentation. Some are useful local
display projections, while the authoritative mutation belongs to Functions.
Each operation must be classified before moving it: Domain owns reusable client
policy; Data maps transport commands; Presentation coordinates UI state and
must not pretend to own backend authority.

### P2 - asynchronous ownership is incomplete

`ShiftsFeatureViewModel` owns five repositories, session/environment context,
roughly forty state and generation slots, refresh, swaps, planning, calendar,
display, and feedback. Several cancel-and-replace effects are launched through
unretained `Task` values. Operation IDs prevent some stale publication but do
not physically cancel I/O or bind its lifetime to one owner.

The slice may introduce cohesive Stores only when tests demonstrate an
independent state/operation lifetime. The ViewModel remains a facade where that
keeps View composition simpler; no split is justified by file length alone.

### P2 - dead dependency and missing executable UI evidence

`notificationRepository` is injected into the Shifts graph but unused; Functions
already write the swap notifications transactionally. There are no XCUITest
journeys for Shifts, Planning, Swaps, Delivery Calendar, or Settings, and the
preview gallery lacks swap and mutation-state coverage.

## Authoritative inherited contracts

- RF-TURN-01...07: global/next shifts, active-member planning, rotation,
  swaps, notifications, and minimum market staffing.
- RF-CAL-01...05: admin-only future changes, recomputed order windows,
  `weekKey` identity, exception-only persistence, and mandatory default.
- RNF-02: business-time consistency with `Europe/Madrid` for this slice.
- HU-020/HU-041/HU-042/HU-063: Sheets-backed data, segmented board, helper
  semantics, member-visible effective Calendar exceptions, and existing
  presentation behavior.
- HU-066: appearance, producer unavailable mode, admin tools, impersonation,
  and develop-time controls.
- ADR-0004/0008/0011/0012 plus HU-079/HU-080: composition, session fences,
  strict Swift 6 ownership, nonisolated module policy, and runtime context.
- Existing `transitionShiftSwap` Function: backend-authoritative candidate,
  participant, timing, swap, helper, and notification transaction.

## In scope

- Global and next shifts, segmented board, display projections, and refresh.
- Delivery/market planning request submission and status ownership.
- Swap create/respond/cancel/apply command flow and acknowledgement state.
- Delivery Calendar default, overrides, editor, and order-window calculation.
- Settings sections that consume Shifts/Calendar/Products/session/develop time.
- Domain policies, truthful repository commands, Data mappings, App composition,
  Presentation owners, and selective semantic DocC.
- Deterministic Swift Testing, focused UI, previews, localization,
  accessibility, motion, and adaptive layout for the affected surface.

## Out of scope

- New shift rules, post-publication absence policy, permission redesign, or a
  new product workflow.
- Firestore schema, Functions behavior, Rules, backfills, Google Sheets writes,
  live data, deploys, or closure of HU-070/#198.
- Android implementation. The temporary parity gap remains explicit and a
  future Android slice must use native Compose/state ownership.
- Live presence/read-back of `config/member.deliveryDayOfWeek`. The member-safe
  projection is required by the current repository and Rules contract, but
  seed, canary, and live validation remain owned by HU-022/HU-070.
- News/Notifications, Users/Shared Profile, Bylaws/Startup/Media, or later
  modernization phases.
- Packages, project settings, CI, iOS/Xcode 27, broad test migration, or global
  RNF-02 closure outside the touched Shifts/Calendar/Settings seams.

## Preserved contracts

1. Only a live authorized session may read or mutate the active environment.
2. Every active member may read the Delivery Calendar used by member-facing
   order surfaces; calendar mutation and planning remain admin-only before any
   generation mutation or repository I/O.
3. The backend remains the authority for swap eligibility and application;
   local projections may guide UX but cannot falsely deny an authoritative
   request because their snapshot is stale.
4. Every mutation sends only the command fields the backend owns and accepts.
5. A cancelled or superseded operation cannot publish, clear, or clean up a
   successor; physical cancellation is used where the owner controls the task.
6. Delivery Calendar writes one Madrid-derived exception for a changed week;
   returning to the default deletes the redundant exception.
7. Appearance and develop time remain device-level/root-owned; producer
   unavailable mode continues through the Products owner rather than a second
   Settings persistence path.
8. No new live Firebase or Google Sheets operation is executed by tests or
   previews.

## Acceptance criteria

- [x] HU-081, issue #264, branch, base, profile, and initial inventory are
  resolved without a duplicate execution item.
- [x] An active regular member loads the Calendar default and weekly
  exceptions, while calendar mutation and planning remain admin-only.
- [x] Delivery Calendar override/window construction is deterministic across
  device timezones and uses `Europe/Madrid` for every business instant.
- [x] Swap commands express only create/respond/cancel/apply inputs owned by the
  client; Functions remains the authoritative candidate/application owner.
- [x] A stale local candidate projection cannot prevent a valid backend create;
  backend no-candidate failure maps to specific, localized feedback.
- [x] Reusable client business policies live in Domain, transport mapping lives
  in Data, and Presentation contains no backend-authoritative mutation logic.
- [ ] Feed, swaps, planning, and calendar operations have cohesive owners,
  retained cancellation where contractual, successor fences, and owner-only
  cleanup covered by deterministic tests.
- [ ] Session, member, role, environment, route, and revision checks occur
  before generation mutation, repository I/O, or state publication.
- [x] The unused Shifts notification dependency is removed without changing
  the Function-owned notification behavior.
- [ ] Appearance, unavailable mode, impersonation, develop time, planning,
  swaps, and Delivery Calendar preserve inherited behavior.
- [ ] Affected SwiftUI is localized and adaptive with deterministic
  loading/empty/content/error/mutation/role previews.
- [ ] Focused member/admin UI journeys and the required phone/iPad, Dynamic
  Type, color, contrast, VoiceOver, Voice Control, and Reduce Motion matrix pass.
- [ ] Focused cohorts, canonical `fast-unit`, applicable `ui-smoke`, definitive
  `release-gate`, SwiftLint, settings 6/6, Debug, Production Release, layer and
  concurrency guards, and `git diff --check` pass on the frozen final tree.
- [ ] Android parity, HU-070/#198, later verticals, inherited skips, and all
  accepted residual debt are recorded without claiming out-of-scope closure.

## Validation contract

- Project: `ios/Reguerta/Reguerta.xcodeproj`
- Scheme: `Reguerta`
- Destination: `platform=iOS Simulator,name=iPhone 17,OS=26.5`
- Implementation plan: `fast-unit-v1`
- Closure runners:
  - `./scripts/validate-ios.sh fast-unit --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
  - `./scripts/validate-ios.sh ui-smoke --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
  - `./scripts/validate-ios.sh release-gate --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
- Focused Swift Testing and XCUITest selectors are recorded before each RED.
- No infrastructure/setup failure counts as behavioral RED or GREEN evidence.

## Delivery state

Phase 1A is GREEN and published. Its valid RED ran the six-test
`ReguertaShiftsViewModelTests` suite and failed only the new member Calendar
expectation because `defaultDeliveryDayOfWeek` was `nil`. The 27-test focused
cohort and canonical `fast-unit-v1` then passed. Functional commit `b956f09`
contains the read-boundary fix and documentation commit `b491e50` records that
checkpoint.

Phase 1B is GREEN and committed as `fc1157e`. The valid device-timezone RED is
`/tmp/reguerta-hu081-xctestrun-red.E2voNm/Result.xcresult`; the previous
Presentation helper produced UTC-derived milliseconds instead of Madrid
instants. The delivered implementation provides one guarded
`BusinessCalendar` authority in Domain, strict ISO-week parsing, DST-safe
calendar arithmetic, a semantic exception factory limited to
Tuesday/Thursday/Friday, and exception-only writes with true no-op handling for
unchanged/default weeks. Settings retains legacy/default selections only so an
invalid persisted value can be exited safely.

Final local evidence on iPhone 17 / iOS 26.5:

- focused policy/admin/Settings/presentation cohort: 30 logical / 46 concrete,
  PASS at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/reguerta-hu081-final-focused.5j30UY5se5/Result.xcresult`;
- the policy selector under `TZ=UTC` and `TZ=America/New_York`: 5 logical / 21
  concrete in each process, both PASS;
- canonical `fast-unit-v1`: 789 logical / 996 concrete, PASS;
- SwiftLint 0.61.0: 438 files, zero violations; `git diff --check`: PASS.

Earlier Phase 1 `ui-smoke` attempts were infrastructure-flaky: different
journeys terminated with `signal term` while Xcode reported a missing LLDB
debugger version, then passed when retried alone. The final Phase 2 run below
passes the complete four-journey plan. Dedicated Delivery Calendar UI
automation remains a later Phase 6 requirement.

Phase 2 is GREEN and published as `fae4da0`. Its valid RED showed create returning
`false` with zero repository calls when the local candidate feed was stale.
Domain now exposes only minimal typed commands, Data preserves the exact
Functions payload union, and Presentation no longer constructs authoritative
swap mutations or owns candidate eligibility. Typed transport outcomes drive
localized ES/EN feedback, and the unused Shifts notification dependency is
gone without changing the Function-owned notification transaction.

The in-memory authority now persists create/read-back, owns transition
timestamps, enforces open/accepted/requester contracts, and attributes a
response by authenticated member plus shift. Focused boundary, VM, failure,
composition, and notification suites passed; all 28 Functions security tests
passed. Final Phase 2 evidence on iPhone 17 / iOS 26.5 is 796 logical / 1,018
concrete `fast-unit-v1` executions and four passing `ui-smoke` journeys.
SwiftLint 0.61.0 reported zero violations in 440 files. The UI runner still
emits the known missing-LLDB-version warning, without a test failure.

Remaining `Calendar.current` and implicit formatter timezone use in Shifts and
Settings Presentation belongs to later HU-081 display/UI cuts, not to a
different issue. The inherited `OrderHistoryWeek` fallback is outside this
touched seam and remains separately recorded. No live environment assertion is
made about `config/member`.

Phase 3 feed ownership is complete locally. Its valid RED timed out because a
same-context feed successor lost the pending initial Calendar hydration. The
GREEN retains one weak, atomic Shifts + swap-request feed owner, propagates
caller cancellation to that exact task, preserves latest-wins owner-only
cleanup, and adopts an already-authorized session. Publication is fenced across
principal, authenticated-member, selected-member, role/capability, environment,
and admin changes. Role drift performs a feed-only reset that preserves
acknowledgements, dismissals, draft, segment, and later mutation owners; full
identity or admin-access drift, environment drift, or invalid authorization
retains the full reset.

Pending initial Feed -> Calendar hydration transfers only to an
equivalent-context feed successor, is claimed only by the current exact owner,
and starts Calendar with the captured `SessionContext`. Ordering is preserved
after feed success and terminal failure without redesigning Calendar, planning,
or swap-mutation ownership.

Final Phase 3 evidence on iPhone 17 / iOS 26.5 is 12 logical / 15 concrete
focused ownership/calendar executions, 79 / 87 expanded
Shifts/session/composition executions, and 808 / 1,033 canonical
`fast-unit-v1` executions, all passing without skips. SwiftLint passed with
zero violations across 444 files; static guards and independent ownership,
test, and scope reviews found zero P0-P2 issues. Phase 3 is committed as
`124c34d`, its documentation checkpoint is `5dab3e2`, and both are published on
the verified feature branch.

Phase 4 swap-mutation ownership is complete and committed as `6df78eb`. Its
deterministic RED proved that sign-out did not physically cancel a suspended, non-cooperative
create operation. The GREEN retains one weak owner and one single-flight lane
for create, respond, cancel, and apply; invalidates the operation identity
before cancellation; propagates async caller cancellation to the exact retained
task; and rejects late success, failure, and cleanup from an obsolete owner. An
observable authorization-boundary revision also detects coalesced ABA session
transitions. If a result arrives before that boundary handler, its receipt is
retained but cannot publish until the current boundary has been handled.

Every command has an exact retry key: create uses the requested shift ID and
respond/cancel/apply use the request ID. Definitive `noCandidates`,
`permissionDenied`, and `conflict` failures release that key; ambiguous
`unavailable`, `invalidData`, and unknown failures quarantine only the affected
key. Operation provenance prevents a late definitive failure from clearing a
newer uncertainty with the same key. Role-only drift preserves an accepted
mutation. Identity or environment drift cancels and fences it; admin-capability
drift is a hard publication boundary but preserves confirmed acknowledgements
and keyed uncertainty while the resource scope remains the same.

Leaving the request route does not discard an accepted command. Completion may
navigate back to Shifts only while that request route is still current, so a
late result cannot pull the user away from a successor route. A confirmed
backend result publishes its acknowledgement before scheduling an authoritative
atomic feed refresh and releases the mutation lane without waiting for read-back.
Failed read-back therefore keeps the acknowledgement and blocks only the exact
ambiguous resubmission. A request uncertainty clears only when authoritative
read-back reflects that exact request or a terminal status; a missing or stale
projection keeps it quarantined. Create uncertainty cannot clear automatically
because the backend exposes no client correlation or idempotency key. Adding
that end-to-end guarantee remains a separate Functions contract and issue, not
part of this Presentation-only cut.

Same-resource relogin preserves acknowledgements and keyed uncertainty, while a
different identity or environment discards them. The nested Users public-member
projection can emit a second synchronous authorization change; Shifts remains
fail-closed between both changes and settles only after handling the actual
successor session.

Final Phase 4 evidence on iPhone 17 / iOS 26.5 is 43 logical / 280 concrete
focused ownership executions, 105 / 124 expanded Shifts/session/repository/root
executions, and 844 / 1,303 canonical `fast-unit-v1` executions, all passing
without failures or skips. SwiftLint 0.61.0 reported zero violations across 460
files; Xcode built without errors or warnings, and the
project/package/layer/escape guards remained clean. This documentation records
the authorized feature-branch publication. HU-081 remains active; no Phase 5
work, pull request, merge, issue closure, branch deletion, live mutation, or
deployment is authorized or claimed.
