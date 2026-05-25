# Tasks - HU-058 (Weekly order history)

## 1. Preparation
- [x] Create implementation branch.
- [x] Create GitHub issue.
- [x] Add local spec/plan/tasks.

## 2. Android implementation
- [x] Add order-history repository methods and implementations.
- [x] Add `MyOrdersHistoryViewModel`.
- [x] Add weekly selector and order-summary Compose components.
- [x] Connect `MY_ORDERS` route.

## 3. iOS implementation
- [x] Extend `OrdersRepository`.
- [x] Add `MyOrdersHistoryRouteViewModel`.
- [x] Add weekly selector and order-summary SwiftUI components.
- [x] Connect `.myOrders` route.

## 4. Backend / Firestore
- [x] Confirm no Functions changes are required.
- [x] Document any index/rules follow-up if discovered.

## 5. Testing
- [x] Add Android unit tests.
- [x] Add iOS unit tests.
- [x] Run Android unit tests and lint.
- [x] Run iOS xcodebuild tests.
- [x] Check connected Android test availability.

## 6. Documentation
- [x] Update issue mirror with implementation notes and validation evidence.
- [x] Update HU-058 specs for no-swipe navigation and revised year/week labels.
- [x] Complete DoD checklist in spec.md.

## 7. Closure
- [ ] Prepare PR with issue link and validation evidence.

## Validation evidence
- Android: `./gradlew app:testDebugUnitTest` passed.
- Android: `./gradlew app:lintDebug` passed.
- Android connected tests: attempted after starting `Small_Phone_API_35`, but Gradle reported `No connected devices`; `adb devices` remained empty.
- iOS: full `xcodebuild ... test` was attempted on `iPhone 17`, but the local simulator hung while launching `ReguertaUITests.xctrunner`; unit tests with `-only-testing:ReguertaTests` passed.
