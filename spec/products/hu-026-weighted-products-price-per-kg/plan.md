# Plan - HU-026 (Weighted products priced by weight unit)

## 1. Technical approach

Extend product and orderline schemas with weighted-pricing fields and support decimal weight ordering while preserving current fixed-unit behavior.

## 2. Layer impact
- UI: Producer product form adds weighted pricing controls; consumer order flow accepts decimal weight input.
- Domain: Pricing-mode validation, decimal quantity checks, subtotal calculation rules.
- Data: New optional fields in `products` and `orderlines`; compatibility defaults for legacy docs.
- Backend: Firestore rules/schema validation and safe migration/backfill strategy.
- Docs: Requirements/spec/issue updates.

## 3. Platform-specific changes
### Android
- Add weighted fields to product form and decimal quantity input in order UI.
- Apply shared subtotal and rounding logic.

### iOS
- Add equivalent weighted fields and decimal weight input.
- Apply same rounding and validation logic.

### Functions/Backend
- Enforce weighted field consistency in writes.
- Keep legacy reads compatible with mode-aware handling.

## 4. Test strategy
- Unit tests for pricing-mode validation and subtotal math.
- Integration tests for weighted product create/edit and order confirmation.
- Manual tests for producer/member flows and parity checks.

## 5. Rollout and validation
- Enable in develop first with producer pilot users.
- Validate no regressions for fixed-unit products.
- Promote to production after parity and data checks.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Finalize weighted field contract and rounding rule.

### Phase 2 - Data and backend
- Add schema fields and compatibility mapping.

### Phase 3 - App implementation
- Implement Android and iOS weighted product/order UX.

### Phase 4 - Closure
- Validate end-to-end behavior and document migration notes.

## 7. Risks and mitigation
- Risk: decimal precision drift.
  - Mitigation: fixed decimal policy and shared test vectors.
- Risk: migration confusion between `fixed` and `weight`.
  - Mitigation: explicit defaults and data checks during rollout.
