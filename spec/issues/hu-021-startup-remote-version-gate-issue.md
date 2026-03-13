# [HU-021] Startup remote version gate

## Summary

As a member I want app version policy to be validated at startup so unsupported builds are blocked or warned.

## Links
- Spec: spec/app/hu-021-startup-remote-version-gate/spec.md
- Plan: spec/app/hu-021-startup-remote-version-gate/plan.md
- Tasks: spec/app/hu-021-startup-remote-version-gate/tasks.md
- PR: https://github.com/JFrancoG/ReguertaPlus/pull/51

## Acceptance criteria

- Forced update blocks usage until update.
- Optional update lets user continue.

## Scope
### In Scope
- Implement story HU-021 within MVP scope.
- Satisfy linked RFs: RF-APP-01.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P1

## Dependencies
- #1 (HU-010)
