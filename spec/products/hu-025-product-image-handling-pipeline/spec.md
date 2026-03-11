# HU-025 - Product image handling pipeline

## Metadata
- issue_id: #25
- priority: P2
- platform: both
- status: ready

## Context and problem

Producers need a reliable image workflow so product listings remain clear and complete.

## User story

As a producer I want to pick/crop/upload a product image from the product form so listings stay visually complete.

## Scope

### In Scope
- Image pick from device.
- Crop/resize before upload.
- Upload to Firebase Storage and persist URL in product.

### Out of Scope
- Advanced image editing features.

## Linked functional requirements

- RF-CAT-08

## Acceptance criteria

- Producer can select an image in product create/edit flow.
- Selected image is processed and uploaded to Storage.
- Saved product keeps valid image URL.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.
- Depends on Firebase Storage integration.

## Risks

- Risk: upload failures and broken image URLs.
  - Mitigation: upload error handling and rollback-safe save flow.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
