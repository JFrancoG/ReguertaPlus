# Plan - HU-045 (Firestore security for producer order status)

## 1. Technical approach

Harden producer status writes at Firestore rules level and back that policy with explicit security tests per role and environment.

## 2. Layer impact
- UI: Handle permission-denied responses gracefully for status updates.
- Domain: Keep status transition constraints aligned with backend rules.
- Data: Ensure write payloads and paths match rule expectations.
- Backend: Implement rules for ownership, role constraints, and transition validity.
- Docs: Document rule contract and test matrix.

## 3. Platform-specific changes
### Android
- Update repository/error mapping for denied writes.
- Add tests covering expected behavior when writes are rejected.

### iOS
- Update repository/error mapping for denied writes.
- Add tests covering expected behavior when writes are rejected.

### Functions/Backend
- Add/adjust Firestore rules for producer status updates.
- Add emulator-based security tests for allow/deny matrix.

## 4. Test strategy
- Rule tests: producer/admin/member/reviewer allow/deny scenarios.
- Integration tests: status update flow with valid and invalid actors.
- Manual tests: status updates across develop and production-like configs.

## 5. Rollout and functional validation
- Validate in local/emulator first.
- Deploy rules to develop and run end-to-end producer checks.
- Confirm no regressions in HU-008/HU-009 flows.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define exact write paths and transition constraints.
- Build rule test matrix by role and environment.

### Phase 2 - Implementation
- Implement rules and tests.
- Align app-side error handling.

### Phase 3 - Closure
- Run emulator + platform validations.
- Update issue/spec/tasks with proof.

## 7. Technical risks and mitigation
- Risk: strict rules block valid legacy payloads.
  - Mitigation: include backward-compatible rule clauses where safe.
- Risk: transition validation duplicated inconsistently.
  - Mitigation: define one canonical transition table used across layers.
