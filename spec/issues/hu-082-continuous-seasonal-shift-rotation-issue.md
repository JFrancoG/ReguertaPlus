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

## Links

- Spec: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/spec.md`
- Plan: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/plan.md`
- Tasks: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/tasks.md`
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
- [ ] No production mutation is included.

## Local implementation checkpoint — contract/planner cut (2026-08-24)

The current contract/pure-planning cut adds the exact v2 request/wire boundary,
canonical fairness digest, fail-closed rotation bootstrap, and a side-effect-free
delivery-plus-market bundle planner. The bundle binds independent before/after
frontiers, `futureProjectionOccupancy`, active state, one exact common migration
baseline, cohort-freeze transitions, forward/inverse manifests and write budgets,
two release-lease intents, Sheets-sync templates, and held assignment intents into
one stable revision/digest.

The pure artifact chain is now fail-closed. Stage requires the exact persisted
preview receipt plus adapter measurements for both forward and inverse manifests;
the conservative canonical gate is 500 document writes plus declared transforms
and 10 MiB serialized in each direction. Forward budgeting includes persisted
recovery before-images, and measurement authority is fairness/expected-state
lineage: an adapter or index-configuration change invalidates the evidence and
candidate. Until HU-084 owns exact credit transitions, any enabled or non-empty
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
preview/candidate repositories, adapter byte/transform measurements, request
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
Stage reloads the persisted preview and bundle, requires candidate evidence to
match the result exactly, and creates a digest-bound candidate header without
accepting even an identical pre-existing collision.

The activation boundary added here is intentionally read-only and candidate-only:
it validates an unclaimed activate request against the persisted staged candidate
without loading a preview or bundle, claiming the request, or writing state. A
future runtime must still rebuild and revalidate the live fairness snapshot and
bundle digest immediately before the activation CAS. Emulator regressions cover
claim contention, lease takeover/fencing, canonical failure summaries, terminal
replay integrity, immutable preview persistence, stage collision/tamper handling,
and zero-write activation preflight.

This cut remains deliberately non-deployable. Real adapter byte/transform
measurement, candidate-position materialization, maintenance/publication CAS,
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

The pure manifest/budget contract also keeps the immutable bundle already
persisted by preview entirely outside activation and inverse recovery: it is not
updated, restored, or deleted. Existing request, candidate, and operation records
are classified as updates, while only genuinely new public projection, command,
before-image, and held-intent documents are creates. Unit and Firestore emulator
coverage exercise the complete private `preview -> stage` path and prove the
`activate` orchestration boundary performs no operation write. This orchestrator
is not exported from `src/index.ts`; public CAS, authoritative live snapshot
validation, adapter measurement, candidate materialization, consumers, mobile
integration, deployment, and every live mutation remain pending.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:cross`
- `priority:P1`
