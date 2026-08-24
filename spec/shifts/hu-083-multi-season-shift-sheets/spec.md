# HU-083 - Multi-season shift Sheets and develop repair

## Metadata

- issue_id: #267
- priority: P1
- platform: backend
- status: draft
- depends_on: HU-082 / #266
- architecture: ADR-0013 (proposed)

## Context and problem

The current Sheets bridge is configured around one delivery range and one market
range. The planner can create a seasonal tab, but other import/export paths
still rely on fixed ranges and the whole-sheet writer clears a tab before
rewriting it. That contract cannot safely represent a rotation which carries
positions into a following season and later appends more positions there.

The develop test workbook contains an incomplete/incorrect 2026-27 projection.
HU-083 builds and rehearses the repair against that environment after HU-082
proves the new rotation contract. Connecting and mutating the production
workbook is deliberately separated into HU-085.

`develop` and `production` are logical paths inside the same Firebase project,
`reguerta-9f27f`. They currently share deployed Functions revisions and one
global Firestore Rules release. A deploy made only to test `develop` would also
replace the code or Rules serving `production`, so HU-083 may not use a shared
project deploy as its live-development test boundary.

## User story

As a cooperative administrator, I want the develop shifts workbook to manage
seasonal tabs automatically so that continuous rotations can be reviewed,
synchronized, audited, and repaired without losing carryover or manual
assignments.

## Workbook and naming decision

- Keep one stable workbook for develop/test and one stable workbook for
  production.
- Use one tab per shift type and season. The tab is selected by the actual shift
  date, including inherited carryover.
- Create a missing next-season tab automatically and idempotently.
- If the tab already exists, merge into it; never clear the whole tab merely to
  add carryover or a later round.
- Inventory the existing `Torre`, `turnos-reparto`, and `turnos-mercado` names
  before freezing a canonical formatter and explicit legacy aliases. Correctness
  must not depend on one hard-coded 2025-26 tab.

A Google Sheets/Drive shared link is based on the workbook identifier, not its
display name. Renaming the existing workbook therefore does not require a new
link or new permissions. Creating a new workbook every season would require
repeating configuration, sharing, validation, and migration, so it is rejected
unless an operational limit is demonstrated later.

## Authority and synchronization

- Firestore rotation state from HU-082 is authoritative for cohort, round,
  cursor, rotation ownership, and planner publication.
- Firestore shifts are the mobile source. Sheets is a human-readable projection
  and an allowed effective-assignment input through the existing governed sync.
- A manual Sheet edit may change an effective assignee/status within validated
  rules. It must not change `rotationOwnerUserId`, round, cursor, or cohort.
- Any import, override, or manual edit that changes a delivery's effective lead
  includes predecessor/current/successor assignment, completion, and revision in one
  CAS/digest, even across seasonal tabs. Adjacent effective leads must remain
  distinct. If the predecessor is uncompleted, its planned helper is recomputed from
  the new lead; if completed, its frozen actual helper/revision/time remains unchanged.
  A stale completion race or equal-adjacent result rejects the whole import/edit. The
  final materialized uncompleted delivery stays pending when no following lead exists.
- Every row has a stable logical identity and explicit type, date, season/tab,
  rotation owner, effective assignee, source/provenance, and synchronization
  metadata.
- Import reads the union of configured/discovered seasonal tabs. A failed or
  missing tab cannot authorize deletion of Firestore rows from another tab.
- Full export, incremental export, and override/update paths route by the row's
  recorded tab identity rather than the legacy single configured range.
- Planner activation never relies on one `onShiftWritten` event per row. HU-082
  owns and atomically emits the versioned command/marker/operation-registry
  contract; HU-083 owns the real multi-season consumer and candidate trigger. The
  adapter explicitly pulls/is invoked after commit, transactionally claims each
  pending command, and reconciles its complete partition manifest idempotently.
  Pending-command discovery/retry survives a lost invocation; no command depends
  on enabling an Eventarc trigger after its creation event.
- A monotonic epoch and lease serialize commands per workbook/partition. Before
  every Sheets batch, the worker validates that its command, epoch, active revision,
  and digest are still current, then records workbook read-back. Recovery first
  stops/supersedes the activation command and drains its worker/external call; if
  drain cannot be proved, recovery fails closed instead of interleaving writes.
- Candidate trigger code validates backend-owned activation/repair/rollback-
  recovery/sync-correction last-mutation provenance by comparing before/after and
  resolving a create/update's changed marker against the allowlisted operation
  registry/digest, or validating a recovery delete's before-image marker/version/
  path against its exact manifest. Only those exact events no-op legacy side
  effects. A later ordinary edit/delete retaining old metadata still processes
  normally. Registry tombstones/event ledgers outlive the maximum delivery retry
  window, so delayed replay cannot be reclassified after cleanup.

## Environment configuration boundary

- Workbook identifiers and any allowlist/namespace are environment-scoped
  Functions parameters; real values are never committed.
- Develop and production may not silently fall back to one another.
- HU-083 configures and mutates only the bounded develop target after its own
  explicit apply approval.
- The new Functions adapter and any Rules changes are validated locally and in
  emulators. HU-083 performs no Functions or Rules deployment to the shared
  project.
- A live develop repair may use only the dedicated audit/dry-run/apply scripts,
  an exact `{develop}` allowlist, verified backups, and the reviewed digest. It
  may proceed only when the repaired documents remain compatible with the
  currently deployed Rules, mobile reads, and every deployed trigger reached by
  each proposed write.
- A separate temporary keyless evidence auditor captures/validates the exact
  Firestore and workbook backups. It has read/export-only source access and may
  create only encrypted, ACL- and retention-bound evidence artifacts; it cannot
  mutate source data, invoke apply, overwrite/delete retained artifacts, or
  impersonate the repair principal. Record source revision/read time, digest,
  restore-test provenance, revocation, and read-back before apply.
- Before apply, inventory and recoverably fence/drain every independent writer of
  the affected develop Firestore paths and workbook: apps/admins, current Functions,
  scheduled sync/import/export and retries, scripts, human editors, Apps Script,
  add-ons, OAuth/API clients, service accounts, and Shared Drive automation. Keep
  the bounded fence until cross-store read-back and rollback rehearsal finish. If
  any writer cannot be fenced without touching production or making any project-wide
  control-plane change, choose the zero-write HU-085 deferral branch. HU-083 approval
  cannot expand this environment boundary.
- Reuse HU-085's effective-authority standard: resolve My Drive/Shared Drive owner
  feasibility, transitive group/domain membership, Domain-Wide Delegation/OAuth and
  Workspace-admin paths, plus editor online/closed/no-pending-offline confirmation.
  Freeze/digest those paths or prove absence; otherwise only zero-write deferral is
  allowed. Reopening requires a server reload/base revision and observed read-back.
- The direct apply script's own repair principal/workload is part of the writer
  manifest. It uses no long-lived key file, has an exact time window/targets/actions,
  records the unavoidable database/project Firestore IAM blast radius, and enforces
  fail-closed `{develop}` path/input/digest guards. While apply runs it is the sole
  effective data/workbook writer. It is revoked/frozen and read back with Cloud,
  Firestore, Drive, and Workspace audit immediately afterward. If this identity or
  its production-negative evidence cannot be authorized, apply remains zero-write.
- Immediately before apply, rehash the exact input, recheck each Firestore
  `updateTime`, workbook revision/activity/digest, and prove no pending editor path.
  Each Firestore mutation uses the expected update-time/version precondition; every
  Sheets batch validates the preceding revision/digest and records read-back. Any
  mismatch stops and reconciles/rolls back under the fence because Firestore and
  Sheets are not one transaction.
- The dry-run must model current trigger side effects, including legacy Sheets
  export and notification paths such as `onShiftWritten`. Any write that could
  invoke an uncontained trigger is deferred unless a proven reversible fence
  suppresses and drains that exact trigger. Otherwise the live step stops after
  audit/dry-run and is handed to HU-085.
- HU-085 owns production identity, access, parameters, deployment, staged
  publication, and recovery; none is a completion condition for HU-083.

## Migration and repair

The existing test workbook and Firestore data are repaired only by a dedicated
tool with `audit`, `dry-run`, and explicit `apply` modes.

The audit must detect at least:

- repeated or skipped rotation owners;
- incomplete delivery horizon or round;
- market dates/groups/position counts outside the contract;
- duplicate stable identities or dates;
- invalid `source = planner` values;
- broken delivery helper continuity;
- ineligible owners/assignees;
- disagreement between Firestore and every affected seasonal tab;
- ambiguous historical order caused by swaps or manual edits;
- missing/conflicting HU-082 bootstrap source, ordered UIDs, round/cursor, stable tie
  order, or last-delivery registered-helper continuity.

Ambiguous rotation ownership fails closed. The tool must not infer the queue
from effective assignments when swaps or coverage could have changed them.
It emits an explicit admin mapping artifact for approval; apply may only materialize
that exact mapping/digest. A safe apply includes both typed mappings in its immutable
post-repair baseline. A zero-write handoff includes the expected mappings and exact
HU-085 materialization manifest without claiming they already exist live.

## Scope

### In scope

- Environment-scoped, multi-season Sheets configuration.
- Idempotent tab discovery/creation and stable naming/alias policy.
- Merge/upsert, bounded import reconciliation, and correct export routing.
- Idempotent explicit activation/recovery sync commands plus safe backend-
  operation event suppression in candidate trigger code.
- Immutable post-repair migration-baseline artifacts and the deterministic
  deferred-baseline materialization handoff required by HU-082/HU-085 lineage.
- Test-data audit and repair tooling with backup and rollback.
- Direct-script develop backup, repair rehearsal, reconciliation, and rollback
  without deploying shared Functions or Rules.
- Verification that both apps read the final Firestore projection.
- Functions documentation, tests, operational evidence, and relevant bilingual
  data-contract documentation.

### Out of scope

- Defining or changing the rotation algorithm and mobile request lifecycle
  delivered by HU-082.
- The unapproved joins/departures/coverage/credits policy in HU-084.
- Production workbook sharing, parameter mutation, deployment, repair, stage, or
  activation, all of which belong to HU-085.
- Any Functions or Firestore Rules deployment to the shared Firebase project.
- A live request through newly implemented Functions before HU-085. HU-083's
  new request/adapter pipeline is proven locally and in emulators.
- Using a Sheet row as the authority for rotation order.
- Credential-key files or mutation before explicit bounded authorization.

## Linked functional requirements

- RF-TURN-03, RF-TURN-04, RF-TURN-07
- RF-IA-02, RF-IA-03
- HU-017, HU-020

## Acceptance criteria

- [ ] Develop uses one explicit stable workbook identifier and the configuration
  contract cannot fall back across environments.
- [ ] Missing seasonal tabs are created idempotently from actual shift dates and
  existing tabs are merged without whole-tab data loss.
- [ ] Inherited carryover and the following generation coexist in the same
  next-season tab without duplication or overwrite.
- [ ] Import reads all allowlisted seasonal tabs and stale deletion is bounded
  to data from tabs read successfully in that run.
- [ ] Full export, incremental export, overrides, and manual assignment sync
  route to the correct seasonal tab.
- [ ] Each digest-bound activation-sync command reconciles only its exact
  partition manifest and is idempotent under retry. An explicit pull/invoked worker
  discovers and claims pending commands after commit, including after lost calls;
  enable-after-create Eventarc delivery is not part of the contract.
- [ ] Per-workbook/partition epoch and lease allow only one command in flight;
  activation retries fail after recovery supersedes their epoch, and recovery does
  not start until the prior worker/call is terminal with exact read-back evidence.
- [ ] Immediate/delayed/replayed activation, repair, rollback/recovery, or sync-
  correction `onShiftWritten` events cannot export or notify per row; ordinary
  edits retaining old metadata keep their contract and clients cannot forge/
  change the last-mutation marker or operation registry.
- [ ] Recovery deletes validate exact before-image version/path, operation
  tombstones/event ledgers survive the retry horizon, and unknown changed backend
  markers fail closed without side effects.
- [ ] Sheet edits cannot change rotation ownership, cohort, round, or cursor.
- [ ] Every effective delivery-lead change atomically validates distinct adjacent
  leads plus predecessor/current/successor completion/revisions across tabs. It
  recomputes only an uncompleted predecessor's planned helper, preserves completed
  actual helper history and ownership, and is idempotent under replay/race.
- [ ] Renaming the stable workbook preserves its ID/link and needs no seasonal
  configuration change.
- [ ] Audit and dry-run modes write nothing and report every ambiguity before an
  apply mode is allowed.
- [ ] Each type's bootstrap source, exact UID order, round/cursor, tie order, and
  evidence are reproducible. Delivery enforces the prior registered-helper gate;
  conflict requires approved mapping and never silently rewrites the helper.
- [ ] A validated backup and rollback point exist for both affected Firestore
  documents and develop workbook tabs before repair.
- [ ] A separate keyless read/export-only evidence auditor creates those backups in
  an encrypted, ACL- and retention-bound destination without source mutation.
  Revision/read time, digest, restore-test provenance, revocation, and read-back are
  recorded before apply.
- [ ] Before any live apply, the exact forward and inverse manifests both commit
  successfully in an isolated restored clone. A successful live apply terminates
  with develop repaired and its immutable baseline present; the inverse runs live
  only to recover a failed/mismatched apply, never as a success-path rehearsal.
- [ ] Any live develop apply proves a bounded all-writer Firestore/workbook fence,
  immediate source rehash, document update-time CAS, workbook revision/digest guard
  per batch, and post-write read-back while the fence remains held. An unprovable
  or project-wide fence forces zero-write deferral to HU-085.
- [ ] The keyless, timeboxed repair principal is manifested as sole writer with exact
  develop actions/guards, explicit database-wide IAM blast, negative production
  evidence, and terminal revocation/audit read-back; otherwise apply writes nothing.
- [ ] If the live trigger-safety gate passes, the 2026-27 apply leaves no
  duplicate, gap, source, helper, eligibility, group-size, or carryover
  violation and records one immutable post-repair migration-baseline revision/
  digest covering delivery and market. Otherwise a zero-write reviewed plan/
  digest, expected baseline digest plus materialization manifest, and explicit
  HU-085 deferral cover every unresolved violation without writing a live baseline.
- [ ] Local/emulator acceptance proves the new request, rotation, Sheets, and
  notification pipeline without a shared-project deployment.
- [ ] Any authorized live develop apply runs directly through the bounded repair
  script, proves no legacy/current trigger exported or notified unexpectedly,
  creates no planning request/notification, and reconciles affected Firestore,
  Sheets, Android, and iOS state.
- [ ] HU-083 deploys no Function or Firestore Rules revision to the shared
  Firebase project; incompatible live repair remains pending for HU-085.
- [ ] A performed develop apply has prior isolated-clone rollback rehearsal; a
  deferred apply hands HU-085 its exact rollback/materialization manifests, expected
  baseline reference, and verified dry-run evidence only. Its script principal or
  credentials are never reused for HU-085 mutations.

## Dependencies

- HU-082 / issue #266 must define and pass the rotation/projection contract.
- Extends closed HU-020 / issue #19. It closes the adapter/tooling/emulator gap
  and closes the develop real-data repair gap only if the trigger-safe apply
  branch runs; an accepted zero-write deferral moves that live develop apply to
  HU-085. HU-085 exclusively owns HU-020's production activation/manual
  acceptance residual.
- HU-085 consumes the integrated code and develop evidence for production
  activation; it is not blocked by HU-084.

## Risks and mitigations

- **Whole-tab erasure**: replace clear/rewrite with stable-identity merge and
  backup evidence.
- **Cross-environment writes**: require explicit project, environment, and
  workbook in every audit, dry-run, and apply command.
- **Ambiguous legacy queue**: fail closed and request an administrator mapping
  instead of guessing.
- **App/Sheet disagreement**: Firestore remains mobile authority and every live
  step ends with read-back and reconciliation.

## Definition of Done

- [ ] HU-082 dependency and ADR-0013 are integrated.
- [ ] Every unconditional criterion has evidence; the live-repair branch records
  either safe reconciled apply with prior isolated-clone inverse proof, recovery from
  a failed apply, or an accepted zero-write HU-085 deferral.
- [ ] Functions lint, build, Sheets, migration, security, and Rules suites pass.
- [ ] Local/emulator integration passes; any authorized trigger-safe direct-script
  repair/rehearsal and cross-platform read-back pass without a shared deploy.
- [ ] Documentation and issue evidence contain no committed identifiers/secrets.
- [ ] HU-085 receives the exact non-secret handoff contract and develop evidence.
- [ ] Issue and PR are linked and no parity gap remains unreported.
