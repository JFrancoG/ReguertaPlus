# HU-080 Phase 6 slice 2 baseline

Captured on 2026-08-21 from clean base
`5c511dda9aeb3dab182888733cf972847a91b97a`.

## Repository baseline

| Area | Swift files | Lines |
| --- | ---: | ---: |
| Production | 275 | 40,025 |
| Unit tests | 136 | 32,490 |
| UI tests | 2 | 509 |
| Total | 413 | 73,024 |

- Swift Testing declarations: 717.
- XCTest unit methods: 6.
- Canonical fast-unit logical responsibilities at the HU-080 activation base:
  723.
- XCTest UI methods: 11.
- Canonical release logical responsibilities at the HU-080 activation base:
  734.

These are activation counts, not completion claims. HU-080 records a final
delta after all source and test changes are frozen.

## Primary slice inventory

| Layer / feature | Files | Lines |
| --- | ---: | ---: |
| Domain / Products | 5 | 503 |
| Data / Products | 2 | 325 |
| Domain / Orders | 6 | 894 |
| Data / Orders | 8 | 1,712 |
| Domain / Freshness | 2 | 296 |
| Data / Freshness | 3 | 460 |
| Presentation / Products | 8 | 1,965 |
| Presentation / Orders | 24 | 4,532 |
| Presentation / Home | 9 | 2,577 |
| Presentation / Freshness | 2 | 507 |
| Primary total | 69 | 13,771 |

Composition seams add four files and 275 lines:

- `App/ProductsFeatureDependencies.swift` - 96.
- `App/OrdersFeatureDependencies.swift` - 32.
- `App/MyOrderFreshnessFeatureDependencies.swift` - 103.
- `Presentation/Root/AccessRootViewModel+OrdersFactory.swift` - 44.

Shared seams inspected but not owned wholesale by this story are
`Presentation/Root/AccessRootViewModel.swift` (489) and
`App/ReguertaAppEnvironment.swift` (411).

The selected Presentation surface contains 43 files and 9,581 lines; 23 files
are at least 200 lines. File length is a review signal only.

## Initial owners and dependencies

| Surface | Current owner / contract | Activation note |
| --- | --- | --- |
| Product catalog/editor | `ProductsRouteViewModel` plus extensions | `@MainActor`; catalog and ordering generations, editor revision, image upload, highlight task, nine collaborators; no synchronized shared-session epoch |
| My Order | `MyOrderRouteViewModel` | context/session revisions plus previous-order, status and checkout generations |
| Received Orders | `ReceivedOrdersRouteViewModel` | context/session revisions, independent load/status generations and owned load handle |
| Critical freshness | `MyOrderFreshnessViewModel` | retained operation/timeout/retry tasks, generation, exact session/environment identity and consumer acknowledgement |
| Home | `ContentView` Home extensions and `HomeShellViewModel` | route orchestration and weekly summary consume session, Orders, Products, Shifts, Freshness and News state |
| Composition | App dependency bundles and Root factory | must remain the only construction boundary for live Data adapters |

## Source-backed activation defects

### P1 - product persistence drops weight configuration

`Data/Products/FirestoreProductRepository.swift` assigns a document ID by
building a second `Product`. That mapping copies the ordinary fields but omits
`weightStep`, `minWeight`, and `maxWeight`. `upsertPayload` then receives those
nil values and emits `FieldValue.delete()` for all three. The returned product
is also already corrupted.

Existing tests cover decoding and direct optional deletion but do not exercise
the ID-remapping step. First RED: a pure mapping regression for a weight-priced
product with a newly assigned ID, followed by payload preservation.

### P1 - configured delivery weekday is ignored

`Data/Orders/FirestoreMyOrderPreviousOrder.swift` accepts
`defaultDeliveryDayOfWeek` and `shifts` but, without an override, always resolves
Wednesday via `weekStart + 2`. `ReceivedOrdersRouteViewModel` reuses the same
policy. This contradicts the MVP/time-machine requirements for a configured
delivery day.

RED contract: override has priority; otherwise use configured weekday; when no
configuration exists preserve the historical Wednesday fallback.

### P2 - Home bypasses the injected cart-store boundary

`Presentation/Home/ContentView+HomeWeeklySummaryResolution.swift` imports and
reads `UserDefaults.standard` and duplicates private storage key formats from
`UserDefaultsMyOrderCartStore`. Orders composition already injects
`MyOrderCartStore`. A preview or test can therefore use an in-memory store while
Home reads unrelated process state.

RED contract: Presentation/Home contains no `UserDefaults` or private storage
key knowledge, and Home resolves confirmed > cart > empty through an injected
Domain/Orders capability or value.

### Boundary debt to sequence after the functional REDs

- `FirestoreReceivedOrdersData` calls a parser declared in Presentation.
- `ReceivedOrderStatusWriteResult` in Domain interprets infrastructure error
  code 7.
- Products catalog/ordering refresh uses generations but does not retain all
  launched tasks for physical cancellation.
- Home/Freshness/Products are coupled through Root closures; the exact
  acknowledgement and session revision must remain intact if dependencies are
  simplified.

## Test inventory

### Products primary

- `ReguertaProductQuantityOptionsTests` - 3 declarations.
- `ReguertaProductsViewModelTests` - 14.
- `P101ProductsFailureTests` - 14.
- `ProductsOrderingRefreshGenerationTests` - 7.
- `ProductsOrderingEquivalentMemberRefreshTests` - 1.

### Freshness primary

- `CriticalDataRefreshUseCaseTests` - 6.
- `CriticalDataFreshnessEnvironmentTests` - 7.
- `MyOrderFreshnessViewModelConcurrencyTests` - 9.
- `MyOrderFreshnessRefreshBarrierTests` - 8.
- `MyOrderFreshnessAuthorizationFenceTests` - 2.
- `MyOrderFreshnessAutomaticRetryTests` - 2.
- `InitialLoadRecoveryTests` - 4.
- `StartupAndFreshnessConfigurationDecodingTests` - 2, one Freshness case.

Products/Freshness also share generation, cleanup, delay-clock, and numeric
decoding suites. Mixed suites are not double-counted as a final story total.

### Orders primary and cross-feature

The main Orders selectors contain 99 declarations across ViewModel,
restoration, operation safety, histories, Home, startup, layout, same-context,
session-revision, cleanup, and authorization-entry suites. The largest relevant
selectors include:

- `ReguertaOrdersViewModelTests` - 21.
- `ReguertaOrderAndHomeTests` - 14.
- `ReguertaStartupAndOrderTests` - 11.
- `ReguertaOrdersSessionRevisionSafetyTests` - 6.
- Both Orders history suites - 6 each.
- `OrdersReadOwnerCleanupSafetyTests` - 7.

### Home

- `ReguertaHomeSummaryTests` - 10.
- `ReguertaHomeNavigationTests` - 1.
- `ReguertaOrderAndHomeTests` - 14 mixed Orders/Home declarations.
- Root/Home layout and operations-preview structural suites cover adaptive
  composition but do not replace behavior tests.

The five Freshness states already have a unit contract: only `.checking`
disables requesting entry, while navigation still requires revalidation to
reach `.ready`. The residual gap is preview/UI evidence, not another duplicate
unit assertion.

## Preview and UI baseline

- `AdaptiveOperationsRoutesPreview.swift` provides ten operations scenarios;
  seven belong to Home/Orders and cover 320/600/1024, ES/EN, light/dark,
  Large/XXX/AX5, Reduce Motion, and externally overridden Increased Contrast.
- `AdaptiveCommunityRoutesPreview.swift` provides full Products loading, empty,
  content, and editor scenarios at 320/600/820 with the corresponding matrix.
- Product editor also has two local subcomponent previews that do not use the
  shared scenario trait.
- Freshness has no dedicated idle/checking/ready/timedOut/unavailable preview;
  the Home scenario materializes ready only.
- Existing UI automation covers authorized Home action enablement, Home news
  bottom safety, My Order search bottom safety, and drawer navigation.
- No UI journey currently covers Products editing/archive, Received Orders
  status/history, checkout/read-only behavior, or Freshness failure/retry.

## Exact gate shape

Focused suites use:

```sh
cd ios/Reguerta
xcodebuild -project Reguerta.xcodeproj \
  -scheme Reguerta \
  -configuration Debug \
  -testPlan fast-unit-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:ReguertaTests/<SuiteName> \
  test
```

Closure uses the repository's canonical `fast-unit`, applicable focused UI,
`ui-smoke`, and `release-gate` runners. Every RED/GREEN records its exact
selector, destination, `.xcresult`, logical count, expanded count, failures,
skips, errors, and warnings.

## Initial residuals outside HU-080

- HU-070/#198 retains the live Firebase role rollout, backfills, canaries, and
  deploy/read-back validation.
- Android does not receive this iOS refactor in HU-080.
- Four later Phase 6 verticals plus Phases 7, 8, and 9 remain after this story.

## Implemented checkpoints

- Product persistence: GREEN 1/1 plus affected Data cohort 38/38.
- Orders configured delivery policy: cut authority 103/103, later included in
  the later affected cohorts and canonical unit gate.
- Home cart-store boundary: structural and Domain-contract REDs followed by
  initial GREEN 6/6 and cohort 74/74, then review hardening and final focused
  GREEN 7/7 plus Home/Orders/Data/composition cohort 93/93. Presentation/Home
  now contains no `UserDefaults`, private persisted-key construction, or direct
  storage-key helper use; these intermediate authorities are superseded for
  closure by the later affected cohorts and canonical unit gate.
- Received Orders parser ownership and status-error translation: both initial
  focused suites passed 3/3. After review hardening, the final Data-boundary
  cohort passes 8/8 in `/private/tmp/hu080-order-boundaries-final.xcresult`,
  including full-directory layer guards, both cancellation paths, and the
  existing weighted-line parser consumer. It is also included in the frozen
  final affected and canonical unit cohorts.

### Product operation ownership

- A direct draft mutation while save validation is suspended now advances the
  editor revision, so the late save cannot close or overwrite the newer draft.
- Image upload has one retained owner. Clearing the editor, signing out, or
  changing member/environment cancels and releases that owner, while an exact
  successor remains possible.
- A late archive result may update the catalog but closes the editor only when
  the captured product, pending ID, session context, and revision still own it.
- Catalog visibility preserves the existing session/environment/revision fence
  and owner-only cleanup.

The valid RED sequence was 0/1, then 1/2, then 2/3 passing in
`/private/tmp/hu080-products-direct-draft-red-suite.xcresult`,
`/private/tmp/hu080-products-upload-owner-red-2.xcresult`, and
`/private/tmp/hu080-products-archive-red-3.xcresult`. The first GREEN passed
3/3 logical responsibilities and five expanded executions in
`/private/tmp/hu080-products-mutation-green.xcresult`; the visibility
characterization then passed 5/5 logical and seven expanded in
`/private/tmp/hu080-products-visibility-characterization.xcresult`. Both are
included in the then-provisional
`/private/tmp/hu080-products-final.KphCDD/result.xcresult`, 62/62 logical and
64/64 concrete. Final review later superseded that cohort with explicit shared
session-revision and demotion ownership coverage.

### Home entry, Freshness completion, and cart persistence

- Root retains one immutable My Order entry intent and invalidates it on
  destination, authorization, or unacknowledged session-revision drift before
  navigation.
- Freshness entry callers wait on generation-and-identity-bound continuations.
  Timeout, invalidation, readiness, caller cancellation, and a queued stale
  registration all resolve in bounded time without cancelling a shared refresh
  that may still serve another caller.
- My Order cart persistence uses one serial retained worker, coalesces pending
  writes to the latest snapshot, and holds a cancelled non-cooperative owner as
  a barrier before starting a valid successor for the current storage/session
  context.

The first valid architectural RED was the compile failure in
`/private/tmp/hu080-home-freshness-cart-red4.Z6VSBE/result.xcresult`, where the
retained cart owner and freshness waiter seams did not exist. Earlier
`red.Gf27aw`, `red2.ksfbMy`, and `red3.ODxrtV` runs were setup/compile probes and
are superseded, not behavioral evidence. The initial GREEN passed 6/6 in
`/private/tmp/hu080-home-freshness-cart-green.aHmxeY/result.xcresult`.
Independent review then produced a valid 3/5 RED in
`/private/tmp/hu080-freshness-entry-red-valid.qblX4O/result.xcresult`: a
pre-cancelled entry still started refresh, and a waiter could register after
its generation had been superseded. The hardened GREEN passed 5/5 in
`/private/tmp/hu080-freshness-entry-green.T2A6fF/result.xcresult`. These focused
runs are superseded for closure by
`/private/tmp/hu080-home-freshness-orders-final.Dj9hbF/result.xcresult`, 136/136
logical and expanded executions. That result was provisional: final review
found additional calendar, scalar, handoff, authorization, and pre-read gaps.

### Preview and UI evidence

- Home has deterministic idle, checking, ready, timed-out, and unavailable
  Freshness scenarios. Products has a real-route failure/global-feedback
  scenario. Received Orders has a real inline failure/retry at compact AX5 and
  a separate 600-point XXX Large scenario.
- Every adaptive gallery declaration combines the shared design-system preview
  modifier with its fixed canvas. Scenario tests materialize runtime state and
  invoke the Received Orders retry against the deterministic failing repository.
- One risk-selected UI journey signs in with the producer mock, opens Products,
  edits `Tomatoes` to `Tomatoes updated`, saves, and verifies the single updated
  row after the editor closes.

The initial preview RED passed 13/15 and failed the two missing failure
scenarios in `/private/tmp/hu080-galleries-failure-red.mfmC7h/result.xcresult`;
its GREEN passed 15/15 in
`/private/tmp/hu080-galleries-failure-green-retry.NOyZJc/result.xcresult`.
Review contracts then produced an 11/16 RED in
`/private/tmp/hu080-preview-contracts-red.zsvfQ7/result.xcresult` and a 16/16
GREEN in `/private/tmp/hu080-preview-contracts-green.XuFnL2/result.xcresult`.
The frozen post-review authority combines both galleries and Freshness entry:
21/21 in `/private/tmp/hu080-freshness-previews-post-review.hVomdC/result.xcresult`.
The UI characterization passed initially and after final review; closure uses
the latter 1/1 result at
`/private/tmp/hu080-product-ui-post-review.6qV9mC/result.xcresult`.

## Final-review and post-parser hardening after the provisional gates

The first canonical gate exposed further slice-local contracts. Every RED below
ran before its production fix; invalid 0-test probes are named but not counted
as behavioral evidence.

- Home delivery policy: 10/11 passed in
  `/private/tmp/hu080-home-friday-red.A7x2P9/result.xcresult` because Home still
  ignored a configured Friday. The focused GREEN passed 11/11 in
  `/private/tmp/hu080-home-friday-green.B4n8Q2/result.xcresult` after Home and
  Orders shared the same override > configured weekday > Wednesday Domain
  policy.
- Madrid calendar seams: the first timezone probe
  `/private/tmp/hu080-home-timezone-red.C9m4L6/result.xcresult` did not compile
  and has zero logical evidence. Valid REDs then passed 3/4 for Shift week keys
  (`/private/tmp/hu080-shift-week-authority-red.xcresult`) and 4/5 for producer
  parity (`/private/tmp/hu080-producer-parity-red-2.xcresult`). The shared
  Orders/Home/Shift-week/parity calendar contracts later passed 36/36 in
  `/private/tmp/hu080-calendar-session-green-retry.xcresult`.
- Received Orders scalar safety: 3/5 passed in
  `/private/tmp/hu080-received-parser-scalar-red.xcresult`; Boolean/non-finite
  monetary scalars and negative totals were accepted, while invalid per-unit
  measure values were not normalized safely. That hardening rejected those
  values and normalized a valid line's bad measure quantity to one.
- Negative unit price follow-up: the post-parser RED
  `/private/tmp/hu080-received-parser-negative-price-red.xcresult` ran 6
  logical responsibilities = 5 passed + 1 failed and 12 concrete executions =
  10 passed + 2 failed. It proved that `priceAtOrder: -1` still survived when
  an explicit positive subtotal was present. The GREEN
  `/private/tmp/hu080-received-parser-negative-price-green-final.xcresult`
  passes 6/6 logical and 12/12 concrete with a clean build; the final mapper
  rejects negative prices as well as negative totals.
- Freshness-to-Products handoff: 2/3 passed in
  `/private/tmp/hu080-freshness-revision-handoff-red.xcresult`. A benign member
  refresh advanced the session revision after Products applied the exact
  payload, but Freshness could not recognize that successor. The final handoff
  requires an explicit Products acknowledgement of the exact live revision; a
  generic current-state predicate cannot legitimize it.
- Home entry ownership: valid REDs passed 1/2 for a stale captured context
  (`/private/tmp/hu080-home-entry-context-red-valid.xcresult`), 2/3 for a benign
  revision handoff
  (`/private/tmp/hu080-home-revision-handoff-red-2.xcresult`), and 2/4 for the
  root `onChange` handoff (`/private/tmp/hu080-home-onchange-red.xcresult`). Root
  now captures the immutable revision at intent creation, preserves only an
  explicitly acknowledged benign successor, and never launches a second
  refresh for that handoff.
- Home local-state pre-read fence: 4/5 passed first in
  `/private/tmp/hu080-home-state-owner-red.xcresult` and again in the stricter
  `/private/tmp/hu080-home-state-pre-read-red.xcresult`. A stale scope could
  advance the generation or touch storage before being rejected. The current
  scope/active-authorization/cancellation guard now runs before generation
  mutation and before the injected store read.
- Products session ownership: unsynchronized session changes first failed 1 of
  6 logical responsibilities, then the broader session-owner RED failed 2 of 7.
  The final Products RED is
  `/private/tmp/hu080-products-demotion-owner-red-2.xcresult`, 8 logical = 7
  passed + 1 failed because an authenticated-member demotion cleared
  impersonation without invalidating the previous catalog/editor epoch. The
  focused GREEN
  `/private/tmp/hu080-products-session-owner-green-final.xcresult` passes 15/15
  logical and 18/18 concrete executions. A subsequent 68/69 affected-cohort
  failure in `/private/tmp/hu080-products-cohort-post-owner-final.xcresult`
  caught the remaining demotion retry path; it is superseded by the final
  70-logical/73-concrete Products authority.

The post-review contract cohort passed 41/41 in
`/private/tmp/hu080-final-contracts-post-review.xcresult`. The last dedicated
Home/Freshness/Orders affected cohort passed 147/147 in
`/private/tmp/hu080-home-freshness-orders-cohort-final.xcresult`. Both are
superseded as closure authorities by the frozen canonical `fast-unit` and
`release-gate` results below.

## Pre-manual frozen repository delta

| Area | Baseline files | Frozen files | Delta | Baseline lines | Frozen lines | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Production | 275 | 283 | +8 | 40,025 | 40,787 | +762 |
| Unit tests | 136 | 150 | +14 | 32,490 | 35,214 | +2,724 |
| UI tests | 2 | 2 | 0 | 509 | 524 | +15 |
| Total | 413 | 435 | +22 | 73,024 | 76,525 | +3,501 |

- Swift Testing declarations: 769, up 52 from 717.
- The post-parser follow-up added one `@Test` and nine unit-test lines to the
  previous frozen cut.
- XCTest unit methods: 6, unchanged.
- Frozen fast-unit inventory: 775 logical responsibilities and 966 concrete
  executions.
- XCTest UI methods: 12, up one from 11.
- Frozen release inventory: 787 logical responsibilities and 981 concrete
  executions.

## Pre-manual frozen validation authorities

- Products affected cohort:
  `/private/tmp/hu080-products-cohort-authority-final.xcresult`, 70 logical and
  73 concrete, all passed.
- Last dedicated Home/Freshness/Orders affected cohort:
  `/private/tmp/hu080-home-freshness-orders-cohort-final.xcresult`, 147/147
  passed; the canonical unit result below is the closure authority.
- Freshness/previews post-review cohort:
  `/private/tmp/hu080-freshness-previews-post-review.hVomdC/result.xcresult`,
  21/21 passed.
- Product edit UI journey:
  `/private/tmp/hu080-product-ui-post-review.6qV9mC/result.xcresult`, 1/1 passed.
- Pre-hardening canonical cut, superseded by the negative-price parser test:
  `/private/tmp/hu080-fast-unit-canonical-authority-final.xcresult` passed
  774 logical/965 concrete,
  `/private/tmp/hu080-ui-smoke-canonical-authority-final.xcresult` passed 4/4,
  and `/private/tmp/hu080-release-gate-canonical-authority-final.xcresult`
  recorded 786 logical/980 concrete. These artifacts remain chronology only,
  not closure authorities.
- First post-parser `fast-unit` diagnostic, also superseded:
  `/private/tmp/hu080-fast-unit-canonical-post-parser-red.xcresult` ran 775
  logical responsibilities with 774 passed and one failed; concrete inventory
  was 966 = 965 passed + one failed. The failure was an inherited silent
  `waitForCondition` timeout in Shifts. The focused diagnosis
  `/private/tmp/hu080-shifts-focal-diagnosis.xcresult` passed 6/6, and the full
  rerun below passed without a code change. This timeout is neither an
  authority nor an HU-080 residual.
- Pre-manual canonical `fast-unit`:
  `/private/tmp/hu080-fast-unit-canonical-post-parser-green-final.xcresult`,
  775/775 logical and 966/966 concrete, all passed.
- Pre-manual canonical `ui-smoke`:
  `/private/tmp/hu080-ui-smoke-canonical-post-parser-final.xcresult`, 4/4
  passed.
- Pre-manual canonical `release-gate`:
  `/private/tmp/hu080-release-gate-canonical-post-parser-final.xcresult`, 787
  logical = 786 passed + the known launch-test skip. Concrete inventory is 981
  = 977 passed + four launch-test variants skipped. There are zero test
  failures; build diagnostics are 0 errors / 0 warnings / 0 analyzer warnings.
  `ReguertaUITestsLaunchTests/testLaunch` remains skipped because its historical
  screenshot assertion is flaky across parallel simulator clones; dedicated UI
  journeys cover launch behavior.
- The release gate also passed SwiftLint with 0 violations across 435 Swift
  files, all six effective-setting checks, Debug, and Production Release.
  `project.pbxproj`, package lockfiles, forbidden-escape additions, and
  `git diff --check` are clean.

## Post-manual addendum

The 2026-08-22 iPhone 11 / iOS 26.6 run confirms the functional journeys, Voice Control,
Reduce Motion, Increased Contrast, and unaffected large-text routes. It found
four Home defects: unstable initial VoiceOver focus, ungrouped weekly-cell
traversal, minus pronunciation for the ASCII range separator, and inaccessible
Latest News at AX5 because the route did not own its scroll.

The remediation moved from 17/22 RED at
`/private/tmp/hu080-home-physical-ax-red.cOf9t4/result.xcresult` to 22/22 GREEN
at `/private/tmp/hu080-home-physical-ax-green.wi7eA3/result.xcresult`. The final
layout/preview cohort passed 31/31, canonical `fast-unit` passed 775 logical /
966 concrete, focused Home overflow UI passed 1/1, and `ui-smoke` passed 4/4 at:

- `/private/tmp/hu080-home-ax5-preview-green.Lg0fJ4/result.xcresult`
- `/private/tmp/hu080-post-manual-fast-unit.c2oDSp/result.xcresult`
- `/private/tmp/hu080-home-overflow-ui.plc56Q/result.xcresult`
- `/private/tmp/hu080-post-manual-ui-smoke.Urvj12/result.xcresult`

At that post-layout/pre-focus cut, SwiftLint passed 0/435 and all 6/6 effective
Swift settings passed; `project.pbxproj` and `git diff --check` were clean.

The 2026-08-23 physical retest accepts the grouped weekly-cell traversal,
localized range pronunciation, and near-maximum Dynamic Type path through the
final news item. It still reproduced the first-news initial focus. The
subsequent focus cut moved from the valid missing-seam compile RED at
`/private/tmp/hu080-home-focus-red.uRmJfM/result.xcresult` to 4/4 GREEN at
`/private/tmp/hu080-home-focus-green.9pdW4k/result.xcresult`; the adaptive Home
cohort passed 10/10 at
`/private/tmp/hu080-home-focus-adaptive-green.OYM6JZ/result.xcresult`. The first
implementation run at
`/private/tmp/hu080-home-focus-green.gkISmX/result.xcresult` is invalid closure
evidence because its Swift Testing assertion did not compile; correcting that
test required no production-code change.

Post-focus canonical `fast-unit` passes 779/779 logical and 970/970 concrete at
`/private/tmp/hu080-home-focus-fast-unit.TKuQQL/result.xcresult`. Focused Home
overflow UI passes 1/1 at
`/private/tmp/hu080-home-focus-overflow-ui.M2PBV7/result.xcresult`, and
`ui-smoke` passes 4/4 at
`/private/tmp/hu080-home-focus-ui-smoke.XYWewg/result.xcresult`.

The first frozen-tree release gate at
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.PYUaRiqVbc/result.xcresult`
was a valid RED: 791 logical = 788 passed + two failed + one inherited launch
skip, and 985 concrete = 979 passed + two failed + four launch variants
skipped. Its failures exposed the non-hittable My Order entry and an ambiguous
Product-editor scroll that selected the hidden drawer. The final navigation focal at
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-ui-navigation-final.4Ccw8lVx2O/result.xcresult`
passes 3/3 after hardening those paths.

The definitive frozen-tree `release-gate` at
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.v2ErAd7VtU/result.xcresult`
passes 791 logical = 790 passed + one inherited launch skip + zero failed, and
985 concrete = 981 passed + four launch variants skipped + zero failed. Test
build results succeeded with zero errors and zero warnings. Final SwiftLint
passes 0/437; all 6/6 effective settings, Debug, Production Release, and the
forbidden-escape guard pass. `git diff --check` is clean, while
`project.pbxproj`, package lockfiles, staging, and forbidden-escape additions
have zero diff. Independent final review finds no P0-P3 issue.

The intermediate post-focus snapshot was Production 283 files/40,887
lines, unit tests 151/35,290, and UI tests 2/524: 436 files/76,701 lines, a
+23-file/+3,677-line delta from activation. It and the pre-manual release gate
remain valid chronology but are superseded as closure authorities. The final
frozen inventory is Production 283 files/40,888 lines, unit tests 151/35,290,
and UI tests 3/535: 437 files/76,713 lines, a +24-file/+3,689-line delta from
the 413-file/73,024-line activation baseline. The definitive release gate
establishes 791 logical responsibilities and 985 concrete executions.

The final 2026-08-23 physical pass accepts initial weekly-summary focus, no
focus theft during refresh, and one new focus after route re-entry. All local
implementation, physical acceptance, validation, inventory, and documentation
reconciliation are complete.

## Visual evidence and residuals

Xcode `RenderPreview` artifacts:

- Received Orders wide:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121921Z@3x.png`.
- Received Orders failure/retry:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121932Z@3x.png`.
- Pre-manual Home Freshness checking at compact AX5:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121941Z@3x.png`.
- Post-manual Home Freshness checking at compact AX5, Reduce Motion, and
  Increased Contrast with three deterministic news items:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-22T214359Z@3x.png`.
- Products failure:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T122005Z@3x.png`.

The compact AX5 overlap is no longer accepted debt: physical evidence proved
that it made Latest News unreachable, and the route-scroll/intrinsic-height
fix closes the automated finding. Each weekly cell is now one VoiceOver element
and the range uses explicit localized spoken text. The 2026-08-23 retest accepts
those behaviors and AX5 scrolling. Because it still reproduced the initial
focus on news content, Home now owns a one-shot
`@AccessibilityFocusState(for: .voiceOver)` target on the weekly-summary
heading. It consumes only after VoiceOver is enabled and the target is mounted,
does not repeat during refreshes, and resets with a new dashboard route.

The offline bottom feedback remains usable but visually rough; replacing it
with a Reguerta dialog or banner is explicitly deferred. `ProductEditorView.swift`
retains two direct local component canvases under `ReguertaTheme`; the full
editor route is already in the shared Community gallery. Android parity,
HU-070/#198 live rollout, and the later Phase 6 verticals remain outside this
story. HU-080 aligns the Orders/Home/Shift-week/producer-parity seams it touches
with `Europe/Madrid`; inherited RNF-02 debt in Settings/Shifts and other
verticals remains out of scope, so no global timezone closure is claimed. The
final independent post-focus audit reports no P0-P3 finding in HU-080's changed
surface. The final physical focus retest passes. Status is `ready_for_merge`;
the maintainer authorized commit, push, ready PR, merge, issue closure, branch
cleanup, and local integration on 2026-08-23. Live Firebase/backend mutation
remains out of scope and is not required.
