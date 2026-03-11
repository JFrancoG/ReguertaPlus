# HU-018 - Production reviewer routed to develop

## Metadata
- issue_id: #13
- priority: P1
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a reviewer I want to run full test flows without impacting real production data.

## Scope

### In Scope
- Implement capability defined by HU-018 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-018.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-REV-01, RF-REV-02, RF-REV-03

## Acceptance criteria

- Allowlisted reviewer in production app is routed to develop backend.
- Reviewer writes never affect real production dataset.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on reviewer allowlist and backend routing to develop environment.

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
