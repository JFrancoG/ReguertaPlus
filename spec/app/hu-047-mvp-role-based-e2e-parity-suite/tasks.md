# Tasks - HU-047 (MVP role-based E2E parity suite)

## 1. Preparation
- [ ] Define MVP E2E role matrix and scenario list.
- [ ] Define deterministic fixture and reset contract.
- [ ] Define parity-report format and pass/fail thresholds.

## 2. Android implementation
- [ ] Implement Android E2E smoke scenarios for all MVP roles.
- [ ] Add shared Android helpers for setup and cleanup.
- [ ] Add Android evidence artifacts in CI.

## 3. iOS implementation
- [ ] Implement iOS E2E smoke scenarios for all MVP roles.
- [ ] Add shared iOS helpers for setup and cleanup.
- [ ] Add iOS evidence artifacts in CI.

## 4. Backend / Firestore
- [ ] Provide deterministic test data setup/reset hooks.
- [ ] Ensure role fixtures are stable across repeated E2E runs.

## 5. Testing
- [ ] Execute repeated Android E2E runs for stability.
- [ ] Execute repeated iOS E2E runs for stability.
- [ ] Perform manual parity review for scenario outcomes.

## 6. Documentation
- [ ] Document role-to-scenario matrix and release gate usage.
- [ ] Document known flaky scenarios and mitigation strategy.
- [ ] Record parity status and gaps.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach CI artifacts and parity evidence.
