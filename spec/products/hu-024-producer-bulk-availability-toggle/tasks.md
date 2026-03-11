# Tasks - HU-024 (Producer bulk availability toggle)

## 1. Preparation
- [ ] Confirm producer-level source-of-truth field (`users.producerCatalogEnabled`).
- [ ] Confirm ordering query combines producer and product visibility rules.
- [ ] Define confirmation and feedback UX.

## 2. Android implementation
- [ ] Add bulk toggle action in producer product screen.
- [ ] Implement confirmation and apply flow.

## 3. iOS implementation
- [ ] Add bulk toggle action in producer product screen.
- [ ] Implement confirmation and apply flow.

## 4. Backend / Firestore
- [ ] Validate producer can update only own `producerCatalogEnabled`.
- [ ] Ensure order-list queries filter by `producerCatalogEnabled`, `isAvailable`, and `archived`.

## 5. Testing
- [ ] Unit tests for ownership checks.
- [ ] Integration tests for producer-level + product-level combined visibility.
- [ ] Manual validation for both toggle directions preserving existing `products.isAvailable`.

## 6. Documentation
- [ ] Update issue notes and decisions.
- [ ] Document parity status.

## 7. Closure
- [ ] Link issue and PR.
- [ ] Complete DoD checklist.
