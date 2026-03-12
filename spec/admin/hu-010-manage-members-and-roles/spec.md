# HU-010 - Manage members and roles

## Metadata
- issue_id: #1
- priority: P1
- platform: both
- status: in_progress

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As an admin I want to manage member lifecycle, onboarding authorization, and privileges so that access control remains safe.

## Scope

### In Scope
- Implement capability defined by HU-010 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-010.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-ROL-03, RF-ROL-04, RF-ROL-05, RF-ROL-06, RF-ROL-07, RF-ROL-08

## Acceptance criteria

- Admin can access create/edit/deactivate actions.
- Granting/revoking admin cannot leave the app with zero admins.
- If a signed-in email is not pre-authorized in members list, app shows `Unauthorized user` and keeps operational modules disabled.
- If member email is pre-authorized by admin, first login/register enters home with role-based enabled access.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-structure-mvp-proposal-v1.md.
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
