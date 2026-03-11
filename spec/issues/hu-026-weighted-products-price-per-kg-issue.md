# [HU-026] Weighted products priced by weight unit

## Summary

As a producer I want to configure products with `price` in `weight` mode and as a member I want to enter weight quantity directly so bulk buying is simple and avoids duplicate product entries.

## Links
- Spec: spec/products/hu-026-weighted-products-price-per-kg/spec.md
- Plan: spec/products/hu-026-weighted-products-price-per-kg/plan.md
- Tasks: spec/products/hu-026-weighted-products-price-per-kg/tasks.md

## Acceptance criteria

- Producer can create/edit product with `pricingMode = weight` and single `price`.
- Member can input decimal weight quantity for weighted products.
- Subtotal is computed as `quantity * price` in real time.
- Saved orderline keeps weighted snapshot fields (`pricingModeAtOrder`, `priceAtOrder`).
- Existing fixed-unit products keep working unchanged.

## Scope
### In Scope
- Implement story HU-026 as post-MVP catalog extension.
- Satisfy linked RFs: RF-CAT-09.

### Out of Scope
- Advanced fulfillment workflow with delivered-weight adjustments.
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
- priority:P3

## Dependencies
- #3 (HU-007)
