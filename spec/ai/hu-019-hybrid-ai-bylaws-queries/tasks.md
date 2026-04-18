# Tasks - HU-019 (Hybrid AI bylaws queries)

## 1. Preparation
- [ ] Review linked RFs and acceptance criteria for this story.
- [ ] Identify impacted components/layers in Android, iOS, and backend.
- [ ] Define local bylaws data source and indexing strategy.
- [ ] Define escalation policy thresholds (confidence/coverage/complexity).
- [ ] Define timeout + fallback response behavior.
- [ ] Define test scenarios (happy path and edge cases).

## 2. Android implementation
- [ ] Implement local answer flow in UI/ViewModel/domain.
- [ ] Integrate cloud escalation adapter with timeout/fallback.
- [ ] Validate loading, local answer, escalated answer, and fallback states.

## 3. iOS implementation
- [ ] Implement equivalent SwiftUI/ViewModel/domain flow.
- [ ] Integrate cloud escalation adapter with timeout/fallback.
- [ ] Validate loading, local answer, escalated answer, and fallback states.

## 4. Backend / Firestore
- [ ] Implement/adjust cloud gateway/config only where required.
- [ ] Verify compatibility with existing data and incremental strategy.
- [ ] Confirm environment isolation, role-based access, and security behavior.

## 5. Testing
- [ ] Execute unit tests for impacted areas.
- [ ] Execute required integration tests.
- [ ] Perform full manual acceptance validation.
- [ ] Validate escalation telemetry and fallback coverage.

## 6. Documentation
- [ ] Update technical notes in the linked issue.
- [ ] Record implementation decisions made during development.
- [ ] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
