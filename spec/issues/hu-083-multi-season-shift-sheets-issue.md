# [HU-083] Multi-season shift Sheets and develop repair

## Tracking

- GitHub issue: #267
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/267
- State: IN PROGRESS — seventeenth cut pushed; eighteenth acceptance review validated locally
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation branch: `codex/hu-083-multi-season-shift-sheets`
- Base commit: `515b9f847dd6000b15962d9cf75d0f32a3bf49c0`
- Depends on: HU-082 / #266 (integrated through PRs #275 and #276)
- Extends: HU-020 / #19 (adapter/tooling here; conditional develop apply and all
  production acceptance are explicitly assigned below)

## Summary

Keep one stable workbook per environment and use seasonal tabs as projections of
the continuous Firestore rotations. Replace fixed-range/whole-tab behavior with
idempotent discovery, creation, merge, bounded import, and routed export. Audit
the develop test data and repair it only if the live trigger-safety gate passes;
otherwise deliver the zero-write plan/digest and exact HU-085 materialization
handoff. Then pass verified code and evidence to production activation #269.

Both environment paths share the same Firebase project-wide Functions revisions
and Firestore Rules. New code is therefore proven locally/in emulators. Any live
develop repair is a direct, bounded, digest-bound script operation compatible
with the current deployed contract; HU-083 deploys no shared Function or Rule.

## Local implementation checkpoint

The first local cut adds the new-format Sheets adapter, durable public-event
audit, pre-batch authorization hook and partition-revision correction. Lint/build
pass; Sheets 19/19, audit emulator 21/21, sync emulator 7/7, strict/phase1 Rules
32/32 and 8/8, backend security 31/31, planning units 278 pass / 51 emulator-only
skips. It is not wired into `index.ts`; worker/import/export/trigger integration,
complete baseline, audit/repair tooling and live rehearsal remain open. The
bounded connector layout inspection is recorded in
`spec/shifts/hu-083-multi-season-shift-sheets/inventory.md`; it is not a backup or
a reviewed repair/zero-write snapshot.

### Second local cut — 2026-09-08

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

Fourth and fifth cuts remain local and uncommitted; the pushed branch still ends
at third-cut `48fb799`. English/Spanish ADR-0013, README and issue #267 reflect this
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

### Fourteenth local cut — final document review (approved 2026-09-08)

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
The user authorized that commit/push and the next cut. The CLI now optionally
binds an explicit baseline revision to the recomputed v3 materialization digest.
The v4 artifact includes one create-only two-type migration-baseline template,
final full shift-payload/grid digests, both HU-082 bootstrap inputs/resolutions,
row positions and final cursors. Existing mappings, stable tie order and helper
evidence survive; approval is never manufactured from versioned state.
The complete forward includes baseline creation. Its clone-only inverse restores
original payloads and cells, deletes only forward-created clone objects, and guards
all expected post-state documents including unchanged neighbors. Full grid images
preserve representation and manual content; these are not Sheets replacement API
requests. Physical update times/version must come from verified forward read-back.
Both rotation-lineage attachments explicitly await authoritative capture and emit
no aggregate writes. Live repair recovery cannot borrow activation-only provenance.

Validation: Functions lint/build and Node syntax checks passed; audit/repair/
materialization/recovery 59/59, Sheets 44/44, bootstrap/publication/event/retention
contracts 24/24, no skips. An independent test interpreter exercises exact payload/
cell round trips, completed actual-helper/extra-field preservation, created-object
cleanup and rejection by the emitted guards of partial/drifted/replayed states.
Four-file CLI tests prove unchanged inputs and paired/exact-digest rejection.
This is in-memory evidence, not a Firestore transaction or restored-backup rehearsal.
`git diff --check` passed; no mobile/runtime contract changed, so mobile gates and
emulators were not rerun. The unrelated main-checkout Xcode reorder remains intact.

Cut fifteen is local and uncommitted; #267 remains open. No live read/write, deploy,
IAM or notification occurred. Apply readiness stays false. Next: authoritative
rotation attachment and Firestore admission/forward-inverse commit rehearsal,
followed by live evidence, human-layout conversion and the final safe/deferred gate.

### Sixteenth local cut — authority binding and emulator commits (approved 2026-09-08)

Cut fifteen is published as `98d32cd309af7222b955e43f35174ea320e9596a`.
The user authorized that commit/push and the next cut. V5 binds full typed
maintenance/rotation captures to the original snapshot, reuses HU-082 state
parsers, and emits both common-baseline/cursor attachments with state-revision
increments and exact inverse images. Closed maintenance, matching active
lineage/write epoch, no lease, original cursor and frontier are checked.
The executor constructs a client only for a matching demo project on a loopback
Firestore emulator. It reuses HU-082 admission, notification fences and per-
document CAS, verifies post-commit state and returns digest-bound read-back
receipts. Inverse requires the forward receipt; same-direction receipt replay
verifies state/times and writes nothing. Restoration deletes newly introduced
fields rather than leaving merge residue. Public forward classification uses
the observed commit time at the trigger's millisecond boundary while CAS and
receipts preserve exact nanoseconds. Missing read-back never authorizes resend.

Validation: Functions lint/build and Node syntax checks passed; audit/authority/
state/admission units 69/69, focused final authority 5/5, Sheets/bootstrap/public
contract regressions 68/68, and actual Firestore emulator commits 6/6, no skips.
Emulator tests prove complete seven-write forward/inverse groups including a new
shift and both aggregates, exact payload restoration/created-object cleanup,
no-write receipt replay, stale/ABA update-time rejection, one winner between two
concurrent attempts, and notification-fence rejection without partial writes.
CLI tests cover five unchanged input files and exact/paired authority options.
The admission regression independently covers 500/501 writes and oversize rejection.
`git diff --check` passes. No mobile or deployed runtime contract changed; mobile
gates were not run. The unrelated main-checkout Xcode 13/13 reorder is preserved.

Cut sixteen is local and uncommitted; #267 remains open. The emulator was stopped.
No live source read/write, IAM change, deployment or notification occurred. This
is synthetic Firestore evidence and in-memory Sheets evidence, not a restored
real backup, multi-store fence, deployed-trigger/Rules test or live repair inverse.
Apply readiness stays false. Next address reviewed human-layout conversion and
trusted evidence/remaining recovery controls for safe apply or exact HU-085 deferral.

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

[Acceptance review](https://github.com/JFrancoG/ReguertaPlus/blob/codex/hu-083-multi-season-shift-sheets/spec/shifts/hu-083-multi-season-shift-sheets/acceptance-review.md) (local file pending the next commit) records the implemented canonical
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

## Workbook decision

- Rename the stable workbook if desired; its shared link/ID remains valid.
- Do not create a new workbook every season by default.
- Create/merge seasonal tabs automatically from actual shift dates.
- Firestore owns the queue; Sheet edits may not move its cursor.
- Any imported/manual delivery-lead change validates distinct adjacent leads plus
  predecessor/current/successor completion/revisions across tabs. It recomputes only
  an uncompleted predecessor's planned helper; completed actual helper history and
  rotation ownership remain immutable.

## Links

- Spec: `spec/shifts/hu-083-multi-season-shift-sheets/spec.md`
- Plan: `spec/shifts/hu-083-multi-season-shift-sheets/plan.md`
- Tasks: `spec/shifts/hu-083-multi-season-shift-sheets/tasks.md`
- ADR: `docs/decisions/0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md`

## Upstream implementation checkpoint

HU-082 now provides the versioned sync-command codecs, bounded Firestore polling,
fenced claim/takeover, immediate pre-batch active-lineage/partition authorization,
read-back completion, SDK-free executor, and idempotent fake-consumer proof. HU-083
adds the local real multi-season Sheets adapter, durable external-attempt and
read-back evidence, and ambiguous-outcome reconciliation in the second cut; its overall dependency
on HU-082 is satisfied by its integrated implementation and audit corrections.

The exact upstream boundary is frozen in
`spec/shifts/hu-082-continuous-seasonal-shift-rotation/hu-083-handoff.md`. HU-083
must consume those schema-v1 command, repository, public-event and retention
surfaces directly, add the real Sheets/trigger persistence evidence, and preserve
the explicit HU-084/HU-085 exclusions. Recording the handoff does not satisfy the
live inventory, integration evidence, or rehearsal gates and authorizes no live
operation.

## Upstream checkpoint — HU-082 public event classifier (2026-08-27)

HU-082 now supplies the SDK-free classifier and exact registry codecs for
activation, repair, sync-correction, and recovery-delete events. It proves that
only a changed and fully authorized marker becomes an audited no-op, while a
retained marker leaves later ordinary edits/deletes active and a changed marker
without authority fails closed. HU-083 must wire that contract into the real
`onShiftWritten` trigger, persist its event ledger through the retry horizon, and
prove real Sheets/notification suppression without reimplementing weaker parsing.

HU-082 also supplies the schema-v1 retention producer: digest-bound end-to-end
horizon plus safety margin, immutable operation retention, controlled/rejected
event ledgers, deterministic backend-only paths, and exclusive cleanup semantics.
HU-083 must persist them with create-or-exact-replay, configure the approved
policy, deliver unknown-marker alerts, and prove real trigger behavior; it must
not replace the upstream codecs with a looser local schema.

## Delivery gate

- [x] HU-082 and ADR-0013 integrated; ADR-0014 governs public transactions.
- [ ] Multi-season adapter and migration tests green.
- [ ] Local/emulator request, adapter, and notification contract green.
- [ ] Compatible direct-script develop audit, dry-run, repair, read-back, and
  forward/inverse commit rehearsal in an isolated restored clone green before live
  apply, or apply is explicitly deferred to HU-085 with live
  baseline unchanged and equivalent emulator/read-back/recovery evidence.
- [ ] A live develop apply inventories and recoverably fences/drains every Firestore/
  workbook writer, immediately rehashes both stores, uses per-document update-time
  CAS plus per-batch workbook revision/digest checks, and retains the fence through
  read-back/rollback rehearsal. If that bounded multi-store fence cannot be proved,
  the only allowed branch is zero-write deferral to HU-085.
- [ ] The writer gate includes My Drive owner feasibility, transitive group/domain/
  DWD/Workspace authority, and pending offline edits; any unprovable path forces
  zero-write deferral.
- [ ] The direct script has a named, timeboxed, keyless repair principal/workload in
  the manifest, exact develop targets/actions plus app guards, explicit database-
  scoped IAM blast radius, sole-writer proof, terminal revocation, and audit read-back.
  Any project-wide/production fence or unisolated authority forces HU-085 deferral.
- [ ] A separate keyless evidence auditor captures exact develop Firestore/workbook
  backups with read/export-only source access and create-only encrypted, ACL- and
  retention-bound evidence output, then is revoked/read back before apply.
- [ ] Safe apply records an immutable two-type post-repair baseline revision/
  digest; deferred apply records the expected digest/materialization manifest and
  writes no live baseline. A successful live apply ends in the repaired state; the
  inverse is not applied live merely as a rehearsal.
- [ ] Audit resolves each type's HU-082 bootstrap source/order/round/cursor and the
  delivery predecessor-helper constraint, or requires an explicit approved mapping;
  apply/deferred handoff persists/materializes that exact mapping and digest.
- [ ] No shared-project Functions/Rules deploy or live planning notification.
- [ ] HU-085 receives the integrated code and complete non-secret develop
  evidence; its deferred branch receives only manifests/dry-runs, never the HU-083
  principal/credential, and no production mutation occurs in HU-083.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:backend`
- `priority:P1`
