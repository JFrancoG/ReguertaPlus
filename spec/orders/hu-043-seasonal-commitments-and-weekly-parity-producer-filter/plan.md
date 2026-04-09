# Plan - HU-043 (Seasonal commitments and weekly parity producer filter)

## 1. Technical approach

Implement a dedicated commitment data source (`seasonalCommitments`) and extend My Order filtering/validation using ISO-week parity and active seasonal commitments for the current member.

## 2. Layer impact
- UI: My Order list visibility and checkout warning details.
- Domain: Seasonal commitment model + validation composition.
- Data: Seasonal commitment repositories (Firestore + in-memory + chained).
- Backend: No backend logic change required; consumes existing collection contract.
- Docs: HU spec/tasks/issue traceability update.

## 3. Platform-specific changes
### Android
- Add `SeasonalCommitment` domain/repository and data implementations.
- Load commitments together with My Order products feed.
- Filter parity-scoped producer products by current ISO week parity.
- Extend checkout validation to enforce seasonal fixed quantities on offered products.

### iOS
- Add equivalent `SeasonalCommitment` domain/repository and data implementations.
- Mirror Android parity filter and seasonal commitment validation in My Order flow.

### Functions/Backend
- No changes expected in this HU (collection already defined in contract).

## 4. Test strategy
- Unit tests for parity filter and validation (eco + seasonal commitments).
- Existing suite regression on both clients.
- Manual verification of parity week switch behavior.

## 5. Rollout and functional validation
- Validate with current week parity and opposite parity scenarios.
- Validate commitment warning with missing seasonal products and successful checkout when satisfied.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Add HU artifacts and issue link.
- Define parity and seasonal commitment domain models.

### Phase 2 - Implementation
- Implement Android and iOS data + domain + UI wiring.
- Add tests on both platforms.

### Phase 3 - Closure
- Run validations and document evidence.
- Link PR and close issue via merge.

## 7. Technical risks and mitigation
- Risk: mismatch in parity week computation.
  - Mitigation: ISO-week based helper with test cases in Android and iOS.
- Risk: false seasonal validation for unavailable products.
  - Mitigation: validate only commitments whose products are visible in current My Order feed.
