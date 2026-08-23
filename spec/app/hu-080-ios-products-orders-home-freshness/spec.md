# HU-080 - Consolidate the iOS Products/Orders/Home/Freshness slice

## Metadata

- issue_id: #262
- priority: P1
- platform: ios
- status: in_progress
- plan_state: approved
- branch: `codex/hu-080-ios-products-orders-home-freshness`
- base: `5c511dda9aeb3dab182888733cf972847a91b97a`

## Authorization and delivery boundary

The maintainer activated the second Phase 6 slice on 2026-08-21 with:

> Pues abre issue y rama y seguimos

This authorizes the issue, branch, specification, baseline, plan, tasks, tests,
previews, and in-scope implementation. It does not authorize commit, push, pull
request, merge, issue closure, branch deletion, live-data mutation, or Firebase
deployment.

## Context and problem

Phase 6 modernizes one vertical slice at a time. HU-079 closed the Auth,
session, environment, and authorized-device slice. HU-080 now owns Products,
Orders, Home, and Critical Data Freshness without reopening those security and
composition contracts.

The activated slice contains 69 primary Swift files and 13,771 lines across
Domain, Data, and Presentation, plus four composition seams and 275 lines. The
size alone is not a refactoring instruction. Initial source-backed defects and
boundary debt determine the order:

1. `FirestoreProductRepository.upsert` remaps a `Product` to its persisted ID
   but drops `weightStep`, `minWeight`, and `maxWeight`. The subsequent payload
   deletes those fields, so saving a weight-priced product loses valid data.
2. `resolveMyOrderConsultaWindow` accepts the configured delivery weekday but
   ignores it and defaults to Wednesday unless an override exists. My Order and
   Received Orders therefore calculate the consultation window incorrectly for
   another configured delivery day.
3. Home reads `UserDefaults.standard` directly and duplicates private cart
   storage keys even though Orders already exposes an injected cart store. This
   breaks the Domain/Data/Presentation boundary and can make Home observe a
   different store than the route graph or a preview/test.

The first RED/GREEN is the product-persistence loss because it is a contained
P1 data-integrity defect. The Orders policy and Home persistence boundary follow
as separate cuts with their own characterization.

## User story

As a member, I want product attributes, order-week policy, Home summaries, and
freshness gates to remain correct across refreshes, edits, navigation, session
changes, and environment changes so that I never order from stale or corrupted
state.

As a maintainer, I want each asynchronous owner and layer boundary in this
vertical to be explicit and deterministically tested before the remaining iOS
features are modernized.

## Canonical decisions and inherited contracts

- The Phase 6 order and activation contract in
  `spec/app/hu-074-ios-nonisolated-refactor/plan.md`.
- HU-022: My Order remains fail-closed until the exact freshness attempt is
  ready; empty current-week remote data can be a valid fresh result; bounded
  recovery uses the accepted 10/20/30-second policy.
- HU-051 and HU-055: Home navigation, weekly summary, delivery/order week, market
  date, responsibles, and cutoff-day semantics remain unchanged.
- ADR-0004: App owns live composition; Presentation does not construct Data or
  Firebase adapters.
- ADR-0005: route content and bottom controls retain explicit safe-area
  ownership.
- ADR-0007: authorization remains fail-closed; HU-070/#198 still owns the live
  roles rollout.
- ADR-0011: project-level `nonisolated` default with explicit UI owners and no
  unsafe concurrency escapes.
- ADR-0012: immutable environment/session snapshots, owner-only cleanup,
  generations, revisions, and checked infrastructure boundaries.

No new ADR is required while HU-080 materializes those accepted contracts. A
change to business policy, backend schema, freshness semantics, authorization,
or cross-layer ownership requires separate approval and, when architectural, an
ADR in English and Spanish.

## Scope

### In scope

- Product catalog loading, editing, image upload, persistence, archive,
  availability, common-purchase behavior, and ordering refresh.
- My Order, cart/checkout, previous order, received orders, received history,
  producer status, consultation windows, and restoration.
- Home weekly summary, action-row eligibility, route orchestration, and news
  presentation where it consumes this slice's state.
- Critical Data Freshness resolution, timeout, retry, acknowledgement, session
  and environment fences, and the exact handoff to Products/Orders/Home.
- Explicit `@MainActor` Presentation owners, retained operation handles where
  cancellation matters, latest-wins revisions/generations, and owner-only
  cleanup.
- Domain/Data/Presentation boundary repairs found by source-backed tests.
- Deterministic Swift Testing coverage and focused UI/previews for affected
  loading, empty, content, failure, editor, freshness, and route states.
- Localized and accessible affected UI at phone/iPad widths, Large/XXX Large/
  AX5, ES/EN, light/dark, Increased Contrast, VoiceOver, and Reduce Motion.

### Out of scope

- Later Phase 6 slices: Shifts/Planning/Swaps/Delivery Calendar/Settings,
  News/Notifications, Users/Shared Profile, and Bylaws/Startup/Media.
- Role/permission redesign, Firestore schema changes, Rules, Functions,
  backfills, live data, deployments, or closure of HU-070/#198.
- Android implementation. The temporary parity gap remains explicit.
- Packages, project settings, CI, global navigation redesign, broad visual
  redesign, or a test-framework migration outside the slice.
- Global RNF-02/timezone completion outside the Orders/Home/Shift-week/
  producer-parity seams touched here, including inherited Settings/Shifts debt.
- Commit, push, PR, merge, issue closure, branch deletion, or integration
  without later maintainer authorization.

## Preserved contracts

1. A persisted product retains all validated quantity and weight semantics when
   its remote document ID is assigned.
2. Delivery-window resolution uses override, then configured delivery weekday,
   then the historical Wednesday fallback.
3. Home consumes an injected Orders/Domain value or capability and never reads
   private Data storage keys or `UserDefaults` directly.
4. A stale catalog, order, Home, or freshness operation cannot publish or clean
   up a successor after session, member, environment, or route drift, or
   unacknowledged session-revision drift.
5. Checkout and status writes require the same live authorization and context
   that began the operation.
6. Freshness remains fail-closed for navigation and publishes ready only after
   the exact consumer acknowledgement; timeout/retry never acknowledges stale
   data.
7. Presentation imports no Firebase and constructs no live adapter; Domain
   imports no SwiftUI, Firebase, or Data implementation.
8. No `@preconcurrency`, `@unchecked Sendable`, `nonisolated(unsafe)`,
   `Task.detached`, GCD, or equivalent escape is introduced.

## Acceptance criteria

- [x] Issue #262 and the feature branch exist on the exact post-HU-079 base.
- [x] The initial file/line, owner, dependency, test, preview, and UI inventory
  is frozen in `phase-6-baseline.md`.
- [x] Weight-priced products preserve `weightStep`, `minWeight`, and
  `maxWeight` through ID remapping and Firestore payload generation.
- [x] Order consultation windows honor override, configured delivery weekday,
  and Wednesday fallback in that order in My Order, Received Orders, and Home.
- [x] Home no longer reads `UserDefaults` or duplicates private cart-store
  keys; injected graphs, previews, and tests observe the same source.
- [x] Products, Orders, Home, and Freshness operation owners, cancellation,
  revisions, and cleanup are explicit and covered by deterministic tests.
- [x] Received Orders rejects Boolean/non-finite monetary scalars and negative
  prices or totals, and normalizes an invalid per-unit measure without dropping
  a valid line.
- [x] Freshness accepts a successor session revision only through the explicit
  Products receipt for the exact applied payload, and Products revokes every
  prior catalog/editor owner before adopting an unsynchronized revision or
  access demotion.
- [x] The Orders/Home/Shift-week/producer-parity seams touched by HU-080 use the
  shared Madrid business calendar; no global RNF-02 closure is claimed.
- [x] Authorization, session/environment fences, checkout/restoration, weekly
  summary, and freshness acknowledgement preserve their inherited behavior.
- [x] Presentation/Data/Domain composition guards pass with no new boundary
  exceptions or unsafe concurrency escapes.
- [x] Affected Views are split only at demonstrated cohesive boundaries and the
  changed surface has localized, adaptive deterministic previews for the
  required states; the two local Product editor canvases remain documented
  debt because the shared gallery covers the full route.
- [x] Focused slice tests, canonical `fast-unit`, applicable UI tests,
  `ui-smoke`, and `release-gate` pass on the frozen final tree without
  unexpected failures.
- [x] Rendered evidence and residual debt are recorded; Android parity,
  HU-070/#198, and later verticals remain explicit.
- [x] HU-080 physical-device/manual acceptance is complete. The 2026-08-22
  iPhone 11 / iOS 26.6 pass confirms the functional journeys, Voice Control, Reduce Motion,
  Increased Contrast, and the unaffected routes at large text. The 2026-08-23
  retest confirms grouped weekly-cell traversal, localized range speech, and
  near-maximum Dynamic Type through the final news item. The final 2026-08-23
  post-focus retest also confirms initial weekly-summary focus, no focus theft
  during refresh, and one new focus after route re-entry. The HU-079 manual pass
  is not reused.

## Validation contract

- Project: `ios/Reguerta/Reguerta.xcodeproj`
- Scheme: `Reguerta`
- Destination: `platform=iOS Simulator,name=iPhone 17,OS=26.5`
- Implementation test plan: `fast-unit-v1`
- Closure runners:
  - `./scripts/validate-ios.sh fast-unit --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
  - `./scripts/validate-ios.sh ui-smoke --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
  - `./scripts/validate-ios.sh release-gate --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
- Focused selectors are recorded in `plan.md` and updated as each RED is added.
- Every executable gate uses an isolated `.xcresult`; infrastructure failures
  are not counted as behavioral RED or GREEN evidence.

## Implemented evidence

- Product persistence RED:
  `/private/tmp/hu080-product-red.szcOpb/result.xcresult`, build failure only
  because `FirestoreProductRepository.productForPersistence` did not exist.
- Product persistence GREEN:
  `/private/tmp/hu080-product-green.1ut1pT/result.xcresult`, 1/1 logical, zero
  failed/skipped/build errors/warnings.
- Product and Firestore payload cohort:
  `/private/tmp/hu080-product-cohort.EXSWk0/result.xcresult`, 38/38 logical,
  zero failed/skipped/build errors/warnings.
- Orders configured-weekday RED:
  `/private/tmp/hu080-orders-window-red-valid.tnrMMj/result.xcresult`, 1/1
  logical failed because Thursday was outside the consultation phase when the
  configured delivery weekday was Friday.
- Orders configured-weekday focused GREEN:
  `/private/tmp/hu080-orders-window-green.zK8cEZ/result.xcresult`, 1/1 logical,
  zero failed/skipped.
- Orders/Home cut cohort, including the explicit Received Orders
  consumer regression:
  `/private/tmp/hu080-orders-cohort-authority.xYL7Wc/result.xcresult`, 103/103
  logical, zero failed/skipped. This historical authority also characterizes
  the actual `nil` configuration fallback to Wednesday and is superseded by the
  final canonical unit result.
- Home persistence-boundary structural RED:
  `/private/tmp/hu080-home-boundary-red.izfD7U/result.xcresult`, 1/1 logical
  failed on the five legacy boundary expectations before production changed.
- Home local-state Domain contract RED:
  `/private/tmp/hu080-home-usecase-red.bcp4c0/result.xcresult`, build failure
  only because the typed scope and use case did not yet exist.
- Initial Home local-state GREEN, superseded after review hardening:
  `/private/tmp/hu080-home-focused-green.mpuFQF/result.xcresult`, 6/6 logical,
  and `/private/tmp/hu080-home-cohort-green.MgHpKR/result.xcresult`, 74/74.
- Home local-state focused GREEN after graph-identity, cancellation, and
  session-revision coverage:
  `/private/tmp/hu080-home-focused-green-final.1fcQGA/result.xcresult`, 7/7
  logical, zero failed/skipped.
- Home/Orders/Data/composition cut cohort:
  `/private/tmp/hu080-orders-home-boundaries-cohort.G0yv7F/result.xcresult`,
  93/93 logical, zero failed/skipped.
- Initial Received Orders parser boundary RED/GREEN:
  `/private/tmp/hu080-received-parser-red.xiUDcw/result.xcresult` failed only
  the Data/Presentation ownership guard;
  `/private/tmp/hu080-received-parser-green.IYOP5J/result.xcresult` passed 3/3.
- Initial status-write error boundary RED/GREEN: the RED runner exposed a foreign
  code-7 error misclassified as Firestore permission and the legacy layer
  ownership;
  `/private/tmp/hu080-status-write-green.Q08hOf/result.xcresult` passed 3/3.
- Orders Data-boundary cut after independent-review hardening:
  `/private/tmp/hu080-order-boundaries-final.xcresult`, 8/8 logical with zero
  failed/skipped. It scans the complete Domain/Data Orders directories, covers
  both cancellation forms, and includes the existing weighted-line consumer.

### Products ownership chronology

- Direct draft mutation RED:
  `/private/tmp/hu080-products-direct-draft-red-suite.xcresult`, 0/1 passed. A
  suspended save still owned a directly replaced draft and closed the newer
  editor. GREEN: `/private/tmp/hu080-products-direct-draft-green-2.xcresult`,
  1/1 passed.
- Upload-owner RED:
  `/private/tmp/hu080-products-upload-owner-red-2.xcresult`, 1/2 logical
  responsibilities passed; editor/session/environment invalidation did not
  physically cancel and release the upload owner.
- Archive-owner RED:
  `/private/tmp/hu080-products-archive-red-3.xcresult`, 2/3 logical passed; a
  late archive closed the successor editor.
- Initial ownership GREEN:
  `/private/tmp/hu080-products-mutation-green.xcresult`, 3/3 logical and 5/5
  expanded passed. The later visibility characterization passed 5/5 logical and
  7/7 expanded in
  `/private/tmp/hu080-products-visibility-characterization.xcresult`.
- Provisional Products cohort, superseding those focused runs at that point:
  `/private/tmp/hu080-products-final.KphCDD/result.xcresult`, 62/62 logical and
  64/64 concrete, with zero failures or skips. Final session-owner review later
  superseded it.

Every draft assignment now advances the editor revision. Image upload has one
retained cancellable owner across editor, identity, and environment changes.
Archive clears only the exact captured editor, while visibility preserves its
session/environment/revision fence and owner-only cleanup.

Final session-owner review added an explicit Products epoch and synchronized
session revision. An unsynchronized shared revision cannot start reads,
uploads, saves, archive, or visibility writes; relogin, member/environment
change, or access demotion invalidates the prior catalog/editor owner before
adoption. The final RED
`/private/tmp/hu080-products-demotion-owner-red-2.xcresult` ran 8 logical
responsibilities: 7 passed and the demotion case failed because the previous
epoch survived. The focused GREEN
`/private/tmp/hu080-products-session-owner-green-final.xcresult` passes 15/15
logical and 18/18 concrete executions. An intermediate affected cohort then
ran 69 logical responsibilities: 68 passed and one failed in
`/private/tmp/hu080-products-cohort-post-owner-final.xcresult`, exposing the
remaining authenticated-member demotion retry path. Final Products authority
is `/private/tmp/hu080-products-cohort-authority-final.xcresult`, 70/70 logical
and 73/73 concrete, with no failures or skips. It supersedes every earlier
Products focused and cohort result.

### Home entry, Freshness completion, and cart persistence chronology

- The first lint/setup run
  `/private/tmp/hu080-home-freshness-cart-red.Gf27aw/result.xcresult` and the
  subsequent `red2.ksfbMy`/`red3.ODxrtV` compile probes are superseded and are
  not behavioral evidence.
- Valid architectural RED:
  `/private/tmp/hu080-home-freshness-cart-red4.Z6VSBE/result.xcresult`, a build
  failure because the retained cart owner and Freshness waiter seams did not
  exist. Initial GREEN:
  `/private/tmp/hu080-home-freshness-cart-green.aHmxeY/result.xcresult`, 6/6.
- Independent-review RED:
  `/private/tmp/hu080-freshness-entry-red-valid.qblX4O/result.xcresult`, 3/5
  passed. A pre-cancelled caller still started refresh and a queued waiter could
  register after a successor invalidated its generation. Hardened GREEN:
  `/private/tmp/hu080-freshness-entry-green.T2A6fF/result.xcresult`, 5/5.
- Provisional Home/Freshness/Orders cohort, superseding all earlier 74/74,
  93/93, 103/103, and focused runs at that point:
  `/private/tmp/hu080-home-freshness-orders-final.Dj9hbF/result.xcresult`,
  136/136 logical and concrete, with zero failures or skips. Final review later
  invalidated it as a closure authority.

Root retains one immutable My Order entry intent. Freshness waiters are bound to
an exact generation and authorization identity and resolve on ready, timeout,
invalidation, caller cancellation, or stale registration without taking
ownership of the shared refresh. Cart persistence uses one serial retained
worker, coalesces pending requests to the latest snapshot, and waits for a
cancelled non-cooperative owner before starting a valid successor.

### Final-review and post-parser hardening chronology

The provisional 62/64 Products and 136/136 Home/Freshness/Orders cohorts were
not retained as closure authorities after independent review found the
following executable gaps:

- Home configured weekday RED:
  `/private/tmp/hu080-home-friday-red.A7x2P9/result.xcresult`, 10/11 passed.
  Home still used Wednesday for a configured Friday. Focused GREEN:
  `/private/tmp/hu080-home-friday-green.B4n8Q2/result.xcresult`, 11/11.
- Madrid calendar probes: the first timezone run
  `/private/tmp/hu080-home-timezone-red.C9m4L6/result.xcresult` was a zero-test
  compile RED and is not behavioral evidence. Valid Shift week-key RED:
  `/private/tmp/hu080-shift-week-authority-red.xcresult`, 3/4 passed. Valid
  producer-parity RED:
  `/private/tmp/hu080-producer-parity-red-2.xcresult`, 4/5 passed. The shared
  Orders/Home/Shift-week/parity contract later passed 36/36 in
  `/private/tmp/hu080-calendar-session-green-retry.xcresult`.
- Received Orders scalar RED:
  `/private/tmp/hu080-received-parser-scalar-red.xcresult`, 3/5 passed. It
  exposed Boolean/non-finite monetary acceptance, negative-total acceptance,
  and invalid per-unit-measure handling.
- Negative-price post-parser RED:
  `/private/tmp/hu080-received-parser-negative-price-red.xcresult`, 6 logical =
  5 passed + 1 failed and 12 concrete = 10 passed + 2 failed. A negative
  `priceAtOrder` still survived when an explicit subtotal was positive. GREEN:
  `/private/tmp/hu080-received-parser-negative-price-green-final.xcresult`, 6/6
  logical and 12/12 concrete, with no build issue.
- Freshness revision-handoff RED:
  `/private/tmp/hu080-freshness-revision-handoff-red.xcresult`, 2/3 passed. A
  benign Products application advanced the shared revision but could not be
  acknowledged by the entry owner. The final contract recognizes only the
  exact live revision returned by the Products receipt; a generic current
  predicate is insufficient.
- Home immutable-entry REDs:
  `/private/tmp/hu080-home-entry-context-red-valid.xcresult`, 1/2 passed;
  `/private/tmp/hu080-home-revision-handoff-red-2.xcresult`, 2/3; and
  `/private/tmp/hu080-home-onchange-red.xcresult`, 2/4. Root now captures the
  revision in the intent, preserves only an explicitly acknowledged benign
  handoff, and prevents `onChange` from cancelling or duplicating its refresh.
- Home pre-read REDs:
  `/private/tmp/hu080-home-state-owner-red.xcresult` and
  `/private/tmp/hu080-home-state-pre-read-red.xcresult`, each 4/5 passed. The
  stale scope is now rejected for cancellation, active authorization, and exact
  current scope before generation mutation or local-store I/O.
- Products session-owner RED progression:
  `/private/tmp/hu080-products-unsynchronized-save-red.xcresult`, 5/6 passed;
  `/private/tmp/hu080-products-session-owner-red-final.xcresult`, 5/7; and the
  final demotion RED described above, 7/8. Only the last is the final RED
  authority; earlier ones remain chronology.

Post-review GREEN evidence is 41/41 in
`/private/tmp/hu080-final-contracts-post-review.xcresult` and 147/147 in the
last dedicated affected cohort
`/private/tmp/hu080-home-freshness-orders-cohort-final.xcresult`. Those focused
results are themselves superseded for closure by the canonical `fast-unit` and
`release-gate` artifacts below.

### Previews and UI chronology

- Initial gallery RED:
  `/private/tmp/hu080-galleries-failure-red.mfmC7h/result.xcresult`, 13/15
  passed; Products and Received Orders failure scenarios were missing. Initial
  GREEN:
  `/private/tmp/hu080-galleries-failure-green-retry.NOyZJc/result.xcresult`,
  15/15.
- Review-contract RED:
  `/private/tmp/hu080-preview-contracts-red.zsvfQ7/result.xcresult`, 11/16
  passed. Galleries lacked the shared modifier/fixed trait contract, Received
  Orders lacked a 600-point XXX Large case, and runtime/retry assertions were
  incomplete. GREEN:
  `/private/tmp/hu080-preview-contracts-green.XuFnL2/result.xcresult`, 16/16.
- Frozen Freshness/previews authority:
  `/private/tmp/hu080-freshness-previews-post-review.hVomdC/result.xcresult`,
  21/21 passed across both galleries and Freshness entry completion.
- The Product edit UI characterization passed 1/1 initially and again after
  final review. Closure authority is
  `/private/tmp/hu080-product-ui-post-review.6qV9mC/result.xcresult`, 1/1.

The Operations gallery materializes Freshness idle, checking, ready, timed-out,
and unavailable states, plus Received Orders real failure/retry at compact AX5
and a 600-point XXX Large state. The Community gallery renders Products failure
through the real route and deterministic global feedback. Every gallery
declaration combines the shared design-system modifier and fixed canvas. The UI
journey signs in with the producer mock, edits `Tomatoes` to
`Tomatoes updated`, saves, and verifies one updated row after editor dismissal.

### Pre-manual closure gates and inventory

- Products affected cohort:
  `/private/tmp/hu080-products-cohort-authority-final.xcresult`, 70/70 logical
  and 73/73 concrete, all passed.
- Pre-hardening canonical results, superseded by the negative-price parser
  follow-up: `/private/tmp/hu080-fast-unit-canonical-authority-final.xcresult`
  passed 774 logical/965 concrete,
  `/private/tmp/hu080-ui-smoke-canonical-authority-final.xcresult` passed 4/4,
  and `/private/tmp/hu080-release-gate-canonical-authority-final.xcresult`
  recorded 786 logical/980 concrete. They remain chronology, not closure
  authorities.
- The first post-parser full unit result
  `/private/tmp/hu080-fast-unit-canonical-post-parser-red.xcresult` passed
  774/775 logical and 965/966 concrete before one inherited silent
  `waitForCondition` timeout in Shifts. The focal
  `/private/tmp/hu080-shifts-focal-diagnosis.xcresult` passed 6/6; the complete
  rerun passed without a code change. This diagnostic is superseded and is not
  an HU-080 residual.
- Pre-manual canonical `fast-unit`:
  `/private/tmp/hu080-fast-unit-canonical-post-parser-green-final.xcresult`,
  775/775 logical and 966/966 concrete, all passed.
- Pre-manual canonical `ui-smoke`:
  `/private/tmp/hu080-ui-smoke-canonical-post-parser-final.xcresult`, 4/4
  passed.
- Pre-manual canonical `release-gate`:
  `/private/tmp/hu080-release-gate-canonical-post-parser-final.xcresult`, 787
  logical = 786 passed + one known
  `ReguertaUITestsLaunchTests/testLaunch` skip; 981 concrete = 977 passed + four
  launch-test variants skipped. The skip is inherited historical launch-suite
  debt: its screenshot assertion is flaky across parallel simulator clones and
  dedicated UI journeys cover launch behavior. It is not a HU-080 failure.
  There are zero test failures; build diagnostics are 0 errors / 0 warnings /
  0 analyzer warnings.
- Post-manual Home accessibility RED:
  `/private/tmp/hu080-home-physical-ax-red.cOf9t4/result.xcresult`, 17/22 passed
  and the five expected failures proved route-scroll and range-format gaps.
- Post-manual Home accessibility GREEN:
  `/private/tmp/hu080-home-physical-ax-green.wi7eA3/result.xcresult`, 22/22
  passed; the expanded preview/layout cohort
  `/private/tmp/hu080-home-ax5-preview-green.Lg0fJ4/result.xcresult` passed
  31/31.
- Post-retest focus contract RED:
  `/private/tmp/hu080-home-focus-red.uRmJfM/result.xcresult`, a valid compile
  failure only because `HomeDashboardInitialVoiceOverFocusGate` did not yet
  exist. The first implementation run at
  `/private/tmp/hu080-home-focus-green.gkISmX/result.xcresult` is chronology,
  not GREEN authority: the Swift Testing assertion captured a mutating call
  through an immutable macro value. The test was corrected without a
  production-code change.
- Post-focus GREEN:
  `/private/tmp/hu080-home-focus-green.9pdW4k/result.xcresult` passed 4/4 and
  `/private/tmp/hu080-home-focus-adaptive-green.OYM6JZ/result.xcresult` passed
  the 10/10 adaptive Home cohort.
- Current canonical `fast-unit`:
  `/private/tmp/hu080-home-focus-fast-unit.TKuQQL/result.xcresult`, 779/779
  logical and 970/970 concrete, all passed.
- Post-focus focused Home overflow UI and canonical `ui-smoke`:
  `/private/tmp/hu080-home-focus-overflow-ui.M2PBV7/result.xcresult` passed 1/1
  and `/private/tmp/hu080-home-focus-ui-smoke.XYWewg/result.xcresult` passed
  4/4.
- The first frozen-tree release gate at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.PYUaRiqVbc/result.xcresult`
  exposed two UI navigation failures: 791 logical = 788 passed + two failed +
  one inherited launch skip, and 985 concrete = 979 passed + two failed + four
  launch variants skipped. The final navigation focal at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-ui-navigation-final.4Ccw8lVx2O/result.xcresult`
  passed 3/3 after making the Home, drawer, and Product-editor scroll targets
  explicit.
- Definitive frozen-tree `release-gate`:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.v2ErAd7VtU/result.xcresult`,
  791 logical = 790 passed + one inherited launch skip + zero failed, and 985
  concrete = 981 passed + four launch variants skipped + zero failed. Test
  build results succeeded with zero errors and zero warnings.
- Final local hygiene passes: SwiftLint 0/437, all 6/6 effective settings,
  Debug, Production Release, and the forbidden-escape guard. `project.pbxproj`,
  package lockfiles, staging, and forbidden-escape additions have zero diff;
  `git diff --check` is clean.
- At the pre-focus cut, SwiftLint passed with 0 violations in 435 files. The six
  effective settings, Debug, Production Release, boundary/forbidden-escape
  guards, package lockfiles, and scope passed; `project.pbxproj` and
  `git diff --check` are also clean after the focus cut.
- Pre-manual frozen Swift inventory: Production 283 files/40,787 lines; unit tests 150/
  35,214; UI tests 2/524; total 435 files/76,525 lines. This is a net +22 files
  and +3,501 lines from activation. Swift Testing has 769 declarations,
  combined with six XCTest unit methods for 775 logical unit responsibilities;
  UI XCTest has 12 methods. The post-parser cut added one `@Test` and nine unit
  lines to the preceding frozen inventory.
- Final frozen Swift inventory: Production 283 files/40,888 lines; unit tests
  151/35,290; UI tests 3/535; total 437 files/76,713 lines. This is a net +24
  files and +3,689 lines from the 413-file/73,024-line activation baseline. The
  definitive release gate establishes 791 logical responsibilities and 985
  concrete executions.

### Rendered evidence and explicit residuals

Xcode `RenderPreview` artifacts are:

- Received Orders wide:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121921Z@3x.png`.
- Received Orders failure/retry:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121932Z@3x.png`.
- Pre-manual Home checking at compact AX5:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121941Z@3x.png`.
- Post-manual Home checking at compact AX5, Reduce Motion, and Increased
  Contrast with three deterministic news items:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-22T214359Z@3x.png`.
- Products failure:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T122005Z@3x.png`.

The 2026-08-22 iPhone 11 / iOS 26.6 pass reclassified the compact-AX5 overlap as a
functional accessibility defect because Home could not scroll to Latest News.
Home now owns one route scroll, its cells grow intrinsically, each weekly cell
is one VoiceOver element, and the localized week range has explicit spoken
semantics. The 2026-08-23 physical retest accepts the cell grouping, range
speech, and near-maximum Dynamic Type behavior, but reproduced the original
first-news initial focus. Home now owns a one-shot
`@AccessibilityFocusState(for: .voiceOver)` gate targeting the existing weekly
summary heading. It consumes only when VoiceOver is enabled and the target is
mounted, survives asynchronous refreshes without refocusing, and resets with a
new dashboard route. Independent post-focus review reports no P0-P3 finding.

The manual pass already confirms summary, My Order, Received Orders, Product
editing/image/value persistence, weight defaults/existing values, cart,
history, drawer routes, Voice Control, Reduce Motion, Increased Contrast, and
the unaffected large-text routes. Grouped Home traversal, localized interval
speech, and near-maximum Dynamic Type through the final news item are also
accepted. The final 2026-08-23 retest also accepts the one-shot focus behavior:
initial weekly-summary focus, no refocus during asynchronous refresh, and a new
one-shot request after route re-entry all pass. Offline My Order correctly stays
fail-closed while other routes remain available; replacing the accessible
bottom connectivity feedback with a Reguerta dialog is explicitly deferred UX
work.

The two local Product editor component canvases remain documented direct-
`ReguertaTheme` debt because the full editor route is covered by the shared
Community gallery. Android parity, HU-070/#198 live rollout, and later Phase 6
verticals remain residuals.
HU-080 uses one `Europe/Madrid` authority only for the Orders/Home/Shift-week/
producer-parity seams in this slice. RNF-02 debt inherited by Settings/Shifts
and other verticals remains outside scope; no global Madrid-timezone closure is
claimed. Final independent review reports no P0-P3 finding in the changed
surface.

The mapping now assigns the document ID while preserving every product field,
including the exact weight step and bounds. No live Firebase operation ran.
The consultation-window resolver now applies weekly override, configured
weekday, and Wednesday fallback in that order for My Order, Received Orders,
and Home. No live Firebase operation ran for this cut either.
Home now resolves confirmed, draft, or empty local state through the one
Orders-injected cart-store graph. Exact member/week/environment/session scope,
generation, cancellation, and route fences prevent stale reads from touching
storage or publishing. Freshness and Products exchange an explicit
revision-qualified receipt, while Products invalidates its previous epoch
before adopting an unsynchronized revision or demotion.
Received Orders parsing now belongs to Data, while Domain owns only the typed
status-write result and no longer interprets `NSError` or Firestore codes; its
scalar mapper also rejects Boolean/non-finite monetary values, negative prices
or totals, and normalizes bad measure quantities safely.

## Delivery state

HU-080 is active and remains in progress solely because Git delivery has not
been authorized. The post-manual implementation, physical acceptance,
post-focus cohorts, canonical `fast-unit`, focused navigation UI, `ui-smoke`,
definitive frozen-tree `release-gate`, rendered preview, SwiftLint, settings,
Debug and Production Release builds, closure guards, final inventory, and
five-artifact reconciliation are complete and green.
Issue #262 and the local branch exist. No commit, push, PR, merge, issue
closure, live mutation, or deployment is authorized or claimed.
