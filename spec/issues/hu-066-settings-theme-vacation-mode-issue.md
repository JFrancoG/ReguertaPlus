# Issue mirror - HU-066

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/172
- Title: `[HU-066] Reorganizar ajustes y añadir apariencia y modo no disponible`
- Labels: `type:feature`, `area:app`, `area:producers`, `area:products`, `platform:cross`, `priority:P2`
- Branch: `codex/hu-066-settings-theme-vacation-mode`

## Summary

Reorganize the settings screen by access scope, remove the single outer card, add a persisted general appearance preference, and expose the producer catalog visibility as an explicit vacation-mode control on Android and iOS.

## Acceptance criteria

- Settings are rendered without one card enclosing the whole screen.
- Visible sections follow this order: General, Producer, Administrator, Develop.
- General is visible to every authorized member; Producer, Administrator, and Develop are shown only when their corresponding scope applies.
- Appearance supports System, Light, and Dark, applies immediately to the whole app, and persists across relaunches independently on each device.
- A producer can enable or disable Unavailable mode from Settings.
- Enabling Unavailable mode persists the producer state and removes that producer's products from members' ordering catalog on both platforms.
- Unavailable mode does not alter existing or historical orders; it only filters the product list used to prepare a new order.
- Disabling Unavailable mode restores visibility using the existing product availability, archive, stock, parity, and commitment rules.
- Producers can still manage their own catalog while Unavailable mode is enabled.
- Existing administrator and develop settings retain their behavior after reordering.
- Android and iOS tests cover preference mapping, scope visibility, producer-state persistence, and ordering visibility where practical.

## Scope and implementation checklist

- [x] Define a shared product contract for the three appearance options and vacation-mode semantics.
- [x] Implement persisted local appearance preference and root theme binding on Android.
- [x] Implement persisted local appearance preference and root theme binding on iOS.
- [x] Recompose Settings on both platforms with ordered scope sections and no outer container card.
- [x] Reuse the existing `producerCatalogEnabled` persistence contract as the inverse of Unavailable mode.
- [x] Move or replace the catalog-visibility control with the producer Unavailable mode control in Settings.
- [x] Confirm all ordering-product filters exclude vacationing producers and preserve own catalog management.
- [x] Add/update Android and iOS tests.
- [x] Run the relevant repository validations and record evidence.

## Assumptions and boundaries

- Unavailable mode is indefinite until the producer turns it off; scheduling start/end dates is out of scope.
- Unavailable mode hides products from new ordering flows but does not mutate products, stock, archived state, historical orders, or existing order snapshots.
- Appearance preference is device-local and is not synchronized through Firestore.
- No new Firestore field is required: `producerCatalogEnabled = false` means Unavailable mode is active.
- Administrator tools and develop-only tools are reorganized but not functionally redesigned.
