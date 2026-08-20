# Components

This catalog defines the current component contract and parity status for reusable app UI.

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
| Floating action button | `ReguertaFloatingActionButton` | `ReguertaFloatingActionButton` | Persistent bottom action over scrollable content without an opaque footer band | stable | Uses the opaque `actionPrimary`/`actionOnPrimary` pair on both platforms |
| Input/Auth field | `ReguertaInputField` | `ReguertaInputField` | Label, placeholder, helper/error text, trailing action, focus/disabled/error states | stable | Keyboard type exposed in both platforms |
| Inline feedback | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | Reusable inline info/warning/error messages | stable | Used in auth shell and generic feedback areas |
| List item card + action buttons | `ReguertaListItemCard`, `ReguertaEditListActionButton`, `ReguertaDeleteListActionButton` | `ReguertaListItemCard`, `ReguertaListActionIconButton` | Reusable list cards with add/edit/delete highlight parity for operational lists | stable | Used by products and authorized members; native minimum targets are expressed in platform units (44 dp/pt) |

## 3. Auth Flow Reference Wiring

Implemented reference flow (end-to-end) using the V1 components:

- Android: `presentation/root/ReguertaRoot.kt`
  - Splash route uses `ReguertaCard`.
  - Welcome route uses `ReguertaCard` + `ReguertaButton`.
  - Login route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Register route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
  - Recover route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
- iOS: `Presentation/Root/AuthShellView.swift`,
  `Presentation/Auth/ContentView+AuthRoutes.swift`, and
  `Presentation/Auth/ContentView+AuthForms.swift`
  - Splash route uses `ReguertaCard`.
  - Welcome route uses `ReguertaCard` + `ReguertaButton`.
  - Login route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Register route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
  - Recover route uses `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.

## 4. Input V2 Contract (HU-033)

- Canonical states: `default`, `focused`, `error`, `disabled`.
- Optional clear action icon for editable non-empty values.
- Optional password visibility toggle for secure fields.
- Inline error slot has priority over helper slot.
- No screen should render raw backend/provider auth text directly in input errors.

Current references:

- Android input component: `ui/components/auth/ReguertaInputField.kt`
- iOS input component: `DesignSystem/Components/ReguertaInputField/ReguertaInputFieldView.swift`
- Android auth error mapping: `presentation/auth/AuthErrorMapping.kt`
- iOS auth error mapping: `Presentation/Auth/AuthErrorMapping.swift`

## 5. Contract Rules

- Define component APIs by behavior and explicit state, not by a single screen context.
- Keep `enabled`, `disabled`, `loading`, `focus`, and `error` visible in the component contract.
- Consume semantic theme/tokens only. Avoid raw colors and ad-hoc dimensions in feature views.
- For bottom actions over scrollable lists, prefer `ReguertaFloatingActionButton` and give the scroll content explicit bottom padding so content can pass behind the button.
- For repeated list rows with edit/delete actions, prefer `ReguertaListItemCard` and the shared action icon buttons before adding feature-local card styles.

## 6. Explicit Legacy Exclusions

- Android `NavigationDrawerInfo` (deprecated).
- Android legacy params in `InverseReguertaButton` (`borderSize`, `cornerSize`).
- iOS `SimpleDialogView` and unused text style helpers.

## 7. HU-078 iOS Adaptive Component Contract

The iOS shared-component APIs use passive Configuration values rather than
presenting immutable input as ViewModels:

- `ReguertaButtonConfiguration`
- `ReguertaCardConfiguration`
- `ReguertaDialogConfiguration`
- `ReguertaInlineFeedbackConfiguration`
- `ReguertaInputFieldConfiguration`
- `ReguertaScreenHeaderConfiguration`

The component contract is:

- Button variants, Header actions, list actions, the Floating Action Button,
  Dialog actions/close, and Input clear/password actions compose at least a
  44-by-44-point hit region.
- Card, Inline Feedback, Input, Header, List Item, Dialog, Button, and Scaffold
  consume semantic spacing, radius, icon, layout, typography, color, and motion
  values. Feature code does not use width-derived `.resize*` scaling.
- Input keeps localized label content unchanged for accessibility; uppercase is
  not applied to the localized semantic string.
- `ReguertaScreenScaffold` receives the current container width, caps readable
  content at 720 points, owns its header/top inset, and supports explicit
  shell-level bottom content. Each route still owns its scroll and
  route-specific bottom inset under ADR-0005.
- Material motion reads the root `ReguertaMotionPolicy`; essential state changes
  remain visible when Reduce Motion is enabled.
- Shared components expose deterministic disabled, loading, error, long-text,
  action, compact, regular, locale, appearance, contrast, and Dynamic Type
  preview states as applicable.

Current evidence comprises 30 DesignSystem previews plus 26 deterministic
community/operations route previews. The repository release gate and compact UI
journeys are green. On 2026-08-20 the maintainer completed bounded manual MVP
acceptance with representative VoiceOver and Voice Control navigation/actions,
sampled Accessibility Inspector controls, and an interactive Reduce Motion
off/on comparison. All behaved correctly; preview rendering is still not a
substitute for runtime checks, and this does not claim exhaustive coverage.

HU-078 changed no Android component code. Android parity remains a follow-up
that should preserve these behavioral and semantic contracts through native
Android adaptive APIs.
