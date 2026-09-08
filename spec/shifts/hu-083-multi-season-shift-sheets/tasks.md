# Tasks - HU-083 (Multi-season shift Sheets and develop repair)

## Current acceptance view — cut eighteen, 2026-09-08

See [acceptance-review.md](acceptance-review.md) for source-backed status and the
consolidated validation scope. Sections named after earlier cuts are historical
checkpoints, not the current count of unfinished work. Checked implementation
items below refer to the new canonical pipeline in local/emulator validation;
they do not certify live conversion or retire the legacy writer paths.

## First local cut — 2026-09-08

- [x] Implement strict environment config and proposed canonical table merge
  with one authorized atomic Sheets batch and read-only ambiguous recovery.
- [x] Validate retries, concurrent tab creation, carryover preservation, changed
  manual cells, formula/protection conflicts and explicit limits: 19/19 tests.
- [x] Persist public-event audits with existing schema-v1 codecs; preserve prior
  decisions and reject missing/corrupt authority: 21/21 emulator tests.
- [x] Protect event ledgers in strict and phase1 Rules: 32/32 and 8/8 tests.
- [x] Add the executor pre-batch hook and allow differing revision observations
  in same-workbook partitions: sync repository 7/7 emulator tests; bundle
  regressions included in 278 passing planning unit cases (51 other cases skip
  without their emulator fixtures). Backend security: 31/31.
- [ ] Complete worker/trigger integration, live baseline/audit tooling and the
  remaining story gates below. This checkpoint is not HU-083 completion.

## Second local cut — 2026-09-08

- [x] Compose exact activated-source loading, the existing executor/drain,
  Firestore sync repository, Sheets adapter, and real Drive version reader.
- [x] Persist one submission receipt before I/O and serialize both partitions
  through the existing private planning-state collection.
- [x] Keep unknown outcomes inspect-only after lease expiry; accept late
  confirmation only with matching persisted proof and current ownership.
- [x] Include the actual prior season when updating a predecessor helper.
- [x] Prove concurrency, lost responses, completion outages, source/version drift,
  forged evidence rejection, recovery exclusion and nested-receipt client denial.
- [x] Validate lint/build, 73 focused emulator cases (including 14 consumer cases),
  19 Sheets cases and 279 planning unit passes / 51 emulator-only skips.
- [x] Update English/Spanish ADR-0013 and operational docs. This checkpoint does
  not close import/event integration, audit/repair, live rehearsal or HU-083.

## Third local cut — 2026-09-08

- [x] Commit and push the first two cuts: `49ea875`, `a3f30af`.
- [x] Reuse bounded snapshot/projection codecs for canonical export/import.
- [x] Read the explicit seasonal union with exact human decoration mappings;
  reject missing/partial tabs, unresolved replacements and incomplete market groups.
- [x] Produce a zero-write assignment plan with source-revision guards and digest;
  preserve ownership/completed history and reject unsafe delivery neighborhoods.
- [x] Validate lint/build, 38 Sheets/import cases and 14 consumer emulator cases.
- [x] Apply through a real source transaction, including membership, complete
  neighborhood, writer/notification fences and exact backend-event provenance.
  The fourth local cut below proves this transaction, not live repair completion.

## Fourth local cut — 2026-09-08

- [x] Commit and push the third cut: `48fb799`.
- [x] Prepare immutable private plans from trusted complete bounded Firestore
  shift/member queries and revalidate after the external Sheets read.
- [x] Apply the reviewed digest atomically with source, membership, full
  neighborhood, rotation/Sheets and notification writer checks.
- [x] Preserve ownership/completed history and reject stale active lineage;
  create the existing sync-correction terminal and operation retention together.
- [x] Persist exact replay results with pending write-back projections; prove
  durable event classification and replay without Google I/O or duplicate writes.
- [x] Validate lint/build, 19 import emulator cases, 38 Sheets cases and 40
  strict/phase1 Rules cases, all without skips; align English/Spanish ADR-0013.
- [x] Integrate pending write-back with existing durable Sheets submission
  receipts/serialization and separate acknowledgement; keep real endpoint/trigger
  wiring and story-level repair/rollout gates open.

## Fifth local cut — 2026-09-08

- [x] Persist exact canonical cells in the reviewed observation; permit bounded
  write-back over those cells while ordinary export keeps its manual-edit guard.
- [x] Reserve the existing shared workbook submission pointer atomically with
  the import result; block other imports and activation export claims/submissions.
- [x] Persist one batch identity before I/O; recover unknown calls only by read-back,
  without lease-expiry resubmission or an additional queue/worker abstraction.
- [x] Acknowledge exact marker/cells and stable advancing Drive version together
  with both partition revisions, separately from the immutable import result.
- [x] Preserve later reservations on acknowledged replay; reject stale source,
  neighbors, membership, workbook revisions, notification fences and corrupt receipts.
- [x] Fix market effective-assignee metadata while preserving owners/round/position;
  prove delivery and market changes in a single physical Sheets batch.
- [x] Reject apply over affected human tabs until explicit conversion exists;
  preserve read-only human-layout preparation.
- [x] Validate lint/build and 137 cases: import 37, consumer 15, sync repository 7,
  Sheets 38, strict Rules 32, phase1 Rules 8; no skips or live data writes.
- [x] Align README, English/Spanish ADR-0013 and the open issue checkpoint.
- [x] Deliver the fourth/fifth local cuts: `8375483`, `60bf91f`.
- [ ] Continue explicit layout conversion and endpoint/legacy-trigger integration,
  including inverse-event identity; complete baseline/audit/repair and rehearsal.
  - [x] Seventeenth local cut prepares digest-bound archive/canonical images from
    explicit human mappings, preserving full supplied originals, exact inverse
    images and all applicable audit findings. Existing export/repair integration
    and CLI rejection paths pass (9/9 plus 105/105 regressions).
  - [ ] Resolve full metadata/formula-reference behavior before live integration.
    The maintainer selected readable, editable date/name sheets in cut twenty;
    archive-and-create technical tables is not the chosen workflow. The offline proposal cannot certify
    trusted capture, live version/CAS, writer fencing or restored-clone recovery.


## 0. Dependency and read-only inventory

- [x] Accept the frozen HU-082 integration boundary in
  `../hu-082-continuous-seasonal-shift-rotation/hu-083-handoff.md`; retain the
  implementation/merge dependency and every live-operation gate below.
- [x] Verify HU-082 / #266 and ADR-0013 are integrated (PRs #275/#276;
  ADR-0014 supersedes transaction admission/outcome internals).
- [x] Freeze base commit `515b9f8` and create the dedicated implementation
  branch `codex/hu-083-multi-season-shift-sheets` in an isolated worktree.
- [x] Resolve the configured develop Firebase project and environment path
  (`reguerta-9f27f`, `develop/plus-collections`; not a live source inventory).
- [x] Record that `{develop}` and `{production}` share project-wide Functions
  revisions and Firestore Rules; forbid a develop-only shared deploy.
- [ ] Inventory the develop workbook ID, tab names/aliases, headers, formulas, protected
  ranges, row counts, and sharing principals without writing.
  - Partial authorized connector inspection: [inventory.md](inventory.md).
    Four tabs and their A1:K180 layout are observed; complete protections,
    effective authority and the source/backup baseline remain pending.
- [x] Capture local Functions parameter names/presence without logging values:
  `SHEETS_SPREADSHEET_ID_DEVELOP`, `SHEETS_DELIVERY_RANGE_DEVELOP`, and
  `SHEETS_MARKET_RANGE_DEVELOP` exist and are nonempty in the original checkout.
  No local production parameter was found; deployed parameters remain unverified.
- [ ] Export/hash a read-only Firestore and Sheets baseline.

## 1. RED Sheets contract

- [x] Freeze canonical seasonal tab names and explicit legacy aliases from the
  bounded live layout inventory: `turnos-reparto YYYY-YY`,
  `turnos-mercado YYYY-YY`; 2025 aliases `TORRE 2025-26` and `MERCADO 2025-26`.
  This freezes titles only, not a migration of the existing human layouts.
- [x] Define stable row identity, ownership, assignment, source, provenance, and
  tab-partition metadata.
- [x] Add RED tests for tab creation, existing-tab merge, replay, concurrency,
  and carryover plus later-generation coexistence.
- [x] Add RED import tests for multiple tabs and partial/missing-tab failure.
- [x] Add RED tests proving manual edits cannot change rotation state/ownership.
- [x] Add RED tests for develop/production isolation and missing configuration.

## 2. Multi-season Sheets adapter

- [x] Extract environment configuration from `functions/src/index.ts`.
  - [x] New pipeline uses `readShiftSheetsWorkerConfig`. Cut nineteen routes all
    remaining legacy callers through `readLegacyShiftSheetsConfig`, with scoped
    workbook/ranges, no global/default fallback and shared-book rejection.
    Stored/deployed parameters and seasonal routing remain separately governed.
- [ ] Replace fixed single ranges with explicit workbook plus seasonal-tab
  routing.
- [x] Implement idempotent list/discover/create for tabs.
  - [x] Cut twenty-three adds explicit readable generation to the atomic adapter,
    including missing-tab creation, append, helper refresh and import round-trip.
    Worker display/calendar composition and historical-layout adoption remain open.
- [ ] Replace whole-tab clear/rewrite with stable-identity merge/upsert.
  - [x] Canonical adapter does bounded merges. Legacy `updateWholeSheet` remains
    reachable from the old generation path; do not claim repository-wide removal.
- [x] Import the union of allowed tabs and bound reconciliation to successfully
  read partitions. Cut twenty-one makes reviewed human preparation compatible
  with readable dates/annotations and trusted delivery-calendar overrides; human
  apply/write-back is integrated locally in cut twenty-two; the legacy sync
  endpoint remains open.
- [x] Route full export, incremental export, and overrides by explicit tab
  metadata. Cut twenty uses logical dates/explicit aliases and bounded human ranges;
  exported HTTP/event/override integration passes. Missing/oversized tabs reject;
  readable creation is local in cut twenty-three; activation-worker and legacy
  generation/sync integration remain open.
- [x] Consume digest-bound activation-sync commands by exact partition manifest
  and stable idempotency key through explicit post-commit pull/invocation.
- [x] Claim pending commands transactionally and rediscover/retry them after lost
  invocation; prove no sync depends on enable-after-create Eventarc delivery.
  - HU-082 now supplies the versioned command codecs, Firestore discovery/claim/
    fencing/pre-batch authorization/completion repository, SDK-free executor, and
    idempotent fake-consumer evidence. HU-083 must integrate the real multi-season
    Sheets adapter, record durable external attempt/read-back evidence, and handle
    ambiguous outcomes without weakening that boundary.
- [x] Serialize commands with a workbook/partition epoch and lease; check current
  command/revision/digest before every batch, read back afterward, reject old-epoch
  retries, and block recovery until prior external work is proved terminal.
- [x] Validate backend-owned activation/repair/rollback-recovery/sync-correction
  last-mutation provenance in candidate `onShiftWritten` through before/after
  change for creates/updates or exact before-image version/path for deletes, plus
  the allowlisted registry/digest; no-op backend events without suppressing later
  ordinary events that retain old metadata.
  - [x] Upstream HU-082 supplies the strict SDK-free classifier, repair/sync-
    correction registry codec, stable controlled-event digest, and fake-consumer
    vectors. Cut seven wires the exported trigger; live side-effect evidence remains open.
- [ ] Retain terminal operation tombstones/event ledgers past the maximum retry
  horizon and fail closed/alert on unknown changed backend markers.
  - [x] Upstream HU-082 supplies schema-v1 retention policy, operation binding,
    controlled/rejected ledger codecs, deterministic document paths, exclusive
    cleanup semantics, and SDK-free producer fixtures. HU-083 still owns durable
    create-or-exact-replay persistence, configured policy, alert delivery, and
    real trigger/integration evidence.
- [x] Preserve manual fields according to the frozen contract.
- [ ] For every imported/manual delivery-lead mutation, CAS/digest predecessor/
  current/successor assignment, completion, and revision across tabs. Reject equal
  adjacent leads/stale completion; recompute only uncompleted planned helper and
  preserve completed actual helper history plus rotation ownership.
- [x] Add structured summaries and typed failures without sensitive data.

## 3. Security and documentation

- [x] Update Firestore contract/Rules only where required by partition metadata.
- [x] Prove clients and Sheet imports cannot mutate rotation ownership/cursor.
- [x] Prove clients cannot forge any backend-operation provenance to suppress
  ordinary export/notification behavior, and prove unchanged retained provenance
  is never treated as a new backend mutation.
- [ ] Keep all new Rules changes undeployed until HU-085 and provide their exact
  test evidence plus deployment/rollback surface in the handoff.
- [x] Update `functions/README.md` for stable workbooks, seasonal tabs,
  environment isolation, aliases, and develop repair.
- [x] Update relevant English and Spanish data-contract documentation.
- [x] Scan the first-cut changed docs/fixtures for secret-like material; no live
  workbook ID, participant name or phone was copied into the layout inventory.

## 4. Audit, repair, and rollback tooling

- [x] Implement offline read-only audit for gaps, duplicates, eligibility, rounds,
  helpers, market groups, sources, and cross-store disagreement. Trusted live capture
  and historical membership/boundary evidence remain open.
  - [x] Tenth local cut adds bounded offline snapshot diagnostics for dates,
    identities, source/projection validity, current eligibility, helpers and
    cross-store comparison. Live capture/completeness and historical rotation/
    bootstrap/round evidence remain unevaluated; no repair readiness is claimed.
  - [x] Eleventh local cut adds v2 bootstrap, owner/round positions and final-cursor
    consistency using HU-082 resolution/consumption. Alternative conflicts and
    legacy helper gates are explicit; trusted capture, approved horizon and
    historical membership/boundary evidence still prevent repair readiness.
- [x] Implement deterministic offline dry-run repair plan and digest (v1–v5);
  this does not authorize apply or certify a real-data deferral manifest.
  - [x] Twelfth local cut emits a deterministic review diff from two explicit v2
    snapshots: normalized projections, lineage and exact managed cells. Full
    document write/CAS, baseline and rollback manifests remain pending; no apply
    readiness or live validation is claimed.
  - [x] Thirteenth local cut binds review plans to all original shift documents,
    nanosecond update times and exact create absences through the HU-082 typed
    value codec. Full payloads/extra fields survive; capture authenticity, live
    completeness and final write/terminal/retention/rollback assembly remain open.
  - [x] Fourteenth local cut compiles explicit final public payloads into a v3
    review, including lineage-only changes, revision rules, exact source guards,
    repair terminal/retention and local controlled-event rehearsal using HU-082.
    Extra-field loss and malformed prior provenance reject materialization.
    Live authority, atomic execution/admission, baseline and inverse remain open.
- [ ] Define the immutable post-repair two-type migration-baseline revision/digest;
  persist/read it back only on safe apply, or emit its expected digest plus exact
  HU-085 materialization manifest on zero-write deferral.
  - [x] Fifteenth local cut defines a digest-bound baseline template covering both
    types, full final payloads, expected grid and original/resolved HU-082 bootstrap
    evidence. Shared lineage attachments await captured authoritative aggregates;
    no baseline or rotation state is persisted.
  - [x] Sixteenth local cut binds complete maintenance/rotation captures and emits
    both baseline/cursor attachments with state revisions and read-time CAS.
    HU-082 parsers enforce closed maintenance, active lineage, null leases and
    captured cursor/frontier consistency; live capture authenticity remains open.
- [x] Fail closed when historical rotation ownership is ambiguous.
- [ ] Audit and materialize—or defer by exact manifest—each HU-082 typed bootstrap
  mapping: ordered UIDs, round/cursor, stable tie order, evidence, and delivery
  predecessor-helper gate. Fail closed on any unapproved conflict.
- [ ] Require exact project/environment/workbook, validated backup references,
  mode, and reviewed digest before apply.
- [ ] Define a separate temporary keyless evidence auditor with read/export-only
  source access, create-only encrypted evidence output, exact ACL/retention,
  digest/read-time/restore provenance, negative apply/source-write/impersonation
  permissions, and revocation/read-back.
- [ ] Make apply and rerun idempotent.
- [ ] Implement bounded rollback/reconciliation support.
  - [x] Fifteenth local cut emits clone-only inverse payload/cell instructions,
    exact original/expected grid images and post-state read guards, including
    untouched neighbors and created-object cleanup. In-memory round trips pass;
    physical commit/restore, read-back CAS and live inverse provenance remain open.
  - [x] Sixteenth local cut adds loopback/demo-only Firestore forward/inverse
    execution with HU-082 admission/fences, verified receipt replay and full
    before-image restoration. Synthetic emulator commits pass; real backup,
    multi-store recovery and live inverse event authority remain open.
- [ ] Add tests for audit, dry-run zero writes, apply, rerun, wrong target,
  partial failure, and rollback.

## 5. Automated validation

- [x] Run Functions `npm run lint` (first local cut, zero diagnostics).
- [x] Run Functions `npm run build` (first local cut).
- [x] Run Sheets adapter, migration, backend security, and relevant Rules suites.
  Cut eighteen: 492 local passes / 51 emulator-only skips; nine focused emulator
  scripts pass 160 executions / zero skips. See acceptance review for overlap and
  exact coverage; this is not execution of every skipped HU-082 case.
- [ ] Run HU-082 Android/iOS regression suites if shared fields change.
  Not triggered in cut eighteen: no mobile source/wire change; live app read-back
  remains required by the selected safe-apply/deferral acceptance path.
- [x] Run `git diff --check` and validate local/document links in changed files
  (first local cut; no findings).
- [ ] Prove the complete request/adapter/notification pipeline locally and in
  emulators without a shared-project deploy.
  - [x] New private sync/import, controlled-event audit and repair rehearsal pass
    focused emulators in cut eighteen. Ordinary/full/override legacy routing and
    complete notification/alert integration remain distinct acceptance gaps.

## 6. Develop rehearsal

- [ ] Through that evidence auditor, create and verify recoverable develop Firestore/
  workbook backups without source mutation; record controls, then revoke/read back
  the auditor before enabling the repair principal.
- [ ] Run audit and attach results to #267.
- [ ] Run dry-run and review every proposed write.
- [ ] Model every currently deployed trigger reached by each proposed write,
  including legacy export/notification behavior from `onShiftWritten`.
- [ ] Inventory and recoverably fence/drain every affected Firestore/workbook writer,
  including apps/admins, Functions, schedulers/retries, scripts, human editors,
  Apps Script/add-ons, API/OAuth/service accounts, and Shared Drive automation. If
  a bounded fence has any production/project-wide impact or cannot prove zero writers,
  take the zero-write HU-085 branch.
- [ ] Resolve My Drive/Shared Drive owner feasibility, transitive group/domain/DWD/
  Workspace-admin authority, and human pending-offline state. Require controlled
  server reload/base revision on reopening; otherwise take zero-write deferral.
- [ ] Manifest a keyless, timeboxed repair principal/workload with exact develop
  targets/actions/guards, explicit database/project IAM blast and negative production
  checks. Prove it is sole writer during apply and revoke/freeze/read back all Cloud/
  Firestore/Drive/Workspace authority and audit before releasing the fence.
- [ ] Confirm compatibility with current Rules/mobile reads and a proven
  fence/drain for every reached trigger; otherwise stop after dry-run.
- [ ] Present the final trigger/writer/effective-authority manifest, fence/drain proof,
  snapshot/CAS/batch plan, rollback, and expiry for explicit apply authorization;
  invalidate that authorization on any later delta.
- [ ] Before live apply, commit-rehearse the exact forward and inverse manifests in
  an isolated clone restored from the reviewed backup; prove full restoration and
  created-object cleanup without using live develop as the rehearsal target.
- [ ] Immediately before apply, rehash both stores and recheck document update times,
  workbook revision/activity, and digest. Use per-document CAS plus per-batch Sheets
  revision/digest guards/read-back; hold the fence through reconciliation and
  rollback rehearsal, and stop on any mismatch.
- [ ] Include predecessor/current/successor assignment, completion, and revision for
  every lead change, including cross-tab boundaries. Prove equal-adjacent/stale races
  fail, uncompleted planned helper recomputes, completed actual helper stays frozen,
  ownership is unchanged, and replay is idempotent.
- [ ] If trigger-safe, apply only through the dedicated bounded script and rerun
  audit to zero applicable violations; deploy no Function or Rules revision,
  prove delivery carryover/market merge against live develop, prove no unexpected
  request/export/notification, read back Firestore/Sheets/Android/iOS, and
  persist/read back the immutable two-type post-repair baseline revision/digest,
  leaving that repaired state terminal. Run the live inverse only to recover a
  failed/mismatched apply; such recovery does not count as safe-apply completion.
- [ ] If deferred, attach the zero-write digest, exact unresolved writes, trigger
  model, expected baseline digest, and rollback/materialization manifests for
  HU-085; prove the equivalent carryover, market-30, request/export/notification,
  app read-back, and recovery paths in local/emulator fixtures, and verify no live
  baseline was written and the source-state hash remained unchanged.

## 7. Closure and HU-085 handoff

- [ ] Update the spec DoD and issue criteria with exact evidence.
- [ ] Preserve legacy configuration until its removal receives separate review.
- [ ] Hand off the integrated commit, parameter contract, Functions surface,
  deferred manifests/dry-runs (never the HU-083 script principal/credential),
  real consumer ownership, baseline/dry-run digest formats and references, develop
  evidence, and residuals to HU-085.
- [ ] Link focused commits and PR to issue #267.
- [ ] Report any Android/iOS parity or live-data residual explicitly.
