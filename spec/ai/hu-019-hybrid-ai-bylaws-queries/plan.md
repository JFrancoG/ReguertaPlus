# Plan - HU-019 (Hybrid AI bylaws queries)

## 1. Technical approach

Implement local-first bylaws Q&A with a deterministic escalation policy to cloud mode when local confidence or coverage is insufficient.

### Hybrid policy baseline
- Local mode first for all requests.
- Escalate to cloud when any of the following applies:
  - low confidence in local retrieval/answer,
  - question spans multiple rules with ambiguous intent,
  - explicit user request for deeper explanation.
- Cloud path must have timeout and fallback to local guidance response.

## 2. Layer impact
- UI: Screen, state, and user action updates required by HU-019.
- Domain: Decision policy for local-vs-cloud routing and confidence thresholds.
- Data: Local bylaws knowledge source + cloud adapter + telemetry hooks.
- Backend: Minimal cloud endpoint/config support if required by selected provider.
- Docs: Spec/tasks and issue evidence updates.

## 3. Platform-specific changes
### Android
- Implement local retrieval + policy evaluator in ViewModel/domain.
- Add cloud adapter with timeout/fallback contract.
- Ensure UI states cover local answer, cloud answer, and fallback message.

### iOS
- Mirror Android architecture and policy thresholds.
- Ensure equivalent UI states and fallback behavior.

### Functions/Backend
- Add/adjust cloud gateway only if needed.
- Keep provider credentials/config isolated by environment.

## 4. Test strategy
- Unit tests for routing policy (local-only vs cloud escalation triggers).
- Integration tests for local answer flow, cloud flow, and timeout fallback.
- Manual tests with representative FAQs and complex multi-rule questions.

## 5. Rollout and functional validation
- Validate changes in develop environment.
- Run cross-story regression for related stories in the same domain.
- Confirm role-based behavior (member/producer/admin/reviewer when applicable).

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define local bylaws source format and indexing strategy.
- Define escalation thresholds and timeout/fallback behavior.
- Define test set of canonical FAQ and complex questions.

### Phase 2 - Implementation
- Implement Android/iOS local-first pipeline and shared behavior contract.
- Implement cloud escalation path and observability hooks.

### Phase 3 - Closure
- Execute tests and validate acceptance criteria.
- Update issue, completion checklist, and documentation.

## 7. Technical risks and mitigation
- Risk: platform behavior drift.
  - Mitigation: parity checklist per acceptance criterion.
- Risk: Firestore data inconsistencies.
  - Mitigation: domain validations plus security rules.
- Risk: expensive cloud usage due to over-escalation.
  - Mitigation: strict local-first policy and escalation telemetry review.
