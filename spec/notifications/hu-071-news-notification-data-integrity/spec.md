# HU-071 - News and notification data integrity

## Metadata

- issue_id: #230
- priority: P1
- platform: both
- status: in_progress

## Context and problem

The live Android and iOS Firestore repositories currently use `mapNotNull` and
`compactMap` while decoding news and notification documents. Missing required
fields can therefore remove a document silently, and several other required
fields receive defaults. A successful query can look like a valid empty or
partial feed even though the remote snapshot was corrupt.

The presentation paths also need one consistent failure contract: keep the
last valid snapshot only inside the same context, end loading, offer feedback
and retry, and never publish a late result or error into a different session or
environment. A context or authorization-scope change must clear the previous
feed before any new read begins. On Android, community-feed reads must not
remain part of the authorization-critical hydration lane.

## User story

As a member, I want news and notifications to report unavailable or corrupt
data honestly so that I never mistake a partial feed for the complete current
feed and can retry without losing the last known valid content.

## Scope

### In scope

- Throwing Data DTO decoders and mappers for `news`, `notificationEvents`, and
  `notificationInbox` on Android and iOS.
- Required-field, type, enum, timestamp, target-payload, role, and inbox
  document-identity validation.
- Typed repository errors whose resource contains only collection and document
  ID for invalid documents.
- Atomic feed publication after the complete snapshot has decoded.
- Last-valid-snapshot preservation, loading completion, feedback, retry, and
  session/environment fencing in the active presentation paths.
- Immediate invalidation and clearing of news, inbox, and read state on a
  principal, member, authorization-scope, session-epoch, or environment
  boundary.
- Android authorization hydration decoupled from non-critical community feed
  reads, which run through the fenced community refresh path after the
  authorized state is published.
- Confirmed news save/delete and notification send results applied locally;
  later convergence uses the fenced refresh and cannot reinterpret the write
  as rejected.
- Editor-bound mutations serialized by context and editor generation so a
  clear/reopen cannot start a duplicate write or let an old completion mutate
  the new editor, confirmation, feedback, callback, or loader.
- Deterministic RED/GREEN tests and cross-platform parity.

### Out of scope

- Firebase deployment, Rules, Functions, seeding, backfill, or live-data
  mutation.
- Durable local-first caching or synchronization policy.
- Repositories outside live composition, including chained fallbacks, unless
  the composition changes during implementation.
- Visual changes to news or notification screens.
- Audit P2/P3 findings.
- Normalizing current non-canonical Functions notification writers or existing
  live documents; both remain a later coordinated backend gate.

## Linked functional requirements

- Firestore canonical contract sections 4.10, 4.11, and 5.
- ADR-0001 cross-platform MVVM and Clean Architecture parity.
- ADR-0003 Firebase containment in Data.
- ADR-0004 root-owned iOS News/Notifications feature composition.
- ADR-0010 non-critical community refreshes outside the Android authorization
  lane.

## Acceptance criteria

- A successful query with zero documents returns `[]`.
- Every document returned by a successful query with a missing, blank,
  mistyped, or invalid required field throws `INVALID_DATA`; no returned
  document is silently omitted.
- News requires a non-empty ID, `title`, `body`, and `publishedBy`, plus
  Boolean `active` and Firestore Timestamp `publishedAt`.
- Notifications require a non-empty ID, `title`, `body`, canonical `type`,
  canonical `target`, exact `targetPayload`, Timestamp `sentAt`, and non-empty
  `createdBy`.
- `targetPayload` is exactly empty for `all`, contains one non-empty string list
  `userIds` for `users`, or contains `segmentType = role` plus one canonical
  member role for `segment`.
- Inbox documents require `notificationEventId` equal to their document ID.
- Missing or null `urlImage` and `weekKey` are accepted; a present value of the
  wrong type is invalid.
- Invalid-data resources expose only collection and document ID, never document
  fields or user content.
- Transport and permission errors remain typed repository failures.
- Failed reads preserve the last valid feed and read-state snapshot only when
  the principal, member, authorization scope, session epoch, and environment
  are unchanged; they finish the matching loading operation, publish
  recoverable feedback, and allow retry.
- A context or authorization-scope change invalidates active operations and
  clears `latestNews`, `newsFeed`, `notificationsFeed`, and
  `readNotificationIds` before the new refresh.
- A later valid retry atomically replaces the previous snapshot.
- Stale results and failures after principal, selected member, session epoch,
  or environment changes publish neither state nor feedback.
- Cooperative cancellation produces no failure feedback and only finishes the
  matching current loading operation; obsolete cancellation cannot clear a
  newer loader.
- Android sign-in/session refresh can authorize even when the subsequent
  community-feed refresh fails.
- A confirmed news save/delete or notification send completes its local
  success state and callback even if the subsequent feed refresh fails; the
  failure is reported as a recoverable load problem and never invites a
  duplicate mutation retry.
- Clearing or reopening a News/Notification editor never releases an in-flight
  mutation. Its confirmed ACK may still update the same-context feed, but its
  editor effects, confirmation, feedback, and callback apply only while the
  captured editor generation is current. A stale context cannot block or
  finish a mutation in the replacement context.
- Repeated confirmation of one News deletion issues one repository delete and
  one success callback; completion of an older deletion cannot dismiss a newer
  deletion request.
- Android unit tests and lint, plus focused and affected iOS tests/build, pass
  without new warnings.

## Dependencies

- Canonical Firestore contract:
  `docs/requirements/firestore-collections-fields-v1.md`.
- Existing typed errors: `RepositoryError` on iOS and `RepositoryException` on
  Android.
- Existing session fencing patterns in the Shifts and Shared Profile features.
- ADR-0010: separate non-critical community refreshes from session
  authorization.
- Deferred backend compatibility gate:
  https://github.com/JFrancoG/ReguertaPlus/issues/231
- Deferred News query/inventory gate:
  https://github.com/JFrancoG/ReguertaPlus/issues/232
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/230

## Risks

- Existing live documents may violate the canonical required schema.
  - Mitigation: this client-only cut fails honestly and preserves the previous
    same-context snapshot; no live mutation occurs while Firebase is in
    standby.
- Firestore Rules require non-publisher News reads to query
  `where(active == true)`. A document with missing or mistyped `active` is not
  returned to that client and therefore cannot be diagnosed by its decoder.
  - Mitigation: administrators decode the unfiltered collection; treat a
    PII-free live inventory and backend/Rules schema validation as an explicit
    later Firebase gate tracked in issue #232, not as a capability of this
    client cut.
- Current Functions source emits extra `users` payload keys and notification
  types outside the canonical enum in some workflows.
  - Mitigation: strict clients reject those values honestly; do not claim
    end-to-end compatibility until a separately approved backend contract and
    live-data gate normalizes writers and existing documents.
- A strict mapper could reject optional legacy nulls.
  - Mitigation: accept missing/null only for the two optional content fields and
    retain tolerant DTO decoding before strong domain validation.
- Parallel or late refreshes could clear a newer spinner or snapshot.
  - Mitigation: bind publication and loading completion to a per-feed operation
    token plus session and environment context.
- Decoupling Android community hydration could change login timing.
  - Mitigation: publish the authorized state first, then exercise the existing
    explicit refresh actions with deterministic tests.
- A strict read-back after a successful write could create a false mutation
  failure.
  - Mitigation: apply the repository's confirmed mutation result locally first
    and run convergence through the separately fenced refresh operation.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] RED failures and GREEN evidence recorded for Android and iOS.
- [x] Standard Android unit/lint validation passes.
- [x] Focused and affected iOS tests pass, and the final build passes through
  Xcode MCP.
- [x] The final expanded iOS tests execute through Xcode MCP on iPhone 17. All
  unit and HU-071 tests pass; the combined run's sole transient UI focus failure
  passes 1/1 on an immediate isolated official rerun, and the historical launch
  test remains skipped.
- [x] Independent Android final review has no blocking findings.
- [x] Independent iOS standards review has no blocking findings.
- [x] Android/iOS parity is confirmed or any gap is documented.
- [x] Issue and planning documentation created.
- [x] ADR-0010 recorded in English and Spanish.
- [x] PR prepared with validation evidence when delivery is authorized.

## Validation evidence

### Android

- RED decoder/composition cut: the isolated tree
  `/tmp/reguerta-android-red.q2TCTp/Reguerta` failed compilation with 13
  expected diagnostics before the upload and runtime-environment seams existed.
- RED routing boundary: 53 tests ran in
  `/tmp/reguerta-hu071-routing-red2.V3n8h7/android/Reguerta`; the new
  environment-routing/privacy test was the single failure before synchronous
  clearing was implemented.
- Mutation-ownership RED snapshot:
  `/tmp/reguerta-hu071-mutation-red.HXaGHp/android/Reguerta`; 34 tests ran and
  the new save, send, and duplicate-delete contracts were the 3 expected
  failures.
- Raw-role boundary RED/GREEN snapshot:
  `/tmp/reguerta-hu071-role-red.Ha65nq/android/Reguerta`; the new privacy
  boundary first failed 1/1, then passed after raw roles joined the context
  identity.
- Parity-ownership RED snapshot:
  `/tmp/reguerta-hu071-ownership-red2.S0EsQd`; 45 tests ran and the 5 new
  save/upload, stale-convergence, and same-ID delete-request contracts were
  the expected failures.
- Restoration RED: `HomeNavigationTest` ran 9 tests and the new transient
  confirmation contract was the sole expected failure while the six pending
  confirmation fields still used `rememberSaveable`.
- Final GREEN on the real working tree:
  - Home/community focused suites: 56/56 passed.
  - Full unit suite: 434/434 passed, with no failures, errors, or skips.
  - `app:lintDebug`: 0 errors; 133 baseline warnings and 1 hint, none in a
    HU-071 file.
  - `app:connectedDebugAndroidTest`: 18/18 passed on
    `Pixel_9_Pro_XL_Api37-A17`, API 37 / Android 17.
- The earlier isolated snapshot preserved the user's then-concurrent Gradle
  edit. Before final validation that edit had been resolved outside HU-071;
  real `app/build.gradle.kts` matches `HEAD` and this cut did not modify it.
- Independent Android final review: GO, with no P0, P1, or P2 findings.

### iOS

- All relative iOS artifact paths below are rooted at
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default`.
- Initial RED cut: 18 tests ran, with 15 expected failures and 3 passes, in
  `RunSomeTests/E03CDC34-D08F-48BB-A481-42613DA52EAA.txt`.
- Confirmed-write race RED: 1/1 expected failure in
  `RunSomeTests/503784A7-15CE-4225-B59E-9D7A34D80B23.txt`.
- Final routing/hydration RED evidence:
  - the obsolete hydration test failed 1/1 in
    `RunSomeTests/754A76A1-4E7F-4AFB-BC31-EC1E086DCE98.txt`;
  - the router-boundary test first failed structurally in
    `GetBuildLog/84DBE6FE-2269-4940-85EE-0A1E4566C2E8.txt` because the
    synchronous transition contract did not yet exist.
- Earlier GREEN evidence through Xcode MCP:
  - routing/hydration: 2/2 passed in
    `RunSomeTests/5A953590-37A3-4F47-87DD-DA5E3810609D.txt`;
  - HU-071 plus routing/session regression: 45/45 passed in
    `RunSomeTests/CBF51231-81CE-4D23-82C3-EF49D225DA24.txt`;
  - historical News/Notifications suite: 15/15 passed in
    `RunSomeTests/92AEBCDC-572E-4FE7-9540-3D22398135A2.txt`;
  - the then-current full suite passed 598/599 with the one historical UI skip
    in `RunAllTests/F7845C9E-1769-4C49-B98A-E8A56A330ABA.txt`.
- Final mutation/editor RED evidence:
  - clear/reopen ownership: `/tmp/reguerta-hu071-red.gzJO6A/RED.xcresult`;
  - save/upload serialization:
    `/tmp/reguerta-hu071-upload-red.DcDJjP/RED.xcresult`;
  - stale confirmations:
    `/tmp/reguerta-hu071-confirmation-red.V6nc5G/RED.xcresult`.
- Final focused GREEN evidence:
  - ownership and races: 12/12 in
    `/tmp/reguerta-hu071-final-focal.gwW7j1/GREEN.xcresult`;
  - confirmations: 9/9 in
    `/tmp/reguerta-hu071-confirmation-green.BiG5U7/GREEN.xcresult`;
  - draft revision and context replacement: 8/8 in
    `/tmp/reguerta-hu071-boundary-red.gZiJjY/RED.xcresult`. Despite the
    preventive directory name, this first run was GREEN because the general
    fences already satisfied the new coverage.
- Final full unit target: 607/607 passed, 0 failed and 0 skipped on iPhone 17 /
  iOS 26.5 in `/tmp/reguerta-hu071-final-unit.3ahvGk/FINAL.xcresult`.
- Final official Xcode MCP test gate after selecting iPhone 17:
  - mutation-boundary focal: 2/2 passed in
    `RunSomeTests/C6683C39-5BDC-437A-8F9E-BA3965461AF1.txt`;
  - expanded run: 616 total, 614 passed, 1 transient UI keyboard-focus failure,
    and the 1 historical launch-test skip in
    `RunAllTests/8141AC4B-33AA-4C0A-A508-5AF87345774B.txt`; every
    `ReguertaTests` and HU-071 case passed;
  - isolated official rerun of
    `ReguertaUITests/testDrawerNavigationOpensSelectedRoute()`: 1/1 passed in
    `RunSomeTests/795F66FF-1D90-4F0E-936D-4E460DE41FB4.txt`. The combined-run
    focus failure is therefore classified as a transient runner flake, with no
    reproducible residual failure.
- Final Xcode MCP build passed with 0 errors in
  `BuildProject/BuildProject-Log-20260729-122823.txt`. SwiftLint retained the
  same 17 baseline warnings, none in HU-071; final log:
  `GetBuildLog/2A669E0F-73E7-4F3B-B874-B4D3752BF914.txt`.
- Independent iOS final review: technical GO, with no P0, P1, or P2 findings.

### Scope controls

- `git diff --check` passes.
- No Functions, Firebase configuration, Rules, deployment, seeding, backfill,
  or live-data mutation is included.
- The deferred writer/live-document compatibility gate remains open as issue
  #231, and the News query/inventory gate remains open as issue #232 while
  Firebase is in standby.
- Android final review, iOS final review, and cross-platform parity review are
  GO with no P0, P1, or P2 findings. Delivery remains open.
