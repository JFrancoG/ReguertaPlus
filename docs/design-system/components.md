# Components

This catalog defines the current component contract and parity status for auth/onboarding.

## 1. Status Legend

- `stable`: ready for default use in new features.
- `candidate`: mostly aligned, pending minor API polish.
- `experimental`: useful but API/name can still change.
- `deprecated`: do not use in new code.

## 2. Core Components V1 (HU-036)

| Component | Android | iOS | Shared intent | Status | Notes |
|---|---|---|---|---|---|
| Card/container shell | `ui/components/auth/ReguertaCard.kt` | `DesignSystem/Components/ReguertaCard.swift` | Group related content using semantic surface + border/radius tokens | stable | Main shell for splash/welcome/login/register/recover |
| Button | `ReguertaButton` + `ReguertaButtonVariant` | `ReguertaButton` + `ReguertaButtonVariant` | Unified primary/secondary/text action model with loading and disabled support | stable | Variants: `primary`, `secondary`, `text` |
| Input/Auth field | `ReguertaInputField` | `ReguertaInputField` | Label, placeholder, helper/error text, trailing action, focus/disabled/error states | stable | Keyboard type exposed in both platforms |
| Inline feedback | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | Reusable inline info/warning/error messages | stable | Used in auth shell and generic feedback areas |

## 3. Auth Flow Reference Wiring

Implemented reference flow (end-to-end) using the V1 components:

- Android: `presentation/access/ReguertaRoot.kt`
  - Splash route uses `ReguertaCard`.
  - Welcome route uses `ReguertaCard` + `ReguertaButton`.
  - Login route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Register/recover placeholders use `ReguertaCard` + `ReguertaButton`.
- iOS: `ContentView.swift`
  - Splash route uses `ReguertaCard`.
  - Welcome route uses `ReguertaCard` + `ReguertaButton`.
  - Login route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Register/recover placeholders use `ReguertaCard` + `ReguertaButton`.

## 4. Contract Rules

- Define component APIs by behavior and explicit state, not by a single screen context.
- Keep `enabled`, `disabled`, `loading`, `focus`, and `error` visible in the component contract.
- Consume semantic theme/tokens only. Avoid raw colors and ad-hoc dimensions in feature views.

## 5. Explicit Legacy Exclusions

- Android `NavigationDrawerInfo` (deprecated).
- Android legacy params in `InverseReguertaButton` (`borderSize`, `cornerSize`).
- iOS `SimpleDialogView` and unused text style helpers.
