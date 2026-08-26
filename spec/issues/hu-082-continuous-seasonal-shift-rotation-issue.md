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
the seven private control-plane collections remain backend-only. The Phase 1
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

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:cross`
- `priority:P1`
