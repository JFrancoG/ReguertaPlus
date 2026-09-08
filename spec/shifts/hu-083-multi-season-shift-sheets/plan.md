# Plan - HU-083 (Multi-season shift Sheets and develop repair)

## 1. Delivery strategy

### Execution checkpoint — 2026-09-08

HU-082 is integrated through PRs #275 and #276; issue #266 is closed.
Implementation starts from `515b9f847dd6000b15962d9cf75d0f32a3bf49c0`
on `codex/hu-083-multi-season-shift-sheets` in an isolated worktree. The
unrelated Xcode project ordering in the main checkout is preserved.

The first local cut implements the seasonal Sheets adapter and durable public
event audit under tests. It uses an explicit canonical row format and configured
aliases; neither fixture tab names nor fixture headers count as live inventory.
Legacy human-formatted tabs must fail closed until their mapping is reviewed.

Before wiring the worker/trigger, resolve these integration findings with
focused regressions: authorize every external batch, persist an attempt before
submission and reconcile unknown outcomes without resending, define the meaning
of workbook revision consistently across both partitions, and recognize inverse
UPDATE events as well as DELETE events. Keep operation terminals until their
physical identity and replay dependencies are resolved; do not enable generic
TTL cleanup. These are integration requirements, not new orchestration layers.

The initial authorized connector layout inspection is recorded in
[inventory.md](inventory.md). Phase 0 complete inventory/baseline and phase 3
backups remain pending; backups require the separate bounded evidence auditor.
Local adapter tests are not proof of live repair, a reviewed zero-write manifest,
or production readiness.

The first cut is implemented and independently reviewed. Functions lint/build
pass. Validation: Sheets **19/19**, public-event audit **21/21** in Firestore
emulator, sync-command repository **7/7** in emulator, strict Firestore Rules
**32/32**, phase1 Rules **8/8**, backend security **31/31**, and planning units
**278 passed / 51 emulator-only skips**. The 51 skipped cases are not claimed as
executed by the focused emulator runs. No mobile wire field changed, so no new
Android/iOS gate was run for this backend-only cut.

The second cut below completes durable Sheets command execution locally. Import,
legacy-layout conversion and public-event integration remain separate cuts. Keep
HU-083 open until the complete story gates and evidence are satisfied.

Separate code correctness from live rollout. First replace the fixed-range
adapter with a tested multi-season projection and build read-only audit tooling.
Then rehearse backup, dry-run, apply, reconciliation, and rollback in develop.
Production access, configuration, deployment, stage/activation, and recovery
are a separate story, HU-085, with a separate explicit authorization gate.

### Second local cut — durable command consumer

Connect the existing command executor to the Sheets adapter through an immutable
submission receipt created before I/O. Use one current-workbook pointer in the
existing private planning-state collection to serialize both partitions. A receipt
without verified read-back is unresolved regardless of lease age: subsequent
invocations may inspect, never resubmit. Complete under the original claim only
after persisted exact evidence and current lineage/partition checks.

Read the real Drive file `version` around Sheets read-back; it is an observation,
not a CAS token. Only an exact preceding verified workbook receipt explains a
revision advance from the other partition. Unknown drift remains blocked. Prove
normal execution, lost invocation/acknowledgement, stale ownership, concurrency
and read-only recovery with the real Firestore repository and the real adapter
against an API fixture. Keep import/UI-layout conversion and public-event trigger
wiring as subsequent integration work; no shared-project deploy in this cut.

### Second-cut validation checkpoint — 2026-09-08

The second local cut connects the existing executor/drain to the real Sheets
adapter through a durable pre-submission receipt and one current-workbook pointer.
Unknown calls are inspect-only across lease expiry and block both partitions;
late confirmation keeps the original worker/attempt/epoch and requires persisted
exact read-back plus current lineage. The consumer validates activated rows against
the bundle and operation terminal, including a corrected prior-season predecessor
helper manifest. Drive versions are real metadata observations, not CAS tokens.

Validation for this cut: Functions lint/build pass; **14/14** consumer integration
cases, **7/7** sync repository, **7/7** forward materializer, **5/5** inverse
materializer, **32/32** strict Rules and **8/8** phase1 Rules run together in
Firestore emulation (**73 passed, no skips**). Sheets adapter/config **19/19**;
planning units **279 passed / 51 emulator-only skips**. The focused emulator run
covers selected cases from that unit lane, not all 51 skipped cases. Sheets/Drive
use stateful public-API fixtures, not live Google services. No mobile field changed;
Android/iOS validation was not repeated.

Still pending: legacy layout conversion and governed import/export, inverse UPDATE
and retention identity for public events, trigger/scheduler composition, complete
baseline and audit/repair tooling, plus the guarded live/zero-write rehearsal.
No new `index.ts` wiring, deploy, live data write or Git delivery in this cut.
HU-083 remains open.

### Third local cut — import read and reconciliation preflight

Commits `49ea875` and `a3f30af` were pushed to the HU-083 branch on 2026-09-08.
The next authorized local cut reads an explicit union of seasonal tabs and builds
an assignment-only review plan against a trusted Firestore baseline. Reuse the
existing bounded Sheets snapshot and canonical projection codec; legacy delivery
rows and market blocks require explicit layout/decorative-row mappings, never
heuristic skipping. Resolve names/phones without ambiguous fallback, require three
market participants, preserve ownership/completed history, and bind changed
delivery neighbors and source revisions into the plan digest. Missing tabs,
unresolved people, duplicate dates, partial reads and drift fail the entire read;
absence yields an audit discrepancy, never a deletion.

This cut delivers executable read/preflight APIs and tests. It does not convert
live human tabs or apply assignments: transactional apply with source re-read,
notification/writer fencing and changed-backend-event provenance remains the next
integration boundary. Existing export continues to reject legacy headers until an
explicit conversion is reviewed. No shared-project deploy or live mutation.

### Third local cut — 2026-09-08

The first two cuts are committed and pushed as `49ea875` and `a3f30af`.
The third cut, now committed and pushed as `48fb799`, adds bounded Sheets reads, canonical
export/import round-trip, explicit human delivery/market parsing, and a zero-write
assignment reconciliation plan. Missing/partial tabs, ambiguous identities,
incomplete market groups, formulas, changed authority cells and version drift
reject the read; absent source rows produce diagnostics, never deletion commands.
The plan includes current/previous/next delivery revisions, preserves completed
predecessor history, and rejects equal adjacent leads or an unproven edge.

Validation: lint/build pass; Sheets/import **38/38** (19 prior and 19 new cases),
consumer regression **14/14** in Firestore emulation. Google APIs are simulated.
The third cut changes no Rules or mobile contract; Android/iOS checks were not
repeated. No live data access or mutation was needed for this cut.

The source baseline, complete chronological neighborhood and member eligibility
remain trusted caller inputs. Snapshot/plan digests are consistency checks, not
credentials or proof of live CAS. The next cut must load/re-read that authority in
a governed transaction, revalidate membership and writer/notification fences, and
emit exact public-event provenance before applying any assignment. Live layout
conversion, governed export/import endpoint wiring, inverse-event identity,
audit/repair and rehearsal remain open. HU-083 is not complete.

### Fourth local cut — transactional Firestore import

The third cut is committed and pushed as `48fb799`. Build a concrete preparation
and apply repository using the existing public Firestore transaction API. Preparation
loads complete bounded shift/member queries plus open active maintenance and clear
rotation/Sheets fences, reads the workbook, then persists an immutable backend-only
plan only if those sources are still exact. Apply accepts only its operation ID and
reviewed digest, re-reads the complete authority/query set in the same transaction,
checks notification fences, and commits all assignment/helper changes together with
one existing `syncCorrection` operation terminal, its explicit policy-bound
retention record and exact replay result. Public
ownership/completion fields remain unchanged. Mixed active lineages fail closed.

The result retains exact projections requiring subsequent Sheets write-back. This
cut does not wire public endpoints or the legacy trigger, send notifications, or
perform that external write-back; those remain integration work before rollout.
No shared-project deploy or live source mutation. Tests use Firestore emulation and
Google API fixtures, including concurrent apply, stale membership/completion,
inserted neighbors, writer fences and controlled-event classification.

### Fourth local cut — 2026-09-08

The third cut is committed and pushed as `48fb799`. The fourth cut is implemented
and validated locally, still uncommitted. `createFirestoreShiftSheetsImport`
loads trusted bounded shift/member queries and active state, persists an immutable
review plan after a second source check, then re-reads the full source and
notification/writer fences in the transaction that applies all patches. Changed
membership, completion, document versions, inserted neighbors and active leases
reject the entire plan. Canonical member roles and `phoneNumber` (with the member
writer's explicit legacy aliases) are checked against human-layout input.

At most 100 patches commit with the existing `syncCorrection` terminal, explicit
policy-bound operation retention and an immutable replay result (103 writes
maximum). Completed history and rotation ownership remain intact. The real durable
event auditor recognizes the import and exact event replay; later ordinary edits
remain ordinary. Exact apply replay does no Google I/O or new public mutation.
Canonical HU-082 public documents and current patched-row lineage are required;
the complete baseline has a combined 500 shift/member document limit.

Validation: Functions lint/build pass, import Firestore emulator **19/19**,
Sheets/import units **38/38**, strict Firestore Rules **32/32** and phase1 Rules
**8/8**, with no skips in these runs. Google APIs are simulated. No mobile contract
changed, so Android/iOS checks were not repeated. No live data access, source
mutation, Functions/Rules deployment or FCM occurred.

The result records exact projections with `writeBackState = pending`. Next is
Sheets write-back integrated with the existing durable submission receipts and
serialization, with acknowledgement separate from the immutable result. That
integration, endpoints/legacy trigger wiring, inverse-event identity, baseline,
audit/repair and guarded rehearsal remain open. Drive version observations cannot
replace external-writer exclusion. This checkpoint does not complete HU-083.

### Fifth local cut — durable import write-back (approved 2026-09-08)

Continue on the same issue/branch with the fourth cut still uncommitted. Persist
an import reservation in the existing current-workbook submission document in the
same transaction as the import result. Reuse the Sheets adapter and its receipt /
exact read-back protocol; the shared pointer must serialize activation exports and
import write-back in both directions. Do not disguise import work as an activation
command or create another queue/worker abstraction.

Bind canonical managed cells observed by the reader into its immutable review.
Permit write-back over only those exact reviewed cells, preserving ordinary export
conflict rejection, unrelated cells, formulas, protection and formatting. Human
layout reads remain reviewable, but apply must reject affected human tabs before
public writes until their explicit conversion exists. No automatic layout rewrite.

An explicit write-back operation reloads the committed result, current source and
fences, records one submission before I/O, and sends at most one batch. After any
unknown outcome all retries inspect only; elapsed time cannot authorize resending.
Exact marker/cell read-back and stable advancing Drive observation acknowledge the
receipt, release the shared reservation and update workbook partition revisions
atomically. Keep the import result immutable and replay acknowledgement without
Google I/O. Stale source/authority or altered reviewed cells fail closed.

Validate success, concurrent callers, lost response, in-flight/unknown recovery,
crash before acknowledgement, source/Google drift, private Rules and activation /
import serialization with real Firestore emulation and public Google API fixtures.
No live mutation, deployment, endpoint/legacy trigger wiring or notification send.
External-writer exclusion remains required for eventual live use; Drive is not CAS.

### Fifth-cut validation checkpoint — 2026-09-08

The canonical import now completes its local `prepare -> apply -> writeBack` path.
The import transaction reserves the existing shared workbook pointer and creates
its private receipt alongside all public patches, terminal, retention and immutable
result (100 patches maximum, 105 writes maximum). The reviewed observation binds
exact canonical cells and row locations. Human tab reads remain reviewable, but
apply rejects affected human tabs before any public write until explicit layout
conversion is available.

The receipt distinguishes a reservation from a physically submitted batch. Unknown
outcomes remain inspect-only regardless of elapsed time. Stable advancing Drive
observation plus exact marker/cell read-back acknowledge the receipt and update both
partition revisions atomically; the import result is never rewritten. A pending
import excludes other imports and activation export claims/submissions. Later exact
replay does no Google I/O and cannot overwrite another operation's reservation.
Source/neighborhood/membership or notification-fence drift prevents submission or
acknowledgement. Failed acknowledgement can resume without resending the batch.

The combined delivery/market test found and fixed a fourth-cut omission: market
`rotationPositions.effectiveAssigneeUserId` must change with `assignedUserIds`.
Original owners, round numbers, position indexes and planning reasons are preserved;
the HU-082 public codec remains unchanged.

Validation: Functions lint/build pass; **37/37** import/write-back emulator cases,
**15/15** activation consumer cases, **7/7** sync repository cases, **38/38** Sheets
units, **32/32** strict Rules and **8/8** phase1 Rules. All **137 cases** passed
without skips; Google uses public-API fixtures and Firestore is emulated. An initial
emulator start failed on an occupied port; the rerun completed on the normal ports.
No mobile contract change or new Android/iOS gate. No live source mutation,
Functions/Rules deployment or notification send.

At this fifth-cut checkpoint, fourth and fifth cuts were still local and
uncommitted, with remote HEAD at third-cut `48fb799` (subsequently pushed below). English/Spanish ADR-0013, README and issue #267 reflect this
checkpoint. Next integration work remains explicit human-layout conversion,
endpoint/legacy-trigger composition including inverse-event identity, baseline and
audit/repair tooling plus the guarded rehearsal. Operational exclusion of live
activation, ordinary writers and external collaborators is still required; this
local receipt protocol is not a cross-service CAS or complete HU-083 delivery.

### Sixth local cut — recovery event authority (approved 2026-09-08)

Fourth and fifth cuts are committed and pushed as `8375483` and `60bf91f`.
The fourth staged tree independently passed lint/build and 20 import emulator cases;
the unchanged fifth tree reused its 137 passing cases and reran lint/build.

Before wiring the real trigger, complete recovery UPDATE classification and delayed
activation authority. Recovery currently replaces the activation terminal and restores
an older marker, so the auditor cannot safely distinguish that restoration from an
old activation replay. Version the recovery terminal explicitly to retain the exact
original activation terminal inside the same physical operation document. Preserve
strict schema-v1 decoding for existing artifacts; legacy recovery UPDATEs without
archived authority remain rejected. Keep manifest paths/write counts unchanged and
measure the larger payload with the existing transaction admission path.

Require an exact activated before payload plus the digest-bound persisted before-image
for recovery UPDATEs. Bind the decision to the recovery ID/intent, never the restored
old marker. For delayed activation events, validate against the archived original
terminal. Revalidate persisted ledgers and retain both logical operations' evidence;
shared physical authority and envelopes remain protected from any generic cleanup.
No TTL/cleanup executor is enabled. Prove real forward/inverse materializations,
emulator persistence/replay, missing/altered envelopes and delayed event order.

This local cut does not wire `index.ts`, deploy, convert human tabs, write live data
or send alerts/FCM. Explicit policy/retention composition, external writer fencing,
human conversion, endpoints, audit/repair and rehearsal remain story-level gates.

### Sixth-cut validation checkpoint — 2026-09-08

Recovery terminal v2 now archives the exact activation in the same physical
operation document. Recovery UPDATE binds the activated before and persisted
before-image to the recovery ID/intent; delayed activation CREATE/UPDATE uses the
archive. Recovery selection precedes restored-marker replay. Strict v1 decoding
and ordinary retained-marker edits remain supported; unproven recovery UPDATEs
remain fail-closed. No new persistence paths or transaction writes were introduced.

Validation: Functions lint/build pass; the public-event audit, inverse materializer,
attempt-outcome and CAS-runtime suites pass **50/50 with no skips** in the Firestore
emulator (including 32 audit cases). A real forward/inverse transaction fixture
retains the original terminal, restores the predecessor and passes admission with
all 156 inverse writes. Planning regression passes 279 cases with 51 explicitly
emulator-only skips; these skipped cases are not claimed as executed by that run.
No mobile code changed, so Android/iOS gates were not rerun. ADR-0013 EN/ES and
Functions README describe the version and shared-evidence retention requirement.

Sixth-cut changes remain local and uncommitted; remote HEAD is `60bf91f` after the
authorized fourth/fifth push. Both logical retention bindings and shared physical
authority must remain available; no generic cleanup executor is enabled. Trigger,
alert/policy composition, human-layout conversion, endpoints, audit/repair and
rehearsal remain pending. No shared deployment, live data mutation or message send.

### Seventh local cut — public-event trigger composition (approved 2026-09-08)

Sixth cut is committed and pushed as `8c4c48a`; its unchanged implementation
reuses lint/build, 50/50 emulator and 279 passing planning-unit evidence.
Connect controlled-event routing to the actual exported Functions: exclude changed,
removed or malformed markers and marked deletes before ordinary `onShiftWritten`
effects, and use a dedicated authenticated retry-enabled public-event audit trigger.
This follows the existing versioned-request trigger pattern and keeps ordinary
Sheets/notification effects outside automatic retries. Retained valid markers and
unmarked ordinary rows continue through the existing ordinary writer fences.

Read exact environment-scoped retention-policy JSON with no default/fallback.
Preserve CloudEvent ID/time, propagate transient authority/persistence failures,
and emit allowlisted structured rejection diagnostics only after ledger persistence.
Logs are an alert integration signal, not proof of operator alert delivery. Test the
exported retry handler, authorization, replay, rejection, missing policy and routing
with real Firestore emulator authority. No shared deployment, alert send, live
policy activation, human-layout conversion or audit/repair apply is included.

### Seventh-cut validation checkpoint — 2026-09-08

Candidate exports now separate controlled-event auditing from ordinary row effects.
The ordinary trigger applies the shared raw-snapshot gate before legacy decoding;
`onShiftPlanningPublicWritten` authenticates and retries only durable audit work.
Runtime retention policy is explicitly scoped by environment, with no fallback.
Rejections log allowlisted diagnostics after persistence; this is not a configured
operator alert channel or proof of alert delivery.

Validation passes: Functions lint/build; trigger suite **12/12 with no skips**
(8 focused tests plus 4 emulator tests invoking the actual `index.ts` exports with
SDK snapshots); planning regression **287 pass / 51 emulator-only skips**; backend
security **31/31**. Evidence covers recovery UPDATE/DELETE and delayed activation
replay, missing policy, transient transaction/authorization failure, durable
rejection, forged confirmed-row exclusion before Sheets access, and ordinary
retained-marker routing. No Android/iOS code or Rules changed; their gates were
not rerun. Sixth-cut audit/core emulator evidence is unchanged and reused.

Seventh-cut code remains local and uncommitted; remote HEAD is sixth-cut `8c4c48a`.
Before controlled writes, HU-085 must install/verify both trigger revisions under
writer exclusion, approve runtime policy, compose retention for all producers and
verify actual alerts. Human layout/conversion, worker/endpoints, audit/repair and
rehearsal remain open HU-083 work. No shared deployment, live configuration/data
write, Sheets/FCM call or operator message was performed.

### Eighth local cut — invoked Sheets worker (approved 2026-09-08)

Seventh cut is committed and pushed as `49b0c28`; its unchanged implementation
reuses lint/build, 12 trigger cases, 287 planning passes (51 emulator-only skips)
and 31 security cases. Compose a private HTTP entry point over the existing sync
repository, executor, Sheets consumer and Drive version reader. Accept only an
exact environment plus one command ID, or a bounded poll of at most two commands.
No rows, workbook override, credentials or authority are supplied by the caller.

Keep configuration environment-scoped and explicit, including reviewed aliases.
Stop a drain on busy/reconciliation-required work. Completed retries avoid external
I/O; submitted/unknown work remains inspect-only through the existing receipt.
Return compact outcomes and sanitized failures. Default invoker is private; HU-085
must assign the reviewed worker identity/IAM and operational writer exclusion.
The recovery operator's existing sole endpoint grant is not expanded here.

Validate HTTP rejection before dependency access, real emulator command execution,
both partitions, terminal replay and ambiguous submission without re-send. No
live invocation, deployment, config/IAM changes, human-tab conversion, scheduler,
notification release or automatic recovery is included in this local cut.

### Eighth-cut validation checkpoint — 2026-09-08

`executeShiftPlanningSheetsSync` is composed in the candidate exports as a private
POST endpoint over existing sync execution. It accepts one exact command ID or a
poll capped at two commands; caller rows/workbook/credentials are rejected. Runtime
workbook IDs and reviewed aliases are environment-scoped with no global fallback.
Busy/uncertain work stops a drain; HTTP repeats retain the existing terminal-replay
and inspect-only semantics. Responses and logs omit raw rows/backend diagnostics.

Validation: Functions lint/build pass; **17/17** consumer emulator cases (including
HTTP execution of both partitions, exact terminal replay and uncertain submission
without re-send); **38/38** Sheets cases; **12/12** trigger cases; planning regression
**294 pass / 51 emulator-only skips** (including 7 focused worker/config tests);
backend security **31/31**. The consumer emulator uses real Firestore and the
concrete Sheets adapter with a fake Google API boundary, not a live workbook.
No mobile code, Rules or persistence paths changed, so mobile/Rules gates were not
rerun. README and ADR-0013 EN/ES document invocation, responses and rollout limits.

Eighth-cut changes remain local and uncommitted. Remote HEAD is seventh-cut
`49b0c28`. No deployment, endpoint invocation against live services, configuration,
IAM, Sheets/Firestore live write or notification send occurred. HU-085 still owns
worker IAM/identity, approved runtime configuration and external writer exclusion.
Human layout/conversion, import endpoint, audit/repair tooling, retention/alert
composition and rehearsal remain pending; consumed-command recovery stays closed.

### Ninth local cut — reviewed import HTTP entry (approved 2026-09-08)

Eighth cut is committed and pushed as `1876fc6`; unchanged lint/build and the
17 consumer, 38 Sheets, 12 trigger, 294 planning (51 emulator-only skips) and 31
security results are reused. Expose the existing import preparation/apply/write-back
through a private, explicitly invoked HTTP function. Keep three distinct modes:
prepare returns the exact reviewable plan; apply and writeBack require its digest.
Caller input cannot provide rows, source authority, workbook, retention or layout.

Compose environment-scoped workbook/aliases, explicit reviewed import-tab mapping,
retention policy and the existing concrete Google/Firestore adapters at invocation.
Reject invalid configuration/HTTP input before mutations; keep replay, manual-edit
conflict and unknown-submission behavior in the existing import implementation.
A prepared plan is backend-only persistence, not a public assignment change.
No automatic apply or write-back is implied by preparation or an HTTP retry.

Prove the HTTP sequence, tampered digest, stale authority, terminal replay and
uncertain write-back with Firestore emulator and fake Google API boundaries.
No deployment, IAM grant, live invocation, human-layout conversion, scheduler,
notification release or shared data mutation is authorized by this local cut.

### Ninth-cut validation checkpoint — 2026-09-08

`executeShiftSheetsImport` now composes the existing import API as a private HTTP
function. Prepare returns the exact plan; apply/writeBack require its digest and
return only outcome metadata. Strict request fields and environment-owned reviewed
tab mapping prevent caller-supplied source/configuration. No additional persistence
or workflow layer was introduced. The worker shares the same Sheets/Drive client
construction; existing import authority, receipts and replay remain unchanged.

Validation: Functions lint/build passed; Sheets/config/import/HTTP 44/44;
Firestore import emulator 40/40; Sheets consumer emulator 17/17; exported public-event
trigger suite 12/12; planning 294 passed with 51 emulator-only skips; backend security
31/31. HTTP emulator cases prove separate preparation/apply/write-back, changed
workbook rejection, tampered digest rejection, terminal replay without new Google
I/O and an uncertain submission that is never resent. Google boundaries are fake;
these checks do not prove live IAM, workbook permissions or external-writer exclusion.

The ninth cut remains local and uncommitted. Remote HEAD is eighth-cut `1876fc6`.
Issue #267 remains open. No deployment, live Firestore/Sheets write, IAM change or
notification occurred. No mobile contracts changed; Android/iOS checks were not
rerun. The main checkout's unrelated Xcode project reorder remains untouched.
Human layout/conversion, audit/repair tooling, retention/alert composition and
rehearsal remain pending; consumed-command recovery stays closed.

The repository currently has one Firebase project for both environment paths.
Because Functions revisions and Firestore Rules are shared project-wide,
HU-083 validates the new behavior only in local tests/emulators. Its
optional live develop repair is a direct, bounded script operation and never a
develop-only Functions or Rules deploy.

## 2. Expected implementation impact

### Functions

- Extract Sheets configuration, tab routing, import, export, and row merge from
  `functions/src/index.ts` into focused modules such as:
  - `functions/src/shift-sheets-config.ts`
  - `functions/src/shift-sheets.ts`
- Replace single delivery/market ranges with environment-scoped workbook ID and
  a canonical seasonal-tab resolver plus explicit legacy aliases.
- Add stable row identity and merge/upsert semantics.
- Bound reconciliation/deletion to successfully read tab partitions.
- Keep rotation-owner fields backend-owned during manual assignment import.
- Consume HU-082's digest-bound activation-sync command by exact partition
  manifest and stable idempotency key through an explicit post-commit pull/invoked
  worker instead of exporting planner rows one by one. Claim pending state
  transactionally and rediscover it after invocation loss; do not rely on Eventarc
  enablement after document creation.
- Route backend-authenticated activation/repair/rollback-recovery/sync-correction
  `onShiftWritten` events to audited no-op behavior only when before/after proves
  a changed create/update marker registered to that operation/digest, or a delete
  matches its before-image version/path manifest; never trust a retained or
  client-forgeable source/origin field alone. Retain operation tombstones/event
  ledgers past the configured retry horizon. Consume HU-082's exact schema-v1
  retention policy, operation binding, controlled/rejected ledger codecs,
  deterministic paths, and exclusive cleanup semantics; add only the durable
  create-or-exact-replay repository, configured policy, alert channel, and real
  trigger evidence here.
- Add typed errors and structured, non-sensitive sync summaries.

### Audit and migration tooling

- Add scripts such as:
  - `functions/scripts/audit-shift-planning.cjs`
  - `functions/scripts/backfill-shift-rotation-state.cjs`
  - `functions/scripts/repair-planned-shifts.cjs`
- Require exact project/environment/workbook and `audit|dry-run|apply` mode.
- Default to no writes, reject ambiguous ownership, and emit a machine-readable
  plan/digest for operator review.
- Make apply idempotent and bind it to the reviewed dry-run digest.

### Firestore and Rules

- Preserve the HU-082 authority boundary and sync metadata.
- Add only the fields/permissions needed for partitioned reconciliation.
- Prevent clients/Sheet imports from rewriting rotation state or ownership.

### Android and iOS

No Sheet-specific mobile code is expected. Both clients continue reading
Firestore. Add or run regression coverage proving future seasonal shifts,
helpers, board/upcoming projections, and canonical source decoding survive the
develop repair.

### Documentation

- Update `functions/README.md` configuration and runbooks.
- Update bilingual Firestore/data integration references where the stored
  contract changes.
- Record the canonical tab format, accepted legacy aliases, develop repair and
  rollback procedures, and the non-secret handoff required by HU-085.

## 3. Phased implementation

### Phase 0 - Read-only inventory

- Freeze the HU-082 integrated commit and exact Firebase project environments.
- Before any live source export, authorize the temporary keyless evidence auditor
  with the exact read/export-only contract later frozen in Phase 2; no local Admin
  credential or future repair principal is an implicit substitute.
- Inventory the develop workbook ID, tab names, headers, row counts,
  formulas/protected ranges, sharing principals, and applicable Functions
  configuration without writing.
- Through that auditor, export/read-only audit current Firestore and Sheets; hash
  the input snapshot, then revoke/read back its access for this window.
- Freeze the exact canonical tab formatter and legacy aliases only after this
  inventory.

### Phase 1 - Multi-season adapter under tests

- Add RED tests for missing/existing tabs, carryover merge, duplicate replay,
  manual assignments, distinct adjacent delivery leads, helper completion races,
  frozen actual history, partial read failure, and cross-environment isolation.
- Implement environment-scoped configuration without fallback.
- Implement tab list/discovery/create and stable row merge.
- Implement union import and partition-bounded reconciliation.
- Route every export/override path using explicit tab metadata.
- Implement and test explicit activation/recovery sync-command consumption plus
  pending-command claim/discovery/retry plus candidate trigger suppression for
  every bound backend operation kind.
- Add a monotonic workbook/partition epoch and lease; revalidate command plus active
  revision/digest before every batch, read back afterward, and require terminal
  worker/external-call drain before a recovery command supersedes activation.

### Phase 2 - Audit and repair scripts

- Implement read-only audit with human and machine-readable output.
- Implement dry-run repair plan with deterministic ordering and digest.
- Define a separate temporary keyless evidence auditor for exact source read/export
  and create-only encrypted backup output. Freeze destination ACL/retention,
  artifact digest/read time, restore-test provenance, and revocation/read-back;
  deny source writes, apply invocation, overwrite/delete, and impersonation.
- Require backup references and exact reviewed digest for apply.
- Define one immutable post-repair migration-baseline revision/digest spanning
  delivery and market. Safe apply persists it; zero-write deferral emits only its
  expected digest and exact HU-085 materialization manifest.
- Repair invalid planner source as `source=app` plus origin metadata.
- Reconstruct ownership only from unambiguous HU-082 state/approved mapping;
  never from swapped effective assignees.
- Emit/review exact typed bootstrap mappings with ordered UIDs, round/cursor, stable
  tie order, evidence, and delivery predecessor-helper constraint. Persist them in
  the safe post-repair baseline or hand their expected digest/materialization to
  HU-085 on zero-write deferral.
- Add idempotent rerun and rollback tests.

### Phase 3 - Develop rehearsal

- Through the keyless evidence auditor, create/verify develop Firestore/workbook
  backups without source mutation; record artifact controls and revoke/read back
  the auditor before any apply principal is enabled.
- Run audit and review every violation.
- Run dry-run and attach the exact plan/digest.
- Prove generation for both shift types, carryover merge, request lifecycle,
  and held notifications locally/in emulators against the frozen adapter.
- Model every currently deployed trigger reached by each proposed write,
  including legacy Sheets exports and notifications from `onShiftWritten`.
- Inventory apps/admins, Functions, schedules/queues/retries, scripts, human editors,
  Apps Script/add-ons, API/OAuth/service accounts, and Shared Drive automations that
  can write either affected store. Prove a recoverable bounded zero-writer fence and
  drain that never changes a production/project-wide control plane; otherwise take
  the zero-write HU-085 branch regardless of HU-083 apply approval.
- Reuse HU-085's owner/effective-authority gate: resolve My Drive/Shared Drive,
  transitive group/domain/DWD/Workspace-admin paths, pending offline edits, and
  controlled reload/base-revision reopening. Any unprovable path forces zero-write.
- Manifest the direct script's keyless, timeboxed repair principal/workload, exact
  develop targets/actions/guards, unavoidable database/project IAM blast, negative
  production checks, and terminal revocation/read-back. Prove it is sole effective
  Firestore/workbook writer during apply; otherwise choose zero-write.
- Confirm that the repair is safe under current Rules/mobile reads and either
  triggers no side effect or has a proven reversible fence/drain for every
  reached trigger. Otherwise stop after dry-run and defer apply to HU-085.
- Present that final trigger model, writer/authority manifest, fence/drain proof,
  expected input snapshot, CAS/batch plan, rollback, and expiry for explicit apply
  authorization. Any later delta invalidates it.
- Before live apply, commit both the exact forward and inverse manifests in an
  isolated clone restored from the reviewed backup. Prove the inverse restores the
  baseline and removes exact creates; do not use production/develop as a rehearsal.
- Under that fence, immediately rehash both stores and recheck Firestore update
  times plus workbook revision/activity/digest. Apply each document with CAS and
  guard/read back every Sheets batch against the preceding digest; stop and
  reconcile/rollback on any mismatch because the stores are not transactional.
- Include predecessor/current/successor assignment, completion, and revision for
  every effective-lead repair, even across tabs. Reject equal adjacent leads/stale
  completion. Recompute only an uncompleted predecessor's planned helper; read back
  completed actual helper history, assignment, ownership, and replay unchanged.
- Apply only through the dedicated script to the bounded develop partitions;
  do not deploy shared Functions or Rules and do not create live planning
  requests or notifications.
- If apply is safe, re-run audit to zero applicable violations, verify
  Firestore/Sheets/apps, persist/read back the immutable two-type post-repair
  baseline revision/digest, and preserve that repaired state. Invoke the already
  rehearsed inverse live only after a mismatch/failure; a recovered failure does not
  satisfy the safe-apply branch. Revoke/freeze and read back the repair principal
  before releasing the fence.
  Otherwise attach the exact
  zero-write/expected-baseline digests, trigger model, deferral, rollback, and
  baseline-materialization manifests without writing live state.

### Phase 4 - Closure and production handoff

- Attach input hashes, dry-run/apply summaries, develop read-back, and rollback
  rehearsal status.
- Remove no legacy configuration merely because the develop repair passed.
- Hand HU-085 the integrated commit, parameter contract, required Functions
  surface, command-consumer ownership, migration-baseline format/reference,
  develop evidence, known residuals, and deferred manifests/dry-runs only. Never
  hand off or reuse the HU-083 live-script principal/credential in HU-085.

## 4. Test strategy

- Tab creation is idempotent under retry and concurrency.
- Existing next-season rows survive carryover insertion.
- Merge updates only the intended logical row and preserves protected/manual
  fields according to the frozen contract.
- Failure to read one tab cannot delete rows from that or any other partition.
- Manual effective-assignment edits do not mutate rotation ownership/cursor.
- Audit and dry-run write zero documents/cells.
- Apply requires the exact dry-run digest and is idempotent.
- Wrong environment, project, workbook, or missing access fails before writes.
- Repair identifies the current 2026-27 source, truncation, duplication, helper,
  and carryover failures.
- Mobile regression reads future Firestore rows and never depends on tab names.
- Activation/recovery sync-command replay is idempotent; delayed backend-operation
  per-row events no-op safely, and later ordinary edits retaining metadata do not
  regress.

## 5. Validation gates

- Functions `npm run lint` and `npm run build`.
- Focused Sheets adapter and migration suites.
- Relevant backend security and Firestore Rules suites.
- `git diff --check` and documentation link/secret scans.
- HU-082 Android/iOS regression gates when shared contracts change.
- Local/emulator request and adapter acceptance.
- Direct-script develop acceptance and rollback rehearsal when its compatibility
  gate passes; no shared-project Functions or Rules deploy.

SwiftLint validates Swift style only. Xcode MCP can build/test the iOS regression
slice, while Cupertino MCP is documentation/API research rather than a gate.
None validates TypeScript or replaces `npm run lint` and `npm run build`.

## 6. Rollback strategy

- Preserve pre-apply Firestore export/snapshot identifiers and workbook copy or
  exported tab files.
- Disable new planning requests before rollback if a projection contract is
  inconsistent.
- Through the still-fenced bounded repair principal, restore only the exact
  partitions from the recorded backup; the evidence auditor never performs restore.
- Re-run audit and both mobile read-backs after rollback.

## 7. Main risks

- **Irrecoverable sheet overwrite**: no clear/rewrite path; backup plus merge.
- **Configuration drift**: exact environment/project/workbook precondition and
  read-back at every live step.
- **False migration confidence**: dry-run digest and ambiguity gate.
- **Shared-project collateral**: keep all new Functions/Rules behavior in tests
  and emulators until the explicitly authorized HU-085 change window.
- **Premature production work**: HU-083 stops after the develop handoff to
  HU-085.
