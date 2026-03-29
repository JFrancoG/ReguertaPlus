# Tasks - HU-010 (Manage members and roles)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Identify impacted components/layers in Android, iOS, and backend.
- [x] Define test scenarios (happy path and edge cases).
- [x] Align onboarding rule: pre-authorized email in `users` before operational access.

## 2. Android implementation
- [x] Implement UI/ViewModel/domain layer changes.
- [x] Integrate required read/write data flows.
- [x] Validate loading, error, and success states.
- [x] Implement first authorized login/register path to home.

## 3. iOS implementation
- [x] Implement equivalent SwiftUI/ViewModel/domain layer changes.
- [x] Integrate required read/write data flows.
- [x] Validate loading, error, and success states.
- [x] Implement first authorized login/register path to home.

## 4. Backend / Firestore
- [x] Adjust schema/queries/rules/functions where applicable.
- [x] Verify compatibility with existing data and incremental strategy.
- [x] Confirm role-based access and security behavior.
- [x] Add/validate canonical `users.normalizedEmail` with write-time normalization, keep legacy read compatibility (`emailNormalized`/`email`), and nullable `users.authUid` contract.
- [x] Enforce secure first-login `authUid` link and block operational writes for unauthorized accounts.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [x] Execute required integration tests.
- [ ] Perform full manual acceptance validation.
- [x] Validate scenario: pre-authorized email first login/register => home + enabled role-based access.

## 6. Documentation
- [x] Update technical notes in the linked issue.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Attach test evidence and functional validation output.
