# Tasks - HU-066 (Settings appearance and producer unavailable mode)

## 1. Preparation
- [x] Confirm a clean updated `main`.
- [x] Create `codex/hu-066-settings-theme-vacation-mode`.
- [x] Create GitHub issue #172 and update local links.
- [x] Create issue mirror and story spec/plan/tasks.
- [x] Finish tracing Settings, theme, member persistence, and ordering visibility on both platforms.

## 2. Android general appearance
- [x] Add System/Light/Dark preference contract and persistent storage.
- [x] Observe the preference at the app root and apply it to `ReguertaTheme`.
- [x] Add the General appearance control to Settings.
- [x] Add tests for default, persistence/mapping, and theme selection.

## 3. Android producer Unavailable mode
- [x] Add the producer-only Unavailable mode control and saving state to Settings.
- [x] Persist through the existing member repository with inverse `producerCatalogEnabled` semantics.
- [x] Synchronize current/authenticated member lists and refresh ordering state.
- [x] Remove or redirect the old catalog-visibility control.
- [x] Add regression tests for hidden/restored ordering products and own catalog access.

## 4. Android settings structure
- [x] Remove the outer card.
- [x] Render General, Producer, Administrator, Develop in scope order.
- [x] Preserve admin delivery calendar and shift-planning behavior.
- [x] Preserve develop impersonation and time-machine behavior.
- [x] Keep section scope/order explicit in the Settings composition and compile it in connected validation.

## 5. iOS general appearance
- [x] Add System/Light/Dark preference contract and persistent storage.
- [x] Observe the preference at the app root and apply it to `ReguertaTheme` or the root environment.
- [x] Add the General appearance control to Settings.
- [x] Add tests for default, persistence/mapping, and theme selection.

## 6. iOS producer Unavailable mode
- [x] Add the producer-only Unavailable mode control and saving state to Settings.
- [x] Persist through the existing member repository with inverse `producerCatalogEnabled` semantics.
- [x] Synchronize session/member state and refresh ordering state.
- [x] Remove or redirect the old catalog-visibility control.
- [x] Add regression tests for hidden/restored ordering products and own catalog access.

## 7. iOS settings structure
- [x] Remove the outer container styling.
- [x] Render General, Producer, Administrator, Develop in scope order.
- [x] Preserve admin delivery calendar and shift-planning behavior.
- [x] Preserve develop impersonation and time-machine behavior.
- [x] Cover appearance mapping and vacation filtering in unit tests; compile the reordered composition in the app target.

## 8. Validation and handoff
- [x] Run Android unit tests.
- [x] Run Android lint.
- [x] Run Android connected UI tests when an emulator/device is available.
- [x] Run iOS unit tests on iPhone 17; record the full UI-runner environment failure separately.
- [ ] Manually verify persistence and Unavailable mode product disappearance/restoration.
- [x] Record validation evidence and any parity gap in `spec.md`.
- [ ] Link the eventual pull request.
