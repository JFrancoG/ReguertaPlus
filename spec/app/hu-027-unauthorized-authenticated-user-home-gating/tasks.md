# Tasks - HU-027 (Unauthorized authenticated user home gating)

## 1. Preparation
- [x] Confirm final unauthorized-state UX scope in home.
- [x] Confirm protected entry points that must stay disabled in restricted mode.

## 2. Android implementation
- [x] Refine unauthorized home UI and restricted actions.
- [x] Ensure protected modules remain disabled and non-navigable.
- [x] Add explicit sign-out affordance for unauthorized state.
- [x] Align unauthorized dialog styling and blocking behavior with approved mockup.

## 3. iOS implementation
- [x] Implement equivalent unauthorized home UI and restricted actions.
- [x] Ensure protected modules remain disabled and non-navigable.
- [x] Add explicit sign-out affordance for unauthorized state.
- [x] Align unauthorized dialog styling and blocking behavior with approved mockup.

## 4. Backend / Firestore
- [x] Validate no schema or rules changes are required beyond current `users` authorization contract.

## 5. Testing
- [x] Execute unit tests for unauthorized gating logic.
- [x] Execute integration/UI tests for restricted-home behavior.
- [ ] Perform manual functional validation with unauthorized and then authorized user states.

## 6. Documentation
- [x] Update technical and functional docs for HU-027 scope.
- [x] Align HU-010 / HU-023 references to avoid duplicated ownership.

## 7. Closure
- [x] Create/update linked issue.
- [ ] Prepare PR with evidence.
- [ ] Complete DoD checklist.
