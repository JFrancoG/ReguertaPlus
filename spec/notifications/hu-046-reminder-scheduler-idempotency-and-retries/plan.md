# Plan - HU-046 (Reminder scheduler idempotency and retries)

## 1. Technical approach

Implement scheduler-driven reminder orchestration with idempotency keys, bounded retries, and run-level telemetry so reminder delivery is reliable and diagnosable.

## 2. Layer impact
- UI: No major UI redesign; ensure client tolerates duplicate-avoidance semantics.
- Domain: Define reminder slot identity and idempotency contract.
- Data: Persist job execution state and send-attempt outcomes.
- Backend: Scheduler jobs, retry policy, and push dispatch orchestration.
- Docs: Runbook and operational notes for reminder jobs.

## 3. Platform-specific changes
### Android
- Validate push handling and user-visible behavior with orchestrated reminder events.

### iOS
- Validate push handling and user-visible behavior with orchestrated reminder events.

### Functions/Backend
- Add Cloud Scheduler triggers and orchestrator entrypoint.
- Implement idempotent send flow with transaction-safe write markers.
- Implement retry behavior for transient failures.

## 4. Test strategy
- Unit tests for slot/idempotency key generation.
- Integration tests for retry and duplicate suppression logic.
- Manual validation with controlled time-machine and scheduler windows.

## 5. Rollout and functional validation
- Dry-run in develop with trace-only mode.
- Enable sends for selected test cohort.
- Promote to broader develop validation after stability checks.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define slot model and idempotency key format.
- Define retry taxonomy (transient vs terminal failures).

### Phase 2 - Implementation
- Build scheduler + orchestrator + retry flow.
- Persist run metrics and result logs.

### Phase 3 - Closure
- Execute end-to-end reminder validation.
- Document runbook and monitoring hooks.

## 7. Technical risks and mitigation
- Risk: race conditions create duplicates.
  - Mitigation: transaction/lock + unique idempotency records.
- Risk: retries overwhelm push provider.
  - Mitigation: exponential backoff and capped attempts.
