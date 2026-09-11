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

### Tenth local cut — offline snapshot audit (approved 2026-09-08)

Ninth cut is committed and pushed as `095126b`. Its unchanged validation is reused
for delivery. Start the read-only audit tooling with one offline CLI over bounded
JSON evidence: exact project/environment/workbook, explicit expected dates, source
rows with completion/revisions, roster, reviewed tab mapping and captured Sheets
grid/version. Reuse canonical projection validation and the existing union import
reader. Report duplicate identities/dates, missing/extra dates, invalid source or
shape/group, current eligibility, adjacent delivery/helper violations and cross-store
disagreement. Completed helper history is not recomputed.

The CLI has audit mode only, no SDK credentials, network adapter, apply or repair.
Emit a stable input/report digest, machine findings and a concise human summary.
Mark lineage/round/bootstrap evidence, trusted capture and live completeness as
unevaluated; an internally consistent supplied snapshot is not HU-083 acceptance or
permission to repair. No historical ownership is inferred from effective assignees.
Reject malformed/oversized/wrong-target evidence, prove deterministic diagnostics,
zero input mutation and CLI rejection of apply. Human conversion, dry-run/rollback,
live evidence collection and full bootstrap auditing remain later gates.

### Tenth-cut validation checkpoint — 2026-09-08

The offline `audit-shift-planning.cjs` command is implemented with exact target and
bounded normalized snapshot input, canonical/human import-reader reuse, findings,
input/report digests, explicit unevaluated checks and `readyForRepair: false`.
It has no mutation/network client path. Invalid source skips cross-store evaluation;
missing/ambiguous Sheet data rejects the complete comparison. A successful scoped
audit does not infer historical ownership, certify capture or authorize repair.

Validation: Functions lint/build passed; the new audit suite passed 14/14, including
actual CLI execution without credentials, unchanged input/directory, malformed and
wrong-target rejection, apply rejection, canonical/human snapshots, cross-season
helpers, completed history, dates/duplicates, invalid source/group, eligibility,
manual edits, missing rows/tabs, formula/authority cells and bounded grids. Existing
Sheets suite passed 44/44. Node syntax check and `git diff --check` passed. Runtime
Functions/mobile contracts are unchanged; ninth-cut emulator/planning/security
results were reused for its commit and not rerun for this offline-only CLI.

Ninth cut is confirmed on the remote as `095126b`; tenth-cut code/docs remain local
and uncommitted. Issue #267 stays open. No live capture, Firebase/Sheets write,
deployment, IAM change or notification occurred. The unrelated main-checkout Xcode
project reorder is untouched. Next audit work must bind historical rotation/bootstrap
and approved horizon evidence before any dry-run repair; human conversion and the
safe-apply/zero-write rehearsal remain separate pending story gates.

### Eleventh local cut — lineage and round audit (approved 2026-09-08)

Tenth cut is committed and pushed as `4189e7b`; its unchanged lint/build, audit 14/14
and Sheets 44/44 results are reused for delivery. Extend the existing offline auditor
with explicit schema-v2 lineage evidence for both types; preserve v1 as a scoped
audit with lineage unevaluated. Each type binds bootstrap evidence immediately before
the first expected date, observed per-row round positions and the cursor after the
whole expected horizon. Reuse HU-082 bootstrap resolution and position consumption.

Check exact roster/type/boundary, missing/corrupt bootstrap, contradictory alternative
sources, owner order, per-row round/position and final cursor. Market consumes three
positions per date, including round boundaries. Effective assignments never supply
ownership. Keep HU-082 source precedence; report alternative conflicts separately
instead of changing planner behavior or hiding them. Do not infer missing historical
mappings, approve admin evidence, persist a baseline or claim live capture authority.

Exercise versioned state/history/approved mappings, cross-season/round continuation,
market groups, gaps/repeats, corrupted state without fallback, legacy helper gates,
contradictory evidence, assignment-only swaps, missing/duplicate position evidence,
v1 compatibility and deterministic digests. Local/offline only: no new endpoint,
network client, live data, IAM, deploy, repair or conversion. Repair readiness stays
false; approved calendar/capture, historical eligibility and boundary helpers remain
explicit limitations before dry-run/repair and the guarded rehearsal.

### Eleventh-cut validation checkpoint — 2026-09-08

The existing offline auditor accepts strict v2 lineage evidence for delivery and
market while preserving the v1 scoped contract. It resolves bootstrap with HU-082
precedence, checks contradictory alternatives separately, consumes the expected
horizon and compares observed owners/round positions/final cursor. It never derives
ownership from effective assignments. Missing/duplicate rows or evidence, corrupt
state, conflicting mappings and inherited-helper failures remain explicit findings.
No runtime planning/Functions/mobile contract changed and no new service was added.

Validation: Functions lint/build and Node syntax check passed; audit 27/27 (including
v1/v2 CLI execution, exact 30-position market continuation, cross-season/round owners,
history chronology, approved-mapping tie order, corrupt state without fallback,
alternative conflicts, legacy helper, malformed/bounded evidence and assignment-only
swaps); Sheets 44/44; planning 294 passed with 51 emulator-only skips. `git diff
--check` passed. No emulator suite was rerun because this cut only extends the offline
CLI and reuses unchanged SDK-free HU-082 algorithms.

Remote HEAD is tenth-cut `4189e7b`; eleventh-cut changes remain local and uncommitted.
Issue #267 remains open. The main-checkout Xcode reorder is preserved. There was no
live capture, Firebase/Sheets write, notification, IAM change or deployment. Even v2
consistency does not authenticate captured/approved evidence or certify calendar,
historical membership and boundary helpers; repair readiness remains false. Dry-run
repair/baseline/rollback tooling, human conversion and the guarded rehearsal remain
pending before story closure.

### Twelfth local cut — reviewed offline repair diff (approved 2026-09-08)

Eleventh cut is committed/pushed as `6c25c3e`; unchanged validation is reused.
Add the planned repair CLI in dry-run-only form. Require two explicit v2 snapshots
(original and proposed), exact target and both audit input digests. Reuse the auditor;
proposal must have zero scoped findings and both lineages consistent. Preserve
horizon, roster, routing and bootstrap authority rather than invent corrections.

Emit deterministic normalized projection before/after changes with captured revision
guards, exact managed-cell before/after deltas and a plan digest. Reject deletes,
ambiguous IDs, changed completion/revisions, completed-row mutations, unguarded
neighbor edits and source corrections other than canonical app/planner. Limit Sheets
to existing canonical tabs: preserve metadata, headers, manual columns, formulas and
protected/merged cells; no human conversion or automatic tab creation in this cut.
The full original snapshot digest guards every supplied neighbor and unchanged row.

This is a private review artifact, not an executable Firestore/Sheets write manifest,
migration baseline or backup. It includes UID-based values for review; stderr stays
sanitized. There is no live client, apply/rollback mode or persistence. Always report
readyForApply false and the remaining capture/calendar, writer/trigger, atomic CAS,
backup/restore, baseline and rollback gates. Prove exact source/helper/owner and cell
diffs, no-op rerun, deterministic digests, zero file mutation and all rejection gates.

### Twelfth-cut validation checkpoint — 2026-09-08

`repair-planned-shifts.cjs` now emits a deterministic, private dry-run review artifact
from two explicit v2 snapshots and their exact audit input digests. It reuses the
auditor, requires a consistent proposed state, preserves target/capture/horizon/roster/
routing/bootstrap and emits normalized projection, lineage and managed-cell before/
after deltas. It rejects ambiguous/deleted identities, completed history mutations,
revision changes, unguarded delivery boundaries, human conversion and changes to
manual/protected/merged/formula cells, metadata or unselected tabs. No correction is
inferred and no executable write/CAS or rollback manifest is claimed.

Validation: Functions lint/build and Node syntax check passed; combined audit/repair
suite 37/37; Sheets 44/44; `git diff --check` passed. Tests cover exact values/guards,
source and owner/cursor correction, interior helper/lead changes, zero-revision create
proposals, digest/context drift, history preservation, rejected cell/metadata edits,
unknown old cell content, unselected tabs, repeat/no-op planning, direct input
immutability and a real CLI run with unchanged files and rejected apply. The prior
planning/emulator evidence is unchanged and was reused for the eleventh-cut commit;
this new offline script does not change runtime Functions or mobile code.

Remote HEAD is eleventh-cut `6c25c3e`; twelfth-cut implementation remains local and
uncommitted. Issue #267 stays open. Main-checkout Xcode reorder remains untouched.
No live capture, data write, deployment, IAM or notification occurred. Remaining
repair gates are trusted evidence/approved calendar, history/boundaries, backup and
restore rehearsal, writer/trigger model, full-document atomic CAS/provenance,
migration baseline and rollback. Human conversion and the guarded live/zero-write
rehearsal remain pending. The artifact always declares `readyForApply: false`.

### Thirteenth local cut — full Firestore capture binding (approved 2026-09-08)

Twelfth cut is committed/pushed as `612d4b6`; its unchanged 37 audit/repair and 44
Sheets tests plus lint/build are reused. Bind the offline dry-run to a separately
supplied full-document capture and its exact digest. Reuse HU-082's typed Firestore
value codec so timestamps/nanoseconds, bytes, GeoPoints, nested/extra fields and
original provenance are preserved rather than silently projected away.

Require exact target/input digest/capture time, one captured document and updateTime
for every original source row including unchanged neighbors, and explicit absence
for every proposed create. Reject duplicate/missing/foreign paths, invalid typed
payloads, projection/revision/completion/round mismatches and future update times.
Retain full before-images plus exact absence/read guards in a versioned private plan.
Keep the existing unbound plan available as v1, never silently promote it to bound.

This closes source-to-projection binding only. A capture supplied by the operator is
not proof of live query completeness or authenticated backup. No full forward write,
terminal/retention/provenance transaction, inverse execution, baseline, live capture,
network client or deployment is added. `readyForApply` remains false. Test lossy or
mismatched captures, full extra-field preservation, changed unchanged-neighbor guards,
create absence and both CLI forms; no source files or live stores are mutated.

### Thirteenth-cut validation checkpoint — 2026-09-08

The dry-run CLI now optionally requires a full typed Firestore capture and its exact
digest. Bound plans are v2 and retain all original shift payloads/updateTimes, including
unchanged neighbors, per-payload/projection digests and exact proposed-create absences.
HU-082 encoding/decoding preserves nanoseconds, bytes, GeoPoints, nested/extra fields
and original provenance. Projection, revision, completion and round/market-position
bindings are checked without pretending invalid historical source values are already
valid publication payloads. Missing/duplicate/foreign documents, future update times,
lossy/unsupported values, partial options or null captures reject the plan. Unbound v1
remains explicit and unchanged.

Validation: Functions lint/build and Node syntax check passed; combined audit/repair
44/44; Sheets 44/44; publication contract/codec 8/8; `git diff --check` passed. Tests
include actual three-file CLI execution with unchanged files, rejection of incomplete
capture options, full extra-field preservation, exact absence, completed actual-helper
evidence and digest changes for an unchanged neighbor or one updateTime nanosecond.
No runtime/mobile contracts changed; prior emulator validation was not rerun for this
offline capture-binding extension.

Remote HEAD is twelfth-cut `612d4b6`; thirteenth-cut implementation is local and
uncommitted. Issue #267 remains open; unrelated Xcode edits in the main checkout are
preserved. No live capture/write, deploy, IAM or notification occurred. This binds
supplied shift evidence only: authenticated capture/query completeness, other source
registries, final document/CAS/terminal/retention/provenance assembly, migration
baseline, rollback and guarded rehearsal remain pending. `readyForApply` stays false.

### Fourteenth local cut — reviewed public document materialization

The user authorized commit/push of cut thirteen and implementation of the next
cut. Cut thirteen is published as `35e9e482f601cce81ed40c40f0bd9e6a9ed74f7e`.
This cut compiles explicit final typed payloads against the recomputed capture-
bound repair review. Reuse HU-082 publication, repair-terminal and retention
builders; include every source read guard, exact creates and terminal writes,
and rehearse each resulting event through the existing classifier. Preserve
completed evidence and untouched fields, and reject unsupported extra-field loss.
Keep apply unavailable: live authority/capture, transactional CAS execution,
baseline, inverse and multi-store recovery remain subsequent delivery gates.

### Fourteenth-cut validation checkpoint — 2026-09-08

The user authorized commit/push of cut thirteen and the next implementation cut.
Cut thirteen is published as `35e9e482f601cce81ed40c40f0bd9e6a9ed74f7e`.
Cut fourteen adds an optional v3 offline review from explicit final typed payloads,
bound to the recomputed v2 plan and an exact packet digest. It validates full
public documents, includes lineage-only changes, preserves immutable fields and
completed before-images, and enforces document/assignment revision increments.
Unsupported extra-field loss and malformed prior provenance reject materialization.
HU-082 builders supply the repair marker, terminal and retention. Every original
shift contributes an updateTime/full-digest read guard; creates, terminal and
retention require absence. Each proposed event must pass the existing retained
classifier as controlledNoOp. These are unpersisted templates, not a transaction.

Validation: Functions lint/build and Node syntax checks passed; combined audit/
repair/materialization 54/54, Sheets 44/44, publication/event/retention contracts
18/18, no skips. Tests cover creates, assignment/helper and lineage-only changes,
completed neighbors, stale digests, field loss, revision exhaustion, malformed
policy/provenance, missing/duplicate writes and real four-file CLI execution with
unchanged inputs and no apply mode. No shared runtime or mobile contract changed;
no new emulator/mobile run was needed for this offline compiler. `git diff --check`
passed. The unrelated 13/13 Xcode reorder in the main checkout is preserved.

Cut fourteen is local and uncommitted; issue #267 remains open. No live capture,
Firestore/Sheets write, IAM change, deployment or notification occurred. Apply
readiness remains false: live source/authority completeness, atomic CAS admission/
execution, migration baseline, inverse, restored-clone rehearsal and writer/trigger
fencing are pending. Local classification is not proof of deployed trigger behavior.

Remaining-work estimate after this cut: approximately 3–5 coherent cuts, grouping
baseline/inverse, atomic execution and recovery rehearsal, reviewed human-layout
conversion, and trusted evidence plus final delivery (or exact HU-085 deferral).
This is provisional, not a claim that the live acceptance gates are already met.

### Fifteenth local cut — migration baseline and clone inverse (approved 2026-09-08)

Cut fourteen is published as `aeb43dac456d6f14be5b05d1826f1ed07986617c`.
The user authorized that commit/push and the next cut. Extend the recomputed
materialization review with one immutable two-type baseline template and an exact
inverse for isolated-clone rehearsal. Bind final full shift payloads, the expected
workbook image and both HU-082 bootstrap resolutions without inventing approval or
active-registry state. Preserve original payloads and grid evidence, delete only
manifest-created clone objects, and require verified forward read-back before an
inverse may be executed. No live writer or weaker repair-recovery provenance is
introduced; existing recovery codecs apply specifically to activation recovery.

### Fifteenth-cut validation checkpoint — 2026-09-08

The baseline/clone-inverse review is implemented locally. Functions lint/build,
Node syntax and whitespace checks pass; audit/repair/recovery 59/59, Sheets 44/44,
bootstrap/publication/event/retention 24/24, no skips. Test interpreters restore
payloads/cells and check partial/drifted states, completed evidence and created-
object cleanup; this is not an SDK commit or restored-backup rehearsal. Exact CLI
inputs remain unchanged. See the mirrored #267 checkpoint and Functions README
for the artifact contract and evidence limits. No live/mobile contract changed;
no deploy, IAM change or live mutation occurred. The Xcode reorder is preserved.
Cut fifteen is uncommitted. Next implement authoritative rotation attachment and
admitted Firestore forward/inverse commit rehearsal; live repair-recovery event
authority and all remaining writer/evidence/human-layout gates remain open.

### Sixteenth local cut — authoritative attachment and emulator commits (approved 2026-09-08)

Cut fifteen is published as `98d32cd309af7222b955e43f35174ea320e9596a`.
The user authorized commit/push and the next cut. Bind full maintenance/rotation
captures to the existing repair review, attach the common baseline and reviewed
final cursors with CAS, and rehearse forward/inverse commits on a loopback-only
Firestore emulator under a demo project. Reuse HU-082 authoritative-state parsers,
transaction admission and writer fences. Require verified forward read-back for
inverse CAS and verify receipt-based replay without extra writes. Live deployment,
writer/trigger authority and real multi-store recovery remain separate gates.

### Sixteenth-cut validation checkpoint — 2026-09-08

Authority binding and loopback/demo-only execution are implemented locally. The
complete synthetic Firestore forward/inverse and receipt replays pass 6/6; units
69/69 (final focused authority 5/5), Sheets/bootstrap/public-contract regressions
68/68, lint/build, syntax and whitespace checks pass without skipped tests.
Emulator evidence includes a create plus both aggregate updates, exact restoration,
created-object cleanup, stale/ABA CAS, competing attempts and notification fences.
Source update times stay exact; event classification matches the trigger's
millisecond boundary. The emulator shut down. No mobile/deployed contract changed
and no live source mutation/deploy/IAM/FCM occurred; the Xcode reorder is preserved.
See #267 and the Functions README for receipt and v5 contracts. Cut sixteen is
uncommitted. Human-layout conversion, trusted backup/evidence, multi-store writer
fences, live inverse provenance and the final safe/deferred gate remain pending.

### Seventeenth local cut — offline human-layout conversion (approved 2026-09-08)

Cut sixteen is pushed as `b252e70db0655776c56d16abe9663a4fd6ddc9dc`.
The user authorized commit/push and the next cut. Prepare a digest-bound,
explicit archive-and-create proposal for all selected human tabs, retaining their
complete supplied images and reusing the current canonical projection/import
contracts. This local tooling approval does not decide the final visual layout
or authorize live rename, conversion, deployment or IAM changes.

The new dry-run CLI preserves original IDs/cells/metadata in archived images,
requires explicit non-colliding archive names and new canonical IDs, and emits a
hypothetical canonical audit input plus an exact original offline inverse image.
Existing canonical/unrelated tabs remain untouched. Conversion rejects missing
calendar rows, assignment disagreements, invalid provenance and ambiguous people;
it preserves applicable rotation/eligibility findings for subsequent repair.
It does not synthesize a future workbook revision or trusted capture.

Validation: conversion **9/9**, auditor/repair/Sheets regressions **105/105**,
Functions lint/build, Node syntax and whitespace checks pass, without skipped
cases. The existing exporter updates canonical IDs while preserving archives;
the repair reviewer consumes the canonical clone without losing lineage findings.
CLI inputs remain unchanged and apply/unknown flags are rejected. The 250000-cell
bound includes archives and generated tables. No live Sheets/Firestore mutation,
IAM/deploy/FCM or mobile contract change occurred; the unrelated Xcode reorder
remains 13 added/13 removed lines. Cut seventeen is local and uncommitted.

Next: obtain the missing trusted evidence and consolidate the safe-apply or exact
zero-write HU-085 handoff. Visual approval, complete workbook metadata and formula
reference behavior, real restored-clone multi-store rehearsal, effective writer
fences and live inverse authority remain open. This snapshot proposal does not
satisfy those live gates or enable the human-layout apply endpoint.

### Eighteenth local cut — acceptance consolidation (approved 2026-09-08)

Cut seventeen is pushed as `775be1adaae27d60e506677f6d1832739846c2ba`.
The user authorized commit/push and the next cut. Reconcile the accumulated
checklists against actual source and validate the combined backend scope instead
of adding more generic repair/conversion layers.

[Acceptance review](acceptance-review.md) records the implemented canonical
pipeline, the still-present legacy full/ordinary/override/import/generation routes,
the undecided human-facing format and the missing real-data evidence. Legacy route
migration is a local implementation gap, not merely a HU-085 deployment action.
No acceptance criterion is closed using synthetic data as real-data proof.

Validation at that commit: Functions lint/build pass; the 60-file local union has
492 passes, 51 emulator-context skips and zero failures. Nine sequential existing
emulator scripts pass 160 executions with zero skips/failures; some cases overlap
with the unit union and do not cover every skipped HU-082 case. See the review for
exact commands and per-group counts. Emulators shut down. No live data, deployment,
IAM or notification action occurred; no mobile wire/code changed and mobile gates
were not rerun. The unrelated main-checkout Xcode reorder is preserved.

Cut eighteen changes documentation/checklist evidence only and remains local and
uncommitted. HU-083 stays open. The next implementation depends on the requested
human-layout choice and must finish the concrete legacy routes; trusted capture,
real-data manifests and the safe-apply/exact-zero-write gate remain separate.

### Nineteenth local cut — shared legacy configuration isolation (approved 2026-09-08)

Cut eighteen is pushed as `19a8ab4309181e90d0e1729bb2ebf1f5fdc4846b`.
The user authorized commit/push and the next cut, asking to surface the choices
needed along the way. The human-facing layout choice is pending. This cut fixes
the environment boundary common to either layout without choosing or converting it.

All remaining legacy configuration callers now use the shared module's
`readLegacyShiftSheetsConfig`: an explicit workbook and both ranges for the target
environment are required. Missing values disable the route; global/opposite books
and invented range defaults are never used. Invalid/shared workbook IDs and
unbounded/control-character ranges reject. Existing human ranges are preserved.
This removes the duplicated fallback code; it adds no new orchestration layer.
No stored or deployed parameter is removed. HU-085 must supply/verify the scoped
variables before activating this candidate if a deployment relied on globals.

Validation: Functions lint/build pass; configuration, adapter, import, worker and
backend-security tests pass 85/85, and the exported-trigger emulator suite passes
13/13 with no skips. The actual ordinary `onShiftWritten` does not open Sheets
when any develop variable is missing despite complete global/production settings.
The emulator shuts down. No live data, deployment, parameter, IAM or FCM change
occurred; mobile code/contract is unchanged and mobile gates were not rerun.
The main-checkout Xcode reorder remains untouched. Cut nineteen is uncommitted.

Next required user choice: retain readable editable date/name sheets (recommended)
or use the technical tables with archived human sheets. Seasonal writer migration
will follow that decision; real-data evidence and final apply/deferral remain open.

### Twentieth local cut — readable seasonal exports (approved 2026-09-08)

Cut nineteen is pushed as `3df3766`. The user explicitly chose readable, editable
sheets with dates and names, and authorized commit/push plus this next cut. The
technical-table/archive alternative is not the selected working format.

Full export, ordinary `onShiftWritten`, and delivery-calendar override export now
resolve the existing seasonal human tab from the logical date and explicit aliases.
They require the scoped workbook and alias configuration; fixed legacy ranges and
`syncMeta.sheetName` no longer select these destinations. Delivery updates only
A:C and F; market updates A:B for exactly three participants. Manual annotations,
formulas, market date headings and the following block are preserved. Invalid
identities/names, ambiguous dates/blocks, technical headers, missing tabs, wrong
books and oversized grids reject rather than silently invent or overwrite layout.
No new orchestration layer is added; the existing writer fences remain in place.

Validation: Functions lint/build pass; nine focused local files pass 90/90 and the
actual-handler Firestore emulator suite passes 22/22, with zero skips/failures.
The latter invokes full HTTP export, ordinary events and calendar overrides using
fake Sheets and fictional members. No live Sheets/Firestore, deployment, IAM or FCM
change occurred. Mobile code/contract is unchanged; mobile gates were not rerun.
Cut twenty remains local and uncommitted; HU-083 stays open.

Next: connect reviewed human import/write-back, generation/new seasonal tabs and
the activation worker to the chosen readable format. Current legacy export does
not acquire the canonical worker's durable receipt/reconciliation protocol from
these tests. Real baseline/backup, effective writer exclusion and the final safe
apply or exact zero-write HU-085 deferral remain open. No further user choice is
needed for this local cut; any later real-data decision must identify its scope.

### Twenty-first local cut — readable import preparation (approved 2026-09-08)

Cut twenty is pushed as `49df825df903e2a8d9eb2fa44f5bae0ff1c7eba1`.
The user authorized commit/push and the next local cut. This cut makes reviewed
import preparation understand the selected readable export: Spanish market dates,
manual annotations/formulas, names and explicit literal `lo hace Nombre` changes.
It also reads the bounded delivery-calendar query as trusted source and includes
its documents/revisions in the existing source digest. Effective dates resolve to
exact original shifts and logical seasonal tabs, never by ISO-week guessing alone.

Validation: Functions lint/build pass; ten focused files pass 104/104 and the
Firestore import emulator suite passes 42/42, all without skips/failures.
The two affected audit/repair suites also pass 64/64. The conversion regression
now edits a delivery assignee explicitly; market heading annotations are valid
under the chosen readable contract. The
emulator includes the mixed human seasonal union with fictional members and
calendar races, plus existing canonical apply/write-back recovery regressions.
The scope is preparation and its existing source guards;
human apply/write-back remains gated until the readable writer is integrated with
the durable submission protocol. Cut twenty-one remains local and uncommitted;
HU-083 stays open. No live Sheets/Firestore, deployment, IAM or FCM change occurred.
No mobile code/contract changed, so mobile gates were not rerun. The unrelated
main-checkout Xcode reorder remains untouched.
Next: integrate that human write-back, followed by generation/new tabs and the
activation worker. The accepted readable-layout choice remains in force.

### Twenty-second local cut — reviewed human apply/write-back (approved 2026-09-08)

Cut twenty-one is pushed as `09cdd11`. The user authorized commit/push and this next
local cut. Integrate readable import application and write-back into the existing
adapter/submission protocol, keeping mixed seasonal layouts in one batch. Preserve
exact before/after cell images, notes/formulas, logical dates and stable ownership;
consume only applied literal replacement instructions. Reuse source transactions,
workbook reservation, durable submission and inspect-only recovery after uncertainty.

Validation: Functions lint/build pass; 173/173 cases in twelve local regression
files, 45/45 Firestore import emulator cases and 17/17 existing consumer emulator
cases pass with zero failures/skips. The HTTP human flow, mixed-season write-back,
consumed substitutions, lost acknowledgements, inspect-only uncertainty and changed
calendar/image rejection are exercised with fake Sheets and fictional members.

Cut twenty-two remains local and uncommitted. The cut does not create seasonal
tabs or migrate legacy sync/generation or the activation worker. No live workbook/
Firestore, deployment, IAM or FCM change occurred. Mobile code/contract is unchanged;
mobile gates were not rerun. The unrelated main-checkout Xcode reorder is preserved.
HU-083 remains open. Next: generation/new human tabs and activation integration,
then legacy sync migration/retirement and the remaining real-data evidence gates.

The repository currently has one Firebase project for both environment paths.
Because Functions revisions and Firestore Rules are shared project-wide,
HU-083 validates the new behavior only in local tests/emulators. Its
optional live develop repair is a direct, bounded script operation and never a
develop-only Functions or Rules deploy.

### Twenty-third local cut — readable generation (approved 2026-09-08)

Cut 22 is pushed as `e51d16c`. This cut adds explicit readable generation to
the existing atomic Sheets adapter: names/phones, visible dates, delivery
helpers and three-person market blocks. It creates missing seasonal tabs and
appends to the same recognized layout without clearing or replacing existing
rows. Changed assignments, ambiguous dates and incompatible layouts require
review; annotation cells remain untouched. The existing operation marker,
authorization callback and inspect-only recovery remain the sole protocol.

Validation passes: lint/build, 183/183 local cases, import emulator 45/45 and
consumer emulator 17/17 (zero failures/skips). Resulting cells, carryover
preservation, conflicts, import round-trip and uncertain submission are covered. Worker composition with trusted Firestore
labels/calendar, legacy generation replacement and live develop acceptance
remain subsequent integration work. No deployment or live writes are in scope.

### Twenty-fourth local cut — readable activation worker (approved 2026-09-08)

Cut 23 is pushed as `9c4e507`. Wire the existing consumer to readable generation
using bounded Firestore member/calendar reads alongside activated public rows.
Persist exact display rows in the existing submission receipt and recheck source
versions transactionally before its single external batch. Recovery uses those
persisted labels, not mutable directory data. Preserve schema-v1 canonical receipt
recovery; new submissions use a versioned readable receipt. Validate with the real
Firestore emulator, fake Sheets, source races and lost-response recovery. No new
queue/endpoint, live data, deployment, IAM or notifications are in scope.

Implemented locally. Validation passes: lint/build, 186/186 local cases, consumer
emulator 23/23, import 45/45 and repository 7/7; zero failures/skips. Historical
layout adoption and legacy generation/sync remain separate integration work.

### Remaining delivery forecast — reset after cut 24

The earlier 3–5-cut forecast was not supported by the full acceptance inventory.
Track five outcomes, with a 5–7-cut estimate including cut 25, conditional on real
source access: (25) retire unsafe legacy write paths and align ordinary exports;
(26) adopt historical readable layouts; (27) run the complete integration/review
and close demonstrated defects; (28) capture/review real source evidence and exact
repair or zero-write deferral manifests; (29) final acceptance and delivery handoff.
Allow 1–2 corrective cuts only for demonstrated findings; report any scope increase
against this list immediately. Operational access/approval is not measured in cuts.

### Twenty-fifth local cut — legacy writer retirement (approved 2026-09-08)

Cut 24 is pushed as `2a50d99`. Current Android/iOS request codecs write schema-v2;
no mobile source calls the legacy sync HTTP endpoint. Keep both old entry points
as compatibility responses: authenticated legacy sync returns a migration error,
and pending legacy requests become failed transactionally without touching Sheets,
shifts or notifications. Remove their unreachable parser/planner/clear writers.
New v2 requests retain their existing processor. Deployment and confirmation of
external/deployed callers remain HU-085 work. Also align ordinary export with the
new readable header: helper names in F and no month-heading append in that layout;
legacy layouts retain their original week-number semantics. Validate real exported
handlers and both compatibility boundaries in the emulator.

Implemented locally: 197 local passes (11 emulator-only skips), exported handlers
19/19 and writer fences 12/12 in the emulator; lint/build pass. The 11 skips were
executed by that separate fence suite. The old writers and exclusive helpers are
removed; external/deployed client compatibility remains an HU-085 rollout gate.

### Twenty-sixth local cut — reviewed historical layouts (approved 2026-09-08)

Cut 25 is committed/pushed as `f1afc6d`. Generation now adopts the existing
`SHIFT_SHEETS_IMPORT_TABS_<ENV>` human mappings, including exact display titles,
month headings and variable spacing between four-row market blocks. Aliases alone
remain insufficient. Missing/emptied reviewed tabs, changed decorations, date rows
hidden as decorations, incomplete/extra participants and changed assignments reject
before authorization. Existing titles, notes, formulas and formatting survive;
no rows are cleared, moved or converted. Historical delivery F stays a week/annotation
column (preserved on existing rows, ISO week on append); only the exact new header
owns helper F. Historical tabs do not gain a visible helper column implicitly.

The mapping parser is shared with the private import entry point. The worker binds
its detached mapping into the projection digest and existing schema-v2 receipt;
inspect-only recovery uses that receipt without reloading deployment mapping.
Existing schema-v1 canonical and schema-v2 unmapped receipts remain compatible.
Ordinary exports share literal date decoding (serial, ISO, European and long dates),
preserve historical F, recognize reviewed inter-block headings, and reject managed
formulas/invalid dates before writes. Mapped historical delivery appends no new
month heading that would invalidate its reviewed decoration map.

Validation: Functions lint/build pass; focused regression has 200 passes and
11 emulator-only skips, all covered by the separate writer-fence emulator 12/12.
Consumer emulator passes 24/24 and exported HTTP/event/override handlers 27/27.
Sheets is a public-API fake and all people are fictional; no real workbook,
Firestore data, deployment, IAM or FCM was changed. Mobile code and its public
contract are unchanged, so mobile validation was not rerun.

Cut 26 remains local/uncommitted. Synthetic four-tab/two-season generation/import
coverage proves the supported structure, not a reviewed mapping of the real book.
Market participants must still be three contiguous rows after their date; spacing
between blocks is variable. No arbitrary layout inference or new repair workflow
was added. Remaining outcomes: (27) complete integration review, (28) real evidence
and exact repair or zero-write deferral, (29) acceptance/delivery. The existing
allowance of 1–2 corrective cuts applies only to demonstrated findings.

### Twenty-seventh local cut — complete integration review (approved 2026-09-09)

Cut 26 is pushed as `ec301ec`. Reviewed the complete HU-083 source/acceptance delta
and ran the full existing local regression plus 20 demo Firestore/Rules suites.
Corrected stale new-header helper write-back, unconsumed already-effective change
instructions, inconsistent annotation/decoration handling and the repair tool's
obsolete canonical-only restriction. The offline auditor also binds captured
calendar overrides and diagnoses stale visible helpers. Existing protocols and
fences are reused; no generic layer or real mutation is introduced.

The [acceptance review](acceptance-review.md#cut-27-integration-review--2026-09-09)
records findings, evidence and remaining operational boundaries. The readable
repair proposal cannot move/delete old rows, overwrite notes/formulas, alter
calendar authority or touch protected/merged cells. It emits exact cell deltas;
the existing loopback rehearsal executes only its bounded Firestore side.
Historical F remains a week/annotation field. No mobile/public wire changes.

Validation passes: lint/build, 525 local tests and 275 emulator executions across
20 suites; all 51 local emulator-only skips are covered there.

Cut 27 is local/uncommitted. Remaining planned outcomes are (28) real evidence with
exact repair or zero-write deferral and (29) acceptance/delivery. There is no new
technical cut in the plan. Source access, reviewed mapping, backup and writer
exclusion remain actual gates, not facts established by synthetic tests.

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


## Cut 28 access checkpoint — 2026-09-09

Cut 27 is pushed as `a1ef9ca`. Read-only Firebase/Drive metadata checks are
recorded in [inventory.md](inventory.md#cut-28-access-checkpoint--2026-09-09).
Firebase is authenticated; the CLI credential gap does not establish absence of
an auditor. Identify the separately bounded keyless principal and encrypted
create-only evidence destination before source capture. Existing user sessions
are not an implicit substitute. No real repair/deferral outcome is completed,
and no additional implementation cut is introduced while access is resolved.


## Format consistency decision — 2026-09-11

The maintainer accepts either stacked or horizontal market participants. The
requirement is one matching write/read contract, including the production
workbook already in operational use. Do not treat adapting only the isolated
test copy as acceptance or ask the maintainer to choose a cosmetic layout.
If the chosen contract changes existing active tabs, its rollout must pair the
exporter/importer revision with exact workbook migration and read-back in both
environments. Production rollout remains a concrete coordinated operation;
format preference alone is not an execution of that rollout.

Read-only inspection found stacked market writers in both the HU-082 integrated
base (`515b9f8`, `buildMarketSheetValues`/`upsertShiftRowInSheet`) and HU-083
(`a1ef9ca`, `buildShiftSheetsHumanBlocks`/ordinary export). The supplied test
copy's horizontal market layout and delivery round column do not match those
writers. The maintainer has now confirmed the provenance: the current season
was prepared through Codex as an emergency workaround before this app feature
was ready. The next annual generation will run through the app.

Retain HU-083's existing readable layout and stacked market participants. The
authorized isolated copy adaptation is complete, including native backup, fresh
read-back, visual inspection and a 72-shift anonymized reader/planner rehearsal
with no assignment changes or backend patches. See `inventory.md` for boundaries.
No additional parser, generator or production migration executor was added.

The actual develop Firestore comparison remains the next cut-28 operation, after
verifying the separate auditor and encrypted evidence destination required above.
The synthetic rehearsal does not close that gate. HU-085 must coordinate backend
activation with adaptation/read-back of the active production workbook, preserving
the current season's dates, assignees, rounds and annotations rather than
regenerating it. Neither production nor configured develop was modified here.

## Cut 28 source capture result — 2026-09-11

The maintainer authorized and the agent executed the concrete access proposal.
The [source capture review](source-capture-review.md) records stable actual develop
data, retained backup, successful 114-document emulator restore and verified
revocation. Source access is no longer the pending input for this captured window.

Continue offline with exact migration mappings: legacy historical payloads,
54 future Sheets rows absent from Firestore, two displayed-name aliases, and
missing approved rotation/bootstrap state. Reuse the existing audit/materializer;
do not infer ownership or completed history from effective assignees and dates.
Cut 28 remains open for reviewed repair-or-deferral; no new cut is introduced.


### Cut 28 develop test-fixture decision — 2026-09-11

The maintainer identified the old develop assignments as disposable test data and
explicitly authorized rebuilding/renaming that workbook. This supersedes the
pending question of preserving the obsolete future roster. Rebuilt the same-ID
workbook with four native reference copies (72 turns, 27 exact-matched active
members), populated 108 empty phone cells from develop users, retained historical
tabs and verified the private backup, all changed cells and visual layout.
No production access or Firebase write/deployment occurred.

The backend import rehearsal now passes in Firestore emulation with all 48 users,
32 eligible members and 72 reconstructed turns. It normalizes 53 blank helper
cells in the simulated workbook, applies exactly two cross-season patches, and
verifies replay/write-back without changing users, ownership or completion.
Planning authority is synthetic fixture data; Sheets uses the existing stateful
API fixture. No live backend/Sheets writes or trigger/mobile validation occurred.
The subsequent 139-write disposable-source replacement and exact inverse also
pass in emulation, including replay/inventory/update-time drift rejection. Direct
inspection and local execution of the deployed handler show that a later confirmed
canonical turn still enters the legacy writer without reading maintenance state.
Do not apply the synthetic fixture live. Continue the existing HU-085 deferral
handoff: operational baseline/manifest and remaining app/equivalence evidence,
then cut-29 acceptance. Evidence and limits: `offline-reconciliation-proposal.md`.
