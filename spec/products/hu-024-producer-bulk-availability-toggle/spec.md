# HU-024 - Producer bulk availability toggle

## Metadata
- issue_id: #24
- priority: P2
- platform: both
- status: ready

## Context and problem

Producers need to quickly enable/disable their full catalog for weekly operation changes.

## User story

As a producer I want to set all my products available or unavailable in one action so weekly changes are fast.

## Scope

### In Scope
- Bulk toggle action for producer-owned products.
- Confirmation step before applying change.

### Out of Scope
- Advanced segmented/batched partial toggle rules.

## Linked functional requirements

- RF-CAT-07

## Acceptance criteria

- Producer can set all own products to available.
- Producer can set all own products to unavailable.
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
