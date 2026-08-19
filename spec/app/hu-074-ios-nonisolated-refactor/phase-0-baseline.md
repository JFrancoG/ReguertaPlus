# HU-074 Phase 0 baseline - 2026-08-19

## Reproducible environment

- Git base: `main` and `origin/main` at `0d698f1` when the story branch was
  created.
- Branch: `codex/hu-074-ios-nonisolated-refactor`.
- Xcode: 26.6.
- Swift: 6.3.3, Swift language mode 6.
- iOS deployment target: 26.0.
- Compiler policy: complete strict concurrency and Approachable Concurrency.
- Firebase iOS SDK: 12.15.0 in `Package.resolved`.
- Initial source/configuration diff: only the maintainer's app-target Debug and
  Release change from `MainActor` to `nonisolated` in `project.pbxproj`.

## Source and test inventory

| Area | Swift files | Lines |
| --- | ---: | ---: |
| Production | 249 | 34,516 |
| Unit tests | 81 | 19,122 |
| UI tests | 2 | 384 |
| Total | 332 | 54,022 |

The production layer inventory is App 14, Core 2, Data 53, DesignSystem 19,
Domain 53, and Presentation 107 files. Xcode discovered 492 enabled tests; no
test execution is reported because compilation fails first.

## Reproducible Debug build

Run from `ios/Reguerta`:

```sh
xcodebuild -quiet \
  -project Reguerta.xcodeproj \
  -scheme Reguerta \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build \
  CODE_SIGNING_ALLOWED=NO
```

Result: exit 65, `BUILD FAILED`. The compiler stopped in its first failing
source batch with these three first-party diagnostics:

| ID | Location | Compiler diagnostic | Classification | Status |
| --- | --- | --- | --- | --- |
| C-001 | `Domain/Access/ResolveAuthorizedSessionUseCase.swift:48:41` | `Call to main actor-isolated instance method 'resetToBaseEnvironment(ifOwnedBy:)' in a synchronous caller isolation inheriting-isolated context` | Session-environment owner and synchronous invalidation fence | Open |
| C-002 | `Domain/Access/ResolveAuthorizedSessionUseCase.swift:41:33` | `Main actor-isolated instance method 'applyResolvedEnvironment(_:lease:)' cannot be called from outside of the actor` | Session-environment owner and operation ordering | Open |
| C-003 | `Domain/Freshness/ResolveCriticalDataFreshnessUseCase.swift:31:46` | `Main actor-isolated instance method 'getMetadata()' cannot be called from outside of the actor` | Local-store owner and freshness orchestration | Open |

This ledger deliberately does not claim that these are the only migration
errors. Phase 1 refreshes this table after each root cluster so newly exposed
diagnostics are recorded rather than confused with cascades.

## Focused file-diagnostic snapshot

With the same project and checkout open in Xcode, a fresh
`RefreshCodeIssuesInFile` inspection reproduced another 20 file-local
diagnostics. They are candidates, not proof that a full build reaches each
site; some may disappear when a root owner is corrected. The three build
errors above also reappeared in focused refreshes and are not counted again.

| ID | Location | Current file-local diagnostic |
| --- | --- | --- |
| F-001 | `Data/Firestore/ReguertaFirestorePath.swift:7` | Static property `sessionOverride` is not concurrency-safe because it is nonisolated global shared mutable state |
| F-002 | `Data/Firestore/ReguertaFirestorePath.swift:8` | Static property `sessionEnvironmentLease` is not concurrency-safe because it is nonisolated global shared mutable state |
| F-003 | `Data/Firestore/ReguertaFirestorePath.swift:9` | Static property `testingBaseEnvironment` is not concurrency-safe because it is nonisolated global shared mutable state |
| F-004 | `Presentation/Root/SessionViewModelDependencies.swift:46` | Call to main actor-isolated initializer `init(auth:)` in a synchronous nonisolated context |
| F-005 | `Presentation/Root/SessionViewModelDependencies.swift:48` | Call to main actor-isolated initializer `init(baseEnvironment:onApply:onReset:)` in a synchronous nonisolated context |
| F-006 | `Presentation/Root/SessionViewModelDependencies.swift:48` | Call to main actor-isolated initializer `init(transitionSignal:)` in a synchronous nonisolated context |
| F-007 | `Presentation/Root/SessionViewModelDependencies.swift:61` | Call to main actor-isolated initializer `init(client:)` in a synchronous nonisolated context |
| F-008 | `Presentation/Root/SessionViewModelDependencies.swift:62` | Call to main actor-isolated initializer `init(baseURL:tokenProvider:dataLoader:requestTimeout:encoder:decoder:)` in a synchronous nonisolated context |
| F-009 | `Presentation/Root/SessionViewModelDependencies.swift:80` | Call to main actor-isolated initializer `init(userDefaults:)` in a synchronous nonisolated context |
| F-010 | `Presentation/Root/SessionViewModelDependencies.swift:97` | Call to main actor-isolated initializer `init(baseEnvironment:onApply:onReset:)` in a synchronous nonisolated context |
| F-011 | `App/ReguertaAppEnvironment.swift:52` | `Call to main actor-isolated initializer 'init(sessionViewModel:feedbackCenter:productsFeatureDependencies:ordersFeatureDependencies:shiftsFeatureDependencies:newsNotificationsFeatureDependencies:sharedProfileFeatureDependencies:usersFeatureDependencies:myOrderFreshnessFeatureDependencies:bylawsFeatureDependencies:startupVersionGateUseCase:shouldSkipSplashProvider:installedVersionProvider:startupGateTimeout:startupGateSleeper:initialNowOverrideMillis:)' in a synchronous nonisolated context` |
| F-012 | `App/ReguertaAppEnvironment.swift:139` | `Call to main actor-isolated initializer 'init(sessionViewModel:feedbackCenter:productsFeatureDependencies:ordersFeatureDependencies:shiftsFeatureDependencies:newsNotificationsFeatureDependencies:sharedProfileFeatureDependencies:usersFeatureDependencies:myOrderFreshnessFeatureDependencies:bylawsFeatureDependencies:startupVersionGateUseCase:shouldSkipSplashProvider:installedVersionProvider:startupGateTimeout:startupGateSleeper:initialNowOverrideMillis:)' in a synchronous nonisolated context` |
| F-013 | `App/ReguertaAppEnvironment.swift:194` | Call to main actor-isolated initializer `init(auth:)` in a synchronous nonisolated context |
| F-014 | `App/ReguertaAppEnvironment.swift:201` | Call to main actor-isolated initializer `init(baseURL:tokenProvider:dataLoader:requestTimeout:encoder:decoder:)` in a synchronous nonisolated context |
| F-015 | `App/ReguertaAppEnvironment.swift:205` | Call to main actor-isolated initializer `init(client:environmentProvider:)` in a synchronous nonisolated context |
| F-016 | `App/ReguertaAppEnvironment.swift:211` | Call to main actor-isolated initializer `init(userDefaults:)` in a synchronous nonisolated context |
| F-017 | `App/ReguertaAppEnvironment.swift:213` | Call to main actor-isolated initializer `init(db:)` in a synchronous nonisolated context |
| F-018 | `App/ReguertaAppEnvironment.swift:242` | Call to main actor-isolated initializer `init(client:)` in a synchronous nonisolated context |
| F-019 | `App/ReguertaAppEnvironment.swift:248` | Call to main actor-isolated initializer `init(transitionSignal:)` in a synchronous nonisolated context |
| F-020 | `App/ReguertaAppEnvironment.swift:260` | `Call to main actor-isolated initializer 'init(sessionViewModel:feedbackCenter:productsFeatureDependencies:ordersFeatureDependencies:shiftsFeatureDependencies:newsNotificationsFeatureDependencies:sharedProfileFeatureDependencies:usersFeatureDependencies:myOrderFreshnessFeatureDependencies:bylawsFeatureDependencies:startupVersionGateUseCase:shouldSkipSplashProvider:installedVersionProvider:startupGateTimeout:startupGateSleeper:initialNowOverrideMillis:)' in a synchronous nonisolated context` |

F-001 through F-003 are open mutable-state ownership roots. F-004 through
F-020 are open call-site candidates that may be cascades from the owner chosen
for their constructed dependency.

The focused refresh returned zero diagnostics for
`RuntimeSessionEnvironmentRouter.swift`, `FirebaseAuthSessionProvider.swift`,
`SessionViewModel.swift`, and `GlobalFeedbackCenter.swift`. This is only a
file-local control snapshot, not evidence that those files are correct under a
full build.

## Reproducible strict lint

Run from `ios/Reguerta`:

```sh
swiftlint lint --strict --no-cache
```

Result: two serious violations in 332 files:

| Location | Rule | Baseline result |
| --- | --- | --- |
| `ReguertaTests/FirestoreRepositoryErrorMapperTests.swift:261:11` | `function_body_length` | 76 lines; limit 50 |
| `ReguertaTests/FirestoreRepositoryErrorMapperTests.swift:8:1` | `type_body_length` | 322 lines; limit 300 |

These pre-existing lint findings are not changed in HU-074. The follow-up
validation-lane story must split the suite in a non-functional cut before
making strict lint a blocking repository gate.

## Phase 0 boundaries

- No app source, Firebase configuration, dependency pin, backend, Android, or
  live data was changed.
- No iOS/Xcode 27-only rule or API is part of the baseline.
- The setting-only diff is intentionally not committed while the build is red;
  configuration centralization and the minimum source fixes form one atomic
  Phase 1 cut.
- Build/test success from older revisions is historical context, not current
  validation evidence.

## Phase 1 evidence

Phase 1 was explicitly authorized on 2026-08-19. The evidence below is
append-only: it records migration results without rewriting the Phase 0
snapshot.

### Effective build settings

The policy now has one authority in the PBX project Debug and Release
configurations. Target-level copies were removed. Six read-only
`xcodebuild -showBuildSettings` queries produced this matrix:

| Target | Configuration | Default actor isolation | Swift | Strict concurrency | Approachable concurrency | iOS target |
| --- | --- | --- | --- | --- | --- | --- |
| `Reguerta` | Debug | `nonisolated` | 6.0 | `complete` | `YES` | 26.0 |
| `Reguerta` | Release | `nonisolated` | 6.0 | `complete` | `YES` | 26.0 |
| `ReguertaTests` | Debug | `nonisolated` | 6.0 | `complete` | `YES` | 26.0 |
| `ReguertaTests` | Release | `nonisolated` | 6.0 | `complete` | `YES` | 26.0 |
| `ReguertaUITests` | Debug | `nonisolated` | 6.0 | `complete` | `YES` | 26.0 |
| `ReguertaUITests` | Release | `nonisolated` | 6.0 | `complete` | `YES` | 26.0 |

All six commands exited successfully. This verifies inheritance for every
first-party Swift target without compiling or changing dependency state.

### Final ownership ledger

The `Open` values above are retained as the historical Phase 0 snapshot. The
following closure table is the authoritative final status for those entries:

| IDs | Resolution | Evidence | Final status |
| --- | --- | --- | --- |
| C-001, C-002 | `ResolveAuthorizedSessionUseCase.execute` is explicitly `@MainActor`, matching the synchronous router owner. Apply and conditional rollback remain non-suspending, so the lease fence is not split by an actor hop. | Two authorized-session tests plus session invalidation and runtime-router lease tests | Closed |
| C-003 | Only the local-store metadata read crosses to its actual `MainActor` owner with `await`; the freshness orchestration, remote fetch, refresh, and evaluation remain nonisolated. | Seven environment/freshness tests and six critical-refresh tests | Closed |
| F-001-F-003 | The base environment, override, and lease now form one `State` protected by `Mutex`; apply, conditional/unconditional reset, and testing-base replacement mutate atomically before publication. | Four serialized `RuntimeSessionEnvironmentRouterTests` | Closed |
| F-004-F-010 | Presentation dependency factories that construct UI-owned objects are explicitly `@MainActor`; repository and use-case contracts remain actor-neutral. | Debug/Release builds and 12 root-dependency tests | Closed |
| F-011-F-020 | Live, preview, and UI-testing App factories and their UI graph builders are explicitly `@MainActor`. Isolation is on graph construction, not on the environment value or Domain/Data types. | Debug/Release builds, root graph identity test, and four affected previews | Closed |

Compiler passes after those roots exposed the following additional clusters.
Repeated messages are grouped by owner; locations and representative compiler
wording are retained so the resolution remains auditable:

| ID | Location or surface | Diagnostic message or observed failure | Classification and resolution | Final status |
| --- | --- | --- | --- | --- |
| P1-001 | `App/ReguertaAppEnvironment.swift` | `Call to main actor-isolated static method 'preview()' in a synchronous nonisolated context` for the original `@Entry` default | Root: an environment default must not construct a UI graph. The entry now stores an optional injected graph, while a nonoptional accessor fails fast only when an uninjected graph is consumed. App and previews inject explicitly through a dedicated View modifier. | Closed |
| P1-002 | `Data/Freshness/FirestoreCriticalDataFreshnessRemoteRepository.swift`, `FirestoreCriticalDataRefresher.swift` | Firebase `Firestore` reference crossing diagnostics, including `Sending 'db' risks causing data races` | Root: non-Sendable SDK ownership. Both adapters are actors and receive an immutable Firebase app name; each resolves and retains its Firestore reference inside its own owner. | Closed |
| P1-003 | `Core/Layout/ResizeExtensions.swift`, DesignSystem model/builders, and `ReguertaTheme.swift` | Repeated `Call to main actor-isolated ... in a synchronous nonisolated context` diagnostics | Cascade: resize/token reads and SwiftUI construction are UI-owned. The narrow accessors/builders are explicitly `@MainActor`; Domain/Data were not broadened. Token injection uses optional backing storage so SwiftUI does not evaluate a fail-fast getter while constructing a writable key path. | Closed |
| P1-004 | `Domain/Bylaws/BylawsContracts.swift`, `Domain/Devices/AuthorizedDeviceRegistrar.swift` | Explicit `nonisolated` protocol/conformance requirements produced isolation mismatches, including a Release-only conformance failure | Root: the annotation was redundant under the module default and overconstrained actor conformers. It was removed rather than weakening the conforming owner. | Closed |
| P1-005 | Session, products, profile, shifts, and Firebase security test support | Actor-isolated member access and `Sending ... risks causing data races` diagnostics in test doubles | Root: mutable doubles now have actor ownership; MainActor SUT construction is explicit. Event-driven, cancellation-aware continuations replace yield polling, and the session invalidation suite has a one-minute suite time limit. | Closed |
| P1-006 | `ReguertaTheme.swift:146` during the first focused test-host launch | Runtime trap in `EnvironmentValues.reguertaTokens.getter`; crash report `Reguerta-2026-08-19-081025.ips` | Runtime ownership defect: SwiftUI evaluated the public fail-fast getter while forming a writable key path. Injection now targets private optional storage; public consumption remains fail-fast. Four affected previews and the full test host pass. | Closed |
| P1-007 | `SessionOperationInvalidationTests` during intermediate full runs | `No se registraron 2 deadlines de sesión` and `No se inició la resolución de miembro` | Test determinism defect exposed by the migration: bounded `Task.yield()` polling was schedule-sensitive. Controlled sleepers/resolvers now signal waiters directly and handle cancellation. | Closed |
| P1-008 | `SessionOperationTimeoutTests.swift` while making waiters event-driven | `Generic parameter 'T' could not be inferred` for an untyped throwing continuation | Local compile regression: the continuation is explicitly `CheckedContinuation<Void, any Error>`. | Closed |

No entry remains open. The final Debug and Release builds compile all
first-party source and tests, and Xcode's Issue Navigator reports zero errors.

### Behavior-preservation coverage

- `RuntimeSessionEnvironmentRouterTests` is a serialized, main-actor suite with
  four tests covering mutation-before-publication for apply, conditional and
  unconditional reset, stale-lease rejection, and testing-base replacement.
- Existing session tests retain cleanup-before-successor, draining,
  fail-closed, cancellation, late-result, relogin, and lease-replacement
  coverage. Controlled async boundaries now use event-driven waiters with a
  suite-level timeout instead of schedule-sensitive polling.
- The root-dependency suite gained a graph-identity round trip through
  `EnvironmentValues`; live SDK objects remain owned by Data or App adapters.
- Firebase freshness adapters retain Firestore inside their actors and cross
  actor boundaries with the Firebase app name and immutable Domain values.
- `SessionViewModel` and `GlobalFeedbackCenter` are explicitly `@MainActor`.
  Their construction factories carry the same contract; no blanket Domain or
  Data `@MainActor` annotation was introduced.

### Executable validation

Both application builds were run from `ios/Reguerta` with code signing
disabled:

```sh
xcodebuild -quiet \
  -project Reguerta.xcodeproj \
  -scheme Reguerta \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build \
  CODE_SIGNING_ALLOWED=NO

xcodebuild -quiet \
  -project Reguerta.xcodeproj \
  -scheme Reguerta-Production \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  build \
  CODE_SIGNING_ALLOWED=NO
```

Both commands exited 0. Their SwiftLint build phase reported only the two
pre-existing length warnings recorded in the Phase 0 baseline.

The final focused command used the standard `Reguerta` scheme, Debug, and the
iPhone 17/iOS 26.5 simulator with ID
`087C0B4D-8C32-419D-8B71-1763CAC6D46B`. Its exact selection was:

```text
ReguertaTests/FirebaseFunctionsSecurityBoundaryTests/authorizedSessionAppliesResolvedEnvironmentBeforeExactMemberRead()
ReguertaTests/FirebaseFunctionsSecurityBoundaryTests/authorizedSessionRollsBackResolvedEnvironmentWhenExactMemberReadFails()
ReguertaTests/SessionOperationInvalidationTests/staleRoutingRollbackDoesNotResetNewerLease()
ReguertaTests/SessionOperationInvalidationTests/resolvedEnvironmentChangesAuthorizedSessionIdentity()
ReguertaTests/CriticalDataFreshnessEnvironmentTests
ReguertaTests/CriticalDataRefreshUseCaseTests
ReguertaTests/ReguertaRootDependencyTests
ReguertaTests/RuntimeSessionEnvironmentRouterTests
```

The four individual tests plus suites of 7, 6, 12, and 4 tests produced 33/33
passed, zero skipped, and zero failed. The official result is
`Test-Reguerta-2026.08.19_08-49-20-+0200.xcresult`.

The repository-standard command then ran the full `Reguerta` scheme on the
same explicit iOS 26.5 destination:

```sh
xcodebuild -quiet \
  -project Reguerta.xcodeproj \
  -scheme Reguerta \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=087C0B4D-8C32-419D-8B71-1763CAC6D46B' \
  test
```

Result: exit 0 and `Passed` in
`Test-Reguerta-2026.08.19_08-50-19-+0200.xcresult`. Xcode reports 497 logical
tests: 496 passed, 1 skipped, 0 failed, and 0 expected failures. Expanded
dynamic-parameter/device accounting is 635 passed and 4 skipped. The skipped
logical test is the existing launch-test matrix; all eight UI behavior and
performance tests passed. Non-fatal LLDB version-store notices appeared while
the UI runner launched, but neither the process result nor the `.xcresult`
contains a failure.

Xcode discovery now reports 497 enabled and zero disabled tests. The four
affected previews for `ReguertaCardView`, `ReguertaInlineFeedbackView`,
`ReguertaInputFieldView`, and `ContentView` rendered with empty error lists
after deterministic DesignSystem/App environment injection.

### Final structural and review gates

- `swiftlint lint --strict --no-cache` inspected 333 Swift files and returned
  only the same two pre-existing serious length violations in
  `FirestoreRepositoryErrorMapperTests.swift`; HU-074 introduces no new lint
  finding. Strict-lint remediation remains Phase 2 roadmap work.
- `Package.resolved` has no diff; Firebase remains pinned to 12.15.0.
- Added-line and new-file searches found no `@preconcurrency`,
  `@unchecked Sendable`, `nonisolated(unsafe)`, `@MainActor(unsafe)`,
  `Task.detached`, `DispatchQueue`, or `OperationQueue` escape.
- `git diff --check` is clean. The branch remains at the same commit as `main`
  and `origin/main`, has no upstream, and contains no commit or push from this
  activation.
- Independent Domain/Data/App/configuration, Presentation/SwiftUI, and
  tests/governance reviews have no unresolved P0-P3 finding after their
  follow-up checks.
- Android source and behavior are unchanged; the parity impact is none.
- No API, setting, or rule exclusive to iOS or Xcode 27 was adopted.

Phase 1 is complete and validated locally. On 2026-08-19 the maintainer
authorized commit, push, closure of Phase 1, and startup of a separate Phase 2
story. Pull request, merge, issue closure, branch deletion, and folding Phase 2
implementation into HU-074 remain outside that authorization.
