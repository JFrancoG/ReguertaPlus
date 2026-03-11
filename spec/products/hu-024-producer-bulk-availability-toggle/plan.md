# Plan - HU-024 (Producer bulk availability toggle)

## 1. Technical approach

Add a producer-level toggle that updates `users.producerCatalogEnabled` and keep `products.isAvailable` for product-level availability only.

## 2. Layer impact
- UI: Bulk toggle control, confirmation, success/error feedback.
- Domain: Ownership and authorization validation.
- Data: Producer user-document update plus ordering-query filter alignment.
- Backend: Firestore rules compatibility and safety checks for producer-owned user document.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Add bulk availability action in producer catalog UX.

### iOS
- Add equivalent bulk availability action and confirmation.

### Functions/Backend
- Ensure write rules allow only producer-owned `producerCatalogEnabled` updates.

## 4. Test strategy
- Unit tests for ownership/authorization checks.
- Integration tests for producer-level visibility + product-level availability combined filtering.
- Manual tests for disable/enable toggle preserving prior `products.isAvailable` values.

## 5. Rollout and validation
- Validate with producer test users in develop.
- Confirm parity Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm exact scope of affected products.

### Phase 2 - Implementation
- Implement UX + producer flag update + visibility filtering safeguards.

### Phase 3 - Closure
- Validate outcomes and document evidence.

## 7. Risks and mitigation
- Risk: accidental catalog hide.
  - Mitigation: confirmation dialog and explicit state feedback.
