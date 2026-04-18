# Tasks - HU-050 (Users route, member directory, and admin management)

## 1. Preparation
- [ ] Confirm final users-route UX for admin and non-admin flows.
- [ ] Confirm reuse strategy for existing HU-010 member-management logic.
- [ ] Define Android/iOS parity checklist by acceptance criterion.

## 2. Android implementation
- [ ] Replace `HomeDestination.USERS` placeholder with concrete users-route UI.
- [ ] Render member directory list with loading/empty/error handling.
- [ ] Gate admin-only actions behind role/capability checks.
- [ ] Validate users-route navigation/back behavior from drawer flow.

## 3. iOS implementation
- [ ] Replace `.users` placeholder with concrete users-route UI.
- [ ] Render member directory list with loading/empty/error handling.
- [ ] Gate admin-only actions behind role/capability checks.
- [ ] Validate users-route navigation/back behavior from drawer flow.

## 4. Backend / Firestore
- [ ] Confirm no backend schema/function changes are required.
- [ ] Validate existing security/rules still block non-admin mutations.

## 5. Testing
- [ ] Execute unit tests for role-gated users actions and last-admin guard.
- [ ] Execute integration tests for list loading and admin mutations.
- [ ] Perform manual validation for admin and non-admin drawer-to-users flows.

## 6. Documentation
- [ ] Update technical notes and parity evidence in linked issue.
- [ ] Document any temporary parity gap and follow-up task if needed.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
