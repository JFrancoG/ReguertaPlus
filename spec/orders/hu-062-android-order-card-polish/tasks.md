# Tasks - HU-062 (Android order card polish)

GitHub tracking:

- #161 - Pulir cards de pedidos Android con paridad iOS.

## 1. Bootstrap
- [x] Create GitHub issue.
- [x] Create branch `codex/hu-062-android-order-card-polish`.
- [x] Add issue mirror, spec, plan, and tasks.

## 2. Android UI
- [x] Locate shared order summary card composables.
- [x] Replace gray/purple producer card surface with green order-card surface.
- [x] Format product rows into iOS-like description, quantity, and price columns.
- [x] Remove duplicate shell title from `Mi último pedido`.
- [x] Verify `Todos mis pedidos` keeps weekly navigation and uses corrected cards.
- [x] Remove raw week-key subtitle from `Mi último pedido`.
- [x] Move the `Todos mis pedidos` order range below the back arrow.
- [x] Replace purple weekly selector controls with green themed surfaces.
- [x] Correct order-line packaging text to use container plus measure.

## 3. Validation
- [x] Run Android unit tests.
- [x] Run Android lint.
- [x] Run Android instrumented tests or document why unavailable.
- [x] Record manual visual/source checks.

Validation evidence:

- `./gradlew app:testDebugUnitTest` passed.
- `./gradlew app:lintDebug` passed.
- `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed on Pixel_4_A12_API29 AVD.
- Manual source check: Android `Mi último pedido` and `Todos mis pedidos` now share `PersonalOrderSummaryProducerCard`; iOS screenshots/source were used as the row/card reference, and the follow-up screenshot issues were checked against the edited code paths.

## 4. Closure
- [x] Update task status and validation evidence.
- [ ] Open PR linked to #161.
