# ADR-0009: Require Process-Live Authorization for Account Push Registration

## Status

Accepted

## Date

2026-07-28

## Context

Reguerta caches a device identifier, the latest FCM registration token, and an
authorized account context so token refreshes can be associated with the
correct member. ADR-0007 keeps the published Firebase clients on a phased
authorization rollout, so a mobile callback cannot rely on strict Rules to
reject every stale registration yet.

Issue #214 added encrypted storage, exact `memberId + authUid + environment +
lease` contexts, and repository revalidation. A remaining lifecycle gap still
allowed a fresh process to combine restored Firebase Auth and disk state and
upload a token before the application had revalidated the authorized member.
Android could also receive an FCM callback while logout cleanup was waiting for
older session work. On iOS, the messaging callback could adopt a Keychain
context into a newly created coordinator.

A persisted context proves only what an earlier process authorized. It is not
evidence that the current process has completed member resolution, active-state
validation, and session ownership.

## Decision Drivers

- Stop token association as soon as the local session loses authorization.
- Never reconstruct upload authority from Firebase Auth and disk state alone.
- Preserve token caching so a later valid login can catch up without losing a
  refresh callback.
- Apply the same member, UID, environment, lease, and lifecycle checks on
  Android and iOS.
- Remain compatible with published clients and the phased Firebase rollout.
- Avoid backend, Rules, Functions, or live-data changes in this cut.

## Decision

Account-scoped push registration requires a **process-live authorization** in
addition to Firebase Auth and encrypted persisted state.

That authorization contains the exact member, Auth UID, environment, and
session lease established by the current authorized-session flow. It also
retains a live process/session fence: atomic generations on Android and the
session-ownership closure on iOS. Every upload must prove all of the following
at the repository checkpoints immediately before a write:

1. The process-live authorization still owns the operation.
2. The current Firebase UID matches the authorized UID.
3. The persisted context still matches the member, UID, environment, and lease.
4. The latest cached token still matches the token being written.
5. The process/session fence still reports the authorized session as current.

The token callback always normalizes and stores the latest token. Without a
process-live authorization it performs no account upload. The next fully
authorized login may use that cached token during its bounded registration.

Android shares a process-local authorization registry between the authorized
device registrar and `FirebaseMessagingService`. Logout and terminal session
recovery invalidate it synchronously, before asynchronous persistent cleanup.
The registry uses an atomic generation: an activation permit obtained before
logout cannot reactivate authorization after logout has advanced the
generation.

iOS stores the context and its `@MainActor @Sendable` session fence as one actor
state value. The messaging callback never adopts a Keychain context into a
fresh coordinator. The fence is evaluated both before upload and through the
repository's revalidation callback so actor reentrancy at an `await` cannot
turn an obsolete authorization into a write.

The known Android encrypted legacy shape containing `member_id`, `environment`,
and `lease_id` but no `auth_uid` is migrated fail-closed by deleting only the
authorized-context keys. Device ID and cached token remain non-authorizing
catch-up data. Any other partial shape remains a typed corruption error.

Registration, storage, and cleanup failures remain best-effort for product
continuity: they are reported or logged without blocking local sign-out. The
in-memory invalidation itself is synchronous and does not depend on network or
encrypted storage availability.

## Considered Options

### Trust persisted context when Firebase Auth restores the same UID

Rejected. It would authorize a callback before the current process revalidates
member activity, routing, and session ownership.

### Disable token refresh uploads entirely

Rejected. It would prevent stale writes but also leave valid sessions with
outdated push credentials.

### Perform remote token deletion and backend unlink during logout now

Deferred. It requires a durable retry policy, compatibility with the currently
published apps and sender, and a coordinated decision between the legacy token
model and the newer Firebase Installation ID registration model.

## Consequences

### Positive

- Cold starts cannot silently regain account push-write authority from disk.
- Logout fences callbacks before persistent cleanup or Firebase sign-out
  finishes.
- Replaced leases and environments cannot commit a late token update.
- Both clients retain the latest token for a later authorized catch-up.
- No Firebase deployment or live-data mutation is required.

### Negative

- A process restart requires the application to complete authorization again
  before token uploads resume.
- Mobile lifecycle code now maintains an additional in-memory generation/fence.
- Remote token records for a signed-out account are not removed by this
  decision.

## Revocation Boundary and Deferred Work

This decision revokes **local authorization to create or update account push
associations**. It does not yet provide absolute remote revocation. The sender
may still hold a previously registered token, and FCM may already have accepted
messages for delivery. Therefore the product must not promise zero late
notifications after logout.

Remote unlink, durable retry, sender TTL policy, Android auto-init policy, and
the migration from deprecated token APIs to Firebase Installation ID
`register`/`unregister` remain deferred until the shared Firebase clients can be
coordinated safely.

## Implementation and Verification

- Android deterministically tests cold process state, UID/context mismatch,
  lease and environment replacement, invalidation during a suspended write,
  activation-generation races, immediate logout fencing, and legacy migration.
- iOS deterministically tests cold-process Keychain state, a valid callback
  after live registration, and session-fence invalidation during a suspended
  repository write.
- Tests use controllable gates and no real sleeps.
- No Functions, Firestore Rules, Storage Rules, or live Firebase data change.

## Related Decisions and Work

- ADR-0003: Firebase backend services.
- ADR-0007: phased Firebase role-based authorization.
- ADR-0008: bounded mobile session operations and cleanup barriers.
- GitHub issue [#217](https://github.com/JFrancoG/ReguertaPlus/issues/217).

## References

- [Swift Evolution SE-0306: Actors](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0306-actors.md)
- [Firebase: Manage FCM registration tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Firebase Android: `FirebaseMessaging`](https://firebase.google.com/docs/reference/android/com/google/firebase/messaging/FirebaseMessaging)
