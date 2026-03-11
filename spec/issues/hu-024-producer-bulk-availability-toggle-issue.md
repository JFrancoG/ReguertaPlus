# [HU-024] Producer bulk availability toggle

## Summary

As a producer I want to toggle my catalog visibility in one action so weekly pauses are fast without overwriting per-product availability.

## Links
- Spec: spec/products/hu-024-producer-bulk-availability-toggle/spec.md
- Plan: spec/products/hu-024-producer-bulk-availability-toggle/plan.md
- Tasks: spec/products/hu-024-producer-bulk-availability-toggle/tasks.md

## Acceptance criteria

- Producer can set own `producerCatalogEnabled` to true/false.
- Disabling producer catalog visibility hides producer `companyName` and products from ordering lists.
- Re-enabling producer catalog visibility keeps existing per-product `isAvailable` values.
- Confirmation is required before applying bulk change.

## Scope
### In Scope
- Implement story HU-024 within MVP scope.
- Satisfy linked RFs: RF-CAT-07 and RF-CAT-13.

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
- priority:P2

## Dependencies
- #3 (HU-007)
