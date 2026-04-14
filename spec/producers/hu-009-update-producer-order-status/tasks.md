# Tasks - HU-009 (Update producer order status)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Identify impacted components/layers in Android, iOS, and backend.
- [x] Define test scenarios (happy path and edge cases).

## 2. Android implementation
- [x] Implement UI/ViewModel/domain layer changes.
- [x] Integrate required read/write data flows.
- [x] Validate loading, error, and success states.

## 3. iOS implementation
- [x] Implement equivalent SwiftUI/ViewModel/domain layer changes.
- [x] Integrate required read/write data flows.
- [x] Validate loading, error, and success states.

## 4. Backend / Firestore
- [x] Adjust schema/queries/rules/functions where applicable. (No new Functions trigger required; checkout payload and order status write path now persist `producerStatusesByVendor` with legacy `producerStatus` compatibility.)
- [x] Verify compatibility with existing data and incremental strategy.
- [x] Confirm role-based access and security behavior.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [x] Execute required integration tests.
- [x] Perform full manual acceptance validation.

## 6. Documentation
- [x] Update technical notes in the linked issue.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Attach test evidence and functional validation output.
