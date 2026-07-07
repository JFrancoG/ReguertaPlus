# Plan - HU-060 (Android/iOS UI spacing and text polish)

## Approach

Keep this as a focused UI polish pass. Reuse the existing drawer, auth, home, welcome, and notifications routes; do not introduce new navigation state or domain behavior.

## Implementation steps

1. Inspect iOS drawer labels and Android string resources for equivalent route names.
2. Update Android drawer labels/localization to match iOS semantics.
3. Adjust Android drawer width and animation timing in the home shell.
4. Verify the drawer still respects current role-based visibility.
5. Inspect Android notifications route layout and align title/date headers with the notification card content column.
6. Tune welcome, auth, home week badge, and latest news typography/spacing from the Android/iOS screenshot comparison.
7. Run focused Android validation, Android instrumented validation, and iOS build validation for SwiftUI changes.

## Validation

- Android: `./gradlew app:testDebugUnitTest`
- Android: `./gradlew app:lintDebug`
- Android: `./gradlew app:connectedDebugAndroidTest` when an emulator/device is available because drawer/notificaciones are UI-facing.
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build` for SwiftUI changes.

## Notes

- iOS is the primary reference for copy and visual rhythm, but small iOS spacing/typography corrections are allowed when the comparison shows Android is closer to the intended balance.
