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

## 3. Legacy-to-Canonical Mapping (starting point)

- Android `primary6DA539` / iOS `accentColor` -> `color-action-primary-default`
- Android `mainBackLight|Dark` / iOS `mainBackF2F8E10F1D0D` -> `color-surface-primary-default`
- Android `secondBackLight|Dark` / iOS `secBackDDE5C01A2B1B` -> `color-surface-secondary-default`
- Android `errorColor` / iOS `errorB04B4B` -> `color-feedback-error-default`
- Android `LowStock` / iOS `warningEB6200` -> `color-feedback-warning-default`

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

- Minimum contrast target: WCAG AA for text and interactive controls.
- Do not use color as the only state signal.
- Preserve touch target minimums in component contracts.

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
