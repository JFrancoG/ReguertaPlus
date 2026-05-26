# Tasks - HU-059 (Received orders weekly history)

## 1. Preparation
- [x] Delete merged HU-058 remote branch.
- [x] Update `main` and create implementation branch.
- [x] Create GitHub issue.
- [x] Add local spec/plan/tasks.
- [x] Create and validate story bootstrap skill.

## 2. Android implementation
- [x] Add received-order history repository methods and implementations.
- [x] Extract reusable received-orders loading/model code from the route.
- [x] Add `ReceivedOrdersHistoryViewModel`.
- [x] Add weekly selector and read-only received-orders Compose route.
- [x] Connect side drawer destination while preserving home preparation route.

## 3. iOS implementation
- [x] Extend `OrdersRepository`.
- [x] Add received-order history Firestore/in-memory reads.
- [x] Add `ReceivedOrdersHistoryRouteViewModel`.
- [x] Add weekly selector and read-only received-orders SwiftUI route.
- [x] Connect side drawer destination while preserving home preparation route.

## 4. Backend / Firestore
- [x] Confirm no Functions changes are required.
- [x] Document any index/rules follow-up if discovered.

## 5. Testing
- [x] Add Android unit tests.
- [x] Add iOS unit tests.
- [x] Run Android unit tests and lint.
- [x] Run iOS xcodebuild unit tests.
- [x] Check connected Android test availability.

## 6. Documentation
- [x] Update issue mirror with implementation notes and validation evidence.
- [x] Complete DoD checklist in spec.md.

## 7. Closure
- [ ] Prepare PR with issue link and validation evidence.
