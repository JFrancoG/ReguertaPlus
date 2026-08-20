# [HU-078] Establish adaptive iOS layout and DesignSystem foundation

## Summary

Replace window-global iOS scaling with semantic, container-aware layout
contracts; guarantee accessible touch targets; and validate the shared
DesignSystem across the Phase 5 device, Dynamic Type, appearance, locale,
VoiceOver, contrast, and motion matrix.

## Authorization and status

The maintainer activated Phase 5 on 2026-08-19 with the instruction:
"ok, adelante con la siguiente fase, abre issue etc".

The instruction authorizes issue, branch, planning artifacts, tests, and
in-scope implementation. On 2026-08-20 the maintainer additionally authorized
committing and pushing HU-078 and two existing Android dependency-catalog
updates. On 2026-08-21 the maintainer authorized a ready PR, merge, issue
closure, branch deletion, and local integration. Firebase/backend deployment is
outside this story and explicitly not applicable.

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/258
- Branch: `codex/hu-078-ios-adaptive-layout-design-system-foundation`
- Base: synchronized `main` at `4b711833`.
- State: open / ready for merge.
- Profile: iOS maintenance.

## Links

- Spec: `spec/app/hu-078-ios-adaptive-layout-design-system-foundation/spec.md`
- Plan: `spec/app/hu-078-ios-adaptive-layout-design-system-foundation/plan.md`
- Tasks: `spec/app/hu-078-ios-adaptive-layout-design-system-foundation/tasks.md`
- Baseline: `spec/app/hu-078-ios-adaptive-layout-design-system-foundation/phase-5-baseline.md`
- ADR-0005: safe-area scaffold for iOS SwiftUI Home routes.
- Roadmap: HU-074 Phase 5.

## Dependencies

- #249 / HU-074: completed and integrated.
- #250 / HU-075: completed and integrated.
- #251 / HU-076: completed and integrated.
- #255 / HU-077: completed and integrated.

## Initial evidence

- iOS: 375 Swift files / 63,992 lines; production 261/36,243, unit
  112/27,365, UI 2/384.
- DesignSystem: 19 Swift files / 1,872 lines.
- Legacy layout core: 2 files / 137 lines.
- 303 `.resize*` occurrences in 35 files: 286 resize, 14 bottom, 3 status.
- Complete legacy surface: 37 files after `DeviceScale.swift` and the root
  capture-view consumer are included.
- Outside Core/Layout: 298 resize uses across 34 files, led by Orders (115),
  DesignSystem (62), Home (33), and Products (28).
- Six passive DesignSystem `*ViewModel` structs / 499 lines.
- DesignSystem has 12 previews in 8 files; List Item Card, Screen Scaffold, and
  Theme have no preview; five Header previews omit the shared modifier.
- Zero `@ScaledMetric` and zero Reduce Motion reads.
- Four literal Spanish VoiceOver feature labels and one uppercase transformation
  of localized input text.
- Four `Task.sleep(nanoseconds:)` Presentation sites in the direct Phase 5 cut;
  one manual DesignSystem EnvironmentKey and one Dialog named coordinate space.
- Inherited color catalog passes: 12 tokens, 11 pairs, 4 modes.

## Current implementation evidence (2026-08-21)

- iOS: 391 Swift files / 68,859 lines; production 267/39,208, unit
  122/29,228, UI 2/423.
- Test inventory: 663 Swift Testing declarations, 6 XCTest unit methods, and 9
  UI methods; 669 fast-unit and 678 release responsibilities.
- DesignSystem: 19 files / 2,444 lines / 30 previews. Presentation preview
  support: 6 files / 1,998 lines / 26 previews.
- Zero `.resize*`, `DeviceScale`, capture-view, resize-extension, passive
  DesignSystem `*ViewModel`, and direct audited `Task.sleep(nanoseconds:)`
  residuals.
- Focused adaptive evidence: 72 logical responsibilities / 147 executions / 0
  failed or skipped.
- Compact iPhone SE evidence: 3/3.
- Fast unit: `/private/tmp/hu078-closeout-fast-unit.xcresult`, 669/669 logical
  responsibilities / 813 executions / 0 failed or skipped.
- UI smoke: 4/4.
- Release:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/reguerta-release-gate.H9yckSBteo/release-gate-v1.xcresult`,
  678 total, 677 passed, 1 inherited launch-matrix skip, 0 failed; 821
  device/configuration executions passed and 4 skipped.
- SwiftLint 0.61.0: 0 findings across 391 files. Effective settings: 6/6.
  Generic Debug and Production Release builds passed.
- Color catalog: 12 tokens / 11 pairs / 4 modes. Diff and scope audits passed.
- Independent iOS and SwiftUI/accessibility reviews: 0 unresolved P0-P3.

The first full release attempt failed to compile because a preview helper was
limited by `#if DEBUG` while release-plan tests still compiled its boundary. The
boundary was corrected before the complete green release rerun above. The
baseline retains this and the earlier foundation, preview, focal, compact,
gesture, virtualization, and composition-boundary RED evidence.

Representative manual MVP acceptance completed on 2026-08-20. VoiceOver and
Voice Control navigation/actions behaved correctly, sampled controls exposed no
issue in Accessibility Inspector, and Reduce Motion off/on removed material
animation while preserving the observed states and actions. This is bounded
manual evidence, not exhaustive assistive-technology certification. HU-078 is
ready for merge and remains open until authorized delivery is definitive.

The final post-review UI remediation restored shared horizontal screen insets,
Home table/action surfaces, centered dialogs with accessible scrolling, and
denser drawer rows while retaining 44-point targets. Commit `7c5d036` and the
final gates above cover those changes.

## Scope

### In scope

- Semantic spacing, radius, icon, layout, readable-width, touch-target, and
  motion tokens.
- Full incremental removal of DeviceScale/capture/resize APIs.
- Container-aware layout and ADR-0005 safe-area ownership.
- Minimum 44-by-44-point hit regions at compact phone width.
- Shared component and affected-route validation on phone, iPad,
  multitasking/multiwindow, Large, XXX Large, AX5, light/dark, ES/EN,
  Increased Contrast, VoiceOver, and Reduce Motion.
- Passive DesignSystem value renames when touched; independent InputField
  configuration cut.
- Deterministic loading/empty/error/content/disabled/long-text previews.
- Localization of the four identified VoiceOver labels and uppercase audit.
- Root motion policy and behavior-preserving mechanical modernization of the
  named closures, EnvironmentKey, sleeps, builders, and Dialog coordinate space.
- EN/ES DesignSystem documentation and additive ADR-0005 status only if needed.

### Out of scope

- Phase 6 feature redesigns or product/state/navigation changes.
- Domain, Data, Firebase, backend, live data, or deployment.
- Brand/color/font-family redesign.
- Android code, packages, Functions, test migration, CI-provider work, and
  iOS/Xcode 27.
- General Phase 8 one-View-per-file cleanup.
- Delivery/integration without a later instruction.

## Acceptance criteria

- [x] Semantic layout/touch/motion tokens and invariants are tested.
- [x] `DeviceScale`, capture view, resize extensions, and all `.resize*` uses
  are zero.
- [x] Layout is container-aware and safe-area ownership matches ADR-0005.
- [x] Migrated interactive controls expose at least 44-by-44-point hit regions
  on iPhone SE / iOS 26.5.
- [x] Text uses Dynamic Type relative styles without width-derived scaling.
- [x] Shared components and routes pass the declared automated matrix and the
  bounded manual VoiceOver/Inspector/Reduce Motion MVP acceptance.
- [x] All six passive DesignSystem value APIs use Configuration/Model naming;
  InputField remains a separately characterized cut.
- [x] Four hardcoded feature VoiceOver labels are localized and uppercase input
  behavior is resolved.
- [x] Reduce Motion policy is explicit and essential state transitions remain
  visible.
- [x] Applicable deterministic state/long-text previews exist.
- [x] Mechanical modernization preserves cancellation and interaction behavior.
- [x] Color catalog remains green without unintended palette change.
- [x] Focused, fast unit, compact UI, UI smoke, release, lint, settings, builds,
  diff, and scope gates pass with exact evidence.
- [x] Independent iOS and SwiftUI/accessibility reviews report zero unresolved
  P0-P3.
- [x] Android, Functions, packages, project settings, backend, deployment, and
  iOS/Xcode 27 remain outside scope.

## Activated validation

- Primary: iPhone 17 / iOS 26.5.
- Compact: iPhone SE (3rd generation) / iOS 26.5.
- iPad: iPad Air 11-inch (M4) / iOS 26.5.
- Split/multiwindow: deterministic 600-point container fixture.
- Unit plan: `fast-unit-v1`; UI plan: `ui-smoke-v1`; release plan:
  `release-gate-v1` through repository runners.
- Focused unit suites: `ReguertaAdaptiveLayoutContractTests`,
  `AppShellDependencyBoundaryTests`, `ReguertaColorContrastTests`,
  `ReguertaHomeNavigationTests`, `ReguertaDesignSystemAdaptiveMetricsTests`,
  `ReguertaDesignSystemPreviewMatrixTests`, `RootAuthHomeAdaptiveLayoutTests`,
  `HU078AdaptiveFeatureLayoutTests`, `ReguertaOrdersAdaptiveLayoutTests`,
  `SettingsShiftsAdaptiveLayoutTests`, `AdaptiveCommunityRoutesPreviewTests`,
  `AdaptiveOperationsRoutesPreviewTests`, and `PresentationDelayClockTests`.
- Compact UI: latest-news obstruction, My Order search safe area, and Users add
  button safe area; 3/3 required.
- Existing UI smoke remains 4/4.
- Exact commands and required results live in `spec.md`.

## Current plan

1. [x] Create issue, branch, spec, plan, tasks, and reproducible baseline.
2. [x] Complete independent bootstrap reconciliation.
3. [x] Add RED-first adaptive foundation characterization.
4. [x] Define semantic tokens and migrate shared DesignSystem components.
5. [x] Migrate Root/Auth/Home and introduce Reduce Motion policy.
6. [x] Migrate feature cohorts route by route.
7. [x] Remove the global legacy layout only after all consumers reach zero.
8. [x] Complete representative manual VoiceOver/Inspector and interactive
   Reduce Motion checks; all repository and deterministic matrix gates are
   green.
9. [x] Synchronize remote progress/closure evidence after the manual checks;
   independent reviews and local documentation are complete.

## Delivery state

Issue #258 is OPEN with `enhancement`, `platform:ios`, `priority:P1`, and
`area:app`. The branch is published and synchronized. Commits and push are
complete; the maintainer authorized the ready PR, merge, issue closure, branch
deletion, and local integration on 2026-08-21. This mirror is the final pre-PR
checkpoint. Firebase/backend deployment is outside scope and not applicable.

## Labels

- `enhancement`
- `platform:ios`
- `priority:P1`
- `area:app`
