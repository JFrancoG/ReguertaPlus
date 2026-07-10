# Tasks - HU-061 (Logout confirmation dialog)

GitHub tracking:

- #159 - Confirmar cierre de sesión desde el menú lateral.

## 1. Bootstrap

- [x] Create GitHub issue.
- [x] Create branch `codex/hu-061-logout-confirmation-dialog`.
- [x] Add issue mirror, spec, plan, and tasks.

## 2. Android implementation

- [x] Locate current drawer sign-out callback.
- [x] Locate existing `ReguertaDialog` API and usage examples.
- [x] Show confirmation dialog before sign-out.
- [x] Wire `Volver`/dismiss to keep session active.
- [x] Wire `Confirmar` to invoke existing sign-out once.
- [x] Update focused Android tests if existing coverage asserts immediate sign-out.

## 3. iOS implementation

- [x] Locate current drawer sign-out callback.
- [x] Locate existing `ReguertaDialog` API and usage examples.
- [x] Show confirmation dialog before sign-out.
- [x] Wire `Volver`/dismiss to keep session active.
- [x] Wire `Confirmar` to invoke existing sign-out once.
- [x] Update focused iOS tests if existing coverage asserts immediate sign-out.

## 4. Validation

- [x] Run Android unit tests.
- [x] Run Android lint.
- [x] Run Android instrumented tests or document why unavailable.
- [x] Run iOS test command from `AGENTS.md` or document simulator fallback.
- [x] Record manual parity check.

Validation evidence:

- Android manual follow-up: iOS worked, but Android did not surface the dialog from the real drawer footer. Fixed by deferring the confirmation display after closing the drawer and adding a drawer-click instrumented test.
- Android visual follow-up: adjusted the shared `ReguertaDialog` treatment to keep the new proportions while using the active `MaterialTheme` colors, so light devices render the light Reguerta dialog and dark devices render the dark version.
- Android icon follow-up: aligned the icon with the current Android `ReguertaAlertDialog` pattern: translucent outer badge plus the Material `Info`/`Error` icon tinted with the accent, without an extra inner circle.
- Android lint follow-up: cleared the `ReguertaRootHomeRoute.kt` warnings by using the state-backed `Modifier.offset { ... }` overload and keeping the logout dialog helper private.
- Android: `./gradlew app:compileDebugKotlin app:lintDebug` passed, and the lint report no longer lists `ReguertaRootHomeRoute.kt`.
- Android: `./gradlew app:testDebugUnitTest app:lintDebug` passed.
- Android: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.reguerta.user.HomeDrawerContentTest` passed 4 focused tests on `Pixel_4_A12_API29`.
- Android: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed 7 tests on `Pixel_4_A12_API29`.
- iOS: full `xcodebuild ... test` for `iPhone 17` was attempted; unit tests started, then the UI test runner failed to launch with `FBSOpenApplicationServiceErrorDomain Code=1` / `RequestDenied`.
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test -only-testing:ReguertaTests -quiet` passed.
- Parity: Android and iOS both intercept drawer sign-out, show the info `ReguertaDialog`, cancel without signing out, and invoke the existing sign-out flow only from `Confirmar`.

## 5. Closure

- [x] Update validation evidence.
- [ ] Prepare PR linked to #159.
