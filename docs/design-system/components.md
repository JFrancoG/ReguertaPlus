# Components

This catalog defines shared component intent and parity status.

## 1. Status Legend

- `stable`: ready for default use in new features.
- `candidate`: mostly aligned, pending normalization.
- `experimental`: useful but API/name can change.
- `deprecated`: do not use in new code.

## 2. Cross-Platform Matrix

| Component | Android | iOS | Shared intent | Status | Notes |
|---|---|---|---|---|---|
| Theme wrapper | `ReguertaTheme` | app-level SwiftUI style/tokens | Provide global visual baseline | candidate | Align token naming |
| Screen scaffold | `Screen` + `ReguertaScaffold` | view wrappers | Shared screen structure | candidate | iOS equivalent less explicit |
| Top bar | `ReguertaTopBar` | `HeaderView` | Title + back/navigation actions | candidate | API normalization pending |
| Buttons | `ReguertaButton` family | `FullStyle`, `FlatStyle`, `MainStyle` | Primary/secondary/destructive actions | candidate | Keep semantic variants |
| Inputs | `ReguertaEmailInput`, `ReguertaPasswordInput`, `TextReguertaInput` | `InputView`, `CustomTextField` | Form input with validation states | candidate | Normalize state model |
| Dialogs | `ReguertaAlertDialog` | `GenericDialogView` | Confirmation/feedback with intent variants | candidate | Align button model |
| Card | `ReguertaCard` | cell/view style wrappers | Group related content | candidate | Normalize levels/kinds |
| Checkbox | `ReguertaCheckBox` | `CheckBoxView` | Boolean selection | stable | Low variance |
| Counter | `ReguertaCounter` | quantity controls | Increment/decrement pattern | candidate | Consolidate disabled rules |
| Dropdown/select | `DropdownSelectable` | custom picker patterns | Single-choice selector | experimental | Define shared API |
| Remote image | `ImageUrl`, `ProductImage` | `URLImage` pattern | Async image + fallback | candidate | Standardize fallback contract |
| Loading animation | `LoadingAnimation` | progress styles | Loading feedback | experimental | Decide lottie vs native rule |

## 3. Contract Rules

- Define component APIs by behavior and states, not by screen-specific context.
- Keep `enabled`, `disabled`, `loading`, `error`, `focus` explicit in contracts.
- Prefer composable/swiftui wrappers over duplicating style logic per feature.

## 4. Explicit Legacy Exclusions

- Android `NavigationDrawerInfo` (deprecated).
- Android legacy params in `InverseReguertaButton` (`borderSize`, `cornerSize`).
- iOS `SimpleDialogView` and unused text style helpers.
