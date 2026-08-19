# HU-077 Phase 4 baseline - iOS composition root and app shell

## Authority and snapshot

- Date: 2026-08-19.
- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/255.
- Branch: `codex/hu-077-ios-composition-root-app-shell`.
- Base/HEAD before bootstrap edits: `907e403e79a60cd420bd0252b4768f4a62840471`.
- Base branch: clean, synchronized `main` after PRs #254, #252, and #253.
- Profile: iOS `maintenance`.
- Toolchain contract: Xcode/iOS 26, Swift 6, complete strict concurrency,
  Approachable Concurrency, and iOS deployment target 26.0.
- No production code, test code, package, project, Android, or Functions change
  is part of the bootstrap snapshot.

## Inherited validated tree

HU-077 starts from the exact HU-076 integrated tip and inherits its accepted
closure evidence; these gates have not been rerun by the bootstrap itself.

| Area | Files | Lines |
| --- | ---: | ---: |
| iOS production | 253 | 36,197 |
| iOS unit tests | 108 | 26,403 |
| iOS UI tests | 2 | 384 |
| Total Swift | 363 | 62,984 |

Static test inventory:

- 574 Swift Testing `@Test` declarations.
- 6 XCTest unit methods.
- 9 XCTest UI methods.

Inherited executable evidence:

- Fast unit: 580/580 passed, 0 skipped, 0 failed.
- UI smoke: 4/4 passed.
- Release gate: 589 logical responsibilities; 588 passed, 1 known skip, 0
  failed.
- SwiftLint 0.61.0: 363 files, 0 violations.
- Effective Swift settings: 6/6.
- Generic Debug and `Reguerta-Production` Release builds: green.
- Independent HU-076 review: 0 P0-P3.

These values are a starting checkpoint, not HU-077 closure evidence. They must
be replaced with current post-change gate results before delivery.

## Composition inventory

| Concern | Baseline | HU-077 target |
| --- | --- | --- |
| Firebase-importing Presentation files | 1 file, 2 imports: `SessionViewModelDependencies.swift` | 0 files / 0 imports |
| Concrete live construction in Presentation | `SessionViewModelDependencies.live` creates Firebase/Data and selects mocks | 0 live concrete construction |
| Launch-argument reads | 7 reads in 6 production files | One App-owned decoder/authority |
| Implicit Presentation `.preview()` defaults | 10 declarations | 0 in production/root constructors that can mask an incomplete graph |
| App environment size | `ReguertaAppEnvironment.swift`: 361 lines and three scenarios | Cohesive scenario composition without graph drift |
| Session dependency file | 146 lines, live/preview factories plus two no-op implementations | Passive contracts/values bundle |
| Broad routing protocol | 19 textual references across 12 Presentation files | Explicit route inputs/bindings/actions |
| `ContentView` | Only instantiated by its own preview | Remove or repurpose from evidence |
| `AccessRootView` | No constructor/reference consumer | Remove from evidence |

## Distributed scenario selection

The seven current `ProcessInfo.processInfo.arguments` reads are:

1. `ReguertaAppEnvironment.live()` selects UI testing for `-useMockAuth`.
2. `makeLiveSessionViewModel` branches again on `-useMockAuth`.
3. `SessionViewModelDependencies.live` branches on `-useMockAuth`.
4. `AppDelegate` disables Firebase/push behavior for `-useMockAuth`.
5. `ProductsFeatureDependencies.live` selects mock products for
   `-useMockProductData`.
6. `MyOrderFreshnessFeatureDependencies` selects preview freshness for
   `-useMockAuth`.
7. `AccessRootViewModel` derives `shouldSkipSplash` from `-skipSplash`.

The root problem is not the existence of supported launch controls; it is that
the graph rereads and interprets them in six owners. The target is one typed
App configuration passed to every consumer.

## Current graph entry points

`ReguertaAppEnvironment` exposes three static entry points:

- `live()` configures Firebase, but currently returns `uiTesting()` when
  `-useMockAuth` is present.
- `preview()` builds in-memory/no-op collaborators.
- `uiTesting()` builds mock-backed collaborators and an injected development
  clock.

`ReguertaApp.init()` always calls the method named `live()`. Effective scenario
selection therefore happens inside a factory rather than at the App boundary.
`AppDelegate` independently rereads the mock-auth argument to decide whether to
configure Firebase Messaging and push registration.

## Stateful identity map to preserve

The following identity relationships require characterization before factory
movement:

- one `GlobalFeedbackCenter` is shared by `SessionViewModel` and
  `AccessRootViewModel`;
- one runtime environment store backs the live router and environment-sensitive
  feature/startup fences;
- the live member repository is shared by session resolution and Users admin
  composition where currently intentional;
- one authenticated Functions client is shared by authorized-member resolution,
  member administration, and shift operations;
- one image pipeline is shared by Products, News, and Shared Profile;
- one notification repository is shared by Shifts and News/Notifications;
- one critical-freshness local repository is shared by session cleanup and the
  Freshness feature;
- one authorized-device coordinator is passed to session and AppDelegate;
- one injected `DevelopmentTimeMachine` supplies feature clocks in preview and
  UI-test graphs.

The implementation must confirm each relationship against actual constructors
and tests. This list is a risk map, not permission to increase sharing.

## Presentation shell inventory

- `ContentView` is a one-line wrapper around `MainView` and is instantiated
  only in the preview at the bottom of the same file.
- `AccessRootView` is another one-line wrapper around `MainView` and has no
  consumer.
- `AccessRootRoutingView` requires the complete `ReguertaAppEnvironment`,
  design tokens, and URL opener.
- Its extensions expose the complete root/session/feedback objects, many root
  bindings, session bindings, auth helpers, and startup/lifecycle actions.
- Five root/shell views conform directly, while Auth, Home, Bylaws, and Shifts
  route extension files receive the same transitive surface.

HU-077 will replace that broad surface incrementally. It will not change route
meaning, reducer actions, or navigation ownership without a separate decision.

## Reproducible inventory commands

```sh
rg -n '^import Firebase' ios/Reguerta/Reguerta/Presentation -g '*.swift'
rg -n 'ProcessInfo\.processInfo\.arguments' ios/Reguerta/Reguerta -g '*.swift'
rg -n '= \.preview\(' ios/Reguerta/Reguerta/Presentation -g '*.swift'
rg -n 'AccessRootRoutingView' ios/Reguerta/Reguerta/Presentation -g '*.swift'
rg -n '\bContentView\s*\(' ios/Reguerta/Reguerta -g '*.swift'
rg -n '\bAccessRootView\s*\(' ios/Reguerta/Reguerta -g '*.swift'
```

Source/test counts use `rg --files -g '*.swift'` plus `wc -l`; Swift Testing
responsibilities count every line containing `@Test`, including the existing
`@MainActor @Test` declaration. XCTest counts are limited to files importing
XCTest and methods whose names start with `test`.

## Initial validation and scope state

- `main` was fast-forward current before branch creation.
- Issue #255 exists with the standard `enhancement`, `platform:ios`,
  `priority:P1`, and `area:app` labels.
- The branch is local and has no upstream yet.
- No commit, push, PR, merge, issue closure, branch deletion, or deployment is
  authorized.
- Android, Functions, `Package.resolved`, and Xcode project settings are
  untouched by bootstrap.
- `git diff --check` must pass after creating the planning artifacts.

## First implementation gate

Before moving production composition, add deterministic tests that:

1. characterize intentional live-graph identities through injectable factory
   seams without real Firebase access;
2. prove independent preview/UI-test graphs do not share mutable state;
3. reproduce the current implicit scenario/fallback boundary as the red target;
4. reject Firebase imports and known live concrete construction in
   Presentation; and
5. preserve auth/root/startup/push behavior through explicit scenario input.

## Activated executable and UI matrix

- Canonical destination: `platform=iOS Simulator,name=iPhone 17,OS=26.5`.
- Fast unit: `./scripts/validate-ios.sh fast-unit --destination <destination>`;
  all discovered unit responsibilities pass.
- UI smoke: `./scripts/validate-ios.sh ui-smoke --destination <destination>`;
  the four identifiers in `spec.md` pass 4/4.
- Release: `./scripts/validate-ios.sh release-gate --destination
  <destination>`; exit 0, exact counts recorded, only the known launch skip
  accepted.
- Debug and Production Release use the exact generic-simulator commands in
  `spec.md`.
- Focused composition/shell suites use `fast-unit-v1` and the same destination.
- The UI matrix is a documented no-rendering-change matrix: phone smoke routes
  execute, while iPad/multitasking, Dynamic Type, light/dark, ES/EN, VoiceOver,
  and Reduce Motion are N/A only because HU-077 does not alter those surfaces.
  Any rendered/semantic change invalidates that N/A and expands the matrix.
- Closure requires separate architecture/concurrency and SwiftUI/accessibility
  read-only reviews.

## Final local closure snapshot

This section records the post-change state. The earlier sections remain the
reproducible pre-change baseline and are not rewritten as if they described the
final tree.

| Area | Files | Lines |
| --- | ---: | ---: |
| iOS production | 261 | 36,243 |
| iOS unit tests | 112 | 27,365 |
| iOS UI tests | 2 | 384 |
| Total Swift | 375 | 63,992 |

The Phase 4 targets are complete locally:

- Presentation has zero Firebase imports and zero known live Firebase/Data
  construction.
- The structural Data declaration guard has one narrow inherited exception:
  `FirebaseFunctionClientError.unauthorized` may appear at exactly one existing
  Presentation use site; it does not authorize live construction.
- `SessionViewModelDependencies` is a passive bundle of injected contracts and
  values; live, preview, and test factories live in their appropriate owners.
- `ProcessInfo.processInfo.arguments` has one production read in App.
- Targeted implicit Presentation `.preview()` defaults are zero.
- `ContentView`, `AccessRootView`, `AccessRootRoutingView`, and their broad
  transitive dependency surface have zero production references.
- `MainView` is the single shell reader of `ReguertaAppEnvironment`; route,
  overlay, feedback, token, and URL dependencies are explicit.
- Unsafe concurrency escapes are zero.

### Characterization and TDD chronology

The retained red evidence is reported narrowly. The baseline structural
searches exposed one Firebase-importing Presentation file, seven distributed
argument reads, ten implicit preview defaults, nineteen broad-protocol
references, and two unused wrappers. The shell characterization failed those
targets until the wrappers/protocol were removed and explicit route inputs were
introduced. The `timedOut` preview was also reproduced rendering the
`unavailable` state before its fixture marked startup evaluation complete.

Composition identity could not be tested safely through the concrete live
factory because doing so would initialize Firebase. The green design therefore
introduced a pure `ReguertaAppEnvironment.assemble` seam: tests supply only
in-memory/no-op collaborators and prove the identities shared by the real
assembly without network, Firebase bootstrap, or real sleeps. Not every
coordinated cut retained an independently executable red run; some first runs
were compilation-blocked by another in-progress cluster. HU-077 does not claim
universal test-first chronology.

`ReguertaAppConfiguration` decodes the fourth supported launch control,
`-reguerta_dev_time_machine.override_now_millis`, exactly once in App. The flag
requires one adjacent `Int64` and malformed input fails fast. That typed seed
takes precedence over persisted state. Live keeps its persistent development
clock; preview and UI-test graphs each route one independent transient
`DevelopmentTimeMachine` through root, session, features, and freshness. Live
Freshness deliberately retains its default wall clock based on `Date`,
preserving production cache-expiration semantics.

The first full release gate is retained as honest red evidence:
`/private/tmp/hu077-final-release-gate.xcresult` recorded 615 responsibilities,
613 passed, the known launch skip, and one failure in
`ReguertaUITests.testMyOrderSearchBarStaysAboveBottomSafeArea` because the
search field was not found. The UI-test clock had become transient without
receiving the launch seed
`-reguerta_dev_time_machine.override_now_millis 1778760000000`. The typed seed
fix restored the deterministic My Order state exercised by the final gates.

### Executed validation

| Gate | Final evidence |
| --- | --- |
| Normative focused matrix | 33 logical tests; 34 dynamic executions; 0 failed, 0 skipped |
| Shell/root focal | 21/21 passed |
| Fast unit | 608/608 passed (602 Swift Testing plus 6 XCTest); 0 failed, 0 skipped |
| UI smoke | 4/4 passed |
| Release gate | `/private/tmp/hu077-final-release-gate-2.xcresult`: 617 total, 616 passed, 1 known `ReguertaUITestsLaunchTests/testLaunch` skip, 0 failed |
| SwiftLint | 0.61.0; 375/375 files; 0 violations |
| Effective settings | 6/6 target/configuration pairs passed |
| Generic builds | Debug and `Reguerta-Production` Production Release passed |
| Previews | Xcode MCP `windowtab2`, Large: 9/9 snapshots, `errors=[]`; Home passed one isolated retry after a transient `PotentialCrashError` |
| Independent review | Final architecture/code and SwiftUI/accessibility reviews completed; 0 unresolved P0-P3 |
| Repository audit | `git diff --check` passed; `project.pbxproj`, `Package.resolved`, Android, Functions, and iOS/Xcode 27 scope are clean |

The preview gate is tool-complete but has one semantic limitation. The
dedicated startup `unavailable` macro at index 0 repeatedly displayed
`timedOut` even though its source fixture is `.unavailable`. `MainView`
displayed `unavailable` with the same fixture and the runtime test distinguishes
the states. This supports a RenderPreview cache/selection inference for macros
sharing a source file; it does not establish an application-state defect, and
the 9/9 result must not be read as nine semantically unambiguous selections.

## Delivery state

Issue #255 remains open while the authorized delivery executes. The branch
`codex/hu-077-ios-composition-root-app-shell` is local and has no upstream at
this checkpoint. The later instruction "haz commit y push, lanza pr y cierra
issue, etc" authorizes commit, push, a ready pull request, merge, issue closure,
branch deletion, and integration. Firebase deployment remains outside scope.
The five HU-077 artifacts and aligned ADR notes are the final local closure
evidence; the remote issue body will be refreshed before merge.
