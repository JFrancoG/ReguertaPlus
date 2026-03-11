# Tasks - HU-010 (Manage members and roles)

## 1. Preparation
- [ ] Review linked RFs and acceptance criteria for this story.
- [ ] Identify impacted components/layers in Android, iOS, and backend.
- [ ] Define test scenarios (happy path and edge cases).
- [ ] Align onboarding rule: pre-authorized email in `users` before operational access.

## 2. Android implementation
- [ ] Implement UI/ViewModel/domain layer changes.
- [ ] Integrate required read/write data flows.
- [ ] Validate loading, error, and success states.
- [ ] Implement unauthorized alert and restricted mode when auth email is not pre-authorized.
- [ ] Implement first authorized login/register path to home.

## 3. iOS implementation
- [ ] Implement equivalent SwiftUI/ViewModel/domain layer changes.
- [ ] Integrate required read/write data flows.
- [ ] Validate loading, error, and success states.
- [ ] Implement unauthorized alert and restricted mode when auth email is not pre-authorized.
- [ ] Implement first authorized login/register path to home.

## 4. Backend / Firestore
- [ ] Adjust schema/queries/rules/functions where applicable.
- [ ] Verify compatibility with existing data and incremental strategy.
- [ ] Confirm role-based access and security behavior.
- [ ] Add/validate `users.emailNormalized` and nullable `users.authUid` contract.
- [ ] Enforce secure first-login `authUid` link and block operational writes for unauthorized accounts.

## 5. Testing
- [ ] Execute unit tests for impacted areas.
- [ ] Execute required integration tests.
- [ ] Perform full manual acceptance validation.
- [ ] Validate scenario: authenticated but not authorized email => alert + disabled operational features.
- [ ] Validate scenario: pre-authorized email first login/register => home + enabled role-based access.

## 6. Documentation
- [ ] Update technical notes in the linked issue.
- [ ] Record implementation decisions made during development.
- [ ] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
