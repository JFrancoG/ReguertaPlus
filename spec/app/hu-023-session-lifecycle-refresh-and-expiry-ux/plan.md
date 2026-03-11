# Plan - HU-023 (Session lifecycle refresh and expiry UX)

## 1. Technical approach

Implement lifecycle-driven session refresh with resilient expired-session handling.

## 2. Layer impact
- UI: Session-expired messaging and recovery route.
- Domain: Refresh triggers and retry/guard conditions.
- Data: Auth refresh and persistence updates.
- Backend: No schema changes expected.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Hook refresh to process/app foreground events.

### iOS
- Hook refresh to scene/app active transitions.

### Functions/Backend
- Not expected unless auth-side constraints require support.

## 4. Test strategy
- Unit tests for refresh trigger logic.
- Integration tests with mocked auth expiration.
- Manual tests for expiry message and recovery.

## 5. Rollout and validation
- Validate lifecycle transitions in develop.
- Confirm parity Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define refresh trigger matrix and debounce policy.

### Phase 2 - Implementation
- Implement refresh flow and expiry UX.

### Phase 3 - Closure
- Execute tests and document outcomes.

## 7. Risks and mitigation
- Risk: noisy UX from repeated refresh failures.
  - Mitigation: guarded retries and single-surface messaging.
