# Plan - HU-022 (Critical-data freshness before order)

## 1. Technical approach

Add critical-data freshness checks before `My order` navigation using remote timestamps and local sync metadata.

## 2. Layer impact
- UI: Disabled/blocked states, timeout, retry actions.
- Domain: Freshness policy and critical-collection set resolution.
- Data: Local-vs-remote timestamp comparison and selective sync trigger.
- Backend: Ensure `lastTimestamps` map is complete and stable.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Gate `My order` entry on freshness evaluation.

### iOS
- Mirror gating, timeout, and retry behavior.

### Functions/Backend
- Keep `config/global.lastTimestamps` contract complete.

## 4. Test strategy
- Unit tests for freshness calculations.
- Integration tests for sync trigger paths.
- Manual tests for timeout and retry UX.

## 5. Rollout and validation
- Validate both normal and stale-data scenarios in develop.
- Confirm parity on Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm critical collections and freshness thresholds.

### Phase 2 - Implementation
- Implement gate, timeout, and retry.

### Phase 3 - Closure
- Validate and document outcomes.

## 7. Risks and mitigation
- Risk: excessive startup/order latency.
  - Mitigation: selective sync + throttling.
