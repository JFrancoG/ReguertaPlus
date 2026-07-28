# Plan - HU-022 (Critical-data freshness before order)

## 1. Technical approach

Add critical-data freshness checks before `My order` navigation using the authenticated
`config/member` projection, remote timestamps, and environment-scoped local sync metadata.
Configuration reads are server-only and failures remain recoverable. A timestamp change must not
be acknowledged as fresh until the corresponding critical refresh has completed successfully.

## 2. Layer impact
- UI: Disabled/blocked states, timeout, retry actions.
- Domain: Freshness policy and critical-collection set resolution.
- Data: Local-vs-remote timestamp comparison, session/environment fencing, and selective sync trigger.
- Backend: Seed `config/member` and keep its `lastTimestamps` map complete and stable.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Gate `My order` entry on freshness evaluation.

### iOS
- Mirror gating, timeout, and retry behavior.

### Functions/Backend
- Keep `config/member.lastTimestamps` contract complete.

## 4. Test strategy
- Unit tests for freshness calculations.
- Integration tests proving acknowledgement occurs only after successful critical refresh.
- Manual tests for timeout and retry UX.

## 5. Rollout and validation
- Validate both normal and stale-data scenarios in develop.
- Confirm parity on Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm `config/member` critical collections and freshness thresholds.

### Phase 2 - Implementation
- Implement gate, timeout, and retry.

### Phase 3 - Closure
- Validate and document outcomes.

## 7. Risks and mitigation
- Risk: excessive startup/order latency.
  - Mitigation: selective sync + throttling.
