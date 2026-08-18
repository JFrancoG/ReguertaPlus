# Tasks - HU-022 (Critical-data freshness before order)

## 1. Preparation
- [x] Confirm critical collections and freshness thresholds.
- [x] Define timeout and bounded automatic-retry UX behavior.

## 2. Android implementation
- [x] Add freshness gate before `My order`.
- [x] Implement timeout states and bounded automatic recovery.
- [x] Materialize users/products and validate cache-only critical collections from the server before acknowledgement.
- [x] Scope local metadata to principal, authenticated/selected member, environment, and member visibility.
- [x] Validate the reciprocal authenticated-member link and fail closed before role-dependent reads.
- [x] Exit impersonation and discard the private member list when admin access is revoked.
- [x] Invalidate the ACK receipt when another same-scope session writer lands after the consumer.
- [x] Apply the complete ordering snapshot before publishing `Ready`.
- [x] Bind navigation to the generation created by the entry request.
- [x] Allow a timed-out or unavailable action to request a new gated generation without bypassing readiness.

## 3. iOS implementation
- [x] Add freshness gate before `Mi pedido`.
- [x] Implement timeout states and bounded automatic recovery.
- [x] Materialize users/products and validate cache-only critical collections from the server before acknowledgement.
- [x] Scope local metadata to principal, authenticated/selected member, environment, and member visibility.
- [x] Validate the reciprocal authenticated-member link and fail closed before role-dependent reads.
- [x] Exit impersonation and discard the private member list when admin access is revoked.
- [x] Resolve seasonal commitments with one canonical `userId == member.id` lookup.
- [x] Invalidate the ACK receipt for a later same-scope writer without reordering the equivalent freshness payload.
- [x] Apply the complete ordering snapshot before publishing `Ready`.
- [x] Revalidate and bind navigation to the entry request generation.
- [x] Allow a timed-out or unavailable action to request a new gated generation without bypassing readiness.

## 4. Backend / Firestore
- [ ] Seed and validate required keys in `config/member.lastTimestamps`.
- [ ] Ensure critical collections are included in remote timestamp updates.
- [ ] Read back the deployed Rules and run live member/admin canaries for all six reads.

## 5. Testing
- [x] Unit tests for freshness calculations.
- [x] Integration tests for selective sync and post-refresh acknowledgement.
- [x] Controlled tests for partial failure, timeout, bounded automatic retry, session, environment, relink, access-scope,
  impersonation-demotion, and competing-refresh fencing.
- [x] Cover successful empty server results and the delayed initial-load retry contract.
- [ ] Manual validation of blocked, timeout, and automatically recovered flows.
- [x] Measure the 2.5-second deadline against server-only compatibility-query latency in the develop canary.
- [ ] Validate the 10-second deadline and delayed initial-load feedback on Android and iOS in develop.

## 6. Documentation
- [x] Record thresholds, timeout, and bounded automatic-retry decisions.
- [x] Update issue evidence.
- [x] Record the client refresh/ACK contract and the deferred Firebase gate.

## 7. Closure
- [x] Link issue and PR.
- [ ] Complete DoD checklist.
