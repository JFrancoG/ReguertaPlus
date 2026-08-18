# Tasks - HU-073

## 1. Preparation

- [x] Audit all 329 Swift files with the Swift syntax tree.
- [x] Record 40 primary-declaration initializers in 39 structs.
- [x] Record 102 explicit `Sendable` conformances in internal structs.
- [x] Search GitHub for an equivalent issue.
- [x] Create and link issue #245.
- [x] Create `codex/hu-073-ios-struct-construction-refactor` from synchronized
  `main` while preserving the related `NewsArticle` change.
- [x] Define approved scope, exclusions, risks, acceptance, and validation.
- [x] Add spec, plan, tasks, issue mirror, and repository governance.

## 2. Initial correction

- [x] Remove the redundant primary initializer from `NewsArticle`.
- [x] Remove explicit `Sendable` from `NewsArticle`.
- [x] Confirm zero file diagnostics and a successful Xcode build.

## 3. Domain batch

- [x] Move or remove all 11 primary-declaration initializers.
- [x] Remove 56 redundant explicit internal-struct `Sendable`
  conformances.
- [x] Verify access, defaults, invariants, and call sites with a clean Swift 6
  build.
- [x] Build `Reguerta-Develop` with Xcode: passed in 10.537 seconds.
- [ ] Refresh diagnostics and run focused tests after `CoreSimulatorService`
  recovers; both Xcode actions timed out after the simulator service lost its
  connection.

## 4. Data and App batch

- [x] Move all 17 Data and one App initializers to same-file extensions.
- [x] Remove 18 redundant explicit internal-struct `Sendable`
  conformances, including private DTOs.
- [x] Preserve injection defaults, private-property access, invariant mapping,
  and root composition.
- [x] Parse all Data and App Swift files without errors.
- [x] Build `Reguerta-Develop` for a generic iOS Simulator destination.
- [x] Compile app, unit-test, and UI-test targets with `build-for-testing`.
- [ ] Refresh diagnostics and run focused tests through Xcode after the
  official MCP and `CoreSimulatorService` recover.

## 5. Presentation, DesignSystem, and tests

- [x] Move or remove five Presentation and five DesignSystem initializers.
- [x] Move the remaining test-double initializer.
- [x] Preserve `@ViewBuilder`, escaping closures, defaults, and preview setup.
- [x] Remove remaining redundant explicit struct `Sendable` conformances.
- [x] Complete the applicable SwiftUI review.

## 6. Final validation

- [x] Re-run the complete syntax inventory with zero parse failures.
- [x] Confirm zero primary-declaration struct initializers.
- [x] Confirm zero unjustified explicit internal-struct `Sendable`
  conformances.
- [x] Run `git diff --check`.
- [x] Refresh Xcode diagnostics for affected files.
- [x] Build the iOS project.
- [x] Run focused affected tests.
- [x] Run the full iOS test plan required by `AGENTS.md`.
- [x] Complete independent iOS architecture/concurrency review.
- [x] Record final validation evidence and the demonstrated CLI simulator
  exception.

## 7. Parity and delivery

- [x] Confirm Android and backend are outside the implementation scope.
- [x] Document final no-parity-gap assessment.
- [x] Update issue #245 with implementation and validation evidence.
- [x] Update `CHANGELOG.md` after delivery authorization.
- [x] Obtain explicit authorization for commit, push, PR, merge, closure, and
  branch cleanup.
