# Tasks - HU-022 (Critical-data freshness before order)

## 1. Preparation
- [ ] Confirm critical collections and freshness thresholds.
- [ ] Define timeout and retry UX behavior.

## 2. Android implementation
- [ ] Add freshness gate before `My order`.
- [ ] Implement timeout and retry states.

## 3. iOS implementation
- [ ] Add freshness gate before `Mi pedido`.
- [ ] Implement timeout and retry states.

## 4. Backend / Firestore
- [ ] Validate required keys in `config/global.lastTimestamps`.
- [ ] Ensure critical collections are included in remote timestamp updates.

## 5. Testing
- [ ] Unit tests for freshness calculations.
- [ ] Integration tests for selective sync triggers.
- [ ] Manual validation of blocked, timeout, and recovered flows.

## 6. Documentation
- [ ] Record thresholds, timeout, and retry decisions.
- [ ] Update issue evidence.

## 7. Closure
- [ ] Link issue and PR.
- [ ] Complete DoD checklist.
