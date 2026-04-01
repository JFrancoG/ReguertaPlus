# HU-014 - Shared member profile

## Metadata
- issue_id: #18
- priority: P2
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want to share a photo and family text so that other members can know us better.

## Scope

### In Scope
- Implement capability defined by HU-014 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-014.
- Use the existing `sharedProfiles/{userId}` contract with `familyNames`, `photoUrl`, `about`, and `updatedAt`.
- Provide one shared `Profile` route where the member can edit their own content and browse community profiles.
- Keep this iteration aligned to the documented `photoUrl` field without adding a native upload pipeline yet.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-PERF-01, RF-PERF-02, RF-PERF-03, RF-PERF-04

## Acceptance criteria

- Member can create/edit/delete own shared profile.
- Members can view photo, family names, and text from other members.

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
