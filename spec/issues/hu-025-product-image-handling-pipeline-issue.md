# [HU-025] Product image handling pipeline

## Summary

As a producer I want to pick/crop/upload a product image from the product form so listings stay visually complete.

## Links
- Spec: spec/products/hu-025-product-image-handling-pipeline/spec.md
- Plan: spec/products/hu-025-product-image-handling-pipeline/plan.md
- Tasks: spec/products/hu-025-product-image-handling-pipeline/tasks.md

## Acceptance criteria

- Producer can select an image in product create/edit flow.
- Selected image is processed and uploaded to Storage.
- Saved product keeps valid image URL.

## Scope
### In Scope
- Implement story HU-025 within MVP scope.
- Satisfy linked RFs: RF-CAT-08.

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
