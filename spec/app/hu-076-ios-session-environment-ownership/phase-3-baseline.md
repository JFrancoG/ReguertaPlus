# HU-076 Phase 3 baseline - 2026-08-19

## Authority and Git state

- Active story: HU-076 / GitHub issue #251.
- Active branch: `codex/hu-076-ios-session-environment-ownership`.
- Branch start: `d079379d9d51c0bb6c3381acce42b8291fa73c75`.
- Dependency: issues #249 and #250 and their stacked published branches.
- `main` and `origin/main`: `0d698f1` at story start; HU-076 is four commits
  ahead through its two predecessor stories.
- The branch was clean and had no upstream at story start.
- Bootstrap and implementation are authorized. The maintainer's later
  2026-08-19 instruction is quoted verbatim: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
  Commit, push, and opening the prior HU-075 and current HU-076 pull requests
  are authorized and pending this turn. Merge, issue closure, branch deletion,
  deployment, and integration are not authorized.

## Approved maintenance environment

| Item | Baseline |
| --- | --- |
| Xcode | 26.6 (`17F113`) |
| Swift | 6.3.3 (`swiftlang-6.3.3.1.3`) |
| Project Swift mode | 6.0 |
| Deployment target | iOS 26.0 |
| Strict concurrency | `complete` |
| Approachable Concurrency | `YES` |
| Default actor isolation | project-level `nonisolated` |
| Firebase iOS SDK | 12.15.0, pinned in `Package.resolved` |
| Validation authority | HU-075 versioned fast-unit/UI-smoke/release lanes |

Xcode 27 or an iOS 27 simulator may exist on the host, but neither is an
authority or accepted destination for HU-076.

## Source inventory

| Concern | Production baseline | Closure target |
| --- | ---: | ---: |
| `ReguertaRuntimeEnvironment` references | 26 in 12 files | 0 |
| `DevelopmentTimeMachine.shared` call sites | 12 in 2 consumer files | 0 |
| `DevelopmentTimeMachine.shared` declarations | 1 | 0 |
| `@unchecked Sendable` declarations | 15 in 15 files | 0 |
| Firebase-importing files | 34: Data 24, App 9, Presentation 1 | no growth; existing Presentation residual moves in Phase 4 |
| `@preconcurrency` | 0 | 0 |
| `nonisolated(unsafe)` | 0 | 0 |
| `Task.detached` | 0 | 0 |
| `DispatchQueue` | 2 in 2 files | 1 retained pre-existing use; 0 added |

The 15 unchecked declarations are:

1. retroactive `FirebaseAuth.User` sendability;
2. `DevelopmentTimeMachine`;
3. `FirebaseImagePipelineManager`;
4. `FirestoreMemberRepository`;
5. `FirestoreProductRepository`;
6. `FirestoreSeasonalCommitmentRepository`;
7. `FirestoreDeliveryCalendarRepository`;
8. `FirestoreShiftRepository`;
9. `FirestoreShiftPlanningRequestRepository`;
10. `FirestoreShiftSwapRequestRepository`;
11. `FirestoreNewsRepository`;
12. `FirestoreNotificationRepository`;
13. `FirestoreSharedProfileRepository`;
14. `FirestoreStartupVersionPolicyRepository`;
15. `FirestoreDeviceRegistrationRepository`.

## Reproduced ownership defects

### Candidate environment is published before authorization completes

`ResolveAuthorizedSessionUseCase` applies the resolved environment and then
suspends while reading the exact member. Any concurrent repository using the
process-global fallback can observe the candidate before the authorized
session is published, or even when member validation later fails.

### A logical operation can switch paths after suspension

Firestore path helpers and repository defaults read the live static environment
at call time. A multi-step operation that reaches another helper after an
`await` can therefore use a successor environment instead of the one with
which it started.

### State and signal have different ownership

Every `RuntimeSessionEnvironmentRouter` creates or receives its own transition
signal, while every instance mutates the same static Mutex-backed state. A
mutation through one router does not notify observers of another router even
though their effective environment changed.

### Successful ownership lease is discarded

`AccessResolutionResult.authorized` returns member and environment but not the
lease created for the successful transition. HU-076 moves the commit after
mandatory hydration: the session owner creates and retains the lease in the
same synchronous turn in which it publishes the route and authorized mode.
Session cleanup currently performs an unconditional environment reset; the
conditional stale-lease protection exists only for temporary rollback during
authorization.

## Initial affected-file inventory

The 12 production files that reference the process-global environment are:

- `App/NewsNotificationsFeatureDependencies.swift`;
- `Presentation/Shifts/ShiftsFeatureViewModel.swift`;
- `Data/Firestore/ReguertaFirestorePath.swift`;
- `Data/Firestore/RuntimeSessionEnvironmentRouter.swift`;
- `Data/Access/FirebaseMemberAdministrationRepository.swift`;
- `Data/Media/FirebaseImagePipelineManager.swift`;
- `Data/ShiftSwapRequests/FirestoreShiftSwapRequestRepository.swift`;
- `Data/Orders/FirestoreOrdersRepository.swift`;
- `Data/Orders/FirestoreMyOrderCheckout.swift`;
- `Data/Orders/FirestoreMyOrderPreviousOrder.swift`;
- `Data/Orders/FirestoreReceivedOrdersData.swift`;
- `Data/Orders/FirestoreOrderHistoryWeekKeys.swift`.

The directly changed session states are `idle`, `active(generation:)`, and
`draining(generation:)`, plus `signedOut`, `unauthorized`, and `authorized`
publication. Preserved behavior includes HU-018 production-review routing,
HU-048 cross-environment isolation, ADR-0008 cleanup-before-successor and
`DRAINING`, ADR-0009 process-live push leases, and ADR-0010 synchronous
community invalidation.

## Firebase and time boundaries

- Firebase Auth exports `FirebaseAuth.User` across async work by retroactively
  claiming unchecked sendability.
- Firestore repository reference types use unchecked conformances rather than
  compiler-visible ownership.
- The image pipeline retains `Storage`, reads the global environment after
  processing, and bridges callbacks without an operation/environment fence.
- Device coordination already uses an actor and generation/lease fences, but
  its repository still has an unchecked declaration.
- Freshness adapters already use actors and named Firebase app identity; they
  are a useful checked-owner pattern.
- `AppDelegate` uses a Firebase callback followed by
  `DispatchQueue.main.async`; HU-076 will make the owner hop explicit.
- `Presentation/Root/ReguertaImagePickerField.swift` contains the other
  pre-existing `DispatchQueue.main.async`. It is outside the touched Firebase
  boundary; HU-076 must not claim zero GCD globally.
- `DevelopmentTimeMachine.shared` is process-global and unchecked, with no
  direct persistence/independence tests.

## Preserved residual and phase boundary

`Presentation/Root/SessionViewModelDependencies.swift` is the only production
Presentation file importing Firebase and constructing live Data adapters. The
accepted roadmap assigns that move to Phase 4. HU-076 may adapt constructor
arguments but must neither move the composition architecture nor add another
Presentation SDK import.

## Inherited executable baseline

- `fast-unit-v1`: 488 unit tests passed in HU-075.
- `ui-smoke-v1`: 4 UI tests passed in HU-075.
- `release-gate-v1`: 497 logical tests, 496 passed, 1 known launch-matrix skip,
  0 failed in HU-075.
- Strict SwiftLint 0.61.0: zero findings.
- Effective Swift settings: all 6 target/configuration pairs passed.
- Approved destination: iPhone 17 / iOS 26.5,
  `087C0B4D-8C32-419D-8B71-1763CAC6D46B`.

Inherited results are context, not closure evidence. HU-076 must rerun focused
gates throughout, UI smoke after auth/session clusters, and the complete
release gate at closure.

### Focused identifiers activated for Phase 3

- `RuntimeSessionEnvironmentRouterTests`;
- `FirebaseFunctionsSecurityBoundaryTests` authorization/environment cases;
- `SessionOperationInvalidationTests`;
- `SessionOperationCleanupBarrierTests`;
- `SessionOperationPreProviderCancellationTests`;
- `SessionOperationTimeoutTests`;
- `SessionPostAuthenticationFailureTests`;
- `FirebaseAuthenticationMutationFlowTests`;
- `FirebaseAuthSessionSecurityTests`;
- `P101AuthorizedDeviceCoordinatorTests`;
- `P217AuthorizedDeviceProcessAuthorizationTests`;
- `CriticalDataFreshnessEnvironmentTests`;
- `CriticalDataRefreshUseCaseTests`;
- `ReguertaRootDependencyTests`;
- new environment snapshot, lease lifecycle, clock, repository, and media
  identifiers recorded as they are added.

### UI matrix

HU-076 changes ownership and routing but no SwiftUI layout, copy, or visual
state. Phone/iPad, light/dark, ES/EN, Dynamic Type (`Large`, `XXX Large`, AX5),
VoiceOver, and Reduce Motion visual matrices are therefore N/A for changed UI.
The four versioned mock-backed UI-smoke journeys remain mandatory because auth,
session, restricted mode, and navigation entry behavior can regress even
without a visual diff. The nine existing UI responsibilities and sole known
launch-matrix skip must remain in the final release inventory.

## Android parity gap

Android currently invokes `onAuthorizedEnvironmentResolved` before exact member
validation and its `ReguertaFirestorePath` falls back to a process-global
runtime environment. Android is outside HU-076, so no Android source changes in
this story; closure must record the temporary gap and the need for separately
governed parity follow-up rather than report no impact or create unapproved
Android work.

## Local implementation and validation evidence - 2026-08-19

At this documentation checkpoint, the implementation is present only in the
uncommitted local worktree on
`codex/hu-076-ios-session-environment-ownership`. `HEAD` remains
`d079379d9d51c0bb6c3381acce42b8291fa73c75`, the branch has no upstream, and
HU-076 has not yet been committed or published. Commit, push, and opening the
prior HU-075 and current HU-076 pull requests are authorized and pending this
turn. Merge, issue closure, deployment, branch deletion, and integration remain
unauthorized.

### Final source counts

| Concern | Baseline | Validated result | Result |
| --- | ---: | ---: | --- |
| `ReguertaRuntimeEnvironment` | 26 in 12 files | 0 | passed |
| `DevelopmentTimeMachine.shared` calls | 12 in 2 consumer files | 0 | passed |
| `DevelopmentTimeMachine.shared` declarations | 1 | 0 | passed |
| `@unchecked Sendable` | 15 in 15 files | 0 | passed |
| `@preconcurrency` | 0 | 0 | passed |
| `nonisolated(unsafe)` | 0 | 0 | passed |
| `Task.detached` | 0 | 0 | passed |
| `DispatchQueue` | 2 in 2 files | 1 in 1 file | AppDelegate use removed; 0 added |
| Firebase imports | Data 24, App 9, Presentation 1 | unchanged | passed |

`Package.resolved`, Android, and `Reguerta.xcodeproj/project.pbxproj` have no
diff in the final scope audit. The remaining GCD use is the pre-existing
`Presentation/Root/ReguertaImagePickerField.swift:266`; it is not a new escape
and HU-076 does not claim a repository-wide zero-GCD result. Ordinary
semantically required `nonisolated` declarations are not counted as unsafe
escapes; the zero target applies to `nonisolated(unsafe)`.

The final tree contains 363 Swift files and 62,984 lines:

| Area | Swift files | Lines |
| --- | ---: | ---: |
| Production | 253 | 36,197 |
| Unit tests | 108 | 26,403 |
| UI tests | 2 | 384 |
| Total | 363 | 62,984 |

### Ownership and explicit-environment result

| Boundary | Local implementation state |
| --- | --- |
| Runtime routing | One `RuntimeSessionEnvironmentStore` owns effective environment, lease, and the transition signal per graph |
| Authorization | Candidate member reads and mandatory hydration receive the explicit candidate; the live route is committed only with the retained successful lease |
| Repository actor hop | The initiating owner captures `SessionEnvironment` before the first suspension or actor-isolated call; Domain repository methods require it explicitly |
| Nested paths and effects | Repository actors and helpers reuse the received value; they do not recapture a live provider after enqueue or suspension |
| Development time | One injected `DevelopmentTimeMachine` instance per graph; no `.shared` access or unchecked conformance |
| Firebase references | Auth, Functions, devices, freshness, Firestore repositories, and media retain SDK values inside their checked Data/App owner |
| Active entry | `AuthorizedSession.representsActiveAuthorization` requires principal linkage, active authenticated/selected members, and valid delegation before session-owned work starts |
| Presentation publication | Result/error publication requires the current owner plus live authorization/revision, or a consumer receipt binding a synchronous self-owned handoff to the resulting authorization and revision |
| Presentation cleanup | Cleanup requires only the operation owner; it releases that owner's transient tasks/loading/handles after a stale revision, fails closed where required, and is a no-op for a successor |
| Presentation re-entry | Route-owned cancel-and-replace reads create a successor; independent mutations may retain an explicit owner through benign re-entry but remain live-session fenced before publication |
| Local order state | Storage keys include environment; legacy unqualified state is not restored automatically |
| Orders SDK | `FirestoreOrdersRepository` and its actor-isolated extensions are the sole owners of live Firestore references |

The actor-mailbox regression exercises a route transition after submission but
before the repository actor handles the operation, proving the contract must
capture at the initiating owner rather than inside the actor body. It passed in
the final post-remediation test run.

### Late review findings and remediations

| Finding | Remediation and executable coverage |
| --- | --- |
| A `.authorized` enum case could remain structurally present after its authority had been revoked | One canonical active-authorization predicate validates principal linkage, member activity, and delegated selection. Fail-closed fixtures prove Products, Shifts, Freshness, Users, every Orders route, and device-token entry stop before repository work. |
| Equal-context Orders re-entry could invalidate an old owner while de-duplication prevented its successor from starting | De-duplication includes the operation owner/generation. Nine regressions cover previous order, producer status, checkout, both history phases, received snapshot, and status mutation; stale completion and cleanup cannot clear successor progress. |
| Sign-out/re-login could recreate the same route identity and environment | All four Orders route models capture `sessionStateRevision`; six regressions cover their loads plus checkout and status mutation. |
| Local My Order draft/confirmation keys did not identify the Firebase environment | The key now includes environment. Develop state cannot restore in production, and legacy unqualified state is deliberately ignored because its origin is unverifiable. This accepts loss of automatic restoration for older local state. |
| A stale feature result could survive an unobserved live-session change | Users compares stored and live authorization signatures; Shared Profile fences refresh/save/delete/upload; Products and Shifts include live session revision. Results and cleanup are conditional on the current owner. |
| Requiring a live revision for cleanup could strand loading/tasks after benign re-entry or revocation | Publication remains owner plus live-session fenced, while owner-only cleanup releases only its own transient state. Seven Orders-read and seven Products/Shifts read, entry, and no-clobber regressions cover successor and retained-owner behavior. |
| Freshness could reject stale publication but leave its operation/timeout handles and `.checking` state behind | The complete authorization/revision fences payload publication; owner-only operation and timeout cleanup clear both handles, move checking fail-closed, preserve a successor, and allow only a receipt-backed synchronous self-owned handoff. Two deterministic regressions cover completion and timeout. |
| Unauthorized refresh could release routing while retaining the device-session lease | Revocation uses owned local-session termination, invalidates context/lease, rejects late and new tokens, and preserves cleanup-before-successor plus `DRAINING`. |
| Firebase callbacks could resolve successfully after their tasks were cancelled | Callback bridges re-check cancellation after completion. Two post-callback regressions, separate from the 16 owner-cleanup cases, prove email verification maps late success to `false` and a late FCM token throws `CancellationError` without persistence or registration. |
| Split Orders helpers could transfer live SDK references outside the repository owner | Async helpers are actor-isolated `FirestoreOrdersRepository` extensions. A structural regression rejects async SDK parameters and verifies actor ownership across all Orders source files. |
| Several concurrency test waiters could hang, poll, or double-resume under cancellation | Waiters use UUID ownership, cancellation handlers, double-checked registration, exactly-once removal/resume, `cancelAll`/`defer`, bounded suite limits, and `NSCondition` for the synchronous mailbox. |

### Test chronology deviation

The worktree contains 574 Swift Testing `@Test` declarations versus 482 at the
baseline commit, a source-level delta of 92. Together with 6 XCTest unit methods,
the final unit inventory is 580 logical tests; 9 XCTest UI methods form the full
UI inventory. New coverage includes lease
lifecycle, injected development time, media isolation/cancellation, runtime
routing, actor-mailbox capture, active-entry authorization, feature live-session
fences, Orders operation ownership, owner-only read/timeout cleanup, Freshness
publication receipts, device revocation, callback cancellation, and deterministic
waiter behavior. Sixteen final owner-cleanup regressions are split as seven
Orders reads, seven Products/Shifts read, entry, and no-clobber cases, and two
Freshness cases. Two additional post-callback regressions cover email
verification and FCM cancellation without persistence/registration. This
static inventory is not a substitute for executable counts.

A reproducible red step was not retained for every cluster. In particular,
actor-mailbox, media, active-entry, same-context, session-revision, owner-
cleanup, device, callback, and waiter cases were added during review remediation
rather than before all implementation. HU-076 records this as a process
deviation and does not mark the originally worded red-first tasks as completed.
The parameterized `authenticatedClientMapsTokenRefreshFailures` case is the retained mapping TDD
evidence: cancellation -> `.cancelled`, timeout -> `.timeout`, no authenticated
user -> `.missingIDToken`, and unavailable token refresh ->
`.transport(message: "unavailable")`.

### Executed validation

All commands used the approved iPhone 17 / iOS 26.5 simulator
`087C0B4D-8C32-419D-8B71-1763CAC6D46B` where a simulator destination applied.

| Gate | Final evidence |
| --- | --- |
| Focused regressions | Complete ownership, active-entry, live-session, callback, device, repository, media, and waiter remediation matrix passed |
| Fast unit | 580/580 passed, 0 skipped, 0 failed: 574 Swift Testing plus 6 XCTest |
| UI smoke | 4/4 passed |
| Release gate | 589 logical responsibilities: 588 passed, 1 known launch-matrix skip, 0 failed |
| SwiftLint | 0.61.0; 363 Swift files, 0 violations |
| Effective settings | 6/6 target/configuration pairs passed |
| Generic builds | Debug and `Reguerta-Production` Production Release passed |
| Repository audit | `git diff --check` passed; `Package.resolved`, Android, and `project.pbxproj` have no diff |

The Phase 2 SwiftLint `PATH` warning was historical and is not a current Xcode
or Issue Navigator diagnostic.

### Preserved residuals

- `Presentation/Root/SessionViewModelDependencies.swift` remains the sole
  Firebase-importing Presentation file, with live composition assigned to
  Phase 4. The count did not grow and this is not accepted as a new exception.
- Android source is unchanged. Android still publishes its resolved environment
  before exact member validation and retains ambient fallback routing, so the
  security/ownership parity gap remains and requires separately governed
  follow-up work.
- No iOS/Xcode 27-only setting, API, simulator, or rule entered the diff.

## Delivery state

Independent iOS concurrency/architecture review completed with 0 P0-P3
findings. Remote issue #251 is synchronized with this final local evidence,
verified open, and retains its labels. The implementation is validated and
`ready_for_merge`; commit, push, and opening the prior HU-075 and current HU-076
pull requests are authorized and pending in this turn. At this checkpoint it
remains uncommitted and unpublished on a branch without upstream. Merge, issue
closure, branch deletion, deployment, and integration remain unauthorized.
