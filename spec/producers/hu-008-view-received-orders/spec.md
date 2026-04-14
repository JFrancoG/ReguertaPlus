# HU-008 - View received orders

## Metadata
- issue_id: #9
- priority: P1
- platform: both
- status: in_review

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a producer I want to review received orders by product and by member so that I can prepare delivery.

## Scope

### In Scope
- Implement capability defined by HU-008 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-008.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-PROD-01, RF-PROD-02, RF-PROD-03

## Acceptance criteria

- During enabled period, tabs by product and by member are visible.
- Outside enabled period, access appears disabled.
- Member tab may be built from producer-scoped `orderlines`, grouped by `consumerDisplayName`, without requiring a separate `orders` primary list fetch.

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
- [x] Issue and PR linked.
