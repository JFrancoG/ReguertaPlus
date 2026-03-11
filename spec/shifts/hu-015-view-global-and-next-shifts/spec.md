# HU-015 - View global and next shifts

## Metadata
- issue_id: #11
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want to see all shifts and my upcoming ones so that I can plan ahead.

## Scope

### In Scope
- Implement capability defined by HU-015 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-015.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-TURN-01, RF-TURN-02

## Acceptance criteria

- A global shift view is available.
- Next delivery and market shifts are clearly shown for the member.

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
