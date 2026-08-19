# Plan - HU-077 iOS composition root and app shell

## 1. Planning authority and branch

HU-077 implements Phase 4 of the roadmap accepted in the HU-074 plan and the
composition debt explicitly retained by ADR-0012/HU-076. Authorization and
delivery boundaries are recorded in `spec.md`.

- Issue: #255.
- Branch: `codex/hu-077-ios-composition-root-app-shell`.
- Base: integrated `main` at `907e403`.
- Plan state: implementation, local validation, documentation, and final
  reconciliation review complete with 0 unresolved P0-P3; full repository
  delivery authorized and executing.
- Profile: iOS `maintenance`; Xcode/iOS 26, Swift 6, Clean Architecture, and
  existing test frameworks remain authoritative.

## 2. Design principles

1. App owns composition; Presentation consumes dependencies.
2. Select one typed scenario once rather than distributing launch-argument
   checks throughout the graph.
3. Make incomplete composition fail visibly instead of substituting preview
   dependencies.
4. Keep App/UI composition on its main-actor owner and preserve checked SDK
   actor boundaries without escapes.
5. Characterize shared identity before moving stateful collaborators.
6. Separate mechanical movement from ownership or behavior changes.
7. Pass explicit route inputs, bindings, and actions instead of exposing the
   complete root environment transitively.
8. Preserve typed reducer and navigation behavior; do not combine composition
   cleanup with navigation modernization.
9. Extract a store only for a cohesive owner proved by tests.
10. Keep platform, package, backend, product, and Phase 5/6 work outside this
   cut.

## 3. Work sequence

### 3.1 Governance and reproducible baseline

- Link issue #255, branch, spec, plan, tasks, mirror, and baseline.
- Record source/test counts, inherited executable gates, imports, scenario
  selectors, preview defaults, root wrappers, and routing-protocol spread.
- Map every stateful dependency built by the live, preview, and UI-test graphs
  and record which identities are intentionally shared.
- Record every current launch argument and its consumer.
- Confirm ADR-0004/0011/0012 cover the decision and no new ADR is required.

Exit gate:

- All five artifacts agree with issue #255 and `main` evidence.
- Baseline commands are reproducible and the branch has no unrelated change.
- The first behavioral-risk cut has a named characterization test.

### 3.2 Characterize scenario and graph identity

- Add deterministic tests for live composition seams without starting real
  Firebase or touching live data.
- Characterize preview and UI-test graph independence.
- Characterize collaborators intentionally shared between session, root,
  features, AppDelegate, startup, and freshness.
- Characterize current launch-argument behavior for mock auth, mock product
  data, and splash skipping.
- Add a structural regression that fails when Presentation imports Firebase or
  constructs a known live Data/SDK implementation.

Exit gate:

- Tests fail for the intended implicit/fallback boundaries before production
  changes and pass for current behavioral invariants.
- No network, live Firebase, or real sleep is required.

### 3.3 Move session composition to App

- Make `SessionViewModelDependencies` a passive bundle of contracts and values.
- Move live Firebase/member/resolver/environment/freshness construction to an
  App-owned factory using already shared `LiveRootDependencies` values.
- Move preview/no-op construction to App preview support and test support.
- Remove Firebase imports, process-argument reads, and concrete factory
  decisions from the Presentation file.
- Preserve environment-store/router identity, authorized-device coordination,
  member repository sharing, Functions token provider, clocks, timeout, and
  sleeper contracts.

Exit gate:

- Presentation Firebase import count is zero.
- Session composition tests and session/security regression suites pass.
- The effective live, preview, and UI-test graphs are unchanged.

### 3.4 Make scenario selection explicit

- Define one App-owned typed launch/scenario configuration.
- Decode `-useMockAuth`, `-useMockProductData`, and `-skipSplash` once.
- Pass typed configuration to AppDelegate, root startup, Products, and
  Freshness rather than rereading `ProcessInfo`.
- Replace `ReguertaAppEnvironment.live()` returning `uiTesting()` with explicit
  scenario dispatch at the App boundary.
- Split live, preview, and UI-test composition into cohesive App files only
  after tests prove graph equivalence.
- Require the production root to fail visibly when Firebase configuration or a
  mandatory live dependency is unavailable.

Exit gate:

- One App authority reads launch arguments.
- Each scenario is named by its effective graph and cannot fall back.
- Preview/UI-test composition never bootstraps Firebase or push registration.

### 3.5 Remove implicit preview defaults

- Remove `.preview()` defaults from `AccessRootViewModel` and other touched
  production/root constructors that can mask incomplete composition.
- Update previews and tests to build explicit preview dependency bundles.
- Keep passive structs on synthesized memberwise construction; do not add
  redundant initializers or explicit inferred `Sendable` conformances.
- Verify missing dependencies produce compile-time or explicit composition
  failure rather than preview behavior.

Exit gate:

- The targeted Presentation default count reaches zero.
- Preview/test call sites remain deterministic and production cannot compile an
  incomplete root by default.

### 3.6 Narrow app-shell dependencies

- Remove `ContentView` and `AccessRootView` only after confirming no runtime,
  test, or preview consumer remains.
- Replace `AccessRootRoutingView` one route cluster at a time with explicit
  values, true bindings, semantic actions, and narrowly owned view models.
- Keep `MainView`, route selection, overlays, and shell lifecycle declarative.
- Preserve `AuthShellState`, reducer actions, route transitions, splash/startup
  ordering, feedback presentation, and scene lifecycle behavior.
- Evaluate router/startup/lifecycle store extraction. Implement a split only
  if the current state/transition map demonstrates one cohesive owner and the
  characterization suite proves equivalence.

Exit gate:

- No route gains transitive access to the complete App environment.
- Removed wrappers have zero consumers.
- Shell behavior and UI smoke tests remain unchanged.

### 3.7 Full validation and independent review

Run in this order:

1. Structural import/construction/scenario/default checks.
2. Focused composition, scenario, identity, session, root, and shell suites.
3. Strict SwiftLint.
4. Effective settings verifier, 6/6.
5. Fast-unit lane on an explicit iOS 26 simulator.
6. UI-smoke lane, 4/4.
7. Generic Debug build.
8. `Reguerta-Production` Release build.
9. Composite release gate with exact logical pass/skip/fail counts.
10. Package, Android, Functions, project, iOS-27, escape, import, and diff
    review.
11. Independent maintenance-profile iOS architecture/concurrency review.
12. Independent SwiftUI/accessibility review of the root dependency and view
    boundaries.
13. Reconcile issue #255 and aligned ADR implementation notes only from final
    evidence.

Exit gate:

- Every acceptance criterion has current evidence.
- No P0-P3 remains and no out-of-scope platform/product change entered the
  diff.
- Delivery actions remain pending until separately authorized.

## 4. Expected file clusters

### Governance

- `spec/app/hu-077-ios-composition-root-app-shell/`
- `spec/issues/hu-077-ios-composition-root-app-shell-issue.md`
- ADR-0004 and ADR-0012 EN/ES implementation-status notes at closure only.

### App composition

- `ios/Reguerta/Reguerta/ReguertaApp.swift`
- `ios/Reguerta/Reguerta/App/ReguertaAppEnvironment.swift`
- Scenario-specific App composition files introduced only when cohesive.
- `ios/Reguerta/Reguerta/App/AppDelegate.swift`
- App-owned feature dependency factories that currently inspect launch args.

### Presentation root and shell

- `ios/Reguerta/Reguerta/Presentation/Root/SessionViewModelDependencies.swift`
- `ios/Reguerta/Reguerta/Presentation/Root/AccessRootViewModel.swift`
- `ios/Reguerta/Reguerta/Presentation/Root/ContentView*.swift`
- Route extension files currently conforming to `AccessRootRoutingView`.

### Tests

- Root dependency/composition structural tests.
- Scenario and graph-identity tests.
- Existing session/root/shell and UI-smoke suites.
- Focused test support for explicit preview/UI-test graphs.

## 5. Delivery strategy

The later instruction "haz commit y push, lanza pr y cierra issue, etc"
authorizes commit, push, a ready pull request, merge, issue closure, branch
deletion, and integration. Use focused Conventional Commits and keep the
sequence reviewable:

1. Characterization and baseline.
2. Session composition boundary.
3. Explicit scenario selection.
4. Preview-default migration.
5. Shell dependency narrowing and proven wrapper removal.
6. Final evidence and ADR status alignment.

Firebase deployment remains outside this delivery and requires a separate
explicit instruction.

## 6. Risks and controls

- Duplicate stateful adapters -> identity map and tests before movement.
- UI-test graph accidentally initializes Firebase -> explicit scenario type and
  negative bootstrap tests.
- Launch arguments drift -> one decoder and typed configuration.
- Test convenience hides production gaps -> explicit preview bundles at call
  sites.
- Route narrowing changes behavior -> one route cluster per cut with reducer
  and UI-smoke coverage.
- Actor ownership drifts while factories move -> keep UI graph construction on
  `@MainActor`, SDK references in their checked owners, and run escape audits.
- Store proliferation -> require cohesive ownership, not file-size pressure.
- Navigation redesign -> keep value-stack migration outside HU-077.
- Cross-platform scope growth -> record Android parity separately and leave
  Android unchanged.

## 7. Completion record

The planned sequence completed without extracting another shell store:
characterization showed that `AccessRootViewModel` remains the cohesive owner
for the existing reducer/startup/lifecycle state, while the dependency problem
was the broad view surface rather than state ownership.

The final composition has one typed App configuration, explicit live/preview/
UI-test dispatch, one App-owned launch-argument read, a passive Presentation
session bundle, and no fallback between scenarios. The identity matrix is
protected through the pure `ReguertaAppEnvironment.assemble` seam. That seam
uses injected in-memory/no-op test collaborators and does not configure or
contact Firebase. `ReguertaAppConfiguration` decodes the fourth supported
launch control, `-reguerta_dev_time_machine.override_now_millis`, once, requires
an adjacent `Int64`, and fails fast for malformed input. Its typed initial seed
wins over persisted state. Live retains persistence; preview and UI-test
composition use independent transient `DevelopmentTimeMachine` instances and
route the selected clock through root, session, features, and Freshness. Live
Freshness continues to use its default `Date` wall clock.

The Data boundary guard inventories concrete Data declarations and permits
only the inherited typed error reference
`FirebaseFunctionClientError.unauthorized` at exactly one use site. That narrow
allowlist does not permit Presentation to construct live infrastructure.

The shell cut removed the two unused wrappers and the broad routing protocol.
`MainView` alone reads the App environment and distributes explicit root,
session, feedback, token, URL, and action inputs. Each of the seven shell views
has its own source and deterministic preview; startup `unavailable` and
`timedOut` fixtures cannot be overwritten by startup evaluation.

The honest retained red/green evidence consists of the baseline structural
violations, the missing pure identity seam, and the reproduced startup-preview
state overwrite. Some first executions were temporarily blocked by concurrent
partial compilation in the coordinated worktree, so this plan does not claim a
separate executable red for every mechanical cut.

The first full release closeout is retained as an additional red checkpoint:
`/private/tmp/hu077-final-release-gate.xcresult` recorded 615 responsibilities,
613 passed, one known launch skip, and one failure in
`ReguertaUITests.testMyOrderSearchBarStaysAboveBottomSafeArea` because the
search field was absent. The transient UI-test clock had lost the launch seed
`-reguerta_dev_time_machine.override_now_millis 1778760000000`. Centralizing
that seed in the typed configuration restored deterministic My Order state.

Final evidence on iPhone 17 / iOS 26.5:

- normative focal: 33 logical tests, 34 dynamic executions, 0 failed/skipped;
- shell/root focal: 21/21;
- fast unit: 608/608 (602 Swift Testing plus 6 XCTest); UI smoke: 4/4;
- release: `/private/tmp/hu077-final-release-gate-2.xcresult`, 617 total,
  616 passed, one known
  `ReguertaUITestsLaunchTests/testLaunch` skip, 0 failed;
- SwiftLint 0.61.0: 0/375 findings; effective settings: 6/6;
- generic Debug and Production Release: green;
- Large previews: Xcode MCP `windowtab2`, 9/9 with `errors=[]`; Home required
  one isolated retry after a transient `PotentialCrashError`;
- final architecture/code and SwiftUI/accessibility reviews completed with 0
  unresolved P0-P3;
- final tree: 375 Swift files / 63,992 lines, split as production
  261/36,243, unit 112/27,365, and UI 2/384;
- Presentation Firebase, targeted preview defaults, broad protocol/wrappers,
  and concurrency escapes: zero; one process-argument read remains in App;
- `project.pbxproj`, `Package.resolved`, Android, Functions, and iOS/Xcode 27
  scope are clean.

Preview evidence is tool-complete but not semantically unequivocal for every
macro. The dedicated startup `unavailable` preview at index 0 repeatedly
displayed `timedOut` despite the `.unavailable` source fixture. `MainView`
displayed `unavailable` for that fixture and runtime coverage distinguishes the
two states. A RenderPreview cache/selection interaction among macros in the
same source file is the current inference, not a proven application defect.

Issue #255 remains open while the authorized delivery executes. The branch is
local without an upstream at this checkpoint. Commit, push, a ready pull
request, merge, issue closure, branch deletion, and integration are authorized;
Firebase deployment remains outside scope. The remote body will be refreshed
before merge so it no longer describes delivery as unauthorized.
