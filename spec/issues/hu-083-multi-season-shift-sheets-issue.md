# [HU-083] Multi-season shift Sheets and develop repair

## Tracking

- GitHub issue: #267
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/267
- State: IN PROGRESS — sixth cut pushed; seventh cut validated locally
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
