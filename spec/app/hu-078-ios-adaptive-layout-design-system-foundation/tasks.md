# HU-078 - Tasks

## 1. Bootstrap and authorization

- [x] Confirm HU-078 is the next unused story identifier locally and remotely.
- [x] Confirm no duplicate issue, PR, branch, or spec covers Phase 5.
- [x] Start from clean, synchronized `main` at `4b711833`.
- [x] Create `codex/hu-078-ios-adaptive-layout-design-system-foundation`.
- [x] Create GitHub issue #258 with the standard iOS/App P1 labels.
- [x] Record the maintainer's implementation authorization and delivery limits.
- [x] Create spec, plan, tasks, Phase 5 baseline, and issue mirror.
- [x] Complete independent bootstrap reconciliation before production edits.

## 2. Baseline and characterization

- [x] Record total iOS source/test file and line counts.
- [x] Record DesignSystem and Core/Layout files/lines.
- [x] Count `.resize`, `.resizeBottomSize`, and `.resizeStatusBarSize` by layer.
- [x] Inventory `DeviceScale`, capture view, and all 37 legacy-surface files.
- [x] Inventory passive DesignSystem `*ViewModel` values.
- [x] Inventory previews, animation/motion, accessibility literals,
  EnvironmentKey, Clock/sleep, coordinate-space, and adaptive API baseline.
- [x] Verify the inherited color-catalog contract.
- [x] Add `ReguertaAdaptiveLayoutContractTests` before foundation production
  changes.
- [x] Capture honest RED evidence for missing contracts and retained legacy APIs.

## 3. Semantic foundation

- [x] Add semantic spacing tokens.
- [x] Add semantic radius tokens.
- [x] Add semantic icon/control-size tokens.
- [x] Add layout/readable-width tokens.
- [x] Add a 44-point minimum touch-target contract.
- [x] Add root motion policy and Reduce Motion propagation.
- [x] Preserve semantic colors and custom Dynamic Type typography.
- [x] Replace the manual DesignSystem EnvironmentKey if fail-fast injection is
  preserved.
- [x] Add focused token/motion tests and deterministic fixtures.

## 4. Shared components

- [x] Migrate Button and button styles; rename passive ViewModel value.
- [x] Migrate Card and Inline Feedback; rename passive ViewModel values.
- [x] Migrate Header/actions/badges; rename passive ViewModel value.
- [x] Migrate ListItem/action buttons and Floating Action Button.
- [x] Migrate Dialog; rename passive ViewModel value and preserve gestures.
- [x] Migrate Screen Scaffold under ADR-0005.
- [x] Characterize and migrate Input Field in its own cut; rename configuration.
- [x] Prove minimum 44-by-44 hit regions for shared interactive controls.
- [x] Add relevant disabled/loading/long-text/action previews.
- [x] Complete the shared-component runtime VoiceOver and interactive Reduce
  Motion matrix; deterministic visual/accessibility coverage is green.

## 5. Root, Auth, Home, and motion

- [x] Migrate Auth spacing/sizing without behavior changes.
- [x] Migrate root/startup/feedback surfaces.
- [x] Migrate Home shell and drawer to container-aware widths.
- [x] Replace scaled drawer/swipe thresholds with semantic interaction metrics.
- [x] Preserve dashboard/drawer/overlay/splash transitions.
- [x] Classify existing animations as essential, material, or non-essential.
- [x] Apply Reduce Motion without hiding state changes.
- [x] Close the remaining runtime VoiceOver and interactive Reduce Motion matrix
  for this cluster; compact/iPad/Dynamic Type/locale coverage is green.

## 6. Route migrations

- [x] Products cluster: inventory, characterize, migrate, and close zero search.
- [x] Users cluster: inventory, characterize, migrate, localize labels, and
  close zero search.
- [x] Shared Profile cluster: inventory, characterize, migrate, close automated matrix.
- [x] My Order and history cluster: preserve search/cart/bottom-bar safe area.
- [x] Received Orders and history cluster: preserve summaries/status/bottom bars.
- [x] Shifts/Planning/Calendar cluster: preserve cards, thresholds, and dialogs.
- [x] Settings sheets cluster: preserve presentation and action reachability.
- [x] News/Notifications cluster: preserve loading/error/content and images.
- [x] Sweep remaining Presentation consumers and document zero residuals.

## 7. Accessibility, localization, and previews

- [x] Replace Products edit/archive literal VoiceOver labels with localized keys.
- [x] Replace Users edit/deactivate literal VoiceOver labels with localized keys.
- [x] Audit and resolve uppercase transformation of localized input labels.
- [x] Validate representative VoiceOver order, labels, actions, and focus on
  named controls for bounded MVP acceptance.
- [x] Validate Increased Contrast for semantic control pairs.
- [x] Validate Large, XXX Large, and AX5 for every affected shared family.
- [x] Validate ES-light and EN-dark for every affected shared family.
- [x] Validate iPhone SE, iPhone 17, iPad Air 11, and 600-point split window.
- [x] Add deterministic loading/empty/error/content previews as applicable.
- [x] Record exact RenderPreview/runtime results and tool limitations; complete
  representative VoiceOver, Voice Control, Accessibility Inspector, and
  interactive Reduce Motion manual acceptance.

## 8. Mechanical modernization

- [x] Replace the four direct `Task.sleep(nanoseconds:)` uses with Clock-based
  contracts while preserving cancellation semantics.
- [x] Modernize stored content closures only in touched components.
- [x] Remove redundant builders only in isolated mechanical diffs.
- [x] Audit the Dialog named coordinate-space implementation and retain its
  characterized shared local-space gesture contract; no inequivalent replacement
  was introduced.
- [x] Audit touched structs for synthesized memberwise construction and inferred
  Sendable.
- [x] Audit touched Swift declarations against the 120-column formatting rules.

## 9. Legacy removal and static closure

- [x] Reach zero `.resize` occurrences.
- [x] Reach zero `.resizeBottomSize` occurrences.
- [x] Reach zero `.resizeStatusBarSize` occurrences.
- [x] Reach zero `DeviceScale` and `DeviceScaleCaptureView` references.
- [x] Remove `DeviceScale.swift`.
- [x] Remove `ResizeExtensions.swift`.
- [x] Remove the root capture overlay.
- [x] Confirm zero global window-derived layout state.
- [x] Re-run the color catalog; record intentional/no palette delta.
- [x] Confirm Android, Functions, packages, project settings, and iOS/Xcode 27
  remain outside scope.

## 10. Executable validation

- [x] Focused adaptive unit command passes: 72 logical / 147 executions.
- [x] Focused compact UI command passes 3/3 on iPhone SE / iOS 26.5.
- [x] Fast-unit lane passes: 669/669 logical / 813 executions / 0 skipped.
- [x] UI-smoke lane passes 4/4.
- [x] Release gate passes: 678 total / 677 passed / 1 known skip / 0 failed;
  821 device/configuration executions passed and 4 skipped.
- [x] SwiftLint 0.61.0 strict/no-cache passes across 391 files with zero findings.
- [x] Effective Swift settings pass 6/6.
- [x] Generic Debug build passes.
- [x] `Reguerta-Production` Production Release build passes.
- [x] `git diff --check` and scope/package/platform audits pass.

## 11. Review and documentation

- [x] Independent iOS architecture/concurrency review reports zero P0-P3.
- [x] Independent SwiftUI/accessibility review reports zero P0-P3.
- [x] Recalculate final files/lines/tests and every legacy-debt count.
- [x] Record initial-to-final delta and the completed bounded manual
  accessibility acceptance.
- [x] Update `docs/design-system/foundations.md` and its `docs-es` counterpart.
- [x] Update `docs/design-system/components.md` and its `docs-es` counterpart.
- [x] Add implementation addenda to
  `docs/decisions/0005-ios-swiftui-safe-area-screen-scaffold.md` and its
  `docs-es` counterpart.
- [x] Synchronize spec, plan, tasks, baseline, and local issue mirror.
- [x] Synchronize the current non-closing progress body with remote issue #258.
- [x] Prepare final remote closure evidence after the completed manual
  accessibility checks for the authorized delivery.
- [x] Record the Android no-code parity gap and follow-up requirement.

## 12. Delivery gates

- [x] Commit authorized.
- [x] Push authorized.
- [x] Ready PR authorized.
- [x] Merge authorized.
- [x] Issue closure authorized.
- [x] Branch deletion/integration authorized.
- [x] Firebase/backend deployment explicitly not applicable.

Current delivery state: commits and branch publication are complete. The
maintainer authorized the ready PR, merge, issue closure, branch deletion, and
local integration on 2026-08-21. This is the final pre-PR checkpoint; remote PR
and merge identifiers remain GitHub delivery evidence rather than speculative
values in this commit.
