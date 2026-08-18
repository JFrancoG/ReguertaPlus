# Plan - HU-022 (Critical-data freshness before order)

## 1. Technical approach

Add critical-data freshness checks before `My order` navigation using the authenticated
`config/member` projection, remote timestamps, and environment-scoped local sync metadata.
Configuration reads are server-only and failures remain recoverable. A timestamp change must not
be acknowledged as fresh until the corresponding critical refresh has completed successfully.

The client cut uses a fail-closed sequence on both platforms:

1. Read `config/member` from the server and validate all six timestamps.
2. Resolve either the complete critical set (expired or differently scoped metadata) or the exact
   timestamp delta.
3. Materialize `users` and `products` from the server. Validate server availability for the
   cache-only `orders`, `orderlines`, `containers`, and `measures` paths with count aggregations,
   so a successful empty result is accepted without downloading the complete historical dataset.
4. Re-read the authenticated member, selected member, and seasonal commitments from the server on
   every gate, even when the six timestamps have no delta, then materialize the member/product state
   consumed by `My order`.
5. Re-check the operation generation and its principal, authenticated member and reciprocal
   `authUid`, selected member, environment, and member-visibility scope. A revoked admin scope exits
   impersonation and drops its previous private member list before retrying. A shared session-state
   revision also invalidates the receipt if another same-scope writer lands before acknowledgement. On iOS,
   the freshness merge preserves canonical member order so its own equivalent payload does not create a false writer.
6. Persist the new acknowledgement and publish `Ready` only after every previous step succeeds.
7. If the 10-second freshness deadline expires or the refresh is unavailable, keep the gate closed
   and retry automatically after 10, 20, and 30 seconds. A new entry request or session transition
   cancels the pending retry and resets the bounded backoff.

`My order` revalidates this sequence on every entry request. Navigation is tied to the generation
started by that request, so startup readiness or a stale concurrent request cannot open the route.
The Firestore namespace and phased compatibility boundary remain governed by ADR-0007; this cut
does not introduce a new architecture decision or deploy backend changes.

## 2. Layer impact
- UI: Disabled/blocked states and automatic timeout recovery without a dedicated Retry action. The Home action
  itself can request another fenced attempt after timeout or unavailability.
- Domain: Freshness policy and critical-collection set resolution.
- Data: Server-only selective refresh, bounded cache-only collection validation, identity-scoped
  metadata, conditional acknowledgement, and session/environment/access fencing.
- Backend: Seed `config/member` and keep its `lastTimestamps` map complete and stable.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Refresh materialized critical Firestore paths with `Source.SERVER`, validate cache-only paths with
  `AggregateSource.SERVER`, reuse decoded member/product payloads, and apply the complete ordering
  snapshot before the conditional DataStore acknowledgement.
- Validate the authenticated-member link before role-dependent queries and retry with a reduced
  identity scope if the server revokes member-management access.
- Gate `My order` entry on the exact refresh generation requested by the user.
- Keep the action available after timeout/unavailability so the user can request a new gated generation;
  disable it only while that generation is checking.

### iOS
- Refresh materialized critical Firestore paths with `.server`, validate cache-only paths with
  server count aggregations, validate member/product documents with the real mappers, and apply the
  complete ordering snapshot before the conditional UserDefaults acknowledgement.
- Validate the authenticated-member link before role-dependent queries, reduce a revoked admin
  session atomically, and resolve commitments with one canonical `userId == member.id` lookup.
- Gate `Mi pedido` entry on the exact refresh generation requested by the user.
- Keep the action available after timeout/unavailability so the user can request a new gated generation;
  disable it only while that generation is checking.

### Functions/Backend
- Keep `config/member.lastTimestamps` contract complete.

## 4. Test strategy
- Unit tests for freshness calculations.
- Integration tests proving acknowledgement occurs only after successful critical refresh and
  consumer-state application.
- Controlled concurrency tests for partial failure, timeout with late completion, bounded automatic retry,
  relogin, environment changes, authenticated-member relinks, access-scope changes, impersonation demotion,
  same-scope stale session writers, iOS equivalent-member merge ordering, and competing entry requests.
- Manual tests for timeout and automatic recovery UX.

## 5. Rollout and validation
- Validate both normal and stale-data scenarios in develop after the coordinated Firebase gate opens.
- Confirm client parity on Android/iOS before that live validation.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm `config/member` critical collections and freshness thresholds.

### Phase 2 - Implementation
- Implement the server-only refresh barrier, post-consumer acknowledgement, gate, timeout, and bounded automatic retry.

### Phase 3 - Closure
- Seed/verify the live timestamp contract, run live role canaries, and document outcomes.

## 7. Risks and mitigation
- Risk: excessive startup/order latency.
  - Mitigation: selective materialization, server aggregation for cache-only historical collections,
    a single canonical `userId == member.id` commitment lookup, a 10-second initial load/freshness window, and
    bounded freshness retries after 10, 20, and 30 seconds. The develop canary demonstrated that the
    previous 2.5-second deadline could expire while valid data was still loading; the affected develop
    member also had 666 historical order/orderline documents behind the former unbounded reads.
- Risk: an operation completes after timeout, relogin, impersonation, environment switch, or access
  change.
  - Mitigation: generation and scope fencing before consumer application, acknowledgement, and navigation.
- Risk: the current live Firebase dataset is not ready for all six reads.
  - Mitigation: keep seeding, deployed-Rules read-back, and live validation as a separate backend gate;
  this client cut performs no Firebase deployment.
