# HU-019 - Hybrid AI bylaws queries

## Metadata
- issue_id: #20
- priority: P3
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want fast bylaws answers so that I can resolve questions quickly.

## Scope

### In Scope
- Implement capability defined by HU-019 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-019.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-IA-01

## Acceptance criteria

- Regular questions are answered locally.
- Complex questions can escalate to cloud mode.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on local+cloud hybrid strategy and/or Google Sheets integration.

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
