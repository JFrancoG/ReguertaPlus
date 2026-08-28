# Plan - HU-082 (Continuous seasonal shift rotation)

## 1. Delivery strategy

Implement the invariant as a backend-owned domain model before changing the
existing orchestration or mobile success flow. Keep Firestore as the system of
record, make generation deterministic and testable without Firebase, and then
add one thin adapter for persistence, requests, and mobile read-back.

HU-082 is one story because the algorithm and the mobile completion contract
must agree before the result is usable. Google Sheets discovery/develop repair
remain in HU-083, and production activation remains independently reversible in
HU-085.

An urgent member-facing provisional plan may be prepared earlier only through the
separate [non-activating communication baseline](communication-baseline.md). That
path contrasts one source manifest, binds UID plans in `assignmentDigest`, binds the
UID/display-name resolver in `resolverDigest`, and seals both in `planningDigest`
without invoking production preview or writing production through rendering. Only a
globally approved, zero-write-attested seal may be revalidated and rendered. A separate
maintainer authorization may publish only that sanitized render to consultation tabs;
HU-085 must later reproduce it exactly or complete supersession and recommunication.

## 2. Authority and data model

Introduce a versioned rotation state per environment and type with at least:

- ordered member identifiers and immutable round cohort;
- round identifier and number;
- next cursor and last committed position;
- publication horizon and target season;
- optimistic version/lease and last idempotency key;
- last preview snapshot/digest, staged candidate revision, active revision, and
  notification release state/lease;
- version references for every fairness input, including membership,
  rotation/config/calendar overrides and the HU-084 credit ledger when enabled;
- timestamps and provenance.

Add one seasonal activation-bundle aggregate containing the exact delivery and
market subplan target/frontier, combined input/digest, staged/active revision,
transaction budget, sync commands, notification batch, and leases on both type
rotations. Per-type cursors remain independent; publication is all-or-nothing.

Keep the communication digest layers distinct: `assignmentDigest` for source-bound UID
plans, `resolverDigest` for the canonical UID/display-name resolver, and
`planningDigest` sealing both plus `sourceManifestDigest`. They remain different from
runtime `bundleDigest` and `candidateDigest`. HU-085 evidence links them by exact
source contrast and row-by-row delivery/market alignment; it does not assume different
digest schemas are equal.

Each generated shift carries both `rotationOwnerUserId` and `assignedUserId`
(or the plural equivalent for market). HU-082 initially copies each shift's
owner member(s) into its effective-assignee field(s); it does not require the
delivery and market cohorts to be identical. Only rotation ownership advances
the cursor. A later effective assignment must not rewrite history.

Bootstrap each typed queue only from valid versioned state, reproducible historical
owner/round evidence, or an admin-approved exact UID order/round/cursor mapping. A
brand-new alphabetical proposal is persisted as exact UIDs plus stable tie order.
For delivery, an unambiguous eligible helper registered on the last legacy row is a
hard constraint on the first new owner/effective lead; any cursor conflict fails for
mapping instead of rewriting that helper. Market bootstraps independently.

The final collection names and Rules surface are frozen during Phase 1 and
documented in the English and Spanish Firestore references before code lands.

## 3. Expected implementation impact

### Functions and Firestore

- Extract the planner contract from `functions/src/index.ts`.
- Add focused modules such as:
  - `functions/src/shift-planning-contract.ts`
  - `functions/src/shift-eligibility.ts`
  - `functions/src/shift-rotation-store.ts`
  - `functions/src/delivery-shift-planner.ts`
  - `functions/src/market-shift-planner.ts`
  - `functions/src/shift-planning-publication-contract.ts`
- Keep `index.ts` as authorization/orchestration rather than the home of the
  algorithms.
- Add transaction, idempotency, request status, notification, and provenance
  adapters.
- Add an IAM-restricted operator-only rollout execution endpoint/control boundary
  which accepts only maintenance-allowlisted operation IDs/revisions/digests. The
  operator is invoker-only; only the endpoint runtime has data-write authority.
- Give it explicit repair, migration/bootstrap, preview, stage, activate, sync-
  correction, recovery, and manifested-cleanup modes. Migration scripts provide
  plans/digests only; no operator/deployer/controller/script may bypass the runtime.
- Add preview/stage/activate digest binding and idempotent notification
  hold/release.
- Store versioned candidates outside normal member queries/Sheets exports and
  store one exact two-type bundle candidate for atomic promotion.
- Preserve current flat-collection readers at initial rollout by committing the
  bounded combined delivery/market projection, both rotation/cursor transitions,
  Sheets-sync commands, and held-intent manifest in one Firestore transaction.
  Fail closed on combined-budget overflow; do not promote per type, copy visible
  rows in batches, or rely only on a pointer current clients ignore.
- Define and prove with a fake consumer the `onShiftWritten` contract for backend-
  owned activation/repair/recovery/sync-correction metadata: changed before/after
  marker plus allowlisted registry/digest for creates/updates, and exact before-image
  marker/version/hash/path for recovery deletes. HU-083 implements the real handler;
  only the exact mutation no-ops, later ordinary edits/deletes stay active, and
  explicit outboxes remain authoritative under replay.
- Freeze publication codec v1 before either materializer: exact flat public
  assignment/completion/document revisions, additive installed-client fields,
  changed-only backend marker validation, an immutable activation tombstone,
  and lossless digest-bound before-images with captured update-time evidence.
  Recovery uses a fresh transaction-read update-time precondition. Keep
  marker-free payload digests and transaction-request digests separate so
  neither becomes self-referential.
- Retain terminal operation tombstones and per-event ledgers beyond the maximum
  configured delivery/retry horizon plus safety margin. Unknown changed backend-
  only markers fail closed/alert; cleanup never turns them into ordinary events.
  The local producer contract now freezes the digest-bound policy, exclusive
  expiry, deterministic backend-only operation/event paths, controlled and
  rejected ledger terminals, and cleanup protection set. HU-083 persists and
  integrates those records with the real trigger and alert channel.
- Keep held notification intents in a backend-owned outbox/path not watched by
  the existing notification trigger; release creates canonical events with
  stable idempotency keys. Make the existing trigger read the backend-only
  companion receipt before any fan-out: receipt absence preserves legacy events,
  exact receipt/event evidence reserves governed dispatch, and present malformed
  evidence fails closed without using the legacy transport. Compose release and
  the bounded dispatcher behind one non-exported executor that validates its full
  command before release and preserves exact release replay semantics. Bind the
  local executor to real Firestore/modular Messaging behind a strict CORS-disabled,
  invoker-only HTTP factory, but keep both factories absent from `index.ts` until
  HU-085 provisions and verifies runtime/IAM authority. Treat every error escaping
  an accepted execution as unknown at the HTTP boundary unless the lower layer has
  already returned a persisted terminal result.
- Add/update strict Firestore Rules for backend-owned state and client-readable
  request results.
- Add backend-owned monotonic maintenance/write epoch plus active-revision state.
  Require expected values at every affected direct/client/backend mutation and
  reject stale offline queues in Rules/server CAS; migrate unsupported direct paths
  to versioned callable/commands and keep them closed until supported.
- Put epoch transitions in the same authoritative state machine and transactions:
  after external/Rules intake closure, maintenance entry marks closed/bumps with no
  reopen gap; activation commits a newer epoch/revision with the bundle; abort bumps
  before reopen; inverse recovery commits a still newer epoch
  with restored business revision. Include them in digest, both budgets/manifests,
  idempotency, crash injection, and replay tests; never restore or reuse an epoch.

### Android

- Extend the planning request domain model and repository to observe the exact
  two-subplan bundle request in the active environment.
- Inventory every affected admin/swap/override direct write. Carry the current
  write epoch/active revision or use the versioned command boundary; prove an old
  offline queue is rejected and never silently retries against a new revision.
- Add an admin-authorized repository query keyed by exact candidate revision/
  digest plus Domain/UI models for its summary and affected positions; Rules and
  repository tests must deny the same read to a normal member.
- Route `requested/processing/completed/failed` through the existing Settings
  admin flow without making the client an authority over generation.
- On completion, invoke the existing server refresh once and update the shared
  shifts state only if session, environment, user, and admin authorization still
  match.
- Likely seams include `domain/shifts/ShiftPlanningRequest*.kt`,
  `data/shiftplanning/*ShiftPlanningRequestRepository.kt`,
  `presentation/shifts/SessionShiftActions.kt`, root session models, and the
  Settings admin route.

### iOS

- Mirror the two-subplan bundle observation and terminal-state contract in
  Domain/Data.
- Inventory every affected admin/swap/override direct write. Carry the current
  write epoch/active revision or use the versioned command boundary; prove an old
  offline queue is rejected and never silently retries against a new revision.
- Add the equivalent admin-only candidate repository/query, Domain models, and
  staged summary/position rendering, with Rules/repository tests proving normal
  member denial.
- Keep the operation owned and cancelable in the existing Shifts/Settings
  presentation boundary, with session/environment/authorization fencing.
- Refresh from the server once after activation completion and show success only
  after read-back.
- Likely seams include `Domain/Shifts/ShiftPlanningRequest*.swift`,
  `Data/ShiftPlanningRequests`, `ShiftsFeatureViewModel` loading/feed ownership,
  and `ContentView+SettingsAdminRoutes.swift`.
- This absorbs only the planning-request overlap deferred from HU-081; calendar
  ownership and general Presentation cleanup remain outside HU-082.

### Documentation

- Accept ADR-0013 after review.
- Align RF-TURN-03/04/07 and RF-IA-02/03 in English and Spanish.
- Update the bilingual Firestore collection reference and Functions README.
- Maintain the non-activating communication-baseline contract, with no PII or real
  member/workbook/account identifiers in repository or public issue evidence.
- Preserve the historical HU-017/HU-020 artifacts; link this refinement rather
  than rewriting closed-story history.

## 4. Phased implementation

### Phase 0 - Approval and frozen baseline

- Review ADR-0013 and this spec with the maintainer.
- Confirm the configured delivery weekday/date cadence and exact member fields.
- Freeze current Firestore, Functions, Android, and iOS behavior with fixtures.
- Record the develop workbook and data anomalies for HU-083 without mutating
  them.
- For an urgent provisional list, capture one explicitly authorized read-only source
  manifest, contrast every entry/digest, and generate both complete typed plans
  offline; do not invoke production `preview` or any production mutation boundary.
- Build `assignmentDigest` from UID plans, `resolverDigest` from UID/display-name pairs,
  and `planningDigest` from both plus `sourceManifestDigest`. Keep proposal and approval
  states reviewer-only.
- Obtain one exact global approval with zero-write attestation, recontrast/recompute and
  seal, then revalidate the seal while rendering both plans only inside the renderer's
  approval-bound `[sealedAt, validUntil)` window of at most 15 minutes. Audience rows
  contain no UIDs, IDs, or phones. Retain only opaque, non-sensitive repository evidence.
- Only after a separate maintainer authorization, publish the exact sanitized render to
  dedicated consultation tabs, preserve historical tabs and Drive permissions, and
  read back values, formatting, privacy, and zero Firestore/app activation.
- Hand the applicable sealed source manifest and all three digests/protected payloads
  to HU-085. Any later source, UID-plan, or resolver drift requires a new proposal,
  global approval, seal, render revalidation, and complete recommunication. The offline
  baseline records supersession intent but does not prove authoritative currentness,
  supersession, or CAS; HU-085 owns those guarantees against its production registry.

### Phase 1 - RED contract and pure planners

- Add failing eligibility tests for inactive members, real producers, and common
  purchase managers.
- Add failing bootstrap tests for valid state, reproducible owner history, approved
  mapping, brand-new exact UID order, query-order variance, ambiguous ownership,
  helper/cursor conflict, and independent delivery/market cursors.
- Add failing delivery tests for inherited carryover, full August coverage,
  complete-round overflow, N=2/N<2, effective-lead helper boundaries, append
  recomputation, adjacent-lead rejection, predecessor-completion races, frozen
  actual-helper history, cross-season boundaries, and HU-016 swap regression.
- Add failing market tests for N=3, N=4, N=29, N=30, N=31, fewer than three,
  and changing calendar years, including property coverage and materialized
  overflow across multiple future projections.
- Add failing state-machine tests for replay, invalid planning frontiers,
  membership drift, preview/stage/activate mismatch, staged visibility, and
  competing requests, including one subplan failing/staling without either type
  activating.

### Phase 2 - Rotation state and deterministic generation

- Implement the shared contract, state repository, and transaction boundary.
- Replace random roster construction with persisted ordered cohorts.
- Implement delivery and market planners as pure operations over explicit
  inputs.
- Persist ownership, assignment, provenance, round, and projection metadata
  atomically.

### Phase 3 - Request lifecycle and security

- Require each typed subplan's own first incomplete planning-frontier season (or
  exact replay), preserving partial overflow and advancing over fully prefilled
  seasons, then validate the combined bundle authority.
- Implement preview with no domain/projection side effects (only private request/
  operation lifecycle state and the immutable bundle/receipt artifact),
  digest-bound non-public staging, and exact atomic activation.
- Bind the digest to every versioned fairness input and transactionally recheck
  them at activation, including the credit-ledger version and planned credit
  transitions once HU-084 is enabled.
- Include an optional immutable migration-baseline revision/digest in the input
  lineage and reject orphaned or cross-baseline candidates.
- Calculate and enforce the exact initial public transaction budget, with an
  explicit combined-delivery/market failure that requires active-revision client
  migration if exceeded.
- Include the atomic epoch/active-revision transition in the forward activation and
  inverse recovery transaction manifests and their measured budgets.
- Keep the immutable bundle and staged candidate outside both the activation
  write-set and inverse recovery; retain them as replay/inspection evidence rather
  than updating, restoring, deleting, or capturing them as before-images.
- Serialize only a fully resolved attempt: after all reads, require and populate
  the empty internal batch of the exact pinned SDK `Transaction`, detach its
  measured `Write` protos, seal it, and let the SDK commit that same object.
  Guard commit with a detached token copy, reserialize immediately before
  transport, reject byte drift, and require a new measurement after reset. Bind
  the write-set and complete `CommitRequest` digests/bytes and recheck the
  conservative cardinality/10-MiB gates before public writes. Stage retains only
  structural budgets and measurement authority; it never persists synthetic
  future evidence. After a measured transaction returns successfully, persist a
  separate immutable `transactionReturned` outcome rather than embedding the
  request digest inside its own request. Key it by direction plus exact
  commit-request digest; bind it to the operation terminal, intent, bundle,
  epoch, manifest, and complete measurement. Create it without overwrite,
  converge exact retries, and independently read it back. Do not persist the
  opaque token or claim a lower-level transport acknowledgement.
- Materialize the complete forward activation only after a live recomputation
  reproduces the staged artifact. Bind all public creates/guarded predecessor
  update, rotations/leases, active state, request terminal, sync commands, held
  intents, tombstone, and before-images to the exact budget/inverse manifest,
  then measure and seal that same SDK-owned batch. The local governed resolver
  now rebuilds bounded membership/device/config/calendar/policy inputs and the
  complete staged/authoritative/before-image read-set inside every retry. Keep
  the local `index.ts` discriminator fail-closed: unversioned requests retain
  the legacy handler, declared v2 preview/stage use the private lifecycle, and
  activate enters the governed CAS without an external preflight.
- Materialize recovery only from the immutable activation tombstone and
  revalidated persisted before-images. Require every created target to retain
  the activation marker/payload, require the active bundle/epoch CAS and both
  sealed release leases, then delete creates and restore guarded targets in one
  measured inverse batch. Restore the prior business lineage while advancing a
  fresh recovery epoch and aggregate revisions; use explicit delete sentinels
  for top-level fields that exist only after activation. Replace the activation
  terminal with a digest-bound recovery terminal, retain before-images and the
  completed historical request. Execute both directions through one local CAS
  runtime that calls the resolver inside every retry, uses only the final
  returned attempt for post-commit evidence, replays an already retained exact
  outcome without another CAS, and fails closed when a committed terminal has
  lost that evidence. The inverse resolver now reloads the terminal, bundle,
  request, before-images, and all current delete/restore targets inside every
  retry. Export that composed recovery port only through the HTTP declaration
  pinned to the exact future IAM operator, with strict request/response audit
  handling and the same maintenance-allowlisted operation/revision/digest. Live
  principal provisioning and IAM allow/deny proof remain inside HU-085.
- Emit stable digest-bound Sheets-sync command IDs in that transaction and define
  the exact manifest/idempotency/marker protocol. Prove it with a test consumer;
  HU-083 implements the real explicit pull/invoked multi-season worker. Pending
  commands remain discoverable after commit; no enable-after-create trigger is used.
  The local command repository now provides bounded polling, fenced claim/takeover,
  an immediate pre-batch active-lineage/partition authorization, and read-back-
  guarded completion. Its SDK-free executor proves idempotent lost-ack convergence
  with a fake consumer; real Sheets I/O and ambiguity evidence remain in HU-083.
- Freeze the pure public-write event classifier before HU-083 changes the legacy
  trigger. Activation and repair/sync-correction create/update events no-op only
  when their marker changed and matches the exact operation registry; recovery
  deletes additionally match their exact activation before-document and inverse
  manifest. Retained markers keep later ordinary edits/deletes active, while an
  unauthorized changed marker fails closed. A stable event digest gives the next
  retention-ledger cut one replay key without performing per-row side effects.
- Publish processing and stable terminal results idempotently.
- Hold notifications for governed activation and release them idempotently only
  after the approved read-back gate.
- Hold leases on both bundle rotations and block later stage/activate that touches
  either while the prior release is sealed, partial, or non-terminal; clear them
  only through reconciliation, valid rollback, or an explicit terminal incident
  accounting for every demonstrably unsubmitted intent and immutable
  `unknown`/accepted/delivered event.
  First freeze this as a pure terminal-reconciliation plan: require the exact
  paired lease ownership and contiguous intent set, reduce only complete terminal
  attempt histories, preserve possible-delivery evidence, distinguish definitive
  authenticated failure from demonstrably unsubmitted, and emit two exact clear
  actions under one digest. Persist it locally with one Firestore transaction that
  treats the bundle artifact as canonical intent authority, proves the live intent
  set and dispatch counters/attempts exact, advances the maintenance epoch and
  both rotation revisions, clears both leases atomically, and records replay
  evidence. Keep terminal incidents separate.
- Bind intents to assignment/member/token versions. Claim and create event/inbox
  through one transaction/CAS that reads those current versions; stale input writes
  nothing. Before every FCM send/retry, acquire a short lease honored by all writers
  of assignment/member/token state while revalidating those versions; cancel/
  supersede drift only before authenticated submission starts. Persist only generic
  non-sensitive canonical event/inbox copies and event-reference push payloads—no
  name, shift date, or effective assignment. Fetch current authorized/fresh detail
  when either inbox or push is opened; durable offline cache remains generic and
  ephemeral detail is invalidated on context/revision drift. Persist an append-only
  attempt ledger with stable
  attempt ID, lease owner/epoch/deadline, validation digest, authenticated start,
  and terminal outcome; derive aggregate state without overwriting an old `unknown`.
  Bound network timeout, treat ambiguous expiry as possibly delivered, and define
  authenticated submission start—not later OS presentation—as the guarantee boundary.
- Model safe resume as timeboxed degraded mode: scope the affected-shift mutation
  fence, owner, TTL, escalation, and terminal incident cancellation/supersession
  of demonstrably unsubmitted intents. Preserve `unknown` as possibly delivered
  reconciliation/correction history so normal corrections are not blocked indefinitely.
  Freeze this first as a pure contract: enter only after the paired batch deadline
  with complete inactive dispatch evidence, cap the incident TTL at 24 hours, and
  transfer both exact leases to one incident owner. At expiry require exact
  cancellation of every zero-attempt, claimed-before-submission, or wholly failed-
  before-submission intent. Preserve submitting/unknown/accepted evidence as
  correction-required possible delivery, including an `unknown` followed by a
  merely claimed retry. Persist the degraded transition, affected-shift fence,
  terminal record, and atomic dual-lease clear in the following cut.
  Before that CAS, establish one deterministic backend-only incident-fence
  document per affected shift. Bind it to the incident, bundle, owner, TTL, and
  safe-resume digest; make backend transactional writers and strict Rules honor
  it alongside dispatch fences. Expired exact evidence stops blocking, malformed
  evidence fails closed, and unrelated shifts remain writable.
- Prove current and candidate notification consumers cannot consume the held
  outbox, including mixed-revision and rollback scenarios.
- Update Rules and security tests so clients cannot mutate planner-owned state
  or forge terminal success.
- Prove mobile/admin credentials cannot invoke the operator-only rollout boundary
  and prove the operator cannot write Firestore/Sheets or impersonate/mint tokens
  for the runtime; clients cannot forge/change last-mutation provenance.

### Phase 4 - Android and iOS completion read-back

- Add request observation, processing UI, localized error codes, cancellation,
  and terminal retry behavior on both platforms.
- Update every affected Android/iOS write path to the epoch/revision contract or
  explicitly keep it disabled behind the versioned command boundary; test stale
  offline writes, reauthentication, environment changes, and parity.
- Add admin-only staged-candidate decoding/rendering on both platforms without
  exposing candidate rows to normal member feeds.
- Refresh the existing Firestore shifts feed exactly once after activation
  completion.
- Verify board and upcoming-shift projections, including future seasons and the
  cross-season helper.
- Add planned-versus-actual helper fields (or an equivalent versioned contract):
  recompute only while the predecessor is uncompleted, freeze UID/source revision/
  time at completion, and reserve completed-history correction for a separate
  audited command.
- Validate predecessor/current/successor assignment, completion, and revision under
  one CAS for every effective-lead mutation. Reject adjacent equal leads or stale
  completion state before helper, assignment, notification, or Sheet side effects.
- Retain canonical `app|google_sheets` decoding and reject `source=planner`.

### Phase 5 - Integrated local/emulator validation

- Generate deterministic delivery and market fixtures in the emulator.
- Run one delivery-plus-market preview, stage, and activate bundle locally/in
  emulators after all code gates pass.
- Read back request state, rotation state, shifts, helper chain, notifications,
  and both mobile clients.
- Prove transaction/CAS release creates one canonical event/inbox row per stable
  key only from current assignment/member versions. Prove every FCM attempt uses a
  writer-honored dispatch lease and current UID/eligibility/token before acceptance;
  verify generic payload, authorized fetch, event ID/collapse metadata, and explicit
  later/possible-duplicate presentation semantics.
- Prove versioned canonical-event/inbox decoders and Rules persist only generic copy/
  references for shift events, current detail is authorized/fresh on every inbox or
  push open, and offline/stale/denied caches cannot reveal prior rich detail.
- Do not deploy the shared `reguerta-9f27f` Function revisions merely to test the
  `{develop}` path: the same revisions also serve `{production}`. Hand the
  verified contract to HU-083; first shared-project deployment belongs to the
  HU-085 change window unless a separately governed staging project exists.

## 5. Test strategy

### Functions

- Pure tests: eligibility, delivery planner, market planner, rotation reducer.
- Transaction tests: concurrency, replay, partial failure,
  preview/stage/activate binding, all-input version drift (including an enabled
  credit ledger), staged visibility, notification hold/release idempotency, and
  membership mismatch.
- Bundle tests: independent per-type frontiers feed one combined digest; a failed,
  stale, or oversize subplan activates neither rotation and emits no sync/intent.
- State-machine tests: safe resume retains the release lease, partial delivery
  blocks superseding stage/activate, terminal reconciliation clears it, and
  migration-baseline lineage cannot be mixed or orphaned.
- Degraded-mode tests: affected mutations remain fenced before TTL, unrelated
  traffic runs, expiry terminalizes every demonstrably unsubmitted intent or
  finishes release, `unknown` remains possible-delivery history, and submitted/
  delivered event history is never rewritten.
- Recipient tests: departure/deactivation, reassignment, UID/token change, and
  partial release between validation/claim/dispatch/retry; CAS rejects stale event
  creation, state writers honor the dispatch lease, and drift before authenticated
  submission starts cancels pending sends. Drift after submission cannot retract
  `unknown`/accepted state; generic presentation race and immutable submitted/
  delivered history are documented rather than called impossible.
- Mobile device-writer tests: a Rules-denied registration commit is deferred
  without blocking authentication, retains only the current authorized context and
  credential, and converges on the next authorized session/token event. A stale
  session or credential still prevents that later write, and non-permission errors
  remain ordinary failures rather than false dispatch ownership.
- Dispatch tests: crash before submit, bounded timeout during submit, lost ack,
  lease expiry to `unknown`, late completion, state-writer contention, and
  revalidated at-least-once retry with a new attempt ID/epoch and possible generic
  duplicate; prove the prior `unknown` attempt remains immutable.
- Compatibility tests: current flat collection queries never see stage, bounded
  activation is atomic, and an oversize manifest performs no public write.
- Protocol tests with a fake consumer: immediate/delayed/replayed activation,
  repair, recovery, and sync-correction events follow the required audited-no-op
  vectors, recovery deletes validate, later ordinary edits/deletes remain normal,
  and exact sync commands are idempotent. Real sync-consumer evidence belongs to
  HU-083; exact CommitRequest serialization remains owned by HU-082 and the
  isolated/live rollout gate by HU-085.
- Retention tests: rollback cleanup preserves registry tombstones/event ledgers,
  post-cleanup replay still no-ops, and an unknown changed backend marker fails
  closed without an export/notification.
- Contract tests: planning-frontier season, stable failure codes,
  `source=app`, planner provenance, and legacy decoding.
- Security/Rules tests: admin create, member read as required, forbidden state
  mutation, cross-environment isolation.

### Android and iOS

- `requested -> processing -> completed -> one refresh`.
- Failure produces no false success or misleading feed refresh.
- Cancellation, timeout, role demotion, UID change, and environment change.
- Retry with the same ID and submit returning an already terminal result.
- `source=app` plus planner metadata accepted; `source=planner` rejected.
- Last 2025-26 owner hands over to the first 2026-27 owner.
- Board and upcoming shifts update after server read-back.
- Settings and Shifts smoke journeys on both platforms.

## 6. Validation gates

### Functions

- `npm run lint`
- `npm run build`
- focused Node contract/planner suites
- relevant backend security and Firestore Rules suites

### Android

- `./gradlew app:testDebugUnitTest`
- `./gradlew app:lintDebug`
- `./gradlew app:connectedDebugAndroidTest` when an emulator/device is
  available because admin and board UI behavior changes

### iOS

- focused Swift Testing cohorts while implementing
- `./scripts/validate-ios.sh fast-unit --destination '<exact iOS 26 simulator>'`
- `./scripts/validate-ios.sh ui-smoke --destination '<exact iOS 26 simulator>'`
- `./scripts/validate-ios.sh release-gate --destination '<exact iOS 26 simulator>'`
- repository-pinned SwiftLint through the canonical runner/Xcode path

`swiftlint`, Xcode MCP, and Cupertino MCP are not substitutes for Functions
`npm run lint` or `npm run build`: SwiftLint checks Swift, Xcode validates the
iOS target, and Cupertino supplies Apple documentation. They remain useful for
the iOS slice, while the TypeScript gates are still mandatory.

## 7. Rollout and rollback

- Local pure tests and emulators first.
- No shared-project Functions or Rules deploy for a develop-only test because
  both environment paths use the same deployed revision/ruleset.
- No production deploy or runtime/data activation in HU-082 without a separately
  approved delivery step.
- The separately approved consultation publication may write only the exact sanitized
  audience render to dedicated workbook tabs. It does not authorize Firestore public
  shifts, cursor changes, notifications, configuration, deployment, or mobile
  activation; HU-085 remains that production gate.
- Keep the existing reader compatible during migration. If the new state cannot
  be proven from existing data, fail closed and defer reconstruction to HU-083.
- Rollback disables new request creation and preserves already published shifts;
  an unactivated staged candidate can be removed by exact revision, and an active
  cursor is never rolled backward by guessing.

## 8. Main risks

- **Two authorities**: prevent Sheets or clients from changing the cursor.
- **Non-deterministic order**: ban unseeded shuffling and persist the cohort.
- **Partial activation**: promote one exact two-type bundle atomically and keep
  both prior type states recoverable as one rollback unit.
- **Installed flat readers**: keep candidates separate and require one bounded
  activation transaction; otherwise block for a versioned-reader migration.
- **Stale mobile context**: fence terminal activation and read-back to the
  initiating authorization context.
- **Scope creep from HU-081**: touch only the planning lifecycle required to
  show the generated result.
- **Communicated baseline diverges from activation**: require HU-085 to attest exact
  two-type alignment to the sealed `planningDigest` or supersede and recommunicate
  before any production activation.
