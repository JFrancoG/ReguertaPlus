# [HU-024] Producer bulk availability toggle

## Summary

As a producer I want to set all my products available or unavailable in one action so weekly changes are fast.

## Links
- Spec: spec/products/hu-024-producer-bulk-availability-toggle/spec.md
- Plan: spec/products/hu-024-producer-bulk-availability-toggle/plan.md
- Tasks: spec/products/hu-024-producer-bulk-availability-toggle/tasks.md

## Acceptance criteria

- Producer can set all own products to available.
- Producer can set all own products to unavailable.
- Confirmation is required before applying bulk change.

## Scope
### In Scope
- Implement story HU-024 within MVP scope.
- Satisfy linked RFs: RF-CAT-07.

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
