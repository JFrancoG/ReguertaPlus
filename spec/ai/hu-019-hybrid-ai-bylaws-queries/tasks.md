# Tasks - HU-019 (Hybrid AI bylaws queries)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Identify impacted components/layers in Android, iOS, and backend.
- [x] Define local bylaws data source and indexing strategy.
- [x] Define escalation policy thresholds (confidence/coverage/complexity).
- [x] Define timeout + fallback response behavior.
- [x] Define test scenarios (happy path and edge cases).

## 2. Android implementation
- [x] Implement local answer flow in UI/ViewModel/domain.
- [x] Integrate cloud escalation adapter with timeout/fallback.
- [x] Validate loading, local answer, escalated answer, and fallback states.

## 3. iOS implementation
- [x] Implement equivalent SwiftUI/ViewModel/domain flow.
- [x] Integrate cloud escalation adapter with timeout/fallback.
- [x] Validate loading, local answer, escalated answer, and fallback states.

## 4. Backend / Firestore
- [x] Implement/adjust cloud gateway/config only where required.
- [x] Verify compatibility with existing data and incremental strategy.
- [x] Confirm environment isolation, role-based access, and security behavior.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [ ] Execute required integration tests.
- [ ] Perform full manual acceptance validation.
- [ ] Validate escalation telemetry and fallback coverage.

## 6. Documentation
- [ ] Update technical notes in the linked issue.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
