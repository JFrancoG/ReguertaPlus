# HU-002 - Validate commitments on confirm

## Metadata
- issue_id: #6
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member with commitments I want the system to validate my obligations before confirmation so that I avoid invalid orders.

## Scope

### In Scope
- Implement capability defined by HU-002 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-002.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-ORD-06, RF-COM-01, RF-COM-02, RF-COM-03, RF-COM-06, RF-COM-07, RF-COM-08

## Acceptance criteria

- If required commitment items are missing, confirmation is blocked with a warning.
- If commitments are met, order confirmation is allowed.
- Eco-basket commitment accepts either `pickup` or `no_pickup` option, and both remain paid.
- Eco-basket price is identical across `pickup`/`no_pickup` and parity producers.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on products/orders/orderlines collections and commitment rules.

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
- [x] Issue and PR linked.
