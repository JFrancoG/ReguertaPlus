# Tasks - HU-021 (Startup remote version gate)

## 1. Preparation
- [x] Confirm `config/public` fields used for version policy.
- [x] Define forced and optional update test cases.

## 2. Android implementation
- [x] Add startup version-policy evaluation flow.
- [x] Implement forced/optional update UI handling.
- [ ] At strict cutover, remove or disable Continue for unavailable/timeout states.

## 3. iOS implementation
- [x] Add startup version-policy evaluation flow.
- [x] Implement forced/optional update UI handling.
- [ ] At strict cutover, remove or disable Continue for unavailable/timeout states.

## 4. Backend / Firestore
- [ ] Seed `config/public` policy fields per environment.
- [ ] Verify anonymous `config/public` access at the coordinated strict-Rules cutover.

## 5. Testing
- [x] Unit tests for version comparison logic.
- [ ] Integration tests for config reads.
- [ ] Manual validation for forced and optional scenarios.
- [ ] Validate unavailable/timeout states remain blocking after strict client cutover.

## 6. Documentation
- [x] Update issue notes and decisions.
- [x] Record parity status.

## 7. Closure
- [ ] Link issue and final PR.
- [ ] Complete DoD checklist.
