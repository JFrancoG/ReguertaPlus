# HU-075 - Define reproducible iOS validation lanes

## Metadata

- issue_id: #250
- priority: P1
- platform: ios
- status: ready_for_merge

## Authorization and delivery boundary

Authorization source: the maintainer's 2026-08-19 message in the Codex task,
quoted verbatim: "haz commit y push, y cerramos fase 1 y empezamos fase 2".

The instruction authorizes the bootstrap and implementation of this Phase 2
story after publishing HU-074.

Delivery authorization source: the maintainer's later 2026-08-19 message,
quoted verbatim: "ok, documentalo y commit y push". This authorizes documenting
the SwiftLint/Xcode host prerequisite, committing HU-075, and pushing its
branch. It does not authorize opening or merging a pull request, closing issue
#250, deleting either branch, or integrating HU-074 or HU-075 into `main`.

HU-075 is intentionally separate from HU-074. Its branch is stacked from the
published HU-074 tip at `9018ae6` because issue #249 is not yet integrated into
`main`. A future delivery must either use the HU-074 branch as its temporary
base or wait until #249 is integrated and then rebase/retarget HU-075.

## Context and problem

The iOS project has three shared schemes, but each currently asks Xcode to
autocreate a test plan containing both unit and UI targets. This gives no
versioned fast lane, no bounded UI smoke lane, and no explicit release gate.
The schemes also use different Debug/Release semantics without one documented
repository validation authority.

SwiftLint 0.61.0 is installed locally, but the Xcode build phase searches two
hard-coded Homebrew paths, runs non-strict lint, and succeeds with only a
warning when the tool is unavailable. Strict lint has exactly two existing
test-only length findings. Effective Swift 6 settings were validated manually
for HU-074, but drift is not checked by a repository-owned command. Coverage
is not configured or recorded.

Later iOS refactor stories need a quick deterministic signal and a complete
closure gate that mean the same thing locally and in future automation. This
story establishes those contracts without selecting a CI provider or changing
product behavior.

## User story

As an iOS maintainer, I want versioned validation lanes and repository-owned
commands, so that each refactor receives fast feedback and closes against the
same full gate on any supported development machine.

## Scope

### In scope

- Add shared, versioned `fast-unit-v1`, `ui-smoke-v1`, and
  `release-gate-v1` Xcode test plans.
- Make `Reguerta` the canonical repository validation scheme while preserving
  the Develop and Production schemes as environment/configuration aliases.
- Give each lane one documented, reproducible command using an explicit iOS
  26 simulator destination.
- Keep all 488 unit tests in the fast lane and define an initial four-test,
  mock-backed UI smoke allow-list.
- Keep the complete 488-unit/9-UI responsibility, including launch and
  performance coverage and the known launch-matrix skip, in the release gate.
- Add a repository SwiftLint runner that resolves `swiftlint` from `PATH`,
  reports its version, uses strict/no-cache mode, and fails when unavailable.
- Make the Xcode SwiftLint phase delegate to that runner.
- Resolve the two existing strict-lint findings as a test-only structural cut,
  with no production behavior change or broad formatting cleanup.
- Add a deterministic settings verifier for `Reguerta`, `ReguertaTests`, and
  `ReguertaUITests` in Debug and Release.
- Verify effective `nonisolated` default isolation, Swift 6, complete strict
  concurrency, Approachable Concurrency, and iOS 26.0.
- Capture code coverage from a `fast-unit-v1` result bundle and record an
  initial trend with toolchain, date, destination, and scope, without a
  pass/fail percentage threshold or instrumenting performance tests.
- Align `AGENTS.md`, the root README, and relevant English/Spanish stack docs
  with the canonical scheme, commands, and maintenance-toolchain policy.

### Out of scope

- Selecting, configuring, or deploying a remote CI provider.
- Migrating XCTest unit suites to Swift Testing or moving XCUITest,
  launch-performance, or UI tests away from XCTest.
- Adding product behavior or new functional test journeys.
- Phase 3 environment/session/Firebase ownership work.
- Composition-root, app-shell, layout, DesignSystem, or vertical-slice work.
- Firebase, Swift Package, backend, or Android changes.
- An arbitrary coverage threshold.
- APIs, settings, project upgrades, or rules exclusive to iOS/Xcode 27.
- Pull request, merge, issue closure, branch deletion, or integration without
  separate authorization.

## Validation-lane contract

| Lane | Test responsibility | Configuration | Intended use |
| --- | --- | --- | --- |
| `fast-unit-v1` | Complete `ReguertaTests` target only | Debug | Fast deterministic feedback for code changes |
| `ui-smoke-v1` | Four explicit mock-backed UI journeys | Debug | Bounded shell/auth/navigation confidence |
| `release-gate-v1` | Complete unit and UI targets, including launch/performance | Debug | Full test responsibility inside the composite release gate |

The initial UI smoke allow-list is:

- `ReguertaUITests/testUnauthorizedUserShowsRestrictedMode()`
- `ReguertaUITests/testPreAuthorizedProducerEntersHomeWithActionRowEnabled()`
- `ReguertaUITests/testDrawerNavigationOpensSelectedRoute()`
- `ReguertaUITests/testInvalidCredentialsShowsInlineErrorWithoutCrash()`

The remaining UI layout/news regressions, `testLaunchPerformance()`, and
`ReguertaUITestsLaunchTests/testLaunch()` remain explicit release-gate
responsibilities. The existing launch-matrix skip is recorded, not silently
converted into a pass or removed in this story.

All three shared schemes reference the same plans, so the inventory has one
authority. Every scheme's Test action uses Debug because the unit target relies
on `@testable import Reguerta`. Develop and Production retain their existing
Launch/Profile/Analyze/Archive environment semantics; the composite release
lane validates a separate Production Release build before the Debug full-test
plan.

## Linked requirements and decisions

- `AGENTS.md` repository workflow and iOS validation policy.
- ADR-0001: MVVM and Clean Architecture.
- ADR-0002: iOS 26 minimum platform version.
- ADR-0011: `nonisolated` default actor isolation and explicit ownership.
- HU-074 / issue #249: required compilation and concurrency baseline.
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/250
- Reproducible starting inventory: `phase-2-baseline.md`.

No new architectural ADR is required at story start: HU-075 operationalizes
the already accepted iOS maintenance, platform, concurrency, and test
responsibilities. If implementation changes an architectural boundary rather
than validation tooling, work stops for a separately reviewed ADR.

## Acceptance criteria

- The three test plans are shared, versioned, referenced by the canonical
  scheme, and independently invocable by one documented command each.
- `fast-unit-v1` contains only the complete unit-test target and passes.
- `ui-smoke-v1` contains only the four named mock-backed UI tests and passes.
- `release-gate-v1` exercises the complete unit and UI responsibilities on an
  explicit iOS 26 simulator and reports logical pass, skip, and fail counts.
- `Reguerta` is the documented validation authority; Develop and Production
  retain coherent environment/configuration roles without duplicate test
  inventories.
- The SwiftLint runner uses the executable found through `PATH`, prints its
  version, runs `lint --strict --no-cache`, fails if unavailable, and returns
  zero findings.
- The Xcode build phase calls the repository runner and contains no Homebrew
  installation path.
- The Apple Silicon host prerequisite is documented: when Xcode's build-phase
  `PATH` omits Homebrew's `/opt/homebrew/bin`, the installed binary is exposed
  through a verified `/usr/local/bin/swiftlint` symbolic link and reports the
  repository-pinned version.
- The two initial lint findings are resolved only through test-structure
  changes; production behavior and package pins remain unchanged.
- The settings verifier checks all three targets in both configurations and
  fails on drift from `nonisolated`, Swift 6, complete strict concurrency,
  Approachable Concurrency, or iOS 26.0.
- The initial coverage trend is derived from a `fast-unit-v1` result bundle
  and records scope/toolchain/destination/date without imposing a threshold.
  Coverage remains disabled for `release-gate-v1` so launch/performance tests
  are not instrumented.
- Debug generic and Production Release generic builds remain green.
- Canonical commands agree across `AGENTS.md`, README, and aligned stack docs.
- `git diff --check`, package-pin review, and an independent iOS/tooling review
  have no unresolved finding.
- Android parity impact is recorded as none because the story changes only iOS
  development validation infrastructure.

## Executable verification contract

| Gate | Command shape | Required result |
| --- | --- | --- |
| Fast unit | `./scripts/validate-ios.sh fast-unit --destination <iOS-26-destination>` | 488 unit tests selected; no UI tests; exit 0 |
| UI smoke | `./scripts/validate-ios.sh ui-smoke --destination <iOS-26-destination>` | Four named UI tests selected; exit 0 |
| Composite release gate | `./scripts/validate-ios.sh release-gate --destination <iOS-26-destination>` | Lint/settings/builds/full tests green; counts recorded |
| Effective settings | Repository settings-verifier script | Six target/configuration pairs match the contract |
| Strict lint | Repository SwiftLint runner | Version printed; zero findings; exit 0 |
| Debug build | Canonical Debug generic-simulator command | Exit 0 |
| Release build | Production Release generic-simulator command | Exit 0 |
| Coverage | `./scripts/validate-ios.sh coverage ... --result-bundle-path <new-path>` | Initial trend recorded; no threshold |
| Repository diff | `git diff --check` plus explicit scope review | Clean and in scope |

Every simulator command must identify an iOS 26 destination by exact ID or by
both name and OS version. A name-only destination is not acceptable while
iOS 26 and iOS 27 simulators may coexist.

## Dependencies

- HU-074 is published at `9018ae6` and issue #249 remains open pending
  separately authorized integration.
- Xcode 26.6, Swift 6.3.3, SwiftLint 0.61.0, and an iOS 26.5 simulator are the
  initial maintenance environment.
- Existing Swift Testing unit suites and XCTest unit/UI/performance suites are
  preserved.
- No remote CI configuration exists; repository commands must remain usable by
  a future provider without choosing one here.

## Risks

- A test-plan exclusion can silently drop coverage.
  - Mitigation: persist target/test counts, exact smoke identifiers, and a
    release-plan inventory comparison against Xcode's discovered list.
- Scheme alignment can change environment behavior.
  - Mitigation: keep Develop/Production launch and archive roles intact and
    change test-plan ownership separately from product configuration.
- Strict lint in every build can become environment-dependent.
  - Mitigation: resolve through `PATH`, fail with a README-linked message,
    document the one-time Apple Silicon Xcode host setup, and expose the same
    runner for local and future automation.
- Coverage can become a vanity or unstable gate.
  - Mitigation: record a scoped trend from an `.xcresult`; do not introduce a
    percentage threshold in HU-075.
- A stacked branch can hide its integration dependency.
  - Mitigation: record `Depends on #249`, the base SHA, and the required future
    retarget/rebase in the story, issue, and handoff.

## Definition of Done (DoD)

- [x] All acceptance criteria are validated with exact commands and results.
- [x] The three plans and canonical scheme are versioned and discoverable by
  both Xcode and `xcodebuild`.
- [x] Strict lint and settings verification are repository-owned and green.
- [x] The initial coverage trend and complete lane counts are recorded.
- [x] Documentation and issue #250 reflect the executable result.
- [x] Independent review has no unresolved finding.
- [x] Android parity impact is recorded as none.
- [x] Commit/push delivery has separate, verbatim authorization; PR, merge,
  issue closure, branch deletion, and integration remain unauthorized.

## Publication evidence

- Implementation commit:
  `4eee0da70a23ad8db606fbbc77783b7bafe549bc`.
- Published branch:
  `origin/codex/hu-075-ios-reproducible-validation-lanes`.
- The local branch and upstream were `0/0` immediately after the first push.
- Issue #250 remains open. No pull request, merge, issue closure, branch
  deletion, or integration was performed.
