# [HU-077] Consolidate the iOS composition root and app shell

## Summary

Select one typed scenario in App, compose exactly one complete graph for that
scenario, move all live Firebase/Data construction out of Presentation, and
replace broad shell dependency access with explicit route inputs while
preserving auth, session, startup, navigation, and push behavior.

## Authorization and status

The maintainer activated Phase 4 on 2026-08-19 with the verbatim instruction:
"Pues adelante con la siguiente fase, abre issue, rama etc".

Bootstrap and implementation were authorized by that instruction. The later
instruction "haz commit y push, lanza pr y cierra issue, etc" authorizes commit,
push, a ready PR, merge, issue closure, branch deletion, and integration.
Firebase deployment remains outside the requested delivery scope.

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/255
- Branch: `codex/hu-077-ios-composition-root-app-shell`.
- Base: integrated `main` at `907e403`.
- State: completed / source commit `c29bd04` merged by PR #256 as `68a036a`;
  issue #255 closed as completed.
- Plan: delivered; final documentation reconciliation and branch cleanup only.
- Profile: iOS `maintenance`.

## Links

- Spec: `spec/app/hu-077-ios-composition-root-app-shell/spec.md`
- Plan: `spec/app/hu-077-ios-composition-root-app-shell/plan.md`
- Tasks: `spec/app/hu-077-ios-composition-root-app-shell/tasks.md`
- Baseline: `spec/app/hu-077-ios-composition-root-app-shell/phase-4-baseline.md`
- ADR-0004: iOS root dependency injection.
- ADR-0011: explicit iOS isolation and owners.
- ADR-0012: runtime/Firebase ownership and the composition debt closed by this
  story.

## Dependencies

- #249 / HU-074: completed and integrated by PR #254.
- #250 / HU-075: completed and integrated by PR #252.
- #251 / HU-076: completed and integrated by PR #253.

## Scope

### In scope

- App-owned live Firebase/Data composition.
- Presentation dependency bundles containing contracts and values only.
- One explicit typed selector for live, preview, and UI-test scenarios.
- One App authority for supported launch arguments.
- Fail-visible incomplete live composition; no implicit preview/mock fallback.
- Characterized shared identities and independent preview/UI-test state.
- Explicit preview dependency bundles instead of production constructor
  defaults.
- Evidence-based removal of unused root wrappers.
- Narrow route inputs/bindings/actions replacing the broad
  `AccessRootRoutingView` surface.
- Store extraction only for cohesive owners with tests.
- Preserved typed reducer, auth navigation, startup/splash/lifecycle, push,
  session revision/lease, cancellation, and cleanup behavior.

### Out of scope

- Value-based navigation migration.
- Product/auth/session behavior changes.
- Phase 5 layout/DesignSystem and Phase 6 vertical features.
- Android, Functions, Firebase rules/schema/live data/deploy, packages, CI, test
  migration, or iOS/Xcode 27.
- Delivery or integration without later authorization.

## Acceptance criteria

- [x] Presentation has zero Firebase imports and zero concrete live Data/SDK
  construction.
- [x] Session dependencies are a passive injected bundle.
- [x] App owns one complete production root.
- [x] Live, preview, and UI-test graphs are explicit, fail-fast, and independent.
- [x] Launch arguments are decoded once in App and passed as typed values.
- [x] App/UI composition remains main-actor owned and SDK references stay in
  checked owners without unsafe escapes.
- [x] Preview dependencies cannot silently satisfy an incomplete production
  root.
- [x] Intentional graph identity is protected by tests through a pure
  non-Firebase assembly seam.
- [x] Unused root wrappers are removed only after evidence proves they have no
  consumers.
- [x] Routes consume explicit dependencies rather than the complete environment.
- [x] Auth, reducer, startup, lifecycle, push, session, and cleanup behavior is
  preserved.
- [x] Fast unit, UI smoke, release gate, lint, settings, builds, diff, pins, and
  the preview tool gate are clean; final architecture/concurrency
  reconciliation reports 0 unresolved P0-P3.
- [x] No Android, Functions, package, backend, deployment, or iOS/Xcode 27
  change enters the story.

## Initial evidence

- One Firebase-importing Presentation file with two imports.
- Seven launch-argument reads in six production files.
- Ten implicit `.preview()` defaults in Presentation.
- `ReguertaAppEnvironment.swift`: 361 lines and three scenario factories.
- `SessionViewModelDependencies.swift`: 146 lines with live/preview construction
  and no-op infrastructure.
- Nineteen `AccessRootRoutingView` references across twelve Presentation files.
- `ContentView` is used only by its own preview; `AccessRootView` has no
  consumer.
- Inherited tree: 363 Swift files / 62,984 lines; 580 fast-unit responsibilities
  and 9 UI responsibilities.
- Inherited closure: fast 580/580, UI smoke 4/4, release 588 pass + 1 known
  skip, SwiftLint 0/363, settings 6/6, Debug/Production Release green.

## Current plan

1. [x] Complete graph/identity and launch-control characterization.
2. [x] Move session live/preview construction to the correct App/test owners.
3. [x] Centralize typed scenario selection and AppDelegate configuration.
4. [x] Remove implicit preview defaults.
5. [x] Narrow shell route dependencies and remove proven-unused wrappers.
6. [x] Complete final independent reconciliation, then synchronize the local
   evidence to issue #255.

## Activated validation

- Destination: iPhone 17 / iOS 26.5, or a recorded explicit iOS 26 substitute.
- Plans: `fast-unit-v1`, `ui-smoke-v1`, and `release-gate-v1` through the
  repository validation runner.
- UI smoke: unauthorized restricted mode, pre-authorized home action row,
  drawer navigation, and invalid-credentials feedback; 4/4 required.
- Visual matrix: Xcode MCP `windowtab2` rendered the nine root/startup previews
  at Large with `errors=[]`; Home passed one isolated retry after a transient
  `PotentialCrashError`. One dedicated startup macro retained the semantic
  ambiguity recorded below. Unchanged iPad/multitasking, theme, locale, and
  motion surfaces remain outside this non-visual architecture cut.
- Architecture/concurrency and SwiftUI/accessibility reviews, including final
  reconciliation, are complete with 0 unresolved P0-P3.

## Final local evidence

- Final tree: 375 Swift files / 63,992 lines; production 261/36,243, unit
  112/27,365, UI 2/384.
- Unit inventory: 602 Swift Testing `@Test` declarations plus 6 XCTest methods,
  for 608 fast-unit responsibilities.
- Normative focused matrix: 33 logical tests, 34 dynamic executions, 0
  failed/skipped.
- Shell/root focal: 21/21.
- Fast unit: 608/608; UI smoke: 4/4.
- Retained release red:
  `/private/tmp/hu077-final-release-gate.xcresult`, 615 total, 613 passed, one
  known launch skip, and one My Order search-field failure.
- Final release gate: `/private/tmp/hu077-final-release-gate-2.xcresult`, 617
  total, 616 passed, one known
  `ReguertaUITestsLaunchTests/testLaunch` skip, 0 failed.
- SwiftLint 0.61.0: 375 files, 0 violations; effective settings: 6/6.
- Generic Debug and Production Release: green.
- RenderPreview Large: 9/9 snapshots with `errors=[]`; Home passed one isolated
  retry after a transient `PotentialCrashError`.
- Final architecture/code and SwiftUI/accessibility reviews completed with 0
  unresolved P0-P3.
- Presentation Firebase/live construction: 0; the only inherited Data
  allowlist entry is `FirebaseFunctionClientError.unauthorized` at exactly one
  use site; process-argument readers: one in App; targeted preview defaults: 0;
  broad protocol/wrappers: 0; unsafe concurrency escapes: 0.
- `git diff --check` passes; `project.pbxproj`, `Package.resolved`, Android,
  Functions, and iOS/Xcode 27 scope are clean.

The graph-identity test uses `ReguertaAppEnvironment.assemble` as a pure seam
with in-memory/no-op collaborators and never bootstraps Firebase.
`ReguertaAppConfiguration` decodes
`-reguerta_dev_time_machine.override_now_millis` once, requires one adjacent
`Int64`, and fails fast otherwise. Its typed seed takes precedence over
persisted state; live remains persistent and preview/UI-test clocks are
transient and isolated per graph. The red release above exposed the missing
UI-test seed `1778760000000`; the final release proves My Order after the fix.
Other retained red evidence covers the initial structural violations and the
startup-preview overwrite; coordinated partial builds mean the story does not
claim an isolated executable red for every cut.

The preview count is a tool-completion result, not nine semantically
unambiguous selections. The dedicated startup `unavailable` macro at index 0
repeatedly displayed `timedOut` despite its `.unavailable` source fixture.
`MainView` displayed `unavailable` with the same fixture and runtime coverage
distinguishes both states. A RenderPreview cache/selection interaction among
macros in the same file is the current inference, not a demonstrated
application-state defect.

## Next step

Source commit `c29bd04f6aab6b6190d75996ac04880c1f0c9d04` was published and
ready PR #256 merged it into `main` as
`68a036a5fce7d00b8ed0a79db4057df5cf584783`. The `Closes #255` linkage
closed issue #255 as completed. This document is the focused reconciliation
that records that definitive result; the delivery branch is removed after the
reconciliation merges. Firebase deployment was not part of the delivery.

## Labels

- `enhancement`
- `platform:ios`
- `priority:P1`
- `area:app`
