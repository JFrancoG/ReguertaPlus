# Tasks - HU-026 (Weighted products priced by weight unit)

## 1. Preparation
- [ ] Confirm final weighted field contract (`pricingMode`, `price`, `weightStep`, min/max).
- [ ] Define rounding and subtotal calculation policy.

## 2. Android implementation
- [ ] Add weighted pricing controls in producer product form.
- [ ] Add decimal weight input for weighted products in consumer order flow.
- [ ] Apply weighted subtotal and validation logic.

## 3. iOS implementation
- [ ] Add weighted pricing controls in producer product form.
- [ ] Add decimal weight input for weighted products in consumer order flow.
- [ ] Apply weighted subtotal and validation logic.

## 4. Backend / Firestore
- [ ] Add weighted fields in `products` and `orderlines` schema handling.
- [ ] Enforce weighted validation rules and compatibility mapping.
- [ ] Update indexes/rules only if required by new queries.

## 5. Testing
- [ ] Unit tests for validation and subtotal math.
- [ ] Integration tests for create/edit product and place/edit order.
- [ ] Manual parity validation for Android/iOS and legacy compatibility.

## 6. Documentation
- [ ] Update requirements/spec references.
- [ ] Document parity status and migration notes.

## 7. Closure
- [ ] Link issue and PR.
- [ ] Complete DoD checklist.
