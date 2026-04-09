# Tasks - HU-043 (Seasonal commitments and weekly parity producer filter)

## 1. Preparation
- [x] Confirm parity-week filtering rule (ISO week odd/even).
- [x] Confirm seasonal commitment contract (`seasonalCommitments`) and effective scope.
- [x] Define Android/iOS parity checklist for this HU.

## 2. Android implementation
- [x] Add seasonal commitment domain/repository model and data sources.
- [x] Integrate commitment loading into My Order refresh flow.
- [x] Apply weekly parity producer filtering for My Order product visibility.
- [x] Extend checkout validation to include seasonal commitments.
- [x] Update My Order warning text composition if needed.

## 3. iOS implementation
- [x] Add seasonal commitment domain/repository model and data sources.
- [x] Integrate commitment loading into My Order refresh flow.
- [x] Apply weekly parity producer filtering for My Order product visibility.
- [x] Extend checkout validation to include seasonal commitments.

## 4. Backend / Firestore
- [x] Validate no schema/rule changes required for this HU.
- [x] Confirm collection path compatibility (`seasonalCommitments`).

## 5. Testing
- [x] Add/extend unit tests for parity filter behavior.
- [x] Add/extend unit tests for seasonal commitment validation.
- [x] Run platform validations and manual sanity checks.

## 6. Documentation
- [x] Keep HU spec/plan/tasks aligned with final implementation.
- [ ] Link issue and PR evidence.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Document parity status and residual risks.
