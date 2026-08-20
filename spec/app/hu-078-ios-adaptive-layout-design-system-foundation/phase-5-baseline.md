# HU-078 - Phase 5 baseline

## Purpose

This document freezes the reproducible pre-change state for Phase 5. Later
implementation evidence is appended; these initial counts are not rewritten to
look like the final tree.

## Authority and repository state

- Git base: `4b711833374e04e3a066676243b512aecb9f7194`
- Base branch: synchronized `main`, 0 ahead / 0 behind `origin/main`
- Working branch: `codex/hu-078-ios-adaptive-layout-design-system-foundation`
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/258
- Issue state: OPEN
- iOS profile: maintenance, iOS 26.0 minimum, Swift 6 strict concurrency
- Delivery: local bootstrap, implementation, and commits authorized; remote
  delivery not authorized

## Source and test inventory

| Area | Swift files | Lines |
| --- | ---: | ---: |
| iOS production | 261 | 36,243 |
| iOS unit tests | 112 | 27,365 |
| iOS UI tests | 2 | 384 |
| Total | 375 | 63,992 |

Test responsibilities at the inherited base:

- 602 Swift Testing `@Test` declarations.
- 6 XCTest unit methods.
- 608 fast-unit responsibilities.
- 9 XCTest UI methods.
- 617 release responsibilities before Phase 5 additions.

Inherited HU-077 closure on this exact base: fast unit 608/608, UI smoke 4/4,
release 617 logical responsibilities with 616 passed and the known launch skip,
SwiftLint 0/375, settings 6/6, generic Debug and Production Release green.
These are inherited evidence, not a substitute for HU-078 final gates.

## DesignSystem inventory

DesignSystem contains 19 Swift files and 1,872 lines:

- Button: view, passive ViewModel, contrast preview.
- Card: view and passive ViewModel.
- Dialog: view and passive ViewModel.
- Floating Action Button: view/layout.
- Inline Feedback: view and passive ViewModel.
- Input Field: view and passive ViewModel.
- List Item Card/action button.
- Screen Header: view and passive ViewModel.
- Screen Scaffold.
- Font registrar, theme/tokens, and button styles.

Six passive value types have `*ViewModel` names:

- `ReguertaButtonViewModel`
- `ReguertaCardViewModel`
- `ReguertaDialogViewModel`
- `ReguertaInlineFeedbackViewModel`
- `ReguertaInputFieldViewModel`
- `ReguertaScreenHeaderViewModel`

There are 12 `#Preview` declarations in 8 DesignSystem files. The five Header
previews do not use the shared DesignSystem preview modifier.

Existing direct DesignSystem test coverage is concentrated in color contrast
and root token injection. There is no dedicated adaptive-layout contract suite.

## Legacy layout inventory

`Core/Layout` contains 2 files and 137 lines:

- `DeviceScale.swift`: 99 lines.
- `ResizeExtensions.swift`: 38 lines.

The tree contains 303 `.resize*` occurrences in 35 files:

| API | Occurrences |
| --- | ---: |
| `.resize` | 286 |
| `.resizeBottomSize` | 14 |
| `.resizeStatusBarSize` | 3 |
| Total | 303 |

| Layer | Occurrences |
| --- | ---: |
| Core/Layout | 5 |
| DesignSystem | 62 |
| Presentation | 236 |

The exact `.resize*` file surface is:

### Core/Layout

- `Core/Layout/ResizeExtensions.swift`

### DesignSystem

- `DesignSystem/Components/ReguertaFloatingActionButton/ReguertaFloatingActionButtonView.swift`
- `DesignSystem/Components/ReguertaInputField/ReguertaInputFieldView.swift`
- `DesignSystem/Components/ReguertaListItemCard/ReguertaListItemCardView.swift`
- `DesignSystem/Components/ReguertaScreenHeader/ReguertaScreenHeaderView.swift`
- `DesignSystem/ReguertaTheme.swift`
- `DesignSystem/Styles/ReguertaButtonStyles.swift`

### Presentation

- `Presentation/Auth/ContentView+AuthForms.swift`
- `Presentation/Auth/ContentView+AuthOverlaysAndHandlers.swift`
- `Presentation/Auth/ContentView+AuthRoutes.swift`
- `Presentation/Home/ContentView+HomeDashboardCards.swift`
- `Presentation/Home/ContentView+HomeDashboardRoute.swift`
- `Presentation/Home/ContentView+HomeDrawerComponents.swift`
- `Presentation/Home/ContentView+HomeShellComponents.swift`
- `Presentation/Home/ContentView+HomeShellRoute.swift`
- `Presentation/Home/ContentView+HomeShellViewModel.swift`
- `Presentation/News/ContentView+NewsNotificationsRoutes.swift`
- `Presentation/Orders/ContentView+MyOrderRoute.swift`
- `Presentation/Orders/ContentView+MyOrderRouteBadges.swift`
- `Presentation/Orders/ContentView+MyOrderRouteOverlays.swift`
- `Presentation/Orders/ContentView+MyOrderRouteSections.swift`
- `Presentation/Orders/ContentView+MyOrdersHistoryRoute.swift`
- `Presentation/Orders/ContentView+OrderHistoryWeekComponents.swift`
- `Presentation/Orders/ContentView+ReceivedOrdersHistoryRoute.swift`
- `Presentation/Orders/ContentView+ReceivedOrdersRoute.swift`
- `Presentation/Orders/ContentView+ReceivedOrdersSummaryContent.swift`
- `Presentation/Orders/PersonalOrderSummaryCard.swift`
- `Presentation/Products/ContentView+ProductsRoute.swift`
- `Presentation/Products/ProductEditorView.swift`
- `Presentation/Root/GlobalFeedbackBanner.swift`
- `Presentation/Root/ReguertaImagePickerField.swift`
- `Presentation/Settings/ContentView+DeliveryCalendarSheets.swift`
- `Presentation/SharedProfile/ContentView+SharedProfileRoute.swift`
- `Presentation/Shifts/ContentView+ShiftsRouteComponents.swift`
- `Presentation/Users/ContentView+UsersRoute.swift`

The complete legacy surface is 37 unique files after adding:

- `Core/Layout/DeviceScale.swift`, which defines the static window-derived
  state and capture view; and
- `Presentation/Root/ContentView.swift`, which overlays
  `DeviceScaleCaptureView` at the app shell.

The exact symbol `DeviceScale` appears 9 times in 3 files. The capture view has
one definition and one root use. These definitions/usages and all 303
`.resize*` occurrences must reach zero.

## Adaptive, safe-area, and touch baseline

- `@ScaledMetric`: 0 occurrences.
- `ViewThatFits`: 2 occurrences, both in `ProductEditorView`.
- `safeAreaInset`: 2 occurrences, both in `ReguertaScreenScaffold`.
- Manual DesignSystem `EnvironmentKey`: 1, for token injection.
- Named coordinate-space implementation: 1, in `ReguertaDialogView`.
- A static search finds a 38-by-38 Dialog close control candidate and several
  24/36-point visible glyph/frame candidates. Visible glyph size alone is not a
  hit-target failure; Phase 5 must characterize the effective tappable region.
- `ReguertaListActionIconButton` defaults to `44.resize`, which can become less
  than 44 points on a compact width and therefore does not prove the required
  minimum.
- `ReguertaScreenScaffold` already establishes the accepted top/bottom inset
  direction from ADR-0005.

## Motion and timing baseline

- 32 source lines contain animation, transition, or `withAnimation` usage in
  the audited UI surface.
- `accessibilityReduceMotion`: 0 reads.
- Four `Task.sleep(nanoseconds:)` sites remain in Presentation:
  News/Notifications, Products, Users, and the startup-gate animation.
- Other newer paths already use `ContinuousClock` or duration-based sleep.
- No Phase 5 motion classification or root policy exists yet.

## Localization and accessibility baseline

Four feature action labels are hardcoded Spanish strings:

- Products: `Editar producto`.
- Products: `Archivar producto`.
- Users: `Editar Regüertense`.
- Users: `Desactivar Regüertense`.

`ReguertaInputFieldView` applies `.textCase(.uppercase)` to a localized label.
The story must determine whether this remains semantically correct in Spanish
and English or should become a visual style that does not transform accessible
content.

The shared Input Field clear action already uses a localization key. VoiceOver
validation is not currently a declared executable matrix for all shared
components.

## Color and typography baseline

The color catalog check passes on the inherited tree:

- 12 semantic color tokens.
- 11 validated pairs.
- 4 visual modes.

Existing custom fonts use `relativeTo:` text styles but their point sizes are
also derived through `.resize`, creating possible double scaling. Phase 5 must
remove the width-derived font multiplier without changing the font family or
semantic text roles.

## Reproducible commands

Run from the repository root unless noted:

```sh
for area in Reguerta ReguertaTests ReguertaUITests; do
  root="ios/Reguerta/$area"
  files=$(rg --files "$root" -g '*.swift' | wc -l | tr -d ' ')
  lines=$(rg --files "$root" -g '*.swift' -0 | xargs -0 wc -l |
    tail -n 1 | awk '{ print $1 }')
  printf '%s %s %s\n' "$area" "$files" "$lines"
done

rg -o '\.resize(?:BottomSize|StatusBarSize)?\b' \
  ios/Reguerta/Reguerta -g '*.swift' | wc -l

rg -l '\.resize(?:BottomSize|StatusBarSize)?\b' \
  ios/Reguerta/Reguerta -g '*.swift' | wc -l

rg -n '\bDeviceScale\b|\bDeviceScaleCaptureView\b' \
  ios/Reguerta/Reguerta -g '*.swift'

rg -n '^struct Reguerta.*ViewModel\b' \
  ios/Reguerta/Reguerta/DesignSystem -g '*.swift'

rg -n '#Preview' ios/Reguerta/Reguerta/DesignSystem -g '*.swift'

rg -n 'accessibilityLabel: "' \
  ios/Reguerta/Reguerta/Presentation -g '*.swift'

rg -n 'Task\.sleep\(nanoseconds:' \
  ios/Reguerta/Reguerta/Presentation -g '*.swift'

python3 scripts/design-system/generate_color_catalog.py --check
```

Additional commands reproduce the secondary inventories used by this story:

```sh
rg --files ios/Reguerta/Reguerta/DesignSystem -g '*.swift' -0 |
  xargs -0 wc -l

rg --files ios/Reguerta/Reguerta/Core/Layout -g '*.swift' -0 |
  xargs -0 wc -l

rg -n '@Test\b' ios/Reguerta/ReguertaTests -g '*.swift' | wc -l

rg -l -0 '^import XCTest$' ios/Reguerta/ReguertaTests -g '*.swift' |
  xargs -0 rg -n '^\s*(?:@MainActor\s+)?func test[A-Za-z0-9_]*\(' |
  wc -l

rg -l -0 '^import XCTest$' ios/Reguerta/ReguertaUITests -g '*.swift' |
  xargs -0 rg -n '^\s*(?:@MainActor\s+)?func test[A-Za-z0-9_]*\(' |
  wc -l

for api in resize resizeBottomSize resizeStatusBarSize; do
  printf '%s ' "$api"
  rg -o "\\.${api}\\b" ios/Reguerta/Reguerta -g '*.swift' | wc -l
done

for layer in Core/Layout DesignSystem Presentation; do
  printf '%s ' "$layer"
  rg -o '\.resize(?:BottomSize|StatusBarSize)?\b' \
    "ios/Reguerta/Reguerta/$layer" -g '*.swift' | wc -l
done

(
  rg -l '\.resize(?:BottomSize|StatusBarSize)?\b' \
    ios/Reguerta/Reguerta -g '*.swift'
  rg -l '\bDeviceScale\b|\bDeviceScaleCaptureView\b' \
    ios/Reguerta/Reguerta -g '*.swift'
) | sort -u | wc -l

rg -n '\.animation\b|\bwithAnimation\b|\.transition\b' \
  ios/Reguerta/Reguerta/DesignSystem \
  ios/Reguerta/Reguerta/Presentation -g '*.swift' | wc -l

comm -23 \
  <(rg -l '^\s*(?:(?:private|fileprivate|internal|public|package)\s+)?struct\s+\w+(?:<[^\n{]+>)?\s*:\s*View\b' \
    ios/Reguerta/Reguerta/DesignSystem -g '*.swift' | sort) \
  <(rg -l '#Preview' ios/Reguerta/Reguerta/DesignSystem -g '*.swift' | sort)
```

## Activated device and UI matrix

- Canonical functional simulator: iPhone 17 / iOS 26.5.
- Compact simulator: iPhone SE (3rd generation) / iOS 26.5.
- iPad simulator: iPad Air 11-inch (M4) / iOS 26.5.
- Narrow multitasking/multiwindow fixture: 600-point fixed container.
- Dynamic Type: Large, XXX Large, AX5.
- Appearance/locale: ES-light and EN-dark per affected family; Increased
  Contrast for semantic controls.
- Accessibility: runtime VoiceOver/Inspector for Header, drawer, clear/password,
  list actions, FAB, Dialog, and touched route actions.
- Motion: Reduce Motion on/off with essential state transitions preserved.
- States: loading, empty, error, content, disabled, long text, and action
  variants when applicable.

## Initial exceptions and residual policy

There is no approved residual exception. `@ScaledMetric` has no target count
because it is an optional semantic tool, not a migration goal. Every remaining
legacy scaling reference, sub-44 hit target, or unvalidated matrix surface keeps
HU-078 open and must name an owner, rationale, focused evidence, removal
condition, and explicit approval before it can be treated as an exception.

## Implementation snapshot (2026-08-20)

The initial evidence above remains the immutable pre-change baseline. The
current local tree has the following implementation inventory:

| Area | Swift files | Lines | Delta from baseline |
| --- | ---: | ---: | ---: |
| iOS production | 267 | 39,202 | +6 files / +2,959 lines |
| iOS unit tests | 122 | 29,191 | +10 files / +1,826 lines |
| iOS UI tests | 2 | 423 | +39 lines |
| Total | 391 | 68,816 | +16 files / +4,824 lines |

The test inventory is now 662 Swift Testing `@Test` declarations, 6 XCTest unit
methods, and 9 XCTest UI methods: 668 fast-unit responsibilities and 677 release
responsibilities.

DesignSystem remains at 19 Swift files and now contains 2,444 lines and 30
deterministic previews. `Presentation/Preview` adds 6 Swift files, 1,998 lines,
and 26 deterministic community/operations route previews.

## Completed implementation delta

- All 303 `.resize*` uses, the complete 37-file legacy surface, `DeviceScale`,
  `DeviceScaleCaptureView`, and the resize extensions are zero.
- The six passive DesignSystem `*ViewModel` values are now Configuration values.
- Semantic spacing, radius, icon, layout, readable-width, minimum-touch-target,
  typography, and motion contracts are centralized in DesignSystem.
- The root reads the native Reduce Motion preference once and propagates a
  `ReguertaMotionPolicy`; material motion is suppressible without hiding
  essential state changes.
- Seven `@ScaledMetric` uses remain intentionally limited to meaningful
  non-text metrics. Typography uses Dynamic Type relative styles without a
  width-derived multiplier.
- The four literal Products/Users accessibility actions are localized and the
  Input Field no longer uppercases localized label content.
- The four direct `Task.sleep(nanoseconds:)` sites use the characterized Clock
  boundary with cancellation preserved.
- Android, Functions, packages, Xcode project settings, backend, deployment, and
  iOS/Xcode 27 remain outside the diff.

## Validation chronology

Development retained the failures that drove each correction instead of
presenting only the final green state:

- the first foundation run failed because semantic tokens and legacy-zero
  contracts did not yet exist;
- early preview runs exposed a token-injection fatal error, visual defects, and
  clipping caused by inappropriate fixed preview layout;
- focal compile failures exposed incomplete migration boundaries;
- the initial compact command selected zero tests, after which exact XCTest
  identifiers were used;
- compact journeys then exposed keyboard interception, a drawer gesture overlay
  that blocked the menu, and a `LazyVStack` count assertion that did not account
  for virtualization;
- the preview composition-boundary run exposed a Presentation preview depending
  on a concrete Data error type;
- the first full release attempt failed to compile because a preview helper was
  hidden by `#if DEBUG` while release-plan tests still needed the boundary. The
  helper boundary was corrected and the complete release gate was rerun.

The final executable evidence is:

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused adaptive suites | 72/72 logical responsibilities; 147 device/configuration executions; 0 failed/skipped | `/private/tmp/hu078-final-focused-5.xcresult` |
| Compact safe-area UI | 3/3 on iPhone SE (3rd generation), iOS 26.5 | `/private/tmp/hu078-final-compact-ui-9.xcresult` |
| Fast unit | 668/668 logical responsibilities; 812 executions; 0 failed/skipped | Canonical `fast-unit` runner result |
| UI smoke | 4/4 on iPhone 17, iOS 26.5 | Canonical `ui-smoke` runner result |
| Release gate | 677 total; 676 passed; 1 inherited launch-matrix skip; 0 failed. Device/configuration executions: 820 passed and 4 skipped | `/private/tmp/hu078-final-release-gate-2.xcresult` |
| SwiftLint | SwiftLint 0.61.0; 391 files; 0 findings | Repository strict/no-cache runner |
| Effective Swift settings | 6/6 target/configuration pairs | Repository settings verifier |
| Builds | Generic Debug and `Reguerta-Production` Production Release passed | Release gate |
| Color catalog | 12 tokens, 11 pairs, 4 modes | Generator check passed |
| Static/scope | `git diff --check` clean; scoped platform/package audit passed | Final local audit |
| Independent reviews | 0 unresolved P0-P3 iOS or SwiftUI/accessibility findings | Final independent reviews |

Representative successful RenderPreview artifacts are:

- Shifts compact, AX5, Increased Contrast:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-19T235112Z@3x.png`
- Delivery Calendar compact, AX5:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-19T235140Z@3x.png`
- Community Products, iPad, AX5:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-19T234632Z@3x.png`
- DesignSystem Input, AX5:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-19T235344Z@3x.png`

## Manual accessibility acceptance

Deterministic previews, structural tests, Increased Contrast, Dynamic Type, and
compact runtime journeys remain the automated evidence. On 2026-08-20 the
maintainer supplemented them with representative manual MVP acceptance:

- VoiceOver and Voice Control navigation and actions behaved correctly on the
  sampled controls and journeys;
- sampled controls inspected with Accessibility Inspector exposed no issue; and
- an interactive Reduce Motion off/on comparison removed material animations
  while preserving the observed states and actions.

This closes the manual HU-078 gate as bounded MVP evidence. It does not claim an
exhaustive certification of every route, control, assistive technology, or
future accessibility refinement. Issue #258 remains open only until authorized
delivery is definitive.
