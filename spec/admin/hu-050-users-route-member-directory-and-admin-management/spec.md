# HU-050 - Users route, member directory, and admin management

## Metadata
- issue_id: TBD
- priority: P1
- platform: both
- status: ready

## Context and problem

HU-040 intentionally left `Users` as a placeholder destination in the drawer. During functional review, admins still cannot complete the expected users-list flow from that entry point, and the route does not expose a real member directory experience. This creates a mismatch between navigation expectations and operational admin workflows.

## User story

As an admin I want the drawer `Users` route to open a real users list with management actions so that member lifecycle and role operations are accessible from the expected area.

## Scope

### In Scope
- Replace `Users` placeholder route with a real users/member-directory screen on Android and iOS.
- Keep role-aware behavior in the same route:
  - authenticated non-admin users can access read-only member list visibility.
  - admins can access management actions (create/pre-authorize, activate/deactivate, grant/revoke admin).
- Reuse existing member management domain rules from HU-010, including last-admin safeguard.
- Keep navigation and drawer behavior aligned with HU-040 route inventory.

### Out of Scope
- New role model or permission-matrix redesign.
- Bulk user import/export tooling.
- Major visual redesign unrelated to delivering the functional route.
- Post-MVP member search/filter analytics features.

## Linked functional requirements

- RF-PERF-01
- RF-PERF-04
- RF-ROL-03
- RF-ROL-04
- RF-ROL-05
- RF-ROL-06

## Acceptance criteria

- Opening `Users` from the drawer lands on a concrete, non-placeholder screen on Android and iOS.
- Authenticated users can view member directory information from the users area.
- Admin users can execute create/pre-authorize, activate/deactivate, and grant/revoke admin actions from that route.
- Last-admin protection remains enforced when revoking/deactivating admin users.
- Non-admin users cannot trigger admin-only mutations from the users route.
- Android and iOS expose equivalent route behavior and role gating, with any temporary parity gap documented.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-structure-mvp-proposal-v1.md.
- Depends on HU-010 role/member lifecycle behavior and HU-040 drawer route map.

## Risks

- Risk: duplicate management entry points (dashboard vs users route) may diverge.
  - Mitigation: consolidate behavior through shared state/actions and define one canonical users-management flow.
- Risk: accidental privilege exposure in route UI/actions.
  - Mitigation: enforce capability checks in UI + domain layer and validate role-gated test cases.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Implementation aligned with linked RFs.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [ ] Technical/functional documentation updated.
- [ ] Issue and PR linked.
