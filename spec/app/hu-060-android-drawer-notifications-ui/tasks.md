# Tasks - HU-060 (Android/iOS UI spacing and text polish)

GitHub tracking:

- #157 - Pulir espacios y textos UI Android/iOS.

## 1. Bootstrap
- [x] Create GitHub issue.
- [x] Create branch `codex/hu-060-android-drawer-notifications-ui`.
- [x] Add issue mirror, spec, plan, and tasks.

## 2. Drawer
- [x] Compare iOS drawer labels against Android drawer labels.
- [x] Update Android drawer copy/localization for equivalent routes.
- [x] Tune Android drawer open/close animation duration.
- [x] Adjust Android drawer width/containment.
- [x] Verify role-based visibility remains unchanged.

## 3. Notifications
- [x] Compare iOS notifications date/title/card alignment.
- [x] Align Android notification date headers with the notification cards.
- [x] Verify empty/loading states still look acceptable.

## 4. Validation
- [x] Run Android unit tests.
- [x] Run Android lint.
- [x] Run Android instrumented tests or document why unavailable.
- [x] Run iOS build after SwiftUI adjustments.
- [x] Record manual visual checks.

Validation evidence:

- `./gradlew app:testDebugUnitTest app:lintDebug` passed.
- `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed on Pixel_4_A12_API29 AVD.
- `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build` passed.
- `xcodebuild ... test` was attempted first; the app compiled but the simulator refused to launch `com.plusprojects.ReguertaUITests.xctrunner` with `FBSOpenApplicationServiceErrorDomain Code=1 RequestDenied`, so build-only was used to validate the SwiftUI changes.
- Manual source check: iOS drawer, welcome, home, and notifications SwiftUI routes were used as copy/alignment references.

## 5. Closure
- [x] Update task status and validation evidence.
- [ ] Open PR linked to #157.
