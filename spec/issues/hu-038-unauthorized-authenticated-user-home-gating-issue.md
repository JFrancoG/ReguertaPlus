# [HU-038] Unauthorized authenticated user home gating

## Summary

As an authenticated but not yet authorized person I want clear restricted-access feedback in home so that I understand why I cannot use the app and what must happen next.

## Links
- Spec: spec/app/hu-038-unauthorized-authenticated-user-home-gating/spec.md
- Plan: spec/app/hu-038-unauthorized-authenticated-user-home-gating/plan.md
- Tasks: spec/app/hu-038-unauthorized-authenticated-user-home-gating/tasks.md

## Acceptance criteria

- If a user authenticates in Firebase but no active authorized `users` record exists for that email, home shows an explicit unauthorized state.
- In unauthorized state, operational modules stay disabled and protected flows remain blocked.
- Unauthorized state exposes a safe sign-out path that is distinct from expired-session recovery.
- If the user becomes authorized later, the next session resolution restores normal home access.

## Scope
### In Scope
- Implement story HU-038 within MVP scope.
- Satisfy linked RFs: RF-ROL-06, RF-ROL-07, and RF-ROL-08.

### Out of Scope
- Session expiry handling from HU-023.
- Admin CRUD/pre-authorization workflows from HU-010.
- Broader home shell redesign not required to close unauthorized gating.

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
- #23 (HU-023)
- #1 (HU-010)
