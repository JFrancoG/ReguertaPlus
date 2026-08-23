# HU-080 tasks

## Activation

- [x] Confirm HU-080 as the next Phase 6 identifier.
- [x] Confirm no duplicate issue, PR, branch, or spec.
- [x] Synchronize `main` and record base
  `5c511dda9aeb3dab182888733cf972847a91b97a`.
- [x] Create issue #262.
- [x] Create `codex/hu-080-ios-products-orders-home-freshness`.
- [x] Record authorization and delivery boundary.

## Baseline and contract

- [x] Count repository and primary slice Swift files/lines.
- [x] Map Products, Orders, Home, Freshness, App, and Root seams.
- [x] Map current operation owners, generations, revisions, leases, and tasks.
- [x] Inventory primary/cross-feature tests, previews, and UI automation.
- [x] Record HU-022, HU-051, HU-055, ADR, HU-070, and Android boundaries.
- [x] Identify source-backed first cuts and their focused REDs.
- [x] Synchronize the initial specification into the live issue body.

## Phase 1 - Product persistence integrity

- [x] Add `ProductPersistenceMappingTests` before production changes.
- [x] Capture RED for the missing persisted-ID mapping contract.
- [x] Preserve `weightStep`, `minWeight`, and `maxWeight` in the remapped
  product and payload.
- [x] Capture focused GREEN and affected product/payload regression GREEN.
- [x] Re-review Data/Domain boundary and exact field completeness.

## Phase 2 - Orders delivery window

- [x] Capture non-Wednesday configured-day RED.
- [x] Preserve override > configured weekday > Wednesday fallback.
- [x] Cover the shared My Order, Received Orders, and Home policy paths.
- [x] Characterize the Madrid week boundary for Home, Shift week keys, and
  producer parity without claiming global RNF-02 closure.
- [x] Run Orders/Home affected regressions.

## Phase 3 - Home cart-store boundary

- [x] Capture structural RED for `UserDefaults` and private keys in Home.
- [x] Capture behavior for confirmed > injected cart > empty by exact context.
- [x] Move persistence knowledge behind the Orders Domain/Data capability.
- [x] Inject the same graph into runtime, tests, and previews.
- [x] Run Home/Orders/composition regressions.

## Phase 4 - Ownership and architecture

- [x] Audit every load/mutation/checkout/history/freshness operation.
- [x] Retain/cancel tasks where physical cancellation is contractual.
- [x] Preserve generations/revisions and owner-only cleanup against
  non-cooperative dependencies.
- [x] Move Received Orders parsing out of Presentation.
- [x] Reject Boolean/non-finite monetary scalars and negative totals, and
  normalize invalid per-unit measures in the Data-owned parser.
- [x] Capture the post-parser negative-price RED at 5/6 logical and 10/12
  concrete; add its one `@Test`/nine unit lines and pass GREEN at 6/6 logical
  and 12/12 concrete with a clean build.
- [x] Move infrastructure error-code interpretation out of Domain.
- [x] Require an explicit Products receipt before Freshness accepts a successor
  session revision.
- [x] Fence Home entry to its captured revision and reject a stale local-state
  scope before generation mutation or store I/O.
- [x] Add a synchronized Products session revision/epoch and invalidate catalog,
  editor, upload, and mutation owners before relogin or access demotion adoption.
- [x] Simplify dependencies and split Views only at cohesive tested seams; no
  additional View split was justified by a demonstrated behavior.
- [x] Add selective DocC for changed non-trivial contracts.
- [x] Run independent architecture/concurrency review and remediate P0-P3.
- [x] Capture final Products demotion RED at 7/8 and focused GREEN at 15 logical/
  18 concrete.
- [x] Freeze the final Products cohort at 70 logical/73 concrete, all passed.
- [x] Pass the last Home/Freshness/Orders affected cohort at 147/147; use the
  canonical unit gate as closure authority.

## Phase 5 - UI and accessibility

- [x] Add deterministic Freshness idle/checking/ready/timed-out/unavailable
  previews.
- [x] Add Products failure and Received Orders failure/retry plus 600-point XXX
  Large previews through the real routes.
- [x] Apply the shared design-system modifier and fixed canvas to both adaptive
  galleries.
- [x] Audit the Product editor local preview environment; keep the two direct
  component canvases as documented post-MVP debt because the full editor route
  is covered by the shared gallery.
- [x] Add and pass the risk-selected Product edit/save UI journey.
- [x] Validate the deterministic phone/iPad, Large/XXX Large/AX5, ES/EN,
  light/dark, Increased Contrast, and Reduce Motion preview matrix and final
  Xcode renders.
- [x] Record the iPhone 11 / iOS 26.6 partial pass: functional journeys, Voice
  Control, Reduce Motion, Increased Contrast, and unaffected large-text routes
  pass; Home VoiceOver and AX5 findings remain open. HU-079 evidence is not
  reused.
- [x] Reclassify the Home compact-AX5 overlap as a functional accessibility
  defect and remediate it with route-owned scrolling, intrinsic cell growth,
  cell grouping, headings, and explicit localized week-range speech.
- [x] Record the 2026-08-23 physical retest on iPhone 11 / iOS 26.6: weekly
  cells read as grouped elements, the localized range no longer sounds like a
  minus, and near-maximum Dynamic Type reaches the final news item without
  overlaps. The original first-news initial focus still reproduced.
- [x] Add a route-owned, one-shot VoiceOver focus gate for the weekly-summary
  heading that survives asynchronous refreshes without stealing focus and
  resets only when the dashboard route is recreated.
- [x] Capture the focus contract RED, the corrected 4/4 GREEN, and the 10/10
  adaptive Home cohort. Keep the first implementation attempt as invalid
  closure evidence because the test assertion itself did not compile.
- [x] Complete the final 2026-08-23 one-shot focus retest on the physical iPhone
  11 / iOS 26.6: initial weekly-summary focus, no refocus after moving away and
  refreshing, and one new focus after leaving and re-entering Home all pass.
- [x] Record the rough offline bottom feedback and any future dialog/banner
  redesign as post-MVP UX, outside this remediation.
- [x] Run independent post-focus SwiftUI/accessibility review; no P0-P3
  findings remain, and final physical VoiceOver acceptance is complete.

## Final gates

- [x] All affected post-manual focused cohorts pass; failed intermediate review
  cohorts remain chronology, not closure authorities.
- [x] Mark the earlier `canonical-authority-final` bundles as pre-hardening and
  superseded by the negative-price parser test.
- [x] Record the first post-parser `fast-unit` at 774/775 logical and 965/966
  concrete as an inherited Shifts timeout diagnostic; pass its 6/6 focal and
  the full rerun without a code change, without making it an HU-080 residual.
- [x] Current post-focus canonical `fast-unit` passes: 779 logical/970 concrete
  unit executions.
- [x] Applicable focused Home overflow UI 1/1 and four-journey `ui-smoke` pass
  after the focus remediation.
- [x] Final navigation focal passes 3/3 at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-ui-navigation-final.4Ccw8lVx2O/result.xcresult`.
- [x] The pre-manual `release-gate` passed 787 logical/981 concrete,
  zero failures, with only the inherited launch-test skip and its four concrete
  variants; it is now historical rather than final authority.
- [x] Capture the first frozen-tree `release-gate` RED at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.PYUaRiqVbc/result.xcresult`:
  791 logical = 788 pass + two fail + one skip, and 985 concrete = 979 pass +
  two fail + four skips, exposing the non-hittable My Order entry and the
  ambiguous Product-editor scroll that selected the hidden drawer.
- [x] Definitive frozen-tree `release-gate` passes at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.v2ErAd7VtU/result.xcresult`:
  791 logical = 790 pass + one skip + zero fail, and 985 concrete = 981 pass +
  four skips + zero fail; test build results have zero errors and zero warnings.
- [x] The pre-manual frozen inventory was 283 production files/40,787 lines, 150
  unit files/35,214 lines, and two UI files/524 lines: 435/76,525 total,
  +22 files/+3,501 lines from activation.
- [x] Record the intermediate non-final post-focus snapshot: 283 production files/
  40,887 lines, 151 unit files/35,290 lines, and two UI files/524 lines:
  436/76,701 total, +23 files/+3,677 lines from activation.
- [x] Final frozen inventory is 283 production files/40,888 lines, 151 unit
  files/35,290 lines, and three UI files/535 lines: 437/76,713 total,
  +24 files/+3,689 lines from the 413/73,024 activation baseline.
- [x] Pre-manual SwiftLint 0/435, settings 6/6, Debug, Production Release,
  boundary guards, and forbidden-escape guards passed.
- [x] Final SwiftLint passes 0/437 and all six effective settings pass.
- [x] Final Debug and Production Release builds and forbidden-escape guard pass.
- [x] `git diff --check` is clean; package lockfiles, `project.pbxproj`, staging,
  and forbidden-escape additions have zero diff.
- [x] Current counts, `.xcresult` evidence, manual acceptance, parity, HU-070, and
  residual debt are reconciled in all five artifacts.
- [x] Final frozen counts, release evidence, inherited skips, and independent
  review with no P0-P3 finding are reconciled.

## Delivery gates

- [x] Commit authorized.
- [x] Push authorized.
- [x] Ready PR authorized.
- [x] Merge authorized for definitive closure.
- [x] Issue closure authorized.
- [x] Branch deletion and local integration authorized.
- [x] Firebase/backend deployment explicitly not applicable.

Current delivery state: ready for merge. The complete repository delivery flow
is authorized as of 2026-08-23. Remote PR and merge identifiers remain GitHub
delivery evidence rather than speculative values in this commit.
