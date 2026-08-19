# Tasks - HU-077

Authorization and delivery boundaries are recorded in `spec.md`. Bootstrap,
implementation, commit, push, a ready pull request, merge, issue closure,
branch deletion, and integration are authorized. Firebase deployment remains
outside the requested delivery scope.

Local implementation, executable validation, the post-P1 preview tool rerun,
final reconciliation review, and remote issue synchronization are complete.
Issue #255 remains open while the authorized delivery executes in this turn.

## 0. Governance and baseline

- [x] Confirm HU-077 is the next free story and no equivalent issue or branch
  exists.
- [x] Select the iOS `maintenance` profile.
- [x] Confirm ADR-0004/0011/0012 already govern the composition boundary.
- [x] Create issue #255 with `enhancement`, `platform:ios`, `priority:P1`, and
  `area:app`.
- [x] Create `codex/hu-077-ios-composition-root-app-shell` from synchronized
  `main` at `907e403`.
- [x] Create spec, plan, tasks, phase baseline, and issue mirror.
- [x] Record the initial static composition and test inventory.
- [x] Map every live/preview/UI-test dependency and intentional shared identity.
- [x] Record every current launch argument and expected typed meaning.
- [x] Confirm the characterization clusters and record the retained red/green
  evidence without claiming universal test-first execution.

## 1. Composition characterization

- [x] Add structural coverage rejecting Firebase imports in Presentation.
- [x] Add structural coverage rejecting concrete live Data/SDK construction in
  Presentation.
- [x] Characterize live graph identity for shared session/root dependencies
  through the pure non-Firebase assembly seam.
- [x] Characterize independent preview graphs.
- [x] Characterize independent UI-test graphs without Firebase bootstrap.
- [x] Characterize mock-auth, mock-product-data, and skip-splash behavior.
- [x] Characterize AppDelegate push enablement for live versus UI-test.
- [x] Keep all new waiters deterministic, cancellation-aware, bounded, and free
  of live network or real sleeps.

## 2. Session dependency boundary

- [x] Move live session dependency construction into App.
- [x] Move preview/no-op construction into App preview or test support.
- [x] Remove Firebase imports from `SessionViewModelDependencies.swift`.
- [x] Remove launch-argument reads from Presentation session composition.
- [x] Remove concrete live Data/Firebase construction from Presentation.
- [x] Keep `SessionViewModelDependencies` as contracts and values only.
- [x] Preserve member repository, environment router/store, Functions client,
  freshness local repository, clock, timeout, sleeper, and device coordinator
  identity.
- [x] Run focused session/security/device tests.

## 3. Explicit App scenarios

- [x] Define one typed App launch/scenario configuration.
- [x] Decode all supported launch arguments once in App.
- [x] Decode `-reguerta_dev_time_machine.override_now_millis` with one adjacent
  `Int64`, fail fast on malformed input, and give the typed seed precedence
  over persisted clock state.
- [x] Pass typed push behavior to `AppDelegate`.
- [x] Pass typed splash behavior to the root.
- [x] Pass typed product-data behavior to Products composition.
- [x] Pass typed freshness behavior to Freshness composition.
- [x] Keep App/UI graph construction on its main-actor owner.
- [x] Preserve actor-owned SDK boundaries and checked values across isolation.
- [x] Make live, preview, and UI-test dispatch explicit at `ReguertaApp`.
- [x] Remove live-to-UI-test fallback from `ReguertaAppEnvironment.live()`.
- [x] Prove incomplete live composition fails visibly.
- [x] Split scenario composition files only after graph-equivalence tests pass.

## 4. Explicit root dependencies

- [x] Remove `.preview()` defaults from `AccessRootViewModel` production/root
  construction.
- [x] Remove other touched Presentation preview defaults that mask incomplete
  composition.
- [x] Update previews to request an explicit preview graph.
- [x] Update tests/fixtures to request explicit dependency bundles.
- [x] Confirm production/root construction cannot silently use preview values.
- [x] Preserve synthesized Swift struct construction and inferred sendability.

## 5. App shell boundary

- [x] Verify `ContentView` has no consumer beyond its own preview.
- [x] Verify `AccessRootView` has no consumer.
- [x] Remove only the proven-unused wrappers and update the preview entry.
- [x] Inventory every `AccessRootRoutingView` consumer and used member.
- [x] Replace the broad protocol one route cluster at a time.
- [x] Pass immutable values down and semantic actions up.
- [x] Keep bindings only for true bidirectional editing.
- [x] Confirm no route uses `ReguertaAppEnvironment` as a service locator.
- [x] Preserve typed reducer, auth routes, overlays, startup, splash, feedback,
  and scene lifecycle behavior.
- [x] Keep shell/router/startup/lifecycle state in the existing root owner
  because characterization did not justify another store.

## 6. Validation and closeout evidence

- [x] Run the normative focused matrix: 33 logical tests, 34 dynamic
  executions, 0 failed and 0 skipped.
- [x] Run the shell/root focal: 21/21 passed.
- [x] Run SwiftLint 0.61.0 in strict/no-cache mode: 375 files, 0 findings.
- [x] Run the effective settings verifier for all 6 pairs: 6/6 passed.
- [x] Run fast-unit with iPhone 17 / iOS 26.5: 608/608 passed (602 Swift
  Testing plus 6 XCTest), 0 failed, 0 skipped.
- [x] Run UI-smoke on the same destination and confirm the four named tests 4/4.
- [x] Build generic Debug.
- [x] Build `Reguerta-Production` Release.
- [x] Retain the first release red at
  `/private/tmp/hu077-final-release-gate.xcresult`: 615 total, 613 passed, one
  known launch skip, and one My Order search-field failure caused by the
  transient UI-test clock losing its typed launch seed.
- [x] Run the final release gate at
  `/private/tmp/hu077-final-release-gate-2.xcresult`: 617 total, 616 passed, the
  one known `ReguertaUITestsLaunchTests/testLaunch` skip, and 0 failed.
- [x] Confirm Presentation Firebase imports and live construction are zero.
- [x] Keep the Data type guard exhaustive, with only the inherited
  `FirebaseFunctionClientError.unauthorized` reference allowlisted at exactly
  one use site and no Presentation live construction.
- [x] Confirm launch-argument reads have one App authority.
- [x] Confirm targeted implicit preview defaults are zero.
- [x] Confirm no new unsafe concurrency escape or GCD ownership shortcut.
- [x] Confirm `Package.resolved`, Android, Functions, project settings, and
  iOS/Xcode 27 scope are unchanged.
- [x] Run `git diff --check` and explicit file-scope review.
- [x] Complete the initial independent iOS architecture/concurrency review and
  remediate its findings.
- [x] Complete the final reconciliation re-review with no unresolved P0-P3.
- [x] Complete independent SwiftUI/accessibility review of root view boundaries
  with no unresolved P0-P3.
- [x] Revalidate the nine shell/startup previews through Xcode MCP `windowtab2`
  at Large: 9/9 snapshots with `errors=[]`; record the transient Home retry and
  the dedicated startup macro's unresolved RenderPreview selection ambiguity.
- [x] Record the final inventory: 375 Swift files / 63,992 lines; production
  261/36,243, unit 112/27,365, and UI 2/384.
- [x] Update the five local HU-077 artifacts and ADR-0004/0012 EN/ES from final
  evidence.
- [x] Synchronize the final evidence to remote issue #255 only after the final
  reconciliation verdict, preserving its open state and four labels.

## Delivery gates

- [x] Obtain explicit authorization before commit.
- [x] Obtain explicit authorization before push.
- [x] Obtain explicit authorization before opening a ready PR.
- [x] Obtain explicit authorization before merge, issue closure, branch
  deletion, or integration.

## Explicit non-tasks

- [x] Do not migrate to value-based navigation in HU-077.
- [x] Do not change auth/session/product behavior.
- [x] Do not enter Phase 5 layout/DesignSystem or Phase 6 feature slices.
- [x] Do not modify Android, Functions, Firebase schema/rules/live data, or
  deploy.
- [x] Do not upgrade packages or adopt iOS/Xcode 27.
- [x] Do not redesign validation lanes or migrate XCTest.
