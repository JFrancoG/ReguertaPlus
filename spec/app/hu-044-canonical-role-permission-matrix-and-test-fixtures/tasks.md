# Tasks - HU-044 (Canonical role permission matrix and test fixtures)

## 1. Preparation
- [ ] Define canonical role-permission matrix schema and storage path.
- [ ] Inventory current permission checks and fixture role assumptions.
- [ ] Confirm MVP role list and capability boundaries.

## 2. Android implementation
- [ ] Align Android capability checks with matrix.
- [ ] Update Android test fixtures/seeds to match matrix.
- [ ] Add drift-detection tests for Android role gating.

## 3. iOS implementation
- [ ] Align iOS capability checks with matrix.
- [ ] Update iOS test fixtures/seeds to match matrix.
- [ ] Add drift-detection tests for iOS role gating.

## 4. Backend / Firestore
- [ ] Validate backend role assumptions against matrix.
- [ ] Update any backend role checks that diverge from canonical contract.

## 5. Testing
- [ ] Execute Android unit/integration tests for role gating.
- [ ] Execute iOS unit/UI tests for role gating.
- [ ] Perform manual cross-role validation in develop.

## 6. Documentation
- [ ] Document canonical matrix and ownership.
- [ ] Link matrix from related HU specs/issues.
- [ ] Record parity status and known exceptions (if any).

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and drift-check results.
