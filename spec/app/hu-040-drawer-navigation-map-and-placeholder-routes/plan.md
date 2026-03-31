# Plan - HU-040 (Drawer navigation map and placeholder routes)

## 1. Technical approach

Convert the current role-aware drawer from visual shell into a stable navigation entry point by wiring all visible drawer options to explicit destinations, using placeholder screens where business functionality is not implemented yet.

## 2. Layer impact
- UI: Drawer item taps, destination screens, sign-out confirmation dialog, placeholder layouts.
- Domain: Route visibility mapping driven by existing user roles.
- Data: No new backend data required for routing scaffolding.
- Backend: Not required.
- Docs: Add HU-040 to roadmap/spec and clarify that business stories will attach to existing placeholder routes later.

## 3. Platform-specific changes
### Android
- Add route state/navigation model for drawer destinations.
- Implement placeholder screens and sign-out confirmation dialog.
- Preserve existing drawer role visibility.

### iOS
- Add equivalent route state/navigation model for drawer destinations.
- Implement placeholder screens and sign-out confirmation dialog.
- Preserve existing drawer role visibility.

### Functions/Backend
- Not required for initial routing scaffolding.

## 4. Test strategy
- Unit tests for role-aware route visibility where practical.
- UI/state tests for sign-out confirmation and destination switching.
- Manual validation for drawer-to-route transitions and role-specific menus.

## 5. Rollout and functional validation
- Validate common/member/producer/admin route maps in `develop`.
- Validate drawer entries do not expose unauthorized destinations.
- Validate sign-out confirmation prevents accidental session closure.

## 6. Phased implementation sequence
### Phase 1 - Inventory
- Finalize canonical route list and action list.
- Confirm which items are routes vs global actions.

### Phase 2 - Wiring
- Wire Android and iOS drawer items to destination routing.
- Add placeholder destinations and settings shell.
- Add sign-out confirmation.

### Phase 3 - Closure
- Execute validations and capture navigation evidence.

## 7. Technical risks and mitigation
- Risk: future HUs bypass shared routing conventions.
  - Mitigation: centralize destination identifiers now and build future features on those routes.
- Risk: sign-out action gets treated like a normal route on one platform.
  - Mitigation: model `Sign out` explicitly as a global action with confirmation.
