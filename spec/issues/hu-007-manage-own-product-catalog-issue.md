# [HU-007] Manage own product catalog

## Summary

As a producer I want to create, update, and archive my products so that I keep my offer up to date.

## Links
- Spec: spec/products/hu-007-manage-own-product-catalog/spec.md
- Plan: spec/products/hu-007-manage-own-product-catalog/plan.md
- Tasks: spec/products/hu-007-manage-own-product-catalog/tasks.md

## Acceptance criteria

- Producer can create/update/archive own products.
- vendorId cannot be changed after creation.
- Stock supports direct value editing and extended/infinite mode.
- Product supports `unitAbbreviation` and `packContainerAbbreviation`.
- Eco-basket products require `ecoBasketOption` (`pickup` or `no_pickup`).
- Eco-basket price cannot diverge by option (`pickup`/`no_pickup`) or by parity producer.

## Scope
### In Scope
- Implement story HU-007 within MVP scope.
- Satisfy linked RFs: RF-CAT-01, RF-CAT-02, RF-CAT-03, RF-CAT-04, RF-CAT-05, RF-CAT-06, RF-CAT-10, RF-CAT-11, RF-CAT-12.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:products
- platform:cross
- priority:P1
