# [HU-075] Define reproducible iOS validation lanes

## Summary

Version the iOS fast-unit, UI-smoke, and release-gate contracts and make their
commands, SwiftLint policy, effective Swift settings, and coverage trend
reproducible without interactive Xcode state or hard-coded Homebrew paths.

## Authorization and dependency

The maintainer activated this Phase 2 story on 2026-08-19 with the verbatim
instruction: "haz commit y push, y cerramos fase 1 y empezamos fase 2".

The maintainer later authorized the SwiftLint host documentation, commit, and
push with the verbatim instruction: "ok, documentalo y commit y push". Pull
request, merge, issue closure, branch deletion, and integration remain outside
that authorization.

- Depends on #249.
- Branch: `codex/hu-075-ios-reproducible-validation-lanes`.
- Stacked base: published HU-074 tip `9018ae6`.
- A future PR must wait for #249 integration or temporarily target the HU-074
  branch and later be retargeted/rebased to `main`.

## Links

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/250
- Spec: `spec/app/hu-075-ios-reproducible-validation-lanes/spec.md`
- Plan: `spec/app/hu-075-ios-reproducible-validation-lanes/plan.md`
- Tasks: `spec/app/hu-075-ios-reproducible-validation-lanes/tasks.md`
- Baseline: `spec/app/hu-075-ios-reproducible-validation-lanes/phase-2-baseline.md`

## Scope

### In scope

- Shared `fast-unit-v1`, `ui-smoke-v1`, and `release-gate-v1` test plans.
- `Reguerta` as the canonical repository validation scheme.
- One explicit iOS 26 command per lane.
- Four existing mock-backed UI smoke journeys; complete UI/performance
  ownership retained in release gate.
- Strict SwiftLint runner with no Homebrew prefix in project files, plus Xcode
  phase delegation and documented host setup.
- Test-only structural resolution of the two current lint findings.
- Effective Swift-setting verification for three targets and two
  configurations.
- Coverage recorded as a trend without a threshold.
- Aligned repository and English/Spanish stack documentation.

### Out of scope

- Remote CI provider selection or rollout.
- XCTest migration or new product journeys.
- Firebase/environment ownership, composition, layout, DesignSystem, or
  feature-slice work.
- Package/Firebase upgrades, backend, or Android.
- iOS/Xcode 27-only APIs, settings, or rules.
- Delivery or integration without later authorization.

## Acceptance criteria

- [x] Three versioned plans are shared and independently invocable.
- [x] Fast unit selects 488 unit tests and no UI tests.
- [x] UI smoke selects and passes exactly four named UI tests.
- [x] Release gate preserves all 488 unit and 9 UI responsibilities and
  records logical pass/skip/fail counts on iOS 26.
- [x] `Reguerta` is canonical and Develop/Production retain coherent roles.
- [x] SwiftLint strict/no-cache returns zero findings, resolves through `PATH`,
  and fails when unavailable.
- [x] The Apple Silicon Xcode prerequisite is documented and the verified
  `/usr/local/bin/swiftlint` link reports the pinned version.
- [x] The settings verifier passes all six target/configuration pairs.
- [x] Coverage baseline records date/toolchain/destination/plan/scope without a
  percentage threshold.
- [x] Debug and Production Release generic builds pass.
- [x] Documentation, package pins, `git diff --check`, and independent review
  are clean.
- [x] Android impact is none and iOS/Xcode 27 remains excluded.

## Initial evidence

- Xcode 26.6 / Swift 6.3.3 / SwiftLint 0.61.0.
- Three targets, two configurations, and three shared schemes.
- Zero versioned test plans; every scheme autocreates one with both targets.
- 497 enabled logical tests: 488 unit and 9 UI.
- Two strict-lint findings, both test-only.
- No effective-settings runner, coverage contract, or first-party CI workflow.

## Labels

- `enhancement`
- `area:app`
- `platform:ios`
- `priority:P1`

## Current gate

HU-075 is implemented and validated on the stacked local branch. The three
plans are discoverable with exact 488/4/497 inventories; fast unit passes
488/488, UI smoke passes 4/4, strict SwiftLint has zero findings, all six
settings pairs pass, and the initial app coverage trend is 37.20% without a
threshold. The composite release gate completed both generic builds and
reported 497 logical tests: 496 passed, 1 known skip, and 0 failed. Independent
review has no unresolved P0-P3. Xcode also builds with the SwiftLint phase
enabled after the documented Apple Silicon host setup. Commit and push are
authorized; issue #250 remains open, and pull request, merge, issue closure,
branch deletion, and integration remain unauthorized.
