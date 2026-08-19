# HU-077 - Consolidate the iOS composition root and app shell

## Metadata

- issue_id: #255
- priority: P1
- platform: ios
- status: delivered
- plan_state: completed

## Authorization and delivery boundary

The maintainer activated Phase 4 on 2026-08-19 with the verbatim instruction:
"Pues adelante con la siguiente fase, abre issue, rama etc".

That instruction authorized the HU-077 bootstrap and implementation within this
specification: issue, branch, spec, plan, tasks, baseline, tests, and production
changes. The maintainer subsequently authorized full repository delivery with
the verbatim instruction: "haz commit y push, lanza pr y cierra issue, etc".
Commit, push, a ready pull request, merge, issue closure, branch deletion, and
integration are therefore authorized. Firebase deployment remains outside the
requested delivery scope.

HU-077 starts from integrated `main` at `907e403`. Issues #249, #250, and #251
are closed as completed, and their branch tips are contained in `main`.

## Context and problem

ADR-0004 requires App to compose the iOS graph and inject already constructed
dependencies into Presentation. HU-076 made runtime and Firebase ownership
compiler-checkable, but intentionally retained one composition violation for
Phase 4: `Presentation/Root/SessionViewModelDependencies.swift` still imports
Firebase, constructs live Data implementations, reads launch arguments, and
selects mock behavior.

Composition decisions are also distributed across `ReguertaAppEnvironment`,
`SessionViewModelDependencies`, `ProductsFeatureDependencies`,
`MyOrderFreshnessFeatureDependencies`, `AppDelegate`, and an
`AccessRootViewModel` default closure. `ReguertaAppEnvironment.live()` can
return the UI-testing graph based on `-useMockAuth`, so the method name does not
prove which graph was built. Ten Presentation constructor defaults use
`.preview()`, allowing an incomplete root to compile as a preview graph.

At the shell boundary, `AccessRootRoutingView` gives twelve files transitive
access to the complete `ReguertaAppEnvironment`, root model, session model,
feedback center, tokens, URL opener, and a broad set of bindings. `ContentView`
is used only by its own preview and `AccessRootView` has no consumer. These
facts must be characterized before removing compatibility wrappers or
narrowing route dependencies.

## User story

As an iOS maintainer, I want App to select one explicit scenario and compose
one complete dependency graph, so that Presentation cannot construct live SDK
dependencies or silently substitute preview behavior and each route exposes
only the dependencies it consumes.

## Scope

### In scope

- Move live Firebase/Data construction out of
  `Presentation/Root/SessionViewModelDependencies.swift` and into App-owned
  composition.
- Keep Presentation dependency bundles limited to protocols, use cases,
  immutable values, clocks, and already constructed collaborators.
- Remove live/preview selection and no-op infrastructure implementations from
  the Presentation dependency bundle. Place preview and test doubles in App
  preview support or test support according to their actual consumer.
- Introduce one typed App-owned launch/scenario configuration that reads
  process arguments once and is passed explicitly to the root and
  `AppDelegate`.
- Compose live, preview, and UI-test graphs explicitly. A missing or incomplete
  live graph must fail visibly and must never fall back to preview or UI-test.
- Preserve intentional shared identity for feedback, session, environment,
  clocks, repositories, Functions, media, notifications, freshness, and device
  coordination.
- Split `ReguertaAppEnvironment` by scenario only in mechanical steps that
  preserve the effective graph; do not change ownership and file layout in the
  same uncharacterized cut.
- Remove implicit `.preview()` defaults from production/root Presentation
  construction and update tests/previews to request preview dependencies
  explicitly.
- Prove whether `ContentView` and `AccessRootView` are compatibility aliases,
  then remove only the wrappers with no consumer.
- Replace broad `AccessRootRoutingView` transitive access with explicit models,
  values, bindings, and semantic actions at each route boundary.
- Extract shell/router/startup/lifecycle stores only when one cohesive owner
  and deterministic tests justify the split.
- Preserve auth routing, typed reducer transitions, splash/startup behavior,
  scene lifecycle handling, feedback, push registration, session revision,
  leases, cancellation, and owner-only cleanup.
- Add deterministic characterization and structural regression coverage before
  each behavioral-risk cut.

### Out of scope

- Replacing the current navigation model with a value-based navigation stack.
- Changing authentication, authorization, session, routing, startup, push, or
  product behavior.
- Phase 5 adaptive layout, accessibility matrix, and DesignSystem foundation.
- Phase 6 vertical feature stories.
- Android parity work. The ownership gap recorded by HU-076 remains a separate
  governed follow-up.
- Functions, Firebase schema/rules, live data, deployment, or backend changes.
- Firebase/SPM upgrades or `Package.resolved` changes.
- XCTest migration, validation-lane redesign, or remote CI selection.
- Deployment-target, Swift-mode, project-format, or iOS/Xcode 27 adoption.
- Commit, push, PR, merge, issue closure, branch deletion, deployment, or
  integration without separate authorization.

## Composition contract

1. App selects exactly one typed scenario before composing dependencies.
2. A scenario constructs exactly one complete graph. Production never consults
   preview or UI-test factories as fallback behavior.
3. Presentation receives contracts and values. It does not import Firebase or
   construct concrete live Data/SDK implementations.
4. Launch arguments are decoded once by App. Downstream owners receive typed
   configuration and do not reread `ProcessInfo`.
5. App/UI composition runs on its declared main-actor owner. SDK adapters keep
   their actor ownership, and only checked values/contracts cross isolation
   boundaries; moving factories cannot introduce an unsafe escape.
6. Preview and UI-test graphs do not configure Firebase and do not share
   mutable state with another graph.
7. Shared collaborators remain shared only where the current graph deliberately
   relies on identity. Mechanical movement cannot duplicate them accidentally.
8. Production/root initializers require their complete dependency bundles.
   Preview dependencies are explicit at preview and test call sites.
9. Views receive the smallest useful boundary: immutable input, a true editing
   binding, or a semantic action. The SwiftUI environment is not a service
   locator for arbitrary feature work.
10. Existing auth and shell reducer behavior remains authoritative. Navigation
   modernization requires a separately characterized story.
11. A shell/startup/lifecycle store is extracted only if one cohesive mutation
    domain and tests demonstrate that ownership; file size alone is not a
    reason to create a store.

## Linked requirements and decisions

- `AGENTS.md` repository workflow and iOS maintenance rules.
- ADR-0001: MVVM and Clean Architecture.
- ADR-0004: root dependency injection for iOS SwiftUI.
- ADR-0008, ADR-0009, and ADR-0010: session, device, and feed ownership.
- ADR-0011: project-level `nonisolated` isolation and explicit owners.
- ADR-0012: instance-owned runtime context and Firebase SDK references.
- HU-074 / #249, HU-075 / #250, and HU-076 / #251, all integrated.
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/255
- Reproducible starting inventory: `phase-4-baseline.md`.

No new ADR is required at bootstrap because this story materializes the App
composition boundary already accepted by ADR-0004 and the explicit Phase 4
debt in ADR-0012. Work stops for a new ADR if implementation proposes multiple
production roots, a service locator, different navigation ownership, a new
shell-state contract, or a concurrency exception.

## Acceptance criteria

- Production Presentation contains zero Firebase imports.
- Presentation contains zero construction of concrete live Data or Firebase
  implementations.
- `SessionViewModelDependencies` contains only injected contracts and values;
  it does not expose live/preview factories or inspect launch arguments.
- One App-owned production root builds the complete live graph.
- Live, preview, and UI-test scenarios are selected explicitly and cannot fall
  back to one another.
- Launch-argument reads have one App-owned authority; `AppDelegate`, features,
  and Presentation consume typed values.
- App/UI graph construction remains main-actor owned, SDK adapters keep their
  checked owners, and no unsafe concurrency escape is introduced.
- Preview and UI-test composition do not bootstrap Firebase and independently
  created graphs do not share mutable state.
- Identity tests protect every collaborator deliberately shared by multiple
  consumers in one graph.
- Production/root Presentation initializers have no `.preview()` defaults that
  can conceal an incomplete graph.
- Unused `ContentView`/`AccessRootView` wrappers are removed only after source
  and test evidence proves they have no consumer.
- The broad `AccessRootRoutingView` environment access is removed or replaced
  by explicit route dependencies; no new service locator appears.
- Reducer transitions, auth routes, splash/startup, lifecycle, push, session
  leases/revisions, cancellation, and owner-only cleanup remain characterized
  and behaviorally unchanged.
- Firebase imports remain confined to App/Data; no unsafe concurrency escape,
  package change, Android/Functions diff, or iOS/Xcode 27 rule is introduced.
- Fast unit, UI smoke, release gate, strict SwiftLint, effective settings,
  generic Debug, and Production Release pass with exact evidence.
- `git diff --check`, package/scope review, and independent iOS architecture
  review complete with zero unresolved P0-P3 findings.

## Validation contract

All commands run from `ios/Reguerta` on iPhone 17 / iOS 26.5 unless the
simulator is unavailable; any substitute must be another explicit iOS 26
destination and must be recorded.

| Gate | Exact command or identifiers | Required result |
| --- | --- | --- |
| Focused composition | Run the exact focused composition command below. | Exit 0; exact test counts recorded; 0 Firebase/live construction in Presentation |
| Shell regression | Run the exact shell regression command below. | Exit 0; reducer/auth/startup/lifecycle behavior unchanged |
| Fast unit | `./scripts/validate-ios.sh fast-unit --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` | Exit 0; every discovered unit responsibility accounted for; 0 failed/skipped unless explicitly justified |
| UI smoke | `./scripts/validate-ios.sh ui-smoke --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` | Exactly the four named journeys below pass |
| Release | `./scripts/validate-ios.sh release-gate --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` | Exit 0; exact logical pass/skip/fail counts recorded; only the known launch-matrix skip is accepted |
| SwiftLint | `./scripts/run-swiftlint.sh` | SwiftLint 0.61.0; 0 findings |
| Settings | `./scripts/verify-swift-settings.sh` | 6/6 target/configuration pairs pass |
| Debug build | `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` | Exit 0 |
| Release build | Same command with scheme `Reguerta-Production` and configuration `Release` | Exit 0 |
| Static/scope | Import/construction/argument/default/escape searches, package/platform diffs, and `git diff --check` | Targets met; no out-of-scope diff |
| Review | Independent maintenance-profile architecture/concurrency and SwiftUI/accessibility reviews | 0 unresolved P0-P3 |

Focused composition:

```sh
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug \
  -testPlan fast-unit-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:ReguertaTests/ReguertaRootDependencyTests \
  -only-testing:ReguertaTests/ReguertaAppCompositionBoundaryTests \
  -only-testing:ReguertaTests/ReguertaAppScenarioTests test
```

Shell regression:

```sh
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug \
  -testPlan fast-unit-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:ReguertaTests/ReguertaHomeNavigationTests \
  -only-testing:ReguertaTests/ReguertaSessionFeatureViewModelTests \
  -only-testing:ReguertaTests/ReguertaRootDependencyTests test
```

The UI-smoke identifiers are:

- `ReguertaUITests/testUnauthorizedUserShowsRestrictedMode`
- `ReguertaUITests/testPreAuthorizedProducerEntersHomeWithActionRowEnabled`
- `ReguertaUITests/testDrawerNavigationOpensSelectedRoute`
- `ReguertaUITests/testInvalidCredentialsShowsInlineErrorWithoutCrash`

## UI non-regression matrix

HU-077 changes composition and dependency exposure, not rendered layout, copy,
accessibility semantics, localization, or motion. Its required visual matrix is
therefore explicit non-regression rather than a Phase 5 visual redesign.

| Route/state | Phone functional check | iPad/multitasking | Large/XXX Large/AX5 | Light/dark | ES/EN | VoiceOver | Reduce Motion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unauthorized/restricted | Named UI smoke on iPhone 17 / iOS 26.5 | N/A: no layout change | N/A: no typography change | N/A: no style change | N/A: no copy change | N/A: no semantics change | N/A: no motion change |
| Pre-authorized home/action row | Named UI smoke on same destination | N/A | N/A | N/A | N/A | N/A | N/A |
| Drawer route selection | Named UI smoke on same destination | N/A | N/A | N/A | N/A | N/A | N/A |
| Invalid credentials feedback | Named UI smoke on same destination | N/A | N/A | N/A | N/A | N/A | N/A |
| Splash/startup/auth/home shell | Focused root/reducer suites and release gate | N/A | Large: 9/9 RenderPreview tool completions, `errors=[]`; one dedicated startup macro remained semantically ambiguous as recorded below | N/A | N/A | Runtime semantics independently reviewed | N/A |

If any cut changes layout, text, accessibility attributes, locale behavior, or
animation, this N/A rationale becomes invalid: work stops to add the affected
Phase 5 matrix and the appropriate visual/accessibility review.

## Risks

- Moving factories can duplicate stateful dependencies.
  - Control: characterize shared identity before moving each cluster.
- Scenario names can disagree with their effective graph.
  - Control: typed selection once in App and explicit fail-fast tests.
- Removing preview defaults can create broad test churn.
  - Control: migrate call sites mechanically and keep preview construction
    explicit in test/preview support.
- Narrowing the routing protocol can accidentally alter navigation.
  - Control: preserve the reducer and route enum, characterize behavior, and
    change one route boundary at a time.
- Store extraction can become an architecture rewrite.
  - Control: require a cohesive owner and tests; otherwise leave state in the
    existing root model.
- Phase 5/6 or Android work can blur the cut.
  - Control: keep layout, design, vertical features, and Android explicitly out
    of scope.

## Initial state

The branch `codex/hu-077-ios-composition-root-app-shell` was created from clean,
synchronized `main` at `907e403`. Issue #255 is open with the standard iOS/App
P1 labels. The five planning artifacts are local and uncommitted. The first
implementation step is the characterization suite described by the baseline;
no production source has been changed by the bootstrap.

## Local implementation and validation evidence

HU-077 is implemented and executable-validated locally. It closes the
composition debt carried by ADR-0012: Presentation contains no Firebase import
or known live adapter construction, and `SessionViewModelDependencies` is a
passive injected bundle. `ReguertaAppConfiguration` decodes the supported
arguments once in App and dispatches exactly one live, preview, or UI-test
factory without fallback.

The graph-identity regression uses the pure
`ReguertaAppEnvironment.assemble` seam. Tests inject in-memory/no-op
collaborators into the same value assembly used by composition, so they prove
intentional shared identity without starting Firebase, using the network, or
sleeping. `ReguertaAppConfiguration` also decodes the fourth supported launch
control, `-reguerta_dev_time_machine.override_now_millis`, once in App. It
requires one adjacent `Int64` value and fails fast for malformed input. The
typed initial seed takes precedence over persisted state. Live keeps its
persistent development clock, while preview and UI-test graphs receive
independent transient clocks routed through root, session, features, and
Freshness. Live Freshness deliberately retains its default `Date` wall clock.

The structural Data boundary inventories the concrete declarations visible to
Presentation. Its only inherited allowlist entry is the typed error case
`FirebaseFunctionClientError.unauthorized`, required at exactly one existing
use site; it does not permit live construction or any additional Data type
reference.

The root-shell boundary now has one App-environment reader, `MainView`.
`ContentView`, `AccessRootView`, and `AccessRootRoutingView` are absent, and
routes receive only explicit root/session models, feedback data/actions,
tokens, and URL actions that they use. Existing reducer, auth, startup, splash,
lifecycle, overlays, feedback, and route meaning remain unchanged. The seven
shell views each live in one source file and own a deterministic preview.

### Honest red/green record

The retained red evidence includes the pre-change structural counts, the lack
of a safe non-Firebase graph-identity seam, and the reproduced `timedOut`
preview being overwritten to `unavailable`. It also includes
`/private/tmp/hu077-final-release-gate.xcresult`: 615 logical responsibilities,
613 passed, the known launch skip, and one failure in
`ReguertaUITests.testMyOrderSearchBarStaysAboveBottomSafeArea` because the
search field was not found. The UI-test clock had become transient but had
stopped receiving the launch seed
`-reguerta_dev_time_machine.override_now_millis 1778760000000`. The typed
configuration/clock fix above restored the deterministic My Order state.

Green coverage rejects Firebase and live construction in Presentation, proves
shared/independent graph identity, checks explicit scenario dispatch and clock
routing, verifies narrow shell ownership and preview stability, and preserves
root behavior. Because the work was split into coordinated clusters, some
first suite executions were blocked by another cluster's partial compilation;
HU-077 does not claim a standalone executable red for every mechanical edit.

### Final gates

The validated tree contains 375 Swift files and 63,992 lines: production
261/36,243, unit 112/27,365, and UI 2/384. The unit inventory is 602 Swift
Testing `@Test` declarations plus 6 XCTest methods, for 608 responsibilities.

| Gate | Result |
| --- | --- |
| Normative focused matrix | 33 logical tests; 34 dynamic executions; 0 failed, 0 skipped |
| Shell/root focal | 21/21 passed |
| Fast unit | 608/608 passed; 0 failed, 0 skipped |
| UI smoke | 4/4 passed |
| Release gate | `/private/tmp/hu077-final-release-gate-2.xcresult`: 617 total, 616 passed, one known `ReguertaUITestsLaunchTests/testLaunch` skip, 0 failed |
| SwiftLint | 0.61.0; 375 files; 0 violations |
| Effective settings | 6/6 passed |
| Builds | Generic Debug and `Reguerta-Production` Production Release green |
| RenderPreview | Xcode MCP `windowtab2`, Large: 9/9 snapshots, `errors=[]`; Home passed one isolated retry after a transient `PotentialCrashError` |
| Independent review | Final architecture/code and SwiftUI/accessibility reviews completed; 0 unresolved P0-P3 |

The post-P1 preview rerun has one honest semantic limitation. The dedicated
startup `unavailable` macro at index 0 repeatedly displayed `timedOut` even
though its source fixture is `.unavailable`. `MainView` displayed
`unavailable` for the same fixture and the runtime test distinguishes both
states. The evidence therefore proves 9/9 RenderPreview tool completion, but
not nine semantically unambiguous macro selections. Cache or macro selection
inside RenderPreview for previews sharing one source file is the current
inference, not a demonstrated application-state defect.

Final structural/scope checks report Presentation Firebase 0, one
`ProcessInfo.processInfo.arguments` read in App, targeted implicit preview
defaults 0, broad protocol/wrappers 0, and unsafe concurrency escapes 0.
`git diff --check` passes; `project.pbxproj`, `Package.resolved`, Android,
Functions, and iOS/Xcode 27 scope are clean.

## Delivery status

Source commit `c29bd04f6aab6b6190d75996ac04880c1f0c9d04` was published on
`codex/hu-077-ios-composition-root-app-shell`. Ready PR #256 merged it into
`main` as `68a036a5fce7d00b8ed0a79db4057df5cf584783` on 2026-08-19, and its
`Closes #255` linkage closed issue #255 as completed. The delivery branch is
retained only to carry this final documentation reconciliation and is removed
after that reconciliation merges. Firebase deployment was not performed and
remains outside the delivered scope.
