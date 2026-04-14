# [HU-008] View received orders

## Summary

As a producer I want to review received orders by product and by member so that I can prepare delivery.

## Links
- Spec: spec/producers/hu-008-view-received-orders/spec.md
- Plan: spec/producers/hu-008-view-received-orders/plan.md
- Tasks: spec/producers/hu-008-view-received-orders/tasks.md

## Acceptance criteria

- During enabled period, tabs by product and by member are visible.
- Outside enabled period, access appears disabled.

## Scope
### In Scope
- Implement story HU-008 within MVP scope.
- Satisfy linked RFs: RF-PROD-01, RF-PROD-02, RF-PROD-03.

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
- Added concrete `Received orders` route in Android and iOS home navigation (removed placeholder fallback for this destination).
- Added two-tab producer UI (`By product` / `By member`) with producer-scoped `orderlines` as read model.
- Added sticky/fixed bottom general total bar in both platforms to keep overall amount visible while scrolling.
- Added explicit disabled/out-of-window state using weekly delivery window logic already used by ordering flow.
- Kept data strategy incremental: no new write paths; reused existing order checkout payload (`consumerDisplayName`, `productName`, packaging fields, subtotal).

## Validation evidence
- Android: `./gradlew app:testDebugUnitTest` ✅
- Android: `./gradlew app:lintDebug` ✅
- Android: `./gradlew app:connectedDebugAndroidTest` ⚠️ blocked by environment (`INSTALL_FAILED_USER_RESTRICTED` while installing androidTest APK).
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17e,OS=26.4' test` ✅

## Suggested labels
- type:feature
- area:producers
- platform:cross
- priority:P1
