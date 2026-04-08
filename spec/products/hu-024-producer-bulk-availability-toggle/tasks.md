# Tasks - HU-024 (Producer bulk availability toggle)

## 1. Preparation
- [x] Confirm producer-level source-of-truth field (`users.producerCatalogEnabled`).
- [x] Confirm ordering query combines producer and product visibility rules.
- [x] Define confirmation and feedback UX.

## 2. Android implementation
- [x] Add bulk toggle action in producer product screen.
- [x] Implement confirmation and apply flow.

## 3. iOS implementation
- [x] Add bulk toggle action in producer product screen.
- [x] Implement confirmation and apply flow.

## 4. Backend / Firestore
- [x] Validate producer can update only own `producerCatalogEnabled`.
- [x] Ensure order-list queries filter by `producerCatalogEnabled`, `isAvailable`, and `archived`.

## 5. Testing
- [ ] Unit tests for ownership checks.
- [ ] Integration tests for producer-level + product-level combined visibility.
- [x] Manual validation for both toggle directions preserving existing `products.isAvailable`.

## 6. Documentation
- [x] Update issue notes and decisions.
- [x] Document parity status.

## 7. Closure
- [ ] Link issue and PR.
- [ ] Complete DoD checklist.
