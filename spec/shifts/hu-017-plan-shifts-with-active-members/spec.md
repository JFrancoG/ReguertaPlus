# HU-017 - Plan shifts with active members

## Metadata
- issue_id: #4
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As an admin or planning system I want to generate shifts using only active members so that planning remains fair and valid.

## Scope

### In Scope
- Implement capability defined by HU-017 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-017.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-TURN-03, RF-TURN-04, RF-TURN-07

## Acceptance criteria

- Members with `isActive = false` are excluded from planning.
- New/reactivated members are appended at the end.
- Market ensures minimum three members with fallback from next in rotation.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on shifts, swap requests, and change notifications.

## Risks

- Main risk: misalignment between business rules and data rules.
  - Mitigation: validate against linked RFs and acceptance tests.
- Secondary risk: regression in existing weekly workflows.
  - Mitigation: weekly-window regression tests by role.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Implementation aligned with linked RFs.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [ ] Technical/functional documentation updated.
- [ ] Issue and PR linked.
