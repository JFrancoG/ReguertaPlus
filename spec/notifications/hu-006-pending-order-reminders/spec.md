# HU-006 - Pending order reminders

## Metadata
- issue_id: #10
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member with commitments I want reminders when I have not confirmed my order so that I avoid forgetting.

## Scope

### In Scope
- Implement capability defined by HU-006 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-006.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-NOTI-02, RF-NOTI-03

## Acceptance criteria

- If order is not started or in cart, push reminders are sent on Sunday at 20:00, 22:00, and 23:00.
- If order is confirmed, no reminder is sent.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on FCM and scheduled jobs in Europe/Madrid timezone.

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
