# Plan - HU-010 (Manage members and roles)

## 1. Technical approach

Implement this story incrementally, following Clean Architecture and reusing existing models/layers to reduce risk and regressions, including pre-authorized onboarding and first-login auth linking. Unauthorized home UX refinement is owned by HU-027.

## 2. Layer impact
- UI: Screen, state, and user action updates required by HU-010.
- Domain: Business rules and validations tied to linked RFs, including pre-authorization and first authorized access.
- Data: Repository/DTO/mapper/query changes, especially email-based authorization lookup and `authUid` link.
- Backend: Firestore/rules/functions/job updates for pre-authorized access and secure UID binding.
- Docs: Spec/tasks and issue evidence updates.

## 3. Platform-specific changes
### Android
- Implement flow and validations in ViewModel + data layer.
- Ensure UI states match weekly rules, permissions, and first authorized access expectations.

### iOS
- Implement equivalent flow and validations in ViewModel + data layer.
- Verify functional equivalence against Android, including first-login authorization behavior.

### Functions/Backend
- Implement/adjust data rules for email pre-authorization and first-login `authUid` linking.
- Keep compatibility with the proposed MVP Firestore structure.

## 4. Test strategy
- Unit tests for impacted business rules.
- Integration tests for relevant repository/data paths, including pre-authorized and first authorized login flows.
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
