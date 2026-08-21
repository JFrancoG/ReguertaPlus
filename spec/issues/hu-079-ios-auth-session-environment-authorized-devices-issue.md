# [HU-079][P1][iOS] Consolidar autenticación, sesión, entorno y dispositivos autorizados

## Objective

Modernize Auth, session, environment routing, and authorized-device registration
as one iOS vertical slice. Preserve accepted security behavior while reducing
responsibility concentration, hidden coupling, and Views that are difficult to
verify deterministically.

## Authorization and status

Maintainer instruction, 2026-08-21:

> Pues abre issue, rama y comenzamos a implementar

The instruction authorizes the issue, branch, specification, plan, tasks,
baseline, tests, and in-scope implementation. It does not authorize commit,
push, PR, merge, issue closure, branch deletion, integration, live mutation, or
Firebase/backend deployment.

Maintainer delivery authorization, 2026-08-21:

> Venga, adelante, commi, push, lanza PR y revisa y cierra

This authorizes commit, push, ready PR, review, merge, issue closure, and branch
cleanup for HU-079. Firebase/backend deployment and live mutation remain out of
scope and are not required.

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/260
- Branch: `codex/hu-079-ios-auth-session-environment-authorized-devices`
- Base: synchronized `main` at `08deba78`.
- State: open / ready for merge.
- Profile: iOS maintenance.

## Canonical sources

- Phase 6 roadmap in
  `spec/app/hu-074-ios-nonisolated-refactor/plan.md`.
- ADR-0004 and ADR-0008 through ADR-0012.
- HU-070/#198 remains the only owner of pending Firebase role rollout,
  backfills, live validation, and deployment.

## Scope

- Characterize login, registration, verification, password recovery,
  restoration/refresh, sign-out, impersonation, reviewer routing, expired and
  unauthorized states before risky refactors.
- Preserve explicit presentation, operation, environment, revision, and lease
  ownership.
- Preserve the 30-second session deadline, cleanup-before-successor, late-result
  fences, and fail-closed `DRAINING` barrier.
- Translate Functions 401/unauthorized into a Domain session-resolution error
  and eliminate the final concrete Data reference from Presentation.
- Separate best-effort device registration from the Auth lane while retaining
  one cancelable task fenced to the exact live authorization and lease.
- Preserve process-live device-write checks and invalidate ownership before
  logout/revocation cleanup.
- Simplify dependencies and split Auth Views only at demonstrated cohesive
  boundaries.
- Keep business rules in Domain, Firebase SDK objects in Data/App, and
  observable UI state in explicit `@MainActor` owners.
- Add deterministic tests/previews and audit localization, VoiceOver, Dynamic
  Type, contrast, and Reduce Motion.

## Acceptance criteria

- [x] Current behavior is characterized before each risk-bearing cut.
- [x] Functions 401 maps to a Domain session-expired error and Presentation
  preserves fail-closed cleanup without referencing Data.
- [x] Auth/session/environment/device owners and fences are explicit and tested.
- [x] Sign-in, sign-up, and refresh preserve deadline, cleanup, and `DRAINING`.
- [x] A suspended best-effort device registration cannot retain or time out a
  valid Auth lane after `.authorized` publication.
- [x] The registration task is owned, cancelable, live-revision/command/lease fenced,
  and cannot affect a successor.
- [x] Password reset has an independent owned task/generation outside the Auth
  mutation lane; stale completion cannot affect route exit, termination, or a
  successor request.
- [x] Sign-out invalidates session, environment, and device authority before
  asynchronous cleanup completes.
- [x] Presentation has zero concrete Firebase/Data references, live adapter
  construction, or mutable globals.
- [x] Domain imports no SwiftUI, Firebase, or infrastructure type.
- [x] Auth routes/forms/dialogs have localized, accessible, deterministic source
  contracts, previews, and focused automated coverage.
- [x] No forbidden concurrency escape is introduced.
- [x] Focused tests, fast-unit, focused Auth UI, UI-smoke, release-gate,
  SwiftLint, settings, and builds pass.
- [x] Real Xcode RenderPreview evidence is recorded at Large, XXX Large, and AX5.
- [x] HU-079-specific physical iPhone 11 acceptance passes with VoiceOver,
  Voice Control, Reduce Motion, Increased Contrast, and large Dynamic Type.
- [x] Accessibility Inspector refinement is explicitly deferred by the
  maintainer until after the MVP.
- [x] Android parity gap, HU-070 dependency, and residual Phase 6 debt are explicit.

## Historical first implementation cut

1. Add RED coverage for Functions 401 mapping to Domain.
2. Add RED coverage for expired-session cleanup through that Domain error.
3. Change the structural boundary from one allowed Data symbol in Presentation
   to zero.
4. Implement the minimal Domain-to-Data-to-Presentation mapping and run the
   exact focused command GREEN.
5. Continue with password-recovery task ownership, then the suspended
   best-effort device-registration lane defect.

Historical evidence for this first cut: valid RED on the missing Domain case;
GREEN 33 logical / 39 executions on iPhone 17 / iOS 26.5, with zero
failed/skipped and zero concrete Data/Firebase references in Presentation.
Auth input and shell routing characterization also passed 5 logical / 28
parameterized executions without requiring a production change.
At that cut, password recovery gained deterministic task/generation ownership
and passed 4/4 focused responsibilities after RED exposed route-exit and
re-entry races.
That 4/4 was the first GREEN, not the final suite: recovery later grew to 5
TestCases / 5 TestCaseRuns and is included in the final ownership/security gate.

## Implemented evidence

- Consolidated Domain/Data/Presentation passed 63/63 logical and 72/72 expanded,
  zero failed/skipped/warnings at
  `/private/tmp/hu079-domain-green.P2CoG5/result.xcresult`.
- At 04:53, after the 04:43 canonical fast-unit RED, a late
  `MemberRepository.member` `nil` from `ControlledNilMemberRepository` produced
  a valid 1-pass/1-fail cancellation RED at
  `/private/tmp/hu079-domain-cancellation-red.xcresult` and passed 2/2 at
  `/private/tmp/hu079-domain-cancellation-green.xcresult`.
- Device registration no longer retains the Auth lane. The session owner keeps
  one task/revision/command/lease fence, reuses both leases and an in-flight
  task across benign refresh, and invalidates ownership before logout,
  revocation, or cleanup. The coordinator now checks cancellation and the
  process-live presentation fence before actor mutation and persistence.
- Final ownership/security passed 60 TestCases / 60 TestCaseRuns, zero
  failed/skipped/warnings at
  `/private/tmp/hu079-ownership-security-final.5BRdlb/result.xcresult`.
- Welcome, login, registration, and password recovery are dedicated route Views
  with narrow state/actions, stable identifiers, localized validation, and
  deterministic previews. Extracted input Views own direct previews and avoid
  duplicate accessibility focus/error semantics.
- The pre-hardening Auth/accessibility gate passed 92/92 logical and 142/142
  expanded, zero failed/skipped/warnings at
  `/private/tmp/hu079-auth-ax-green-final.zhbk3X/result.xcresult`.
  It preceded the second member-repository `nil` cancellation test and is
  superseded as closure authority by final post-P2 fast-unit/release, which
  include both cancellation responsibilities.
- The three focused Auth UI journeys passed 3/3 at
  `/private/tmp/hu079-auth-ui-final.xpJJR5/result.xcresult`.

## Out of scope

- Later Phase 6 slices: Products/Orders/Home/Freshness and beyond.
- Role/product-contract changes.
- HU-070 backfills, Rules, Functions, live data, deploys, or closure.
- A new authorized-device management screen.
- Android migration, packages, project settings, global navigation, CI, broad
  test migration, or iOS/Xcode 27.
- Repository delivery without later authorization.

## Validation

- Main destination: iPhone 17 / iOS 26.5.
- Exact final focused commands and selected suites live in `spec.md`.
- Full lanes: `fast-unit-v1`, `ui-smoke-v1`, `release-gate-v1`.
- Initial floors: 669/669 fast, 4/4 UI smoke, release 678 with 677
  passed, one known skip, and zero failures.
- At 04:43, the first canonical full fast run exposed two real regressions: 719 pass / 2
  fail of 721 at `/private/tmp/hu079-fast-unit-canonical-final.xcresult`. Their
  focused remediation passed 7/7 at
  `/private/tmp/hu079-two-reds-green.kVOOo4/result.xcresult`.
- Preview-scroll focused GREEN: 10/10 at
  `/private/tmp/hu079-preview-scroll-green.0nUj3h/result.xcresult`.
- Final post-preview fast-unit: 723/723 logical and 911/911 expanded at
  `/private/tmp/hu079-preview-fast-final.sEEbPv/result.xcresult`.
- Final UI smoke: 4/4 at
  `/private/tmp/hu079-ui-smoke-canonical-final.xcresult`.
- Final post-preview release: 734 logical = 733 passed + one known skip; 925
  expanded = 921 passed + 4 skip variants; zero failures at
  `/private/tmp/hu079-preview-release-final.NqK73L/release-gate-v1.xcresult`.
- SwiftLint: 0 findings / 413 Swift files. Effective settings: 6/6.
- Architecture/concurrency and static SwiftUI/accessibility reviews: no P0-P3
  findings.
- No project-file diff and no Android, Functions, package, setting, or ADR scope.

Final source/test inventory: 413 Swift files / 73,024 lines = production 275 /
40,025, unit tests 136 / 32,490, UI tests 2 / 509. There are 717 Swift Testing
declarations + 6 XCTest unit methods = 723 fast responsibilities, 11 UI methods,
and 734 release responsibilities.

Real Xcode RenderPreview passed for the Auth shell and registration route at
Large, XXX Large, and AX5, including dark and Increased Contrast variants. The
first AX5 route render exposed and drove a preview-only scroll-surface fix;
stable captures are stored under `/private/tmp/hu079-renderpreview-*.png`.
Physical iPhone 11 acceptance passed with VoiceOver, Voice Control, Reduce
Motion, Increased Contrast, and large Dynamic Type. The maintainer explicitly
deferred Accessibility Inspector refinement until after the MVP. The complete
repository delivery flow is authorized; the issue is ready for merge and stays
open only until merge and closure are definitive. Firebase/backend deployment
and live mutation remain unauthorized and are not required.

## Labels

- `enhancement`
- `platform:ios`
- `priority:P1`
- `area:app`
