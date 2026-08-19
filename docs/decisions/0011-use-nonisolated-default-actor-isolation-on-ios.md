# ADR-0011: Use `nonisolated` as the Default Actor Isolation on iOS

## Status

Accepted

## Date

2026-08-19

## Implementation Status

Implemented and validated locally through HU-074. The build setting is
centralized at the project level and inherited by the app, unit-test, and
UI-test targets. Debug, Release, the 33-test ownership gate, and the complete
497-test standard gate are green without unsafe migration escapes. The
maintainer authorized commit, push, Phase 1 closure, and Phase 2 startup on
2026-08-19. The atomic implementation is published as commit `a26768e` on the
HU-074 branch. Pull request, merge, issue closure, and branch deletion remain
separate delivery gates.

## Context

Reguerta's iOS application is an established Swift 6 codebase with strict
concurrency checking, SwiftUI presentation, Clean Architecture boundaries, and
Firebase-backed infrastructure. The app target previously used
`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`. That setting made unannotated
declarations implicitly main-actor isolated, including declarations whose
responsibilities belong to Domain or Data rather than UI ownership.

The implicit isolation reduced the visibility of actor boundaries. Pure use
cases, dependency factories, synchronous routing state, and Firebase adapters
could compile because they inherited `MainActor`, not because their ownership
had been deliberately modeled. It also required repeated `nonisolated`
annotations on value types that should naturally remain usable from any
isolation domain.

HU-074 centralizes
`SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` at project level. The first
compiler passes expose cross-actor calls in session authorization,
critical-data freshness, App composition, global runtime environment state,
Firebase SDK boundaries, and test doubles. These diagnostics identify
ownership decisions that must be made explicitly; they are not a reason to
isolate Domain or Data wholesale to `MainActor`.

Default actor isolation is a Swift module compilation policy. The current iOS
26 minimum and Xcode 26 toolchain establish this repository's supported
profile, but the deployment target itself is not what gives the setting its
semantics. Each first-party Swift target must therefore have the same effective
policy even though external package modules remain unaffected.

## Decision Drivers

- Make actor ownership visible in source instead of inheriting it accidentally.
- Keep UI state serialized on `MainActor` while Domain and Data stay neutral by
  default.
- Preserve Swift 6 data-race safety and strict-concurrency diagnostics.
- Preserve synchronous invalidation, session/lease/context ownership fences,
  cleanup-before-successor ordering, and the `DRAINING` barrier from ADR-0008,
  ADR-0009, and ADR-0010.
- Avoid unsafe migration escapes and blanket annotations used only to make the
  compiler quiet.
- Apply one auditable policy to the app, unit-test, and UI-test modules.
- Support incremental, behavior-preserving refactoring on the current Xcode 26
  profile without adopting iOS or Xcode 27 rules.

## Decision

All current and future first-party Swift modules in the iOS Xcode project use
`SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` in every build configuration,
currently Debug and Release.

The setting has one project-level authority inherited by the app,
`ReguertaTests`, and `ReguertaUITests`. A target may override it only through a
separately approved architectural decision. Validation must inspect the
effective build settings for every target; duplicating the same value in each
target is not the source of truth.

Swift 6 language mode, `SWIFT_STRICT_CONCURRENCY = complete`, and Approachable
Concurrency remain enabled. The migration must not weaken diagnostics.

Source isolation follows these rules:

- SwiftUI presentation models and stores that own mutable UI state declare
  `@MainActor` explicitly.
- App factories and composition operations declare the isolation required by
  the graph they construct. Constructing UI-owned objects does not make Domain
  or Data dependencies main-actor isolated.
- Domain entities, value types, repository contracts, pure policies, and pure
  use cases remain nonisolated by default. A narrow orchestration operation may
  use an explicit actor only when ordering or owned state requires it.
- Mutable infrastructure state has one explicit owner. Prefer an actor for
  asynchronous state. Use a small synchronization primitive when a security or
  routing invariant requires a synchronous transition that cannot suspend.
- Firebase and other SDK reference types remain inside the appropriate
  isolated infrastructure adapter: Data for persistence/service
  implementations, or App for platform lifecycle and composition
  responsibilities. They do not leak into Domain or Presentation or cross
  actor boundaries as live objects; immutable Domain values, DTOs, or typed
  errors cross instead.
- SDK delegates and callbacks perform an explicit hop to the owner that may
  mutate state. GCD is not the application's primary concurrency model.
- Tests use the same default isolation as production and adopt `@MainActor`
  only when the system under test owns main-actor state.
- An explicit `nonisolated` annotation is retained only when it overrides an
  isolated enclosing context or satisfies a real protocol/conformance
  contract. It is not repeated as ceremony under the module default.

`nonisolated` expresses the absence of a global-actor requirement; it does not
mean "run in the background." SE-0466 controls module isolation inference.
Separately, Approachable Concurrency currently enables
`NonisolatedNonsendingByDefault` from SE-0461, so a nonisolated async function
may continue on the caller's isolation. Work that must deliberately leave that
actor uses `@concurrent`.

The migration must not introduce `@preconcurrency`, `@unchecked Sendable`,
`nonisolated(unsafe)`, `Task.detached`, GCD, or an equivalent escape as a
compiler workaround. If a current SDK boundary cannot be expressed safely
after primary source review, work stops before writing the exception. Any
exception requires explicit user approval and a separate ADR documenting the
alternatives, ownership invariant, scope, focused tests, and removal condition.

The build-setting change and the minimum source changes required to restore a
fully compiling project form one atomic implementation cut. Later
architecture, SwiftUI, layout, and mechanical cleanup remain separate phases.

## Considered Options

### Keep `MainActor` as the module default

Rejected. It is convenient for a mostly sequential UI application, but in this
codebase it also hides unintended isolation in Domain, Data, and dependency
composition. Reviewers cannot distinguish deliberate UI ownership from a
module-wide default by reading source.

### Keep the `MainActor` module default and annotate Domain/Data individually

Rejected. Repeating `nonisolated` on individual Domain/Data declarations or
extensions would preserve the implicit `MainActor` dialect for the rest of the
module and make effective isolation harder to audit. Explicit actor ownership
at the declarations that require it is clearer.

### Give app and test targets different defaults

Rejected. Tests would exercise a different isolation model and could miss
compiler failures present in production or require test-only workarounds.

### Adopt `nonisolated` and add blanket `@MainActor` or unsafe suppressions

Rejected. This recreates implicit isolation in source or disables the checks
the migration is intended to make useful.

## Consequences

### Positive

- UI ownership is explicit at the declarations that require it.
- Domain and Data APIs no longer inherit a UI executor accidentally.
- Strict-concurrency errors expose mutable global state and unsafe SDK
  crossings early.
- Redundant `nonisolated` annotations can be removed incrementally after the
  project is green.
- App and tests compile under the same concurrency policy.
- Future review can reason from source rather than hidden target defaults.

### Negative

- The initial setting change is source incompatible and makes existing
  implicit boundaries fail to compile.
- App composition and SDK adapters require additional explicit ownership.
- Replacing global routing state while preserving synchronous security fences
  is a high-risk architectural change with dedicated tests and review.
- Some test suites that relied on implicit `MainActor` need explicit isolation
  or neutral test support.

## Implementation and Verification

The decision is implemented through separately governed executable stories.
HU-074 owns only the first two steps:

1. Record the policy, baseline, scope, and ownership matrix.
2. Move the build setting to one project-level authority and restore Debug and
   Release compilation without unsafe escapes.

Later stories may add reproducible validation lanes, replace broader mutable
environment state, strengthen Firebase boundaries, consolidate App
composition, refactor feature/SwiftUI slices, and remove redundant syntax.
Each requires its own HU, issue, branch, measurable gates, and explicit
activation; ADR-0011 does not activate that roadmap.

Every executable cut must keep strict concurrency enabled, preserve
cancellation and late-result fences, pass focused tests and the applicable
full validation, and receive an independent concurrency/architecture review.
SwiftUI changes also require the repository's SwiftUI/accessibility review.

No Firebase deployment, package upgrade, live-data mutation, Android source
change, or iOS/Xcode 27 adoption is authorized by this decision.

## Related Decisions and Work

- [ADR-0001](0001-mvvm-clean-architecture.md): MVVM and Clean Architecture.
- [ADR-0002](0002-min-platform-versions.md): the iOS 26 platform baseline.
- [ADR-0003](0003-firebase-backend.md): Firebase backend services; this
  decision changes only client-side concurrent ownership.
- [ADR-0004](0004-ios-root-dependency-injection.md): root dependency injection
  for iOS SwiftUI.
- [ADR-0008](0008-bound-mobile-session-operations.md): bounded mobile session
  operations and cleanup barriers.
- [ADR-0009](0009-require-process-live-push-authorization.md): process-live push
  authorization.
- [ADR-0010](0010-separate-community-feeds-from-session-authorization.md):
  community refresh ownership and synchronous context invalidation.
- HU-073: completed struct construction and inferred-sendability conventions;
  this ADR supersedes only its historical `MainActor` build-setting assumption.
- GitHub issue [#249](https://github.com/JFrancoG/ReguertaPlus/issues/249).

## References

- [SE-0466: Control default actor isolation inference](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0466-control-default-actor-isolation.md)
- [SE-0461: Run nonisolated async functions on the caller's actor by default](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md)
- [Swift 6 Concurrency Migration Guide](https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/)
- [Swift `MainActor`](https://developer.apple.com/documentation/swift/mainactor)
