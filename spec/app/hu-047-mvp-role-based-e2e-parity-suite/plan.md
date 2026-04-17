# Plan - HU-047 (MVP role-based E2E parity suite)

## 1. Technical approach

Define a compact but strict MVP E2E matrix by role, then automate representative flows for Android and iOS with deterministic fixtures and parity reporting.

## 2. Layer impact
- UI: Stable selectors and deterministic route states for testability.
- Domain: Expose deterministic preconditions for role-based flows.
- Data: Seed data contracts for role scenarios.
- Backend: Provide predictable environment state for E2E execution.
- Docs: Role-to-scenario matrix and release-gate criteria.

## 3. Platform-specific changes
### Android
- Add/extend connected/UI tests for MVP role journeys.
- Add utilities for deterministic setup and cleanup.

### iOS
- Add/extend UI tests for MVP role journeys.
- Add utilities for deterministic setup and cleanup.

### Functions/Backend
- Define stable test fixtures and reset hooks where required.

## 4. Test strategy
- Smoke E2E per role and platform.
- Parity checklist comparing expected outcomes Android vs iOS.
- Manual fallback checklist for known simulator/emulator limitations.

## 5. Rollout and functional validation
- Start with develop-only nightly runs.
- Stabilize flaky scenarios before enforcing gate.
- Promote to mandatory pre-release gate.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Select MVP-critical journeys and map to roles.
- Define deterministic fixture setup contract.

### Phase 2 - Implementation
- Implement Android and iOS E2E scenarios.
- Add parity report generation.

### Phase 3 - Closure
- Execute repeated runs for stability.
- Update docs and release checklist.

## 7. Technical risks and mitigation
- Risk: environment-dependent flakiness.
  - Mitigation: deterministic test data and explicit reset steps.
- Risk: long runtime increases CI cost.
  - Mitigation: keep smoke subset focused and parallelize safely.
