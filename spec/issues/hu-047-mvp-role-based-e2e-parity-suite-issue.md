# [HU-047] MVP role-based E2E parity suite

## Summary

As a release owner I want a role-based MVP E2E suite so we can validate critical journeys with parity across Android and iOS before release.

## Links
- Spec: spec/app/hu-047-mvp-role-based-e2e-parity-suite/spec.md
- Plan: spec/app/hu-047-mvp-role-based-e2e-parity-suite/plan.md
- Tasks: spec/app/hu-047-mvp-role-based-e2e-parity-suite/tasks.md

## Acceptance criteria

- Each MVP role has at least one automated end-to-end scenario on Android and iOS.
- E2E suite includes preconditions, expected results, and deterministic test data contract.
- CI publishes pass/fail evidence and clearly flags parity gaps.
- Release checklist references this suite as a required gate.

## Scope
### In Scope
- Implement story HU-047 within MVP scope.
- Satisfy linked RFs: RF-APP-02, RF-ROL-03, RF-ROL-04, RF-PROD-01, RF-PROD-04.

### Out of Scope
- Full non-MVP regression test expansion.
- Performance benchmarking.

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
- priority:P2

## Dependencies
- #9 (HU-008)
- #15 (HU-009)
- #1 (HU-010)
- #13 (HU-018)
- #23 (HU-023)
