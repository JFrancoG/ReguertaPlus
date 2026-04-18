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
- Standardized crop/resize pipeline before upload.
- Upload to Firebase Storage and persist URL in product.
- Reusable image pipeline manager usable from multiple screens (not only product form).

### Out of Scope
- Advanced image editing features.

## Linked functional requirements

- RF-CAT-08

## Acceptance criteria

- Producer can select an image in product create/edit flow.
- Selected image is processed and uploaded to Storage.
- Image processing is deterministic and shared:
  - Resize so the shortest side becomes exactly `300 px`.
  - Keep aspect ratio for the long side.
  - Perform centered crop on the long side to get final `300 x 300`.
  - Apply output compression/quality policy before upload.
- Processing/upload is orchestrated by a reusable manager interface used by more than one UI route.
- Saved product keeps valid image URL.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.
- Depends on Firebase Storage integration.

## Risks

- Risk: upload failures and broken image URLs.
  - Mitigation: upload error handling and rollback-safe save flow.
- Risk: divergent image outputs between Android and iOS.
  - Mitigation: common algorithm contract (same resize/crop/compression rules) and parity validation with shared fixtures.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
