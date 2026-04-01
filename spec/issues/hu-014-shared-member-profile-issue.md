# [HU-014] Shared member profile

## Summary

As a member I want to share a photo and family text so that other members can know us better.

## Links
- Spec: spec/profiles/hu-014-shared-member-profile/spec.md
- Plan: spec/profiles/hu-014-shared-member-profile/plan.md
- Tasks: spec/profiles/hu-014-shared-member-profile/tasks.md

## Acceptance criteria

- Member can create/edit/delete own shared profile.
- Members can view photo, family names, and text from other members.
- This MVP iteration uses the existing `photoUrl` field directly and does not yet add native image upload/picking.

## Scope
### In Scope
- Implement story HU-014 within MVP scope.
- Satisfy linked RFs: RF-PERF-01, RF-PERF-02, RF-PERF-03, RF-PERF-04.

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
- area:profiles
- platform:cross
- priority:P2
