# Tasks - HU-046 (Reminder scheduler idempotency and retries)

## 1. Preparation
- [x] Define reminder slot identity and idempotency key contract.
- [x] Define retry policy (attempts, backoff, terminal states).
- [x] Confirm operator observability requirements for job runs.

## 2. Android implementation
- [x] Validate Android push behavior under idempotent reminder delivery.
- [x] Ensure no client-side assumptions conflict with retry orchestration.

## 3. iOS implementation
- [x] Validate iOS push behavior under idempotent reminder delivery.
- [x] Ensure no client-side assumptions conflict with retry orchestration.

## 4. Backend / Firestore
- [x] Implement scheduler trigger and reminder orchestrator.
- [x] Implement idempotent send markers and transaction-safe writes.
- [x] Implement retry flow for transient failures.
- [x] Persist run outcomes for observability.

## 5. Testing
- [x] Execute unit tests for slot/idempotency/retry logic.
- [ ] Execute integration tests for duplicate suppression and retry outcomes.
- [ ] Perform manual time-window validation in develop.

## 6. Documentation
- [x] Document reminder orchestration contract and retry taxonomy.
- [x] Document operator runbook for failed runs.
- [x] Record Android/iOS parity notes.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach scheduler run evidence and validation logs.
