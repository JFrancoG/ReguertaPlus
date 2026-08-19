# HU-075 Phase 2 baseline - 2026-08-19

## Authority and Git state

- Active story: HU-075 / GitHub issue #250.
- Active branch: `codex/hu-075-ios-reproducible-validation-lanes`.
- Branch start: `9018ae6f5ac11d5967ecda8497e3374fad676b2b`.
- Dependency: issue #249 and
  `origin/codex/hu-074-ios-nonisolated-refactor` at the same starting SHA.
- `main` and `origin/main`: `0d698f1` at story start.
- At story start, HU-075 had no upstream, commit, or push authorization.
- Worktree was clean immediately before creating these story artifacts.

## Approved maintenance environment

| Item | Baseline |
| --- | --- |
| Xcode | 26.6 (`17F113`) |
| Swift | 6.3.3 (`swiftlang-6.3.3.1.3`) |
| Project Swift mode | 6.0 |
| Deployment target | iOS 26.0 |
| Strict concurrency | `complete` |
| Approachable Concurrency | `YES` |
| Default actor isolation | project-level `nonisolated` |
| SwiftLint | 0.61.0, currently found at `/opt/homebrew/bin/swiftlint` |
| Xcode MCP | `windowtab1`, Reguerta project confirmed |

Xcode 27 or an iOS 27 simulator may exist on the machine, but neither is an
authority or an accepted validation destination for this story.

## Xcode project inventory

`xcodebuild -project Reguerta.xcodeproj -list -json` reports:

- Targets: `Reguerta`, `ReguertaTests`, `ReguertaUITests`.
- Configurations: Debug, Release.
- Shared schemes: `Reguerta`, `Reguerta-Develop`,
  `Reguerta-Production`.
- Versioned `.xctestplan` files: 0.

All three shared schemes currently set `shouldAutocreateTestPlan = YES` and
embed both test targets directly. Their configuration semantics are:

| Scheme | Test | Launch | Profile | Analyze | Archive |
| --- | --- | --- | --- | --- | --- |
| `Reguerta` | Debug | Release | Release | Debug | Release |
| `Reguerta-Develop` | Debug | Debug | Debug | Debug | Debug |
| `Reguerta-Production` | Release | Release | Release | Release | Release |

The repository's `AGENTS.md` names `Reguerta` as the standard validation
scheme. The root README uses the same scheme but still names iPhone 16, while
`AGENTS.md` names iPhone 17. A name-only destination is ambiguous on a machine
that has both iOS 26 and iOS 27 simulator variants.

## Discovered tests

Xcode MCP `GetTestList` on the current autocreated Develop plan reports 497
enabled logical tests:

| Target | Enabled |
| --- | ---: |
| `ReguertaTests` | 488 |
| `ReguertaUITests` | 9 |
| Total | 497 |

The nine UI responsibilities are:

1. `ReguertaUITests/testUnauthorizedUserShowsRestrictedMode()`
2. `ReguertaUITests/testPreAuthorizedProducerEntersHomeWithActionRowEnabled()`
3. `ReguertaUITests/testHomeShowsLatestNewsWithoutBottomObstruction()`
4. `ReguertaUITests/testMyOrderSearchBarStaysAboveBottomSafeArea()`
5. `ReguertaUITests/testUsersAddButtonStaysAboveBottomSafeArea()`
6. `ReguertaUITests/testDrawerNavigationOpensSelectedRoute()`
7. `ReguertaUITests/testInvalidCredentialsShowsInlineErrorWithoutCrash()`
8. `ReguertaUITests/testLaunchPerformance()`
9. `ReguertaUITestsLaunchTests/testLaunch()`

The accepted smoke candidates are items 1, 2, 6, and 7. Items 3-5 remain UI
layout/news regression responsibilities. Item 8 is performance. Item 9 is the
known launch-matrix test that was declared skipped in the most recent complete
gate.

The most recent HU-074 full validation on iPhone 17 / iOS 26.5 recorded 497
logical tests: 496 passed, 1 skipped, and 0 failed. This is inherited evidence,
not a substitute for executing the new HU-075 plans after they exist.

## SwiftLint baseline

The Xcode phase currently:

- checks `/opt/homebrew/bin/swiftlint`, then `/usr/local/bin/swiftlint`;
- runs `lint` without `--strict` or `--no-cache`;
- emits a warning and succeeds when SwiftLint is unavailable.

The repository configuration references `.swiftlint-baseline.json`, whose
content is an empty JSON array. Its comment says existing violations are
baselined, which is stale relative to the empty file.

Strict SwiftLint 0.61.0 has exactly two current test-only findings:

1. `FirestoreRepositoryErrorMapperTests.swift`: type body 322 lines, limit 300.
2. `fullMemberContractKeepsLegacyAliasesButRejectsConflictingTypes`: body 76
   lines, limit 50.

No production Swift finding is part of the baseline.

## Missing reproducibility controls

- No repository script runs SwiftLint consistently.
- No repository script verifies effective Swift build settings.
- No versioned plan defines fast unit, UI smoke, or release ownership.
- No first-party CI workflow exists in the checkout.
- No scheme or plan enables/reports a coverage trend.
- No repository-owned command captures `.xcresult` coverage with toolchain,
  destination, and test-plan metadata.

These are HU-075 work items. The absence of remote CI is not permission to
select a provider.

## Initial exit comparison

Story closure must update this document or add a linked final-evidence section
with:

- discovered plan names and selected test counts;
- strict-lint version/result;
- six effective-settings rows;
- Debug, Release, fast-unit, UI-smoke, and release-gate results;
- the exact iOS 26 destination;
- release logical pass/skip/fail counts;
- coverage scope and initial trend values;
- package-pin/diff/review results and residual debt.

## Implementation checkpoint - 2026-08-19

- Xcode discovers `fast-unit-v1`, `ui-smoke-v1`, and `release-gate-v1` from
  every shared scheme; `release-gate-v1` is the safe full-suite default.
- Enumeration is exact: fast unit 488/0, UI smoke 0/4 with five UI tests
  intentionally excluded, and release gate 488/9 with zero disabled tests.
- Fast unit: 488 logical tests passed, 0 failed, 0 skipped on iPhone 17 / iOS
  26.5 (`087C0B4D-8C32-419D-8B71-1763CAC6D46B`).
- UI smoke: 4 passed, 0 failed, 0 skipped on the same destination.
- SwiftLint 0.61.0: 334 files, 0 findings, exit 0 in strict/no-cache mode.
- Effective settings: all six target/configuration pairs pass. A controlled
  `REGUERTA_EXPECT_SWIFT_VERSION=0` run fails with exit 1 before mutation.
- Coverage command: `fast-unit-v1`, Debug, same destination, Xcode 26.6. The
  app trend is 37.20% (`13,861 / 37,258` executable lines); no threshold is
  defined. `ReguertaTests.xctest` reports 95.98% (`16,604 / 17,299`) only as
  diagnostic context, not as the product coverage metric.
- Coverage remains disabled in `release-gate-v1` so launch/performance tests
  are not instrumented.

## Closure gate - 2026-08-19

- Canonical command: `./scripts/validate-ios.sh release-gate --destination
  'platform=iOS Simulator,id=087C0B4D-8C32-419D-8B71-1763CAC6D46B'`.
- The composite runner completed strict lint, the six-pair settings check, a
  generic Debug build, a generic `Reguerta-Production` Release build, and the
  complete Debug test plan with exit 0.
- The retained result bundle reported 497 logical tests: 496 passed, 1 known
  launch-matrix skip, 0 failed, result `Passed`. Its temporary path was printed
  outside the repository for diagnosis.
- Destination guards reject a name without OS, `OS=27.0`, a nonexistent UUID,
  and the non-UUID value `id=Booted`. The accepted UUID resolves to iPhone 17 /
  iOS 26.5.
- `Package.resolved` is unchanged. JSON, XML, `project.pbxproj`, shell syntax,
  `git diff --check`, explicit scope, and unsafe-escape checks are clean.
- Independent iOS/testing/tooling review completed with no unresolved P0-P3.
- No CI provider, Android/backend/product behavior, package upgrade, unsafe
  concurrency escape, hard-coded Homebrew path, or iOS/Xcode 27 rule entered
  the implementation.
- HU-075 is implemented locally. Commit, push, pull request, merge, issue
  closure, branch deletion, and integration remain separately gated.

## Apple Silicon Xcode SwiftLint verification - 2026-08-19

- Terminal resolved SwiftLint 0.61.0 from
  `/opt/homebrew/bin/swiftlint`, but Xcode's build-phase `PATH` included
  `/usr/local/bin` and omitted `/opt/homebrew/bin`.
- Reopening Xcode from Terminal and cleaning the build folder did not change
  that build-phase environment; neither action can make an executable visible
  on a missing path.
- The documented one-time host setup exposes the installed binary through
  `/usr/local/bin/swiftlint` while the Xcode project and repository runner
  continue to resolve only through `PATH`.
- The verified host state is
  `/usr/local/bin/swiftlint -> /opt/homebrew/bin/swiftlint`; invoking the link
  reports 0.61.0.
- A final pre-delivery build from the connected Xcode project completed in 3.27
  seconds with zero errors and the SwiftLint phase enabled. No build-folder
  clean was required after fixing the executable lookup.
- The maintainer then authorized documentation, commit, and push with the
  verbatim instruction "ok, documentalo y commit y push". Pull request, merge,
  issue closure, branch deletion, and integration remain unauthorized.

## Branch publication - 2026-08-19

- Implementation commit:
  `4eee0da70a23ad8db606fbbc77783b7bafe549bc`.
- Remote branch:
  `origin/codex/hu-075-ios-reproducible-validation-lanes`.
- The first push created the remote branch and configured its local upstream.
- `HEAD...@{upstream}` reported `0 0` immediately after publication.
- Issue #250 remains open. Publication did not create a pull request, merge
  either stacked story, close an issue, or delete a branch.
