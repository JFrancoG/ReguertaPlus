# Plan - HU-071 (News and notification data integrity)

## 1. Technical approach

Keep Firestore dynamic values inside Data. Each platform will first decode a
document into a Data DTO and then map that DTO into the existing domain entity.
The decoding/mapping boundary throws on every required-schema violation. The
repository maps every document rather than filtering optionals, so any invalid
document rejects the complete snapshot and the caller never sees a misleading
partial list.

Invalid-document errors reuse the existing cross-platform repository error
contract and set the resource to a PII-free `collection/documentId` value.
Transport and Firestore permission failures continue through the existing
infrastructure error mappers.

Presentation refreshes use a captured session context and a monotonically
increasing operation token. Only the current token in the same principal,
member, authorization scope, session epoch, and environment may replace a
snapshot, stop its loading state, or publish feedback. A failure leaves the
previous content untouched only while that exact context remains current; a
context or access-scope boundary invalidates operations and clears news,
notification, and read-state snapshots before the next refresh. The existing
refresh action is the retry path.

Environment routing is observed at the transition itself, before a later
authorized mode can be published. Android clears community state under the
serialized session owner lock and advances the epoch without publishing the
destination environment early. iOS uses the router's synchronous reference
signal to advance a routing generation, cancel the previous community hydration
and clear its snapshots in the same turn. The iOS hydration task also owns a
separate generation and rechecks it between the News and Notification reads.

Cancellation is a distinct transition, not a recoverable data failure. Each
platform handles cooperative cancellation before generic errors, emits no
failure feedback, and may finish only the loader owned by the matching current
operation. Android rethrows `CancellationException`; iOS ends the cancelled
feature task after its ownership-aware cleanup. An obsolete cancellation never
clears a newer loader.

Android currently reads community feeds inside authorization hydration. Those
non-critical reads will move behind the same `SessionCommunityActions` refresh
boundary used by explicit route refreshes, after the authorized state is
published. This matches the root-owned iOS feature behavior and keeps corrupt
community data from terminating an otherwise valid session.

Mutation acknowledgement is separate from refresh convergence. A successful
news upsert/delete or notification send first applies its confirmed result and
completes the editor/callback state. Any subsequent read uses the normal fenced
refresh; its failure preserves the post-mutation snapshot and is presented as
a load problem, never as a rejected write that should be retried.

Mutation ownership is also separate from editor lifetime. Each platform keeps
one active News mutation and one active Notification mutation per session
context, captures an editor generation/identity, and does not release that
ownership when the route clears or reopens. A confirmed write may still update
the same-context feed, but editor, confirmation, feedback, callback, and loader
effects require the captured editor/request to remain current. Context changes
may replace an old token, and an old completion cannot finish its successor.

ADR-0010 records the narrow architectural change to ADR-0008: community-feed
reads are non-authorizing refreshes and do not own or fail the bounded Android
session lane. ADR-0008 remains authoritative for Auth mutation, authorization,
cleanup, timeout, and lane quarantine.

The canonical notification contract is intentionally stricter than several
current Functions writers: one reminder writer adds extra `users` payload keys,
and planning/calendar writers emit types outside the canonical enum. This cut
rejects those values rather than silently widening the client contract. It does
not claim end-to-end compatibility; writer and live-document normalization is a
later coordinated Firebase gate.
The backend gate is tracked in issue #231.

The client guarantee applies to every document returned by Firestore. Existing
Rules require the ordinary-member News query to include `active == true`, so a
document with an absent or mistyped `active` field is excluded by the server
before either decoder sees it. Administrator reads remain unfiltered and
strict. Detecting such hidden live corruption requires a later PII-free
inventory and backend/Rules gate; this cut does not claim that Firebase-side
validation while standby remains active. That gate is tracked in issue #232.

## 2. Layer impact

- UI: no view or visual-resource changes; existing refresh entry points remain
  the retry mechanism.
- Presentation: operation/session/environment fencing, atomic snapshot
  publication, deterministic loading completion, context-bound preservation,
  boundary clearing, and recoverable feedback.
- Domain: no entity or repository-protocol change; reuse typed repository
  errors.
- Data: strict throwing DTO decoders/mappers and infrastructure error mapping.
- App/composition: Android authorization invokes community refresh actions
  after authorized publication; iOS injects the runtime environment provider
  into the existing root-owned feature view model.
- Backend: none; Firebase remains in standby.
- Docs: HU-071 issue mirror, spec, plan, and task ledger.

## 3. Platform-specific changes

### Android

- Replace `mapNotNull` with throwing `decodeNewsDocuments` and
  `decodeNotificationDocuments` pipelines.
- Validate exact target payload shapes, notification enums, timestamp types,
  optional-field types, and inbox event identity.
- Map Firestore failures to `RepositoryException` while preserving
  cancellation.
- Fence news and notification refreshes with `sessionEpoch`, environment,
  principal UID, member ID, authorization scope, and per-feed operation token.
- Clear prior community snapshots when the session epoch, identity,
  environment, selected member, or relevant capability changes.
- Observe a runtime route change while holding the session-operation lock,
  synchronously clear community state, and advance `sessionEpoch` without
  publishing the destination environment ahead of authorized resolution.
- Catch failures explicitly, preserve snapshots, clear only the matching
  loading operation, and emit `feedback_unable_load_data` only for the current
  context.
- Catch `CancellationException` separately, perform ownership-aware loading
  cleanup, emit no feedback, and rethrow cancellation.
- Remove community reads from the authorization-critical hydration sequence and
  trigger the fenced refreshes after authorized state publication.
- Apply confirmed news/notification mutations locally before scheduling fenced
  convergence, with flags completed on every path.
- Serialize save/delete/send mutations with context-owned tokens and editor or
  deletion-request generations; preserve feed ACKs while fencing all stale
  editor, callback, feedback, and loader effects.

### iOS

- Replace `compactMap` with throwing DTO decoder/mapper pipelines.
- Validate the same schema and error resources as Android.
- Route Firestore failures through `FirestoreRepositoryErrorMapper` while
  preserving cancellation.
- Add the runtime environment and session-identity epoch to the root-owned
  News/Notifications feature context.
- Observe the router's synchronous transition signal and include its generation
  in every feature context so environment privacy clearing precedes the later
  authorized-mode hydration.
- Give automatic community hydration its own cancellable task and generation,
  with an ownership check between the sequential News and Notification reads.
- Clear prior community snapshots when identity, environment, selected member,
  or relevant capability changes.
- Fence each feed refresh with an operation ID; preserve the last snapshot and
  show `feedbackUnableLoadData` only for the current context.
- Catch `CancellationError` separately, perform ownership-aware loading
  cleanup, and return without failure feedback.
- Apply confirmed news/notification mutations locally before invoking fenced
  convergence; do not classify a later refresh failure as a save/delete/send
  failure.
- Preserve active mutation ownership across editor clear/reopen and separate a
  same-context feed ACK from editor-generation-bound UI effects.

### Functions/Backend

- No source, configuration, Rules, deployment, seeding, backfill, or live-data
  change.

## 4. Test strategy

- RED mapper tests for successful empty lists and complete-snapshot rejection.
- Parameterized required-field and wrong-type cases for news and notifications.
- Notification cases for every canonical type/target, exact payload shapes,
  invalid/blank user IDs, invalid segment roles, wrong timestamps, optional
  field types, and inbox identity mismatch.
- Typed resource checks proving collection/document ID context without payload
  content.
- Presentation tests for invalid-data, unavailable, and permission failures;
  last-snapshot preservation; loading completion; and successful retry.
- Controlled suspension tests for overlapping refreshes, sign-out/relogin,
  authorization-scope change, member switch, and environment switch without
  sleeps; each boundary failure must leave no previous-context content.
- Router-transition tests proving the old environment is cleared before
  authorization hydration resumes, plus an obsolete-hydration test proving it
  cannot start the second feed read in a newer context.
- Deterministic current and obsolete cancellation tests proving no feedback and
  no clearing of a newer loading operation.
- Android authorization test proving a community failure does not revoke an
  otherwise valid authorized session.
- Mutation tests proving a confirmed news save/delete and notification send
  remain successful when the following refresh fails, without a duplicate
  callback or write.
- Suspended mutation tests for clear/reopen, second invocation, stale failure,
  context replacement, and a newer deletion request; assertions cover exactly
  one write and no stale editor, dialog, feedback, callback, or loader effect.
- Focused tests first, then affected suites, Android unit/lint, and iOS build
  through Xcode MCP.

## 5. Rollout and functional validation

- This is a client-only cut and can be completed without Firebase deployment.
- Do not run live Firebase mutation or claim live-schema compatibility while
  Firebase remains in standby.
- Record current non-canonical Functions writers as a blocking later backend
  compatibility gate in issue #231; do not weaken the client decoder to
  accommodate them implicitly.
- Record that the Rules-required member News query can diagnose only returned
  documents; inventory/schema validation for documents excluded by
  `active == true` remains a later Firebase gate in issue #232.
- If a future develop canary exposes legacy invalid documents, remediate them
  under a separately approved Firebase gate rather than weakening this client
  contract silently.

## 6. Phased implementation sequence

### Phase 1 - Contract and RED

- Create cross-platform pure decoder seams and failing schema tests.
- Add failing presentation tests for preservation, retry, and stale contexts.
- Add failing privacy-boundary tests proving previous-context snapshots are
  cleared before a failed replacement refresh.
- Add the failing Android authorization/non-critical-feed regression.

### Phase 2 - Data GREEN

- Implement DTO decoders/mappers and repository error translation.
- Remove `compactMap`/`mapNotNull` from the live repositories.

### Phase 3 - Presentation GREEN

- Implement operation and session/environment fencing on both platforms.
- Implement synchronous community snapshot clearing at every context or access
  boundary.
- Fence the environment-routing transition itself on both platforms and give
  iOS automatic hydration independent cancellation/generation ownership.
- Decouple Android community hydration from authorization.
- Separate confirmed mutation acknowledgement from feed convergence on both
  platforms.

### Phase 4 - Validation and audit

- Run focused and affected suites, Android unit/lint, and iOS Xcode MCP build.
- Run an isolated iOS standards review and reconcile the task/DoD evidence.

## 7. Technical risks and mitigation

- Risk: invalid legacy data causes a visible unavailable state.
  - Mitigation: retain the previous valid snapshot, provide retry, and keep live
    remediation behind a later explicit Firebase gate.
- Risk: current non-canonical backend writers create documents rejected by the
  strict mapper.
  - Mitigation: report the incompatibility explicitly and keep backend writer,
    backfill, and live canary work behind a later approved Firebase gate.
- Risk: a stale operation clears a newer loading flag.
  - Mitigation: only the matching operation token may finish its loading state.
- Risk: community refresh changes interfere with Android session ownership.
  - Mitigation: publish authorization through the existing fenced auth lane,
    then start independent context-fenced community tasks.
- Risk: platform validation drifts.
  - Mitigation: mirror fixtures and assertions for the canonical contract and
    finish with a cross-platform diff audit.
