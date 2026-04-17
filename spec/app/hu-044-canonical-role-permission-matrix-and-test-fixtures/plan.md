# Plan - HU-044 (Canonical role permission matrix and test fixtures)

## 1. Technical approach

Establish a single source of truth for role permissions, then align platform permission checks and seeded fixtures to that contract with automated drift detection.

## 2. Layer impact
- UI: Gate module visibility and actions from canonical role capabilities.
- Domain: Centralize capability checks and remove implicit role assumptions.
- Data: Align seeded member fixtures and test repositories with matrix-defined privileges.
- Backend: Keep authorization semantics consistent with matrix expectations.
- Docs: Add matrix artifact and link from affected HUs.

## 3. Platform-specific changes
### Android
- Refactor capability checks to consume canonical matrix mapping.
- Update in-memory fixtures and tests to mirror matrix roles.

### iOS
- Refactor capability checks to consume canonical matrix mapping.
- Update in-memory fixtures and tests to mirror matrix roles.

### Functions/Backend
- Validate role assumptions against matrix where admin/producer behavior is enforced server-side.

## 4. Test strategy
- Unit tests for role-to-capability resolution.
- Snapshot/contract tests for canonical matrix consistency.
- Manual validation for key role-gated screens in both platforms.

## 5. Rollout and functional validation
- Introduce matrix and fixtures in develop first.
- Run full Android/iOS suites and compare role behavior parity.
- Confirm no regressions in existing admin/producer flows.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define matrix schema and canonical location.
- List all current role checks affected by drift.

### Phase 2 - Implementation
- Wire Android/iOS permission checks to canonical mapping.
- Align fixtures and role-based tests.

### Phase 3 - Closure
- Execute parity validation.
- Update issue/spec/tasks with evidence.

## 7. Technical risks and mitigation
- Risk: hidden role checks remain outside matrix.
  - Mitigation: search-and-audit all role-gating entry points.
- Risk: fixture churn breaks unrelated tests.
  - Mitigation: stage fixture updates with focused regression suite.
