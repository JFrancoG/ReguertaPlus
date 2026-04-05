# Tasks - HU-020 (Shifts backed by Google Sheets)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Identify impacted components/layers in Android, iOS, and backend.
- [x] Define test scenarios (happy path and edge cases).

## 2. Android implementation
- [x] No app changes required; Android already reads `plus-collections/shifts`.
- [x] Reused existing read/write data flows backed by Firestore.
- [x] No additional Android UI state required in this story.

## 3. iOS implementation
- [x] No app changes required; iOS already reads `plus-collections/shifts`.
- [x] Reused existing read/write data flows backed by Firestore.
- [x] No additional iOS UI state required in this story.

## 4. Backend / Firestore
- [x] Adjust schema/queries/rules/functions where applicable.
- [x] Verify compatibility with existing data and incremental strategy.
- [x] Confirm role-based access and security behavior.
- [x] Implement inbound sync from Google Sheets into `plus-collections/shifts`.
- [x] Implement outbound sync from confirmed app changes back into Google Sheets.
- [x] Define and test conflict/reconciliation rules for manual sheet edits vs app writes.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [x] Execute required integration tests (`functions` lint/build).
- [ ] Perform full manual acceptance validation.

## 6. Documentation
- [x] Update technical notes in the linked issue artifacts.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Attach test evidence and functional validation output.
