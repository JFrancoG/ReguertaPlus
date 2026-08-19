# Plan - HU-074 and the iOS refactor roadmap

## 1. Planning authority and unit of delivery

HU-074 owns only two executable phases:

1. Phase 0: governance and reproducible baseline.
2. Phase 1: atomic adoption of the `nonisolated` target policy and compilation
   recovery.

The verbatim authorization sources and their boundary are recorded in the
spec. Phase 1 was explicitly activated after Phase 0 closed. Phases 2-9 below
are an ordered program roadmap, not active HU-074 scope. Each will
receive its own canonical HU, GitHub issue, `codex/` branch, spec, tasks,
measurable gates, and explicit authorization. No single branch or pull request
will carry the whole program.

## 2. Technical approach

Use a dependency-aware hybrid migration:

1. Make the isolation policy explicit and recover a compiling baseline.
2. Fix cross-cutting state ownership and infrastructure boundaries.
3. Simplify the composition root and app shell.
4. Replace global layout assumptions through the shared DesignSystem.
5. Refactor complete vertical feature slices. Within a slice, work in
   Domain -> Data -> App -> Presentation -> tests/previews/docs order.
6. Perform broad test and mechanical modernization only after behavior and
   ownership are stable.
7. Harden release gates after first-party warnings reach zero.

Files may be edited one at a time, but a contract cluster is deliverable only
when it compiles and its focused gate is green. The current build-setting
change and the minimum source corrections required to compile form one atomic
cut; a broken setting-only commit is not allowed.

## 3. Isolation and ownership matrix

| Boundary | Policy |
| --- | --- |
| SwiftUI View | Declarative; emits semantic actions and owns only local UI state |
| Observable presentation model/store | Explicit `@MainActor` |
| App composition | Explicit isolation required by the graph being built |
| Domain entity/policy/pure use case | Nonisolated by default |
| Stateful Data implementation | Actor or explicit owner; synchronous primitive only for a proven non-suspending invariant |
| Firebase/SDK boundary | Reference stays in its Data service adapter or App lifecycle/composition adapter; immutable values cross actors |
| SDK delegate/callback | Explicit hop to the state owner |
| Tests | Same module default as production; actor annotation follows the SUT |

`nonisolated` is an isolation contract, not a background-execution request.
SE-0466 controls module inference. Caller-actor execution and deliberate
parallelism remain separate decisions; work that must leave the caller actor
uses the appropriate structured-concurrency contract rather than an unsafe
escape.

## 4. HU-074 executable sequence

### Phase 0 - Governance and reproducible baseline

- Create and link issue #249 and the HU branch.
- Record ADR-0011 in English and Spanish.
- Create spec, plan, tasks, issue mirror, and a dated diagnostic ledger.
- Align `AGENTS.md` and the English/Spanish stack docs while clearly marking
  the implementation as in progress.
- Preserve the maintainer's `project.pbxproj` diff without committing a broken
  configuration-only cut.
- Obtain independent architecture/data, Presentation/SwiftUI, and
  tests/governance reviews and resolve their findings.

Exit gate:

- Required artifacts and internal links exist.
- The tracker and local story describe the same current boundary.
- The Debug build failure and strict-lint result are reproducible in
  `phase-0-baseline.md`.
- English/Spanish decisions remain aligned and `git diff --check` passes.
- The branch contains no unrelated change and no commit/push has been implied.

### Phase 1 - Atomic adoption and compilation recovery (commit and push authorized)

Initial files and clusters are deliberately bounded to configuration and
compiler-exposed ownership:

- `Reguerta.xcodeproj/project.pbxproj`.
- `Domain/Access/ResolveAuthorizedSessionUseCase.swift` and the environment
  routing contracts it invokes.
- `Domain/Freshness/ResolveCriticalDataFreshnessUseCase.swift` and its local
  repository ownership contract.
- `Data/Firestore/ReguertaFirestorePath.swift`.
- `Presentation/Root/SessionViewModel.swift`,
  `GlobalFeedbackCenter.swift`, and `SessionViewModelDependencies.swift`.
- `App/ReguertaAppEnvironment.swift` and only the factories exposed by the
  compiler after the root fixes.
- Focused auth, environment-routing, freshness, and root-dependency tests.

Execution order:

1. Move `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` to the project Debug and
   Release build settings and remove target duplication.
2. Verify the effective value for app, unit-test, and UI-test targets in both
   configurations.
3. Mark true UI state owners and UI graph construction explicitly
   `@MainActor`.
4. Resolve C-001/C-002 without making the synchronous invalidation fence
   suspend. Preserve lease/context ownership and cleanup-before-successor.
5. Resolve C-003 through the actual local-store owner rather than inheriting UI
   isolation into Domain.
6. Resolve F-001-F-003 with one explicit owner for mutable Firestore runtime
   state; do not introduce unowned global mutable state.
7. Rebuild, append newly exposed diagnostics to the ledger, classify each as a
   root or cascade, and repeat until the full target compiles.
8. Resolve App factory/SDK diagnostics at the narrowest responsible boundary;
   never use an unsafe import, conformance, detached task, or GCD workaround.
9. Run focused tests, Debug, Release, the standard test gate, structural escape
   searches, package-pin check, and independent concurrency review.

Exit gate: every acceptance criterion and command in `spec.md` is green, the
diagnostic ledger has no open entry, behavior/security contracts remain
covered, and the executable cut is ready for separately authorized delivery.

## 5. Follow-up roadmap - inactive until separately specified

### Phase 2 - Reproducible validation lanes

- Define versioned fast-unit, UI-smoke, and release-gate `.xctestplan` files.
- Select a canonical scheme and align repository/CI commands across Develop,
  Production, and the standard `Reguerta` scheme.
- Make SwiftLint strict and reproducible without Homebrew-path assumptions;
  split the two current test-only length violations separately.
- Add effective Swift-setting checks for all first-party targets.
- Record coverage as a trend rather than imposing an arbitrary starting
  threshold.
- Keep unit/UI/performance responsibilities explicit; do not move UI or launch
  performance tests away from XCTest.

Exit intent: each later file cluster receives fast deterministic feedback and
the full release gate remains available at story closure.

### Phase 3 - Session environment and Firebase concurrency ownership

- Replace mutable process-global `ReguertaRuntimeEnvironment` state with an
  injected owner or immutable per-operation snapshots.
- Preserve synchronous lease/context invalidation, cleanup-before-successor,
  and the `DRAINING` barrier from ADR-0008/0009/0010.
- Replace the global development time machine with an injected clock.
- Remove retroactive unchecked sendability from Firebase Auth users.
- Audit Auth, Functions, Devices, Freshness, repositories, and image pipeline
  in risk order.
- Keep SDK references in responsible Data or App infrastructure adapters and
  publish immutable values/errors across actors.
- Validate session replacement, logout, cancellation, late results, and
  environment ownership with deterministic tests.

Exit intent: no implicit mutable runtime environment and no unapproved unsafe
sendability boundary.

### Phase 4 - Single composition root and app shell

- Move live Firebase/Data construction out of
  `Presentation/Root/SessionViewModelDependencies.swift` into App.
- Keep Presentation dependency bundles limited to contracts and values.
- Consolidate live/mock/preview/UI-test selection and split
  `ReguertaAppEnvironment` by scenario without changing the graph in the same
  cut.
- Make environment injection actor-safe and deterministic and prevent a
  missing live graph from silently becoming a preview graph.
- Verify and remove unused `ContentView`/`AccessRootView` aliases.
- Eliminate broad transitive route dependencies; each route receives only the
  inputs/bindings it consumes.
- Separate shell/router/startup/lifecycle stores only where a cohesive owner
  and tests justify the split.
- Keep auth navigation behavior and typed reducer transitions; migrate to a
  value-based stack only in a separately characterized behavioral cut.

Exit intent: one production root, no Firebase import or live Data construction
in Presentation, and independently verifiable live/preview/UI-test graphs.

### Phase 5 - Adaptive layout and DesignSystem foundation

- Define semantic spacing, radius, icon, layout, and touch-target tokens.
- Migrate `DeviceScale` and `.resize*` consumers by component/route, never by a
  global textual replacement.
- Prefer container-aware layout, `ViewThatFits`, relative frames, and safe-area
  ownership; reserve `@ScaledMetric` for meaningful non-text metrics.
- Validate 44-point interactive targets at compact phone widths.
- Cover phone, iPad, multitasking, multiwindow, Large, XXX Large, AX5,
  light/dark, Spanish/English, and Reduce Motion.
- Rename passive DesignSystem `*ViewModel` values to Configuration/Model when
  their API is touched; redesign the input-field configuration separately.
- Modernize stored content closures, manual EnvironmentKey use, redundant
  builders, `Clock` sleep, and the identified named coordinate-space call in
  mechanical cuts.
- Add deterministic loading/empty/error/content previews progressively.
- Localize the identified hardcoded VoiceOver labels and audit uppercase
  transformation of translated input text.
- Introduce a root motion policy and adapt material or non-essential motion
  when Reduce Motion is enabled.

Exit intent: no global window-derived layout state, no sub-44-point target,
and shared components pass the declared visual/accessibility matrix.

### Phase 6 - Vertical feature stories

Activate one story at a time in this dependency/risk order:

1. Auth, session, environment, and authorized devices.
2. Products, Orders, Home, and Freshness.
3. Shifts, Planning, Swaps, Delivery Calendar, and Settings.
4. News and Notifications.
5. Users and Shared Profile.
6. Bylaws, Startup, and Media.

Every slice story must characterize current behavior, declare actor/state
ownership, keep business rules in Domain, keep infrastructure in Data/App,
simplify dependencies, split Views by responsibility, localize and audit
accessibility/motion, add deterministic previews, and close focused plus full
gates before the next slice starts. File size is a review signal, not by itself
permission to create another abstraction.

### Phase 7 - Test modernization

- Migrate only the two pure XCTest unit suites to Swift Testing.
- Keep XCUITest and launch-performance tests on XCTest.
- Remove suite-wide `@MainActor` only when the SUT is actor-neutral.
- Replace avoidable sleeps/polling with controllable clocks, continuations,
  confirmations, or deterministic gates.
- Split large suites by behavior and reduce fixture duplication without hiding
  test intent.
- Keep HU-047 as owner of its existing role-based E2E product journeys.

### Phase 8 - Mechanical compactness and current APIs

- Preserve HU-073 struct-construction and inferred-Sendable rules.
- Remove redundant explicit `nonisolated` and inferable internal `Sendable`
  only after a structural audit preserves semantic witnesses/boundaries.
- Reclassify existentials by real substitution requirements; no global rewrite.
- Modernize date formatting, regex, clocks/sleeps, callbacks, and current
  SwiftUI APIs only behind behavior tests.
- Keep moves, renames, formatting, and one-View-per-file cleanup separate from
  behavior changes.
- Update DocC only for changed, non-trivial contracts.

### Phase 9 - Hardening and release closure

- Reach zero first-party compiler and lint warnings before enabling
  warnings-as-errors.
- Run full unit, UI smoke, Release, Archive, physical-device checks, and
  Crashlytics dSYM validation.
- Validate VoiceOver, Dynamic Type, Reduce Motion, phone/iPad, multitasking,
  multiwindow, and localization.
- Review notification-permission timing as a separate product/behavior choice.
- Run final independent architecture/concurrency, tests, and SwiftUI reviews.
- Close ADR implementation state, delivery evidence, parity, and remaining
  debt without adopting iOS/Xcode 27-only rules.

## 6. Required activation contract for every follow-up story

Before a roadmap phase or slice becomes `ready`, its spec must contain:

| Evidence | Required content |
| --- | --- |
| Initial inventory | Exact files, routes/components, states, warnings/diagnostics, and baseline counts |
| Preserved contracts | Named behavior, ownership, security, cancellation, navigation, and visual invariants |
| Executable gates | Exact scheme, configuration, destination/test plan, test identifiers, and expected result |
| UI matrix | Named routes/states and required phone/iPad, Large, XXX Large, AX5, light/dark, ES/EN, VoiceOver, and motion checks |
| Completion delta | Initial count, final count, and explicit residual debt |
| Exceptions | Owner, rationale, focused tests, approval/ADR when required, and removal condition |

This activation record is the measurable definition of a slice; phrases such
as "equivalent layout" or "current API" are not sufficient on their own.

## 7. Per-file workflow

Before editing a file:

1. Identify its layer, responsibility, actor owner, callers, and tests.
2. Read the applicable ADR and remote/data contract.
3. Classify the action: preserve, simplify, split, move, rename, or remove.
4. Add characterization first when behavior is not already protected.

Before closing a file/cluster:

1. Refresh compiler diagnostics under the `nonisolated` module policy.
2. Run the focused suite and the active story's fast lane.
3. Run strict SwiftLint and `git diff --check` when they are active gates.
4. Confirm no unsafe concurrency escape, hidden Data construction, or unowned
   task was introduced.
5. For SwiftUI, verify state ownership, localization, accessibility, previews,
   motion, and adaptive layout against the story matrix.
6. Update selective DocC only when a semantic contract changed.

## 8. Delivery strategy

- HU-074's branch contains only Phase 0 and, after authorization, Phase 1.
- Every follow-up HU starts from its approved base after its predecessor gate;
  it does not accumulate indefinitely on the HU-074 branch.
- Do not mix compiler recovery with layout, navigation, renaming, test
  migration, Firebase upgrade, or feature behavior.
- Use Conventional Commits before every commit as required by `AGENTS.md`.
- Commit, push, pull request, merge, issue closure, and branch deletion each
  require the corresponding user authorization.

## 9. Cross-cutting risks

- Hidden main-actor assumptions -> classify ownership before annotation and
  maintain the diagnostic ledger.
- Router suspension breaks synchronous fences -> preserve non-suspending state
  transitions and test exact ordering.
- Firebase sendability pressure -> own SDK references and transform them into
  immutable boundary values.
- Oversized story/branch -> activate only one measurable phase or vertical
  slice per HU.
- Visual drift from scale removal -> migrate by component/route with comparison
  previews and device validation.
- Test runtime becomes prohibitive -> use a focused lane per cluster and full
  gates at story closure.
