# HU-016 - Request shift swap

## Metadata
- issue_id: #12
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want to request a shift swap when I cannot attend so that I can resolve it in-app.

## Scope

### In Scope
- Implement capability defined by HU-016 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-016.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-TURN-05, RF-TURN-06

## Acceptance criteria

- Request stays pending for target member.
- Acceptance plus final confirmation applies the change.
- Applied change notifies all members.
- The request can be started from the shifts board against a specific assigned member or helper.
- A dedicated request screen captures the target member, reason, and shift context before submission.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on shifts, swap requests, and change notifications.
- Recommended after HU-020 and HU-041 so the workflow runs on synchronized data and the board already exposes the entry point.

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
