# HU-044 - Canonical role permission matrix and test fixtures

## Metadata
- issue_id: #105
- priority: P1
- platform: both
- status: ready

## Context and problem

Permission checks, role-based UI visibility, and test fixtures can drift over time, creating regressions and inconsistent behavior between Android, iOS, and tests.

## User story

As a product and engineering team I want one canonical role-permission matrix and aligned fixtures so behavior stays consistent across app code and test suites.

## Scope

### In Scope
- Define one canonical matrix for `member`, `producer`, `admin`, and `reviewer` capabilities.
- Align Android/iOS permission helpers and UI gating against that matrix.
- Align in-memory/test fixtures with the same permission contract.
- Add guardrails to detect drift (tests and/or static checks).

### Out of Scope
- New business roles beyond current MVP roles.
- Broad redesign of home/navigation UX.

## Linked functional requirements

- RF-ROL-03, RF-ROL-04, RF-ROL-05, RF-ROL-06, RF-ROL-08

## Acceptance criteria

- A single canonical permission matrix exists in-repo and is referenced by implementation and tests.
- Android and iOS role-gating behavior matches the matrix for core modules.
- Test fixtures for seeded users match matrix expectations (including admin capabilities).
- CI detects permission drift when role rules and fixtures diverge.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on HU-010 role model and HU-039 role-aware shell.
- Canonical matrix artifact: spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json.

## Risks

- Risk: over-constraining future role evolution.
  - Mitigation: keep matrix extensible and versioned.
- Risk: parity drift after future feature additions.
  - Mitigation: enforce matrix-based tests in both platforms.

## Parity status

- Android/iOS parity: aligned for role-gated core modules (`products`, `received-orders`, `members`, `news`, `admin notifications`).
- Known exception: `reviewer` remains a runtime persona (allowlist + environment routing), not a persisted `users.roles` value.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
