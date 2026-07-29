# ADR-0010: Separate Community Feed Refreshes from Session Authorization

## Status

Accepted

## Date

2026-07-29

## Context

ADR-0008 places Android and iOS authentication, authorization, and authorized
session hydration behind one bounded and serialized session-operation lane. In
the current Android implementation, that hydration reads news, notification
inbox entries, and notification read markers before an otherwise valid session
is fully applied. iOS already publishes the authorized session and then lets
its root-owned News/Notifications feature refresh those feeds independently.

HU-071 makes corrupt News and Notification documents explicit. Once those
repositories throw instead of silently filtering documents, a single corrupt
community document in Android could terminate an otherwise valid authorized
session. Conversely, swallowing or defaulting that failure would recreate the
false-empty/partial-success problem that HU-071 must remove.

Community feeds are private to an exact principal, selected member, access
scope, session epoch, and environment. Preserving a previous snapshot across
one of those boundaries can expose the previous member's inbox if the new read
fails. Preservation is safe only inside the same context.

## Decision Drivers

- Keep authentication and authorization fail-closed.
- Do not let non-authorizing community content invalidate valid credentials.
- Distinguish a valid empty query from corrupt or unavailable data.
- Preserve useful last-known content without leaking it across identities or
  environments.
- Keep Android and iOS behavior aligned.
- Avoid Firebase backend or live-data changes while Firebase is in standby.

## Decision

News, notification inbox, and notification read-marker loads are
**non-authorizing community refreshes**. They do not own, extend, fail, or
quarantine the bounded session-operation lane from ADR-0008.

The session lane remains authoritative for Auth mutations, member resolution,
environment routing, authorized-session publication, security cleanup,
timeouts, and the existing mandatory hydration that is not moved by this
decision. After an authorized state is published, the mobile client starts the
community refreshes through the feature's normal presentation boundary.

Every community refresh captures an immutable context containing at least:

- session epoch or equivalent identity generation;
- Firebase principal UID;
- selected canonical member ID;
- resolved environment;
- relevant news/notification authorization capability; and
- a per-feed monotonically increasing operation token.

Only the current operation in the exact same context may publish a snapshot,
finish its loading state, or report feedback. Cancellation remains distinct
from a user-visible data failure.

Within the same context, a failed refresh preserves the last complete valid
snapshot, finishes only its matching loading operation, reports recoverable
feedback, and allows the normal refresh action to retry.

When the principal, selected member, authorization capability, session epoch,
or environment changes, the client synchronously invalidates community
operations and clears `latestNews`, `newsFeed`, `notificationsFeed`, and
notification read IDs before starting the replacement refresh. Content from a
previous context is never used as the fallback for a new one.

An environment-routing transition is itself one of those boundaries; clients
do not wait for the later authorized-session publication to observe it. Android
performs the clear while it still owns the serialized session transition and
advances the session epoch without publishing the destination environment
early. iOS publishes the effective environment change through a synchronous,
reference-owned routing signal; the feature advances its routing generation,
cancels the previous hydration task, and clears community state in that same
turn.

Repository errors remain typed. Invalid-document resources may contain only
the collection and document ID, never notification/news fields or user
content.

This decision does not widen the canonical notification schema. Current
non-canonical Functions writers and existing live documents remain a separate
backend compatibility gate.

The strict decoder guarantee covers documents returned by Firestore. Existing
Rules require ordinary-member News reads to query `active == true`; documents
whose `active` field is absent or mistyped are excluded server-side and require
a later PII-free backend/Rules inventory. Administrator News reads remain
unfiltered and strict.

## Considered Options

### Keep community reads inside the session lane and fail the session

Rejected. News or notification content is not proof of identity or authority,
so its corruption should not revoke otherwise valid credentials or enter Auth
quarantine.

### Convert community failures to empty lists

Rejected. It makes transport, permission, and corrupt-data failures
indistinguishable from a successful empty query.

### Preserve the previous snapshot across member or environment changes

Rejected. A failed replacement read could expose content belonging to the
previous context.

### Add durable local-first storage in this cut

Deferred. It requires its own persistence, invalidation, migration, and sync
policy and is tracked separately from HU-071.

## Consequences

### Positive

- A corrupt community document cannot revoke a valid Android session.
- Empty, unavailable, and corrupt feeds remain observably distinct.
- Same-context failures keep useful content and offer deterministic retry.
- Identity, access, and environment changes cannot expose the previous inbox.
- Android and iOS share the same ownership and publication contract.

### Negative

- Authorized UI may appear before community feeds finish loading.
- Presentation code needs per-feed operation tokens and context fences.
- A context switch intentionally discards the old in-memory snapshot even when
  the replacement read later fails.
- Strict clients may report unavailable feeds until non-canonical backend
  writers and existing data pass a separately approved compatibility gate.

## Implementation and Verification

- Android publishes the authorized state before invoking fenced
  `SessionCommunityActions` refreshes.
- Android reads the live runtime environment through the composed provider and,
  while holding the session-operation lock, clears community state and advances
  `sessionEpoch` as soon as routing changes. The destination environment is
  still published only by the normal authorized-session resolution.
- iOS keeps refresh ownership in the root-owned
  `NewsNotificationsFeatureViewModel`, observes the router's synchronous
  transition signal, and adds routing generation, environment, epoch,
  capability, and per-feed operation checks.
- iOS community hydration has its own generation and cancellable task. It
  rechecks ownership between the News and Notification reads so an obsolete
  hydration cannot recapture a newer context or displace its loader.
- Both platforms test same-context preservation and retry, overlapping
  refreshes, sign-out/relogin, principal/member/capability/environment changes,
  and failed replacement reads without real sleeps.
- Android tests that a community repository failure cannot terminate an
  otherwise valid authorized session.
- No Firebase deployment or live-data mutation is part of this decision.

## Related Decisions and Work

- ADR-0001: cross-platform MVVM and Clean Architecture.
- ADR-0003: Firebase backend services.
- ADR-0004: root-owned iOS News/Notifications feature composition.
- ADR-0008: bounded mobile session operations; this decision narrows only the
  classification of community-feed reads within authorized hydration.
- GitHub issue [#230](https://github.com/JFrancoG/ReguertaPlus/issues/230).
- Deferred backend compatibility gate
  [#231](https://github.com/JFrancoG/ReguertaPlus/issues/231).
- Deferred News query/inventory gate
  [#232](https://github.com/JFrancoG/ReguertaPlus/issues/232).
