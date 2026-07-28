# ADR-0008: Bound Mobile Session Operations Without Releasing Unsafe Firebase Auth Work

## Status

Accepted

## Date

2026-07-28

## Context

Android and iOS serialize sign-in, sign-up, and session refresh so an older
Firebase Authentication operation cannot finish after a newer one and replace
the process-wide authenticated user. Issue #216 introduced generation and
ownership fences plus cleanup-before-successor ordering.

Those fences do not bound user-visible progress. A current Android operation
can still throw outside its expected result mapping and leave presentation
state incomplete. On both platforms, a Firebase SDK call or repository can
ignore cooperative cancellation and never return, leaving a spinner or the
serialized session lane blocked.

Cancellation is not physical termination. Kotlin coroutine timeouts cancel
cooperatively, and Swift tasks require the running operation to observe
cancellation. A simple race against a timer can therefore recover the caller
while an older Firebase request continues and later mutates the shared Auth
singleton. Releasing a successor at that point would reopen #216.

## Decision Drivers

- Recover the UI within a finite, testable interval.
- Preserve cleanup-before-successor ordering from #216.
- Never retain or enqueue another password behind unbounded work.
- Keep late Firebase Auth mutations from authorizing or exposing private data.
- Use the same observable policy on Android and iOS.
- Avoid any Firebase backend, Rules, Functions, or live-data change.

## Decision

The mobile clients use one serialized session-operation lane for `signIn`,
`signUp`, `refreshCurrentSession`, and the authorized-session hydration owned
by those operations.

An operation receives an application deadline of 30 seconds. The budget starts
only after its predecessor and predecessor cleanup have drained. It is a bound
on presentation ownership, not a guarantee that the Firebase SDK or a
repository has physically stopped. The duration is centralized and injectable
for deterministic tests.

Thirty seconds is the default because a session operation can compose Auth,
user reload, token refresh, authorization, and repository reads. It uses the
existing 30-second network ceiling in the app and leaves headroom over the
15-second timeout used by one isolated authenticated Function request. The
value can change without weakening the state-machine contract below.

Exactly one event wins ownership at the deadline: the operation result or the
deadline transition. The winner is selected by the existing generation and
owner fence under the platform's serialized state boundary.

If the deadline wins, or a current operation fails unexpectedly after invoking
Auth, the client must:

1. Invalidate presentation ownership before publishing state.
2. Clear session spinners, refresh tracking, feature loaders, private data, and
   runtime environment routing.
3. Publish a recoverable signed-out or unauthorized state. A timeout is not
   presented as proven credential expiry.
4. Attempt immediate Firebase `signOut` and cancel the operation cooperatively.
5. Keep the physical operation as a `DRAINING` barrier.

While any operation owns the lane (`ACTIVE`, cleanup, or `DRAINING`), additional
sign-in and sign-up submissions are rejected rather than queued, and refresh is
ignored. This prevents a second credential from being captured by a task waiting
behind work that may later prove unbounded. When the old call finally returns,
its fence prevents publication. The client reconfirms Firebase Auth sign-out and
waits for and validates the composite routing, authorized-device, and local
metadata cleanup already started before releasing the lane. A later login can
start only after that definitive confirmation completes.
Asynchronous security cleanup started by a manual sign-out also owns the cleanup
lane until it has been confirmed.

If the SDK never returns, the UI remains recovered and contains no private
session data, but the lane remains fail-closed for the lifetime of the process.
Restarting the process is the only safe recovery because the client cannot
prove that abandoned Auth work will not mutate the singleton later.

Firebase Auth providers add cancellation checkpoints immediately after awaits
that can create or restore an authenticated user and before another suspension.
If cancellation is observed, they synchronously sign out before returning or
propagating cancellation. The outer definitive cleanup remains a second line
of defense.

Definitive cleanup is confirmed only after Firebase Auth sign-out, runtime
environment reset, authorized-device context removal, and applicable local
session metadata removal succeed. If any security-critical step fails, the
client keeps a local unauthorized/fail-closed state, does not restore private
data, and does not release the lane. The credential already passed to the SDK
remains retained by that in-flight SDK work until it returns; the design
prevents retaining a second credential by rejecting submissions during
`DRAINING`.

Password reset is outside this decision. It does not share the #216 lane or
change the authenticated user. It can receive a separate bounded policy later
without inheriting the Auth quarantine contract.

## Considered Options

### Wrap the operation in `withTimeout` or race it against `Task.sleep`

Rejected as a safety guarantee. Both mechanisms request cooperative
cancellation; they do not prove termination of blocking or non-cooperative SDK
work.

### Detach old work and immediately allow a successor

Rejected because a late Firebase result can still replace the process-wide
authenticated user after the successor succeeds.

### Queue the successor behind an owned lane

Rejected for interactive authentication because it can retain a new password
for an unbounded interval and gives the user no honest progress contract.

### Recover the UI and quarantine the lane until definitive cleanup

Selected. It preserves the #216 invariant while giving the user bounded visual
recovery and deterministic behavior.

## Consequences

### Positive

- Session UI cannot spin indefinitely after the application deadline.
- Late results cannot publish authorization or overtake cleanup.
- Android and iOS share one explicit state-machine policy.
- Tests can control time without real sleeps.
- No backend rollout or legacy Firebase migration is involved.

### Negative

- A provider that never returns requires an app restart before another login.
- An in-flight SDK call may retain the credential already supplied to it.
- Timeout handling and provider checkpoints add lifecycle state and tests.
- The 30-second default may need future tuning from production telemetry.

## Implementation and Verification

- Android uses an injected delay-driven watchdog and virtual coroutine time.
- iOS uses an injected `Duration` sleeper controlled by tests.
- Both platforms test deadline expiry, unexpected current exceptions,
  non-cooperative providers, rejected successors while the lane is occupied,
  late results, definitive cleanup ordering and failure, manual sign-out
  cleanup, refresh recovery, and a later login.
- Android additionally exercises the atomic result/deadline race and each
  concrete reload, token-refresh, and verification checkpoint. iOS exercises
  the shared post-mutation wrapper used by those call sites, including
  cancellation and failed sign-out propagation. Ordinary failures after an
  Auth mutation must also confirm sign-out before returning a recoverable
  result; otherwise they propagate into `DRAINING`.

## Related Decisions and Work

- ADR-0003: Firebase as backend services.
- ADR-0004: iOS root dependency injection and Session/Auth ownership.
- GitHub issue #216: session operation ownership and late-result fences.
- GitHub issue #218: bounded session operation implementation.

## References

- [Apple Task cancellation](https://developer.apple.com/documentation/swift/task#Task-Cancellation)
- [Kotlin coroutine timeout cancellation](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-timeout.html)
