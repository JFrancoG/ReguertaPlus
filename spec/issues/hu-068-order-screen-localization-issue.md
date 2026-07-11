# Issue mirror - HU-068

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/181
- Title: `[HU-068] Localizar Mi pedido en iOS y simplificar su cabecera Android`
- Labels: `bug`, `area:orders`, `platform:cross`, `priority:P2`
- Branch: `codex/hu-068-order-screen-localization`

## Summary

Make the complete iOS My order flow follow the active English/Spanish app language, and remove the redundant Android `Order` shell title above the route's `Product list` heading.

## Acceptance criteria

- All app-owned My order copy on iOS is localized in English and Spanish.
- Localization covers the list, search, groups, actions, quantities, stock, cart, confirmed/previous states, eco-basket choices, and checkout dialogs.
- Quantity and search accessibility labels follow the active language.
- Backend-provided product, producer, packaging, and unit content is not transformed.
- Android omits only the normal My order shell title and keeps `Product list` plus navigation/cart actions.
- Contextual cart, confirmed-order, and previous-order title behavior is preserved.
- Targeted regression coverage and standard platform validations pass or environment blockers are documented.

## Scope and implementation checklist

- [x] Add focused iOS order localization keys and English/Spanish catalog entries.
- [x] Replace iOS Spanish literals and string-only presentation helpers with localized equivalents.
- [x] Keep visible and accessibility action labels aligned.
- [x] Make Android My order shell-title selection explicit for normal, cart, and read-only states.
- [x] Add/update Android and iOS tests.
- [x] Run the relevant repository validations and record evidence.

## Assumptions and boundaries

- App-owned UI copy is localizable; backend content remains as stored.
- This story does not change order-domain calculations or persistence.
- The Android shell top-bar container remains visible because it owns navigation and cart actions.

## Validation

- Android: unit tests, lint, and connected tests when available.
- iOS: app/unit tests on iPhone 17, with full UI-runner limitations documented separately if encountered.
- Static: String Catalog JSON parsing, hardcoded-copy scan, and `git diff --check`.

## Validation evidence

- Android unit tests and lint passed.
- Android connected tests passed 11/11 on `Pixel_8_Pro_API_35(AVD) - 15`.
- iOS `ReguertaTests` passed on iPhone 17, including new localized-copy tests.
- The full iOS UI runner remains blocked by the local `DebuggerVersionStore.StoreError: no debugger version` environment issue; app compilation and unit tests are green.
- String Catalog JSON parsing, Xcode catalog compilation, the hardcoded-copy scan, and `git diff --check` passed.
