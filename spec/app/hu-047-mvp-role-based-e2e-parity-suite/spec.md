# HU-047 - MVP role-based E2E parity suite

## Metadata
- issue_id: #108
- priority: P2
- platform: both
- status: ready

## Context and problem

Core flows now span multiple roles and platforms. Without an explicit E2E suite, regressions can ship even when unit/integration tests pass.

## User story

As a release owner I want a role-based MVP E2E suite so we can validate critical journeys with parity across Android and iOS before release.

## Scope

### In Scope
- Define MVP E2E matrix by role: member, producer, admin, reviewer.
- Implement automated smoke E2E scenarios for both Android and iOS.
- Standardize seed/fixture prerequisites per role and environment.
- Produce parity evidence and known-gap reporting per run.

### Out of Scope
- Full non-MVP regression test expansion.
- Performance benchmarking.

## Linked functional requirements

- RF-APP-02
- RF-ROL-03, RF-ROL-04
- RF-PROD-01, RF-PROD-04

## Acceptance criteria

- Each MVP role has at least one automated end-to-end scenario on Android and iOS.
- E2E suite includes preconditions, expected results, and deterministic test data contract.
- CI publishes pass/fail evidence and clearly flags parity gaps.
- Release checklist references this suite as a required gate.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on HU-008, HU-009, HU-010, HU-018, and HU-023.

## Risks

- Risk: flaky UI tests reduce trust in the suite.
  - Mitigation: deterministic seeds, stable selectors, and non-parallel fallback where needed.
- Risk: high maintenance cost.
  - Mitigation: keep smoke set focused on MVP-critical paths.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Implementation aligned with linked RFs.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [ ] Technical/functional documentation updated.
- [ ] Issue and PR linked.
