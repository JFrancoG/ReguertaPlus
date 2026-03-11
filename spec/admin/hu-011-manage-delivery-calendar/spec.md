# HU-011 - Manage delivery calendar

## Metadata
- issue_id: #2
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As an admin I want to move upcoming delivery days so that operations adapt to holidays and weather alerts.

## Scope

### In Scope
- Implement capability defined by HU-011 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-011.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-CAL-01, RF-CAL-02, RF-CAL-03, RF-CAL-04, RF-CAL-05

## Acceptance criteria

- Only admin can modify upcoming delivery calendar weeks.
- After a day change, blocking/opening windows are recalculated correctly.
- Overrides are stored as `deliveryCalendar/{weekKey}` where document ID equals `weekKey`.
- Weeks without a `deliveryCalendar/{weekKey}` document resolve using `config/global.deliveryDayOfWeek`.
- Removing a week override reverts that week to default schedule resolution.

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

- [ ] Story acceptance criteria validated.
- [ ] Implementation aligned with linked RFs.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [ ] Technical/functional documentation updated.
- [ ] Issue and PR linked.
