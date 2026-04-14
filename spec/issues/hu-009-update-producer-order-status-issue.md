# [HU-009] Update producer order status

## Summary

As a producer I want to update whole-order status so that members know preparation progress.

## Links
- Spec: spec/producers/hu-009-update-producer-order-status/spec.md
- Plan: spec/producers/hu-009-update-producer-order-status/plan.md
- Tasks: spec/producers/hu-009-update-producer-order-status/tasks.md

## Acceptance criteria

- Only allowed statuses are unread, read, prepared, and delivered at full-order level.
- Initial value for a new or untouched producer order is `unread` (no null state).

## Scope
### In Scope
- Implement story HU-009 within MVP scope.
- Satisfy linked RFs: RF-PROD-04.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Implementation notes
- Added producer-scoped status contract on order payloads: `producerStatusesByVendor.{vendorId}` with legacy fallback/compatibility via `producerStatus`.
- Android and iOS now initialize missing statuses as `unread` on checkout and preserve existing vendor statuses when editing confirmed orders.
- `Received orders` (producer flow) now reads status from `orders`, allows status transitions (`unread`/`read`/`prepared`/`delivered`) in the `By member` tab, and persists updates in Firestore.
- `My order` (member flow) now loads producer statuses from the current confirmed order and colors each producer card by status so progress is visible without opening producer screens.
- UI parity maintained:
  - Producer: status selector + card color feedback per member order.
  - Member: producer-grouped cards colorized by current producer status.

## Validation evidence
- Android: `./gradlew app:testDebugUnitTest` ✅
- Android: `./gradlew app:lintDebug` ✅
- Android: `./gradlew app:connectedDebugAndroidTest` ⚠️ blocked by environment/device restriction (`INSTALL_FAILED_USER_RESTRICTED` while installing debug APK).
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' test` ⚠️ destination unavailable locally.
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17e,OS=26.4' test` ✅

## Suggested labels
- type:feature
- area:producers
- platform:cross
- priority:P2
