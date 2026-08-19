# Plan - HU-075 reproducible iOS validation lanes

## 1. Planning authority and branch relationship

HU-075 implements Phase 2 of the accepted iOS refactor roadmap. The verbatim
authorization and delivery boundary are recorded in `spec.md`.

The working branch `codex/hu-075-ios-reproducible-validation-lanes` starts at
`9018ae6`, the published HU-074 tip. It is deliberately stacked because #249
is not integrated into `main`. HU-075 does not modify the HU-074 branch and
does not imply integration of either story.

## 2. Design principles

1. Version validation intent instead of relying on Xcode's autocreated plan.
2. Use one canonical scheme and explicit test plans rather than copying test
   inventories between three schemes.
3. Keep fast feedback and release completeness as separate contracts.
4. Make repository commands independent of interactive Xcode state and local
   Homebrew installation prefixes.
5. Preserve Swift Testing/XCTest coexistence and current product behavior.
6. Treat coverage as an observed trend, not an arbitrary initial gate.
7. Stay on the approved Xcode 26/iOS 26 maintenance profile.

## 3. Work sequence

### 3.1 Governance and reproducible baseline

- Link issue #250, the story artifacts, and the stacked dependency on #249.
- Record Xcode/Swift/SwiftLint versions, branch/base, schemes, targets,
  configurations, discovered tests, lint findings, and existing gaps.
- Confirm no `.xctestplan`, repository validation runner, settings verifier,
  coverage configuration, or first-party CI workflow exists.
- Record the exact user authorization and delivery exclusions.

Exit gate:

- Story, plan, tasks, issue mirror, and baseline agree with issue #250.
- Baseline counts are reproducible through Xcode 26 tooling.
- `git diff --check` is clean and the branch contains no unrelated change.

### 3.2 Versioned test plans and canonical scheme

- Create shared `fast-unit-v1`, `ui-smoke-v1`, and `release-gate-v1` plans in
  the Xcode project shared-data area.
- Configure fast unit with the complete `ReguertaTests` target only.
- Configure UI smoke with the four accepted identifiers only.
- Configure release gate with complete unit/UI ownership and the known
  launch-matrix skip preserved as an explicit test result. Keep coverage off
  so launch/performance tests are not instrumented.
- Replace the canonical scheme's autocreated plan with references to all three
  plans and select a documented default.
- Reference the same plans from Develop/Production without duplicating their
  contents. Keep product launch/profile/archive environment semantics intact;
  use Debug for every Test action because the unit target requires `@testable`.
- Verify plan discovery and selected test inventories before running tests.

Exit gate:

- Xcode and `xcodebuild` discover all three plan names.
- Fast unit selects 488 unit and zero UI tests.
- UI smoke selects exactly the four allow-listed UI tests.
- Release gate preserves the complete 497-test logical responsibility.

### 3.3 Reproducible SwiftLint gate

- Add one executable repository runner under `ios/Reguerta/scripts`.
- Resolve `swiftlint` with `command -v`, print the version, and fail with an
  actionable error when missing.
- Run the repository configuration in strict/no-cache mode.
- Make the Xcode build phase invoke the runner through `SRCROOT` and remove all
  hard-coded Homebrew paths.
- Split the two existing test-only length findings by behavior/fixture concern
  in a separate mechanical diff; do not touch production behavior.
- Remove or update stale baseline commentary only after strict lint is green.

Exit gate:

- Direct runner and Xcode phase use the same command.
- SwiftLint 0.61.0 returns exit 0 with zero findings.
- No production Swift file changes as part of lint cleanup.

### 3.4 Effective-settings verifier

- Add a shell script that determines its project root without relying on the
  caller's current directory.
- Query each of `Reguerta`, `ReguertaTests`, and `ReguertaUITests` for Debug and
  Release with `xcodebuild -showBuildSettings`.
- Parse and assert one effective value for:
  `SWIFT_DEFAULT_ACTOR_ISOLATION`, `SWIFT_VERSION`,
  `SWIFT_STRICT_CONCURRENCY`, `SWIFT_APPROACHABLE_CONCURRENCY`, and
  `IPHONEOS_DEPLOYMENT_TARGET`.
- Print a compact six-row result and fail immediately on missing or mismatched
  values.

Exit gate:

- All six pairs pass with `nonisolated`, `6.0`, `complete`, `YES`, and `26.0`.
- A controlled local fixture or argument-level negative check demonstrates
  that drift produces non-zero exit without mutating the project.

### 3.5 Canonical commands, coverage trend, and documentation

- Add a small validation entrypoint only if it reduces duplication without
  hiding the underlying `xcodebuild` commands.
- Require an explicit destination ID or `name` plus `OS` for simulator lanes.
- Produce named `.xcresult` bundles outside the source tree or in an ignored
  artifacts directory.
- Enable coverage only for a `fast-unit-v1` invocation and extract the app/unit
  result through `xccov`; keep release-gate performance execution uninstrumented.
- Record date, Xcode/Swift version, destination, plan, scope, test counts, and
  initial coverage values. Do not add a threshold.
- Align `AGENTS.md`, README, and relevant EN/ES stack docs with the canonical
  scheme, plan names, commands, and simulator fallback wording.

Exit gate:

- A maintainer can copy one documented command for each lane.
- Coverage is reproducible from the retained result-bundle contract.
- Documentation does not imply iOS/Xcode 27 adoption or a configured CI
  provider.

### 3.6 Full validation and independent review

Run in this order:

1. JSON/XML/test-plan structural validation.
2. Strict SwiftLint runner.
3. Effective-settings verifier.
4. Fast unit on an explicit iOS 26 simulator.
5. UI smoke on the same destination.
6. Debug generic simulator build.
7. Production Release generic simulator build.
8. Release gate with result bundle and logical pass/skip/fail counts.
9. Coverage extraction and baseline record.
10. Package-pin, unsafe-diff, and `git diff --check` review.
11. Independent iOS/testing/tooling review.

Exit gate:

- Every acceptance criterion in `spec.md` has evidence.
- No test responsibility is lost and no product/Firebase/Android/iOS-27 scope
  enters the diff.
- Issue #250 reflects implementation status but remains open until separately
  authorized delivery and integration.

## 4. Expected file clusters

### Governance and evidence

- `spec/app/hu-075-ios-reproducible-validation-lanes/`
- `spec/issues/hu-075-ios-reproducible-validation-lanes-issue.md`
- `AGENTS.md`
- `README.md`
- `docs/tech-stack/README.md`
- `docs-es/tech-stack/README.md`

### Xcode validation model

- `ios/Reguerta/TestPlans/*.xctestplan`
- `ios/Reguerta/Reguerta.xcodeproj/xcshareddata/xcschemes/*.xcscheme`
- `ios/Reguerta/Reguerta.xcodeproj/project.pbxproj`

### Repository tooling and lint cleanup

- `ios/Reguerta/scripts/run-swiftlint.sh`
- `ios/Reguerta/scripts/verify-swift-settings.sh`
- Optional focused validation/coverage runner if justified by duplication.
- `ios/Reguerta/.swiftlint.yml`
- `ios/Reguerta/.swiftlint-baseline.json`
- Test-only Firestore error-mapper test files required to split the two
  findings.

## 5. Commit and delivery strategy

The maintainer authorized documentation, commit, and push with the verbatim
instruction "ok, documentalo y commit y push". Use focused Conventional
Commits and preserve dependency order:

1. Story/baseline governance.
2. Test plans and scheme references.
3. SwiftLint runner plus isolated test-only lint cleanup.
4. Settings/coverage tooling and documentation.
5. Final evidence update.

Before any future PR, verify whether #249 has been integrated. If not, the PR
must explicitly target the HU-074 branch; after integration it must be
retargeted/rebased to `main` without rewriting unrelated work.

This authorization does not include a pull request, merge, issue closure,
branch deletion, or integration of either stacked story.

## 6. Risks and controls

- Missing tests through plan filters -> compare plan discovery counts with the
  persisted 488/9 baseline.
- UI smoke flakiness -> only use existing local mock-backed journeys and keep
  full UI responsibility in release gate.
- Scheme drift -> plans are the validation authority; schemes retain only
  environment/configuration meaning.
- Tool-path drift -> resolve through `PATH`; keep project files free of
  Homebrew prefixes and document the verified Apple Silicon host link that
  makes the installed binary visible to Xcode.
- Coverage instability -> record toolchain/destination/scope and no threshold.
- Scope expansion -> production Swift, Firebase, Android, CI provider, and
  Xcode 27 remain hard exclusions.
