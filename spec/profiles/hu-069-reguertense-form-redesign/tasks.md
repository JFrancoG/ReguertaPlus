# Tasks - HU-069 (Regüertense add and edit form redesign)

## 1. Preparation

- [x] Confirm clean, updated `main`.
- [x] Create `codex/hu-069-reguertense-form-redesign`.
- [x] Create GitHub issue #188 with cross-platform profile labels.
- [x] Create issue mirror and story spec/plan/tasks.
- [x] Finish tracing form state, validation, components, and tests on both platforms.

## 2. Android

- [x] Remove the form card and bottom Back action.
- [x] Use Reguerta Inputs for email, display name, phone number, and company name.
- [x] Add create/update title and primary action wording.
- [x] Enforce Producer/Common purchases manager/company transitions.
- [x] Keep email read-only during edit.
- [x] Add targeted unit and connected-suite coverage.

## 3. iOS

- [x] Remove the form card and bottom Back action.
- [x] Use Reguerta Inputs for email, display name, phone number, and company name.
- [x] Add create/update title and primary action wording.
- [x] Enforce Producer/Common purchases manager/company transitions.
- [x] Keep email read-only during edit.
- [x] Add targeted unit coverage; record the local UI-runner blocker separately.

## 4. Validation and handoff

- [x] Run Android unit tests.
- [x] Run Android lint.
- [x] Run Android connected UI tests on `Pixel_8_Pro_API_35`.
- [x] Run iOS unit tests on iPhone 17; record the full UI-runner environment blocker.
- [x] Run static diff and localization checks.
- [x] Record validation evidence and parity status in `spec.md`.
- [x] Link pull request #189.
