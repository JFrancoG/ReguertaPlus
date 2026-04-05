# HU-020 - Shifts backed by Google Sheets

## Metadata
- issue_id: #19
- priority: P2
- platform: both
- status: implemented

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member/admin I want shifts to be read and updated from a shared source so that everyone sees consistent data.

## Scope

### In Scope
- Implement capability defined by HU-020 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-020.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-IA-02, RF-IA-03

## Acceptance criteria

- App reads current shifts from Google Sheets.
- Confirmed changes sync source and notify all members.
- Manual edits performed directly in Google Sheets are ingested back into Firestore/app state.
- Confirmed changes from the app write back to Google Sheets with deterministic conflict handling.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on local+cloud hybrid strategy and/or Google Sheets integration.
- Recommended before HU-041 and HU-016 so the app UX works with synchronized real data.

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
