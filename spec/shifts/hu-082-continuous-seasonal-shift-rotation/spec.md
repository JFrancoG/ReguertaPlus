# HU-082 - Continuous seasonal shift rotation

## Metadata

- issue_id: #266
- priority: P1
- platform: both
- status: in progress
- architecture: ADR-0013 (accepted 2026-08-24)

## Context and problem

The planning test in the `TurnosTest 2025-26` workbook exposed three different
failures that currently look like one problem:

- the first generated delivery owner repeats the last owner from the preceding
  season instead of continuing with that person's helper;
- delivery generation stops with the market horizon in June, even though
  delivery planning must cover the weekly calendar through August and finish
  the active round;
- generated shifts do not appear in Android or iOS because the planner writes a
  non-canonical `source`, while the apps deliberately accept Firestore shifts
  whose source is `app` or `google_sheets`.

The existing implementation also derives the target season from the current
date, shuffles members, and treats a seasonal tab as a new rotation. That makes
the result hard to reproduce and cannot preserve fairness across years.

## User story

As a cooperative administrator, I want delivery and market shifts to continue
through one fair rotation across seasonal boundaries so that no member repeats
early, no carryover is lost, and the generated shifts become visible in both
apps.

## Business definitions

- **Rotation**: the ordered, persisted sequence for one shift type.
- **Round**: one pass in which every member in the round cohort owns exactly one
  position before any member owns a second position.
- **Cohort freeze**: the round cohort becomes immutable when its first position
  is promoted into the active/public projection. Preview and non-public staging
  do not freeze it; any planning-input drift invalidates their snapshot/digest.
- **Seasonal projection**: the partition of shifts by their actual date. It is
  a presentation and synchronization boundary, not a rotation reset.
- **Carryover**: the remainder of a round whose dates fall in the following
  season.
- **Rotation owner**: the member whose position advances the fair queue.
- **Effective assignee**: the member currently expected to perform the shift.
  HU-082 initially makes both identities equal; the separate concepts prevent
  future coverage or manual assignment from corrupting the queue.
- **Communication baseline**: one non-activating delivery-plus-market package whose
  `assignmentDigest` binds UID plans, `resolverDigest` binds UID/display-name pairs,
  and `planningDigest` seals both plus the contrasted source manifest. A proposal or
  approval-only package is never communicable; only a revalidated seal may be rendered.

The earlier idea of requiring exactly two delivery turns per person and season
is superseded by the round invariant. A generation creates as many complete
rounds as are needed to cover the target season through August and then writes
the remainder of the last round into the earliest following seasonal
projections, creating as many as needed. The number of rounds therefore follows
the calendar and eligible cohort; it is not hard-coded to two.

## Eligibility

A member is selectable when all of the following are true:

- the member is active;
- the member is not a real producer.

For the existing member model, the canonical exclusion is:

`realProducer = roles contains producer && !isCommonPurchaseManager`

Common purchase managers remain selectable even though the app represents them
with a producer role and the company `Compras Regüerta`. Catalog visibility
such as `producerCatalogEnabled` is not a shift-eligibility rule.

Membership changes within an active/public round are governed by HU-084.
Until that story is ratified and implemented, HU-082 is fail-closed: after a
round cohort is frozen, any difference between that cohort's live eligibility
and the current member roster fails a new activation before any cursor, shift,
Sheet, or notification write. Existing published rows remain untouched and an
administrator must resolve the mismatch through an approved migration/policy.
This allows HU-085 to activate the base planner without silently inventing an
absence or join rule.

HU-084 proposes that an approved permanent departure may regenerate only a round
whose cohort has not frozen. For a frozen round it preserves cohort/owner and uses
coverage for public positions plus an assembly-ratified tombstone/skip or fully
accounted coverage rule for unpublished positions. HU-082 does not enable that
exception before HU-084 is ratified and its versioned transition is implemented.

## Bootstrap order and cursor

Delivery and market bootstrap independently. Their ordered cohort, current round,
and next cursor use this precedence:

1. a valid existing versioned rotation aggregate;
2. unambiguous chronological `rotationOwnerUserId`/round evidence whose cohort and
   cursor can be reproduced exactly;
3. an explicit administrator-reviewed mapping artifact listing ordered member UIDs,
   round identity/number, next cursor, evidence, and reason.

Legacy effective assignees are not ownership evidence after swaps/manual changes.
Query return order, wall-clock order, and unseeded shuffle are forbidden. For a truly
new rotation with no history, the mapping artifact may use the assembly's existing
alphabetical policy as a human-readable proposal, but persists exact UIDs and a stable
tie order before generation rather than relying on runtime locale collation.

Delivery adds a normative continuity gate. If the last legacy row has exactly one
unambiguous registered helper who is still eligible, that UID must be both the first
new rotation owner and initial effective lead. If valid rotation evidence names a
different cursor, or helper evidence is ambiguous/ineligible, bootstrap fails closed
for an approved mapping; it never overwrites the historical helper to make another
choice pass. The mapping/provenance and predecessor row are part of the input digest.
Market derives its next position from the same precedence and never borrows delivery
order. HU-083 audits/materializes approved migration mappings; HU-082 owns this
contract and deterministic planner behavior.

## Delivery rotation

- A target season is September through August, using `Europe/Madrid` business
  dates and the configured delivery weekday.
- Existing inherited carryover is preserved. New positions begin at the first
  weekly slot after that carryover, even when it falls in October or later.
- Generation fills every remaining weekly slot through August.
- If the final round crosses into September, its remaining members are written
  unchanged into as many following seasonal projections as needed before a new
  round may start there.
- At least two distinct eligible members are required. Fewer than two fails the
  entire bundle atomically rather than assigning one person as both lead and helper.
- The helper is the effective lead of the next chronologically materialized
  delivery, including across round and seasonal-projection boundaries. Appending a
  delivery recomputes its predecessor's helper. On initial generation, effective
  assignee equals rotation owner, so the first new lead is normally the previous
  last delivery's expected helper and the next fair owner.
- Every pair of chronologically adjacent materialized deliveries has distinct
  effective leads. Therefore an uncompleted delivery's lead cannot equal its planned
  helper. Append, HU-016 swap, Sheets import, manual assignment, credit, or approved
  coverage validates predecessor/current/successor assignment, completion, and
  revision state in one authoritative CAS/transaction; an equal-adjacent result
  fails without change.
- The helper contract distinguishes prospective plan from completed history. Before
  completion, the predecessor's planned helper follows the next delivery's current
  effective lead and may be recomputed. Completion atomically validates lead/helper
  distinctness and freezes actual helper UID, source assignment revision, and time.
  A later change to the next delivery preserves that completed actual helper; it may
  update only an uncompleted predecessor. Normal swaps/coverage/import cannot rewrite
  a completed lead/helper; an evidenced historical correction is a separate audited
  command. The final materialized delivery may retain a pending planned helper until
  another delivery exists, preserving HU-063.
- Repeating the same generation request cannot duplicate a shift, advance a
  cursor twice, or change an already active result.

## Market rotation

- Each target season has exactly ten market dates: the third Saturday of each
  month from September through June in `Europe/Madrid`.
- Each market has exactly three distinct effective assignees, for 30 positions
  per target season.
- With 3 through 29 selectable members, the queue starts a new round only after
  completing the current one and continues until all 30 positions are filled.
- With 29 members, position 30 belongs to the first member of the next round;
  the remaining members 2 through 29 of that boundary-active round are
  materialized from the first market of the following season.
- With 30 members, one round fills the season exactly.
- With more than 30 members, the unserved remainder of the round is materialized
  from the first market of the following season. With 31 members, member 31 is
  first and that three-person group is completed with members 1 and 2 of the
  next round.
- The planner automatically creates as many future seasonal projections as are
  required to materialize the complete remainder of the round that crossed the
  target-season boundary. It consumes subsequent queue positions only to finish
  the last three-person group, then stops; it does not recursively publish every
  later round forever.
- Fewer than three selectable members is an unschedulable state. The request
  fails visibly and activates nothing rather than assigning the same person
  twice to one market.

## Planning request and mobile read-back

Before the production path is available, an urgent plan may follow the separate
[non-activating communication baseline](communication-baseline.md). It uses one
authorized, per-entry-contrasted read-only source manifest and one indivisible
delivery-plus-market package, then follows
`proposal -> approved -> sealed -> rendered -> communicated`. Proposal and approval
states are reviewer-only. The exact global approval includes the complete
`planningDigest`, zero-write attestation, `validUntil`, and supersession intent. A seal
may be rendered only after it is revalidated and while the renderer's own clock is in
`[sealedAt, validUntil)`; approval validity may span at most 15 minutes. This offline
baseline does not prove authoritative currentness, supersession, or compare-and-set
ownership; HU-085 must enforce those properties against its production registry.

The private package may contain UIDs. `assignmentDigest` binds the UID plans,
`resolverDigest` binds only the exact UID/display-name resolver, and `planningDigest`
seals both plus `sourceManifestDigest`. Audience rows expose no UIDs, member/account/
request/workbook IDs, or phone numbers. These communication digests are not synonyms
for runtime `bundleDigest` or `candidateDigest`. HU-085 must reproduce the sealed
lineage and both plans or supersede, reapprove, reseal, and recommunicate the complete
two-type baseline before activation. Runtime preview/stage cannot waive this gate.
After an additional maintainer authorization, the sanitized audience render may be
published to dedicated consultation tabs in the shared workbook. That communication
does not populate Firestore public shifts or activate either mobile app.

- The standard seasonal request is one bundle containing explicit `delivery` and
  `market` subplans. Each subplan names its own target planning-frontier season;
  the bundle also carries one stable request/bundle ID, requester, and environment.
  The backend never infers a season from its wall clock.
- In addition to the normal admin request path, the backend exposes a distinct
  operator-only rollout execution boundary for HU-085. The principal has endpoint
  invoker IAM only, with no Firestore/Sheets role or runtime impersonation/token
  creation. The endpoint requires an exact allowlisted operation ID/revision/digest
  and maintenance state; only its runtime writes data. Mobile apps and ordinary
  Firebase administrators cannot call it.
- Each rotation tracks a planning frontier: the earliest season whose base
  delivery calendar or 30 market positions are not yet complete after counting
  inherited overflow. A new target must equal that frontier; an already completed
  target is allowed only as an exact idempotent replay.
- A partially prefilled frontier keeps its inherited rows and generation starts
  after them. If overflow already completed one or more future seasons, those
  seasons are not a skip: the frontier advances to the first still-incomplete
  season. Past targets, arbitrary gaps, and out-of-order backfills fail
  atomically. HU-083 migration mode may repair an explicit historical partition
  without advancing the live cursor/frontier.
- `preview` computes both complete deterministic subplans and one combined digest
  without writing
  rotation state, public shifts, candidate shifts, Sheets rows, notification
  intents, or credit-ledger state. Its only permitted writes are private
  request/operation lifecycle state plus the immutable bundle and receipt
  required for the exact `requested -> processing -> completed|failed`
  lifecycle and digest-bound stage.
- `stage` is bound to that combined input snapshot/digest and persists one
  versioned two-type bundle candidate in a backend-owned partition hidden from
  normal member queries, Sheets export, and notification consumers. It advances
  neither active cursor and freezes neither cohort. Authorized admins can inspect
  both staged subplans.
- The staged candidate is immutable and remains outside forward/inverse write
  sets and recovery before-images. Stage rejects transaction measurements:
  activation/recovery IDs, exact payloads and preconditions, before-images, and
  the opaque transaction token are attempt-owned values that do not exist yet.
  A pinned serializer measures the actual `WriteBatch` owned by each fully
  resolved attempt before public writes and binds the ordered write set plus the
  complete protobuf `CommitRequest`. The local attempt adapter now requires all
  authoritative reads to finish first, owns the empty internal batch of that
  exact SDK `Transaction`, populates it canonically, awaits its real opaque token,
  and measures it once per callback attempt. Successful measurement seals later
  public mutations and replaces the SDK closures with detached copies of the
  measured `Write` protos. Its commit guard supplies a detached token copy,
  rejects any different token, reserializes and compares the complete request
  immediately before transport, and requires remeasurement after SDK reset. The
  measurement remains in memory while that request commits: its digest cannot be
  embedded in the same request whose bytes define that digest. After the measured
  transaction returns successfully, a separate backend-only protocol persists an
  immutable `transactionReturned` outcome under the committed operation. Its
  stable key combines direction and exact commit-request digest; it binds the
  complete measurement, intent, bundle, epoch, manifest, post-return timestamp,
  and derived digests. Create-without-overwrite, exact replay convergence,
  terminal-operation validation, and independent read-back fail closed without
  claiming a transport acknowledgement token. Index authority remains
  digest-bound, while backend index-entry accounting still requires the
  isolated-clone rehearsal.
- Publication codec v1 freezes the exact materializer-facing flat shift shape.
  It retains the fields installed Android/iOS clients require and uses
  `source = app`, while adding planner/bundle lineage, immutable rotation
  ownership, assignment/completion/document revisions, and write epoch.
  Delivery has one assignee and market exactly three; dates are UTC-midnight
  Firestore timestamps. Completion is an exact `uncompleted|completed` union.
- A controlled create/update changes `lastBackendMutation`, which binds target,
  marker-free payload digest, document revision, operation intent, bundle, and
  epoch. Exact payload validation applies only to an event whose marker changed.
  A later ordinary edit retaining historical provenance remains an ordinary
  event and must not be no-op'd because that old digest is stale.
- The atomic activation creates an immutable backend terminal with
  `operationKind = activation`, `state = committed`, its ordered public
  mutations and contiguous before-image bindings. Tagged before-image codec
  `firestore-value-v1` preserves the supported Firestore value subset plus exact
  target update-time, capture-contract/payload/envelope digests, and restore
  path. Unsupported or lossy values fail closed.
- The local forward materializer accepts only a complete live recomputation that
  reproduces the immutable staged artifact. It resolves every public create, the
  guarded predecessor-helper update, both rotation/lease transitions, active
  state, terminal request, sync commands, held intents, operation tombstone, and
  contiguous before-images. Updates use the transaction-read `lastUpdateTime`;
  the exact write set must match the forward budget and inverse create manifest.
  The real pinned attempt adapter measures and seals that same SDK-owned batch;
  an emulator vector proves its atomic commit. The local CAS runtime invokes its
  resolver anew inside every Firestore retry, runs the real materializer on that
  callback's read-set, and retains only the outcome returned by the successful
  attempt. Credits remain closed until HU-084.
- The local inverse materializer revalidates the persisted bundle/inverse
  manifest, activation tombstone, completed request, every before-image, every
  created target, the exact active bundle/epoch CAS, and ownership of both sealed
  release leases. It deletes only unchanged activation creates and restores each
  before-image through `lastUpdateTime` CAS. Business lineage returns to the
  preceding revision while maintenance `writeEpoch` and aggregate
  `stateRevision` values advance monotonically; release leases are cleared. A
  guarded exact-replacement update rewrites retained top-level maps and deletes
  after-only fields. The activation tombstone becomes a digest-bound recovery
  tombstone, while immutable before-images and the historical completed request
  remain. The pinned attempt adapter measures/seals the exact inverse batch and
  an emulator vector proves atomic delete/restore/epoch behavior. The same CAS
  runtime executes recovery only while the activation terminal remains current,
  then persists its inverse outcome after the transaction returns. Exact
  terminal/outcome replays short-circuit without another CAS; a committed
  terminal missing its directional outcome fails closed. The local concrete
  resolver now rebuilds the forward read-set from a digest-bound live source,
  staged package, and authoritative documents, while recovery reloads every
  terminal/before-image/current target. The governed live-source producer now
  transactionally rebuilds the derived fairness envelope from bounded real
  membership/device/calendar reads, canonical config, authoritative state and
  rotations, and an exact backend-only source policy. Exact replay is write-free
  and invalid or over-limit sources preserve the prior envelope. The governed
  forward resolver must rebuild those sources inside every activation retry and
  reject a stale cached envelope before materialization. The local `index.ts`
  trigger preserves the unversioned legacy path and routes declared schema-v2
  preview/stage/activate requests through the governed runtime; unknown versions
  fail closed. The inverse runtime now has a separate local operator executor
  that requires one digest-bound authorization under the activation operation,
  checks its exact operation/bundle/maintenance binding before execution and
  inside every CAS retry, and rejects expired or drifting authority without
  mutation. Its local HTTP export is pinned only to
  `reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com`, accepts the
  exact POST body without query parameters, and emits sanitized correlated audit
  events and responses. HU-085 still owns creation of that principal, its sole
  invoker binding, negative effective-access proof, deployment, rehearsal, and
  production execution.
- The digest covers every fairness input and its version: eligible membership,
  rotation/cursor, calendar and policy/configuration, relevant overrides, and,
  when HU-084 is enabled, the complete same-type coverage-credit ledger version.
  A migration baseline revision/digest, when present, is also an immutable input.
  Any change after stage invalidates the candidate.
- `activate` accepts only that exact bundle revision/digest and atomically
  promotes both rotations/projections after transactionally rechecking every
  subplan input. If either type fails, neither activates. When coverage credits
  are enabled, both types' exact planned transitions commit in that transaction.
  This is the public-visibility/cohort-freeze boundary; it writes both types'
  digest-bound pending Sheets-sync command documents and held intents in the same
  transaction. Sync never relies on that document's creation event: an explicitly
  invoked/polled worker claims pending commands idempotently after commit and can
  rediscover them after an invocation loss.
- Sync commands are serialized by a monotonic workbook/partition epoch and lease.
  A worker validates the current active revision/digest immediately before every
  external batch and records read-back. Recovery may supersede an activation
  command only after its lease is released and no Sheets call remains in flight;
  a late retry with an old epoch fails closed.
  The implemented local lifecycle uses exact pending/processing/completed codecs,
  a digest of the immutable command, bounded explicit polling, transactional claim
  or expired-lease takeover, and a second transactional authorization immediately
  before I/O. Completion clears the partition lease only with exact workbook-
  revision and partition-digest read-back. An exception or ambiguous external
  result leaves the lease retained. HU-083 owns the real Sheets call, durable
  external-attempt evidence, and controlled ambiguity reconciliation.
- The SDK-free public-write event classifier consumes the existing activation and
  recovery terminals and one exact `controlledPublicMutation` terminal for repair
  or sync correction. A create/update is a controlled no-op only when its marker
  changed in that event and matches target, payload, document revision, bundle,
  epoch, operation, and terminal digest. A recovery delete also requires the exact
  activation before-document and a path in the inverse deletion manifest. Retained
  historical markers leave later ordinary edits/deletes active; missing, unknown,
  or forged changed-marker authority fails closed. HU-083 owns trigger I/O and the
  durable event-ledger/retention integration.
- Existing Android/iOS releases read the flat public `shifts` collection rather
  than an active-revision pointer. The initial rollout therefore keeps stage in
  a separate collection and requires the entire public create/update/delete
  delivery-plus-market manifest, both rotation/cursor transitions, active
  metadata, Sheets-sync commands, and held intents to fit one Firestore
  transaction. The exact attempt serializer enforces 500 combined document
  writes and transforms, at most 500 transforms per document, and 10 MiB of
  protobuf request bytes. If the combined manifest exceeds any limit, activation fails
  closed until supported clients migrate to an active-revision read contract;
  per-type or visible multi-batch promotion is forbidden.
- Each mode has one exact bundle request that transitions through `requested`,
  `processing`, and one terminal state: `completed` or `failed`.
- Activation owns a transactional request-only lease before entering the public
  CAS. The operation document remains absent while processing because the same
  path is created atomically as the committed activation terminal. A live
  competing worker receives `busy`; the same worker resumes; expiry permits a
  monotonically fenced takeover. Every CAS retry revalidates the exact worker,
  fencing epoch, lease interval, and immutable request digest. Recovery never
  reopens that request or creates a competing lifecycle authority: it consumes
  the immutable activation terminal and retains/replays its own directional
  attempt outcome.
- Activation may persist `failed` only for a typed deterministic planning error
  thrown inside the Firestore transaction callback before it returns for commit.
  That failure write uses request/operation CAS: a concurrent committed activation
  wins and is replayed as completed. Transaction transport ambiguity, retry
  exhaustion, post-return outcome retention/read-back failure, or any other
  uncertain commit state remains retryable and must never overwrite either terminal.
- A completed request records mode, bundle revision/digest, and per-type target
  season, generated count, affected projections, and machine-readable summary. A
  failure identifies its subplan with a stable code; raw backend messages are not
  user-facing copy.
- Generated Firestore shifts keep the client-compatible `source = app` and use
  separate provenance such as `origin = planner` and `planningRequestId`.
- HU-082 defines backend-owned maintenance state containing a monotonic `writeEpoch`
  and current active bundle revision. Every affected app/admin direct mutation,
  swap, override, delivery-calendar override, Sheets import, or backend command must
  carry the expected epoch/revision and pass Rules or server-side CAS immediately
  before writing. A stale or absent precondition fails without mutation, including a
  client write queued offline before maintenance. Inventory every current Android/
  iOS/backend write path: update it to the versioned contract or leave that path
  denied and route it through a versioned callable/command. HU-085 owns only the live
  fence/read-back; it may not restore permissive legacy writes.
- The epoch lifecycle is one state machine. The external/Rules bootstrap barrier
  first closes affected writes and is read back; while that deny remains in place,
  `enterMaintenance` atomically marks the backend state closed and advances the
  epoch. There is no reopen gap. Activation's single public transaction
  commits `{newWriteEpoch, newActiveRevision}` with the whole bundle. Recovery commits
  `{higherWriteEpoch, restoredBusinessActiveRevision}` with the inverse manifest. A
  pre-activation abort advances the epoch again before any compatible path reopens.
  No epoch is reused or decremented. Epoch/maintenance state belongs to the candidate
  digest, forward/inverse transaction budgets, recovery manifest, and crash/replay
  tests, so no gate can reopen on a stale pair.
- The immutable bundle persisted by preview predates public activation. Inverse
  recovery retains it outside its write-set and must never update, restore, or
  classify it as an activation-created document to delete.
- Activation supports an idempotent notification hold/release boundary. The
  active result can be reconciled before any irreversible inbox/FCM event is
  released. A transaction/CAS reads current assignment and membership versions
  while it claims the intent and creates the canonical event/inbox entry once by
  idempotency key; stale versions create nothing. Before every asynchronous FCM
  send or retry, the dispatcher transactionally acquires a short dispatch lease
  while freshly validating UID, active eligibility, assignment, and token versions.
  Every writer of those values must honor the lease by waiting or atomically
  cancelling/superseding pending dispatch before mutation. The canonical event keeps
  an append-only dispatch-attempt ledger. Every attempt records stable `attemptId`,
  lease owner/epoch/deadline, validation digest, authenticated `startedAt`, and
  terminal `accepted|unknown|failed`; aggregate `claimed/submitting/...` state is
  derived and never overwrites an earlier attempt. A timeout/lease expiry while
  submitting becomes immutable `unknown` and is treated as possibly accepted; retry
  creates a new attempt under a new lease/current validation and retains at-least-
  once duplicate semantics. The canonical event, its inbox projection, and FCM
  payload persist only a generic non-sensitive type/copy, stable event reference,
  creation/idempotency metadata, and no member name, shift date, or effective
  assignment. The app fetches authorized, current-revision detail when either the
  push or inbox row is opened. Durable/offline inbox caches retain only the generic
  representation; any ephemeral detail is invalidated on session, membership,
  assignment-revision, or environment change. The guarantee boundary is the start
  of an authenticated
  submission under a current lease—not an acknowledgement that may be lost. The OS
  may display that generic push after later membership change and may duplicate it.
  Direct mobile device registration cannot identify the private fence behind a
  Rules `permission-denied`. Android and iOS therefore classify only a denied
  registration commit as temporarily blocked, keep the exact authorized context
  and locally persisted current credential, and report neither upload nor success.
  They retry on the next authorized session-registration or token-registration
  event, re-running every existing session/UID/credential fence; they do not spin,
  delay login, or treat other Firestore failures as a dispatch conflict.
- The bundle holds release leases on both environment/type rotations until its
  notification batch is terminally reconciled or the activation is rolled back/
  cancelled before irreversible delivery. Preview may remain read-only, but
  another stage or activate cannot supersede either rotation while the batch is
  sealed, partially released, or otherwise non-terminal.
- A safe-resume residual is an explicit degraded mode with an owner, TTL, and
  escalation. It mutation-fences affected shifts while unrelated traffic runs.
  At TTL expiry the operator must finish release or terminalize the incident by
  cancelling/superseding every intent proved never submitted under any dispatch
  epoch; `unknown`, accepted, and delivered events remain immutable possible-
  delivery history and enter reconciliation/correction. Only that terminal record or valid rollback/
  reconciliation clears the technical lease, and it does not make the rollout
  story Done.
- Held notification intents live in a backend-owned outbox/path that the current
  normal notification trigger cannot consume. Only the explicit release
  operation creates canonical consumable events with stable idempotency keys.
  A generic `status = held` inside an already watched collection is insufficient
  unless every current and candidate consumer is proven fail-closed for it.
  Before any inbox fan-out or generic FCM call, the existing notification-event
  trigger reads the backend-only canonical release receipt. No receipt preserves
  legacy delivery. An exact receipt-bound generic event is reserved exclusively
  for the governed dispatcher; a present but malformed or drifting receipt/event
  fails closed and never falls back to legacy delivery.
- Every intent is bound to the active assignment revision, recipient UID,
  membership/eligibility version, and token/destination version. Release performs
  the version read and event/inbox claim in one transaction/CAS. Every FCM attempt
  acquires the shared dispatch lease and repeats a fresh fail-closed check; it never
  reuses an earlier validation. Drift found before authenticated submission starts
  cancels/supersedes demonstrably unsubmitted state under a new digest. Once submit
  starts, its result is `accepted` or possibly delivered `unknown`; neither may be
  reclassified as unreleased or retracted. Later OS presentation is an irreducible
  generic-push race and submitted/delivered history is immutable.
- Public activation, repair, rollback/recovery, and controlled sync-correction
  writes atomically change backend-owned last-mutation kind/ID/revision fields.
  HU-082 owns this marker/operation-registry schema and atomic command emission;
  HU-083 owns the real Sheets-command consumer and candidate `onShiftWritten`
  implementation. That consumer compares before/after, requires
  that marker to have changed in this event, and validates it against the
  allowlisted operation registry/digest before suppressing legacy per-row export/
  notification. For a recovery delete, the before-image marker, exact document
  version/hash, and path must match the registry's deletion manifest. A later
  ordinary edit/delete that merely retains old metadata is processed normally.
  Controlled Sheets commands and the held outbox are the only side-effect
  authorities for a validated backend operation; its immediate/replayed row
  events are audited idempotent no-ops rather than silently discarded.
- The operation registry keeps a terminal tombstone and per-event processing
  ledger for at least the maximum configured event retry/delivery window plus an
  approved safety margin. Rollback/cleanup cannot delete it early. If a changed
  backend-only mutation marker arrives without a valid retained registry entry,
  `onShiftWritten` fails closed with no export/notification and alerts operators;
  it never reclassifies that event as an ordinary edit.
  The local producer contract freezes schema v1 for that handoff: a digest-bound
  policy names the maximum end-to-end horizon and positive margin; an immutable
  operation binding computes exclusive `retainUntil`; controlled no-ops use the
  classifier's `eventDigest`; and rejected changed-marker events use their stable
  delivery event ID to create one alertable ledger identity. Cleanup protects
  the operation terminal, retention binding, and event ledgers at the exact
  boundary and becomes eligible only after it. HU-083 owns create-or-exact-replay
  persistence and real trigger/alert evidence.
- The operator-only execution contract has explicit, digest-bound modes for repair,
  migration/bootstrap, preview, stage, activate, controlled sync correction,
  recovery, and manifested cleanup. The operator only invokes an allowlisted
  operation ID; the candidate or epoch-aware recovery runtime is the sole Firestore/
  Sheets data writer. Neither a migration script identity, infrastructure deployer,
  Drive controller, nor operator may perform those data writes directly.
- Android and iOS observe the exact bundle request in the active environment. They
  show processing, fence the operation to the authorized admin/session, and
  perform one server refresh after activation `completed` before confirming
  public success. Both clients can fetch and render the exact staged summary and
  affected positions through an admin-only inspection boundary; staged data
  cannot enter normal member board/upcoming queries.
- A terminal `failed` request produces localized feedback and no misleading
  refresh. A retry that reads an already terminal idempotent request handles it
  directly.
- The apps read Firestore, not Google Sheets. They do not need seasonal tab
  names and must continue rejecting the non-canonical `source = planner`.

## Scope

### In scope

- Shared rotation contract, state, cohort, round, cursor, and idempotency.
- Maintenance/write-epoch and expected-active-revision mutation contract, Rules,
  server CAS, affected Android/iOS writers, and versioned-command fallback.
- Deterministic delivery and market planners.
- Correct eligibility for real producers and common purchase managers.
- Client-compatible Firestore projection and planner provenance.
- Planning-request observation and read-back on Android and iOS.
- Preview, non-public staging, atomic activation, idempotent canonical event/inbox
  release, and explicit at-least-once FCM semantics.
- Operator-only rollout execution, explicit Sheets-sync commands, and safe
  activation/repair/recovery marker and consumer contracts.
- Contract, unit, security, integration, mobile, and boundary tests.
- Bilingual requirement updates after ADR/spec approval.
- Non-production source contrast, layered assignment/resolver/planning digests, global
  approval, seal/render, privacy, and HU-085 supersession contract for one exact
  delivery-plus-market package.

### Out of scope

- Dynamic multi-season Sheets synchronization, the real command consumer,
  candidate `onShiftWritten` suppression, and develop repair (HU-083).
- Production workbook activation, deployment, and live repair (HU-085).
- The final policy and UI for joins, departures, reserves, coverage, draws, and
  credits (HU-084).
- A broad continuation of HU-081 beyond the narrow planning-request lifecycle.
- Firebase deployment, live data repair, workbook mutation, or production
  configuration during the planning phase.
- Treating the communication baseline as an app-visible/public activation or using
  production `preview` to prepare the zero-write proposal.

## Linked functional requirements

- RF-TURN-03, RF-TURN-04, RF-TURN-07
- RF-IA-02, RF-IA-03
- HU-015, HU-017, HU-020, HU-063

HU-082 refines the current requirements. Until ADR-0013 and the corresponding
English/Spanish requirement edits are accepted, this spec remains draft.

## Acceptance criteria

- [ ] One persisted, ordered rotation exists for each shift type and survives
  seasonal boundaries and repeated generation.
- [ ] Bootstrap records its authoritative source/mapping, exact member-ID order,
  round, cursor, evidence, and digest. Query order/effective-assignee inference/
  unseeded shuffle cannot initialize either type.
- [ ] When the last prior delivery has one unambiguous eligible registered helper,
  that UID is exactly the first new owner/effective lead. Any helper/cursor conflict
  or ambiguous/ineligible evidence fails atomically for an approved mapping and
  never rewrites the historical helper.
- [ ] A round serves every member in its cohort exactly once before any member
  begins the next round.
- [ ] Delivery generation preserves inherited carryover, fills all weekly dates
  through August, and finishes its active round across as many following
  projections as needed.
- [ ] The first initially generated delivery owner after a boundary is the next
  fair owner; the last owner of the preceding projection is not repeated.
- [ ] Every delivery helper is the next chronological delivery's effective lead,
  including cross-season while the predecessor is uncompleted. Completion atomically
  freezes actual helper UID/source revision/time; a later next-lead change never
  rewrites completed history. Only the last materialized uncompleted row may have a
  pending planned helper.
- [ ] Every materialized adjacent delivery pair has distinct effective leads.
  Append, swap, import, manual assignment, coverage, and credit consumption validate
  predecessor/current/successor assignments plus completion/revisions atomically;
  any equal lead/helper result fails with no partial assignment, helper, cursor, or
  notification change.
- [ ] Cross-completion races fail closed: if predecessor completion wins, a stale
  next-lead edit retries without changing its frozen actual helper; if the edit wins,
  completion observes and freezes the recomputed distinct helper. Historical
  correction uses a separate evidenced/audited command, not an ordinary edit.
- [ ] Fewer than two eligible delivery members fails the entire bundle atomically
  with localized admin feedback.
- [ ] Market produces ten third-Saturday events with three distinct assignees
  and 30 total positions for every schedulable season.
- [ ] Market cases for N=29, N=30, and N=31 preserve the cursor and carryover
  described in this spec and materialize the boundary-active round into the
  required following seasonal projections.
- [ ] N=4 proves the one-position final-group fill branch; property coverage for
  every schedulable cohort size proves groups remain complete and distinct.
- [ ] Fewer than three eligible market members fails atomically with localized
  admin feedback.
- [ ] Real producers are excluded, while active common purchase managers from
  `Compras Regüerta` remain eligible.
- [x] A non-activating communication proposal contains complete delivery and market
  subplans from one immutable read-only source manifest whose entry digests and
  manifest digest contrast exactly, and causes zero Firestore, Sheets, Drive-metadata,
  notification, app-state, configuration, or deployment writes through rendering.
- [x] `assignmentDigest` binds both UID plans, `resolverDigest` binds the complete
  UID/display-name resolver, and `planningDigest` seals both plus
  `sourceManifestDigest`. Any affected change produces a new digest and revision.
- [x] Proposal and approval-only states cannot render. One global approval binds the
  exact two-type `planningDigest`, zero-write attestation, `validUntil`, and supersession
  intent; sealing recontrasts and recomputes every digest. Audience rendering
  revalidates the seal and permits it only within its approval-bound window of at most
  15 minutes.
- [x] The private package may retain UIDs, while audience rows contain approved display
  names but no UIDs, member/account/request/workbook IDs, or phone numbers.
  Repository/public evidence contains only synthetic/opaque references and no PII.
- [ ] HU-085 owns the authoritative registry, current/superseded state, and CAS. It
  either proves row-by-row and input-lineage alignment between both runtime subplans
  and the applicable sealed-and-communicated `planningDigest`, or supersedes,
  reapproves, reseals, and recommunicates the complete two-type baseline before
  activation.
- [ ] The request accepts only the first incomplete planning-frontier season or
  exact replay independently for each typed subplan; partial overflow is merged,
  fully prefilled seasons advance that type's frontier, and any invalid subplan
  prevents the entire bundle from activating or drifting either cursor.
- [ ] Preview writes only private request/operation lifecycle state and its
  immutable bundle/receipt; it writes no rotation, candidate/public shift,
  Sheet, outbox, or credit-ledger data, and stage requires its exact input
  snapshot/digest.
- [ ] Stage is admin-readable but invisible to normal member queries, Sheets,
  active cursor/cohort state, and notification consumers; Android/iOS admin
  inspection renders the exact revision without leaking it to member feeds.
- [ ] Drift in any digested fairness input, including roster, rotation/config/
  override versions and the enabled credit-ledger version, invalidates stage;
  activate rechecks all versions and commits any credit transitions atomically.
- [ ] Activate accepts only the exact staged two-type bundle revision/digest and
  atomically makes both types active or neither before any held notification is
  released.
- [ ] The initial flat-collection promotion fits one measured Firestore
  transaction for the combined delivery-plus-market manifest, and supported
  clients see either the prior or activated bundle, never one updated type or a
  partial projection; oversize manifests fail closed pending client migration.
- [ ] The transaction includes stable digest-bound Sheets-sync command IDs; only
  those commands may drive controlled export after activation. HU-082 proves the
  emitted schema/idempotency vectors with a test consumer; HU-083 implements and
  validates the real explicit pull/invoked multi-season consumer. It claims/retries
  pending commands after commit and never depends on enabling a trigger after the
  command-creation event.
- [ ] Workbook/partition epoch and lease tests serialize activation versus recovery,
  reject stale retries before every batch, and block recovery when an external call
  cannot be proved drained/read back.
- [ ] A live eligibility change after cohort freeze fails activation with no
  mutation until HU-084 or an approved migration resolves it.
- [ ] Planner output uses `source = app` plus separate planner provenance and is
  decoded by the existing canonical mobile contract.
- [ ] Every affected writer presents the current maintenance/write epoch and expected
  active revision at the authoritative Rules/server boundary. Offline/stale/absent
  preconditions fail without mutation; unsupported direct client paths remain denied
  or use a versioned callable/command, with Android/iOS parity documented.
- [ ] After the external/Rules deny is proved closed, maintenance entry, activation,
  pre-activation abort, and post-activation recovery each atomically advance a
  never-reused epoch with the correct maintenance/active-revision state.
  Digests, forward/inverse budgets/manifests, crash tests, and replay prove no stale
  pair can reopen or partially commit.
- [ ] Android and iOS observe activation completion, perform one server read-back,
  and update both the board and upcoming shifts without an app restart.
- [ ] Failure, timeout, cancellation, role demotion, user change, and environment
  change cannot show stale success or refresh the wrong feed.
- [ ] A transaction/CAS reads current assignment and membership versions while
  claiming each held intent and creating its canonical event/inbox entry by stable
  key; stale input creates nothing.
- [ ] Every initial/retried FCM dispatch freshly revalidates assignment, UID,
  active membership/eligibility, and token ownership/version while acquiring a
  dispatch lease honored by every writer of those values. Drift detected before
  authenticated submission starts terminally cancels/supersedes demonstrably
  unsubmitted state without retargeting.
- [ ] Each canonical event has an append-only attempt ledger containing `attemptId`,
  lease owner/epoch/deadline, validation digest, authenticated start, and terminal
  `accepted|unknown|failed`. Aggregate state is derived; a possibly delivered
  `unknown` is never overwritten/reclassified, and retry appends a fresh revalidated
  attempt that may duplicate delivery.
- [ ] Push payloads contain no shift/member detail and require an authorized fetch
  on open. Evidence states authenticated submission start under the current lease
  is the guarantee boundary: later OS presentation may follow membership change.
- [ ] Canonical shift events and inbox rows also contain only generic non-sensitive
  copy/reference plus lifecycle metadata—no member name, shift date, or effective
  assignment. Android/iOS fetch current detail under authorization/freshness when
  opening push or inbox, invalidate ephemeral detail cache on context/revision drift,
  and show only generic state offline or after denial.
- [ ] Versioned event/inbox decoders, Rules, repository/cache tests, and old/current/
  candidate consumer fixtures prove generic compatibility and prevent stale rich
  `title`/`body` content from being persisted for these events.
- [ ] No deployed old/current notification consumer can observe a held intent;
  release alone creates the canonical consumable event idempotently.
- [ ] A sealed/partial/non-terminal release batch blocks any later stage/activate
  touching either bundled type until exact reconciliation, valid bundle rollback,
  or an explicit terminal incident that cancels/supersedes every demonstrably
  unsubmitted intent and reconciles every `unknown`; entering safe resume alone
  never drops either lease.
- [ ] Degraded mode has a TTL/owner/escalation and cannot retain the affected-
  shift mutation fence indefinitely; expiry completes release or terminally
  cancels/supersedes demonstrably unsubmitted intents while preserving and
  reconciling `unknown`/accepted/delivered history.
- [ ] Operator-only rollout calls require invoker IAM plus exact maintenance
  allowlisting; mobile/admin credentials cannot invoke them, and the operator
  cannot write data directly or impersonate/mint tokens for the runtime.
- [ ] Every repair/migration/preview/stage/activate/sync-correction/recovery/cleanup
  mutation uses an exact operation ID/revision/digest through that boundary and is
  written only by the epoch-aware runtime; scripts/deployer/controller/operator have
  no alternate data path.
- [ ] The HU-082 consumer contract requires candidate `onShiftWritten` to treat
  authenticated activation, repair,
  rollback/recovery, and sync-correction events as audited idempotent no-ops for
  legacy per-row export/notification only when a create/update's changed marker
  validates, or a delete's before-image marker/version/path matches the exact
  recovery manifest. Retained metadata cannot suppress a later ordinary event.
- [ ] Operation tombstones/event ledgers outlive every possible delayed delivery;
  an unknown changed backend-only marker fails closed and alerts without side
  effects, while cleanup never removes replay evidence early. HU-083 owns that
  production consumer implementation and integration evidence.
- [ ] Existing reciprocal swaps remain valid for generated future shifts.
- [ ] Automated and emulator/local acceptance prove all invariants before the
  shared-project deployment governed by HU-085.

## Dependencies

- Extends closed HU-017 / issue #4 and HU-020 / issue #19.
- Must be integrated before the continuation deferred from HU-081 / issue #264.
- ADR-0013 and aligned English/Spanish requirements are pre-implementation
  approval gates.
- HU-083 depends on the rotation and projection identities created here.
- HU-085 depends transitively on the HU-082/HU-083 integrated result.
- HU-085 also consumes the latest sealed communication `planningDigest`; it must
  respect it exactly or complete the documented supersession/recommunication flow.

## Risks and mitigations

- **Ambiguous historical order**: assignments may include swaps or malformed
  test output. HU-083 owns fail-closed tooling/evidence; any deferred live apply
  belongs to HU-085.
- **Membership drift**: persist the round cohort and fail closed on a live roster
  mismatch until HU-084 supplies ratified transitions.
- **Concurrent admin requests**: use a transactional lease/version and stable
  idempotency key per type and target horizon.
- **Client false success**: terminal request observation plus server read-back
  is required before success is shown.
- **Irreversible notification**: preview/stage first and hold event release until
  the authorized active-revision read-back passes.
- **Cross-platform drift**: share wire fixtures and verify the same lifecycle,
  provenance, boundary, and failure cases on both clients.
- **Communicated-plan drift**: contrast sources and seal both typed UID plans plus the
  display-name resolver together; any source, assignment, or resolver change supersedes
  the old digest and requires complete recommunication before HU-085 activation.

## Definition of Done

- [x] ADR-0013 and requirement changes are reviewed and accepted.
- [ ] Every acceptance criterion has automated or explicitly recorded manual
  evidence.
- [ ] Functions lint, build, contract, security, and planner suites pass.
- [ ] Android unit/lint gates and applicable connected UI tests pass.
- [ ] iOS focused tests, UI smoke, release gate, and SwiftLint pass.
- [ ] Local/emulator generation and mobile read-back fixtures pass without a
  shared-project deploy; live activation remains in HU-085.
- [x] The layered assignment/resolver/planning digest, source contrast, global
  approval/zero-write seal, bounded audience render, and HU-085 authoritative
  registry/CAS handoff are documented without Firestore/runtime activation or
  repository/public PII.
- [x] The actual communicated baseline has complete private source contrasts, all three
  digest layers, global approval/zero-write attestation, a render inside the at-most-
  15-minute validity window, both audience subplans, and communication receipts. Its
  separately authorized consultation-workbook publication passed live read-back while
  Firestore public shifts remained empty.
- [ ] Android/iOS parity is complete or an explicitly approved gap is recorded.
- [ ] Issue, implementation branch, commits, and PR are linked.
