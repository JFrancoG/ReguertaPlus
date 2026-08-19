# ADR-0012: Own iOS Runtime Context and Firebase SDK References

## Status

Accepted

## Date

2026-08-19

## Implementation Status

Implemented and executable-validated locally through HU-076 / issue #251. Final
independent review reports 0 P0-P3 findings, and issue #251 is synchronized and
remains open. The maintainer's later 2026-08-19 delivery instruction is quoted
verbatim: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
Commit, push, and opening the prior HU-075 and current HU-076 pull requests are
authorized and pending this turn; HU-076 is `ready_for_merge`. This ADR records
the accepted architecture but does not authorize merge, issue closure, branch
deletion, Firebase deployment, package updates, live-data mutation, integration,
Android changes, or iOS/Xcode 27 adoption.

## Context

ADR-0011 changed the iOS project to project-level `nonisolated` default actor
isolation and required explicit ownership for mutable infrastructure and SDK
references. HU-074 restored compilation by protecting the existing runtime
environment with a synchronous `Mutex`, while leaving its process-global
architecture for a later governed story.

That global is safe from simultaneous memory access but is not a stable logical
context. Authorization currently publishes a candidate environment before the
exact member read succeeds. Long-lived repositories and helper defaults may
read the global after a suspension, allowing one operation to use paths from
different environments. Multiple router instances also share global state but
own separate signals, so state changes and observations can diverge.

The successful environment lease is not retained in the authorized session;
normal cleanup resets unconditionally. The process-global development clock
and 15 production `@unchecked Sendable` declarations similarly conceal the
owner that Swift 6 needs to verify. One of those declarations retroactively
makes `FirebaseAuth.User` sendable across the entire module.

## Decision Drivers

- Never mix principals, members, or Firebase environments within one logical
  operation.
- Validate authority before publishing a candidate runtime route.
- Preserve synchronous invalidation, lease ownership, cleanup-before-successor,
  timeout, cancellation, and `DRAINING` guarantees from ADR-0008 through
  ADR-0010.
- Make environment changes observable from the same owner that mutates them.
- Keep SDK reference types inside checked adapters and transfer only immutable
  application values across concurrency boundaries.
- Avoid process-global state and unsafe compiler escapes.
- Preserve product/backend behavior and the Xcode 26/iOS 26 maintenance scope.

## Decision

Each composed iOS application graph owns one synchronous session-environment
store. The store owns the base environment, current override, active lease, and
transition signal as one instance boundary. It uses a small synchronization
primitive because applying and invalidating security-sensitive routing must be
synchronous and cannot suspend.

Every transition mutates effective state before synchronously publishing its
new value. Separate store instances share neither state nor notifications.
There is no static, singleton, task-local, or ambient fallback for runtime
routing.

Every environment-dependent operation captures the effective
`SessionEnvironment` synchronously in its initiating owner before its first
suspension or actor-isolated repository call. Repository contracts require that
explicit immutable value; actor bodies and nested helpers may not read a live
provider. The value is the operation's snapshot and is reused for every
repository, path builder, Functions request, and media decision it invokes.

Session-owned presentation work also requires a canonical active-authorization
entry guard. A `.authorized` enum case is valid for entry only while the
principal remains linked to the authenticated member, the authenticated and
selected members remain active, and any delegated selection remains authorized.
Tests and preview fixtures that intentionally construct a broken authorized
value must fail closed before a repository or device operation.

Each asynchronous presentation operation owns a generation/token and captures
the live session revision or complete authorization signature. Result and error
publication require both the current operation owner and current authorization,
except for a synchronous self-owned handoff whose consumer records a receipt
binding the applied state to the resulting live authorization and revision.
Cleanup uses a separate owner-only fence: it releases only that generation's
transient tasks, loading state, and handles even when the captured revision has
become stale, fails closed where required, and is a no-op for a successor.
Matching route identity and environment alone remain insufficient because sign-
out/re-login can recreate them.

Route-owned cancel-and-replace reads create a successor owner on re-entry.
Independent mutations may deliberately retain their explicit owner across a
benign re-entry, but every result or error they publish remains fenced by the
live authorization/revision.

Authorization treats the resolved environment as a candidate. It reads the
exact member and performs mandatory member hydration against that explicit
candidate without changing the live route. When hydration succeeds and the
operation is still current, the session owner creates and retains the lease,
then commits routing and the visible authorized mode without a suspension
between them. Normal cleanup resets conditionally by lease; obsolete cleanup
is a no-op. An unconditional reset remains only as an explicit bootstrap or
fail-safe recovery action whose caller already owns the serialized security
lane.

Development time is an injected instance dependency. Its persistent store and
system-time source are injected or instance-owned, so tests and preview/app
graphs do not rely on `DevelopmentTimeMachine.shared` or unchecked sendability.

Environment-sensitive local state uses environment-qualified keys. My Order
does not automatically adopt legacy unqualified draft or confirmation keys,
because their source environment cannot be proven.

Firebase SDK reference objects stay inside the checked owner that performs SDK
operations:

- Auth reference values remain in its main-actor adapter; only checked
  immutable Domain values, token strings, booleans, or typed errors leave it.
- Stateful or callback-driven repositories use an actor or existing main-actor
  owner where the protocol contract permits it.
- Immutable adapters may remain compiler-checked `Sendable` values or final
  classes only when all stored values and operations prove that conformance.
- Functions captures immutable token and environment context for one request.
- Device and messaging callbacks explicitly hop into their actor/main-actor
  owner while preserving generation and process-live lease fences.
- Freshness adapters keep their existing actor ownership and cross boundaries
  with Firebase app names or immutable values rather than SDK references.
- Orders keeps its Firestore reference and every asynchronous SDK helper inside
  the `FirestoreOrdersRepository` actor, including helper implementations split
  across source files. No async helper accepts or returns a live SDK reference.
- Media owns Storage and callback continuations behind one checked boundary,
  freezes the environment/path before starting, and fences obsolete results.

Callback bridges check task cancellation after the SDK callback resolves, so a
late callback cannot return success to a cancelled operation. Authorization
revocation routes through owned local-session termination: session/device
leases and context are invalidated before owned cleanup completes, while the
serialized `DRAINING` barrier continues to block a successor.

Production may not use `@unchecked Sendable`, `@preconcurrency`,
`nonisolated(unsafe)`, `Task.detached`, GCD, or an equivalent escape to make
these boundaries compile. If primary SDK contracts cannot support a checked
owner, implementation stops and requires explicit approval plus a separate ADR
under the exception gate established by ADR-0011.

The existing Firebase construction in
`Presentation/Root/SessionViewModelDependencies.swift` is a known composition
violation of the target boundary in ADR-0011/`AGENTS.md`, explicitly assigned
to Phase 4 by the maintainer-approved roadmap. HU-076 may adapt its injected
arguments but does not move that composition or claim that all SDK imports
already reside in Data/App. No additional Presentation SDK import may be
introduced, and this temporary residual is not an accepted new exception.

Android currently has an equivalent early-publication and ambient-environment
design. HU-076 does not modify Android, so it creates a documented temporary
security/ownership parity gap that requires a separately governed follow-up.

## Considered Options

### Keep the static Mutex-backed environment

Rejected. It prevents a data race but cannot provide a stable per-operation
context or make separate graphs independent. Its state and router signals also
have different owners.

### Replace the global with a singleton actor

Rejected. It retains process-global coupling and makes synchronous security
invalidation require suspension. Actor isolation is used inside asynchronous
SDK adapters, not as a substitute for the routing contract.

### Use task-local environment context

Rejected. Firebase operations span callbacks, child tasks, delegates, and
presentation-owned workflows that do not share one reliable task tree. It also
does not model the live authorized route or its lease.

### Publish the candidate route and roll it back on failure

Rejected. Other operations can observe the candidate during the suspended
member read. Rollback cannot undo reads or writes already routed there.

### Keep unchecked sendability at Firebase boundaries

Rejected. A module-wide conformance or class assertion hides the actual owner
and can silently become invalid after SDK or adapter changes.

## Consequences

### Positive

- One operation cannot switch Firebase environments after suspension.
- Failed authorization never exposes its candidate route to unrelated work.
- A stale cleanup cannot reset a successor session.
- State and transition observations remain coherent per application graph.
- Swift 6 verifies SDK crossings instead of trusting broad assertions.
- Tests can compose independent environments and clocks without serializing on
  application globals.

### Negative

- Environment context must be threaded through repository composition and
  nested helper calls.
- Authorized-session state retains an additional ownership lease.
- Some Firebase adapters need actor-aware protocol conformances and explicit
  callback hops.
- Repository and media cancellation/ordering require deterministic regression
  coverage and explicit reporting when the intended red-first order is not
  retained as reproducible evidence.
- Existing unqualified My Order drafts or confirmations are not restored
  automatically after this change; accepting that local compatibility loss
  prevents unverifiable state from crossing environments.
- The single existing Presentation composition leak remains until Phase 4.

## Implementation and Verification

HU-076 implements this decision in isolated clusters: owner/authorization,
explicit environments, injected clock, Auth/Functions/devices/freshness, then
Firestore repositories/media. Review remediation added the canonical active-
authorization entry guard and fail-closed fixtures; nine same-context and six
session-revision Orders cases; environment-qualified local order state; live-
session fences for Users, Shared Profile, Products, and Shifts; revoked device-
lease cleanup; post-callback cancellation; and exclusive Orders Firestore actor
ownership.

Final owner-cleanup remediation added 16 deterministic regressions: seven for
Orders reads, seven for Products/Shifts reads, entry, and successor protection,
and two for Freshness. Publication remains live-session fenced, while owner-only
cleanup releases stale loading/tasks/handles and cannot clear a successor.
Freshness additionally rejects a revoked suspended payload, never marks it
ready, and accepts a synchronous self-owned session handoff only through the
consumer receipt for the resulting revision.

Two additional post-callback regressions are distinct from those 16 owner-
cleanup regressions: a late email-verification success resolves as `false`, and
a late FCM token throws `CancellationError` without persistence or registration.

Deterministic waiters use cancellable UUID ownership, double-checked
registration, exactly-once removal/resume, bounded suite time limits,
`NSCondition` for synchronous mailbox control, and `cancelAll`/`defer` cleanup.
These are test-evidence reliability measures, not production architecture.

A reproducible red step was not retained for every cluster. Actor-mailbox,
media, active-entry, same-context, session-revision, owner-cleanup, device,
callback, and waiter cases were added during review remediation. This process
deviation is recorded instead of claiming universal test-first execution. The
parameterized `authenticatedClientMapsTokenRefreshFailures` test retains its mapping TDD step
for cancellation, timeout, missing authenticated user, and unavailable token
refresh errors.

At final source validation, production references to
`ReguertaRuntimeEnvironment`, `DevelopmentTimeMachine.shared`,
`@unchecked Sendable`, `@preconcurrency`, `nonisolated(unsafe)`, and
`Task.detached` are zero. Firebase imports remain Data 24, App 9, Presentation
1. `DispatchQueue` changed from two pre-existing uses to one: the touched
AppDelegate hop was removed, no use was added, and the existing
`ReguertaImagePickerField` use remains outside HU-076. `Package.resolved`,
Android, and `project.pbxproj` have no diff.

The final tree contains 363 Swift files and 62,984 lines: production 253/36,197,
unit 108/26,403, and UI 2/384. The source inventory contains 574 Swift Testing
`@Test` declarations, 6 XCTest unit methods, and 9 XCTest UI methods. On iPhone
17 / iOS 26.5, fast unit passed 580/580 with 0 skipped and 0 failed (574 Swift
Testing plus 6 XCTest), UI smoke passed 4/4, and the release gate reported 589
responsibilities: 588 passed, 1 known skip, and 0 failed. SwiftLint 0.61.0
inspected 363 Swift files with 0 violations; effective settings passed 6/6;
generic Debug and Production Release builds are green. `git diff --check`
passed. The Phase 2 SwiftLint `PATH` warning was historical and is not a current
Xcode or Issue Navigator diagnostic.

Closure requires zero production references to `ReguertaRuntimeEnvironment`,
`DevelopmentTimeMachine.shared`, and `@unchecked Sendable`; zero newly
introduced concurrency escapes; no growth in Presentation Firebase imports;
unchanged `Package.resolved`; and green focused, fast-unit, UI-smoke, Debug,
Production Release, and full release gates on iOS 26. Independent iOS
concurrency/architecture review completed with 0 P0-P3 findings, and issue #251
is synchronized and verified open with its labels intact. At this documentation
checkpoint the implementation remains uncommitted and unpublished. Commit,
push, and opening the prior HU-075 and current HU-076 pull requests are
authorized and pending this turn. Merge, issue closure, deployment, branch
deletion, and integration remain unauthorized.

## Related Decisions and Work

- [ADR-0001](0001-mvvm-clean-architecture.md): MVVM and Clean Architecture.
- [ADR-0003](0003-firebase-backend.md): Firebase backend services.
- [ADR-0004](0004-ios-root-dependency-injection.md): iOS root composition.
- [ADR-0008](0008-bound-mobile-session-operations.md): bounded operations,
  cleanup, and `DRAINING`.
- [ADR-0009](0009-require-process-live-push-authorization.md): live push lease.
- [ADR-0010](0010-separate-community-feeds-from-session-authorization.md):
  synchronous environment-context invalidation.
- [ADR-0011](0011-use-nonisolated-default-actor-isolation-on-ios.md): explicit
  actor ownership and unsafe-escape gate.
- GitHub issues [#249](https://github.com/JFrancoG/ReguertaPlus/issues/249),
  [#250](https://github.com/JFrancoG/ReguertaPlus/issues/250), and
  [#251](https://github.com/JFrancoG/ReguertaPlus/issues/251).
