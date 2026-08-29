# [HU-082] Continuous seasonal shift rotation

## Tracking

- GitHub issue: #266
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/266
- State: IN PROGRESS / local implementation authorized
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation branch: `codex/hu-082-continuous-seasonal-shift-rotation`
- Implementation base: `d8fd646`
- Extends: HU-017 / #4 and HU-020 / #19 (both closed)
- Precedes: the continuation deferred from HU-081 / #264
- Downstream: HU-083 / #267 and HU-085 / #269
- Independent policy proposal: HU-084 / #268

## Summary

Replace seasonal reshuffling with one persisted fair queue per shift type.
Delivery covers the weekly calendar through August and completes the active
round across as many following seasonal projections as needed. Market creates
ten target-season groups and materializes its boundary-active round from the same
continuous queue. Android and iOS observe exact requests and refresh Firestore
after activation.

The standard seasonal operation is one atomic bundle with explicit delivery and
market frontier subplans. Their queues remain independent, but both activate or
neither does; one failure can never leave only one calendar updated.

The earlier fixed target of exactly two delivery turns per member and season is
not retained. The invariant is one position per member in every completed
round, with as many rounds as the calendar and cohort require.

## Canonical decisions

- Active common purchase managers from `Compras Regüerta` are selectable;
  real producers are not.
- A seasonal sheet/tab is a date projection and never resets a rotation.
- Bootstrap order/cursor comes only from valid versioned rotation state,
  unambiguous historical owner evidence, or an explicit admin-approved member-ID
  mapping. It never comes from query order or an unseeded shuffle.
- If the last legacy delivery has one unambiguous eligible registered helper, that
  UID must be the first new owner/effective lead. A cursor/helper conflict fails
  closed for mapping; generation never overwrites the historical helper to fit.
- Delivery requires at least two eligible members. The helper is the next
  chronological delivery's effective lead while that predecessor remains
  uncompleted; completion freezes the actual helper/revision. Adjacent effective
  delivery leads must differ. Append, swap, coverage, credit, import, or manual
  assignment validates predecessor/current/successor plus completion revisions
  atomically, never rewrites completed helper history, and never changes ownership.
- Market has 30 target-season positions, then materializes the complete
  boundary-active round into as many future projections as needed and completes
  the final group of three.
- Firestore owns rotation state. Apps read Firestore, not Sheets.
- HU-082 emits the versioned Sheets-sync/operation-marker contract; HU-083 owns
  the real multi-season consumer and candidate trigger implementation.
- Planner shifts use `source = app` with separate `origin = planner` metadata.
- Generation accepts only the first incomplete planning-frontier season or exact
  replay for each typed subplan, merging partial overflow and advancing over
  fully prefilled seasons before accepting the combined bundle.
- HU-082 owns a backend maintenance/write epoch plus expected active-revision
  precondition for every affected app/admin, swap, override, calendar, Sheets-import,
  and command write. Stale/offline writes fail; unsupported direct paths remain
  closed or migrate to versioned commands before HU-085 may reopen them.
- Epoch lifecycle is monotonic: after the external/Rules intake barrier is proved
  closed, maintenance entry atomically advances it; activation
  commits a newer epoch with the new active revision; rollback commits a still newer
  epoch with the restored business revision; pre-activation abort advances it before
  reopening. It is digested and budgeted and is never restored or reused.
- A round cohort freezes on public activation, never on preview/stage; roster
  or any other fairness-input drift forces a new digest.
- Preview writes only private request/operation lifecycle state plus its immutable
  bundle/receipt; digest-bound staging stays in a separate admin-only partition,
  and activation transactionally rechecks all input versions, including the
  credit ledger when enabled.
- The invoker-only rollout boundary covers every governed data mutation: repair,
  migration/bootstrap, preview, stage, activate, sync correction, recovery, and
  cleanup. The epoch-aware runtime alone writes data; operator/deployer/scripts do not.
- Current flat-collection clients require the complete public projection,
  both rotation/cursors, sync commands, metadata, and held intents to fit one
  combined delivery-plus-market transaction; an oversize manifest blocks rollout
  pending a mobile versioned-reader migration.
- Notification release creates one canonical event idempotently per stable key;
  inbox upsert deduplicates by it, while FCM remains at least once and may present
  a duplicate push despite stable event ID/collapse metadata.
- Canonical shift events, inbox rows, and pushes persist only a generic non-sensitive
  copy/reference—never member names, shift date, or effective assignment. Opening
  either push or inbox fetches current detail under authorization/freshness; offline
  or stale cache shows only the generic state.
- Event/inbox claim uses a transaction/CAS over current assignment/member versions;
  every FCM send/retry uses a writer-honored lease over UID/eligibility/token state.
  Event/inbox/push are generic and current detail is authorized on open; later OS presentation
  may race a state change. Sealed/partial bundles retain both rotation leases.
- Only drift found before authenticated submission starts can cancel an intent.
  `unknown` is possibly delivered, is never reclassified as unreleased, and uses
  at-least-once reconciliation/correction semantics.
- Any urgent provisional list is one non-activating delivery-plus-market communication
  baseline. `assignmentDigest` binds UID plans, `resolverDigest` binds UID/display-name
  pairs, and `planningDigest` seals both plus the contrasted source manifest. Proposal
  and approval-only states cannot render; only an exact globally approved,
  preparation-zero-write-attested seal may be revalidated and communicated. A separate
  maintainer authorization may copy the sanitized render to consultation-only workbook
  tabs without activating Firestore or the apps. HU-085 must reproduce it or
  supersede/reapprove/reseal/recommunicate before activation.

## Links

- Spec: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/spec.md`
- Plan: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/plan.md`
- Tasks: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/tasks.md`
- Communication baseline:
  `spec/shifts/hu-082-continuous-seasonal-shift-rotation/communication-baseline.md`
- ADR: `docs/decisions/0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md`

## Delivery gate

- [x] ADR-0013 reviewed and accepted.
- [x] Bilingual requirements aligned.
- [x] Implementation branch frozen from current `main` at `d8fd646`.
- [ ] Local/emulator gates green with no shared-project Functions/Rules deploy.
- [ ] Functions, Android, and iOS test evidence complete.
- [ ] Local/emulator activation read-back proves generation is visible in both
  apps; no live develop deploy is required.
- [ ] Android/iOS admin inspection can render stage without exposing it to normal
  feeds, and current flat readers pass atomic/oversize activation tests.
- [x] Source contrast, layered digests, global approval/zero-write seal, audience
  render revalidation, privacy, and HU-085 respect-or-supersede contract documented.
- [x] Any real communication baseline has contrasted sources, all three digest layers,
  one exact global approval/zero-write attestation, a revalidated seal/render for both
  typed plans, and no PII in public artifacts or UIDs/phones in audience rows.
- [x] No Firestore public-shift/runtime activation, deployment, notification, rotation,
  or app-configuration mutation is included. The only live side effect is the separately
  authorized publication of sanitized consultation tabs in the shared workbook.

## Local implementation checkpoint — contract/planner cut (2026-08-24)

The current contract/pure-planning cut adds the exact v2 request/wire boundary,
canonical fairness digest, fail-closed rotation bootstrap, and a side-effect-free
delivery-plus-market bundle planner. The bundle binds independent before/after
frontiers, `futureProjectionOccupancy`, active state, one exact common migration
baseline, cohort-freeze transitions, forward/inverse manifests and write budgets,
two release-lease intents, Sheets-sync templates, and held assignment intents into
one stable revision/digest.

The pure artifact chain is now fail-closed. Stage requires the exact persisted
preview receipt and structural forward/inverse budgets; it rejects synthetic
transaction measurements. The conservative canonical gate remains 500 document
writes plus declared transforms and 10 MiB serialized in each direction, and the
pinned serializer applies it only to a fully resolved real attempt. Forward
budgeting includes persisted recovery before-images, while the immutable candidate
is excluded from both write sets. Measurement authority is fairness/expected-state
lineage: an adapter or index-configuration change invalidates the candidate for
activation. Until HU-084 owns exact credit transitions, any enabled or non-empty
credit ledger fails closed. Activate requires the persisted staged candidate and a
`candidateDigest` over that complete candidate, not only the bundle digest. The
pure model emits sync commands bound to workbook/partition epochs and
claim leases, one held intent per assignment with UID and assignment/membership/
eligibility/destination revisions, and a recovery manifest bound to exact paths,
persisted before-image contract digests, active CAS, and a never-reused higher epoch.

Local strict Rules admit only exact admin request creation/read-back and
admin candidate inspection (including nested positions); all candidate writes and
the eight private control-plane collections remain backend-only. The Phase 1
candidate denies the nine new planning roots so its permissive catch-all cannot
expose them. These Rules are local candidates and must not be deployed alone.

That checkpoint was deliberately non-deployable. The legacy v1 trigger in
`functions/src/index.ts`, unversioned direct `shifts` writers, persistence/CAS,
preview/candidate repositories, write-set materialization and per-attempt
serializer invocation, request
lifecycle, real sync/notification/recovery consumers, and Android/iOS v2 read-back
remain pending. No transaction, Firebase project, Sheet, deploy, or production
data mutation is part of this cut.

## Local implementation checkpoint — private persistence cut (2026-08-24)

The local Firestore repository now owns the exact persisted envelope for
`preview` and `stage`. A transaction binds an immutable v2 request to one
operation and lease; competing workers receive `busy`, an expired takeover
increments the fencing epoch, stale owners cannot finish, and canonical terminal
summaries replay without recalculation or artifact overwrite. Preview atomically
persists its immutable bundle, exact receipt, request lifecycle, and operation.
Stage reloads the persisted preview and bundle, validates the planned candidate
lineage exactly without transaction evidence, and creates an immutable
digest-bound candidate header without accepting even an identical pre-existing
collision.

The activation boundary added here is intentionally read-only and candidate-only:
it validates an unclaimed activate request against the persisted staged candidate
without loading a preview or bundle, claiming the request, or writing state. A
future runtime must still rebuild and revalidate the live fairness snapshot and
bundle digest immediately before the activation CAS. Emulator regressions cover
claim contention, lease takeover/fencing, canonical failure summaries, terminal
replay integrity, immutable preview persistence, stage collision/tamper handling,
and zero-write activation preflight.

This cut remains deliberately non-deployable. Real write-set materialization and
per-attempt serializer invocation, candidate-position materialization,
maintenance/publication CAS,
public activation, the v2 trigger, sync/notification/recovery consumers, mobile
read-back, Rules deployment, Sheets access, and all shared/live mutations remain
pending. The legacy v1 trigger is unchanged and remains the active runtime.

## Local implementation checkpoint — request orchestration cut (2026-08-24)

An SDK-free lifecycle orchestrator now routes each exact persisted request through
one repository transaction. Preview and stage claim before invoking their planner;
busy and terminal replay return without planning, and stage receives the exact
persisted preview. Typed planning and digest failures become stable terminal
summaries, while infrastructure or persistence failures remain retryable instead
of being rewritten as business failures. The same transaction routes activate to
candidate preflight without creating an operation or writing state; activate does
not claim or resolve a bundle.

The pure manifest/budget contract also keeps the immutable bundle and staged
candidate entirely outside activation and inverse recovery: neither is updated,
restored, deleted, or captured as a before-image. Existing activation request and
operation records are classified as updates, while only genuinely new public
projection, command, before-image, and held-intent documents are creates. Unit
and Firestore emulator
coverage exercise the complete private `preview -> stage` path and prove the
`activate` orchestration boundary performs no operation write. This orchestrator
is not exported from `src/index.ts`; public CAS, authoritative live snapshot
validation, exact public write-set materialization/per-attempt serialization,
consumers, mobile
integration, deployment, and every live mutation remain pending.

## Local implementation checkpoint — authoritative state CAS cut (2026-08-24)

The local backend now parses `shiftPlanningState/current` and both typed rotation
aggregates with exact fields and invariants, then reads all three documents in one
Firestore transaction and binds their normalized values to one environment-scoped
authoritative digest. Missing documents, malformed cursors/cohorts/leases,
cross-type data, divergent active lineage, or different migration baselines fail
closed. There is deliberately no implicit bootstrap or repair.

Two runtime-disconnected private transitions exercise the monotonic state
contract in Firestore Emulator. Maintenance entry requires exact CAS plus
already-verified barrier evidence; pre-activation abort requires the exact closed
read-set. Both advance `stateRevision` and `writeEpoch` once, preserve active
lineage, leave both
rotation documents unchanged, and atomically create immutable
`state-{transitionId}` evidence. Exact retries replay the original outcome even
after later state changes, while stale epoch, active lineage, read-set, or reused
intent IDs fail without mutation. Abort clears the current barrier; its operation
record retains the historical proof, and no external fence is reopened here.
Abort additionally proves that the exact entry operation still owns the read-set
and refuses to reopen while either rotation retains a release lease. Terminal
abort replay revalidates both persisted conditions before returning.

This cut remains non-deployable and is not wired from `src/index.ts`. The real
Rules/IAM/queue barrier and read-back, initial governed state/bootstrap,
affected-writer migration, activation/recovery public CAS, candidate positions,
write-set materialization/per-attempt measurements, consumers, mobile integration,
Sheets access, deploys, and
shared/live mutations remain pending.

## Local implementation checkpoint — authoritative artifact binding cut (2026-08-24)

The SDK-free authoritative-state builder is now the single normalizer used by
the Firestore state repository and bundle boundary. Bundle, preview receipt,
and staged candidate use artifact schema v2 and
`bundle-v2-*` revisions, while the existing request contract and public terminal
summary remain at schema versions 2 and 1 respectively; attempt measurements use
their own schema v1. `expectedState` contains the complete normalized
maintenance document, both rotation aggregates, their environment-scoped digest,
and the transaction-measurement authority. Receipts and candidates carry only
its digest, so they remain transitively bound without duplicating the read-set.

Both forward and inverse manifests bind the expected-state and authoritative
digests. The forward manifest records maintenance state-revision and write-epoch
transitions; the inverse before-image contract now covers the complete maintenance
document. Preview may inspect open or closed maintenance. Stage and the pure
activate planner require closed maintenance and the exact preview state, so an
open-state preview is deliberately invalid after maintenance entry and must be
recreated against the closed state.

The local request lifecycle now claims preview before loading the authoritative
state, and for stage loads the exact persisted preview before a fresh
authoritative read. It rejects any resolved bundle that does not bind that exact
read-set. Busy, terminal replay, and candidate-only activate preflight still
short-circuit without loading state; activation does not yet revalidate live
inputs or execute a CAS. Unit and isolated-emulator regressions cover state and
manifest drift, exact artifact schemas, re-preview after maintenance entry, and
wire-summary compatibility.

This remains runtime-disconnected and non-deployable. No trigger, Rules, IAM,
Sheet, shared Firebase project, public shift, mobile client, or production state
was changed. Real barrier verification, writer migration, write-set materialization,
per-attempt serializer invocation/evidence,
candidate positions, live activation/recovery CAS, consumers, and mobile read-back
remain pending.

## Local implementation checkpoint — writer inventory and barrier contract (2026-08-24)

The complete current write surface is now one versioned, canonically digested
inventory. It groups Android/iOS direct clients by logical ingress, assigns
internal helpers to their exported endpoint or delivery, and includes legacy
planning, import/export, swap, cascade triggers, Admin SDK/IAM/console/CI paths,
and every required human or automated workbook authority. The generic
notification trigger must isolate HU-082-causal delivery without stopping
unrelated notification producers; an inability to prove that isolation aborts
entry or requires a governed bridge/full fence. Unmanifested Admin/IAM authority
is modeled database-wide while known runtime writers retain their own controls.
Six logical membership and
configuration writers are classified separately: they may remain open only after
the future activation transaction can recheck their exact fairness-input version.
This includes `resolveAuthorizedMember`: authentication-only metadata must be
canonically excluded from fairness versions or advance/recheck that version.
The inventory records that the repository's configured Phase 1 Rules remain
permissive and that strict local Rules still allow unversioned direct admin shift
and calendar writes; neither is treated as an already-closed barrier.

An SDK-free verifier now accepts only an exact, canonically digested audit packet
bound to the maintenance environment, transition and full CAS, the compiled
inventory, an explicitly authorized Rules artifact, the exact workbook file ID,
causal accepted-set digest, zero pending/in-flight work, empty delivery queues,
unchanged workbook revision/digest with no pending offline editors, and a policy-
bound quiet horizon. It requires matching initial Rules/control read-backs before
causal capture, an initial zero-queue read-back after post-drain delivery closure,
and final Rules/control/queue/workbook read-backs after the quiet horizon. It
normalizes set-like input order but rejects every missing, extra, duplicate,
enabled, drifting, stale, or chronologically invalid claim. Evidence expires at
the oldest final observation plus the authorized maximum age; both verifier
passes and the trusted clock sample inside the transaction callback must fall
within that limit. It is an attempt-admission deadline, not a claim about the
physical server commit time; the held fence covers commit latency.

While all fences remain held, the external control-plane flow must first build
and explicitly authorize the exact dynamic Rules, control-manifest, workbook,
causal-set, and timing-policy checkpoint. The coordinator then executes packet
verification, idempotent full-envelope retention/read-back/reverification, and
the existing maintenance CAS inside the adapter-provided held-fence callback. It
exposes no reopen action, but only the future real adapter can enforce durable
closure on every failure and rollout validation must prove it. The immutable
entry intent carries `intakeBarrierExpiresAtMillis` and rejects a late transaction
attempt. The evidence port uses `environment + transitionId`, creates once,
replays only the same digest, and rejects collisions without overwriting. State
operation schema v2 adds that deadline and the explicit `attemptedAt` sample;
there is no deployed v1 state to migrate in this runtime-disconnected cut. A
repository replay is accepted only while a fresh authoritative
read proves that its after-digest, closed state, transition ID, and compact
barrier still own current state. Unit tests cover those contracts plus exact
inventory and command binding, Rules/workbook/queue/drain failures, chronology,
freshness, retention mismatch, callback multiplicity, CAS failure propagation,
and exact terminal recovery after evidence expiry. Freshness gates only a missing
operation; an exact terminal retry reads retained evidence without recreating it.

This remains a local contract, not trusted live evidence. No Rules or Functions
were deployed, no endpoint/trigger/queue/principal/editor was disabled, no IAM or
Drive permission changed, and no Firebase or workbook data was read or mutated.
The concrete idempotent evidence store, real adapter, writer migration,
versioned mutation commands, activation/recovery CAS, and governed reopen remain
pending.

## Documentation checkpoint — communication baseline contract (2026-08-24)

HU-082 now defines a separate urgent path for communicating a provisional plan
without using the production runtime. One authorized read-only source manifest is
contrasted entry by entry before it feeds one atomic delivery-plus-market proposal.
`assignmentDigest` binds exact UID plans, `resolverDigest` binds exact UID/display-name
pairs, and `planningDigest` seals both plus `sourceManifestDigest`.

The proposal remains reviewer-only. One global approval must bind the exact
`planningDigest` and zero-write attestation; sealing recontrasts/recomputes every
digest. The approval also binds `validUntil` and supersession intent, with at most 15
minutes from approval to expiry. The audience renderer revalidates the seal and uses
its own clock to require `[sealedAt, validUntil)` before emitting approved display names
without UIDs, member/account/request/workbook IDs, or phone numbers. Approval alone is
never communicable.

The offline baseline neither accepts nor emits a status manifest and does not prove
authoritative currentness, supersession, or CAS ownership. Its supersession field is
intent only; HU-085 owns the production registry and authoritative current/superseded
transition.

At this earlier documentation-only checkpoint, no real member list had yet been
generated, approved, sealed, or communicated. It contained no real member, account,
workbook, or service identifiers and performed no Firestore, Sheets, Drive,
notification, deployment, configuration, or app write. The operational evidence
checklist was still open at that point.

HU-085 must link its separate runtime `bundleDigest`/`candidateDigest` to the applicable
sealed-and-communicated `planningDigest`, recontrast `sourceManifestDigest`, and reproduce its
`assignmentDigest`/`resolverDigest` through UID-based row equality plus the exact
display-name resolver. Any difference requires an explicitly superseding proposal,
global approval, seal, render revalidation, and complete recommunication before
production activation; runtime readiness or staging cannot replace what was shared.
Its authoritative registry and CAS determine which baseline is current or superseded.

## Execution checkpoint - consultation publication (2026-08-24)

The maintainer subsequently approved the exact two-type package and separately
authorized publication of its sanitized audience render for cooperative consultation.
Protected evidence outside the repository binds the source snapshot, layered digests,
approval, seal, render, workbook transaction, and live read-back.

The published consultation package covers 27 eligible participants, 54 weekly delivery
assignments (52 target plus 2 carryover), and 18 three-person market events (10 target
plus 8 carryover). Five new tabs contain one summary and two seasonal projections per
shift type. Live read-back verified values, counts, formatting, blank observation cells,
month separators, and forbidden-field absence. Historical tabs and existing Drive
permissions were preserved.

Firestore public shifts remained empty, so neither Android nor iOS reads this schedule
yet. No rotation cursor, notification, runtime configuration, deployment, or app
activation changed. HU-085 must still prove authoritative alignment/currentness or
complete the supersession flow before activating the communicated schedule.

## Local implementation checkpoint — immutable candidate positions (2026-08-25)

Stage now creates one immutable admin-inspection child per planned public shift
under the candidate's `positions` subcollection. Delivery keeps one rotation
position; each market document keeps its complete ordered group of three. The
header binds document/assignment counts and `positionSetDigest`; each child binds
its canonical payload, position digest, candidate digest, and bundle lineage.
Exact terminal replay verifies the complete set and rejects missing, extra,
aliased, altered, or pre-existing collisions without overwrite. Activate remains
read-only and validates candidate header, immutable preview bundle, and every
position. The Firestore emulator covers persistence, replay, tamper, alias, and
zero-public-write preflight. No runtime trigger, deployment, public shift, Sheet,
notification, mobile client, or production state was changed.

## Local implementation checkpoint — exact transaction serializer (2026-08-25)

The staging contract no longer accepts or stores synthetic forward/inverse
`transactionEvidence`. A future exact `CommitRequest` cannot exist during stage:
activation/recovery IDs, before-images, payloads, preconditions, and the opaque
transaction token are attempt-owned values that are not yet available. The staged
candidate is now immutable outside both write sets and recovery before-images;
future activation request/operation records are likewise no longer staged
before-image targets. Forward/inverse structural budgets were reduced accordingly.
This checkpoint supersedes the earlier local statement that stage required exact
adapter measurements; request/public wire versions remain unchanged because that
runtime has never been deployed.

The new local serializer pins `@google-cloud/firestore` 8.7.0 behind adapter revision
`firestore-grpc-v1-fs8.7.0-r1`. It can build a canonical reference batch and, for one
completely resolved token-bound attempt, measures the supplied actual `WriteBatch`,
serializes its full protobuf `CommitRequest`, and returns independent write-set and
request digests, document/transform counts, maximum per-document transforms, byte
count, manifest lineage, and index-configuration authority. It rejects SDK-shape or
version drift, non-canonical or duplicate paths, extras/accessors/cycles, budget mismatch,
more than 500 combined writes/transforms, more than 500 transforms on one document,
or more than 10 MiB before any publication. The token is neither returned nor
persisted. A successful measurement seals the SDK batch against later public
or captured-payload mutations by replacing its operations with detached copies of
the measured `Write` protos. A commit guard uses a detached measured-token copy,
rejects a different token, and clears authority on reset so every retry must be
measured again. Golden and mutation-drift unit vectors pass, and the private staging
repository still passes its isolated Firestore-emulator suite with no public writes.

This serializer does not yet materialize activation/recovery mutations or execute a
domain CAS. Protobuf byte size does not include backend index-entry accounting, so
the governed isolated-clone rehearsal remains required. Nothing was deployed and no
shared Firebase, Sheets, IAM, Rules, mobile, or production state was changed.

## Local implementation checkpoint — real transaction attempt adapter (2026-08-25)

The local attempt adapter now receives the exact pinned SDK `Transaction` after all
authoritative reads. It rejects a missing token, another Firestore owner, a read-only
transaction, or any write already queued outside the adapter. It canonically populates
the transaction's own empty internal `WriteBatch`, awaits a detached copy of the real
opaque token, measures and seals that object, and returns only immutable in-memory
measurement evidence. The SDK later commits that same object; it is not rebuilt.

The serializer's guard now owns immutable operation storage and reserializes the full
request immediately before transport. A changed token, owner, target, payload, or
protobuf byte sequence fails closed. SDK reset removes commit authority and empties
the guarded batch, so every retried callback must repeat all reads, resolution, and
measurement. An emulator vector forced an `ABORTED` first attempt and proved that the
second attempt received a different request digest and was the only one transported;
another vector compared the measured digest/byte count with the exact observed commit
request and rejected private `_ops` mutation.

Validation passes on Node 22 with Functions lint/build, 151 planning unit vectors
(including the 6 serializer vectors), 4 real-attempt emulator vectors, 13 staged-
candidate repository emulator vectors, and 16 intake-barrier emulator vectors.

The request digest cannot be persisted inside the same request whose bytes define
that digest without creating a circular value. This cut therefore keeps measurement
in memory and records immutable outcome evidence as a separate pending protocol. It
also corrected the inverse manifest so a predecessor before-image exists only when
activation actually mutates that helper; a semantic read guard alone no longer
creates an unbudgeted restore.

Before exact domain materialization, HU-082 still must freeze the public-shift
assignment/completion codec, the backend mutation marker and activation terminal
lifecycle, and the persisted before-image/recovery envelope. Forward/inverse payloads,
complete live read-set revalidation, publication/recovery CAS, and outcome evidence
remain fail-closed. No trigger, deployment, public shift, Sheet, notification, mobile,
IAM, Rules, shared Firebase, or production state was changed.

## Local implementation checkpoint — publication/recovery codecs (2026-08-25)

Publication codec v1 now turns one staged position into an exact flat public
shift payload while preserving the fields installed Android/iOS clients read and
using `source = app`. It adds exact planner/bundle lineage, rotation ownership,
one/three-person assignment cardinality, assignment/completion/document
revisions, UTC-midnight date and write epoch. Completion is an exact union and
incoherent helper/revision/timestamp state fails closed.

A controlled write adds `lastBackendMutation`, bound to target path,
marker-free payload digest, document revision, operation intent, bundle and
epoch. Exact current-payload validation is required only when the marker changed
in that event. A later ordinary edit may retain historical provenance and is not
silenced merely because the old payload digest is stale.

The same atomic activation is specified to create an immutable backend terminal
with `operationKind = activation`, `state = committed`, ordered public mutation
bindings, and contiguous before-image references. Before-images use tagged codec
`firestore-value-v1`, preserve the supported Firestore value subset losslessly,
bind target update-time plus capture/payload/envelope digests, and reject
sentinels, references, custom/lossy structures, cycles, accessors, symbols,
sparse/extraneous properties and tampering.

Node 22 validation passes Functions lint/build, 6 focused codec vectors, and the
157-vector planning unit suite. This cut remains pure: it does not run an
activation/recovery transaction, write public shifts, persist attempt outcome
evidence, open transport, deploy, or change shared Firebase/Sheets/production.
The next cut can now materialize exact forward mutations and recheck the complete
live snapshot inside the real transaction-attempt adapter.

## Local implementation checkpoint — exact forward materializer (2026-08-26)

The local forward materializer now accepts only an activate result whose complete
live recomputation reproduces the immutable staged bundle, candidate, and
position-set artifact. It rejects lineage, expected-state, measurement-authority,
read-set, manifest, budget, inverse-create, or update-time drift before adding a
mutation. Non-zero credit transitions remain closed until HU-084.

One exact ordered set now contains every flat public create, the guarded
predecessor-helper update when required, both rotation/cursor and sealed-release-
lease transitions, active maintenance state, completed request lifecycle, two
pending Sheets commands, held notification intents, contiguous before-images,
and the immutable activation terminal. Public creates/updates receive their
changed backend marker; every update uses the `lastUpdateTime` read by that
transaction attempt. The set must equal both the forward structural budget and
the inverse manifest's recoverable creates.

The materializer passes those mutations to the pinned real-attempt adapter. A
Firestore-emulator vector proves that the same measured and sealed SDK-owned
batch commits atomically, including the terminal, completed request, and public
documents. Node 22 validation passes Functions lint/build, 4/4 pure focused
vectors, 5/5 emulator focused vectors, and 161/161 non-emulator planning unit
vectors; the ordinary lane skips the one emulator-only vector.

This remains an unwired local seam: `index.ts` does not invoke it, the runtime
repository does not yet reread/recompute every fairness input within each retry,
and there was no shared/public Firebase write or deployment. Exact inverse
materialization, non-circular persisted attempt outcome evidence, governed clone
rehearsal, production CAS, and activation remain pending.

## Local implementation checkpoint — exact inverse materializer (2026-08-26)

The local inverse materializer now accepts only a persisted bundle whose inverse
manifest and structural budget re-digest exactly. It revalidates the immutable
activation tombstone, completed request, contiguous before-images, unchanged
activation-created documents, exact active bundle/write-epoch CAS, and both
sealed release leases before constructing a mutation.

One ordered inverse set deletes only the still-bound public shifts, sync commands,
and held intents. It restores authoritative state and any guarded predecessor
from before-images with transaction-read `lastUpdateTime` preconditions. The
prior business lineage returns, both release leases clear, and maintenance epoch
plus aggregate revisions advance monotonically. Exact replacement rewrites
retained top-level values and explicitly deletes after-only fields. The activation
tombstone becomes a digest-bound recovery tombstone; immutable before-images and
the completed historical request remain available for audit.

The pinned real-attempt adapter measures and seals this exact inverse batch. Pure
vectors cover budgets, replacement, and drift rejection; a Firestore-emulator
vector proves atomic delete, restore, higher epoch, tombstone replacement, and
before-image retention. Node 22 Functions lint/build, 3/3 pure focused vectors,
4/4 emulator vectors, and 164/164 non-emulator planning vectors pass; the normal
lane skips both emulator-only vectors. The seam remains disconnected from
`index.ts`; persisted non-circular outcome evidence, repository/runtime CAS
wiring, rehearsal, deployment, and live activation/recovery remain pending.

## Local implementation checkpoint — non-circular attempt outcomes (2026-08-26)

The local outcome contract now creates immutable backend-only evidence only
after a measured forward or inverse Firestore transaction returns successfully.
Direction plus the exact commit-request digest derive the stable attempt key. The
record binds operation intent, bundle, write epoch, direction-specific manifest,
the complete measurement, a post-return timestamp, and rederived measurement and
outcome digests. It persists neither the opaque transaction token nor a stronger
transport acknowledgement claim.

The Firestore repository creates a new outcome without overwrite in a separate
transaction and first validates the authorizing activation or recovery terminal.
An exact retry converges on the same immutable document, conflicting evidence
fails closed, and an independent read-back revalidates the result. A previously
retained forward outcome remains valid historical evidence after a later
recovery replaces the parent terminal; only new evidence depends on its current
state.

Node 22 Functions lint/build, 3/3 pure focused vectors, 4/4 focused
Firestore-emulator vectors, and 167/167 non-emulator planning vectors pass; the
ordinary lane skips three emulator-only vectors. No shared/public write, runtime
wiring, transport, deployment, or live activation/recovery occurred. The next
cut is the runtime repository and orchestration that rereads each retry's
authoritative inputs, executes the forward/recovery CAS, and records this
post-return outcome.

## Local implementation checkpoint — forward/inverse CAS runtime (2026-08-26)

The local Firestore CAS runtime now owns retry-scoped forward activation and
inverse recovery execution. It invokes the supplied resolver inside every SDK
transaction callback, hands that callback's read-set to the real materializer,
and persists a post-return outcome only for the attempt `runTransaction`
actually committed. The trusted clock is sampled independently per attempt and
again only after the successful return.

Before mutation, the runtime reads at most the two expected directional outcomes
under the operation. An exact retained outcome returns as a terminal replay
without invoking the resolver or opening another CAS. A committed activation or
recovery terminal with no matching outcome fails closed instead of risking a
duplicate publication or restoration after acknowledgement loss. Recovery also
requires the current parent to remain the exact activation terminal and binds
the returned inverse attempt back to that parent identity.

Node 22 Functions lint/build, 2/2 pure focused vectors, 5/5 focused CAS
Firestore-emulator vectors, 4/4 outcome-repository emulator regressions, and
169/169 non-emulator planning vectors pass; the ordinary lane skips six
emulator-only vectors. No shared/public Firebase write, `index.ts` routing,
transport, deployment, or live activation/recovery occurred. The next cut is the
concrete transaction-scoped resolver for roster, membership,
configuration/policy/calendar, overrides, workbook partitions, persisted staged
artifacts, and authoritative state, followed by v2 request/recovery routing.

## Local implementation checkpoint — transaction-scoped source resolver (2026-08-26)

The backend now seals the complete live input boundary at
`shiftPlanningState/fairness`. Its schema-v1 revision/digest covers the normalized
membership/roster, rotation, configuration/policy/calendar, override, disabled
credit-ledger, workbook-partition, measurement-authority, migration-baseline,
planning-boundary, occupancy, and write-limit inputs.

Every forward retry reloads that envelope together with the exact activate
request, immutable bundle, staged candidate/positions, authoritative state and
rotations, and every before-image target before recomputing the live bundle. The
inverse resolver reloads the activation tombstone, immutable bundle, completed
request, complete before-image collection, and every current delete/restore
target. Neither resolver writes before the real measured materializer owns the
transaction.

Node 22 Functions lint/build, 170/170 non-emulator planning vectors with seven
emulator-only skips, 2/2 source-resolver, 5/5 CAS-runtime, and 4/4
outcome-repository Firestore-emulator vectors pass. The end-to-end resolver
vector proves a valid membership source drift rejects the staged binding with
zero public writes, then proves exact activation and higher-epoch recovery
through the real CAS runtime. No
shared/public Firebase write, `index.ts` routing, transport, deployment, or live
activation/recovery occurred. The next cut is the governed producer that rebuilds
the live envelope from real sources plus v2 request/recovery routing while the
legacy production trigger remains active.

## Local implementation checkpoint — governed live-source producer (2026-08-26)

The backend now transactionally rebuilds `shiftPlanningState/fairness` from
bounded canonical sources: all member eligibility projections, device
destination projections only for currently eligible members, `config/global`,
`deliveryCalendar`, maintenance, both rotations, and the exact backend-owned
`shiftPlanningState/sourcePolicy`. Authentication-only member metadata is
excluded; raw notification credentials are hashed and never copied into the
derived envelope. Stable full digests plus numeric per-member revisions capture
membership, eligibility, destination deletion/change, calendar, config, policy,
rotation, workbook, and migration-baseline drift.

The producer creates or replaces the envelope only after the complete source
read-set validates. Exact replay performs no write, and malformed or over-limit
sources leave the preceding valid envelope unchanged. Firestore-emulator vectors
prove create/replay, auth-only invariance, destination drift, and atomic
fail-closed preservation. The producer remains local and disconnected from
`index.ts`; the next cut must recompute the same sources inside the activation
CAS before request/recovery routing is enabled. No shared/public Firebase write,
transport, deployment, or live activation/recovery occurred.

## Local implementation checkpoint — same-CAS source recheck (2026-08-26)

The concrete forward resolver now requires an explicit live-source rebuilder;
there is no default path that can authorize activation from the cached
`shiftPlanningState/fairness` envelope alone. The governed factory supplies the
real transactional producer, which rereads bounded users, eligible-member
devices, config, calendar, policy, maintenance, and both rotations during every
Firestore retry and requires its digest to equal the persisted envelope before
bundle recomputation or materialization.

The focused emulator proves that changing a notification destination after
stage, without refreshing `fairness`, fails inside the activation transaction
with zero public shifts and leaves the cached envelope untouched. The existing
resolver regression still proves exact activation and higher-epoch recovery.
Node 22 Functions lint/build, 3/3 governed-source and 2/2 source-resolver
Firestore-emulator vectors pass. No shared/public Firebase write, `index.ts`
routing, transport, deployment, or live activation/recovery occurred. The next
cut is the v2 request/recovery runtime routing while the legacy production
trigger remains active.

## Local implementation checkpoint — v2 request runtime routing (2026-08-26)

The local Firestore trigger now classifies request schema before invoking any
legacy parser. Unversioned documents retain the existing delivery/market handler;
every declared schema-v2 document is isolated from that writer, and an unknown
declared version fails closed. Preview and stage enter the persisted private
lifecycle, while activate enters the governed retry-scoped CAS directly so an
exact committed replay does not depend on a stale preflight outside the
transaction.

One canonical serializer now converts normalized request timestamps back to the
exact Firestore wire contract. The same adapter also passes only the persisted
preview receipt—not its repository envelope—back to the deterministic stage
planner. These two real integration mismatches were exposed by the new emulator
path rather than hidden behind lifecycle test doubles.

The governed runtime composes inverse recovery but does not export an endpoint.
Recovery remains blocked on the separate IAM-only boundary and its exact
maintenance allowlist; deterministic activation-failure terminalization also
remains pending. Node 22 Functions lint/build, 183 planning vectors with ten
emulator-only skips, 3/3 governed-runtime producer vectors, and 2/2 source-resolver
plus 13/13 persistence-repository emulator vectors pass. The emulator proves
preview and stage remain private,
stale source drift writes zero public shifts, activation and replay converge, and
inverse recovery removes the activated projection. No shared Firebase write,
transport, endpoint export, deployment, or live activation occurred.

## Local implementation checkpoint — allowlisted recovery executor (2026-08-26)

The inverse port now has a distinct local operator executor. Its strict command
contains only environment, activation/recovery IDs, and one authorization digest.
The backend-only authorization is nested below the activation operation and seals
the exact bundle revision/digest, activation terminal intent, bounded validity
window, and complete closed maintenance revision/epoch/active-lineage binding.
The executor reads it before entry and again inside every Firestore retry, so
expiry, tampering, revocation/replacement, or maintenance drift fails before any
inverse mutation. Exact recovery and replay converge through the same boundary.

Node 22 Functions lint/build, 186 planning vectors with eleven emulator-only
skips, 2/2 focused authorization vectors, and 3/3 governed activation/recovery
Firestore-emulator vectors pass.

The local HTTP recovery Function is now exported only for the exact future
`reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com` invoker. Its
adapter accepts only POST with the exact body and no query parameters, returns a
minimal correlated acknowledgement, and records sanitized accepted/completed/
rejected/unknown audit events without request bodies, authorization digests,
member data, or internal diagnostics. It deliberately does not select a Function
runtime service account.

Node 22 Functions lint/build, 193 planning vectors with eleven emulator-only
skips, 7/7 focused HTTP boundary vectors, and 3/3 governed activation/recovery
Firestore-emulator vectors pass.

HU-085 still owns provisioning the named operator, granting and reading back its
exact endpoint-only invocation, and proving IAM denial for mobile/admin principals
plus absence of direct Firestore/Sheets, impersonation, and token-minting roles.
Nothing is deployed or activated in a shared Firebase project.

## Local implementation checkpoint — sync command lifecycle (2026-08-27)

Activation sync commands are now explicitly versioned and parsed as exact
`pending`, `processing`, or `completed` documents. The mutable lifecycle retains
an immutable `commandDigest`; processing owns one worker/attempt/fencing lease,
and completion replaces that live claim with exact timestamped workbook-revision
and partition-digest read-back evidence.

The Firestore repository discovers pending and expired work through bounded
polling, transactionally claims or takes over with a higher partition epoch,
rechecks active lineage and exact workbook partition immediately before I/O, and
clears the lease only after another transactional read-back completion. A stale
worker cannot authorize or complete. Exceptions leave the lease retained rather
than claiming that an external result is known. The SDK-free executor proves a
lost completion is rediscovered and converges through an idempotent fake consumer;
HU-083 still owns real multi-season Sheets I/O and durable ambiguous-attempt
reconciliation.

Node 22 Functions lint/build, 196 planning vectors with eleven emulator-only
skips, 3/3 focused sync-codec vectors, 5/5 sync-repository and 3/3 governed
activation/recovery Firestore-emulator vectors pass. No shared Firebase/Sheets
write, trigger export, deployment, or live sync occurred.

## Local implementation checkpoint — public event classifier (2026-08-27)

The SDK-free candidate consumer contract now distinguishes controlled public
shift events from ordinary later edits. Activation and repair/sync-correction
creates/updates no-op only when `lastBackendMutation` changed in that event and
matches the exact operation registry, public payload/revision, bundle, epoch,
target, and intent. A recovery delete additionally matches the exact activation
before-document and inverse deletion manifest. Retained historical markers keep
ordinary edits/deletes active; removed, missing, forged, or unsupported changed
authority fails closed.

Each controlled decision carries a stable `eventDigest`. Five focused fake-
consumer vectors prove activation create/update and replay, repair, sync
correction, recovery delete, ordinary retained-marker behavior, and tamper/missing-
registry rejection without real export or notification. HU-083 still owns wiring
the real trigger and durable terminal/event-ledger retention. No `index.ts`
trigger, shared Firebase/Sheets state, deployment, or live data changed.

Node 22 Functions lint/build, 5/5 focused fake-consumer vectors, and 201 planning
vectors with eleven emulator-only skips pass.

## Local implementation checkpoint — public event retention (2026-08-27)

The SDK-free producer contract now freezes a digest-bound maximum end-to-end
delivery/retry horizon plus positive safety margin. Every controlled terminal has
an immutable operation-retention binding and exclusive `retainUntil`; controlled
no-ops create a stable ledger by classifier `eventDigest`, while an invalid,
missing, or expired changed-marker authority creates one alertable rejected-event
intent and keeps legacy per-row export/notification blocked.

Cleanup fixtures protect the operation terminal, retention binding, and all bound
event ledgers before and at the exact expiry instant, and make them eligible only
after it. Deterministic backend-only paths are frozen under
`shiftPlanningPublicEventLedgers`. HU-083 owns create-or-exact-replay Firestore
persistence, real `onShiftWritten` and alert wiring, and integrated Sheets/
notification evidence. No `index.ts`, trigger, deployment, or live state changed.

Node 22 Functions lint/build, 5/5 focused retention vectors, and 206 planning
vectors with eleven emulator-only skips pass.

## Local implementation checkpoint — mobile v2 read-back (2026-08-28)

Android and iOS now observe the latest schema-v2 planning request only while the
current session and environment still belong to an authorized admin. Both clients
decode the exact delivery/market terminal summary, expose only stable failure
metadata, load the referenced staged-candidate header and position set with exact
lineage/count validation, and keep those rows out of the normal member shifts feed.
Cancellation and publication are fenced across logout, demotion, impersonation,
user change, and environment change. A completed activation triggers one existing
server-shifts refresh per request before the admin state reports completion.

Android uses a Firestore listener and iOS uses bounded two-second polling so no
non-Sendable Firebase listener registration crosses the Swift 6 actor boundary.
The existing legacy request actions remain unchanged: the mobile v2 writer still
depends on backend-only epoch/revision preconditions and belongs to a later cut.

Android unit tests, lint, and 23 connected tests pass. On iPhone 17 with iOS 26.5,
the five focused iOS tests, `fast-unit`, `ui-smoke`, and the canonical
`release-gate` pass; the release gate reports 864 tests, with 863 passed, one
skipped, and zero failures, while SwiftLint 0.61.0 reports zero violations in 465
files. The staged-candidate read also keeps its non-Sendable Firestore payload
behind a `Mutex` synchronization owner before the nested callback; focused file
diagnostics and the exact simulator build report zero project warnings. No
Firebase/Sheets write, deploy, or production activation occurred.

## Local implementation checkpoint — generic notification discriminator (2026-08-28)

The canonical planning event and immutable per-user inbox copy now carry one
all-or-none schema-v1 backend discriminator. It retains only the stable event
reference and the existing generic `shift_updated` title/body; no shift ID,
member name, date, assignment, or other rich detail enters either consumable
artifact. Strict Rules prevent an admin/client notification create from reserving
the discriminator.

Android and iOS decode the exact versioned form into an authorized-detail-fetch
Domain policy, fail closed for partial metadata or rich planning copy, and retain
the embedded-content behavior of unversioned legacy notifications. Fetching fresh
authorized detail on event open and invalidating any ephemeral detail across
logout, demotion, environment, assignment, offline, or denied states remains a
separate cut. No Function/Rules deployment, FCM submission, shared Firebase write,
or production mutation occurred.

## Local implementation checkpoint — authorized notification detail (2026-08-29)

The generic planning inbox row can now be opened on Android and iOS without
turning its durable copy into an authorization artifact. A new authenticated HTTP
Function accepts only the stable event ID and resolves the detail inside a
Firestore transaction. It re-reads the current auth link and active member, exact
generic inbox copy, held intent, canonical release receipt, and current schema-v2
public shift; any recipient, lineage, discriminator, release, assignment, or
document drift returns no detail.

Both clients decode an exact schema-v1 response, require the current member to be
one of the current responsible members, and render the result inline only for the
active route/session/environment. The value is deliberately ephemeral: refresh,
route exit, logout, authorization/environment replacement, denial, malformed data,
or a late obsolete completion restores the generic row. Legacy embedded
notifications remain unchanged. The rows use native semantic controls and
localized loading/detail copy.

This cut covers authenticated inbox opening. Routing an OS-opened push reference
through the same boundary remains pending, so the parent push/inbox acceptance
criterion stays open. No Function/Rules deployment, FCM submission, shared
Firestore write, Sheets access, or production activation occurred.

## Local implementation checkpoint — OS push-open routing (2026-08-29)

Android and iOS now route an OS-opened planning push into the same authenticated
detail boundary used by the inbox. Both platforms accept only the canonical
`eventId`, `shift_updated`, and `users` reference emitted by the generic transport.
The reference remains in memory only, contains no member, date, assignment, or
other rich content, and is replaced atomically when a newer push arrives.

After an authorized Home route exists, the app navigates to Notifications,
refreshes the current inbox, and opens the matching generic event through
`resolveShiftNotificationDetail`. Missing, stale, foreign, malformed, offline,
logged-out, demoted, reassigned, or cross-session results cannot publish detail.
Android handles cold and warm launcher intents; iOS handles the notification-center
response through an explicitly injected open store. The unavoidable race between
OS presentation and a later assignment change remains harmless because only the
generic copy is displayed before the fresh authorized read.

Validation passed on Android with unit tests, `lintDebug`, and 23/23 connected
tests on `Pixel_8_Pro_API_35`; iOS passed `fast-unit`, `ui-smoke`, an Xcode project
build, and zero Issue Navigator warnings on iPhone 17/iOS 26.5. No Function or
Rules deployment, FCM submission, shared Firebase write, Sheets access, or
production activation occurred. The old/current/candidate rollout matrix remains
owned by HU-085.

## Local implementation checkpoint — reciprocal swap compatibility (2026-08-29)

Generated delivery and market public documents now have explicit cross-contract
coverage against the existing reciprocal swap implementation. Delivery swaps retain
the immutable planner and rotation-owner lineage while changing only effective
assignments, and the existing helper recomputation points each uncompleted row to
the next chronological effective lead. Market swaps retain complete, distinct
three-person groups and their original fairness ownership.

The audit also confirms that held planning intents live only in the backend-owned
`shiftPlanningNotificationIntents` outbox and become consumable canonical events
only through explicit idempotent release. The installed/current/candidate consumer
and rollback matrix remains a controlled HU-085 rollout responsibility. Focused
Functions build and all eight publication-contract tests pass. No deployment,
emulator write, live Firebase mutation, Sheets access, or production activation
occurred.

## Evidence reconciliation — before-image recovery CAS (2026-08-29)

The aggregate checklist now reflects the already implemented forward/inverse
materialization contract. Forward activation persists contiguous, contract-digested
before-image envelopes in its measured atomic batch. Recovery re-reads the exact
envelope and current-target set, verifies active bundle revision/digest/write epoch,
restores or deletes only inverse-manifest paths with transaction preconditions, and
advances to the strictly newer `activationWriteEpoch + 1` without reusing an epoch.

Fresh isolated Firestore-emulator validation passed all 7 forward and 4 inverse
materializer vectors, including conflicting-create atomicity, before-image drift,
exact replacement semantics, and sealed real-adapter commits. This checkpoint only
reconciles duplicated tracking with delivered Git evidence; it performs no source
implementation change, shared Firebase write, deployment, or production activation.

## Local implementation checkpoint — shift-swap planning authority (2026-08-29)

`transitionShiftSwap` is the first ordinary writer migrated to the HU-082 planning
authority fence. When maintenance state exists, request creation captures its exact
open `stateRevision`, `writeEpoch`, active revision, and active digest. Response and
application re-read and compare that authority inside their Firestore transaction;
maintenance entry/exit or active-lineage drift rejects the stale request before any
request, shift, helper, or notification mutation. Cancellation remains available so
an owner can close obsolete work without touching shifts.

The absence of planning state remains compatible only with an equally legacy request;
once v2 state exists, an unbound old request cannot respond or apply. Contract tests
cover open capture, malformed/closed state, legacy compatibility, and every authority
drift. Functions build and 30/30 backend-security vectors plus lint pass. Android and
iOS payloads do not change and ignore the additive backend-owned request field. No
Rules/Function deployment, emulator/shared Firebase write, or production activation
occurred; the remaining writer inventory stays open.

## Local implementation checkpoint — Sheets-import planning authority (2026-08-29)

`syncShiftsFromGoogleSheets` now captures one exact open planning authority after
its read-only workbook phase and before its first Firestore mutation. Every imported
shift upsert and stale imported-shift deletion re-reads the maintenance document and
compares the captured `stateRevision`, `writeEpoch`, active revision, and active digest
inside the same transaction that already owns the notification-resource fence. Any
authority drift fails before that transaction's mutation and stops the remaining
import.

The shared authority contract also replaces the duplicate swap-specific parser while
retaining its stable public conflict. The importer remains deliberately non-atomic
across rows: already committed rows are not rolled back, and HU-083 still owns its
multi-season replacement. Functions lint/build, 30/30 backend-security/shift-swap
vectors, 255/255 executed planning-unit vectors with 40 emulator-only skips, and 9/9
focused notification-writer Firestore-emulator vectors pass. No endpoint, Function,
Rules, shared Firebase, Google Sheets, deployment, or production data changed.

## Local implementation checkpoint — legacy planner authority (2026-08-29)

The active legacy `onShiftPlanningRequestCreated` path now captures one exact open
planning authority immediately before its first external workbook mutation. Every
planned-shift upsert re-reads that authority inside the same transaction as its exact
notification-resource fence, and the final generated-shifts notification performs
the same transactional revalidation. Maintenance or active-lineage drift therefore
stops every remaining Firestore effect before mutation; the request can still record
the factual failed outcome.

The workbook call cannot join a Firestore transaction. Drift after capture can leave
an already confirmed sheet ahead of Firestore, so this compatibility cut preserves
the documented workbook-first/non-atomic limitation and HU-083 replacement gate. The
focused emulator test first failed 8/9 because the reference/transaction authority
helpers were absent, then passed 10/10 with closed-state pre-external rejection and
mid-operation drift coverage. Functions lint/build and 255/255 executed planning-unit
vectors with 41 emulator-only skips also pass. No live Sheet, shared Firebase,
Function/Rules deployment, notification delivery, or production mutation occurred.

## Local implementation checkpoint — delivery-calendar trigger authority (2026-08-29)

`onDeliveryCalendarOverrideWritten` now fences only the effects it owns. When its
event has matching delivery shifts, it captures one exact open planning authority
immediately before the first workbook mutation, revalidates it before every external
row and once after the final row, and creates the calendar notification only inside a
transaction that rechecks the same authority. Closed state prevents the first effect;
mid-operation drift stops every remaining workbook row and notification mutation.

This does not authorize the upstream calendar document. Android and iOS still write
`deliveryCalendar` directly under current Rules, so an epoch-bound backend command,
client migration, offline-queue rejection, and eventual Rules deny remain separate
mandatory cuts. Sheets also remains external and non-atomic: an already accepted row
cannot be rolled back if authority changes during its request. The focused emulator
test first failed 10/11 because direct reference revalidation was absent, then passed
11/11. Functions lint/build and 255/255 executed planning-unit vectors with 42
emulator-only skips also pass. No mobile code, Rules, live Sheet, shared Firebase,
Function deployment, notification delivery, or production data changed.

## Local implementation checkpoint — epoch-bound delivery-calendar command (2026-08-29)

The backend now exposes the exact schema-v1
`resolveDeliveryCalendarMutationContext` and
`transitionDeliveryCalendarOverride` pair for a future Android/iOS migration.
Context returns one open planning authority and the canonical current-override
digest. Mutation accepts a stable operation ID, action, ISO week, both expected
CAS values and, for upsert, only `TUE|THU|FRI`; the server derives all Madrid
calendar instants plus actor and timestamp.

One Firestore transaction revalidates the reciprocal active-admin link, exact
planning epoch/lineage, and override digest before changing the public document
and creating an immutable backend-only receipt. Exact replay converges after
later planning-state drift; operation collisions, revocation, stale authority,
or override drift write nothing. Strict and Phase 1 Rules deny all client access
to receipts.

Contract tests first failed because the module did not exist, and the Rules RED
proved the Phase 1 catch-all exposed the new collection before it was listed as
private. Functions lint/build, 4/4 contract vectors, 6/6 isolated Firestore
emulator vectors, and both focused Rules suites pass. Android/iOS still use the
legacy direct writes and current Rules deliberately retain them; client migration,
offline-queue rejection, final direct-write deny, deploy, and live validation are
separate pending cuts. No shared Firebase, Sheet, notification, deployment, or
production data changed.

## Local implementation checkpoint — mobile delivery-calendar command (2026-08-29)

Android and iOS now keep server-only Firestore reads but route every calendar
upsert/delete through the authenticated HU-082 context-plus-command boundary.
Each fresh UI intention captures the exact planning authority and current override
digest, creates one operation ID, and sends only the ISO week plus `TUE|THU|FRI`
when upserting. The backend remains the sole owner of actor, timestamp, Madrid
instants, receipt, and resulting persisted value returned to the app.

Neither production repository contains a direct Firestore mutation anymore, so a
disconnected/stale client cannot enqueue the former local write. Authority or
override conflict is surfaced after the single command attempt; the clients do not
silently obtain a newer context and replay an obsolete intention. Android unit and
lint gates pass, iOS compiles without warnings, all four focused command/source
tests pass, and the iOS fast-unit lane passes on iPhone 17 / iOS 26.5.

This does not yet close the legacy surface: both Rules candidates deliberately
continue to admit direct calendar writes until the next cut proves their denial
against old clients. No Rules/Function deployment, shared Firebase write, live
Sheet access, notification delivery, or production mutation occurred.

## Local implementation checkpoint — delivery-calendar Rules deny (2026-08-29)

Both local Rules candidates now close the legacy direct calendar surface without
changing its read contract. Strict Rules retain reads for active members and Phase 1
retains reads for signed-in users, while create, update, and delete are denied for
every mobile/admin credential in `develop` and `production`. The Phase 1 catch-all
explicitly excludes `deliveryCalendar`, so it cannot shadow the collection-specific
deny. The compiled writer inventory now identifies the two server-only Rules paths
and carries the corresponding new canonical digest.

The focused RED runs failed exactly on the still-admitted direct writes: strict
passed 27/29 and Phase 1 passed 5/6. After the Rules change, strict passes 29/29 and
Phase 1 passes 6/6, including old direct creates and stale/offline-style updates and
deletes. The Admin SDK calendar command remains green 6/6; the inventory/intake
barrier passes 35/35, and Functions lint/build pass.

This is local repository and emulator evidence only. No Rules or Function was
deployed, no shared Firebase or Sheet data changed, and no production activation or
live read-back occurred. Direct `shifts` writers and the remaining inventory still
keep HU-082 open; deployment belongs to the held no-gap procedure.

## Local implementation checkpoint — direct shift client closure (2026-08-29)

Android and iOS no longer expose the unused shift-upsert capability through their
Domain repository contract, Firestore adapter, chained/in-memory implementations,
or test doubles. Production had no caller for that operation: planning, Sheets
compatibility, reciprocal swaps, completion, repair, and recovery already mutate
shifts through authenticated backend workflows. The clients remain server-read-only,
and the historical `source = app` value remains a decoding compatibility contract,
not mobile write authority.

Both local Rules candidates now retain their intended shift reads while denying
every direct create, update, and delete in `develop` and `production`; the Phase 1
catch-all explicitly excludes `shifts`. RED passed 28/30 in strict and 6/7 in Phase 1
because old admin/authenticated writes still succeeded. GREEN passes 30/30 and 7/7.
The compiled affected-writer inventory now records the two server-only Rules paths
and carries its resulting canonical digest.

Android unit tests and lint pass. Xcode builds the intended project with zero
warnings, and the repository fast-unit lane passes on iPhone 17 / iOS 26.5. Functions
lint/build, the full local planning-unit suite, the 35/35 intake-barrier vectors,
and 11/11 backend shift-writer emulator vectors pass. The independent iOS
Domain/Data/concurrency review reports no findings. No Rules or Function was
deployed, no shared Firebase or Sheet data changed, and no production activation or
live read-back occurred. Shift export, independent admin/server authority, and the
remaining inventory keep HU-082 open.

## Local implementation checkpoint — bulk shift-export authority (2026-08-29)

The authenticated `exportShiftsToGoogleSheets` compatibility endpoint now performs
all Firestore, member, configuration, and Sheets-client setup reads before capturing
one exact open planning authority. Every delivery or market `update`/`append` then
revalidates the same state revision, write epoch, active revision, and active digest
immediately before the external mutation. A final revalidation detects authority
drift that occurred while the last Sheets request was in flight.

Closed maintenance prevents the first row and mid-export drift stops every remaining
row with the stable `shift_export_planning_authority_changed` conflict. Google Sheets
cannot participate in the Firestore transaction, so already accepted rows are not
rolled back; ingress still must be disabled before causal capture and HU-083 still
owns the atomic command/lease replacement.

The focused unit RED failed because the external-writer fence module did not exist.
Functions lint/build, 3/3 pure fence vectors, the full planning unit lane, the
intake-barrier inventory vectors, and 12/12 focused Firestore-emulator writer-fence
vectors pass without Google Sheets access. No endpoint or Function was deployed, and
no shared Firebase, workbook, notification, or production data changed.

## Local implementation checkpoint — legacy shift-trigger authority (2026-08-29)

The compatibility `onShiftWritten` path now captures one exact open planning
authority after its read-only setup. Its Sheets `update`/`append` revalidates that
authority immediately before mutation and once more after the request. Only then may
one Firestore transaction write `syncMeta` and create the existing generic shift
notification; that transaction revalidates the same planning authority, reads the
exact shift notification fence, and rejects source-shift drift.

Closed maintenance blocks the first workbook effect. Drift during Sheets prevents
all Firestore effects, while drift or an active notification lease after Sheets
prevents both `syncMeta` and notification atomically. An already accepted workbook
row remains non-transactional and cannot be rolled back.

This is a legacy-writer compatibility guard only. It does not connect the governed
public-event classifier, operation registry, idempotent ledger, or controlled-event
suppression assigned to HU-083. The trigger-source RED failed on the unfenced flow,
and the inventory RED rejected its prior digest. Functions lint/build, 4/4 focused
external-writer vectors, 263/263 executed planning-unit vectors with 43 emulator-only
skips, and 12/12 focused Firestore-emulator writer-fence vectors pass. No live Sheet,
shared Firebase, notification delivery, Function deployment, or production mutation
occurred.

## Local implementation checkpoint — direct shift-swap closure (2026-08-29)

The Phase 1 Rules candidate now closes its residual direct
`shiftSwapRequests` mutation surface. Authenticated users retain the existing read
contract needed by Android and iOS, while create, update, and delete fail for every
client credential in both environments. The catch-all explicitly excludes the
collection, matching the already server-only strict candidate.

Both production clients were rechecked: they read Firestore from the server but route
create, respond, cancel, and apply through the authenticated `transitionShiftSwap`
endpoint, so no mobile mutation migration is required. The endpoint keeps its
previous epoch/lineage and notification-resource fences.

The Phase 1 RED passed 7/8 because the direct create still succeeded, then passed 8/8
after the collection-specific deny. Functions lint/build, 263/263 executed
planning-unit vectors with 43 emulator-only skips, 8/8 Phase 1 Rules vectors, 31/31
strict Rules vectors, and 30/30 backend-security/shift-swap vectors pass locally. No
Rules or Function was deployed, and no shared Firebase, notification, or production
data changed.

## Local implementation checkpoint — planning-request authority audit (2026-08-29)

The affected-writer inventory no longer claims that Phase 1 admits planning
requests through its authenticated catch-all. Its private planning partition already
denies every client read and write to `shiftPlanningRequests`, whereas strict Rules
allow only active linked admins to create the exact v2 schema and read its result.

Android and iOS still submit the legacy four-field, single-type request directly.
That payload is incompatible with strict Rules and cannot safely be upgraded by
inventing `expectedWriteEpoch` or `expectedActiveRevision`: the authoritative state
is backend-only. The next implementation boundary must expose those values through
an authenticated admin context, then migrate both clients to the exact combined
delivery-and-market v2 request. Only after that migration may the no-gap activation
temporarily deny new creates and drain the accepted causal set.

The inventory regression first failed 23/24 on the stale Phase 1 source reference.
Functions lint/build, 263/263 executed planning-unit vectors with 43 emulator-only
skips, 8/8 Phase 1 Rules vectors, and 31/31 strict Rules vectors pass after the
correction. This checkpoint changes no Rules, mobile runtime, Function export,
shared Firebase, Google Sheet, notification delivery, deployment, or production
data.

## Local implementation checkpoint — planning-request context (2026-08-29)

`resolveShiftPlanningRequestContext` now provides the missing authenticated bridge
from backend-only maintenance state to a future mobile v2 request. It accepts only
an exact schema-v1 `POST` body with `environment`, rejects query parameters and
malformed bodies before authentication or Firestore, and requires the existing
reciprocal active-admin authorization for that exact environment.

The repository reads only `shiftPlanningState/current`. Open valid state is projected
to `expectedWriteEpoch` and `expectedActiveRevision`; state revision, active digest,
barrier evidence, roster, and member data remain private. Missing, invalid, or closed
state fails closed, and the operation performs no mutation. Android and iOS remain
unchanged in this cut and still require a later symmetric migration from their
legacy single-type request to the combined v2 contract.

The contract RED failed because the module did not exist. Functions lint/build,
4/4 focused contract/authorization-order vectors, 2/2 isolated Firestore-emulator
vectors, 267/267 executed planning-unit vectors with 43 emulator-only skips, and
30/30 backend-security vectors pass locally. No Function or Rules deployment,
shared Firebase read/write, Google Sheet access, notification delivery, or
production mutation occurred.

## Local implementation checkpoint — mobile combined preview ingress (2026-08-29)

Android and iOS now replace the legacy single-type planning submission with one
explicit combined delivery-and-market schema-v2 `preview` request. An authorized
admin enters both target season start years; each client resolves the minimal private
context immediately before its Firestore transaction, binds the request to that write
epoch and active revision, and creates or acknowledges only the same stable request
and bundle intent. Ambiguous retry keeps the original identity and timestamp instead
of silently rebasing the operation.

Both clients emit the exact twelve-field strict-Rules payload, keep `binding = null`
for preview, reject malformed context and incompatible persisted documents, and
continue observing backend-owned processing/result state. The response decoder is
exact on both platforms, so an accidental extra private field fails closed. The UI
describes this as a private preview and grants no stage or activate control.

Android unit tests and lint pass. The connected suite built but executed zero tests
because the attached physical device rejected installation with
`INSTALL_FAILED_USER_RESTRICTED`. iOS focused repository/context/presentation tests
plus `fast-unit` and `ui-smoke` pass on iPhone 17 / iOS 26.5; the smoke run emitted
non-fatal LLDB debugger-store warnings. No Rules or Function was deployed, and no
shared Firebase, Google Sheet, notification, or production data changed.

## Local implementation checkpoint — mobile completed-preview staging (2026-08-29)

Android and iOS now let an authorized admin submit a schema-v2 `stage` request only
from that same admin's latest completed preview. The stage keeps both target seasons
and binds the exact source request ID, bundle revision, and bundle digest reported by
the immutable preview receipt. It receives a new request identity and timestamp;
changed, foreign, malformed, or self-referential lineage fails closed instead of
silently regenerating or rebasing the candidate.

Both transactional request codecs emit the exact strict-Rules `mode = stage` payload
and require a matching persisted acknowledgement before treating a replay as success.
The Settings flow presents staging as preparation of a private immutable candidate,
not activation: it does not publish shifts, change the active schedule, write Sheets,
or release notifications. Candidate inspection remains admin-only and outside normal
member feeds.

Android unit tests and lint pass. The connected suite again built but executed zero
tests because the attached physical device rejected installation with
`INSTALL_FAILED_USER_RESTRICTED`. On iPhone 17 / iOS 26.5, the focused repository and
presentation tests, Xcode build, `fast-unit`, and `ui-smoke` pass; the smoke run emitted
non-fatal LLDB debugger-version-store warnings. No Rules or Function was deployed,
and no shared Firebase, Google Sheet, notification, or production data changed.

## Local implementation checkpoint — post-stage fairness drift (2026-08-29)

Activation now distinguishes a stale governed planning source from a malformed
transaction. If live fairness inputs cannot exactly reproduce the source sealed by
the staged candidate, the request terminalizes with the existing stable
`fairness_input_drift` code before any public mutation. Invalid governed-source
shapes at this boundary, including enabling the still-unsupported credit ledger,
receive the same deterministic classification; transport and unrelated
infrastructure failures remain retryable rather than becoming business terminals.

The Firestore-emulator matrix changes, one at a time after stage, an eligible
destination, active membership, real-producer/common-purchase-manager eligibility,
the delivery weekday, a calendar override and the credit policy. Every case writes
zero public shifts, leaves the active revision null, retains the prior cached source,
and replays the exact failed terminal. An `authUid`-only change remains deliberately
outside the fairness digest.

Functions lint/build, 267/267 executed planning-unit vectors with 43 emulator-only
skips, 3/3 governed-source emulator vectors and 2/2 source-resolver emulator vectors
pass. No Function or Rules was deployed, and no shared Firebase, workbook,
notification or production data changed.

## Local implementation checkpoint — client activation deny (2026-08-29)

Strict Firestore Rules no longer let an authenticated administrator create a
schema-v2 `mode = activate` planning request. Mobile credentials retain only the
exact combined `preview` and immutable completed-preview `stage` create contracts,
plus the existing admin read access. Client updates and deletes remain denied.
Backend activation is unchanged and continues through Admin SDK authority and the
separate governed runtime/operator boundary.

The focused Rules RED passed 30/31 because an otherwise exact admin activation
request still succeeded. GREEN passes 31/31 while preserving valid preview/stage
creates and rejecting malformed bindings. The Phase 1 candidate continues to deny
the entire private request partition and is unchanged.

This is local Rules/emulator evidence only. No Rules or Function was deployed, and
no shared Firebase, workbook, notification, mobile release or production data
changed.

## Local implementation checkpoint — sanitized operational logs (2026-08-29)

The planning Firestore trigger now routes v2 and legacy operational events through
one schema-v1 allowlist. Routed, rejected, failed, and legacy completion records keep
only environment, stable result/failure fields, non-sensitive counts where relevant,
and a deterministic one-way request correlation fingerprint. The logging adapter
never forwards raw request IDs, member fields, sheet names, planning digests,
exception objects, or internal diagnostic messages.

The focused RED failed because the logging boundary did not yet exist. GREEN passes
3/3 contract vectors, including known and unknown failure sanitization, stable retry
correlation, and exact-key assertions for sensitive-field absence. Functions
lint/build and the complete planning-unit suite pass with 270/270 executed vectors
and 43 emulator-only skips.

This is local Functions evidence only. No Function or Rules was deployed, and no
shared Firebase, workbook, notification, mobile release or production data changed.

## Local implementation checkpoint — recovery retry identity (2026-08-29)

Inverse recovery terminal replay now requires the same `recoveryOperationId` that
produced the committed recovery. A late retry with another recovery identity fails
closed instead of receiving an acknowledgement belonging to the earlier operation.
The runtime still performs no second CAS once a valid directional outcome exists.

The focused emulator RED passed 5/6 because the foreign recovery identity incorrectly
received a terminal replay. GREEN passes 7/7, additionally proving that committed
activation and recovery terminals missing their post-return directional outcome both
block another CAS. The authoritative-state emulator passes 20/20 and now explicitly
proves a pre-activation abort cannot reopen maintenance from a stale active lineage.
Functions lint/build and the complete planning-unit lane pass with 270/270 executed
vectors and 44 emulator-only skips.

This closes the local runtime identity gap, not the live crash-injection gate. The
real no-gap controls, deployed runtime and controlled failure/read-back matrix remain
part of HU-085. No Function or Rules was deployed, and no shared Firebase, workbook,
notification, mobile release or production data changed.

## Local implementation checkpoint — stage ownership Rules (2026-08-29)

Strict Rules now require every client-created `stage` request to bind one existing
backend-completed preview owned by the same authenticated administrator. The source
request, terminal summary and preview receipt must agree on request identity, bundle
ID, revision, digest, environment and owner. Pending, missing, foreign, or drifted
preview sources are rejected before they can enter the backend lifecycle.

The focused Rules RED passed 30/31 because a stage bound to a still-pending preview
was accepted. GREEN passes 31/31 and retains valid preview creation plus an exact
owned-completed-preview stage. Explicit coverage also denies client reads or writes
of operation outcomes, before-images and recovery authorizations; request updates and
deletes remain denied, so clients cannot manufacture terminal success. Functions
lint/build, the general strict Rules suite (6/6), and Phase 1 compatibility (8/8)
also pass.

This is local Rules/emulator evidence only. No Rules or Function was deployed, and
no shared Firebase, workbook, notification, mobile release or production data
changed.

## Local implementation checkpoint — mobile season-boundary projection (2026-08-29)

Android and iOS now carry the same observable acceptance scenario across the official
September season boundary. An intentionally unordered feed from 26 August through
19 September must remain chronologically projected, derive the August helper from the
following September lead, select the first September delivery on the board, and retain
the member's September market assignment. The test executes the production Android
projection helpers and the production iOS `ShiftsFeatureViewModel`; its expected IDs
and roles come from the accepted continuous-rotation contract rather than either
implementation.

The focused Android test, complete Android unit/lint gates, and the complete iOS
`fast-unit-v1` lane pass on iPhone 17 / iOS 26.5. Candidate revision/digest models,
exact staged-candidate repository reads, and admin-only Rules evidence were also
re-audited on both platforms, allowing their stale implementation tasks to close
without changing production code. No shared Firebase, workbook, notification, mobile
release or production data changed.

## Local implementation checkpoint — governed activation read-back (2026-08-29)

One Firestore-emulator scenario now drives the real governed runtime through
`preview -> stage -> activate` from a produced live-source envelope. Preview and stage
leave the flat `shifts` collection empty. Activation then completes the exact request,
advances maintenance plus both rotation aggregates to the same bundle revision/digest,
and publishes the complete delivery-plus-market set with the installed-client contract:
`source = app`, additive planner provenance, the activation write epoch, and `planned`
status.

The same read-back proves that every planned notification intent remains `held` and no
public notification is released prematurely. Replaying the activation returns its exact
terminal outcome without changing the public count or any maintenance/delivery/market
state revision. Functions lint/build, 270/270 executed planning-unit vectors with 45
emulator-only skips, and the focused source-producer Firestore-emulator lane (4/4)
pass.

Canonical event/inbox release and Android/iOS observation without restart remain open;
this checkpoint does not claim those later gates. No shared Firebase, workbook,
notification, mobile release or production data changed.

## Local implementation checkpoint — canonical notification release (2026-08-29)

The real Firestore-emulator acceptance chain now continues beyond governed activation.
It claims and completes both generated Sheets-sync commands through the production
repository, using deterministic local workbook read-back evidence rather than accessing
Google Sheets. Only after both partitions are terminal does it release every held
notification intent and read back the corresponding canonical event, member inbox
entry, and backend receipt.

The read-back proves that public event and inbox documents retain only the generic
`shift_updated` discriminator and copy: no shift ID/type, bundle revision/digest,
write epoch, assignment list, or date is exposed there. Releasing the first intent
again replays the exact artifacts without increasing the event count, and every
dispatch-attempt collection remains empty, so this cut performs no FCM transport.
Functions build and the focused source-producer Firestore-emulator lane (4/4) pass.

Android/iOS live observation without restart, stale-cache authorization coverage, and
the separately governed FCM dispatch lifecycle remain open. No shared Firebase,
workbook, notification, mobile release or production data changed.

## Local implementation checkpoint — mobile activation refresh (2026-08-29)

Android and iOS now prove the same observable activation-completion behavior. Each
test keeps one authorized admin session and its production presentation owner alive,
starts with the pre-activation delivery board, emits one completed activation, and
requires the same instance to replace the board and recompute both the next delivery
and next market assignment. Re-emitting the same terminal request performs no extra
read. The oracle is an independent before/after assignment sequence rather than a
model or decoder round-trip.

The production Firestore shift repositories remain explicit server-only read-backs
(`Source.SERVER` on Android and `.server` on iOS). The focused Android test, complete
Android unit/lint gates, focused Xcode test (1/1), and the complete iOS `fast-unit-v1`
lane pass on iPhone 17 / iOS 26.5 with SwiftLint enabled. The iOS acceptance lives in
its own small suite so existing file/type-size lint limits remain enforced.

This closes the mobile no-restart observation criterion, but does not exercise shared
Firebase or deploy either app. Stale generic-notification cache authorization and the
separately governed FCM dispatch lifecycle remain open. No production data changed.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:cross`
- `priority:P1`
