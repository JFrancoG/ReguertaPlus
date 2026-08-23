# HU-080 implementation plan

## State

- status: in_progress
- plan_state: approved
- issue: #262
- branch: `codex/hu-080-ios-products-orders-home-freshness`

## Delivery principles

1. Fix a demonstrated behavior or boundary, not a line-count target.
2. Capture a focused RED before each risk-bearing production change.
3. Preserve session/environment authorization, revisions, freshness ACK,
   latest-wins, and owner-only cleanup.
4. Move policy inward toward Domain and infrastructure outward toward Data/App.
5. Keep each cut independently reviewable and return to a green affected
   cohort before starting the next one.
6. Do not mutate live Firebase or broaden to later Phase 6 verticals.

## Phase 0 - Activation and baseline

- Create issue #262 and branch from post-HU-079 `main`.
- Freeze the 73-file primary/composition surface, counts, owners, dependencies,
  tests, previews, UI journeys, and inherited contracts.
- Record functional defects separately from structural debt.

Exit: issue, branch, spec, plan, tasks, baseline, and issue mirror agree.

## Phase 1 - Product persistence integrity

RED:

- Add `ProductPersistenceMappingTests` against the pure persisted-ID mapping.
- A weight-priced product must retain the new ID and the exact `weightStep`,
  `minWeight`, and `maxWeight` values.
- The generated Firestore payload must contain those values rather than delete
  sentinels.

GREEN:

- Make the existing mapping a narrow internal static seam.
- Copy every product field, including the three weight attributes.
- Do not construct Firebase, use live data, or change the schema.

Gate:

```sh
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta \
  -configuration Debug -testPlan fast-unit-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:ReguertaTests/ProductPersistenceMappingTests test
```

Then run the existing product/payload cohort.

## Phase 2 - Orders delivery-window policy

RED:

- Characterize override > configured delivery weekday > Wednesday fallback.
- Include a non-Wednesday configured day through both My Order and the shared
  Received Orders policy path.

GREEN:

- Resolve the delivery offset from the supplied configuration.
- Remove or justify any still-unused `shifts` input without changing policy by
  accident.

Gate: `ReguertaOrdersViewModelTests` plus affected Home/Orders suites.

## Phase 3 - Home cart-state boundary

RED:

- Structural guard: Presentation/Home contains no `UserDefaults` and no private
  persisted cart-key construction.
- Behavioral contract: confirmed > injected cart > empty, isolated by member,
  order week, and environment.

GREEN:

- Expose the narrow capability/value from Orders Domain/Data composition.
- Inject it through App/Root and keep Home deterministic in previews/tests.
- Remove duplicated storage keys from Presentation.

Gate: new Home/Orders ownership suite plus Home summary and composition guards.

Status: complete. Home now consumes `ResolveMyOrderLocalStateUseCase` from the
same injected cart-store instance used by Orders. Scope and generation fences
prevent a late member/week/environment/session read or dashboard exit from
publishing. The initial focused 6/6 and cohort 74/74 were superseded after
hardening graph identity, cancellation cleanup, and the session-revision
regression. The focused 7/7 and affected 93/93 results were cut authorities and
are superseded by the final canonical gates.

## Phase 4 - Operation owners and layer cleanup

- Audit catalog load, ordering refresh, image upload/save/archive, My Order,
  checkout, histories, received status, Home summary, and Freshness tasks.
- Add retained handles only where physical cancellation is a real contract;
  retain generation/revision fences even when a provider ignores cancellation.
- Move Received Orders parsing out of Presentation and map infrastructure error
  semantics out of Domain behind characterized contracts.
- Simplify dependency bundles and Views only at demonstrated cohesive seams.
- Add selective DocC for ordering, cancellation, owner-only cleanup, and
  persistence contracts that are not evident from implementation.

Exit: independent architecture/concurrency review has no P0-P3 findings.

Status: implemented and validated. The Received Orders parser now belongs to
Data and the status-write translator maps infrastructure errors in Data before
returning the typed Domain result. The initial focused suites passed 3/3;
independent-review hardening expanded the boundary scan, characterized both
cancellation forms, and retained the legacy weighted consumer. Later scalar
review rejects Boolean/non-finite monetary values and negative totals and
normalizes an invalid per-unit measure to one. A final post-parser RED then
proved that a negative unit price survived beside a positive explicit subtotal:
`/private/tmp/hu080-received-parser-negative-price-red.xcresult` ran 6 logical
= 5 passed + 1 failed and 12 concrete = 10 passed + 2 failed. The GREEN
`/private/tmp/hu080-received-parser-negative-price-green-final.xcresult` passes
6/6 logical and 12/12 concrete with a clean build. The early 8/8 Data-boundary
cut is superseded by the final affected and canonical unit cohorts.

Products now treats every draft assignment as an editor revision, retains and
cancels image-upload ownership across editor/session/environment invalidation,
and fences archive/visibility completion to the exact captured editor and
session context. The valid RED progression was 0/1, 1/2, and 2/3 passing; the
initial mutation GREEN was 3/3 logical and five concrete, and the visibility
characterization was 5/5 logical and seven concrete. The then-provisional 62
logical/64 concrete cohort was superseded by final session-owner review.
Unsynchronized shared revisions now fail closed before any Products read,
upload, or write operation; local draft/editor mutations remain allowed;
member/environment/relogin or access-demotion adoption revokes the prior epoch,
catalog, editor, upload, and mutation owners. The final demotion RED passed 7/8
because the epoch was not invalidated; focused GREEN passes 15 logical/18
concrete and closure authority is
`/private/tmp/hu080-products-cohort-authority-final.xcresult`, 70 logical/73
concrete, all passed.

Root now retains one immutable Home My Order entry intent. Freshness uses
generation-and-identity-bound waiters that resolve on readiness, timeout,
invalidation, caller cancellation, or stale registration. Cart persistence has
one serial retained worker that coalesces to the latest pending snapshot and
holds a non-cooperative cancelled owner as a successor barrier. The first 6/6
GREEN was superseded when review exposed two races in a valid 3/5 RED;
hardening passed 5/5. Final review then added exact captured-entry context,
explicit Freshness-to-Products revision acknowledgement, root `onChange`
preservation for only that benign handoff, active-authorization and current-scope
guards before any Home generation/read, and a shared Madrid calendar for the
Orders/Home/Shift-week/producer-parity seams. It also fixed Home's ignored
configured weekday. The post-review contract cohort passes 41/41 and the last
dedicated Home/Freshness/Orders cohort passes 147/147; both are superseded as
closure authorities by canonical `fast-unit`. Selective DocC records the
delivery-window, persisted-product, typed local-state, Freshness waiter/entry,
revision acknowledgement, status translation, cart-worker, and Products
session-owner contracts. Independent architecture/concurrency review reports
no remaining P0-P3 finding.

## Phase 5 - UI, previews, accessibility, and motion

- Add deterministic Freshness state previews for idle, checking, ready,
  timedOut, and unavailable where the state changes the Home/My Order contract.
- Add the missing failure/error scenarios for Products and Orders without
  duplicating global feedback state.
- Normalize the two local Product editor previews to the approved preview
  environment or document why a direct component canvas is more exact.
- Add focused UI evidence only for critical user behavior not proven below UI:
  product save/edit, Received Orders status/history, checkout/read-only, and
  freshness revalidation as selected by risk.
- Review localization, VoiceOver, Dynamic Type, Increased Contrast, Reduce
  Motion, safe areas, phone/iPad, and ES/EN light/dark.

Exit: independent SwiftUI/accessibility review has no P0-P3 findings and manual
residuals are explicit.

Status: implemented and validated for automated/rendered scope. The Operations
gallery now materializes Freshness idle, checking, ready, timed-out, and
unavailable states; Received Orders has a real failure/retry scenario at
compact AX5 plus a 600-point XXX Large scenario. The Community gallery adds a
real Products failure/global-feedback scenario. Every gallery preview combines
the shared design-system modifier and fixed canvas. Initial preview evidence
moved from 13/15 RED to 15/15 GREEN; review contracts moved from 11/16 RED to
16/16 GREEN. Final post-review authority is
`/private/tmp/hu080-freshness-previews-post-review.hVomdC/result.xcresult`,
21/21 passed.

The selected UI risk is Product editing. Its deterministic producer-mock
journey changes `Tomatoes` to `Tomatoes updated`, saves, closes the editor, and
verifies one updated list row. Final authority is
`/private/tmp/hu080-product-ui-post-review.6qV9mC/result.xcresult`, 1/1 passed.

Xcode `RenderPreview` covered Received Orders wide and failure, Home checking at
compact AX5, and Products failure. The 2026-08-22 iPhone 11 / iOS 26.6 pass proved that
the apparent compact-AX5 overlap was functional because Home could not scroll
to Latest News, so it was remediated with one route-owned scroll, intrinsic
cell growth, semantic cell grouping, and localized week-range speech. The
post-fix AX5/Reduce Motion/Increased Contrast render with three deterministic
news items is
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-22T214359Z@3x.png`.
The two direct local Product editor component canvases remain under
`ReguertaTheme`; because the full editor route is covered by the shared
Community gallery, their normalization/split is documented debt instead of an
HU-080 source change. Independent SwiftUI/accessibility review reports no
remaining P0-P3 finding in the changed surface.

The initial HU-080 physical pass confirms functional flows, Voice Control,
Reduce Motion, Increased Contrast, and the unaffected large-text routes. Its
VoiceOver Home focus/cell/range and AX5 scroll findings drove the remediation.
The 2026-08-23 iPhone 11 / iOS 26.6 retest accepts grouped weekly-cell traversal,
localized range speech, and near-maximum Dynamic Type through the final news
item. It still reproduced the first-news initial focus, so Home now owns a
one-shot VoiceOver focus gate on the weekly-summary heading. The gate survives
refreshes without stealing focus and resets with a newly created dashboard
route. The final 2026-08-23 post-focus pass accepts initial weekly-summary
focus, no focus theft during refresh, and one new focus after leaving and
re-entering Home; physical HU-080 acceptance is complete. The offline bottom
feedback remains usable but visually rough; a Reguerta dialog or banner redesign
is deferred rather than mixed into this fix.

## Phase 6 - Closure gates and delivery handoff

- Run affected focal cohorts after every cut.
- Run canonical `fast-unit`.
- Run focused UI and `ui-smoke` when navigation/UI behavior changes.
- Run `release-gate` only on the frozen final tree.
- Verify SwiftLint, 6/6 effective settings, Debug, Production Release,
  forbidden escapes, boundary guards, scope, package lockfiles,
  `project.pbxproj`, and `git diff --check`.
- Reconcile baseline/spec/plan/tasks/issue mirror with exact `.xcresult` counts.
- Record Android parity and HU-070/#198 as residuals.

Status: local implementation and validation are complete on the final frozen
tree. The story remains `in_progress` solely because commit, push, PR, merge,
and issue closure have not been authorized.

- Products: 70 logical/73 concrete, all passed.
- Last dedicated Home/Freshness/Orders cohort: 147/147 passed.
- Freshness/previews post-review: 21/21 passed.
- Product edit UI: 1/1 passed.
- The earlier fast-unit
  `/private/tmp/hu080-fast-unit-canonical-authority-final.xcresult`, ui-smoke
  `/private/tmp/hu080-ui-smoke-canonical-authority-final.xcresult`, and release
  `/private/tmp/hu080-release-gate-canonical-authority-final.xcresult` bundles
  recorded 774 logical/965 concrete, 4/4, and 786 logical/980 concrete
  respectively, but predate the final negative-price parser hardening and are
  superseded for closure.
- The first post-parser full unit run
  `/private/tmp/hu080-fast-unit-canonical-post-parser-red.xcresult` passed
  774/775 logical and 965/966 concrete before an inherited silent
  `waitForCondition` timeout in Shifts. The focal diagnosis
  `/private/tmp/hu080-shifts-focal-diagnosis.xcresult` passed 6/6 and the full
  rerun passed without a code change; this diagnostic result is superseded and
  is not an HU-080 residual.
- Pre-manual canonical `fast-unit`:
  `/private/tmp/hu080-fast-unit-canonical-post-parser-green-final.xcresult`,
  775/775 logical and 966/966 concrete, all passed.
- Pre-manual canonical `ui-smoke`:
  `/private/tmp/hu080-ui-smoke-canonical-post-parser-final.xcresult`, 4/4
  passed.
- Pre-manual canonical `release-gate`:
  `/private/tmp/hu080-release-gate-canonical-post-parser-final.xcresult`, 787
  logical = 786 passed + one known launch-test skip; 981 concrete = 977 passed
  + four launch-test variants skipped. The inherited screenshot launch test is
  flaky across parallel simulator clones; dedicated UI journeys cover launch.
  There are zero test failures; build diagnostics are 0 errors / 0 warnings /
  0 analyzer warnings.
- Post-manual RED/GREEN: the Home layout/range cohort moved from 17/22 with
  five expected failures at
  `/private/tmp/hu080-home-physical-ax-red.cOf9t4/result.xcresult` to 22/22 at
  `/private/tmp/hu080-home-physical-ax-green.wi7eA3/result.xcresult`; the final
  layout/preview cohort passed 31/31 at
  `/private/tmp/hu080-home-ax5-preview-green.Lg0fJ4/result.xcresult`.
- Post-retest focus TDD moved from the valid missing-seam compile RED at
  `/private/tmp/hu080-home-focus-red.uRmJfM/result.xcresult` to 4/4 GREEN at
  `/private/tmp/hu080-home-focus-green.9pdW4k/result.xcresult`; the adaptive
  Home cohort passed 10/10 at
  `/private/tmp/hu080-home-focus-adaptive-green.OYM6JZ/result.xcresult`. The
  first implementation attempt at
  `/private/tmp/hu080-home-focus-green.gkISmX/result.xcresult` is retained only
  as invalid test-macro chronology, not closure evidence.
- Current `fast-unit` passed 779/779 logical and 970/970 concrete at
  `/private/tmp/hu080-home-focus-fast-unit.TKuQQL/result.xcresult`; focused Home
  overflow passed 1/1 and `ui-smoke` passed 4/4 at
  `/private/tmp/hu080-home-focus-overflow-ui.M2PBV7/result.xcresult` and
  `/private/tmp/hu080-home-focus-ui-smoke.XYWewg/result.xcresult`.
- The first frozen-tree release gate at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.PYUaRiqVbc/result.xcresult`
  was a valid RED: 791 logical = 788 passed + two failed + one inherited launch
  skip, and 985 concrete = 979 passed + two failed + four launch variants
  skipped. It exposed a non-hittable My Order entry and an ambiguous Product-
  editor scroll that selected the hidden drawer. The final
  navigation focal at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-ui-navigation-final.4Ccw8lVx2O/result.xcresult`
  passed 3/3 after the Home, drawer, and Product-editor scroll targets were
  made explicit.
- Definitive frozen-tree `release-gate`:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.v2ErAd7VtU/result.xcresult`,
  791 logical = 790 passed + one inherited launch skip + zero failed, and 985
  concrete = 981 passed + four launch variants skipped + zero failed. Test
  build results succeeded with zero errors and zero warnings.
- Final closure hygiene passes: SwiftLint 0/437, all 6/6 effective settings,
  Debug, Production Release, and the forbidden-escape guard. `git diff --check`
  is clean; `project.pbxproj`, package lockfiles, staging, and forbidden-escape
  additions have zero diff. Independent review reports no P0-P3 finding.

The pre-manual frozen snapshot contains 283 production Swift files/40,787 lines,
150 unit-test files/35,214 lines, and two UI-test files/524 lines: 435 files and
76,525 lines in total. There are 769 Swift Testing declarations plus six XCTest
unit methods = 775 logical unit responsibilities; the 12 UI methods produce the 787
logical release inventory. The post-parser follow-up is one new `@Test` and
nine unit-test lines. The initial baseline and +22-file/+3,501-line frozen delta
remain in `phase-6-baseline.md`.

The intermediate post-focus snapshot contained 283 production Swift files/
40,887 lines, 151 unit-test files/35,290 lines, and two UI-test files/524 lines:
436 files and 76,701 lines in total, a +23-file/+3,677-line delta from
activation. It remains chronology rather than closure authority.

The final frozen inventory contains 283 production Swift files/40,888 lines,
151 unit-test files/35,290 lines, and three UI-test files/535 lines: 437 files
and 76,713 lines in total, a +24-file/+3,689-line delta from the activation
baseline of 413 files/73,024 lines. The definitive release gate establishes
791 logical responsibilities and 985 concrete executions.

The story remains `in_progress` solely because Git delivery is pending and not
authorized. All local implementation, physical acceptance, validation,
inventory, and five-artifact reconciliation work is complete.
Android parity, HU-070/#198 live work,
the deferred offline-feedback presentation polish, and later Phase 6 verticals
remain explicit residuals. HU-080 aligns only
its Orders/Home/Shift-week/producer-parity seams to `Europe/Madrid`; inherited
RNF-02 debt in Settings/Shifts and other verticals remains out of scope, so this
plan does not claim global timezone closure.
