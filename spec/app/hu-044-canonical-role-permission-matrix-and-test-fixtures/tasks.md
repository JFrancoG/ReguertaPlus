# Tasks - HU-044 (Canonical role permission matrix and test fixtures)

## 1. Preparation
- [x] Define canonical role-permission matrix schema and storage path.
- [x] Inventory current permission checks and fixture role assumptions.
- [x] Confirm MVP role list and capability boundaries.

## 2. Android implementation
- [x] Align Android capability checks with matrix.
- [x] Update Android test fixtures/seeds to match matrix.
- [x] Add drift-detection tests for Android role gating.

## 3. iOS implementation
- [x] Align iOS capability checks with matrix.
- [x] Update iOS test fixtures/seeds to match matrix.
- [x] Add drift-detection tests for iOS role gating.

## 4. Backend / Firestore
- [x] Validate backend role assumptions against matrix.
- [x] Update any backend role checks that diverge from canonical contract.

## 5. Testing
- [x] Execute Android unit/integration tests for role gating.
- [x] Execute iOS unit/UI tests for role gating.
- [ ] Perform manual cross-role validation in develop.

## 6. Documentation
- [x] Document canonical matrix and ownership.
- [x] Link matrix from related HU specs/issues.
- [x] Record parity status and known exceptions (if any).

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Attach test evidence and drift-check results.
