# HU-073 - iOS struct construction and Sendable refactor

## Metadata

- issue_id: #245
- priority: P2
- platform: ios
- status: delivered

## Context and problem

The iOS target contains value types that repeat compiler-synthesized behavior
or place necessary initializers inside the primary `struct` declaration. It
also declares `Sendable` explicitly on internal value types for which Swift can
infer the conformance from their stored values.

A syntax-tree audit on 2026-08-18 parsed all 329 Swift files under
`ios/Reguerta` without failures and found:

- 40 primary-declaration initializers in 39 structs across 31 files;
- 102 explicit `Sendable` conformances on internal structs across 57 files;
- 13 structs containing both patterns;
- no affected public, package, `@usableFromInline`, or `@unchecked Sendable`
  declaration.

`NewsArticle` is the first corrected type: it now uses its synthesized
memberwise initializer and omits explicit `Sendable`.

## User story

As an iOS maintainer, I want structs to use Swift's synthesized construction
and sendability when those contracts are sufficient, so that value types avoid
duplicated boilerplate and necessary custom construction remains easy to find.

## Scope

### In scope

- Audit production code, fixtures, previews, and test doubles in the iOS
  project.
- Remove initializers that only duplicate an accessible synthesized memberwise
  initializer.
- Move necessary initializers to extensions in the same file while preserving
  access, defaults, attributes, validation, composition, and behavior.
- Remove explicit `Sendable` from internal structs when Swift can infer it.
- Retain and document an explicit conformance only when a real public or
  generic boundary requires it.
- Record the convention in `AGENTS.md`.
- Use a permanent static check only if it can identify the syntax reliably
  without a fragile multiline regular expression.

### Out of scope

- Functional, visual, localization, or accessibility changes.
- Domain-model or API redesign.
- Removing `@Sendable` from closures.
- Changing protocols, actors, classes, enums, or justified public/generic
  sendability contracts.
- Android, Firebase, Functions, Firestore, Rules, live data, or deployments.
- Unrelated formatting or modernization.

## Linked requirements and decisions

- `AGENTS.md` Swift struct construction and sendability rules.
- ADR-0001 MVVM and Clean Architecture boundaries.
- ADR-0004 root dependency injection and declarative SwiftUI views.
- HU-054 explicit-initializer rule for SwiftUI view structs.
- Swift 6 strict concurrency with `SWIFT_STRICT_CONCURRENCY = complete`.

## Acceptance criteria

- No primary `struct` declaration contains an explicit initializer.
- Pure memberwise-copy initializers are removed when synthesis preserves the
  required API.
- Every necessary initializer lives in an extension in the same file.
- Initializer access, labels, defaults, attributes, ordering, validation, and
  observable behavior remain unchanged.
- No internal struct retains explicit `Sendable` without a demonstrated public
  or generic requirement.
- `@Sendable` closures and protocol concurrency contracts remain unchanged.
- The repository governance records the convention for production and tests.
- Swift diagnostics, build, and applicable iOS tests pass without new warnings.
- Architecture/concurrency review and the applicable SwiftUI review have no
  unresolved findings.
- Android has no code impact and no functional parity gap.

## Dependencies

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/245
- Xcode project configured for Swift 6, strict concurrency, and default
  `MainActor` isolation.
- Existing iOS tests as behavior-preservation coverage.

## Risks

- Removing an explicit initializer can reduce access when stored properties are
  private.
  - Mitigation: retain the initializer in a same-file extension.
- Moving an initializer can lose a default value, closure attribute, or
  construction step.
  - Mitigation: preserve signatures verbatim and refactor in validated batches.
- A textual removal of `Sendable` can affect closures or nominal contracts
  outside the scope.
  - Mitigation: target only struct conformance lists and let strict concurrency
    diagnostics identify any real boundary.
- A broad edit can obscure regressions.
  - Mitigation: split work by layer and validate after each batch.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] Baseline and final syntax inventories recorded.
- [x] Domain, Data, Presentation/DesignSystem, and test batches completed.
- [x] Xcode diagnostics and build pass without new warnings.
- [x] Applicable focused and full iOS tests pass.
- [x] Independent iOS architecture/concurrency review completed.
- [x] SwiftUI review completed for moved View initializers.
- [x] Android parity impact documented as none.
- [x] Issue and delivery evidence updated.

## Initial validation evidence

- Syntax audit: 329/329 Swift files parsed; zero parse failures.
- Baseline: 40 primary-declaration initializers and 102 explicit internal-struct
  `Sendable` conformances.
- `NewsArticle` diagnostics: zero.
- Xcode build after the `NewsArticle` correction: passed in 20.109 seconds.
- `git diff --check`: passed.

## Domain batch evidence

- Domain primary-declaration initializers: 11 before, zero after.
- Domain explicit internal-struct `Sendable` conformances: 56 before, zero
  after.
- Necessary default and invariant-preserving initializers remain in same-file
  extensions; private stored names prevent collisions with synthesized
  memberwise initializers.
- Xcode `Reguerta-Develop` build: passed in 10.537 seconds with Swift 6 strict
  concurrency.
- Focused test selection: 39 tests across access, freshness, startup, session
  policy, commitments, and orders.
- Focused tests: no valid result recorded. Xcode timed out after 300 seconds,
  and `simctl` then confirmed an invalid `CoreSimulatorService` connection.
- Domain diagnostics refresh: pending for the same Xcode service outage.
- `git diff --check`: passed after the Domain edits.

## Data and App batch evidence

- Primary-declaration initializers: 17 in Data and one in App before, zero
  after.
- Explicit internal-struct `Sendable` conformances: 18 before, zero after.
- Necessary injection defaults, request mapping, environment routing, and live
  root composition remain in same-file extensions.
- All Swift files under Data and App parse without errors.
- Official Xcode MCP: unavailable; `XcodeListWindows` did not complete.
- Repository-approved fallback build: `Reguerta-Develop` succeeded for
  `generic/platform=iOS Simulator` with Swift 6 strict concurrency.
- `build-for-testing`: succeeded for the app, `ReguertaTests`, and
  `ReguertaUITests` targets.
- Focused tests were not executed because `CoreSimulatorService` remains
  unavailable; compilation is not recorded as test execution.
- `git diff --check`: passed after the Data and App edits.

## Presentation, DesignSystem, and tests batch evidence

- Primary-declaration initializers: five in Presentation, five in
  DesignSystem, and one in a test double before; zero after.
- Necessary `@ViewBuilder`, escaping closure, default-value, mapping, and
  preview initializers remain in same-file extensions.
- Remaining explicit internal-struct `Sendable` conformances: 28 before, zero
  after across Presentation, DesignSystem, and tests.
- Complete syntax inventory: 329 Swift files parsed, with zero primary struct
  initializers and zero explicit struct `Sendable` conformances.
- Xcode diagnostics: zero across the eight directly affected source files.
- Xcode `Reguerta-Develop` build: passed in 16.944 seconds.
- Focused Keychain and authentication error-mapping tests: 15 passed, zero
  failed.
- SwiftUI review: no findings attributable to the refactor. Both affected
  product-editor previews rendered and were visually inspected at `Large`,
  `XXX Large`, and `AX 5` without lost content, overlap, or control loss.
- Assistive-technology runtime validation was not repeated because the batch
  does not change accessible behavior or semantics.
- `git diff --check`: passed after the batch edits.

## Final validation evidence

- Selected iOS standards profile: `maintenance`.
- Final syntax inventory: 329/329 Swift files parsed without errors; zero
  primary-declaration struct initializers and zero explicit struct `Sendable`
  conformances remain.
- Swift 6 settings remain unchanged: strict concurrency is `complete`,
  approachable concurrency is enabled, and app targets retain default
  `MainActor` isolation.
- No new `@preconcurrency`, `@unchecked Sendable`, `nonisolated(unsafe)`,
  `Task.detached`, or `DispatchQueue` escape was introduced.
- `git diff --check`: passed.
- Xcode `Reguerta-Develop` build: passed in 13.583 seconds.
- Xcode reported two SwiftLint warnings in the untouched
  `FirestoreRepositoryErrorMapperTests.swift` file (`function_body_length` and
  `type_body_length`). They predate and are outside this refactor; no new
  warning is attributable to the change.
- Full Xcode test plan: 618 executions, 617 passed, zero failed, and one
  intentional skip. `ReguertaUITestsLaunchTests.testLaunch()` explicitly skips
  the flaky screenshot launch test in parallel simulator clones; dedicated UI
  tests cover launch behavior.
- The exact `AGENTS.md` CLI command compiled the app and test targets and ran
  the unit tests successfully, but the UI runner could not launch after
  `CoreSimulatorService` became invalid (`FBSOpenApplicationServiceErrorDomain`,
  launch denied). The command was terminated after it entered a repeated
  simulator-launch loop; no test assertion failed in that attempt.
- Independent iOS architecture/concurrency review: no findings. Signatures,
  defaults, `nonisolated`, `@Sendable` closures, private invariants, Clean
  Architecture boundaries, and dependency composition remain preserved.
- SwiftUI review: no findings. The two affected editor previews were inspected
  at `Large`, `XXX Large`, and `AX 5` Dynamic Type sizes.
- No Android, Functions, backend, rules, or shared-contract file changed, so
  this construction-only iOS refactor creates no functional parity gap.

## Final delivery evidence

- Source commit: `a00f05d` (`♻️ refactor(ios): simplify struct construction`).
- Pull request: #246, merged into `main`.
- Definitive merge commit: `3837973`.
- GitHub issue #245: closed as completed by the merged pull request.
- Local `main` and `origin/main`: synchronized at `3837973` with a clean
  worktree after delivery.
- The HU-073 local and remote branches remain available because their deletion
  requires separate destructive authorization.
