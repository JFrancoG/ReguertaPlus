# Plan - HU-068 (Order screen localization and header cleanup)

## Goal

Make the full iOS My order flow respect the active app language and remove the redundant Android shell title without changing order behavior.

## Workstreams

1. Localization inventory and contracts
- Inventory app-owned visible and accessibility copy across the iOS My order route, overlays, sections, and view-model presentation helpers.
- Map the existing Android English/Spanish order resources to an equivalent iOS String Catalog contract.
- Separate localizable application copy from backend-provided product, producer, packaging, and unit content.

2. iOS implementation
- Add focused `AccessL10nKey` entries and English/Spanish catalog values.
- Replace view literals with `LocalizedStringKey` where UI APIs can defer resolution.
- Use the existing `l10n` formatter for dynamic strings and string-only component APIs.
- Keep accessibility labels aligned with visible actions.

3. Android header cleanup
- Return an empty shell title only for the normal editable My order list.
- Preserve the shell row, back action, cart action, cart title, and read-only behavior.
- Add a focused presentation helper/test if needed to make the state contract explicit.

4. Validation and delivery readiness
- Add targeted tests for localized iOS order presentation and Android shell-title selection.
- Run Android unit/lint/connected checks and iOS tests from `AGENTS.md`.
- Record evidence, remaining environment limitations, and parity status.

## Delivery sequence

1. Bootstrap HU, branch, issue, and story docs.
2. Implement and test the iOS localization contract.
3. Implement and test the Android shell-title cleanup.
4. Run cross-platform validation and prepare the delivery handoff.

If one platform becomes temporarily blocked, complete and validate the other and record the parity gap as required by `AGENTS.md`.
