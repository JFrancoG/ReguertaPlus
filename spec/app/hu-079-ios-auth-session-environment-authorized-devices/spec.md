# HU-079 - Consolidate the iOS Auth/session/environment/authorized-device slice

## Metadata

- issue_id: #260
- priority: P1
- platform: ios
- status: in_progress
- plan_state: approved

## Authorization and delivery boundary

The maintainer activated the first Phase 6 slice on 2026-08-21 with the
verbatim instruction:

> Pues abre issue, rama y comenzamos a implementar

That instruction authorizes the HU-079 issue, branch, specification, plan,
tasks, baseline, tests, and in-scope implementation. It does not authorize
commit, push, pull request, merge, issue closure, branch deletion, integration,
live-data mutation, or Firebase/backend deployment.

The maintainer extended delivery authority on 2026-08-21 with:

> Venga, adelante, commi, push, lanza PR y revisa y cierra

This authorizes commit, push, ready PR, review, merge, issue closure, and branch
cleanup for HU-079. It does not authorize Firebase/backend deployment or live
data mutation; neither is required by this slice.

HU-079 starts from clean, synchronized `main` at
`08deba780ab799a049d8b363b2d2ef1c663f92b5`.

## Context and problem

Phase 6 modernizes one complete vertical slice at a time. Auth, session,
environment, and authorized-device registration are first because they own the
security context used by every later feature slice.

HU-076 already established instance-owned runtime environment stores, explicit
environment snapshots, leases, live-authorization fences, and checked Firebase
SDK ownership. HU-077 already moved live composition to App. HU-079 preserves
those decisions rather than reopening them.

The current slice still concentrates form drafts, validation, Auth mutation,
session refresh, deadline/draining state, authorization resolution, environment
lease ownership, authorized-device lease/registration, impersonation, and
dialogs in `SessionViewModel`. Its dependency bundle has 12 collaborators, and
seven primary slice files exceed 200 lines.

The first boundary defect at activation was narrower and more fundamental than
file size: `SessionViewModel+AuthSessionSupport.swift` caught
`FirebaseFunctionClientError.unauthorized` directly. This was the one inherited
Data-symbol reference that ADR-0004 and the HU-077 structural guard temporarily
allowed in Presentation. HU-079 moved that translation into the Functions/Data
adapter and now exposes only the Domain session-expired outcome to Presentation.

The next concrete lifecycle defect at activation followed immediately: after
publishing `.authorized`, `SessionViewModel` awaited best-effort device
registration inside the serialized Auth operation. A suspended registrar could
therefore retain the Auth lane and deadline until timeout revoked an otherwise
valid session. HU-079 now finishes the lane before that non-critical work and
retains it under a separate fenced owner, consistent with ADR-0009.

## User story

As an iOS user, I want authentication, session restoration, environment routing,
and push-device authorization to remain responsive and secure even when one SDK
operation is delayed, so that a valid session is neither leaked nor revoked by
non-critical work.

As a maintainer, I want this vertical slice to expose cohesive state and owners,
small explicit dependencies, deterministic views/previews, and testable
operation boundaries before later feature slices build on it.

## Canonical decisions

- ADR-0004: App composition and Session/Auth ownership.
- ADR-0007 and HU-070/#198: role authorization and the still-pending live
  backend rollout.
- ADR-0008: 30-second session deadline, cleanup-before-successor, and fail-closed
  `DRAINING` barrier.
- ADR-0009: process-live authorization for account push registration.
- ADR-0010: community refreshes do not own session authorization.
- ADR-0011: project-level `nonisolated` default with explicit UI/infrastructure
  owners and no unsafe escapes.
- ADR-0012: instance-owned runtime context, immutable environment snapshots,
  leases, and checked Firebase boundaries.

No new ADR is required while HU-079 materializes these accepted decisions. A
change to the session-lane, environment, lease, process-live authorization, or
layer-ownership contract requires a separately reviewed ADR before code.

## Scope

### In scope

- Characterize sign-in, sign-up, email verification, password recovery,
  restoration/refresh, sign-out, develop impersonation, reviewer routing,
  expired/unauthorized states, environment routing, and authorized-device
  registration before each risky cut.
- Preserve one explicit `@MainActor` owner for presentation state and explicit
  owners for active operations, generations/revisions, environment lease, and
  device lease.
- Preserve session serialization, the 30-second application deadline,
  cleanup-before-successor ordering, late-result fences, and `DRAINING`.
- Translate expired Functions authorization to a Domain session-resolution
  error at the Data boundary and remove the final concrete Data reference from
  Presentation.
- Separate best-effort authorized-device registration from the Auth lane while
  retaining and cancelling one owned registration task and fencing it to the
  exact live session revision, member, UID, environment, and lease.
- Ensure local sign-out/revocation invalidates device-registration ownership
  before asynchronous cleanup, and stale completion cannot clear a successor.
- Keep password reset independent from the Auth mutation lane.
- Simplify `SessionViewModel` responsibilities and dependencies only after
  characterization demonstrates a cohesive extraction.
- Split Auth forms/routes into real Views where that improves ownership and
  previewability; keep View bodies declarative.
- Localize and audit visible/error content, VoiceOver, Dynamic Type, Increased
  Contrast, and Reduce Motion.
- Add deterministic previews for welcome, sign-in, sign-up, recovery, loading,
  validation error, unauthorized, expired, and draining states.
- Keep Swift Testing deterministic with controlled clocks/continuations and no
  network, Firebase project, or real sleeps.

### Out of scope

- Products, Orders, Home, Freshness, or later Phase 6 slices.
- Role/permission redesign or Firebase contract changes.
- Backfills, Rules, Functions, live data, deployments, release rollout, or
  closure of HU-070/#198.
- A new device-management screen; authorized devices here means push
  registration authority bound to the live session.
- Android implementation. The temporary parity gap must be reported.
- Global navigation redesign, packages, project settings, CI, broad test
  migration, or iOS/Xcode 27 adoption.
- Commit, push, PR, merge, issue closure, branch deletion, or integration
  without later maintainer authorization.

## Preserved contracts

1. A stale Auth operation never publishes or replaces a newer session.
2. A timeout recovers visible state but keeps non-cooperative Auth work as a
   fail-closed `DRAINING` barrier until definitive cleanup succeeds.
3. A candidate environment is not published before mandatory authorization
   hydration succeeds; cleanup resets only an owned lease.
4. An authorized session is active only while UID/member/activity/delegation
   checks and the live session revision remain valid.
5. Device writes require process-live member, UID, environment, lease, token,
   and session-fence checks immediately before persistence.
6. A fresh process cannot regain device-write authority from disk state alone.
7. Device registration is best-effort and cannot delay or revoke an otherwise
   valid authorized session.
8. Password reset does not capture credentials in or occupy the Auth mutation
   lane.
9. Presentation references no concrete Data/Firebase type and constructs no
   live adapter; Domain imports no SwiftUI, Firebase, or infrastructure type.
10. No `@preconcurrency`, `@unchecked Sendable`, `nonisolated(unsafe)`,
    `Task.detached`, GCD, or equivalent compiler escape is introduced.

## Acceptance criteria

- [x] Current Auth/session/environment/device behavior is characterized before
  each risk-bearing refactor.
- [x] A Functions 401/unauthorized response becomes a Domain session-expired
  error, and Presentation preserves fail-closed cleanup without referencing a
  Data error type.
- [x] Presentation, session-operation, environment, and device-registration
  ownership are explicit and covered by tests.
- [x] Sign-in, sign-up, and refresh preserve serialization, deadline,
  invalidation, cleanup, and `DRAINING` semantics.
- [x] Best-effort device registration no longer owns the Auth lane or its
  timeout after the authorized session is published.
- [x] The device registration task is retained and cancelable, fenced by exact
  revision, command, and lease, and cannot publish or clean up a successor.
- [x] Password reset remains independently owned outside the Auth mutation lane,
  and stale recovery results cannot publish after route exit, termination, or
  a successor request.
- [x] Sign-out invalidates session, environment, and device authority before
  asynchronous cleanup completes.
- [x] Presentation contains zero concrete Data/Firebase references, live
  construction, or mutable globals.
- [x] Domain remains free of SwiftUI/Firebase/infrastructure dependencies.
- [x] Auth routes/forms/dialogs have localized, accessible, deterministic source
  contracts, previews, and focused automated coverage for applicable states.
- [x] Fast-unit, focused Auth UI, UI-smoke, release-gate, SwiftLint, effective
  settings, and builds pass.
- [x] Required real Xcode previews render at Large, XXX Large, and AX5.
- [x] Physical iPhone 11 acceptance passes with VoiceOver, Voice Control,
  Reduce Motion, Increased Contrast, and large Dynamic Type.
- [x] Accessibility Inspector refinement is explicitly deferred by the
  maintainer until after the MVP.
- [x] Android parity gap, HU-070/#198 dependency, and residual Phase 6 debt are
  explicit.

## Implemented evidence

- Consolidated Domain/Data/Presentation GREEN:
  `/private/tmp/hu079-domain-green.P2CoG5/result.xcresult`, 63/63 logical and
  72/72 expanded, zero failed/skipped/warnings.
- Domain cancellation RED at 04:53, after the 04:43 canonical fast-unit RED:
  `/private/tmp/hu079-domain-cancellation-red.xcresult`, 1 pass / 1 fail; a late
  `MemberRepository.member` `nil` from `ControlledNilMemberRepository`
  incorrectly became `.unauthorized` after cancellation.
- Domain cancellation GREEN:
  `/private/tmp/hu079-domain-cancellation-green.xcresult`, 2/2.
- Final ownership/security:
  `/private/tmp/hu079-ownership-security-final.5BRdlb/result.xcresult`, 60
  TestCases / 60 TestCaseRuns, zero failed/skipped/warnings.
- Pre-hardening Auth/accessibility:
  `/private/tmp/hu079-auth-ax-green-final.zhbk3X/result.xcresult`, 92/92 logical
  and 142/142 expanded, zero failed/skipped/warnings.
  This gate preceded the second member-repository `nil` cancellation test. It is
  chronological evidence rather than current closure authority; post-P2
  fast-unit and release supersede it and include both cancellation cases.
- Focused Auth UI:
  `/private/tmp/hu079-auth-ui-final.xpJJR5/result.xcresult`, 3/3.

The device lane now finishes before best-effort registration, retains exactly
one registration owner, reuses both leases and an in-flight task across a
benign refresh, and invalidates ownership before logout/revocation cleanup. The
coordinator preserves and hardens process-live authorization by checking
cancellation and the presentation fence before actor mutation and again before
persistence. Password recovery remains independently owned and invalidates its
task/generation synchronously on route exit, local termination, and successor
requests.

## Executable validation

Run from `ios/Reguerta` on iPhone 17 / iOS 26.5.

Historical first boundary cut:

```bash
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -onlyUsePackageVersionsFromResolvedFile -testPlan fast-unit-v1 \
  -only-testing:ReguertaTests/AuthorizedSessionErrorBoundaryTests \
  -only-testing:ReguertaTests/FirebaseFunctionsSecurityBoundaryTests \
  -only-testing:ReguertaTests/FirebaseAuthSessionSecurityTests \
  -only-testing:ReguertaTests/ReguertaAppCompositionBoundaryTests test
```

That historical cut passed 33 logical / 39 expanded.

Final ownership/security command for the implemented tree:

```bash
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -onlyUsePackageVersionsFromResolvedFile -testPlan fast-unit-v1 \
  -only-testing:ReguertaTests/P217AuthorizedDeviceProcessAuthorizationTests \
  -only-testing:ReguertaTests/PasswordRecoveryOperationOwnershipTests \
  -only-testing:ReguertaTests/SessionOperationInvalidationTests \
  -only-testing:ReguertaTests/FirebaseAuthSessionSecurityTests \
  -only-testing:ReguertaTests/AuthorizedDeviceRegistrationOwnershipTests \
  -only-testing:ReguertaTests/SessionRevokedDeviceLeaseTests \
  -only-testing:ReguertaTests/P101AuthorizedDeviceCoordinatorTests \
  -only-testing:ReguertaTests/SessionEnvironmentLeaseLifecycleTests \
  -only-testing:ReguertaTests/AuthorizedDeviceLeaseHandoffIntegrationTests test
```

It passed 60 TestCases / 60 TestCaseRuns at
`/private/tmp/hu079-ownership-security-final.5BRdlb/result.xcresult`, with zero
failed/skipped/warnings.

The following Auth/AX selector command is retained only as pre-hardening
chronology. It preceded the second member-repository `nil` cancellation test and
is not the current reproducible closure command:

```bash
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -onlyUsePackageVersionsFromResolvedFile -testPlan fast-unit-v1 \
  -only-testing:ReguertaTests/FirebaseAuthSessionSecurityTests \
  -only-testing:ReguertaTests/AuthRouteCompositionBoundaryTests \
  -only-testing:ReguertaTests/ReguertaRootDependencyTests \
  -only-testing:ReguertaTests/ReguertaInputFieldAccessibilityContractTests \
  -only-testing:ReguertaTests/FirebaseFunctionsSecurityBoundaryTests \
  -only-testing:ReguertaTests/AuthInputAndShellRoutingTests \
  -only-testing:ReguertaTests/AuthFormStateOwnershipTests \
  -only-testing:ReguertaTests/AppShellDependencyBoundaryTests \
  -only-testing:ReguertaTests/AuthPasswordGuidanceLocalizationTests \
  -only-testing:ReguertaTests/PasswordRecoveryOperationOwnershipTests \
  -only-testing:ReguertaTests/ResolveAuthorizedSessionUseCaseIsolationTests \
  -only-testing:ReguertaTests/ReguertaAppCompositionBoundaryTests \
  -only-testing:ReguertaTests/AuthorizedSessionErrorBoundaryTests test
```

That pre-hardening gate passed 92/92 logical and 142/142 expanded at
`/private/tmp/hu079-auth-ax-green-final.zhbk3X/result.xcresult`, with zero
failed/skipped/warnings. The final post-P2 fast-unit and release gates below
supersede it and contain both Domain cancellation responsibilities.

The focused Auth UI command selected these three methods and passed 3/3 at
`/private/tmp/hu079-auth-ui-final.xpJJR5/result.xcresult`:

```bash
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -onlyUsePackageVersionsFromResolvedFile \
  -only-testing:ReguertaUITests/ReguertaUITests/testInvalidCredentialsShowsInlineErrorWithoutCrash \
  -only-testing:ReguertaUITests/ReguertaUITests/testRegistrationRouteExposesStableControlsAndResetsDraftOnBack \
  -only-testing:ReguertaUITests/ReguertaUITests/testRecoveryRouteExposesStableControlsAndResetsDraftOnBack test
```

Full lanes:

```bash
./scripts/validate-ios.sh fast-unit \
  --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'
./scripts/validate-ios.sh ui-smoke \
  --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'
./scripts/validate-ios.sh release-gate \
  --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'
```

The inherited floor remains historical: fast-unit 669/669; UI smoke 4/4;
release 678 responsibilities with 677 passed, one known launch-matrix skip, and
zero failed. Final HU-079 results are:

- At 04:43, an intermediate canonical fast-unit run exposed two real regressions: 719
  passed / 2 failed of 721 at
  `/private/tmp/hu079-fast-unit-canonical-final.xcresult`.
- The focused remediation passed 7/7 at
  `/private/tmp/hu079-two-reds-green.kVOOo4/result.xcresult`.
- The preview-scroll contract first failed 5/5 new assertions in the focused
  RED, then passed 10/10 at
  `/private/tmp/hu079-preview-scroll-green.0nUj3h/result.xcresult`.
- Final post-preview fast-unit passed 723/723 logical and 911/911 expanded at
  `/private/tmp/hu079-preview-fast-final.sEEbPv/result.xcresult`.
- UI smoke passed 4/4 at
  `/private/tmp/hu079-ui-smoke-canonical-final.xcresult`.
- Final post-preview release passed 734 logical = 733 passed + one known launch
  skip; expanded execution was 925 = 921 passed + 4 variants of that skip, with
  zero failures, at
  `/private/tmp/hu079-preview-release-final.NqK73L/release-gate-v1.xcresult`.
- SwiftLint passed with 0 findings across 413 Swift files; effective settings
  passed 6/6.

Static gates include SwiftLint strict/no-cache, effective settings 6/6, generic
Debug and Production Release builds, `git diff --check`, package/project scope,
forbidden concurrency escapes, Presentation Firebase/Data construction, and
Domain import boundaries.

## UI and accessibility matrix

| Route/state | Required evidence |
| --- | --- |
| Welcome, sign-in, sign-up, recovery | compact phone and regular phone; Large, XXX Large, AX5; ES and EN; light and dark |
| Validation error and loading | deterministic preview plus focused state test; 44-point targets and VoiceOver labels |
| Unauthorized and expired dialogs | runtime/focused dialog behavior; VoiceOver focus/action; Increased Contrast |
| Draining/busy Auth lane | deterministic state test; UI must not accept another credential |
| Authorized transition | routing test plus UI smoke; no private-state flash or stale dialog |
| Reduce Motion | material motion suppressed without hiding route/state transitions |

Source-backed previews cover affected Auth routes at Large, XXX Large, and AX5,
including localized light/dark, validation, loading, `DRAINING`, Reduce Motion,
and external Increased Contrast fixtures. Real Xcode RenderPreview confirmed
the Auth shell at Large and AX5 plus the registration route at Large, XXX Large
dark, and AX5 with Increased Contrast. The first AX5 route render exposed a
preview-only missing scroll surface; the TDD fix now mirrors the runtime shell
without nesting scroll containers. Stable captures live under
`/private/tmp/hu079-renderpreview-*.png`. Physical iPhone 11 acceptance also
passed with VoiceOver, Voice Control, Reduce Motion, Increased Contrast, and
large Dynamic Type. The maintainer explicitly deferred Accessibility Inspector
refinement until after the MVP.

## Initial-to-final delta

The initial inventory remains frozen in `phase-6-baseline.md`. The implemented
tree has 413 Swift files / 73,024 lines: production 275 / 40,025; unit tests 136
/ 32,490; UI tests 2 / 509. It declares 717 Swift Testing responsibilities and
6 XCTest unit methods = 723 fast-unit responsibilities, plus 11 UI methods =
734 release responsibilities. `Presentation/Auth` has 15 files / 2,233 lines,
the SessionViewModel dependency bundle remains at 12, Auth/Root has 17 directly
associated previews, and the touched input boundary has 6.

Residual debt is explicit: Accessibility Inspector refinement is deferred until
after the MVP, Android retains its current implementation, and HU-070/#198
remains the sole live backend rollout owner. The story remains `in_progress`
and its issue remains open only until the separately authorized delivery flow
completes.

## Risks and controls

- Decoupling registration with an unowned task could leak work.
  - Control: retain one task, cancel it at revocation, and owner-fence cleanup.
- Reusing session-operation generation after the lane finishes would make a
  benign refresh invalidate registration.
  - Control: bind device work to exact live authorization revision/signature
    and lease, not merely a completed Auth operation generation.
- Splitting `SessionViewModel` only by size could weaken security ordering.
  - Control: characterize ownership and extract one cohesive responsibility at
    a time.
- HU-079 could be mistaken for the HU-070 backend rollout.
  - Control: zero backend/live mutation and explicit issue dependency boundary.
