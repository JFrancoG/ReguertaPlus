# Tasks - HU-022 (Critical-data freshness before order)

## 1. Preparation
- [x] Confirm critical collections and freshness thresholds.
- [x] Define timeout and retry UX behavior.

## 2. Android implementation
- [x] Add freshness gate before `My order`.
- [x] Implement timeout and retry states.

## 3. iOS implementation
- [x] Add freshness gate before `Mi pedido`.
- [x] Implement timeout and retry states.

## 4. Backend / Firestore
- [ ] Seed and validate required keys in `config/member.lastTimestamps`.
- [ ] Ensure critical collections are included in remote timestamp updates.

## 5. Testing
- [x] Unit tests for freshness calculations.
- [ ] Integration tests for selective sync and post-refresh acknowledgement.
- [ ] Manual validation of blocked, timeout, and recovered flows.

## 6. Documentation
- [x] Record thresholds, timeout, and retry decisions.
- [x] Update issue evidence.

## 7. Closure
- [ ] Link issue and PR.
- [ ] Complete DoD checklist.
