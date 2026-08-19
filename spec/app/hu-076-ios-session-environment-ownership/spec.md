# HU-076 - Own the iOS session environment and Firebase SDK references

## Metadata

- issue_id: #251
- priority: P1
- platform: ios
- status: ready_for_merge

## Authorization and delivery boundary

Authorization source: the maintainer's 2026-08-19 message in the Codex task,
quoted verbatim: "Pues si fase 2 está terminada comenzamos fase 3".

The instruction authorizes the bootstrap and implementation of Phase 3 after
the locally completed and published HU-075 branch.

Delivery authorization source: the maintainer's later 2026-08-19 message,
quoted verbatim: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
This authorizes committing and pushing HU-076 and opening the prior HU-075 and
current HU-076 pull requests. It does not authorize merging either pull request,
closing an issue, deleting a branch, Firebase deployment, live-data mutation,
package upgrades, or integration into `main`.

HU-076 is intentionally separate from HU-074 and HU-075. Its branch starts at
the published HU-075 tip `d079379` because neither predecessor is integrated
into `main`. The authorized delivery must preserve that dependency or wait until
the stack is integrated and then rebase or retarget this story.

## Context and problem

HU-074 made the iOS project's actor ownership explicit enough to compile with
project-level `nonisolated` default isolation. It protected the existing
process-global session environment with a `Mutex`, but deliberately deferred
the broader runtime and Firebase ownership redesign to this story.

The current process-global environment is data-race safe but not operation
safe. Authorization publishes the resolved environment before the exact member
read finishes. Other repositories can therefore observe the destination while
the visible session still represents the predecessor. Repositories and helper
functions that consult the global fallback after an `await` can also route one
logical operation through two environments.

Each `RuntimeSessionEnvironmentRouter` owns a separate transition signal while
all router instances mutate the same static state. A mutation through one
router is consequently invisible to observers of another router. The lease
used during authorization is also discarded on success, so later cleanup uses
an unconditional reset instead of proving that it still owns the environment.

The development clock has similar process-global ownership through
`DevelopmentTimeMachine.shared`. Firebase reference types are retained behind
15 `@unchecked Sendable` declarations, including a retroactive conformance for
`FirebaseAuth.User`. These declarations prevent the compiler from proving the
actual boundary and make future refactors depend on undocumented SDK behavior.

## User story

As an iOS maintainer, I want session routing, development time, and Firebase SDK
references to have explicit owners, so that concurrent work cannot mix users or
environments and Swift 6 can verify every value that crosses an isolation
boundary.

## Scope

### In scope

- Replace `ReguertaRuntimeEnvironment` with an instance-owned synchronous
  environment store composed once per application graph.
- Co-own environment state and its transition signal so every mutation is
  published synchronously to observers of the same owner.
- Capture the effective `SessionEnvironment` synchronously in the initiating
  owner before the first suspension or actor-isolated repository call. Require
  that explicit immutable value at repository and path boundaries, and remove
  process-global fallback reads and default arguments.
- Resolve and validate the exact member against an explicit target environment
  before publishing that environment as the authorized route.
- Preserve the successful environment lease in the authorized session lane and
  use conditional cleanup so stale work cannot reset a successor.
- Preserve ADR-0008 cleanup-before-successor, timeout, cancellation, and
  `DRAINING` behavior and ADR-0010 synchronous community invalidation.
- Replace `DevelopmentTimeMachine.shared` with an injected instance-owned
  clock while preserving persisted develop-time override behavior.
- Remove the retroactive `FirebaseAuth.User` sendability escape and transfer
  only immutable Domain values across the Auth adapter boundary.
- Remove every production `@unchecked Sendable` in the accepted baseline by
  giving each Firebase adapter an actor, main-actor, immutable, or compiler-
  checked owner appropriate to its operations.
- Audit and harden Auth, Functions, device registration/messaging, freshness,
  Firestore repositories, and the image pipeline in small testable clusters.
- Replace AppDelegate callback/GCD ownership with an explicit structured-
  concurrency hop where touched by the Firebase boundary work.
- Add deterministic tests for snapshots, leases, ordering, cleanup, late
  results, injected time, and relevant SDK adapter boundaries without live
  Firebase access or real sleeps.
- Make active authorization a canonical entry condition for session-owned
  presentation work. A value shaped as `.authorized` is insufficient unless
  principal linkage, active authenticated/selected members, and delegated
  selection authority are all still valid in the live session.
- Fence presentation operations with an operation owner/generation and the
  live session revision/signature, including same-context re-entry and
  sign-out/re-login to an apparently identical identity and environment.
- Partition My Order local state by environment. Do not automatically adopt
  legacy unqualified keys because their source environment cannot be proven.
- Keep every Orders Firestore reference inside `FirestoreOrdersRepository`'s
  actor isolation, including helper implementations split across source files.
- Record ADR-0012 in aligned English and Spanish documents.

### Out of scope

- Moving live Firebase/Data construction out of
  `Presentation/Root/SessionViewModelDependencies.swift`; Phase 4 owns that
  composition-root migration. HU-076 may only adapt signatures required by the
  new owner and must not increase the existing single Presentation SDK leak.
- Redesigning `AccessRootViewModel`, the app shell, navigation, SwiftUI routes,
  DesignSystem, layout, or vertical feature slices.
- Product behavior, schema, Firestore Rules, Cloud Functions, Firebase deploy,
  live-data mutation, or production configuration changes.
- Firebase/Swift package upgrades or changes to `Package.resolved`.
- Android changes. Android currently retains an equivalent early-publication
  and ambient-environment design, so HU-076 creates a documented temporary
  parity gap that requires its own governed follow-up rather than an unplanned
  cross-platform expansion.
- XCTest migration, new remote CI, or validation-lane redesign.
- APIs, settings, simulators, or rules exclusive to iOS/Xcode 27.
- Merging a pull request, issue closure, branch deletion, deployment, or
  integration without separate authorization. Commit, push, and opening the
  prior HU-075 and current HU-076 pull requests are authorized for this turn.

## Ownership contract

1. One application graph owns one environment store and one transition signal.
2. Environment transitions are synchronous and mutation happens before signal
   publication; no observer can see a new transition backed by old state.
3. The initiating owner captures one immutable `SessionEnvironment` before its
   first suspension or actor-isolated repository call. Repository actors and
   nested helpers receive that value explicitly and use it for every path and
   client decision without consulting a live provider.
4. Exact member authorization reads the target environment explicitly. The
   live route is published only after identity, membership, and access checks
   have succeeded.
5. After mandatory hydration succeeds and the operation is still current, the
   session owner creates and retains an ownership lease immediately before
   committing the route and visible authorized mode. Only that lease may reset
   the route during normal cleanup; an older lease is a no-op.
6. Cleanup remains definitive before a successor begins. Timeout or cancellation
   cannot release the serialized lane while security cleanup is still running.
7. Firebase SDK objects remain inside the isolated adapter that owns them.
   Only immutable Domain values, snapshots, identifiers, DTOs, or typed errors
   cross actor boundaries.
8. Development time is an injected dependency. Persistence is instance-owned;
   no process-global singleton or unchecked sendability is required.
9. Session-owned feature entry points accept only a live session satisfying the
   canonical active-authorization invariant. Test and preview fixtures must
   fail closed when they intentionally provide an inactive, unlinked, or
   unauthorized delegated session.
10. Every asynchronous presentation operation has an owner/generation and a
   captured session revision or complete authorization signature. Publishing a
   result or error requires the current owner plus live authorization/revision,
   except for a synchronous self-owned handoff backed by a consumer receipt for
   the resulting authorization and revision. Cleanup is fenced only by the
   operation owner: it releases that owner's transient tasks/loading/handles
   even after the revision becomes stale, fails closed where required, and is a
   no-op for a successor.
11. Route-owned cancel-and-replace reads create a successor owner on re-entry.
   Independent mutations may retain an explicit owner across benign re-entry,
   but their result/error publication always remains live-session fenced.
12. Environment-scoped local state includes the environment in its storage
   key. Legacy My Order keys without that discriminator are ignored rather
   than migrated across an unverifiable security boundary.
13. Firebase callback bridges check cancellation after the callback resolves,
   and authorization revocation invalidates the local session/device lease
   before its owned cleanup completes. The serialized `DRAINING` barrier still
   prevents a successor from starting early. A cancelled email-verification
   callback resolves `false`; a cancelled late FCM token throws
   `CancellationError` without persistence or registration.

## Linked requirements and decisions

- `AGENTS.md` repository workflow and iOS concurrency rules.
- ADR-0001: MVVM and Clean Architecture.
- ADR-0003: Firebase backend services.
- ADR-0004: iOS root dependency injection.
- ADR-0008: bounded mobile session operations and cleanup barriers.
- ADR-0009: process-live push authorization.
- ADR-0010: community-feed ownership and synchronous invalidation.
- ADR-0011: project-level `nonisolated` isolation and explicit owners.
- ADR-0012: instance-owned runtime context and Firebase SDK references.
- HU-074 / issue #249 and HU-075 / issue #250.
- Related preserved contracts: HU-018 / issue #13 and HU-048 / issue #109.
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/251
- Reproducible starting inventory: `phase-3-baseline.md`.

## Acceptance criteria

- Production contains zero references to `ReguertaRuntimeEnvironment`; no
  static/global replacement is introduced.
- Two independently composed environment owners do not share state or signals.
- Every environment-dependent operation captures one explicit immutable
  `SessionEnvironment` before its first suspension or actor hop and retains it
  across every repository, helper, path, Functions, and media boundary.
- An exact-member authorization failure never publishes the candidate
  environment as the live route.
- Environment mutation precedes synchronous transition publication for apply,
  conditional reset, and explicit fail-safe reset.
- The authorized session retains its environment lease; stale cleanup cannot
  reset a newer session, while current cleanup restores the configured base.
- Timeout, cancellation, sign-out, replacement, and post-authentication failure
  preserve cleanup-before-successor and the `DRAINING` barrier.
- Products, Shifts, Freshness, Users, Shared Profile, every Orders route, and
  authorized device entry fail closed when the live `.authorized` value no
  longer represents a valid active authorization, even if the route handler
  has not yet observed that revocation.
- Same-context Orders re-entry gives the successor its own operation owner;
  obsolete completion and `defer` cleanup cannot clear the successor's loading
  state or publish data. Sign-out/re-login is additionally fenced by session
  revision for loads, checkout, and producer-status writes.
- Route-owned Orders, Products, and Shifts reads cancel-and-replace with a new
  owner on re-entry. Independent mutations may preserve an explicit owner for a
  benign re-entry, but remain live-authorization/revision fenced before result
  or error publication.
- Freshness captures complete authorization and revision before suspension. A
  revoked payload neither applies nor marks ready; owner-only completion and
  timeout cleanup release their own handles, leave checking fail-closed, and
  cannot clobber a successor. A synchronous self-owned member handoff requires
  the consumer receipt for the resulting revision.
- My Order drafts and confirmed snapshots are isolated by environment. Develop
  state is never restored in production, and legacy unqualified state is
  intentionally not restored automatically.
- Production contains zero references to `DevelopmentTimeMachine.shared`; the
  override remains persisted and deterministic through an injected clock.
- Production contains zero `@unchecked Sendable` declarations and does not add
  `@preconcurrency`, `nonisolated(unsafe)`, `Task.detached`, GCD, or another
  concurrency escape. The touched AppDelegate GCD hop is removed; the one
  pre-existing `ReguertaImagePickerField` GCD use remains outside HU-076.
- Firebase Auth never exports `FirebaseAuth.User`; Auth, Functions, devices,
  freshness, repositories, and media pass only checked immutable values across
  their owners.
- Firebase Auth cannot return a successful callback result after task
  cancellation, revoked-session cleanup invalidates the device lease/context
  before allowing a successor, and Orders async helpers do not transfer
  Firestore SDK references outside their repository actor.
- The existing Presentation composition debt remains exactly one Firebase-
  importing file and is explicitly carried to Phase 4; it is not expanded.
- `Package.resolved` and all Firebase/backend/live-data state remain unchanged.
- Focused tests pass after every implementation cluster; `fast-unit-v1` and
  the four-test `ui-smoke-v1` pass on an explicit iOS 26 simulator.
- The final `release-gate` passes and reports logical pass/skip/fail counts;
  Debug and Production Release generic builds remain green.
- SwiftLint 0.61.0, six effective build-setting pairs, `git diff --check`,
  package-pin review, and an independent iOS concurrency/architecture review
  have no unresolved finding.
- Android source remains unchanged, but its equivalent ambient routing and
  early-publication behavior is recorded as a temporary security/ownership
  parity gap requiring a separately governed follow-up.

## Executable verification contract

| Gate | Required result |
| --- | --- |
| Environment owner tests | Independent stores/signals, snapshot stability, stale lease, and mutation-before-publication pass |
| Session lifecycle tests | Authorization ordering, timeout, cancellation, replacement, cleanup, and `DRAINING` pass |
| Firebase boundary tests | Auth late result, Functions environment, device token generation, freshness, repository, and media cases pass without network |
| Fast unit | `./scripts/validate-ios.sh fast-unit --destination <iOS-26-destination>` exits 0 |
| UI smoke | `./scripts/validate-ios.sh ui-smoke --destination <iOS-26-destination>` passes 4/4 |
| Composite release gate | Lint, settings, Debug/Release builds, and full test plan exit 0 with counts recorded |
| Source audit | Global/unchecked/unsafe-escape searches meet their zero targets, GCD changes from two pre-existing uses to one with none added, and the Presentation Firebase import count does not grow |
| Repository diff | `Package.resolved` unchanged, `git diff --check` clean, scope review clean |

## Dependencies

- The branch starts from HU-075 commit `d079379`; #249 and #250 remain open and
  unmerged.
- Xcode 26.6, Swift 6.3.3, Swift 6 mode, strict concurrency `complete`,
  project-level `nonisolated`, and iOS 26 are the maintenance authority.
- Firebase iOS SDK remains pinned to 12.15.0 through the existing resolved file.
- Existing versioned HU-075 validation lanes remain the executable authority.

## Risks

- Publishing a candidate environment too early can contaminate another active
  session. Mitigation: exact member validation uses an explicit candidate and
  live publication is the final successful transition.
- Replacing a global fallback can miss a deeply nested helper. Mitigation:
  source inventory is a zero-count gate and the initiating owner passes an
  explicit immutable environment before suspension or an actor hop.
- Actor conversion can reorder callbacks or break cancellation. Mitigation:
  use the smallest correct owner per adapter, characterize behavior first, and
  preserve generation/lease fences.
- A stale cleanup can clobber a successor. Mitigation: retain and conditionally
  release the successful environment lease.
- The Phase 4 composition debt can blur scope. Mitigation: allow only mechanical
  signature adaptation in the existing file and record the residual explicitly.
- A stacked branch can hide integration dependencies. Mitigation: record base,
  predecessors, and future retarget/rebase requirements in every artifact.

## Local implementation and validation evidence - 2026-08-19

At this documentation checkpoint, the implementation exists only in the local
worktree on `codex/hu-076-ios-session-environment-ownership`. `HEAD` remains the
published HU-075 tip `d079379`; HU-076 has no commit, upstream, publication, or
pull request yet. Commit, push, and opening the prior HU-075 and current HU-076
pull requests are authorized and pending in this delivery turn. Post-remediation
executable gates are green. Final independent review reports 0 P0-P3 findings;
issue #251 is synchronized, verified open, and retains its labels. Merge, issue
closure, branch deletion, deployment, and integration remain unauthorized.

Final production source counts are:

| Concern | Baseline | Validated result |
| --- | ---: | ---: |
| `ReguertaRuntimeEnvironment` | 26 references in 12 files | 0 |
| `DevelopmentTimeMachine.shared` | 12 call sites plus 1 declaration | 0 |
| `@unchecked Sendable` | 15 declarations in 15 files | 0 |
| `@preconcurrency` | 0 | 0 |
| `nonisolated(unsafe)` | 0 | 0 |
| `Task.detached` | 0 | 0 |
| `DispatchQueue` | 2 references in 2 files | 1 pre-existing reference; 0 added |
| Firebase-importing files | Data 24, App 9, Presentation 1 | unchanged |

The final tree contains 363 Swift files and 62,984 lines: production 253 files
and 36,197 lines, unit tests 108 files and 26,403 lines, and UI tests 2 files
and 384 lines. `Package.resolved`, Android, and `project.pbxproj` have no diff.
The remaining Presentation Firebase import is
`Presentation/Root/SessionViewModelDependencies.swift`, retained explicitly for
Phase 4. Android source is unchanged, but its equivalent early-publication and
ambient-routing behavior remains a temporary security/ownership parity gap.

Late review remediation broadened the safety contract beyond the initial four
regressions:

- a canonical `representsActiveAuthorization` entry guard covers principal
  linkage, active members, and authorized delegation; fail-closed fixtures
  prove Products, Shifts, Freshness, Users, every Orders route, and device-token
  entry do not reach repositories after an unobserved revocation;
- nine Orders regressions cover same-context owner-aware re-entry, and six cover
  session-revision fencing across all four route models, checkout, and status
  mutation;
- My Order local keys now include the environment. Develop and production do
  not restore each other's drafts or confirmations, and ambiguous legacy keys
  are deliberately ignored rather than migrated;
- Users validates both stored and live authorization signatures; Shared Profile
  fences refresh/save/delete/upload; Products and Shifts include the live
  session revision. Obsolete results and cleanup cannot publish into or clear a
  successor;
- route-owned cancel-and-replace reads create a successor on re-entry, while
  independent mutations may retain an explicit owner through benign re-entry
  and still require live authorization/revision before publication;
- 16 final owner-cleanup regressions cover seven Orders reads, seven Products/
  Shifts read, entry, and no-clobber cases, and two Freshness cases. Freshness
  rejects a revoked suspended payload, clears operation/timeout handles, exits
  checking fail-closed, and permits only a receipt-backed self-owned handoff;
- two additional post-callback regressions are tracked separately: email
  verification maps a late success to `false`, while a late FCM token throws
  `CancellationError` without being persisted or registered;
- revoked refresh uses the owned local-session termination path, invalidates
  the device lease/context, rejects late and new tokens, and preserves the
  cleanup barrier before successor sign-in;
- Firebase callback bridges re-check cancellation after callback completion;
  Shift Planning and Media retain their cancellation fences;
- `FirestoreOrdersRepository` is the sole actor owner of its Firestore SDK
  references, including helpers implemented in separate files; and
- deterministic test waiters use cancellable UUID ownership, double-checked
  registration, exactly-once removal/resume, bounded suite time limits,
  `NSCondition` where a synchronous mailbox is required, and `cancelAll`/`defer`
  cleanup instead of unbounded polling.

A reproducible red step was not retained for every implementation cluster.
Several actor-hop, media, entry-guard, same-context, session-revision, owner-
cleanup, device, callback, and waiter cases were added during review remediation. HU-076
records that deviation instead of claiming universal test-first execution. The
parameterized `authenticatedClientMapsTokenRefreshFailures` mapping did retain its red/green
step for cancellation, timeout, missing user, and unavailable token refresh.

Executable evidence on iPhone 17 / iOS 26.5
(`087C0B4D-8C32-419D-8B71-1763CAC6D46B`) is:

- fast unit: 580/580 passed, 0 skipped, 0 failed, comprising 574 Swift Testing
  tests and 6 XCTest tests;
- UI smoke: 4/4 passed;
- release gate: 589 logical responsibilities, 588 passed, 1 known
  launch-matrix skip, 0 failed;
- SwiftLint 0.61.0: 363 Swift files, 0 violations;
- effective settings: 6/6 target/configuration pairs passed;
- generic Debug and `Reguerta-Production` Production Release builds passed;
- `git diff --check` passed, and `Package.resolved`, Android, and
  `project.pbxproj` have no diff.

The source inventory contains 574 `@Test` declarations, 6 XCTest unit methods,
and 9 XCTest UI methods. The Phase 2 SwiftLint `PATH` warning was historical and
is not a current Xcode or Issue Navigator diagnostic.

## Definition of Done (DoD)

- [x] All acceptance criteria have exact executable evidence.
- [x] ADR-0012 is aligned in English and Spanish.
- [x] Global runtime environment and time-machine singleton counts are zero.
- [x] All 15 baseline unchecked sendability escapes are removed safely.
- [x] Focused, fast-unit, UI-smoke, and release gates pass on iOS 26 after all
  review remediations.
- [x] Package pins, backend state, Android source, and iOS/Xcode 27 scope are
  unchanged.
- [x] Independent review has no unresolved finding (0 P0-P3).
- [x] Issue #251 reflects local evidence and remains open; commit, push, and
  opening the prior/current pull requests are authorized and pending this turn,
  while merge, issue closure, branch deletion, deployment, and integration
  remain separately gated.
