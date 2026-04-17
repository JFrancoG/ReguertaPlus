# Tasks - HU-046 (Reminder scheduler idempotency and retries)

## 1. Preparation
- [ ] Define reminder slot identity and idempotency key contract.
- [ ] Define retry policy (attempts, backoff, terminal states).
- [ ] Confirm operator observability requirements for job runs.

## 2. Android implementation
- [ ] Validate Android push behavior under idempotent reminder delivery.
- [ ] Ensure no client-side assumptions conflict with retry orchestration.

## 3. iOS implementation
- [ ] Validate iOS push behavior under idempotent reminder delivery.
- [ ] Ensure no client-side assumptions conflict with retry orchestration.

## 4. Backend / Firestore
- [ ] Implement scheduler trigger and reminder orchestrator.
- [ ] Implement idempotent send markers and transaction-safe writes.
- [ ] Implement retry flow for transient failures.
- [ ] Persist run outcomes for observability.

## 5. Testing
- [ ] Execute unit tests for slot/idempotency/retry logic.
- [ ] Execute integration tests for duplicate suppression and retry outcomes.
- [ ] Perform manual time-window validation in develop.

## 6. Documentation
- [ ] Document reminder orchestration contract and retry taxonomy.
- [ ] Document operator runbook for failed runs.
- [ ] Record Android/iOS parity notes.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach scheduler run evidence and validation logs.
