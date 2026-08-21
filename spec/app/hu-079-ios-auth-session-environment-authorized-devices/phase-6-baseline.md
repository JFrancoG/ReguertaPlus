# HU-079 - Phase 6 slice baseline

## Purpose

Freeze the reproducible inherited state for the first Phase 6 vertical slice.
Later implementation evidence is appended; these baseline counts remain
historical.

## Authority and repository state

- Git base: `08deba780ab799a049d8b363b2d2ef1c663f92b5`
- Base branch: synchronized `main`, 0 ahead / 0 behind `origin/main`
- Working branch: `codex/hu-079-ios-auth-session-environment-authorized-devices`
- GitHub issue: [#260](https://github.com/JFrancoG/ReguertaPlus/issues/260)
- Profile: iOS maintenance, iOS 26.0, Swift 6 strict concurrency
- Activation delivery: issue/branch/spec/tests/implementation only. On
  2026-08-21 the maintainer later authorized commit, push, ready PR, review,
  merge, issue closure, and branch cleanup; no backend/live mutation is needed.

## Whole-tree inventory

| Area | Swift files | Lines |
| --- | ---: | ---: |
| iOS production | 267 | 39,208 |
| iOS unit tests | 122 | 29,228 |
| iOS UI tests | 2 | 423 |
| Total | 391 | 68,859 |

Inherited tests:

- 663 Swift Testing `@Test` declarations.
- 6 XCTest unit methods.
- 669 fast-unit responsibilities.
- 9 XCTest UI methods.
- 678 release responsibilities: 677 passed, one known launch-matrix skip, zero
  failed in the HU-078 closeout gate.

## Primary slice inventory

The primary Auth/session/environment/device footprint contains 33 production
Swift files and 4,023 lines:

| Cohort | Files | Lines |
| --- | ---: | ---: |
| Domain/Access | 11 | 565 |
| Domain/Devices | 3 | 66 |
| Data/Access | 8 | 1,375 |
| Data/Devices | 2 | 517 |
| Presentation/Auth | 10 | 1,610 |
| Root/App session composition subset | shared files, counted in footprint | 890 |

Shared App/Root files are included only where they directly compose or own this
slice; they are not permission for a global shell refactor.

Seven primary files exceed 200 lines:

- `Data/Devices/FirebaseAuthorizedDeviceCoordinator.swift`: 436.
- `App/ReguertaAppEnvironment.swift`: 412, shared composition root.
- `Presentation/Auth/SessionViewModel+AuthSessionSupport.swift`: 378.
- `Data/Access/FirebaseAuthSessionProvider.swift`: 330.
- `Presentation/Auth/SessionViewModel+SessionOperationLifecycle.swift`: 310.
- `Presentation/Auth/SessionViewModel+AuthActions.swift`: 264.
- `Presentation/Auth/ContentView+AuthOverlaysAndHandlers.swift`: 209.

`Presentation/Auth` contains 10 files / 1,610 lines. The SessionViewModel
implementation cluster contains 1,159 lines, and
`SessionViewModelDependencies` has 12 stored collaborators. Auth/Root currently
contains four directly associated `#Preview` declarations. File size and count
are review signals, not automatic extraction requirements.

## Existing focused evidence

Existing suites cover Auth mutations, timeout/invalidation/cleanup barriers,
environment leases/router, post-auth failures, revoked device leases, process-
live device authorization, coordinator behavior, active-entry guards, root
composition, and UI-smoke Auth journeys.

Known characterization gaps at activation:

- Presentation directly catches `FirebaseFunctionClientError.unauthorized` in
  `SessionViewModel+AuthSessionSupport.swift`. ADR-0004 and the HU-077 guard
  explicitly preserve this as the sole temporary concrete Data-symbol
  reference; HU-079 removes it before broader slice refactors.
- `AuthInputValidation.swift` has no direct focused suite.
- Auth shell actions are not exhaustively table-tested.
- The existing device best-effort test covers an immediate failure but not a
  suspended registrar retaining the Auth lane/deadline.
- Auth forms remain computed properties bound directly to the broad session
  owner rather than independently previewable route Views.

## First boundary defect

`FirebaseAuthorizedMemberResolver` maps forbidden authorization outcomes to
`AuthorizedMemberResolutionError`, but propagates a Functions 401 as the
concrete `FirebaseFunctionClientError.unauthorized`. Presentation catches that
Data error to trigger expired-session cleanup. The first RED changes the layer
guard to zero concrete Data symbols, proves the resolver maps 401 to a Domain
session-expired error, and proves SessionViewModel keeps the inherited
fail-closed termination/dialog behavior when it receives that Domain error.

## Next lifecycle defect

`SessionViewModel+AuthSessionSupport.swift` publishes `.authorized`, creates the
device lease, and then awaits `registerAuthorizedDeviceBestEffort` before the
outer Auth task executes its `defer` and finishes the session operation. The
timeout remains active during that await. A registrar that suspends can invoke
the timeout path, cancel the provider task, revoke the authorized mode, and
enter `DRAINING`, even though ADR-0009 classifies registration as best-effort.

The subsequent device RED must prove that a controlled suspended registrar cannot retain
the Auth lane after authorized publication. The GREEN design retains one
dedicated registration task and fences it to the exact live authorization
revision/signature and device lease. A completed Auth operation generation is
not sufficient because a benign later refresh may start a new lane while the
same session remains live.

## First boundary-cut evidence

The first test placement attempt exited 65 before type checking because adding
the new cases to an inherited suite exceeded SwiftLint's 500-line file limit:
`/private/tmp/hu079-boundary-red.4WaBZQ/hu079-boundary-red.xcresult`. The tests
were moved to the dedicated `AuthorizedSessionErrorBoundaryTests` suite; this
attempt is recorded as an organizational RED, not behavioral authority.

The valid RED then exited 65 because
`AuthorizedMemberResolutionError.sessionExpired` did not exist at the two
expected call sites:
`/private/tmp/hu079-boundary-red-functional.D1yHBJ/hu079-boundary-red.xcresult`.
Production remained unchanged until that failure was captured.

The minimal GREEN adds the Domain resolver error and access outcome, maps only
Functions 401/unauthorized in Data, and switches Presentation on the Domain
outcome. Forbidden codes, cancellation, and generic infrastructure failures
retain their inherited paths. The exact focused gate passed on iPhone 17 /
iOS 26.5:

- `.xcresult`: `/private/tmp/hu079-boundary-green.qVzRV0/hu079-boundary-green.xcresult`
- 33 logical responsibilities / 39 device executions.
- 0 failed, 0 skipped, 0 expected failures.
- SwiftLint strict/no-cache: 0 findings in 9 changed Swift files.
- Swift parse and `git diff --check`: clean.
- Presentation concrete Data/Firebase references: 0.

Auth input and shell routing required no production change: the inherited
behavior already met the table-driven contract. The new
`AuthInputAndShellRoutingTests` suite passed 5 logical responsibilities / 28
parameterized executions with zero failed/skipped on the same simulator:
`/private/tmp/hu079-auth-input-shell-routing-focused-20260821.xcresult`.
It covers normalization, valid/invalid email forms, password lengths 5/6/16/17,
reauthentication, recovery routing, back-at-root behavior, and deduplication.

Independent review then added a cancellation checkpoint after resolver
re-entry and converted the stale-session test into a real temporal race. The
review RED executed both suites and failed only
`cancellationAfterResolverReturnWinsOverExpiredDomainOutcome`; Xcode entered a
long `simctl diagnose` during finalization, so the explicit failing output is
the RED authority and the incomplete bundle is retained at
`/private/tmp/hu079-boundary-review-red.NL3U9Q/hu079-boundary-review-red.xcresult`.
After `Task.checkCancellation()` was added inside the Domain catch, the focused
review gate passed 12 logical / 14 device executions, zero failed/skipped:
`/private/tmp/hu079-boundary-review-green.CLAzxz/hu079-boundary-review-green.xcresult`.

## Password-recovery ownership evidence

The inherited recovery flow launched an unowned task. The behavior RED
observed two failures: route exit still allowed late success to publish, and a
stale failure overwrote a re-entered request; current success already passed.
That runner also entered CoreSimulator diagnostics after producing the failure
output, so its incomplete bundle is not used as final authority.

The first GREEN retains one dedicated password-recovery task and monotonic generation
outside the serialized Auth lane. Route exit and local session termination
invalidate ownership before resetting visible state; a late result cannot
publish feedback/errors or finish a successor. At that cut, the exact focused
suite passed:

- `.xcresult`: `/private/tmp/hu079-password-recovery-green-20260821-0202.xcresult`
- 4 logical responsibilities / 4 executions.
- 0 failed, 0 skipped, 0 expected failures.
- SwiftLint strict/no-cache: 0 findings in 6 files; parse and diff-check clean.

That 4/4 result remains historical rather than final evidence. A fifth shell-
back responsibility and cancellation-aware test support were added later. The
intermediate hardened suite passed 5 TestCases / 5 TestCaseRuns at
`/private/tmp/hu079-password-route-green-stable-20260821.xcresult`; the final
ownership/security gate below supersedes both focused recovery results.

## Domain cancellation hardening evidence

Before the final cancellation review, the consolidated Domain/Data/Presentation
regression gate passed 63 logical responsibilities / 72 expanded executions,
with zero failures, skips, or warnings at
`/private/tmp/hu079-domain-green.P2CoG5/result.xcresult`.

Independent review found one remaining cancellation ordering defect: when
`MemberRepository.member` returned a late `nil` through
`ControlledNilMemberRepository`, the use case could still publish
`.unauthorized` after its caller had been cancelled. This 04:53 RED ran after
the 04:43 canonical fast-unit RED documented below. The valid RED at
`/private/tmp/hu079-domain-cancellation-red.xcresult` ran two responsibilities
and failed only that late member-lookup `nil` case. After the cancellation
checkpoint was made authoritative before mapping the repository result, the same two
responsibilities passed 2/2 at
`/private/tmp/hu079-domain-cancellation-green.xcresult`.

The final Domain/Data/Presentation contract therefore maps Functions
401/unauthorized to a Domain session-expired outcome, preserves forbidden and
transport behavior, lets cancellation win after member-repository suspension,
and keeps Presentation at zero concrete Data/Firebase references.

## Authorized-device ownership evidence

The device-registration cut moved best-effort registration outside the Auth
lane and retained one presentation-owned task, monotonic revision, exact
command, and process-live lease fence. The initial regression gate passed 41/41
at `/private/tmp/hu079-device-regression-memberid-green.40XMXk/result.xcresult`,
but independent review then exposed two deeper handoff races:

- `/private/tmp/hu079-device-handoff-red.2vWQ6b/result.xcresult` failed the
  persisted in-flight owner case.
- `/private/tmp/hu079-device-p1-red-stable.Z4KYXY/result.xcresult` ran two
  logical responsibilities with one pass and one fail, proving that a late
  cancelled request could still mutate or clear successor state.

The minimal handoff GREEN passed 2/2 at
`/private/tmp/hu079-device-p1-green.BPgEKn/result.xcresult`. The implementation
now reuses both environment and device leases for the same live authorization,
preserves an existing in-flight registration across a benign refresh, and
invalidates registration ownership before logout, revocation, or lease cleanup.
The coordinator also checks cancellation and the presentation fence before
mutating actor state, then revalidates before every persistence boundary.

The final combined ownership/security gate passed 60 TestCases / 60
TestCaseRuns, zero failed/skipped, and zero warnings on iPhone 17 / iOS 26.5:
`/private/tmp/hu079-ownership-security-final.5BRdlb/result.xcresult`.

## Auth form, route, and accessibility evidence

Auth form characterization established independent draft/error/loading
ownership without extracting session coordination from `SessionViewModel`.
Welcome, login, registration, and password recovery are now real route Views
with narrow presentation values/actions, stable accessibility identifiers, and
deterministic previews. The input-field boundary gives each extracted View its
own file and preview, applies localized error custom content to the editable
control, hides duplicate visible labels/errors from accessibility traversal,
and preserves appropriate content types.

The pre-hardening Auth/accessibility gate passed 92/92 logical responsibilities,
142/142 expanded executions, zero failed/skipped, and zero warnings:
`/private/tmp/hu079-auth-ax-green-final.zhbk3X/result.xcresult`.
It preceded the added late member-repository `nil` cancellation responsibility
and is retained as chronological evidence, not as current closure authority.
The post-P2 fast-unit and release gates below supersede it and include both
Domain cancellation responsibilities.
The three focused Auth UI journeys passed 3/3 at
`/private/tmp/hu079-auth-ui-final.xpJJR5/result.xcresult`.

## Final automated validation evidence

At 04:43, the first canonical full fast-unit run correctly exposed two remaining
regressions: 719 passed and 2 failed of 721 at
`/private/tmp/hu079-fast-unit-canonical-final.xcresult`. Their focused fix gate
passed 7/7 at
`/private/tmp/hu079-two-reds-green.kVOOo4/result.xcresult`. After the final P2
remediation and the added cancellation responsibility, the canonical fast-unit
gate passed 722/722 logical responsibilities and 910/910 expanded executions.
Real RenderPreview then exposed a preview-only missing scroll surface. Its
focused contract passed 10/10 after the fix, and the final post-preview
fast-unit passed 723/723 logical responsibilities and 911/911 expanded
executions at `/private/tmp/hu079-preview-fast-final.sEEbPv/result.xcresult`.

Additional final gates on iPhone 17 / iOS 26.5:

- UI smoke: 4/4 at
  `/private/tmp/hu079-ui-smoke-canonical-final.xcresult`.
- Final post-preview release gate: 734 logical responsibilities = 733 passed +
  the one known launch-matrix skip; 925 expanded = 921 passed + 4 variants of
  that skip; zero failures at
  `/private/tmp/hu079-preview-release-final.NqK73L/release-gate-v1.xcresult`.
- SwiftLint strict/no-cache: 0 findings across 413 Swift files.
- Effective Swift settings: 6/6.
- Independent architecture/concurrency review: no P0-P3 findings.
- Independent static SwiftUI/accessibility review: no P0-P3 findings.
- No project-file diff and no Android, Functions, package, build-setting, or ADR
  scope change.

## Initial-to-final inventory

The historical activation counts above remain frozen. The final source snapshot
for the implemented tree is:

| Area | Initial files / lines | Final files / lines | Delta |
| --- | ---: | ---: | ---: |
| iOS production | 267 / 39,208 | 275 / 40,025 | +8 / +817 |
| iOS unit tests | 122 / 29,228 | 136 / 32,490 | +14 / +3,262 |
| iOS UI tests | 2 / 423 | 2 / 509 | 0 / +86 |
| Total | 391 / 68,859 | 413 / 73,024 | +22 / +4,165 |

Final static test inventory is 717 Swift Testing declarations plus 6 XCTest
unit methods = 723 fast-unit responsibilities, 11 UI methods, and 734 release
responsibilities. `Presentation/Auth` has 15 files / 2,233 lines; the
SessionViewModel cluster retains 12 dependencies. Auth/Root has 17 directly
associated previews, and the touched input-field boundary has 6.

## Remaining interactive evidence and delivery boundary

Automated implementation and review evidence is complete. Real Xcode
RenderPreview passed for Auth shell/register at Large, XXX Large, and AX5,
including dark and Increased Contrast variants; stable captures are stored at
`/private/tmp/hu079-renderpreview-*.png`. Physical iPhone 11 acceptance passed
with VoiceOver, Voice Control, Reduce Motion, Increased Contrast, and large
Dynamic Type. The maintainer explicitly deferred Accessibility Inspector
refinement until after the MVP. The maintainer authorized remote synchronization
and the complete repository delivery flow; the issue is ready for merge and
stays open only until the remote merge and closure are definitive.

## Reproducible commands

Whole-tree files and lines:

```bash
for area in Reguerta ReguertaTests ReguertaUITests; do
  root="ios/Reguerta/$area"
  files=$(rg --files "$root" -g '*.swift' | wc -l | tr -d ' ')
  lines=$(rg --files "$root" -g '*.swift' -0 | xargs -0 wc -l | tail -n 1 | awk '{ print $1 }')
  echo "$area $files $lines"
done
```

Test inventory:

```bash
rg -n '@Test\b' ios/Reguerta/ReguertaTests -g '*.swift' | wc -l
rg -l -0 '^import XCTest$' ios/Reguerta/ReguertaTests -g '*.swift' |
  xargs -0 rg -n '^\s*(?:@MainActor\s+)?func test[A-Za-z0-9_]*\(' | wc -l
rg -l -0 '^import XCTest$' ios/Reguerta/ReguertaUITests -g '*.swift' |
  xargs -0 rg -n '^\s*(?:@MainActor\s+)?func test[A-Za-z0-9_]*\(' | wc -l
```

Auth/session structural signals:

```bash
rg --files ios/Reguerta/Reguerta/Presentation/Auth -g '*.swift' | wc -l
rg --files ios/Reguerta/Reguerta/Presentation/Auth -g '*.swift' -0 |
  xargs -0 wc -l | tail -n 1
wc -l ios/Reguerta/Reguerta/Presentation/Root/SessionViewModel.swift \
  ios/Reguerta/Reguerta/Presentation/Root/SessionViewModelDependencies.swift \
  ios/Reguerta/Reguerta/Presentation/Auth/SessionViewModel+*.swift
rg -n '^    let ' \
  ios/Reguerta/Reguerta/Presentation/Root/SessionViewModelDependencies.swift | wc -l
```

## UI matrix at activation

- Welcome, login, register, recover-password.
- Loading, validation error, unauthorized, expired, draining.
- Compact phone, regular phone, iPad/split where the route is affected.
- Large, XXX Large, AX5.
- Spanish/light and English/dark; Increased Contrast.
- VoiceOver actions/focus and Reduce Motion for touched UI boundaries.

## Initial exceptions and residual policy

- HU-070/#198 owns Firebase role rollout, backfill, Rules, Functions, live
  validation, and deployment. None is HU-079 evidence.
- Android retains its current implementation; parity is a documented follow-up.
- Shared `ReguertaAppEnvironment` and root types may be touched only for the
  exact dependency/ownership seam required by this slice.
- A new ADR is required before weakening or changing accepted security/layer
  ownership, not for a behavior-preserving implementation of existing ADRs.
