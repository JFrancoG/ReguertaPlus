# Plan - HU-055 (Home weekly summary market context)

## Approach

Update the existing HU-051 Home weekly summary implementation instead of adding a separate Home module. The summary resolver remains the single source of truth for date cutoff, producer selection, delivery responsibles, market responsibles, and the order-state key.

## Implementation steps

1. Extend the Android and iOS Home weekly summary display models with:
   - `orderWeekKey`,
   - market date label,
   - market responsible names.
2. Resolve the target delivery week using the existing day-after-delivery cutoff.
3. Derive the order/market week as the week before the displayed delivery week.
4. Resolve the market shift from that order/market week and fall back to Saturday of that week when missing.
5. Use `orderWeekKey` when resolving Home order state.
6. Rebuild the Home summary card into the requested narrow-left / wide-right three-row grid on Android and iOS.
7. Add the latest-news divider and drawer news-label split.
8. Add boundary tests for Thursday May 14, 2026 after a Wednesday May 13 delivery.

## Validation

- Android: `./gradlew app:testDebugUnitTest`
- Android: `./gradlew app:lintDebug`
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`

`connectedDebugAndroidTest` is optional for this branch unless an emulator is available, because the change is covered by unit tests plus platform builds/lint.
