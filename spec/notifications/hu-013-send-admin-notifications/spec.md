# HU-013 - Send admin notifications

## Metadata
- issue_id: #17
- priority: P2
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As an admin I want to send notifications through enabled modes so that I can communicate incidents and updates to registered member devices.

## Scope

### In Scope
- Implement capability defined by HU-013 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-013.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-NOTI-04, RF-NOTI-05

## Acceptance criteria

- Admin can send notifications using the enabled MVP segments/modes.
- Delivery targets are resolved from `users/{userId}/devices/{deviceId}`.
- `users.lastDeviceId` is available as pointer to latest active device per member.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-structure-mvp-proposal-v1.md.
- Depends on FCM and scheduled jobs in Europe/Madrid timezone.
- Depends on `users/{userId}/devices` metadata quality and `users.lastDeviceId` maintenance.

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
