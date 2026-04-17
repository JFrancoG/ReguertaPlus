# Tasks - HU-045 (Firestore security for producer order status)

## 1. Preparation
- [x] Define producer status write paths and ownership rules.
- [x] Define status transition constraints for rule validation.
- [x] Prepare security test matrix by role and environment.

## 2. Android implementation
- [x] Align status write payload/path with hardened rule contract.
- [x] Handle permission-denied errors with explicit UX feedback.
- [x] Add Android tests for denied/allowed write behavior.

## 3. iOS implementation
- [x] Align status write payload/path with hardened rule contract.
- [x] Handle permission-denied errors with explicit UX feedback.
- [x] Add iOS tests for denied/allowed write behavior.

## 4. Backend / Firestore
- [x] Implement Firestore rules for producer status writes.
- [x] Add emulator security tests for role-based allow/deny cases.
- [x] Validate develop/production path coverage in rule tests.

## 5. Testing
- [x] Execute Firestore rules test suite.
- [x] Execute Android and iOS integration checks for status updates.
- [ ] Perform manual producer/admin validation in develop.

## 6. Documentation
- [x] Document rule contract and transition table.
- [x] Update issue notes with allow/deny evidence.
- [x] Document parity status and temporary gaps (if any).

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Attach rule test logs and functional validation output.
