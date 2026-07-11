# HU-068 - Order screen localization and header cleanup

## Metadata
- issue_id: #181
- priority: P2
- platform: both
- status: implemented

## Context and problem

The iOS My order flow renders much of its visible copy from Spanish string literals, so changing the app language to English leaves the product list, actions, cart, order states, and checkout dialogs in Spanish. Android already resolves this copy from localized resources, but its normal product-list state shows a redundant shell title (`Order`) above the route title (`Product list`).

## User story

As a cooperative member, I want the complete order flow to follow the app language and present one clear screen title so that ordering is understandable and visually consistent on either platform.

## Scope

### In scope
- Replace user-visible Spanish literals in the iOS My order flow with localized English/Spanish resources.
- Cover the product list, producer badges, add/quantity controls, stock, cart, confirmed and previous orders, eco-basket choices, validation errors, and checkout success/failure dialogs.
- Keep runtime product/member content unmodified.
- Remove only the normal Android My order shell title while retaining the route title, back navigation, and cart action.
- Preserve contextual Android shell titles for the cart and existing title behavior for confirmed/previous order states.
- Add targeted regression coverage where practical and run the relevant repository validations.

### Out of scope
- Translating product names, descriptions, producer names, packaging data, or other backend content.
- Changing order calculations, availability, commitment validation, persistence, or checkout behavior.
- Redesigning order cards, search, quantity controls, or overlays.
- Broad localization cleanup outside the My order flow.

## Acceptance criteria

- With the app language set to English, every app-owned string in the iOS My order flow is displayed in English.
- With the app language set to Spanish, the same flow displays equivalent Spanish translations.
- Localized copy covers the normal product list plus cart, confirmed order, previous order, eco-basket, stock, and checkout dialog states.
- iOS accessibility labels for the quantity and search controls follow the active language.
- Dynamic product, producer, packaging, and unit data remains unchanged.
- Android no longer displays `Order` above `Product list` in the normal editable product-list state.
- Android keeps `Product list`, the back action, the cart action, and contextual cart/read-only behavior.
- No order-domain behavior changes and Android/iOS parity remains intact.

## Dependencies and risks

- iOS uses `Localizable.xcstrings` plus the `AccessL10nKey` namespace; new keys must be present in both English and Spanish.
- Some iOS strings are produced by view-model helpers or passed through APIs typed as `String`; localized resolution must happen late enough to honor the active locale.
- Backend-provided unit and packaging labels may still reflect stored source data and are intentionally outside this story.
- Hiding the Android shell title must not remove the top-bar row that owns back and cart actions.

## Validation plan

- Android:
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` when an emulator/device is available because visible UI behavior changes.
- iOS:
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
  - If the full UI runner is blocked, run the app build and `ReguertaTests` separately and record the blocker.
- Static:
  - Parse `Localizable.xcstrings` as JSON.
  - Search the touched My order presentation files for remaining app-owned Spanish literals.
  - Run `git diff --check`.

## Validation evidence

- Android unit tests and lint: `./gradlew app:testDebugUnitTest app:lintDebug --console=plain` passed.
- Android connected tests: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest --console=plain` passed 11/11 tests on `Pixel_8_Pro_API_35(AVD) - 15`.
- iOS app and unit tests: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ReguertaTests test` passed, including the new localized-order action and format checks.
- The full iOS `test` command compiled the app and completed the unit suite, but the UI runner repeatedly failed to acquire an LLDB debugger version (`DebuggerVersionStore.StoreError: no debugger version`). The stalled UI run was interrupted after 110 seconds; no app/unit test failure was reported.
- `jq empty ios/Reguerta/Reguerta/Resources/Localizable.xcstrings`, the targeted hardcoded-copy scan, `git diff --check`, and the iOS String Catalog compiler all passed.
- Implementation parity is complete: iOS owns the same English/Spanish order concepts as Android, while Android now suppresses only the redundant normal-list shell title.

## Definition of Done

- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Relevant tests and lint executed.
- [x] Story evidence and issue links updated.
- [ ] Pull request linked for delivery.
