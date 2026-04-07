# HU-007 - Manage own product catalog

## Metadata
- issue_id: #3
- priority: P1
- platform: both
- status: implemented

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a producer I want to create, update, and archive my products so that I keep my offer up to date.

## Scope

### In Scope
- Implement capability defined by HU-007 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-007.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-CAT-01, RF-CAT-02, RF-CAT-03, RF-CAT-04, RF-CAT-05, RF-CAT-06, RF-CAT-10, RF-CAT-11, RF-CAT-12

## Acceptance criteria

- Producer can create/update/archive own products.
- vendorId cannot be changed after creation.
- Stock supports direct value editing and extended/infinite mode.
- Product supports `unitAbbreviation` and `packContainerAbbreviation`.
- Eco-basket products require `ecoBasketOption` (`pickup` or `no_pickup`).
- Eco-basket price cannot diverge by option (`pickup`/`no_pickup`) or by parity producer.

## MVP implementation notes

- This first slice supports producer self-management from app shell on Android and iOS.
- Image remains a direct `productImageUrl` text field; picker/upload is deferred to HU-025.
- Product creation uses fixed pricing only in this MVP slice; weighted-product flow is deferred to HU-026.
- `companyName` is currently derived from the authenticated producer display name until a dedicated producer company field is surfaced in session/domain models.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on authentication, role permissions, and MVP Firestore model.

## Risks

- Main risk: misalignment between business rules and data rules.
  - Mitigation: validate against linked RFs and acceptance tests.
- Secondary risk: regression in existing weekly workflows.
  - Mitigation: weekly-window regression tests by role.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
