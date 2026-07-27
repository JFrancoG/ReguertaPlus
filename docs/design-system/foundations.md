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

Current systems use custom scaling (`resize` / width ratio).

Guideline:

- Keep existing scaling behavior while migrating.
- Do not introduce new hardcoded size values.
- Move toward token-driven size ramps that can be implemented platform-natively.

## 5. Typography Policy

- Keep `CabinSketch` as current primary family baseline.
- Keep text roles aligned by intent across platforms (`title`, `body`, `label`).
- If new families are introduced, define rollout plan and fallback strategy before adoption.

## 6. Accessibility Baseline

### 6.1 Canonical contrast palette (P1-09)

| Semantic token | iOS Light | iOS Dark | iOS Increased Contrast Light | iOS Increased Contrast Dark | Android Light | Android Dark |
|---|---|---|---|---|---|---|
| `color-action-primary-default` (`AccentColor` on iOS) | `#3D681E` | `#6DA239` | `#315815` | `#A8DD75` | `#3D681E` | `#6DA239` |
| `color-action-on-primary-default` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` |
| `color-control-accent-default` | `#3D681E` | `#6DA239` | `#315815` | `#5B8B2D` | Uses the Material 3 `primary`/`onPrimary` pair | Uses the Material 3 `primary`/`onPrimary` pair |
| `color-feedback-warning-default` | `#843800` | `#FFAA70` | `#6D2B00` | `#FFC093` | `#843800` | `#FFAA70` |
| `color-feedback-error-default` | `#8D3434` | `#F48787` | `#742222` | `#FFA5A5` | `#8D3434` | `#F48787` |
| `color-feedback-on-error-default` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` |

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

- Preserve touch target minimums in component contracts.
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
  - `ios/Reguerta/Reguerta/Reguerta/DesignSystem/ReguertaTheme.swift`
  - `ios/Reguerta/Reguerta/Reguerta/ReguertaApp.swift`

Auth shell migration baseline:

- Splash / Welcome / Login routes now consume foundation spacing/radius/typography via theme tokens in:
  - `android/Reguerta/app/src/main/java/com/reguerta/user/presentation/access/ReguertaRoot.kt`
  - `ios/Reguerta/Reguerta/Reguerta/ContentView.swift`
