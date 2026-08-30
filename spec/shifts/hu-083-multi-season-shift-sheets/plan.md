# Plan - HU-083 (Multi-season shift Sheets and develop repair)

## 1. Delivery strategy

Separate code correctness from live rollout. First replace the fixed-range
adapter with a tested multi-season projection and build read-only audit tooling.
Then rehearse backup, dry-run, apply, reconciliation, and rollback in develop.
Production access, configuration, deployment, stage/activation, and recovery
are a separate story, HU-085, with a separate explicit authorization gate.

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
