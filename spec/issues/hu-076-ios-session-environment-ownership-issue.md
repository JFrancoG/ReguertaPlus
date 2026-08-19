# [HU-076] Own the iOS session environment and Firebase SDK references

## Summary

Replace process-global iOS runtime context with an instance-owned synchronous
environment, capture an explicit immutable `SessionEnvironment` before every
suspension or actor-isolated repository call, retain the authorized lease
through cleanup, inject development time, and remove unchecked Firebase SDK
crossings without changing product or backend behavior.

## Authorization and dependency

The maintainer activated Phase 3 on 2026-08-19 with the verbatim instruction:
"Pues si fase 2 está terminada comenzamos fase 3".

This authorizes bootstrap and implementation.

The maintainer later authorized delivery on 2026-08-19, quoted verbatim: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
This authorizes committing and pushing HU-076 and opening the prior HU-075 and
current HU-076 pull requests. Merge, issue closure, branch deletion, deployment,
and integration remain unauthorized.

- Depends on #249 and #250.
- Branch: `codex/hu-076-ios-session-environment-ownership`.
- Stacked base: published HU-075 tip `d079379`.
- Source commit: `59216b5`; branch and same-named `origin` upstream are published
  and synchronized.
- PR #252 is open, ready, and non-draft from HU-075 to the HU-074 branch.
- PR #253 is open, ready, and non-draft from HU-076 to the HU-075 branch.
- Issues #249, #250, and #251 remain open. HU-074 still has no pull request and
  is not integrated.

## Links

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/251
- Spec: `spec/app/hu-076-ios-session-environment-ownership/spec.md`
- Plan: `spec/app/hu-076-ios-session-environment-ownership/plan.md`
- Tasks: `spec/app/hu-076-ios-session-environment-ownership/tasks.md`
- Baseline: `spec/app/hu-076-ios-session-environment-ownership/phase-3-baseline.md`
- ADR EN: `docs/decisions/0012-own-ios-runtime-context-and-firebase-sdk-references.md`
- ADR ES: `docs-es/decisions/0012-asignar-propietarios-explicitos-al-contexto-runtime-y-sdk-firebase-en-ios.md`
- Prior pull request: https://github.com/JFrancoG/ReguertaPlus/pull/252
- Current pull request: https://github.com/JFrancoG/ReguertaPlus/pull/253

## Scope

### In scope

- One injected environment owner and synchronous signal per graph.
- An explicit immutable `SessionEnvironment` captured by the initiating owner
  before the first suspension or actor hop and required by every
  environment-dependent repository/path operation.
- Candidate member validation before live route publication.
- Successful environment lease retained through conditional cleanup.
- Preserved timeout/cancellation/cleanup/`DRAINING` invariants.
- Injected persisted development clock with no singleton.
- Checked ownership for Auth, Functions, devices, freshness, Firestore
  repositories, and media; all 15 unchecked declarations removed.
- Canonical active-authorization entry guard, owner/generation and live-session
  revision fences, and fail-closed fixtures for unobserved revocation.
- Result/error publication requires owner plus live authorization/revision, or
  a resulting-revision receipt for a synchronous self-owned handoff. Cleanup is
  owner-only, releases only its own transient state, and cannot clobber a
  successor.
- Route-owned cancel-and-replace reads create a successor on re-entry;
  independent mutations may retain an explicit owner across benign re-entry
  while remaining live-session fenced.
- Environment-qualified My Order local state and actor-owned Orders Firestore
  helpers without SDK reference transfer.
- Deterministic tests and HU-075 validation lanes on iOS 26.
- ADR-0012 in aligned English and Spanish.

### Out of scope

- Phase 4's move of live dependency construction out of the existing single
  Firebase-importing Presentation file. HU-076 may adapt only signatures and
  must not increase that debt.
- App shell, navigation, SwiftUI/layout/DesignSystem, feature slices, or product
  behavior.
- Firebase/backend/live data, packages, Android, CI redesign, or iOS/Xcode 27.
- Delivery or integration without later authorization.

## Acceptance criteria

- [x] `ReguertaRuntimeEnvironment` production references fall from 26 to 0.
- [x] Independent owner instances do not share state or transition signals.
- [x] Each initiating owner captures one explicit immutable environment before
  suspension or an actor hop, and the operation retains it across every nested
  repository, helper, path, Functions, and media boundary.
- [x] Failed exact-member validation never publishes the candidate route.
- [x] Mutation precedes signal publication for apply and resets.
- [x] Successful lease is retained; stale cleanup cannot reset a successor.
- [x] Cleanup-before-successor and `DRAINING` remain deterministic.
- [x] Session-owned feature entry rejects inactive, unlinked, or unauthorized
  delegated `.authorized` values before Products, Shifts, Freshness, Users,
  Shared Profile, Orders, or device repositories are called.
- [x] Same-context Orders re-entry has a distinct operation owner; stale result
  and cleanup cannot clear successor progress. Re-login is separately fenced by
  session revision for all route loads, checkout, and status mutation.
- [x] Route-owned cancel-and-replace reads in Orders, Products, and Shifts create
  a successor on re-entry. Independent mutations may preserve an explicit owner
  across benign re-entry, but cannot publish without live authorization/revision.
- [x] Freshness captures complete authorization and revision before suspension;
  revoked payloads neither apply nor mark ready. Owner-only completion/timeout
  cleanup releases both handles, exits checking fail-closed, and cannot clear a
  successor; a synchronous self-owned handoff requires its resulting-revision
  receipt.
- [x] My Order local state is partitioned by environment; develop state is not
  restored in production and ambiguous legacy keys are intentionally ignored.
- [x] `DevelopmentTimeMachine.shared` references fall from 12 to 0 while
  persistence behavior remains intact.
- [x] All 15 production unchecked declarations fall to 0 without another
  concurrency escape; the touched AppDelegate GCD hop is removed and the one
  pre-existing out-of-scope image-picker GCD use is reported rather than hidden.
- [x] Firebase SDK reference objects do not cross touched adapter owners; only
  checked immutable values/errors do.
- [x] Orders helpers remain isolated to their repository actor; Firebase
  callbacks re-check cancellation after completion. A late email-verification
  success resolves `false`; a late FCM token throws `CancellationError` without
  persistence or registration. Revoked-session cleanup invalidates the device
  lease/context before a successor can start.
- [x] The existing one-file Presentation composition debt does not grow and is
  carried explicitly to Phase 4.
- [x] Focused tests, fast unit, UI smoke 4/4, Debug/Release builds, and release
  gate pass on iOS 26 with counts recorded.
- [x] SwiftLint/settings/package/diff/import/escape checks are clean.
- [x] Independent iOS concurrency/architecture review is clean: 0 P0-P3.
- [x] No backend, package, Android, product, or iOS/Xcode 27 change enters the
  story.
- [x] Android's equivalent early-publication/global-routing design is recorded
  as a temporary parity gap with a separately governed follow-up.

## Initial evidence

- Xcode 26.6 / Swift 6.3.3 / iOS 26.0 / Firebase 12.15.0.
- 26 global environment references in 12 production files.
- 12 development-time singleton references in two production files.
- 15 unchecked declarations in 15 production files.
- 34 Firebase-importing production files: Data 24, App 9, Presentation 1.
- Current routing publishes the candidate before exact member validation;
  successful cleanup ownership is not retained.
- Inherited lanes: 488 unit, 4 UI smoke, 497 logical release responsibilities.

## Local implementation and validation evidence

HU-076 source is committed as `59216b5`. Its branch and same-named `origin`
upstream are published and synchronized. PR #252 is open from HU-075 to the
HU-074 branch, and PR #253 is open from HU-076 to the HU-075 branch; both are
ready and non-draft. Issues #249, #250, and #251 remain open. HU-074 still has
no pull request and is not integrated. The complete post-remediation executable
gates are green, and final independent review reports 0 P0-P3 findings. Merge,
issue closure, branch deletion, deployment, and integration remain unauthorized.

Final source counts are:

- `ReguertaRuntimeEnvironment`: 26 references in 12 files -> 0.
- `DevelopmentTimeMachine.shared`: 12 calls plus 1 declaration -> 0.
- `@unchecked Sendable`: 15 declarations in 15 files -> 0.
- `@preconcurrency`, `nonisolated(unsafe)`, and `Task.detached`: 0 -> 0.
- `DispatchQueue`: 2 pre-existing uses -> 1; the AppDelegate hop was removed,
  no use was added, and `ReguertaImagePickerField.swift:266` remains outside
  this story.
- Firebase imports: unchanged at Data 24, App 9, Presentation 1.
- `Package.resolved`, Android, and `project.pbxproj`: no diff.

The validated tree has 363 Swift files and 62,984 lines: production 253/36,197,
unit 108/26,403, and UI 2/384. Source inventory contains 574 Swift Testing
`@Test` declarations, 6 XCTest unit methods, and 9 XCTest UI methods.

The remaining Presentation Firebase file is
`Presentation/Root/SessionViewModelDependencies.swift`, whose live composition
move remains assigned to Phase 4. Android code is unchanged, but its equivalent
early-publication and ambient-routing behavior remains a temporary
security/ownership parity gap requiring separately governed follow-up.

Late remediation now covers the canonical active-authorization entry guard and
fail-closed fixtures; nine same-context plus six session-revision Orders cases;
environment-qualified local order state with intentional legacy
non-restoration; live-session fences for Users, Shared Profile, Products, and
Shifts; revoked device-lease cleanup; post-callback cancellation; Shift
Planning/Media cancellation; and exclusive Orders Firestore actor ownership.
Final owner-cleanup remediation adds 16 regressions: seven Orders reads, seven
Products/Shifts read, entry, and no-clobber cases, and two Freshness cases.
Two separate post-callback regressions prove late email-verification success
maps to `false` and a late FCM token throws `CancellationError` without being
persisted or registered.
Result/error publication is owner plus live-session fenced; cleanup is owner-
only, releases stale transient state, fails closed where required, and cannot
clobber a successor. Route-owned reads cancel-and-replace on re-entry, while
independent mutations may retain an explicit owner through benign re-entry.
The test harness uses cancellable UUID waiters, double-checked registration,
exactly-once resume/removal, bounded suites, `NSCondition` for synchronous
mailboxes, and deterministic `cancelAll`/`defer` cleanup.

A reproducible red step was not retained for every cluster. Actor-mailbox,
media, active-entry, same-context, session-revision, owner-cleanup, device,
callback, and waiter cases were added during review remediation, so HU-076 does
not claim universal test-first execution. The parameterized
`authenticatedClientMapsTokenRefreshFailures` test retains its mapping TDD
evidence.

Final executable evidence on iPhone 17 / iOS 26.5
(`087C0B4D-8C32-419D-8B71-1763CAC6D46B`) is:

- fast unit: 580/580 passed, 0 skipped, 0 failed, comprising 574 Swift Testing
  and 6 XCTest;
- UI smoke: 4/4;
- release gate: 589 logical responsibilities, 588 passed, 1 known skip, 0
  failed;
- SwiftLint 0.61.0: 363 Swift files, 0 violations;
- effective settings: 6/6;
- generic Debug and Production Release builds: green;
- `git diff --check`: clean; `Package.resolved`, Android, and `project.pbxproj`:
  no diff.

The Phase 2 SwiftLint `PATH` warning was historical and is not a current Xcode
or Issue Navigator diagnostic.

## Labels

- `enhancement`
- `area:app`
- `platform:ios`
- `priority:P1`

## Current gate

Phase 3 is implemented and executable validation is green locally. Issue #251
is synchronized, verified open, and retains its labels. Independent iOS
concurrency/architecture review is clean with 0 P0-P3 findings. HU-076 is
`ready_for_merge`. Source commit `59216b5`, its branch, and its upstream are
published and synchronized. PR #252 and PR #253 are open, ready, and non-draft
on their stacked bases. Issues #249, #250, and #251 remain open; HU-074 still
has no pull request and is not integrated. Merge, issue closure, deployment,
branch deletion, and integration remain unauthorized.
