# Tasks - HU-045 (Firestore security for producer order status)

## 1. Preparation
- [ ] Define producer status write paths and ownership rules.
- [ ] Define status transition constraints for rule validation.
- [ ] Prepare security test matrix by role and environment.

## 2. Android implementation
- [ ] Align status write payload/path with hardened rule contract.
- [ ] Handle permission-denied errors with explicit UX feedback.
- [ ] Add Android tests for denied/allowed write behavior.

## 3. iOS implementation
- [ ] Align status write payload/path with hardened rule contract.
- [ ] Handle permission-denied errors with explicit UX feedback.
- [ ] Add iOS tests for denied/allowed write behavior.

## 4. Backend / Firestore
- [ ] Implement Firestore rules for producer status writes.
- [ ] Add emulator security tests for role-based allow/deny cases.
- [ ] Validate develop/production path coverage in rule tests.

## 5. Testing
- [ ] Execute Firestore rules test suite.
- [ ] Execute Android and iOS integration checks for status updates.
- [ ] Perform manual producer/admin validation in develop.

## 6. Documentation
- [ ] Document rule contract and transition table.
- [ ] Update issue notes with allow/deny evidence.
- [ ] Document parity status and temporary gaps (if any).

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach rule test logs and functional validation output.
