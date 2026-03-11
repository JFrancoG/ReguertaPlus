# Plan - HU-015 (View global and next shifts)

## 1. Technical approach

Implement this story incrementally, following Clean Architecture and reusing existing models/layers to reduce risk and regressions.

## 2. Layer impact
- UI: Screen, state, and user action updates required by HU-015.
- Domain: Business rules and validations tied to linked RFs.
- Data: Repository/DTO/mapper/query changes as needed.
- Backend: Firestore/rules/functions/job updates if applicable.
- Docs: Spec/tasks and issue evidence updates.

## 3. Platform-specific changes
### Android
- Implement flow and validations in ViewModel + data layer.
- Ensure UI states match weekly rules and permissions.

### iOS
- Implement equivalent flow and validations in ViewModel + data layer.
- Verify functional equivalence against Android.

### Functions/Backend
- Implement/adjust data rules and automations only if required by this HU.
- Keep compatibility with the proposed MVP Firestore structure.

## 4. Test strategy
- Unit tests for impacted business rules.
- Integration tests for relevant repository/data paths.
- End-to-end manual validation of acceptance criteria.

## 5. Rollout and functional validation
- Validate changes in develop environment.
- Run cross-story regression for related stories in the same domain.
- Confirm role-based behavior (member/producer/admin/reviewer when applicable).

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Align data contracts and linked RFs.
- Define test cases and edge scenarios.

### Phase 2 - Implementation
- Implement Android/iOS changes.
- Implement backend/rules changes when needed.

### Phase 3 - Closure
- Execute tests and validate acceptance criteria.
- Update issue, completion checklist, and documentation.

## 7. Technical risks and mitigation
- Risk: platform behavior drift.
  - Mitigation: parity checklist per acceptance criterion.
- Risk: Firestore data inconsistencies.
  - Mitigation: domain validations plus security rules.
