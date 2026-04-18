# [HU-050] Users route, member directory, and admin management

## Summary

As an admin I want the drawer `Users` route to open a real users list with management actions so that member lifecycle and role operations are accessible from the expected area.

## Links
- Spec: spec/admin/hu-050-users-route-member-directory-and-admin-management/spec.md
- Plan: spec/admin/hu-050-users-route-member-directory-and-admin-management/plan.md
- Tasks: spec/admin/hu-050-users-route-member-directory-and-admin-management/tasks.md

## Acceptance criteria

- Opening `Users` from the drawer lands on a concrete, non-placeholder screen on Android and iOS.
- Authenticated users can view member directory information from the users area.
- Admin users can execute create/pre-authorize, activate/deactivate, and grant/revoke admin actions from that route.
- Last-admin protection remains enforced when revoking/deactivating admin users.
- Non-admin users cannot trigger admin-only mutations from the users route.
- Android and iOS expose equivalent route behavior and role gating, with any temporary parity gap documented.

## Scope
### In Scope
- Implement story HU-050 within MVP scope.
- Satisfy linked RFs: RF-PERF-01, RF-PERF-04, RF-ROL-03, RF-ROL-04, RF-ROL-05, RF-ROL-06.

### Out of Scope
- New role model or permission-matrix redesign.
- Bulk user import/export tooling.
- Post-MVP advanced filters/search analytics.

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

## Dependencies
- #1 (HU-010)
- #58 (HU-040)
