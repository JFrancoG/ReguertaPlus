# Tasks - HU-063 (Shifts helper and UI polish)

## 1. Preparation
- [x] Create `codex/hu-063-shifts-helper-and-ui-polish` branch.
- [x] Create GitHub issue #163.
- [x] Create issue mirror and story docs.
- [x] Review current Android/iOS shifts implementations.

## 2. iOS behavior
- [x] Locate helper/lead derivation for delivery upcoming shifts.
- [x] Pair the helper row with the delivery week before the next lead shift, including after its delivery day has passed.
- [x] Validate Nohemi helper on 8 July 2026 and lead on 15 July 2026.
- [x] Add/update tests for default Wednesday and exception-day delivery weeks.

## 3. Android UI
- [x] Center upcoming-shifts block and soften value typography.
- [x] Center request-swap button while preserving the Android button style.
- [x] Format market month label as `MMM yyyy`.
- [x] Place main title below the back arrow if needed.

## 4. iOS UI
- [x] Center upcoming-shifts block and soften value typography.
- [x] Center request-swap button with button-like treatment.
- [x] Format market month label as `MMM yyyy`.
- [x] Place main title below the back arrow.

## 5. Validation
- [x] Run Android unit tests and lint or document why skipped.
- [x] Run iOS tests/build or document why skipped.
- [x] Record validation and parity notes, including known runner/device blockers.

## 6. Follow-up: helper names and compact cards
- [x] Resolve each delivery helper from the lead of the following delivery week, leaving the final delivery without a following lead pending.
- [x] Use the resolved helper for board names and current-member highlighting on Android and iOS.
- [x] Vertically center the date block and widen the name area on delivery cards.
- [x] Add regression coverage for a missing or stale helper field on both platforms.

## 7. Closure
- [x] Apply the Responsable/Apoyo role terminology and reinforce the iOS upcoming responsible row.
- [x] Update DoD status in `spec.md`.
- [x] Link PR #164.
