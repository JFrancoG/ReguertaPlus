# HU-009 - Update producer order status

## Metadata
- issue_id: #15
- priority: P2
- platform: both
- status: in_review

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a producer I want to update whole-order status so that members know preparation progress.

## Scope

### In Scope
- Implement capability defined by HU-009 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-009.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-PROD-04

## Acceptance criteria

- Only allowed statuses are unread, read, prepared, and delivered at full-order level.
- Initial value for a new or untouched producer order is `unread` (no null state).

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
