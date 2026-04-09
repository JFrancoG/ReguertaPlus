# HU-004 - Edit confirmed order within deadline

## Metadata
- issue_id: #8
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want to modify a confirmed order before the cutoff so that I can adjust my needs.

## Scope

### In Scope
- Implement capability defined by HU-004 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-004.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-ORD-08

## Acceptance criteria

- With open deadline, user can increase/decrease quantity, remove, and add lines.
- If edits break commitments, confirmation is blocked.

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
