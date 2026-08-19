# Tasks - HU-074

HU-074 contains Phase 0 and Phase 1 only. The spec records the maintainer's
verbatim 2026-08-19 authorizations for Phase 0 and Phase 1. Phase 1 is complete
locally, and the maintainer subsequently authorized commit, push, technical
closure, and Phase 2 startup with the verbatim instruction "haz commit y push,
y cerramos fase 1 y empezamos fase 2". Pull request, merge, issue closure, and
branch deletion remain separate delivery gates.

## 0. Governance and reproducible baseline - authorized

- [x] Select the iOS `maintenance` profile and verify Xcode 26.6, Swift 6.3.3,
  Swift 6 mode, iOS 26.0, complete strict concurrency, and Approachable
  Concurrency.
- [x] Preserve the maintainer's related `project.pbxproj` change and confirm no
  unrelated worktree change.
- [x] Inventory production, tests, layers, actor annotations, unsafe-sendability
  candidates, Views, previews, layout scaling, and strict-lint findings.
- [x] Reproduce and persist the initial Debug build errors and focused
  file-diagnostic snapshot in `phase-0-baseline.md`.
- [x] Reproduce and persist the strict SwiftLint result.
- [x] Search local and GitHub history for an equivalent story or issue.
- [x] Create and link GitHub issue #249.
- [x] Create `codex/hu-074-ios-nonisolated-refactor` from synchronized `main`
  while preserving the related build-setting change.
- [x] Create ADR-0011 in English and Spanish.
- [x] Create the HU spec, plan, tasks, issue mirror, and baseline ledger.
- [x] Update `AGENTS.md` and the English/Spanish technical stack with the
  accepted target policy and explicit migration status.
- [x] Resolve every finding from independent architecture/data,
  Presentation/SwiftUI, and tests/governance reviews.
- [x] Validate required files and links, English/Spanish alignment,
  `git diff --check`, and final branch/worktree state.
- [x] Update issue #249 with Phase 0 evidence, the narrowed HU-074 boundary,
  and the exact Phase 1 gate.

## 1. Atomic nonisolated adoption and compilation recovery - complete locally

### Configuration contract

- [x] Move `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` to one project-level
  Debug/Release authority.
- [x] Remove duplicated app-target values only after inheritance is in place.
- [x] Record effective settings for app, `ReguertaTests`, and
  `ReguertaUITests` in Debug and Release.
- [x] Confirm Swift 6, complete strict concurrency, and Approachable
  Concurrency remain effective for all targets.

### Diagnostic ledger and ownership

- [x] Resolve C-001 and C-002 without suspending the synchronous environment
  invalidation fence.
- [x] Resolve C-003 through the actual local-store ownership contract.
- [x] Resolve F-001 through F-003 with one explicit owner for mutable
  Firestore runtime state.
- [x] Make UI-owned observable stores explicitly `@MainActor`.
- [x] Align App and Presentation graph factories with the actor that owns UI
  construction.
- [x] Rebuild after every root cluster and append newly exposed diagnostics to
  `phase-0-baseline.md` with location, message, root/cascade classification,
  and status.
- [x] Resolve every remaining first-party compiler error without unsafe
  migration escapes.

### Preserved behavior

- [x] Preserve session lease and context ownership.
- [x] Preserve synchronous invalidation and cleanup-before-successor ordering.
- [x] Preserve cancellation, fail-closed behavior, and late-result rejection.
- [x] Confirm Firebase/SDK objects remain in responsible Data or App adapters
  and are not transferred live across actors.

### Executable gates

- [x] Run the six-target/configuration effective-setting checks defined in
  `spec.md`.
- [x] Build Debug with the `Reguerta` scheme for a generic iOS Simulator.
- [x] Build Release with the `Reguerta-Production` scheme for a generic iOS
  Simulator.
- [x] Run focused auth, environment-routing, freshness, and root-dependency
  tests and record exact identifiers/counts.
- [x] Run the standard `Reguerta` test gate on an available simulator and
  record the exact destination/counts.
- [x] Confirm `Package.resolved` is unchanged.
- [x] Search for new unsafe concurrency escapes and review every match.
- [x] Run `git diff --check` and explicit-path scope review.
- [x] Complete independent architecture/concurrency review with no unresolved
  finding.
- [x] Update ADR-0011 implementation status and issue #249 with evidence for
  the separately authorized delivery step.

### Delivery closure

- [x] Obtain explicit authorization for commit, push, technical Phase 1
  closure, and the separate Phase 2 bootstrap.
- [ ] Commit and push the atomic Phase 1 cut.
- [ ] Record the definitive branch commit and push evidence.
- [ ] Deliver it to `main` through a linked pull request and close issue #249
  only after separate authorization.

## Follow-up program backlog - not HU-074 tasks

The ordered scopes below are retained only as roadmap pointers. Before any is
worked, create its own canonical HU, issue, branch, spec, plan, measurable
inventory, and test/UI matrix as required by `plan.md`.

1. Reproducible validation lanes.
2. Session environment and Firebase concurrency ownership.
3. Single composition root and app shell.
4. Adaptive layout and DesignSystem foundation.
5. Vertical feature stories in the approved dependency/risk order.
6. Test modernization.
7. Mechanical compactness and current APIs.
8. Release hardening and closure.
