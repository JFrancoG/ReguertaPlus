# HU-079 - Tasks

## 1. Bootstrap and activation

- [x] Confirm HU-079 is the next free story number.
- [x] Confirm no duplicate issue, spec, PR, local branch, or remote branch.
- [x] Confirm GitHub Issues is the canonical tracker.
- [x] Confirm clean synchronized base `08deba7`.
- [x] Create `codex/hu-079-ios-auth-session-environment-authorized-devices`.
- [x] Create and verify remote issue [#260](https://github.com/JFrancoG/ReguertaPlus/issues/260) with canonical labels.
- [x] Create spec, plan, tasks, baseline, and local issue mirror.
- [x] Record implementation authorization and delivery exclusions.

## 2. Baseline and characterization

- [x] Freeze whole-tree Swift/test inventory.
- [x] Freeze primary slice files/lines, dependencies, large files, and previews.
- [x] Map ADR-0008 through ADR-0012 to preserved contracts.
- [x] Record HU-070/#198 live rollout boundary.
- [x] Add Auth input validation characterization: 5 logical / 28 executions.
- [x] Complete Auth shell reducer/action characterization.
- [x] Map every session/device operation owner and cancellation edge.

## 3. Domain authorization-error boundary

- [x] Add RED resolver mapping for Functions 401/unauthorized.
- [x] Add RED SessionViewModel expired-session behavior for the Domain error.
- [x] Change the Presentation structural guard from one allowed Data symbol to zero.
- [x] Add the Domain session-expired resolution error.
- [x] Map the error in Data and preserve cancellation/forbidden mappings.
- [x] Preserve fail-closed local termination, dialog, and feedback behavior.
- [x] Run the exact first-boundary focused command GREEN: 33 logical / 39 executions.

## 4. Password-recovery operation ownership

- [x] Add RED late-success, late-failure, re-entry, and current-success tests.
- [x] Retain one recovery task/generation outside the Auth mutation lane.
- [x] Invalidate recovery ownership on route exit/reset and local termination.
- [x] Prove stale completion cannot publish or clear successor state: first
  GREEN 4/4; hardened recovery 5 TestCases / 5 TestCaseRuns; superseded by the
  final ownership/security gate.

## 5. Device registration vs Auth lane

- [x] Add RED suspended-registrar session-lane regression.
- [x] Prove authorized publication precedes non-critical registration.
- [x] Finish Auth lane/deadline without awaiting registration.
- [x] Retain one dedicated registration task.
- [x] Fence task by live session revision/signature, command, and device lease.
- [x] Cancel task ownership before sign-out/revocation cleanup.
- [x] Prove late completion cannot publish or clean a successor.
- [x] Preserve and harden coordinator process-live revalidation and diagnostics.
- [x] Run final ownership/security suite GREEN: 60 TestCases / 60 TestCaseRuns,
  zero failed/skipped/warnings.

## 6. Auth form/state boundary

- [x] Characterize drafts, errors, loading, submit eligibility, and resets.
- [x] Reassess extraction: no separate state owner was justified; retain narrow
  form ownership under the session coordinator.
- [x] Keep session coordination in `SessionViewModel`.
- [x] Preserve password-reset independence from the Auth mutation lane.
- [x] Run pre-hardening Auth/form/accessibility characterization GREEN: 92/92
  logical, 142/142 expanded, zero failed/skipped/warnings; record it as
  superseded by final post-P2 fast-unit/release after the second Domain
  cancellation test.

## 7. Auth View composition

- [x] Split touched Auth Views by responsibility.
- [x] Keep one View type and one applicable preview per file.
- [x] Pass explicit values/actions; no service locator or live construction.
- [x] Preserve typed shell routing and dialogs.
- [x] Cover deterministic welcome/login/register/recovery/error/loading/draining
  states in source-backed previews and focused tests.
- [x] Complete static localization, VoiceOver semantics, Dynamic Type, contrast,
  and Reduce Motion audit with zero P0-P3 findings.
- [x] Render the affected previews in real Xcode at Large, XXX Large, and AX5;
  fix the preview-only missing scroll surface with focused RED/GREEN coverage.
- [x] Complete physical iPhone 11 acceptance with VoiceOver, Voice Control,
  Reduce Motion, Increased Contrast, and large Dynamic Type.
- [x] Record the maintainer decision to defer Accessibility Inspector
  refinement until after the MVP.

## 8. Session/dependency closeout

- [x] Reassess 12 dependencies by ownership; retain the bundle without an
  artificial parameter-count extraction.
- [x] Preserve lane/deadline/draining atomicity.
- [x] Reuse environment/device lease identity across benign refresh and preserve
  invalidation-before-cleanup ordering for logout/revocation.
- [x] Confirm no new forbidden concurrency escape.
- [x] Confirm Presentation/Data/Domain boundaries.

## 9. Validation

- [x] Focused ownership/security passes 60 TestCases / 60 TestCaseRuns; focused
  Auth UI passes 3/3. Pre-hardening Auth/AX 92/142 is chronological evidence,
  superseded by final post-P2 fast-unit/release.
- [x] Final post-preview fast-unit passes 723/723 logical and 911/911 expanded.
- [x] UI smoke passes 4/4.
- [x] Final post-preview release gate passes 733 + one known launch skip, zero
  failures.
- [x] SwiftLint strict/no-cache passes: 0 findings / 413 Swift files.
- [x] Effective settings pass 6/6.
- [x] Generic Debug and Production Release builds pass.
- [x] Diff, package/project/platform scope, and static guards pass; the project
  file has no diff and no Android/Functions/package/settings/ADR scope changed.
- [x] Required Xcode previews render at Large, XXX Large, and AX5.
- [x] HU-079-specific physical-device VoiceOver, Voice Control, Reduce Motion,
  Increased Contrast, and large Dynamic Type acceptance is recorded.
- [x] Accessibility Inspector refinement is explicitly deferred until after
  the MVP.

## 10. Review and documentation

- [x] Independent iOS architecture/concurrency review has zero P0-P3 findings.
- [x] Independent static SwiftUI/accessibility review has zero P0-P3 findings.
- [x] Recalculate final metrics: 413 Swift files / 73,024 lines; 723 fast-unit,
  11 UI, and 734 release responsibilities.
- [x] Reconcile the five local HU-079 artifacts.
- [x] Synchronize the remote issue with final evidence and delivery authority.
- [x] Record Android parity gap and HU-070 dependency boundary.

## 11. Delivery gates

- [x] Commit authorized.
- [x] Push authorized.
- [x] Ready PR authorized.
- [x] Merge authorized.
- [x] Issue closure authorized.
- [x] Branch deletion/integration authorized.
- [x] Firebase/backend deployment explicitly not applicable.

Current delivery state: the complete repository delivery flow is authorized.
External Firebase/backend deployment and live mutation remain unauthorized and
are not required by HU-079.
