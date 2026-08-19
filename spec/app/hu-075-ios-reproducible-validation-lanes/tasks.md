# Tasks - HU-075

Authorization source and delivery boundaries are recorded verbatim in
`spec.md`. Phase 2 implementation, SwiftLint host documentation, commit, and
push are authorized. Pull request, merge, issue closure, branch deletion, and
integration of #249 or HU-075 remain separate gates.

## 0. Governance and reproducible baseline

- [x] Verify HU-075 is the next free canonical story and no equivalent issue
  exists.
- [x] Create issue #250 with `enhancement`, `platform:ios`, `priority:P1`, and
  `area:app`.
- [x] Create `codex/hu-075-ios-reproducible-validation-lanes` from the
  published HU-074 tip `9018ae6`.
- [x] Record `Depends on #249` and the stacked-branch delivery rule.
- [x] Select the iOS maintenance profile and confirm Xcode 26.6, Swift 6.3.3,
  SwiftLint 0.61.0, and iOS 26 scope.
- [x] Confirm Xcode MCP is connected to the Reguerta project.
- [x] Inventory targets, configurations, schemes, test-plan state, and
  discovered test counts.
- [x] Persist current SwiftLint behavior, findings, settings-check, coverage,
  command, and CI gaps in `phase-2-baseline.md`.
- [x] Create the spec, plan, tasks, baseline, and issue mirror.
- [ ] Update issue #250 with links to the local artifacts when they are
  published; do not imply delivery before commit/push authorization.

## 1. Versioned plans and canonical scheme

- [x] Add shared `fast-unit-v1.xctestplan` with only `ReguertaTests`.
- [x] Add shared `ui-smoke-v1.xctestplan` with exactly the four accepted UI
  identifiers.
- [x] Add shared `release-gate-v1.xctestplan` with complete unit/UI and
  launch/performance responsibilities, with coverage disabled.
- [x] Reference all three plans from the canonical `Reguerta` scheme and stop
  relying on an autocreated plan.
- [x] Select and document the canonical default plan.
- [x] Align Develop/Production plan references without changing their
  environment/launch/archive roles.
- [x] Verify Xcode and `xcodebuild` discover the three versioned plans.
- [x] Verify selected inventories: 488/0, 0/4, and 488/9.

## 2. Strict SwiftLint without project-local tool prefixes

- [x] Add `scripts/run-swiftlint.sh` with `PATH` lookup, version output,
  strict/no-cache flags, and failure when unavailable.
- [x] Make the Xcode SwiftLint phase delegate to the repository runner.
- [x] Remove hard-coded `/opt/homebrew` and `/usr/local` tool paths.
- [x] Split the Firestore error-mapper test type to resolve the 322/300 finding.
- [x] Split the 76/50 legacy-alias test body without production changes.
- [x] Reconcile the empty/stale SwiftLint baseline and commentary only after
  zero findings are demonstrated.
- [x] Run the direct runner and confirm zero findings with exit 0.
- [x] Document the one-time Apple Silicon Xcode `PATH` prerequisite without
  hard-coding Homebrew paths in the runner or project.
- [x] Verify `/usr/local/bin/swiftlint` resolves to the installed
  `/opt/homebrew/bin/swiftlint` and reports version 0.61.0.
- [x] Verify a build launched by the connected Xcode project completes with
  the SwiftLint phase enabled and zero errors.

## 3. Effective Swift-settings verifier

- [x] Add `scripts/verify-swift-settings.sh` with stable project-root
  resolution and actionable errors.
- [x] Check `Reguerta`, `ReguertaTests`, and `ReguertaUITests` in Debug and
  Release.
- [x] Assert `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated`.
- [x] Assert `SWIFT_VERSION = 6.0`.
- [x] Assert `SWIFT_STRICT_CONCURRENCY = complete`.
- [x] Assert `SWIFT_APPROACHABLE_CONCURRENCY = YES`.
- [x] Assert `IPHONEOS_DEPLOYMENT_TARGET = 26.0`.
- [x] Prove the verifier fails on controlled mismatched input without mutating
  project settings.

## 4. Commands, coverage, and documentation

- [x] Document one canonical command per test plan.
- [x] Require an exact iOS 26 simulator ID or a name plus OS version.
- [x] Add a result-bundle/coverage command based on `fast-unit-v1` without
  instrumenting release-gate performance tests.
- [x] Record the initial app/unit coverage trend with date, toolchain,
  destination, plan, scope, and values; do not add a threshold.
- [x] Align `AGENTS.md` and root README with `Reguerta` and current simulator
  fallback wording.
- [x] Align relevant English/Spanish stack docs.
- [x] Confirm no remote CI provider or workflow is introduced.

## 5. Executable gates and closure evidence

- [x] Validate all plan files and scheme references structurally.
- [x] Run strict SwiftLint.
- [x] Run the six-pair settings verifier.
- [x] Run fast unit on an explicit iOS 26 simulator and record counts.
- [x] Run UI smoke independently and record its four results.
- [x] Build Debug for a generic iOS Simulator.
- [x] Build Production Release for a generic iOS Simulator.
- [x] Run the release gate and record logical pass/skip/fail counts.
- [x] Extract and record the coverage trend from the result bundle.
- [x] Confirm `Package.resolved` is unchanged.
- [x] Run `git diff --check` and explicit scope review.
- [x] Complete independent iOS/testing/tooling review with no unresolved
  finding.
- [x] Update issue #250 with final local evidence while keeping it open until
  separately authorized delivery/integration.
- [x] Obtain separate authorization before commit or push: "ok, documentalo y
  commit y push".

## Explicit non-tasks

- [x] Do not choose or deploy a CI provider.
- [x] Do not migrate XCTest or add product journeys.
- [x] Do not touch Phase 3 runtime/Firebase ownership, composition, layout,
  DesignSystem, feature slices, Android, backend, or package pins.
- [x] Do not adopt iOS/Xcode 27-only APIs, settings, or rules.
