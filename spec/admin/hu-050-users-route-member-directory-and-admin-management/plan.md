# Plan - HU-050 (Users route, member directory, and admin management)

## 1. Technical approach

Implement a dedicated `Users` route in the home navigation stack by replacing placeholder behavior with a real member-directory screen that reuses existing member-management actions and role checks.

## 2. Layer impact
- UI: Add concrete users-route screens/components and remove placeholder behavior for `Users`.
- Domain: Reuse current admin permission checks and last-admin safety rule.
- Data: Reuse existing member repository read/write contracts for list and admin mutations.
- Backend: No new backend contract expected; verify current rules still enforce role boundaries.
- Docs: Add HU-050 artifacts and issue traceability.

## 3. Platform-specific changes
### Android
- Implement concrete `HomeDestination.USERS` route content.
- Render read-only member list for authenticated users.
- Enable admin-only mutations (create/pre-authorize, toggle active, toggle admin) behind existing checks.
- Align back-navigation behavior with existing route rules.

### iOS
- Implement concrete `.users` route content in home route switch.
- Render read-only member list for authenticated users.
- Enable admin-only mutations (create/pre-authorize, toggle active, toggle admin) behind existing checks.
- Align navigation transitions with current home shell behavior.

### Functions/Backend
- No schema/function changes expected.
- Validate role-based write protection remains enforced by existing rules/contracts.

## 4. Test strategy
- Unit tests for role-gated users-route actions and last-admin guard behavior.
- Integration tests for member list loading and admin mutations through existing repository paths.
- Manual validation from drawer entry:
  - admin user can manage members in `Users`.
  - non-admin user sees read-only listing and cannot mutate.
  - route is non-placeholder on both platforms.

## 5. Rollout and functional validation
- Validate route behavior in `develop` with admin and member test accounts.
- Validate no regression in existing dashboard/settings/admin flows.
- Confirm parity checklist by acceptance criterion.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Finalize users-route UX contract and reuse boundaries with existing admin tools.
- Define parity checklist and test cases.

### Phase 2 - Implementation
- Implement Android users route and wire actions.
- Implement iOS users route and wire actions.
- Verify backend rule compatibility (no contract drift).

### Phase 3 - Closure
- Execute automated/manual validation.
- Update issue with evidence and parity notes.
- Complete DoD checklist and link PR.

## 7. Technical risks and mitigation
- Risk: behavior drift between dashboard admin tools and new users route.
  - Mitigation: centralize actions/state in shared ViewModel paths and keep one source of truth.
- Risk: route-level refactor introduces navigation regressions.
  - Mitigation: add focused route tests and manual drawer-navigation checks on both platforms.
