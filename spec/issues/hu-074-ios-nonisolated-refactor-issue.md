# [HU-074] Adopt nonisolated and restore the iOS build

## Summary

Establish `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` as the explicit Swift 6
policy for every first-party iOS target and restore Debug, Release, and test
compilation atomically, without weakening strict concurrency or changing
accepted session/security behavior.

HU-074 owns only governance/baseline Phase 0 and compilation-recovery Phase 1.
The remaining iOS refactor phases are a roadmap and require separate HUs,
issues, branches, measurable gates, and explicit activation.

## Authorization boundary

The maintainer's verbatim 2026-08-19 instructions were: "Pues empieza, crea ADR
y spec con su issue asociada, abrimos rama y empezamos fase 0" and, after the
Phase 0 gate closed, "autorizada fase 1". They authorize Phase 0 and Phase 1,
The later instruction "haz commit y push, y cerramos fase 1 y empezamos fase
2" authorizes Phase 1 delivery/closure and a separately governed Phase 2
bootstrap, but not pull request, merge, issue closure, branch deletion, or
Phase 2 implementation inside HU-074.

## Links

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/249
- Spec: `spec/app/hu-074-ios-nonisolated-refactor/spec.md`
- Plan: `spec/app/hu-074-ios-nonisolated-refactor/plan.md`
- Tasks: `spec/app/hu-074-ios-nonisolated-refactor/tasks.md`
- Baseline: `spec/app/hu-074-ios-nonisolated-refactor/phase-0-baseline.md`
- ADR EN: `docs/decisions/0011-use-nonisolated-default-actor-isolation-on-ios.md`
- ADR ES: `docs-es/decisions/0011-usar-nonisolated-como-aislamiento-de-actor-por-defecto-en-ios.md`

## Acceptance criteria

- App, unit-test, and UI-test targets inherit `nonisolated` from one
  project-level authority in Debug and Release.
- Swift 6 complete strict concurrency and Approachable Concurrency remain
  enabled, and Debug/Release compile without unsafe migration escapes.
- UI-owned observable state and composition are explicitly `@MainActor`;
  Domain is not main-actor isolated for convenience.
- The persisted diagnostic ledger has no open entry after a final full build.
- Session invalidation, lease/context ownership, cleanup-before-successor,
  cancellation, fail-closed behavior, and late-result rejection remain intact
  and covered.
- Focused ownership/security tests and the standard iOS test gate pass with
  exact destination and counts recorded.
- Firebase 12.15.0 and all package pins remain unchanged.
- English/Spanish architectural documentation remains aligned.
- Independent architecture/concurrency review has no unresolved finding.
- Android impact is none.

## Scope

### In scope

- Phase 0 governance, ADR/spec/plan/tasks, baseline ledger, and issue/branch.
- Project-level default-isolation authority and effective-setting checks.
- Minimum actor-ownership/source changes required for every target to compile.
- Debug, Release, focused tests, standard tests, pin/escape/diff checks, and
  independent review.

### Out of scope

- Validation-lane redesign, full Firebase/environment cleanup, composition
  root/shell work, layout/DesignSystem migration, feature slices, broad test or
  API modernization, and release hardening; these require follow-up HUs.
- iOS/Xcode 27-only APIs or rules.
- Firebase upgrades/deployments, backend changes, or live-data mutation.
- Android or unrelated product behavior changes.
- Commit, push, pull request, merge, issue closure, or branch deletion without
  separate authorization.

## Phase 0 evidence

- Branch: `codex/hu-074-ios-nonisolated-refactor`, based on synchronized
  `main` at `0d698f1`.
- Toolchain: Xcode 26.6, Swift 6.3.3, iOS 26.0, complete strict concurrency.
- Inventory: 332 Swift files, 54,022 lines, and 492 enabled tests discovered.
- Debug baseline: exit 65 with three build-root and 20 additional focused
  file-local diagnostics persisted in `phase-0-baseline.md`.
- Strict SwiftLint 0.61.0: two existing test-only length violations.
- Firebase iOS SDK remains pinned to 12.15.0.

## Labels

- `enhancement`
- `area:app`
- `platform:ios`
- `priority:P1`

## Current gate

Phase 0 and Phase 1 are complete and validated locally; commit, push, and
technical Phase 1 closure are now authorized. The
setting is centralized, every compiler diagnostic is resolved by ownership,
Debug and Release build, the focused gate passes 33/33, and the standard gate
passes 496 with 1 skip and 0 failures out of 497 logical tests on iPhone 17
with iOS 26.5. Package pins are unchanged, no unsafe escape was added, all
independent reviews are clear, and Android impact is none. Commit, push, and
the separate Phase 2 bootstrap are in progress; pull request, merge, issue
closure, and branch deletion remain unauthorized.
