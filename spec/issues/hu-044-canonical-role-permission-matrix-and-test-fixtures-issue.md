# [HU-044] Canonical role permission matrix and test fixtures

## Summary

As a product and engineering team we want one canonical role-permission matrix and aligned fixtures so behavior stays consistent across app code and tests.

## Links
- Spec: spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/spec.md
- Plan: spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/plan.md
- Tasks: spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/tasks.md

## Acceptance criteria

- A single canonical permission matrix exists in-repo and is referenced by implementation and tests.
- Android and iOS role-gating behavior matches the matrix for core modules.
- Test fixtures for seeded users match matrix expectations (including admin capabilities).
- CI detects permission drift when role rules and fixtures diverge.

## Scope
### In Scope
- Implement story HU-044 within MVP scope.
- Satisfy linked RFs: RF-ROL-03, RF-ROL-04, RF-ROL-05, RF-ROL-06, RF-ROL-08.

### Out of Scope
- New business roles beyond current MVP roles.
- Broad redesign of home/navigation UX.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P1

## Dependencies
- #1 (HU-010)
- #56 (HU-039)
