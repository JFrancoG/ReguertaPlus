# Tasks - HU-022 (Critical-data freshness before order)

## 1. Preparation
- [x] Confirm critical collections and freshness thresholds.
- [x] Define timeout and retry UX behavior.

## 2. Android implementation
- [x] Add freshness gate before `My order`.
- [x] Implement timeout and retry states.
- [x] Refresh the six critical collections from the server before acknowledgement.
- [x] Scope local metadata to principal, authenticated/selected member, environment, and member visibility.
- [x] Validate the reciprocal authenticated-member link and fail closed before role-dependent reads.
- [x] Exit impersonation and discard the private member list when admin access is revoked.
- [x] Invalidate the ACK receipt when another same-scope session writer lands after the consumer.
- [x] Apply the complete ordering snapshot before publishing `Ready`.
- [x] Bind navigation to the generation created by the entry request.

## 3. iOS implementation
- [x] Add freshness gate before `Mi pedido`.
- [x] Implement timeout and retry states.
- [x] Refresh the six critical collections from the server before acknowledgement.
- [x] Scope local metadata to principal, authenticated/selected member, environment, and member visibility.
- [x] Validate the reciprocal authenticated-member link and fail closed before role-dependent reads.
- [x] Exit impersonation and discard the private member list when admin access is revoked.
- [x] Parallelize canonical/legacy seasonal-commitment compatibility queries.
- [x] Invalidate the ACK receipt when another same-scope session writer lands after the consumer.
- [x] Apply the complete ordering snapshot before publishing `Ready`.
- [x] Revalidate and bind navigation to the entry request generation.

## 4. Backend / Firestore
- [ ] Seed and validate required keys in `config/member.lastTimestamps`.
- [ ] Ensure critical collections are included in remote timestamp updates.
- [ ] Read back the deployed Rules and run live member/admin canaries for all six reads.

## 5. Testing
- [x] Unit tests for freshness calculations.
- [x] Integration tests for selective sync and post-refresh acknowledgement.
- [x] Controlled tests for partial failure, timeout, retry, session, environment, relink, access-scope,
  impersonation-demotion, and competing-refresh fencing.
- [ ] Manual validation of blocked, timeout, and recovered flows.
- [ ] Measure the 2.5-second deadline against server-only compatibility-query latency in the live canary.

## 6. Documentation
- [x] Record thresholds, timeout, and retry decisions.
- [x] Update issue evidence.
- [x] Record the client refresh/ACK contract and the deferred Firebase gate.

## 7. Closure
- [x] Link issue and PR.
- [ ] Complete DoD checklist.
