# Plan - HU-024 (Producer bulk availability toggle)

## 1. Technical approach

Add a producer-level bulk action that updates `isAvailable` for all producer-owned products.

## 2. Layer impact
- UI: Bulk toggle control, confirmation, success/error feedback.
- Domain: Ownership and authorization validation.
- Data: Batch/transaction update strategy for product availability.
- Backend: Firestore rules compatibility and safety checks.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Add bulk availability action in producer catalog UX.

### iOS
- Add equivalent bulk availability action and confirmation.

### Functions/Backend
- Ensure write rules allow only producer-owned updates.

## 4. Test strategy
- Unit tests for ownership/authorization checks.
- Integration tests for batch updates.
- Manual tests for available/unavailable toggles.

## 5. Rollout and validation
- Validate with producer test users in develop.
- Confirm parity Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm exact scope of affected products.

### Phase 2 - Implementation
- Implement UX + data updates + safeguards.

### Phase 3 - Closure
- Validate outcomes and document evidence.

## 7. Risks and mitigation
- Risk: partial update failures.
  - Mitigation: transactional/batched write approach with retry strategy.
