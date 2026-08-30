# Tasks - HU-083 (Multi-season shift Sheets and develop repair)

## 0. Dependency and read-only inventory

- [x] Accept the frozen HU-082 integration boundary in
  `../hu-082-continuous-seasonal-shift-rotation/hu-083-handoff.md`; retain the
  implementation/merge dependency and every live-operation gate below.
- [ ] Verify HU-082 / #266 and ADR-0013 are integrated.
- [ ] Freeze base commit and create the dedicated HU-083 implementation branch.
- [ ] Resolve the exact develop Firebase project and environment path.
- [ ] Record that `{develop}` and `{production}` share project-wide Functions
  revisions and Firestore Rules; forbid a develop-only shared deploy.
- [ ] Inventory the develop workbook ID, tab names/aliases, headers, formulas, protected
  ranges, row counts, and sharing principals without writing.
- [ ] Capture applicable Functions parameter names/presence without logging
  values.
- [ ] Export/hash a read-only Firestore and Sheets baseline.

## 1. RED Sheets contract

- [ ] Freeze canonical seasonal tab names and explicit legacy aliases from the
  inventory.
- [ ] Define stable row identity, ownership, assignment, source, provenance, and
  tab-partition metadata.
- [ ] Add RED tests for tab creation, existing-tab merge, replay, concurrency,
  and carryover plus later-generation coexistence.
- [ ] Add RED import tests for multiple tabs and partial/missing-tab failure.
- [ ] Add RED tests proving manual edits cannot change rotation state/ownership.
- [ ] Add RED tests for develop/production isolation and missing configuration.

## 2. Multi-season Sheets adapter

- [ ] Extract environment configuration from `functions/src/index.ts`.
- [ ] Replace fixed single ranges with explicit workbook plus seasonal-tab
  routing.
- [ ] Implement idempotent list/discover/create for tabs.
- [ ] Replace whole-tab clear/rewrite with stable-identity merge/upsert.
- [ ] Import the union of allowed tabs and bound reconciliation to successfully
  read partitions.
- [ ] Route full export, incremental export, and overrides by explicit tab
  metadata.
- [ ] Consume digest-bound activation-sync commands by exact partition manifest
  and stable idempotency key through explicit post-commit pull/invocation.
- [ ] Claim pending commands transactionally and rediscover/retry them after lost
  invocation; prove no sync depends on enable-after-create Eventarc delivery.
  - HU-082 now supplies the versioned command codecs, Firestore discovery/claim/
    fencing/pre-batch authorization/completion repository, SDK-free executor, and
    idempotent fake-consumer evidence. HU-083 must integrate the real multi-season
    Sheets adapter, record durable external attempt/read-back evidence, and handle
    ambiguous outcomes without weakening that boundary.
- [ ] Serialize commands with a workbook/partition epoch and lease; check current
  command/revision/digest before every batch, read back afterward, reject old-epoch
  retries, and block recovery until prior external work is proved terminal.
- [ ] Validate backend-owned activation/repair/rollback-recovery/sync-correction
  last-mutation provenance in candidate `onShiftWritten` through before/after
  change for creates/updates or exact before-image version/path for deletes, plus
  the allowlisted registry/digest; no-op backend events without suppressing later
  ordinary events that retain old metadata.
  - [x] Upstream HU-082 supplies the strict SDK-free classifier, repair/sync-
    correction registry codec, stable controlled-event digest, and fake-consumer
    vectors. HU-083 still owns trigger wiring and real side-effect evidence.
- [ ] Retain terminal operation tombstones/event ledgers past the maximum retry
  horizon and fail closed/alert on unknown changed backend markers.
  - [x] Upstream HU-082 supplies schema-v1 retention policy, operation binding,
    controlled/rejected ledger codecs, deterministic document paths, exclusive
    cleanup semantics, and SDK-free producer fixtures. HU-083 still owns durable
    create-or-exact-replay persistence, configured policy, alert delivery, and
    real trigger/integration evidence.
- [ ] Preserve manual fields according to the frozen contract.
- [ ] For every imported/manual delivery-lead mutation, CAS/digest predecessor/
  current/successor assignment, completion, and revision across tabs. Reject equal
  adjacent leads/stale completion; recompute only uncompleted planned helper and
  preserve completed actual helper history plus rotation ownership.
- [ ] Add structured summaries and typed failures without sensitive data.

## 3. Security and documentation

- [ ] Update Firestore contract/Rules only where required by partition metadata.
- [ ] Prove clients and Sheet imports cannot mutate rotation ownership/cursor.
- [ ] Prove clients cannot forge any backend-operation provenance to suppress
  ordinary export/notification behavior, and prove unchanged retained provenance
  is never treated as a new backend mutation.
- [ ] Keep all new Rules changes undeployed until HU-085 and provide their exact
  test evidence plus deployment/rollback surface in the handoff.
- [ ] Update `functions/README.md` for stable workbooks, seasonal tabs,
  environment isolation, aliases, and develop repair.
- [ ] Update relevant English and Spanish data-contract documentation.
- [ ] Add a secret/identifier hygiene check for committed docs and fixtures.

## 4. Audit, repair, and rollback tooling

- [ ] Implement read-only audit for gaps, duplicates, eligibility, rounds,
  helpers, market groups, sources, and cross-store disagreement.
- [ ] Implement deterministic dry-run repair plan and digest.
- [ ] Define the immutable post-repair two-type migration-baseline revision/digest;
  persist/read it back only on safe apply, or emit its expected digest plus exact
  HU-085 materialization manifest on zero-write deferral.
- [ ] Fail closed when historical rotation ownership is ambiguous.
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
- [ ] Add tests for audit, dry-run zero writes, apply, rerun, wrong target,
  partial failure, and rollback.

## 5. Automated validation

- [ ] Run Functions `npm run lint`.
- [ ] Run Functions `npm run build`.
- [ ] Run Sheets adapter, migration, backend security, and relevant Rules suites.
- [ ] Run HU-082 Android/iOS regression suites if shared fields change.
- [ ] Run `git diff --check` and validate every local/document link.
- [ ] Prove the new request/adapter/notification pipeline locally and in
  emulators without a shared-project deploy.

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
