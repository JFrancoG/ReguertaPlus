# Tasks - HU-015 (View global and next shifts)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Identify impacted components/layers in Android and iOS app-shell layers.
- [x] Define test scenarios (global list, next assigned delivery, next assigned market, empty state).

## 2. Android implementation
- [x] Implement UI/ViewModel/domain layer changes.
- [x] Integrate required read data flows from `plus-collections/shifts`.
- [x] Validate loading, empty, and assigned-summary states.

## 3. iOS implementation
- [x] Implement equivalent SwiftUI/ViewModel/domain layer changes.
- [x] Integrate required read data flows from `plus-collections/shifts`.
- [x] Validate loading, empty, and assigned-summary states.

## 4. Backend / Firestore
- [x] No backend/schema change required; reused existing `shifts` contract.
- [x] Verified compatibility with the existing Firestore structure and fallback repositories.
- [x] Confirmed read-only behavior for authorized members in app shell.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [x] Execute required platform validation builds.
- [ ] Perform full manual acceptance validation.

## 6. Documentation
- [x] Update technical notes in the linked issue artifacts.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md except issue/PR linkage.
- [ ] Attach test evidence and functional validation output.
