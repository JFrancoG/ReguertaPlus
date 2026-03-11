# [HU-010] Manage members and roles

## Summary

As an admin I want to manage member lifecycle, onboarding authorization, and privileges so that access control remains safe.

## Links
- Spec: spec/admin/hu-010-manage-members-and-roles/spec.md
- Plan: spec/admin/hu-010-manage-members-and-roles/plan.md
- Tasks: spec/admin/hu-010-manage-members-and-roles/tasks.md

## Acceptance criteria

- Admin can access create/edit/deactivate actions.
- Granting/revoking admin cannot leave the app with zero admins.
- If a signed-in email is not pre-authorized in members list, app shows `Unauthorized user` and keeps operational features disabled.
- If a member is pre-authorized by admin, first login/register enters home with role-based enabled access.

## Scope
### In Scope
- Implement story HU-010 within MVP scope.
- Satisfy linked RFs: RF-ROL-03, RF-ROL-04, RF-ROL-05, RF-ROL-06, RF-ROL-07, RF-ROL-08.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:admin
- platform:cross
- priority:P1
