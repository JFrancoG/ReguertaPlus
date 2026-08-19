# Plan - HU-076 iOS session environment ownership

## 1. Planning authority and branch relationship

HU-076 implements Phase 3 of the accepted iOS refactor roadmap. The verbatim
authorization and delivery boundary are recorded in `spec.md`.

The maintainer later authorized delivery on 2026-08-19, quoted verbatim: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
Commit, push, and opening the prior HU-075 and current HU-076 pull requests are
therefore in scope for this turn. Merge, issue closure, branch deletion,
deployment, and integration remain separately gated.

The working branch `codex/hu-076-ios-session-environment-ownership` starts at
`d079379`, the published HU-075 tip. It is deliberately stacked because #249
and #250 are not integrated into `main`. HU-076 does not modify either
predecessor branch and does not imply integration of the stack.

## 2. Design principles

1. One graph, one owner, one synchronous transition signal.
2. Capture immutable context once per operation; never consult live routing
   again after an operation begins.
3. Validate a candidate route before publishing it.
4. Keep the successful lease until definitive session cleanup.
5. Retain Firebase SDK objects inside the smallest checked owner that uses them.
6. Prefer compiler-checked actors or immutable values over sendability claims.
7. Cover security, ordering, and cancellation behavior with deterministic
   regression tests and record any execution-order deviation honestly.
8. Treat active authorization, operation ownership, and live session revision
   as independent gates; matching identity and environment alone are not
   sufficient after revocation or re-login.
9. Require owner plus live authorization/revision for result or error
   publication, while owner-only cleanup releases only its own transient state
   and cannot clobber a successor. A synchronous self-owned handoff requires a
   consumer receipt for the resulting revision.
10. Route-owned cancel-and-replace reads create a successor on re-entry;
    independent mutations may retain an explicit owner across benign re-entry
    but remain live-session fenced.
11. Keep Phase 4 composition work and all iOS/Xcode 27 rules outside this cut.

## 3. Work sequence

### 3.0 Governance, ADR, and reproducible baseline

- Link issue #251, the story artifacts, the stacked dependencies, and ADR-0012.
- Record branch/base, toolchain, Firebase pin, global references, unchecked
  declarations, SDK imports, affected operations, and existing test lanes.
- Record the exact activation and excluded delivery actions.
- Refine the issue wording so the one existing Presentation composition leak is
  carried explicitly to Phase 4 rather than hidden or expanded.

Exit gate:

- Spec, plan, tasks, issue mirror, baseline, ADR EN/ES, and issue #251 agree.
- `git diff --check` is clean and only governance/decision files changed.

### 3.1 Instance-owned environment and authorization ordering

- Add deterministic characterization tests for independent owners, signal
  ownership, apply/reset order, stale leases, and candidate validation.
- Replace the static environment enum with a synchronous instance-owned store
  injected into the runtime router.
- Make the router's effective state and transition signal share that owner.
- Read the exact member from an explicit candidate environment and publish the
  route only after authorization and mandatory hydration succeed.
- Create and retain the environment lease at the session commit point.
- Use conditional reset for normal session cleanup and retain an explicit,
  narrowly named fail-safe reset only for bootstrap/recovery invariants.

Exit gate:

- Two stores do not share state or notifications.
- Failed candidate authorization does not publish the candidate.
- Apply and both reset paths mutate before publishing.
- Stale cleanup cannot reset a successor.
- Focused owner and session-operation suites pass.

### 3.2 Explicit immutable snapshots across Data operations

- Remove optional environment fallbacks from `ReguertaFirestorePath`.
- Capture the effective `SessionEnvironment` synchronously in the initiating
  owner before the first suspension or actor-isolated repository call.
- Require that explicit immutable value in environment-dependent Domain
  repository contracts. Repository actors and nested helpers must use only the
  argument they receive and may not consult a live provider.
- Pass the captured environment explicitly through Orders helpers, Functions,
  Storage, and every nested path builder.
- Qualify My Order local storage by environment. Leave legacy unqualified
  drafts and confirmations untouched but do not restore them automatically,
  because their source environment cannot be established safely.
- Give every affected presentation operation an owner/generation plus a live
  session revision or complete authorization signature. Result/error
  publication requires both, while owner-only cleanup releases stale transient
  state without clearing a successor.
- Make route-owned cancel-and-replace reads create a successor on re-entry.
  Independent mutations may retain an explicit owner across benign re-entry,
  provided every result/error remains live-authorization/revision fenced.
- Adapt App and the existing Presentation dependency factory mechanically;
  do not move composition responsibilities in this story.
- Remove every reference to `ReguertaRuntimeEnvironment` and prove no new
  static/global equivalent exists.

Exit gate:

- The global reference count is zero.
- A route change while a repository actor call is queued or suspended cannot
  change that operation's paths or environment.
- Product, Orders, Shifts, News, profile, and Functions focused tests pass.
- Fast unit and UI smoke pass on an explicit iOS 26 simulator.

### 3.3 Injected development clock

- Cover persisted override, current-time fallback, and independent instances
  deterministically without real sleeps.
- Replace `DevelopmentTimeMachine.shared` with a checked, injected clock owner.
- Compose one clock per app graph and pass closures or the protocol only where
  required.
- Route the existing develop-time mutation through the injected owner.

Exit gate:

- `.shared` references and the time-machine unchecked declaration are zero.
- Independent clocks do not share in-memory ownership.
- Persistence and visible develop-time behavior remain unchanged.

### 3.4 Firebase Auth, Functions, devices, and freshness boundaries

- Remove the retroactive sendability conformance from `FirebaseAuth.User`.
- Keep Auth callback/reference values inside the main-actor adapter and emit
  only checked immutable Domain values, token strings, booleans, or typed
  errors.
- Verify late Auth results cannot publish into a replacement session.
- Ensure Functions captures an immutable environment and token context for the
  complete request.
- Preserve device generation, lease, and process-live authorization fences.
- Make `AuthorizedSession.representsActiveAuthorization` the entry guard for
  session-owned feature work, including Products, Shifts, Freshness, Users,
  Orders, Shared Profile, and device-token paths. Invalid `.authorized`
  fixtures must fail closed before a repository call.
- Re-check task cancellation after Firebase callback completion so a late
  success cannot escape a cancelled task.
- Route authorization revocation through owned local-session termination so
  session/device leases are invalidated before cleanup and the `DRAINING`
  barrier still blocks a successor.
- Replace AppDelegate callback/GCD delivery with an explicit task/actor hop.
- Confirm freshness actors retain only checked Firebase identity/value state.

Exit gate:

- No Firebase Auth reference crosses the adapter boundary.
- Functions cannot switch environment mid-request.
- Late/replaced device tokens cannot publish.
- Auth, Functions, device, freshness, fast-unit, and UI-smoke gates pass.

### 3.5 Firestore repositories and image pipeline

- Remove unchecked conformance from Firestore repositories in small clusters,
  selecting actor, main-actor, immutable class, or value semantics from actual
  mutable state rather than applying one blanket annotation.
- Require the immutable environment captured before the actor hop for every
  repository operation; do not capture a live provider inside an actor body.
- Give Storage ownership to an actor-isolated image pipeline, freeze its path
  context before work begins, and preserve continuation/cancellation behavior.
- Keep Firestore references used by Orders inside the
  `FirestoreOrdersRepository` actor. Helpers split across Orders source files
  become actor-isolated extensions and no async helper accepts or returns SDK
  reference types.
- Make Orders de-duplication owner-aware so re-entry with an equal context can
  replace cancelled work without letting an older result or `defer` clear the
  successor.
- Add deterministic tests for frozen Storage paths and obsolete completions.
- Re-run zero-count audits after each cluster.

Exit gate:

- All 15 baseline production `@unchecked Sendable` declarations are gone.
- No substitute escape is present.
- Relevant repository/media tests and fast-unit pass.

### 3.6 Full validation and independent review

Run in this order:

1. Focused ownership, session, Auth, Functions, devices, freshness, repository,
   and media suites.
2. Strict SwiftLint and effective-settings verifier.
3. Fast unit and UI smoke on an explicit iOS 26 simulator.
4. Debug generic simulator build.
5. Production Release generic simulator build.
6. Composite release gate with result bundle and logical counts.
7. Global/unchecked/escape/import searches.
8. Package-pin and `git diff --check` review.
9. Independent iOS concurrency/architecture review.

Exit gate:

- Every acceptance criterion has evidence in the baseline/closure ledger.
- No package/backend/Android/iOS-27 or Phase 4 scope entered the diff.
- Issue #251 reflects local status and remains open while the authorized commit,
  push, and prior/current pull-request opening are completed in this turn.

## 4. Expected file clusters

### Governance and decisions

- `spec/app/hu-076-ios-session-environment-ownership/`
- `spec/issues/hu-076-ios-session-environment-ownership-issue.md`
- `docs/decisions/0012-own-ios-runtime-context-and-firebase-sdk-references.md`
- `docs-es/decisions/0012-asignar-propietarios-explicitos-al-contexto-runtime-y-sdk-firebase-en-ios.md`

### Environment and session ownership

- `Domain/Access` environment, result, member-repository, and session contracts.
- `Data/Firestore` runtime owner, router, paths, and snapshot consumers.
- `Presentation/Auth` and `Presentation/Root` session lease lifecycle.
- App feature dependency composition signatures.

### Clock and Firebase adapters

- Development clock protocol/implementation and App composition.
- Auth, Functions, Devices/Messaging, Freshness, Firestore repositories, and
  Media adapters.
- `AppDelegate` only for the callback-to-owner hop.

### Tests and evidence

- Existing focused session/security/repository suites.
- New owner/snapshot/clock/media tests and focused test support.
- `phase-3-baseline.md` closure evidence and issue mirror.

## 5. Test strategy

- Unit: deterministic Swift Testing suites, serialized only where a retained
  external process resource genuinely requires it.
- Integration boundary: Firebase adapters use test doubles or named local SDK
  instances without network or live backend state.
- UI smoke: the four existing mock-backed auth/navigation journeys after every
  session-boundary cluster.
- Full regression: HU-075 release gate on iOS 26 at closure.
- Test infrastructure: asynchronous waiters use cancellable UUID ownership,
  double-checked registration, exactly-once removal/resume, bounded suite time
  limits, and deterministic cleanup. Synchronous mailbox fixtures use
  `NSCondition` instead of polling.
- Manual: no live Firebase seed, credentials, push, or production data. The
  executable lanes above are the closure authority.

## 6. Risk controls

- Early route publication -> validate against explicit candidate, publish last.
- Queued or suspended operation route switch -> capture one immutable
  environment in the initiating owner before the actor hop or first `await`.
- Stale cleanup -> keep successful lease and reset conditionally.
- Same-context re-entry -> bind de-duplication and cleanup to an operation owner,
  not only to the route key.
- Same-identity re-login or revocation -> compare the captured session revision
  or full live authorization signature before publishing a result or error.
  Cleanup uses only the operation owner so stale work can release its own
  progress/handles, fail closed, and remain a no-op for a successor.
- Freshness self-owned session handoff -> accept a changed revision only when
  the consumer receipt binds the applied state to the resulting live
  authorization and revision.
- Late Firebase callback after cancellation -> re-check cancellation after the
  callback; email verification resolves `false`, while FCM throws
  `CancellationError` before persistence or registration.
- Revoked-but-shaped-as-authorized input -> apply the canonical active-
  authorization guard before any repository or device operation.
- Cross-environment local restore -> include environment in My Order storage
  keys and decline automatic migration of ambiguous legacy keys.
- Signal/state split -> co-own them in one instance graph.
- Blind actor conversion -> characterize each adapter and use the smallest
  owner that satisfies its protocol and cancellation contract.
- Scope bleed into Phase 4 -> retain and document the single Presentation
  composition leak; no architectural move in HU-076.

## 7. Execution chronology and local state

The implementation sequence did not retain reproducible red-step evidence for
every cluster. Deterministic regression coverage now exists for the changed
contracts, but actor-mailbox, media, canonical entry-guard, same-context,
session-revision, owner-cleanup, device-lease, callback-cancellation, and waiter-
hardening cases were added during review remediation. Closure records this as a
process deviation rather than claim universal test-first execution. The
parameterized `authenticatedClientMapsTokenRefreshFailures` case did retain a TDD mapping
step for cancellation, timeout, missing authenticated user, and unavailable
token refresh errors.

At this documentation checkpoint, the implementation remains local and
uncommitted on the HU-076 branch. The branch still points to `d079379`, has no
upstream, and has not been published. Commit, push, and opening the prior HU-075
and current HU-076 pull requests are now authorized and pending in this turn.
Issue #251 is synchronized with the final local evidence, verified open, and
retains its labels. Merge, issue closure, branch deletion, deployment, and
integration remain unauthorized.

## 8. Executed validation checkpoint

The final post-remediation gates are green on iPhone 17 / iOS 26.5
(`087C0B4D-8C32-419D-8B71-1763CAC6D46B`):

- fast unit passed 580/580 logical tests with 0 skipped and 0 failed: 574 Swift
  Testing plus 6 XCTest;
- UI smoke passed 4/4;
- release gate reported 589 logical responsibilities: 588 passed, 1 known
  launch-matrix skip, and 0 failed;
- SwiftLint 0.61.0 inspected 363 Swift files with 0 violations;
- all 6 effective target/configuration setting pairs passed;
- generic Debug and Production Release builds passed;
- `git diff --check` passed, and `Package.resolved`, Android, and
  `project.pbxproj` have no diff.

The validated tree has 363 Swift files and 62,984 lines: production 253/36,197,
unit 108/26,403, and UI 2/384. It contains 574 Swift Testing `@Test`
declarations, 6 XCTest unit methods, and 9 XCTest UI methods. Static gates retain
zero production global
runtime/time singleton references, unchecked or unsafe concurrency escapes;
one pre-existing `DispatchQueue` remains, and Firebase imports remain Data 24,
App 9, Presentation 1.

Late remediation evidence covers the canonical active-authorization entry
guard and fail-closed fixtures; nine same-context and six session-revision
Orders cases; environment-qualified local order state and intentional legacy
non-restoration; Users, Shared Profile, Products, and Shifts live-session
fences; revoked device-lease cleanup; post-callback cancellation; checked
Firestore Orders actor ownership; 16 final owner-cleanup regressions split as
seven Orders reads, seven Products/Shifts read, entry, and no-clobber cases, and
two Freshness cases; two separate post-callback regressions proving email
verification late success resolves `false` and a late FCM token throws
`CancellationError` without persistence or registration; and bounded
cancellable test waiters. Publication/error is owner plus live-session fenced,
while cleanup uses only the owner and cannot clobber a successor. Independent
iOS concurrency/architecture review is clean with 0 P0-P3 findings, and issue
#251 is synchronized and remains open. The authorized commit, push, and opening
of the prior/current pull requests are pending this turn; merge, issue closure,
branch deletion, deployment, and integration remain unauthorized.

The Phase 2 SwiftLint `PATH` warning was historical and is not a current Xcode
or Issue Navigator diagnostic.
