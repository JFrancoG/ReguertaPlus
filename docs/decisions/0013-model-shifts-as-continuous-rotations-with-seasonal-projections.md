# ADR-0013: Model Shifts as Continuous Rotations with Seasonal Projections

## Status

Accepted

## Date

2026-08-23

## Context

HU-017 introduced admin-triggered delivery and market planning with active
members, and HU-020 connected shifts to Firestore and Google Sheets. A later
test generated 2026-27 tabs but exposed structural failures:

- delivery repeated the last owner from the preceding season rather than
  continuing with the next owner/helper;
- delivery ended with the market horizon in June instead of covering the weekly
  calendar through August and completing its round;
- the planner wrote a source value rejected by both mobile clients;
- fixed Sheets ranges and whole-tab replacement could not safely merge carryover
  with the following generation;
- the production workbook was not connected through a governed rollout.

A season label is useful for people and Sheets, but fairness is not seasonal. A
rotation can cross September, a previous generation can already occupy dates in
October, and a market cohort may have fewer or more than 30 members for its 30
annual positions. Rebuilding order from current assignees is also unsafe because
swaps, manual effective assignments, departures, and future coverage can change
who performs a shift without changing whose fair position it was.

## Decision drivers

- Preserve fair order across round and season boundaries.
- Make the result reproducible, idempotent, and safe under concurrent requests.
- Keep the apps and backend on one canonical Firestore contract.
- Allow human review/editing in Sheets without giving Sheets authority over the
  rotation cursor.
- Avoid per-season workbook configuration, sharing, and migration churn.
- Permit future assignment coverage without rewriting historical fairness.
- Keep develop repair and production activation separately reversible.

## Decision

### Firestore owns one continuous rotation per type

Firestore stores a versioned rotation aggregate for each environment and shift
type. It owns the ordered cohort, round identity/number, next cursor, publication
horizon, idempotency/version data, and provenance.

A **round** serves every member in its frozen cohort once before any member
begins the next round. An incomplete round may give some members one more
position than others, but the difference is at most one and no early repeat is
allowed.

Until HU-084 is ratified, every frozen owner position must be served. The proposed
permanent-departure exception would let a versioned `excusedDeparture` tombstone
terminally account for that historical owner position without counting service or
credit; it does not weaken ownership immutability or permit reordering.

The cohort freezes only when the round's first position becomes active. Preview
and non-public stage do not freeze it; roster drift invalidates the
snapshot/digest and requires a new preview. What happens to a member who joins
after activation remains part of HU-084's assembly-gated policy; until then,
roster mismatch fails a later activation as described below.

Each typed rotation bootstraps only from a valid versioned aggregate, reproducible
chronological ownership/round evidence, or an explicit administrator-approved
mapping containing exact ordered UIDs, round, cursor, evidence, and stable tie order.
Legacy effective assignments after swaps are not ownership evidence; query order and
unseeded shuffle are forbidden. A truly new alphabetical proposal is persisted as
exact UIDs instead of relying on runtime locale collation. Delivery additionally
requires an unambiguous eligible helper registered on the last legacy row to be the
first new owner/effective lead. Any helper/cursor conflict or ambiguous/ineligible
evidence fails for mapping and never silently rewrites that helper. Market bootstraps
independently.

The fixed idea of exactly two delivery turns per person and season is not an
invariant. Generation creates as many complete rounds as needed to fill the
target season through August and then writes the remainder of the active round
into the earliest following seasonal projections, creating as many as the
remainder needs. In the current cohort this may be two rounds; the number is
derived rather than hard-coded.

Delivery requires at least two distinct eligible members. Its helper is the
effective lead of the next chronologically materialized delivery, preserving the
HU-063 display contract and HU-016 swaps. On initial generation, owner and
effective assignee are equal, so appending the first new delivery also makes that
person the preceding delivery's helper; this is normally the next fair owner at a
round or season boundary. A later swap or approved coverage changes the helper
chain without rewriting `rotationOwnerUserId` only while the predecessor remains
uncompleted. Completion freezes its actual helper UID, source assignment revision,
and time; later next-lead changes never rewrite that history. The final materialized
delivery has a pending planned helper until another delivery is appended. Fewer than
two eligible members is unschedulable and fails atomically.

Adjacent materialized deliveries must have distinct effective leads, so a lead and
its planned helper are never the same person. Append, swap, Sheets import, manual
assignment, credit, and coverage validate predecessor/current/successor assignment,
completion, and revision atomically. If completion races a next-lead edit, the loser
retries against the frozen history; an equal-adjacent or stale result has no effect.

Market has ten third-Saturday events from September through June and exactly
three distinct assignees per event. Its 30 positions consume the same continuous
queue: smaller cohorts begin later rounds only after finishing the current one,
while larger cohorts carry their unserved remainder into the following season.
Fewer than three eligible members is unschedulable and fails atomically.

After filling the requested season's 30 positions, market also materializes the
entire remainder of the round active at that boundary into the earliest future
market events, creating as many seasonal projections as required. If that
remainder ends inside a three-person event, subsequent queue positions complete
that event; generation then stops rather than recursively planning forever. For
N=29 this places round-two members 2 through 29 in the next season and completes
the final group with round-three members 1 and 2. For N=31 it places member 31 in
the next season and completes that first group with round-two members 1 and 2.

Each rotation tracks the first incomplete planning-frontier season after counting
inherited overflow. A partially prefilled frontier is completed after its
existing rows; if overflow already filled one or more future seasons, the
frontier advances across them. A request accepts only that frontier or an exact
idempotent replay. Arbitrary past, skipped, or out-of-order seasons fail before
any write. An audited HU-083 repair/backfill may restore historical projections
but cannot advance the live cursor/frontier.

### Eligibility has one canonical predicate

An eligible member is active and is not a real producer. In the current model:

`realProducer = roles contains producer && !isCommonPurchaseManager`

Common purchase managers represented as producers for `Compras Regüerta` remain
eligible. Catalog-visibility flags do not define shift eligibility.

Membership changes within an active/public round are not decided by this
ADR. HU-084 remains blocked until the assembly ratifies joins, departures,
reserves, coverage, selection, and credits. Its safe proposal regenerates
membership only for an unfrozen round. A departure in a frozen round preserves
cohort/owner: published positions open coverage, while an unpublished owner
position receives an audited `excusedDeparture` tombstone/skip with no shift,
completion, credit, or replacement owner. The assembly may instead require
coverage for that unpublished position only after defining exact slot, cursor,
round-closure, failure, and credit accounting.

That proposed tombstone is provisional until one activation can atomically commit
it with cursor/round closure and a complete affected physical delivery/market unit.
If staffing, adjacent delivery lead/helper, or market distinctness fails, no
tombstone or cursor state changes; the ratified fallback applies or planning blocks.

HU-084 must also ratify eligibility drift without membership exit. An unfrozen
round may deterministically remove/append after preview/stage invalidation; a frozen
round preserves cohort/owner and uses reason-specific coverage or
`excusedIneligible`. Re-eligibility enters reserve/next unfrozen round and never
revives an old position. The HU-082 predicate still keeps common purchase managers
eligible and real producers ineligible.

Until that policy is accepted, a mismatch between the frozen round cohort and
live eligibility fails any new activation atomically before rotation, shift,
Sheet, or notification writes. Existing published rows remain unchanged and an
administrator must resolve the membership transition explicitly.

### Rotation ownership is distinct from effective assignment

Every planned position records its immutable rotation owner separately from its
current effective assignee. Initial generation makes them equal. Swaps, governed
Sheet edits, or a later approved coverage workflow may update only effective
assignment. They cannot reconstruct or advance the cursor.

This identity split is required now because existing reciprocal swaps already
make effective assignments an unreliable source for recovering fair order; it
does not accept HU-084's pending coverage policy.

### Seasonal tabs are projections, not resets

Each shift belongs to a seasonal projection according to its actual business
date in `Europe/Madrid`. A missing next-season tab is created idempotently. An
existing tab is merged by stable logical row identity; it is not cleared to add
carryover or a later round.

Use one stable Google workbook per environment, with tabs by shift type and
season. Workbook identity/configuration is its ID, not its display name, so
renaming the file does not create a new integration. A new workbook every season
is not the default.

Sheets is a synchronized, human-readable projection and a governed input for
effective assignments. It does not own cohort, round, cursor, or rotation owner.
Import/reconciliation is partitioned across explicit seasonal tabs and a failed
tab read cannot authorize deletion from another partition.

### Firestore is the mobile source

Android and iOS continue to read Firestore shifts, not tab names or workbook
data. Planner output uses the existing canonical `source = app`; separate
metadata such as `origin = planner` and `planningRequestId` carries provenance.
The clients continue accepting only canonical sources.

The standard seasonal planning request is one bundle with explicit `delivery`
and `market` subplans, each naming its own target planning-frontier season, plus
one stable bundle/request ID. Their rotations/cursors remain independent, but
preview/stage/activate succeeds for both or neither; one failed or stale subplan
cannot leave a half-updated season. Clients observe the exact bundle/mode to
`completed` or `failed` and perform one server read-back after activation.

`preview` computes the deterministic plan and digest without mutating rotation,
candidate/public shifts, Sheets, notification outbox, or an enabled credit
ledger. It may write only private request/operation lifecycle state plus its
immutable bundle/receipt artifact.
`stage` accepts only that combined snapshot/digest and stores one versioned
two-type bundle candidate in a separate backend-owned partition hidden from
normal member queries, Sheets export, and notification consumers; it advances no
active cursor and freezes no cohort. `activate` accepts only that candidate
revision/digest and atomically promotes both active rotations/projections.
Because the immutable preview bundle predates activation, inverse recovery
retains it outside its write-set and never updates, restores, or classifies it as
an activation-created path to delete.
The staged candidate has the same immutability boundary: activation/recovery never
updates or restores it and never captures it as a before-image. Stage cannot own an
exact future transaction measurement because activation/recovery IDs, before-images,
preconditions, payloads, and the opaque Firestore transaction token do not exist yet.
The governed activation runtime first claims a request-only lease; it deliberately
does not create the operation document while processing because the forward CAS
must create that same path atomically as its terminal. Live competitors receive
`busy`, the owner may resume, and expiry permits a higher fencing epoch. Every CAS
retry verifies the request digest, worker, epoch, and lease interval. Recovery
consumes the immutable activation terminal and owns only its separately retained
inverse outcome, so it never reopens the request or establishes another lifecycle
authority.
The exact serializer therefore accepts the actual `WriteBatch` owned by each fully
resolved transaction attempt, runs before public writes, and binds both its ordered
write-set digest and complete protobuf `CommitRequest` digest/byte count. The local
attempt adapter now requires completed authoritative reads, the empty internal batch
owned by that exact SDK `Transaction`, and its real opaque token. It canonically
populates, measures, and seals that batch once per callback attempt; SDK reset clears
the authority and forces the retry to rebuild and remeasure. Successful measurement
replaces operations with detached measured `Write` copies, makes operation storage
adapter-owned, and reserializes the complete request immediately before transport.
A changed token or byte sequence fails closed. The measurement remains in memory
while that request commits because placing its own request digest inside the
request would be circular. Once the measured transaction returns successfully, a
separate backend-only protocol creates an immutable `transactionReturned`
outcome beneath the committed operation. Direction plus exact commit-request
digest form its stable key; it binds operation intent, bundle, epoch, manifest,
the complete measurement, a post-return timestamp, and derived digests. The
repository uses create-without-overwrite, validates the authorizing forward or
inverse terminal, converges exact replay, and performs an independent read-back.
It persists neither the opaque token nor a claim of lower-level transport
acknowledgement. The index-configuration digest records the audited authority but
does not replace the isolated-clone rehearsal needed for backend index-entry
accounting.

Before semantic materialization, publication codec v1 freezes the exact flat
public payload, backend mutation marker, activation tombstone, and before-image
envelope. New rows retain the fields consumed by installed clients and publish
`source = app`; planner lineage, rotation ownership, assignment/completion and
document revisions, and the monotonic epoch remain additive metadata. Delivery
has exactly one assignee and market exactly three. A controlled write changes a
`lastBackendMutation` marker bound to its target, marker-free payload digest,
document revision, operation intent, bundle, and epoch. Only an event whose
marker changed must match the current payload; a later ordinary edit may retain
the historical marker and must not be suppressed.

The same activation transaction creates an immutable `state = committed`
operation tombstone binding its ordered public mutations and before-image
references. Before-images preserve an exact tagged Firestore subset (maps,
arrays, scalars, timestamps, bytes, and geopoints), their original update-time
evidence, capture-contract digest, path, payload digest, and envelope digest.
Lossy or unsupported values fail closed. These pure codecs freeze the input to
the forward/inverse materializers.

The local forward materializer now requires a complete live recomputation to
reproduce the immutable staged artifact before it creates any write. It resolves
all public positions, the guarded predecessor-helper update when present, both
rotation/lease transitions, active state, request terminal, Sheets commands,
held intents, before-images, and the activation tombstone. Every update carries
the transaction-read `lastUpdateTime`; the exact set must match both the forward
budget and inverse create manifest. It then passes that set to the real pinned
transaction-attempt adapter, and an emulator vector proves that the same measured
SDK batch commits atomically. Non-zero credit writes remain closed until HU-084.

The local inverse materializer consumes only that persisted bundle, activation
tombstone, completed request, current activation documents, and revalidated
before-images. It rejects changed creates, a stale active bundle/epoch, or either
release lease not still sealed by that activation. One measured inverse batch
deletes only unchanged activation creates and restores guarded targets. The prior
business lineage returns, but maintenance `writeEpoch` and rotation/state
revisions advance monotonically and both release leases clear. Retained maps are
rewritten whole and top-level after-only fields use explicit delete sentinels.
The activation record is exactly replaced by a digest-bound recovery tombstone;
before-images and the completed historical request remain audit evidence. A
Firestore-emulator vector proves atomic delete, restore, higher epoch, and exact
terminal replacement.

The local CAS runtime now invokes its resolver inside every retried Firestore
callback, feeds only that attempt's read-set to the real forward/inverse
materializer, and persists an outcome only for the attempt returned by
`runTransaction`. An exact retained directional outcome replays without another
CAS. A committed activation or recovery terminal missing that outcome fails
closed, because repeating a mutation after losing its acknowledgement is not a
safe repair. The concrete local resolver now reads the digest-bound
`shiftPlanningState/fairness` envelope, immutable staged package, authoritative
state/rotations, and every before-image target inside each forward retry. Its
inverse counterpart reads the tombstone, bundle, request, before-images, and all
current delete/restore targets. Emulator evidence proves valid source drift has
zero public writes, then exact activation and higher-epoch recovery. The local
governed producer now rebuilds the
live envelope transactionally from bounded member/device and calendar
projections, canonical config, authoritative state/rotations, and the exact
backend-only `shiftPlanningState/sourcePolicy`. It hashes notification targets,
ignores authentication-only member metadata, performs no write on exact replay,
and preserves the last valid envelope when a source is malformed or exceeds its
bound. The concrete forward resolver now requires that producer read-set to be
rebuilt and digest-compared inside every activation retry, so a stale cached
envelope cannot authorize writes. The local `index.ts` trigger now routes
unversioned documents through the unchanged legacy handler and schema-v2
preview/stage/activate requests through the governed runtime. Unknown declared
versions fail closed instead of falling back. Recovery is exported locally only
through an exact-body HTTP adapter pinned to the future dedicated operator
service-account email. That adapter adds sanitized correlated request/response
audit handling and still requires the separate backend maintenance allowlist.
HU-085 retains principal provisioning, exact invoker IAM and negative permission
proof, rehearsal, deployment, and live execution.
Activation is the acknowledged public-visibility boundary and queues Sheets sync
plus held notification intents.

The initial rollout preserves installed clients that read the existing flat
`shifts` collection. Public promotion must therefore write the complete bounded
delivery-plus-market flat projection, both rotation/cursor transitions, sync
commands, and held intents in one Firestore transaction. The preflight must prove
the combined manifest fits every transaction limit; otherwise activation is
blocked until supported mobile versions follow an active-revision contract. A
pointer flip alone is not compatible with current readers, and partial per-type
or multi-batch promotion is not atomic.

Notifications are released separately after reconciliation. Release creates
each canonical event idempotently with a stable deduplication key; downstream
in-app inbox upsert is idempotent by that key. FCM transport is at least once and
may display a duplicate push; it carries the stable event ID/collapse metadata
for best-effort handling, but this ADR does not promise exactly-once OS
presentation. Delivered messages cannot be rolled back.

For shift events, the canonical event, inbox projection, and push all persist only
generic non-sensitive copy/reference plus lifecycle metadata—never member names,
shift dates, or effective assignments. Android/iOS fetch current-revision detail
under authorization whenever the push or inbox row opens. Durable/offline caches
stay generic, and ephemeral detail is invalidated on session, membership,
assignment-revision, or environment drift.

Held notification intents use a backend-owned outbox/path that no current normal
notification trigger watches. Only explicit release creates canonical consumable
events with stable idempotency keys; a status flag inside an already consumed
collection is not a sufficient mixed-revision fence.

The activation transaction also creates explicit digest-bound Sheets-sync commands
in pending state. After commit, an explicitly invoked/polled worker claims and
retries them idempotently; it can rediscover missed pending work and never depends
on enabling Eventarc after a creation event. Per-row events from activation,
repair, or recovery never own export or notification side effects: a trigger
validates an event-specific
backend mutation marker/manifest and audits it as a no-op. Retained provenance on
a later ordinary edit does not suppress that edit. Terminal operation tombstones
and event ledgers outlive every configured retry window.

The local HU-082 public-event contract now implements that decision without
wiring the trigger. It recognizes activation terminals plus exact repair/sync-
correction registry terminals, validates changed create/update markers, and
validates recovery deletes against both their activation before-document and the
inverse deletion manifest. It returns a stable audited-no-op event digest; a
retained marker remains ordinary and a changed marker without exact authority
fails closed.

The companion local retention producer now freezes schema v1 without wiring the
trigger. A digest-bound policy carries the approved maximum end-to-end delivery/
retry horizon plus a positive safety margin. A controlled terminal gets one
immutable operation-retention binding whose exclusive `retainUntil` is derived
from its terminal time; controlled decisions create one ledger identity from
their stable `eventDigest`. Invalid, missing, expired, or detached authority
instead creates a stable rejected-event ledger intent that requires an operator
alert and forbids legacy row effects. Cleanup protects the operation terminal,
retention binding, and bound ledgers at the exact boundary and may remove them
only afterward. Deterministic records live under the backend-only
`shiftPlanningPublicEventLedgers` namespace. HU-083 still owns durable create-or-
exact-replay persistence, the real `onShiftWritten`/alert adapters, configured
policy activation, and integrated side-effect evidence.

The local HU-082 command substrate implements exact pending/processing/completed
codecs, immutable-command digests, bounded polling, transactional claim or expired-
lease takeover, pre-batch active-lineage/partition authorization, and read-back-
guarded completion. A stale worker loses its monotonically advanced partition
fence. External I/O exceptions retain the lease; HU-083 supplies the real Sheets
adapter plus durable ambiguity/read-back reconciliation.

Sheets commands are serialized by a monotonic epoch and lease per workbook/
partition. A worker validates command plus active revision/digest before each batch
and records read-back afterward. Recovery first supersedes and drains the activation
worker/external call; if that cannot be proved, it fails closed instead of
interleaving. A late old-epoch retry cannot overwrite recovered values.

An ambiguous Sheets drain has a separate timeboxed residual: Firestore remains
active and authoritative, the notification outbox stays sealed, affected Sheet
integration/ranges remain fenced, and mobile/unrelated traffic resumes. Recovery
waits for proven external-call terminality/read-back; uncertainty never holds all
production offline indefinitely. Residual expiry is a mandatory decision gate:
revoke the exact worker/workbook authority, wait the conservative external-call
horizon, and prove stable Drive activity/revision before reconciliation. If that
proof remains impossible, either separately authorize workbook quarantine and a
new controlled projection—without claiming the old link is preserved—or renew a
named external incident and scoped fence. A TTL never silently expires.

The notification batch leases both type rotations until terminal. A transaction/
CAS reads assignment and membership versions while claiming each intent and
creating event/inbox state; stale input writes nothing. Every FCM send/retry holds
a short lease respected by all assignment/member/token writers while revalidating
those versions. Each canonical event keeps immutable attempts with `attemptId`, lease
epoch/deadline, validation digest, authenticated start, and terminal outcome; aggregate
state is derived. Timeout/expiry becomes possibly delivered `unknown`, and retry
appends a new revalidated attempt without replacing prior evidence. Canonical event,
inbox, and push artifacts are generic and detail is authorized/fresh on open.
Authenticated submission start is the guarantee boundary. Only an intent proved
never submitted under any dispatch epoch may be cancelled as unreleased. An
Android or iOS device-registration commit denied by Rules is deferred rather than
reported as uploaded: the client retains the current authorized context and local
credential, then retries on the next authorized session or token event through the
same session/UID/credential fences. It does not spin inside login or reinterpret
other Firestore failures as notification-dispatch ownership. An
`unknown` outcome is possibly delivered, remains immutable submission history, and
must use reconciliation/correction semantics; it cannot be reclassified as
unreleased. Later OS presentation may race state change, so no presentation-time
membership guarantee is claimed. A safe-resume residual remains timeboxed and
cannot allow a superseding activation.

### Rollout boundaries

- HU-082 delivers rotation state, planners, request lifecycle, and mobile
  read-back, including preview/stage/activate binding and notification
  hold/release. It owns atomic Sheets-command/operation-marker emission and the
  consumer protocol, validated with fixtures, but not the real Sheets consumer.
  It validates locally/in emulators without a shared-project deploy.
- HU-083 delivers multi-season Sheets behavior plus audited repair/rehearsal in
  develop through bounded direct scripts. It owns the real command consumer,
  candidate trigger suppression, and migration-baseline handoff. It deploys no
  Functions or Rules to the shared Firebase project.
- HU-084 records the assembly-gated coverage/credit proposal and is independent
  of base planner activation.
- HU-085 owns quiescence/drain, the first shared Functions/Rules deployment,
  including an explicitly authorized temporary restrictive Rules/ingress
  bootstrap fence, production identity/access/parameters, deferred repair and
  migration, side-effect-free preview, non-public stage, explicit public activation,
  held-notification reconciliation/release, and traffic resume/recovery under
  separate authorization.

## Considered options

### Restart and shuffle independently every season

Rejected. It can repeat the previous final owner, breaks helper continuity,
cannot explain fairness, and is not reproducible.

### Require a fixed number of turns per member in every season

Rejected as the primary invariant. Calendar length, cohort size, inherited
carryover, and market's fixed 30 positions do not generally divide evenly. A
fixed seasonal quota either leaves dates empty or repeats somebody before a
round completes. Completed-round fairness produces the intended two rounds in
the current case without encoding a fragile constant.

### Make Sheets the rotation authority

Rejected. Manual assignment edits and reciprocal swaps cannot distinguish who
owned a fair position from who performs it. Partial reads and renamed/added tabs
would also make cursor recovery unsafe. The mobile apps already consume
Firestore.

### Create a new workbook every season

Rejected. It repeats sharing, parameters, validation, links, and migration every
year and makes cross-season helper/carryover reconciliation harder. Seasonal
tabs within one stable workbook retain human organization without changing
integration identity.

### Use one workbook for develop and production

Rejected. It weakens environment isolation and makes tests capable of mutating
production projections. Each environment has one explicit stable workbook with
no fallback to the other.

## Consequences

### Positive

- Fairness and helper continuity are explicit and testable across years.
- N=29/N=30/N=31 market behavior follows one rule without a calculator or
  seasonal exception.
- Idempotent replay and concurrency can be protected by one authoritative
  aggregate.
- Apps receive planner results through their existing Firestore/source contract.
- Workbook links/configuration remain stable while tabs grow by season.
- Swaps and future approved coverage cannot corrupt historical queue ownership.
- Develop repair and production activation have independently reviewable risk.

### Negative

- A new persisted rotation aggregate, versioning, migration, and Rules surface
  are required.
- The single Firebase project makes Functions and Rules deployment global across
  logical develop/production paths, so a develop-only deploy is not an isolated
  rehearsal.
- Existing test data may not contain enough evidence to reconstruct ownership;
  ambiguous cases require an explicit administrator mapping rather than an
  automatic repair.
- Sheets synchronization becomes partition-aware and needs merge/reconciliation
  logic instead of whole-tab replacement.
- Mobile planning UI must observe backend terminal state instead of treating
  request submission as success.
- Round counts per calendar season are not a constant and must be explained in
  UI/docs with the completed-round invariant.

## Migration and compatibility

- Preserve existing readers while adding rotation/provenance fields.
- Never infer historical owner from an effective assignee after a swap/manual
  edit when evidence is ambiguous.
- Audit and dry-run before any develop repair; bind apply to the reviewed input
  snapshot/digest and verified backup.
- Build production source/rotation/projection normalization only in a hidden
  migration/candidate partition. Existing public rows remain unchanged until
  atomic activation. Initial rotation/cursor bootstrap is committed at that
  activation; an HU-083 historical backfill cannot independently advance an
  already active live cursor/frontier.
- Keep `source = app|google_sheets`; repair `source = planner` to canonical
  source plus provenance.
- Replace fixed-range/whole-tab paths before producing cross-season carryover.
- Validate HU-082/HU-083 code and Rules locally/in emulators; any HU-083 live
  develop repair uses only a trigger-safe compatible bounded direct script and
  never a shared deploy. It needs the same effective all-writer Firestore/workbook
  fence, immediate input rehash, document CAS, Sheets revision guard, and offline-
  editor proof as production; otherwise it takes the zero-write HU-085 handoff.
  Any production/project-wide control-plane or fence impact forces that handoff and
  cannot be authorized inside HU-083. A live script also needs a manifested keyless,
  timeboxed principal/workload, explicit database-wide IAM blast and develop guards,
  sole-writer proof, then terminal revocation and audit read-back.
- Commit-rehearse the exact HU-083 forward and inverse manifests in an isolated
  restored clone before any live develop apply. A successful live apply ends with
  develop repaired and its immutable two-type baseline present; the inverse runs
  live only to recover a failed/mismatched apply. A deferred handoff carries plans/
  digests only, never the HU-083 script principal or credential.
- HU-083 backups use a separate temporary keyless evidence auditor with exact
  read/export-only source access and create-only encrypted, ACL- and retention-bound
  evidence output. It cannot mutate source data or invoke apply and is revoked/read
  back before the repair principal is enabled.
- Execute production only through HU-085's exact identity, backup, allowlists,
  Rules/indexes plan, side-effect-free preview, digest-bound non-public stage, explicit
  activation, held notification, read-back, and recovery gates.
- Because deploys are shared, first establish an authorized bootstrap barrier by
  deploying tested temporary Rules that deny the affected direct client writes
  and disabling exact callable/HTTP/scheduled producers. Treat prior accepted
  events and their cascades as in flight, drain them while existing deliveries
  run, then disable the exact triggers/deliveries and verify empty queues. If
  this sequence cannot be proved, stop before access, configuration, or data
  mutation.
- HU-082 implements a monotonic backend maintenance/write epoch and expected active-
  revision precondition for every affected app/admin, swap, override, calendar,
  Sheets-import, and command write. Stale/absent offline writes fail. Legacy direct
  paths remain closed or move to a versioned command; HU-085 only verifies this live.
- Rules do not constrain Admin SDK/server/IAM writers. Inventory and recoverably
  freeze or revoke every such principal, key, workload, job, CI/script, and console
  path. After all upstream intake and independent writers close, existing deliveries
  may drain only the causally bounded accepted set; prove empty ledgers plus a quiet
  horizon. Legacy revisions are not assumed to filter event IDs. If causal isolation
  cannot be proved, abort HU-085 for a separately designed bridge-revision story.
  Revoke/disable drain identities before migration, then allow only candidate runtime.
  The rollout operator is endpoint-invoker-only, with no Firestore/Sheets role,
  runtime impersonation, or token creation.
- Every HU-085 post-baseline repair, migration/bootstrap, preview lifecycle, stage,
  activation, sync correction, recovery, and manifested cleanup is an exact
  operation-ID/revision/digest-bound command. Only the candidate runtime or its
  pre-rehearsed epoch-aware recovery revision under the same governed data identity
  writes Firestore/Sheet content; operator, deployer, Drive controller, evidence
  auditor, and scripts never write that data directly.
- Recheck an effective-authority manifest—not one project etag—at every live gate:
  IAM ancestry/conditions/deny policies, service-account IAM, WIF, transitive groups,
  keys/workloads, Drive/Workspace/DWD authority, Audit Logs, and data state. Chain
  each authorized result as the next checkpoint and abort on any effective-access or
  unmanifested drift even when a top-level etag is unchanged.
- Dedicated runtime IAM reduces who wields server access but cannot path-scope Admin/
  server Firestore writes: its data role is effectively database/project scoped and
  bypasses Rules. Record/authorize that blast radius, deny unrelated Auth/Storage/
  IAM/Secret/token authority, enforce audited path/environment/operation guards in
  code, and document separate project/database or a mediated writer as stronger isolation.
- Use a separate temporary least-privilege control-plane deployer for the exact
  Functions/Rules/Eventarc/config/IAM actions and no data/workbook/token role.
  Prefer rehearsed prior-revision traffic rollback without redeploy; otherwise
  limit `actAs` to candidate plus exact prior runtime for allowlisted forward/
  rollback deploys. A named Drive permission controller necessarily gains
  temporary edit capability for the manifested ACL/protection fence; audit exact
  actions and unchanged cell digest, then revoke it. Recovery uses a sealed exact-
  action reauthorization. A separate sealed action grants only the candidate runtime
  after baseline approval; terminal ACL restoration follows the same pattern.
  Revoke both authorities on every terminal exit.
- Use a separate temporary keyless evidence/backup auditor for exact source read/
  export actions and create-only access to an encrypted, ACL- and retention-bound
  evidence destination. It cannot mutate application data or the source workbook,
  overwrite/delete retained artifacts, invoke rollout operations, or impersonate
  another authority. Record source revision/read time, digest, restore-test
  provenance, revocation, and read-back for each evidence window.
- Independently measure and commit-rehearse both the exact combined activation and
  inverse recovery transactions in an emulator/isolated restored clone. Production
  only revalidates their digest/budget without writing; do not cross visibility if
  either full manifest cannot commit atomically for installed flat readers.
- Every terminal rollout outcome expires operation IDs, closes maintenance state,
  and revokes temporary operator IAM; any retained endpoint remains inert until a
  new time-bounded authorization.
- Temporarily fence every workbook writer: humans, Apps Script/installable
  triggers, add-ons, API/OAuth clients, service accounts, Shared Drive automations,
  transitive group/domain membership, DWD grants/scopes, and Workspace admin paths.
  Freeze/digest or prove absence, read Drive/Workspace activity, and verify exact
  revision/digest before every write. Prove zero continuing writers before
  provisioning, then candidate runtime sole writer; otherwise abort.
- Editors must confirm online, closed, and no pending offline edits. Keep affected
  ranges protected until controlled reauthentication, forced server reload/current
  base revision, and post-reopen observation/read-back. Unconfirmed human/automation
  writers remain read-only or use a versioned change channel.
- Resolve My Drive versus Shared Drive, `driveId`, owner(s), roles, and capabilities.
  If no reversible owner fence exists, stop for a separate transfer/move decision
  that proves the same file ID/link and bound integrations; never silently create a
  replacement workbook.
- After drain, revoke bounded drain writers and capture fresh quiescent Firestore/
  workbook backups through that evidence auditor, plus present/absent manifests,
  digests, and forward/inverse budgets.
  Pre-drain backups are recovery points only. Any packet delta requires renewed
  authorization before access/config/deploy/migration continues.
- The security/write epoch never rolls back. Recovery may restore the prior business
  active revision but increments the epoch, retains hardened Rules, and serves only
  an epoch-aware revision; legacy server writers remain disabled. This intentional
  security residual is excluded from byte-for-byte rollback equality and is tested.
- Prebuild additive indexes and wait for `READY` before the main maintenance
  window. Keep a timeboxed rollback/resume outcome for every later gate so
  delayed notification approval cannot leave production unavailable indefinitely.

## Approval and implementation status

The maintainer accepted this ADR on 2026-08-24 for HU-082 implementation and
local/emulator validation. Acceptance does not authorize shared-project deployment,
Firebase/Sheets live mutation, production sharing, or production configuration.
The assembly-gated HU-084 policy remains independent and unapproved.

## Related work

- HU-017 / issue #4
- HU-020 / issue #19
- HU-082 / issue #266
- HU-083 / issue #267
- HU-084 / issue #268
- HU-085 / issue #269
- ADR-0003: Use Firebase as Backend
