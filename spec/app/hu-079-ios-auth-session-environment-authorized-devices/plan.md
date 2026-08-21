# HU-079 - Implementation plan

## 1. Goal

Consolidate the first Phase 6 vertical slice without changing product or
backend behavior: Auth presentation, session lifecycle, environment ownership,
and process-live authorized-device registration become cohesive, explicit, and
deterministically verifiable.

## 2. Operating state

- Issue: [#260](https://github.com/JFrancoG/ReguertaPlus/issues/260)
- Branch: `codex/hu-079-ios-auth-session-environment-authorized-devices`
- Base: `main` at `08deba780ab799a049d8b363b2d2ef1c663f92b5`
- Profile: iOS maintenance
- State: approved / ready for merge
- Delivery: commit, push, ready PR, review, merge, issue closure, and branch
  cleanup authorized on 2026-08-21; backend deployment/live mutation remains
  unauthorized and is not required by this slice.

## 3. Work sequence

### 3.1 Bootstrap and characterization

- Freeze production/test inventory, dependencies, large files, Views, previews,
  owners, gates, and UI matrix.
- Map ADR-0008 through ADR-0012 invariants to concrete source/tests.
- Record HU-070/#198 as the separate backend/live rollout owner.
- Add pure characterization for Auth input/routing gaps before moving forms.

### 3.2 Domain authorization-error boundary

- Add RED coverage for Functions 401 mapping, SessionViewModel fail-closed
  handling, and zero concrete Data symbols in Presentation.
- Add a Domain session-resolution error for expired backend authorization.
- Translate the Functions error in Data and propagate it without exposing the
  infrastructure type.
- Preserve expired-session sign-out, cleanup, dialog, and feedback behavior.
- Remove the HU-077 temporary Data-symbol allowlist from the structural guard.

### 3.3 Password-recovery operation ownership

- Add deterministic RED coverage for route exit, re-entry, late success, and
  late failure with controlled continuations.
- Retain and invalidate one recovery task/generation without occupying the
  serialized Auth mutation lane.
- Ensure stale completion cannot reopen a dialog or clear a successor request.

### 3.4 Best-effort device registration boundary

- Add a RED regression with a controlled suspended registrar.
- Prove `.authorized` publishes and the Auth lane/deadline finishes without
  awaiting device registration.
- Retain exactly one dedicated registration task in the session owner.
- Fence registration by exact live authorization revision/signature and device
  lease rather than a completed Auth operation generation.
- Cancel ownership before logout/revocation cleanup and protect successors.
- Preserve and harden coordinator/repository process-live revalidation without
  changing the persistence contract.

### 3.5 Auth state and form boundaries

- Characterize normalization, email/password limits, submit eligibility,
  validation errors, draft reset, and loading ownership.
- Extract a cohesive Auth form state owner only if tests justify it.
- Preserve `SessionViewModel` as Auth/session coordinator under ADR-0004.
- Pass explicit values/actions to route Views without service location.

### 3.6 Auth View composition and previews

- Split welcome/login/register/recovery Views by responsibility when touched.
- Keep one View type per file and add deterministic previews.
- Preserve typed shell routing and dialogs.
- Validate compact/regular, Dynamic Type, ES/EN, light/dark, contrast, motion,
  and accessibility targets.

### 3.7 Session lifecycle/dependency closeout

- Reassess the 12-dependency bundle by responsibility, not parameter count.
- Extract a session-operation owner only if the lane/deadline/cleanup invariant
  can remain atomic and simpler.
- Preserve environment and device lease identity across a benign refresh;
  invalidate ownership before logout, revocation, or changed authorization.
- Remove only redundancy proven unused; do not reopen App composition.

### 3.8 Final validation and documentation

- Run exact focused and full gates from `spec.md`.
- Recalculate all initial-to-final metrics and residual debt.
- Run independent iOS architecture/concurrency review.
- Run independent SwiftUI/accessibility review for touched UI.
- Reconcile spec, plan, tasks, baseline, and local issue mirror; synchronize the
  remote issue only when that external mutation is authorized.

## 4. TDD chronology

Each behavior-bearing cut follows RED, minimal GREEN, affected-suite GREEN,
then refactor. If a shared concurrent edit or infrastructure failure prevents a
valid RED, record it honestly and rerun before production changes. Static/docs
steps may record TDD as not applicable.

The first required RED proved that Functions 401 handling leaked the concrete
`FirebaseFunctionClientError` into Presentation through three observable
boundaries. The next RED covered password-recovery route-exit/re-entry races,
followed by the suspended authorized-device registrar and device lease/task
handoff across benign refresh and relogin. The pre-hardening Auth/AX gate then
passed. At 04:43, the canonical full fast lane exposed two additional real
regressions and their focused remediation passed 7/7. At 04:53, subsequent
Domain review added a RED in which `MemberRepository.member`, controlled by
`ControlledNilMemberRepository`, returned a late `nil` after cancellation; its
GREEN added the 722nd fast-unit responsibility. The final post-P2 fast-unit and
release gates contain both Domain cancellation cases.

## 5. Executed evidence

- Domain cancellation RED/GREEN:
  `/private/tmp/hu079-domain-cancellation-red.xcresult` (1 pass / 1 fail) and
  `/private/tmp/hu079-domain-cancellation-green.xcresult` (2/2).
- Final ownership/security: 60 TestCases / 60 TestCaseRuns, zero
  failed/skipped/warnings at
  `/private/tmp/hu079-ownership-security-final.5BRdlb/result.xcresult`.
- Pre-hardening Auth/accessibility: 92/92 logical, 142/142 expanded, zero
  failed/skipped/warnings at
  `/private/tmp/hu079-auth-ax-green-final.zhbk3X/result.xcresult`.
  It preceded the second member-repository `nil` cancellation test and is
  superseded as closure authority by the final post-P2 fast-unit and release
  gates.
- Focused Auth UI: 3/3 at
  `/private/tmp/hu079-auth-ui-final.xpJJR5/result.xcresult`.
- Intermediate canonical fast-unit RED: 719 passed / 2 failed of 721 at
  `/private/tmp/hu079-fast-unit-canonical-final.xcresult`; focused remediation
  7/7 at `/private/tmp/hu079-two-reds-green.kVOOo4/result.xcresult`.
- Preview-scroll RED: five expected contract failures; GREEN 10/10 at
  `/private/tmp/hu079-preview-scroll-green.0nUj3h/result.xcresult`.
- Final post-preview fast-unit: 723/723 logical and 911/911 expanded at
  `/private/tmp/hu079-preview-fast-final.sEEbPv/result.xcresult`.
- UI smoke: 4/4 at
  `/private/tmp/hu079-ui-smoke-canonical-final.xcresult`.
- Final post-preview release: 734 logical = 733 passed + one known skip; 925
  expanded = 921 passed + 4 variants of that skip; zero failures at
  `/private/tmp/hu079-preview-release-final.NqK73L/release-gate-v1.xcresult`.
- SwiftLint: 0 findings / 413 Swift files. Effective settings: 6/6.
- Architecture/concurrency and static SwiftUI/accessibility reviews: no P0-P3
  findings.
- No project-file diff or Android, Functions, package, setting, or ADR scope.

The implemented source snapshot is 413 Swift files / 73,024 lines. Static test
inventory is 717 Swift Testing declarations + 6 XCTest unit methods = 723 fast
responsibilities, plus 11 UI methods = 734 release responsibilities.

## 6. Risk controls

| Risk | Control |
| --- | --- |
| Late device task clears successor | revision/signature + lease fence and owner-only handle cleanup |
| Benign refresh invalidates same live registration | no dependency on completed Auth operation generation |
| Timeout revokes valid session | finish lane/deadline before best-effort registration suspension |
| Logout races with registration | cancel owner before lease cleanup; coordinator revalidates before writes |
| Massive refactor obscures regression | one cohesive cut, focused tests, then full lanes |
| Backend rollout confusion | HU-070/#198 remains sole live/deploy owner |
| Android parity drift | report gap; no Android source in HU-079 |

## 7. Completion definition

HU-079 is complete only when all acceptance criteria in `spec.md` are met, the
full matrix and gates are evidenced, both independent reviews have no unresolved
findings, and residual Phase 6 work is explicit. Delivery requires separate
maintainer authorization.

Automated implementation, gates, real Xcode RenderPreview, static independent
reviews, and physical iPhone 11 acceptance with VoiceOver, Voice Control,
Reduce Motion, Increased Contrast, and large Dynamic Type are complete. The
maintainer explicitly deferred Accessibility Inspector refinement until after
the MVP and authorized the repository delivery flow. The plan is approved and
ready for merge; closure follows only after the remote merge is definitive.
