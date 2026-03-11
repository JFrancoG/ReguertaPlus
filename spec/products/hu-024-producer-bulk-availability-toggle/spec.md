# HU-024 - Producer bulk availability toggle

## Metadata
- issue_id: #24
- priority: P2
- platform: both
- status: ready

## Context and problem

Producers need to quickly pause/resume catalog visibility for weekly operation changes (vacation/sickness) without losing product-level availability setup.

## User story

As a producer I want to toggle my catalog visibility in one action so weekly pauses are fast and product-level availability is preserved.

## Scope

### In Scope
- Catalog visibility toggle stored in `users.producerCatalogEnabled` for producer-owned account.
- Confirmation step before applying change.
- Ordering visibility rule combining producer and product state.

### Out of Scope
- Bulk rewriting all `products.isAvailable` values.
- Advanced segmented/batched partial toggle rules.

## Linked functional requirements

- RF-CAT-07
- RF-CAT-13

## Acceptance criteria

- Producer can set own `producerCatalogEnabled` to true/false.
- Disabling producer catalog visibility hides producer `companyName` and products from ordering lists.
- Re-enabling producer catalog visibility keeps previous `products.isAvailable` values unchanged.
- A confirmation step is required before applying the bulk change.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.

## Risks

- Risk: accidental bulk changes.
  - Mitigation: confirmation dialog and clear post-action feedback.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
