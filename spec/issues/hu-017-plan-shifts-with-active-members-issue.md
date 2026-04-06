# [HU-017] Plan shifts with active members

## Summary

As an admin or planning system I want to generate shifts using only active members so that planning remains fair and valid.

## Links
- Spec: spec/shifts/hu-017-plan-shifts-with-active-members/spec.md
- Plan: spec/shifts/hu-017-plan-shifts-with-active-members/plan.md
- Tasks: spec/shifts/hu-017-plan-shifts-with-active-members/tasks.md

## Acceptance criteria

- Members with `isActive = false` are excluded from planning.
- New/reactivated members are appended at the end.
- Market ensures minimum three members with fallback from next in rotation.
- Admin can trigger delivery and market planning explicitly from app settings.
- Planning writes the next season to Firestore and dedicated Google Sheets tabs.
- Planning emits notifications to affected members.

## Scope
### In Scope
- Implement story HU-017 within MVP scope.
- Satisfy linked RFs: RF-TURN-03, RF-TURN-04, RF-TURN-07.

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
- area:shifts
- platform:cross
- priority:P1
