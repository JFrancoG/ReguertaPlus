# Foundations

This document defines the canonical design-system foundation model for Reguerta.

## 1. Token Layers

- `core`: raw primitive values (hex, numeric scales, radii, spacing).
- `semantic`: intent names used by UI (`surface-primary`, `text-primary`, `action-primary`).
- `component`: per-component aliases (`button-primary-container`, `input-border-focus`).

Rule: feature code should depend on semantic or component tokens, never on raw values.

## 2. Naming Policy

Preferred pattern:

- Colors: `<category>-<intent>-<state>`
- Typography: `<role>-<size>`
- Spacing: `space-<scale>`
- Radius: `radius-<scale>`
- Elevation: `elevation-<level>`

Examples:

- `color-surface-primary-default`
- `color-text-primary-default`
- `space-md`
- `radius-lg`
- `elevation-2`

Avoid encoding hex values in token names for new tokens.

## 3. Legacy-to-Canonical Mapping

- Android `ColorActionPrimaryDefaultLight|Dark` / iOS `AccentColor` and `actionPrimary` -> `color-action-primary-default`
- Android `onPrimary` / iOS `actionOnPrimary` -> `color-action-on-primary-default`
- iOS `controlAccent` -> `color-control-accent-default`
- Android `mainBackLight|Dark` / iOS `mainBackF2F8E10F1D0D` -> `color-surface-primary-default`
- Android `secondBackLight|Dark` / iOS `secBackDDE5C01A2B1B` -> `color-surface-secondary-default`
- Android `ColorFeedbackErrorDefaultLight|Dark` / iOS `error` -> `color-feedback-error-default`
- Android `onError` / iOS `feedbackOnError` -> `color-feedback-on-error-default`
- Android `ColorFeedbackWarningDefaultLight|Dark` / iOS `warning` -> `color-feedback-warning-default`

These aliases are transitional and can evolve.

## 4. Responsive Policy

Platform status:

- iOS uses semantic size contracts and the current SwiftUI container proposal.
  HU-078 removed window-global `DeviceScale`, capture, resize extensions, and
  every `.resize*` production use.
- Android was not changed by HU-078. Its adaptive implementation remains a
  platform-native parity follow-up under the same semantic intent.

Rules:

- Derive layout from the active container, not a process-global window snapshot.
- Consume semantic spacing, radius, icon, control, layout, and readable-width
  tokens rather than introducing feature-local scaling or arbitrary dimensions.
- Keep a minimum 44-point iOS hit region even when the visible glyph is smaller.
- Cap readable iOS scaffold content while allowing compact containers to use the
  available width.
- Use Dynamic Type relative text styles without multiplying font sizes by width.
- Reserve `@ScaledMetric` for meaningful non-text metrics whose visual role
  should follow Dynamic Type.

## 5. Typography Policy

- Keep `CabinSketch` as current primary family baseline.
- Keep text roles aligned by intent across platforms (`title`, `body`, `label`).
- If new families are introduced, define rollout plan and fallback strategy before adoption.

## 6. Accessibility Baseline

### 6.1 Canonical contrast palette (P1-09)

The canonical machine-readable contract is [`color-tokens.json`](color-tokens.json). Its generated human-readable view is [`color-catalog.html`](color-catalog.html), which includes all mapped semantic colors, four visual contexts, platform provenance, and the computed WCAG matrix.

Do not duplicate hexadecimal tables in manually maintained documentation. Run `python3 scripts/design-system/generate_color_catalog.py --check` to verify that the contract, production sources, and catalog agree.

`AccentColor` and `actionPrimary` must resolve to the same iOS values. `controlAccent` remains separate so native controls retain non-text contrast, including with Increased Contrast enabled.

### 6.2 Contrast and state contract

| Use case | Required contract |
|---|---|
| Normal text | Contrast ratio of at least `4.5:1` against its rendered background. |
| Essential non-text controls and state indicators | Contrast ratio of at least `3:1` against adjacent colors. |
| Pressed state | Revalidate the semantic foreground/background pair after applying the standard `12%` state overlay. |
| Liquid Glass control tinted with the action color | Limit the Glass self-tint to `0.16` and render it over an explicit `surfacePrimary` backing. Other semantic state surfaces must validate their rendered foreground/background pair independently. |
| Floating action buttons and total bars | Use opaque semantic containers with their paired semantic content color. |
| Action and destructive content | Use `actionOnPrimary` and `feedbackOnError`, respectively; do not hardcode white or black. |
| Selection and read/unread state | Add an icon, text, shape, or accessibility semantics; color cannot be the only signal. |

- Preserve a minimum 44-by-44-point iOS touch target in component contracts.
- Treat the rendered state, rather than an isolated token, as the unit of contrast verification.

## 7. Platform Flexibility

Allowed:

- Native control differences when they improve platform UX.
- Different implementation details if semantic output is equivalent.

Not allowed:

- Divergent semantics for core actions (`primary`, `danger`, `disabled`, `focus`).

## 8. HU-035 Implementation Baseline (2026-03-13)

Current code entry points:

- Android theme wrapper and semantic palette:
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/Theme.kt`
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/Color.kt`
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/Type.kt`
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/DesignTokens.kt`
- iOS theme wrapper and semantic tokens:
  - `ios/Reguerta/Reguerta/DesignSystem/ReguertaTheme.swift`
  - `ios/Reguerta/Reguerta/ReguertaApp.swift`

Auth shell migration baseline:

- Splash / Welcome / Login routes now consume foundation spacing/radius/typography via theme tokens in:
  - `android/Reguerta/app/src/main/java/com/reguerta/user/presentation/root/ReguertaRoot.kt`
  - `ios/Reguerta/Reguerta/Presentation/Root/AuthShellView.swift`
  - `ios/Reguerta/Reguerta/Presentation/Auth/ContentView+AuthRoutes.swift`
  - `ios/Reguerta/Reguerta/Presentation/Auth/ContentView+AuthForms.swift`

## 9. HU-078 iOS Adaptive Foundation (2026-08-20)

`ReguertaDesignTokens` is the iOS authority for semantic spacing, radius, icon,
layout, readable-width, control-target, typography, color, and motion values.
Raw values stay inside DesignSystem; feature views consume named intent.

The active iOS contracts are:

- `ReguertaTheme` reads `accessibilityReduceMotion` once and injects
  `ReguertaMotionPolicy` alongside semantic tokens.
- `ReguertaMotionPolicy` preserves essential state changes while allowing
  material animation and scale to disappear when motion is reduced.
- `ReguertaScreenScaffold` accepts the active container width, centers regular
  content, caps its readable width at 720 points, and preserves ADR-0005
  safe-area ownership.
- Text uses CabinSketch with relative Dynamic Type styles and no width-derived
  font multiplier.
- Seven focused `@ScaledMetric` properties scale meaningful non-text metrics;
  they are not a replacement for container-aware layout.
- Shared controls compose a minimum 44-by-44-point hit region.

Implementation evidence contains 19 DesignSystem Swift files / 2,444 lines / 30
previews and 6 Presentation preview-support files / 1,998 lines / 26 previews.
The repository release gate, color contract, settings, builds, lint, and scope
audits are green. Deterministic previews and structural tests do not certify
runtime accessibility on their own. The maintainer completed bounded manual
MVP acceptance on 2026-08-20: representative VoiceOver and Voice Control
navigation/actions, sampled Accessibility Inspector controls, and an
interactive Reduce Motion off/on comparison all behaved correctly. This is not
exhaustive assistive-technology certification.

No Android code changed. Android parity should adopt native adaptive APIs while
preserving these semantic roles rather than copying SwiftUI implementation
details.
