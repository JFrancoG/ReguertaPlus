# Plan - HU-085 (Controlled production shift workbook activation)

## 1. Delivery strategy

Use one quiesced shared-project change window with explicit gates before:

1. maintenance fencing and any external mutation;
2. pre-maintenance additive-index readiness and the later shared Functions/Rules
   deploy;
3. deferred repair/production migration apply;
4. non-public seasonal staging;
5. public activation;
6. irreversible notification release and normal-traffic resume.

One activation covers a complete seasonal horizon plus required carryover, so it
is not a small canary. `preview` writes only private request/status/audit records
and has no domain/projection effects; `stage` writes a versioned candidate in a
separate backend-owned partition invisible to normal members/Sheets; `activate`
promotes the exact bounded public manifest and is the acknowledged visibility
boundary.

## 2. Authorization and mutation inventory

The packet enumerates separately:

1. additive-index readiness, temporary restrictive Rules, exact ingress/event
   disable operations, allowlisted rollout IDs, and drain;
2. every Rules-bypassing Admin SDK/server/IAM writer, its key/workload/job/script/
   console path, causal-drain or frozen state, effective-authority/Audit Logs
   baseline, and safe restoration;
3. temporary control-plane deployer plus Drive permission controller, their exact
   roles/targets/actions, rehearsed unaffected-prior/epoch-aware rollback, deployer narrowly
   bounded `actAs`/negative data-token proof,
   controller ACL/protection-only authorization and cell-digest audit, sealed
   recovery reauthorization, and terminal revocation;
4. temporary keyless evidence/backup auditor, its exact source read/export actions,
   create-only encrypted evidence destination, ACL/retention/immutability controls,
   artifact digests, restore-test provenance, and per-window revocation/read-back;
5. dedicated runtime account and minimum IAM bindings, or accepted Compute
   fallback, including both workbooks required by shared environment revisions;
6. workbook principal/role, every human/automated writer and execution source,
   editor/protection/API/trigger fence, revision/digest guard, and protected
   production parameter;
7. exact Function names/revisions, `serviceAccount` assignment, separate rollout
   operator invoker-only principal, negative direct-data/impersonation proof, and
   operator-only command endpoint/allowlist;
8. exact Rules/indexes release and readiness/rollback;
9. deferred develop and production migration documents/rows/tabs, each executed
   only by an exact digest-bound candidate-runtime operation;
10. one hidden migration-baseline revision/digest, its exact preview/stage/active
   two-type lineage, staged bundle objects, and the bounded single-transaction
   combined public projection/rotations/cursors/Sheets-sync-command manifest
   required by installed clients;
11. the separately bounded inverse recovery transaction, including prior-value
   restoration, created-object deletion, mutation markers, recovery sync command,
   and held-batch cancellation;
12. controlled Sheets sync, held outbox intents, notification release, and traffic
   resume.

For every partition it records objects that were present or absent and every
planned create/update/delete. An export alone is not rollback because it does not
remove newly created documents, events, rows, or tabs. Terminal operation
tombstones/event ledgers are intentional append-only recovery evidence rather
than business-state drift. Any refreshed target, snapshot, identity, digest,
diff, or revision invalidates approval.

## 3. Phased execution

### Phase 0 - Dependency and evidence gate

- Verify HU-082/HU-083 commits and accepted ADR/requirements.
- Attach Functions, planner, Sheets, trigger-model, security, Rules,
  local/emulator, mobile, and conditional develop-repair evidence.
- Prove planning-frontier, preview/stage/activate, outbox/release,
  maintenance-fence, mixed-revision, and recovery contracts.
- Prove the bootstrap temporary Rules deny the currently allowed affected admin
  writes, exact callable/HTTP/scheduled producers can stop new work, accepted
  event cascades can drain, and their triggers/deliveries can then be disabled.
- Prove a complete inventory and recoverable freeze/revocation of users/groups,
  service accounts/keys, Workload Identity, server jobs, schedulers/queues, CI/CD,
  scripts, and console operators that can bypass Rules on affected paths.
- Prove closing every upstream producer/independent writer makes exact current
  deliveries a causally bounded drain of already accepted work, with empty ledgers
  and a conservative quiet horizon. If not, abort HU-085 before data/workbook
  mutation and scope a separate bridge-revision story with full mixed-revision
  cutover, authorization, drain, and rollback.
- Prove every affected write reopened after maintenance carries the current write
  epoch and active revision; stale/offline legacy writes fail and unsupported direct
  clients remain closed or use a versioned callable/command path.
- Prove current flat-collection clients see neither migration nor stage and that
  the combined delivery-plus-market activation manifest fits one Firestore
  transaction; otherwise stop for an active-revision client migration.
- Prove each type's own frontier/replay independently, then prove one failed,
  stale, or oversize subplan leaves both prior rotations active with no side
  effects.
- Prove one immutable two-type baseline lineage and cleanup graph: migration
  baseline revision/digest -> combined preview digest -> staged bundle revision
  -> active bundle revision.
- Prove the operator-only IAM boundary can invoke exact repair, migration/bootstrap,
  preview/stage/activate, sync-correction, recovery, and cleanup commands while
  normal ingress remains closed, and selectively enabled workers reject every
  non-allowlisted sync/notification command. The operator can invoke only; it cannot
  write Firestore/Sheets or impersonate/mint tokens for the runtime.
- Prove every post-baseline repair, migration/bootstrap, preview lifecycle, stage,
  activation, sync correction, recovery, and cleanup write is an exact operation-
  ID/revision/digest-bound candidate-runtime command. The pre-rehearsed epoch-aware
  recovery revision is the only alternate executor and uses the same governed data
  identity; no HU-083 script, operator, deployer, controller, or auditor writes data.
- Prove activation/repair/rollback-recovery/sync-correction `onShiftWritten`
  events no-op legacy per-row side effects on delayed replay only when a changed
  before/after mutation marker validates against the operation registry/digest;
  later ordinary edits retaining old metadata remain active.
- Freeze commit, Function surface, Rules/indexes diff, runtime identity choice,
  and mutation manifests.

### Phase 1 - Final read-only preflight

- Revalidate project/paths/region, deployed revisions, effective accounts, event
  triggers/queues, and global Rules/indexes release.
- Capture all Rules-bypassing writers plus an effective-authority digest of inherited
  IAM ancestry/conditions/deny policies, service-account IAM, WIF, transitive groups,
  keys/workloads, recent Audit Logs, and affected-document hash/update-time state.
- Resolve the exact temporary control-plane deployer and Drive permission controller,
  credential/workload provenance and roles. Prefer preserved-revision traffic/
  Eventarc rollback without redeploy for unaffected surfaces and an epoch-aware
  compatibility revision or closed ingress for affected writers; otherwise bound
  `actAs` to candidate plus the
  exact prior runtime for allowlisted forward/rollback deploys only. Record negative
  data/token access, controller exact ACL/protection actions and
  cell-digest audit, sealed recovery path, and terminal revocation commands.
- Resolve a separate temporary keyless evidence/backup auditor. Freeze exact source
  read/export actions, create-only encrypted evidence destination, ACL, retention/
  immutability, artifact digest/read-time metadata, restore-test route, negative
  affected-data/source-workbook mutation permissions, and revocation/read-back.
- Revalidate the supplied workbook by protected fingerprint and inventory tabs,
  aliases, headers, formulas, protections, sharing, and configuration presence.
- Resolve `driveId`, My Drive versus Shared Drive, owners, members/roles, effective
  capabilities, bound scripts, transitive group/domain membership, Domain-Wide
  Delegation/OAuth scopes, Workspace admin paths, and the exact reversible fence.
- Inventory human offline-edit state and require online/closed/no-pending confirmation;
  define controlled reauthorization, forced server reload, base-revision rejection,
  post-reopen observation, and the read-only fallback for unconfirmed writers.
- Confirm legacy `TORRE 2025-26` and `MERCADO 2025-26` aliases.
- Audit develop deferral (if any), production rotation/shift state, and Sheets;
  collect one deterministic input snapshot.
- Compare exact candidate allowlists/manifests with current/absent external state.

### Phase 2 - Backup, dry-run, fence plan, and authorization

- Through the keyless evidence auditor, create/verify bounded Firestore snapshots
  and workbook copies/exports. It writes only immutable evidence artifacts and
  cannot alter affected application data or the source workbook.
- Record encryption, destination ACL, retention, source revision/read time, digest,
  and restore-test provenance; revoke/read back the auditor after the evidence window.
- Treat those as pre-drain recovery points only, never as the later migration or
  activation baseline.
- Record prior protected parameter, Function revision/service account, IAM,
  workbook sharing, Rules/indexes source/release, triggers, and queues securely.
- Record the exact recoverable privileged-writer freeze/revocation manifest and
  rehearse restoration without widening access beyond its prior state. Separate
  the causally bounded current-delivery drain—and abort evidence if absent—from
  post-drain candidate/operator authority.
- Record every human editor/offline-edit acknowledgement, Apps Script trigger/
  deployment, add-on, API/OAuth client, service account, Shared Drive automation,
  transitive group/domain/DWD/Workspace-admin authority, recent execution/Drive or
  Workspace event, and protected range. Prove an exact recoverable all-writer fence
  plus revision/content-digest drift check.
- If ordinary ACLs cannot fence a My Drive owner, stop and present a separate
  transfer/move decision. Rehearse on a fixture and require same file ID/link,
  bindings, permissions, and content read-back; never silently replace the workbook.
- Prove restore and exact cleanup of newly created objects without live overwrite.
- Measure and rehearse both the forward activation transaction and the distinct
  inverse recovery transaction against every Firestore limit; block the window if
  either exact frozen manifest cannot commit atomically for flat readers.
- Define canonical semantic equality for business/public state separately from
  client-inert append-only operation markers/tombstones/event ledgers and the
  monotonic security/write epoch plus hardened Rules/serving fence. Exclude only
  that manifested security/audit surface from byte equality/planner digests.
- Dry-run deferred develop repair, production migration, candidate staging,
  activation, Sheets sync, held events, and recovery; review every write/count.
- Record that Firestore server IAM is database/project scoped rather than path scoped.
  Freeze exact candidate roles, negative Auth/Storage/IAM/Secret/token permissions,
  app-level path/environment/operation guards and alerts, residual blast radius, and
  the stronger separate-project/database or mediated-writer alternative.
- Present fence/drain method, full-season/public-visibility blast radius, aborts,
  time limits, owners, and phase-specific recovery. Stop for explicit
  authorization.

### Phase 2A - Additive index readiness before maintenance

- Under separate explicit authorization, deploy only the reviewed additive
  indexes required by the candidate code using the same exact temporary control-
  plane deployer pattern; do not deploy Functions or open access.
- Wait outside the maintenance window until every required index is `READY` and
  verify both environment paths remain behaviorally unchanged.
- Apply the approved timeout/rollback for a failed build. Do not enter Phase 3
  with any required index pending.
- Revoke/read back the deployer's Phase 2A grant after submission/readiness; Phase 3
  requires a fresh time-bounded authorization and grant.

### Phase 3 - Bootstrap and enter maintenance, then provision external access

- Revalidate the approved packet.
- Provision/read back the temporary control-plane deployer only for exact
  allowlisted infrastructure actions. Prove it has no Firestore/Sheets/workbook/
  token path.
- Freeze/revoke unrelated privileged writers while keeping the inventoried current
  drain identities under observation only until intake closes. Verify IAM/log/
  workload/data state against the current checkpoint; abort on unknown or
  unmanifested change and record the next checkpoint.
- Deploy the tested temporary restrictive Rules that deny every affected direct
  client write, then disable exact callable/HTTP ingress and scheduled/event
  producers so no new work can enter; allow only named change-window operation
  IDs.
- After those controls read back closed, prove every independent privileged writer
  is frozen and leave exact old event deliveries enabled only for the causal set
  already accepted during the intake transition. Drain planning, shift, swap,
  override, Sheets, notification work, and every cascade; require empty queues/
  ledgers plus the conservative quiet horizon. A legacy revision is never described
  as event-ID-filtered. Abort before further mutation and scope a separate bridge-
  revision story if causal quiescence fails.
- After every queue/event ledger is terminal, revoke/disable and read back every
  causal-drain identity/revision. No migration or candidate data write starts until
  only the subsequently provisioned candidate runtime can write data.
- After Sheets drain is terminal, provision the named Drive permission controller,
  apply/read back the exact fence for every human/automated workbook writer, and
  verify effective group/domain/DWD/Workspace authority and Drive/Workspace activity.
  Require every prior editor's online/closed/no-pending-offline acknowledgement.
  Audit exact ACL/protection actions plus unchanged cell digest, then freeze/revoke
  the controller and prove zero continuing workbook data-write paths.
- Reauthorize the keyless evidence auditor through a sealed exact-action packet and
  capture new post-drain Firestore backups and workbook copy/revision plus every
  present/absent object, hash, planner input, recovery manifest, and forward/inverse
  transaction budget. Rebuild and compare the packet against this quiescent state.
  On any manifest delta, rerun exact forward/inverse commit rehearsal in an isolated
  restored clone, then obtain renewed phase authorization before further mutation.
  Revoke/read back the auditor and verify evidence ACL/retention before continuing.
- Through the infrastructure deployer, provision the dedicated service account and
  exact minimum Cloud IAM, or record accepted Compute fallback. Record unavoidable
  project/database Firestore data scope, deny unrelated Auth/Storage/IAM/Secret/
  token authority, and verify candidate path/environment/operation guards and alerts.
  Do not yet assign a new Function `serviceAccount`; the deployer never grants workbook access.
- Through a second sealed exact-action reauthorization of the Drive controller,
  grant only the candidate runtime's reviewed workbook role, audit unchanged cell
  digest/activity, revoke/read back the controller, and prove the candidate is the
  sole workbook data writer. Shared revisions retain minimum access to both stable
  workbooks with protected cross-route guards.
- Provision the separate rollout operator principal/IAM for the exact operator-
  only endpoint. Grant invoker only: no Firestore/Sheets role, runtime
  impersonation, service-account token creation, or mobile-admin authority.
- Set the protected production workbook parameter and read back its fingerprint
  without exposing the value.
- Immediately before every Phase 5+ migration, preview, stage, activation, sync,
  notification, recovery, and resume gate, repeat the effective IAM ancestry/SA/WIF/
  group/deny-policy plus Drive/Workspace authority/log/data check against the prior
  expected checkpoint. After each authorized operation, record its exact authority/
  data result as the next checkpoint; any unmanifested effective-access drift
  invalidates approval even when a top-level etag is unchanged.

### Phase 4 - Exact shared-project deploy and readiness

- Re-run Functions `npm run lint`, `npm run build`, planner/Sheets/security/Rules
  suites, platform regressions, diff, and secret scans on the frozen commit.
- Deploy only authorized Functions; apply a dedicated `serviceAccount` only in
  those candidate Gen2 revisions.
- Deploy/read back the IAM-restricted rollout execution endpoint and exact
  maintenance operation allowlist while normal client/admin ingress stays closed.
- Deploy the exact candidate Rules release while retaining all temporary
  maintenance write denials; do not restore normal client-write Rules yet.
- Prove the candidate Rules/server contract rejects every affected write with a
  stale/absent maintenance epoch or active revision before any ingress can reopen.
- While the restrictive Rules/ingress barrier remains closed, invoke/read back the
  HU-082 `enterMaintenance` transaction to atomically mark closed and advance the
  epoch. Abort if a crash/retry cannot prove the exact idempotent state transition.
- Verify every required additive index is still `READY`; any newly discovered
  index requirement aborts the window instead of building during outage.
- Verify candidate revisions/accounts, Rules release, health/logs, and that old /
  mixed revisions cannot process unapproved events while the fence remains.
- Verify Sheets access from the deployed runtime and smoke both environment paths
  read-only. Roll back the complete mutated surface on failure.

### Phase 5 - Digest-bound develop repair and hidden production bootstrap

- Revalidate the input snapshot/digest and create/update/delete manifest.
- Require the post-drain quiescent baseline and its phase authorization, never the
  pre-drain recovery snapshot.
- If HU-083 deferred develop repair, treat its script as a dry-run/manifest producer
  only. Invoke the exact digest-bound `repair` operation through the invoker-only
  boundary; the candidate runtime applies and reads back the plan, or its exact
  recovery command restores it before continuing. Never reuse the HU-083 principal.
- Build production rotation/source/projection normalization only inside the
  hidden immutable migration-baseline revision. Preserve every existing public
  shift and active cursor/frontier. The initial cursor/frontier bootstrap is
  merely proposed here and commits only at activation; HU-083 historical
  backfill never advances an already active live cursor.
- Invoke that hidden `migration/bootstrap` only through its exact candidate-runtime
  operation ID/revision/digest and record the before/after/absent-object read-back.
- Prove no legacy export/notification trigger escaped containment.
- Atomically change backend-owned last-mutation kind/ID/revision fields on each
  repair row and record the before/after validation plus queued-event disposition
  expected when candidate triggers resume.
- Re-audit Firestore/Sheets, prove normal member apps still see the unchanged
  public revision, and inspect normalized candidate data only through the
  authorized admin boundary.
- On any failure, restore changed objects, remove exact newly created objects,
  restore authorized business/external configuration, advance the security epoch,
  retain hardened Rules/epoch-aware serving (or closed affected ingress), and keep
  HU-085 open.

### Phase 6 - Side-effect-free production preview

- Run one allowlisted delivery-plus-market `preview` bundle, with each typed
  subplan naming its own current planning frontier/replay.
- Invoke it only through the rollout operator boundary; do not reopen normal
  mobile/admin request ingress.
- Require the exact `migrationBaselineRevision`/digest as its only migration
  input; never fall back to the legacy public projection.
- Prove its only writes are private request/status/audit records and prove no
  rotation, candidate/public shift, Sheet, outbox, or ledger mutation plus exact
  equality with the authorized snapshot/digest, counts, groups, helpers, and
  future projections.
- Any drift triggers the complete pre-activation recovery packet, not merely a
  pause with mutated deploy/config left behind.

### Phase 7 - Non-public stage

- Obtain authorization for the exact preview digest and full-season candidate.
- Run allowlisted `stage`; write only one two-type bundle candidate/manifest.
- Invoke it only through the rollout operator boundary and exact operation ID.
- Bind the staged bundle revision as the sole child of that baseline/combined
  preview digest; reject a different, missing, mutable, or already-parented
  lineage or either invalid subplan.
- Verify normal member queries, active rotation/cursor, Sheets, and all current /
  old notification consumers cannot observe it.
- Read the candidate through the authorized admin boundary and reconcile planner
  invariants plus Android/iOS candidate decoding/rendering.
- On failure, remove the exact candidate objects and execute pre-activation
  recovery.

### Phase 8 - Public activation and reconciliation

- Present staged evidence and obtain separate approval for public activation.
- Recheck that the complete create/update/delete projection, rotation/cursor,
  active metadata, new write epoch/active revision, digest-bound Sheets-sync commands, and held-intent manifest
  for both types fits every Firestore transaction limit. Invoke activation only
  through the rollout operator boundary and atomically commit the whole bundle in
  one transaction for flat clients. Record that delivery and market become
  visible together and rollback may briefly remove that bundle.
- Recheck, without writing production, the distinct inverse recovery manifest
  digest and transaction budget against that same frozen state, including prior-
  value restores, created-object deletion, recovery markers/sync command, and held-
  batch cancellation plus higher recovery epoch/restored business revision. Its
  commit rehearsal already ran in the exact emulator/
  isolated restored clone; do not cross visibility unless both still match.
- Through the rollout endpoint, explicitly invoke/poll only the candidate Sheets
  worker for those exact pending command IDs after commit. It claims them
  transactionally and rediscovers/retries pending state after invocation loss;
  keep unrelated workflows fenced and notifications in the non-consumable outbox.
- Hold the monotonic workbook/partition epoch lease, validate active revision/
  digest immediately before each external batch, and record revision/content
  read-back after it. A stale/superseded epoch fails closed.
- Retain/audit queued public-shift events. Candidate `onShiftWritten` must validate
  a changed before/after activation marker against the operation registry/digest
  and no-op legacy per-row export/notification on immediate or delayed delivery;
  retained metadata on a later ordinary edit does not suppress it. Explicit
  commands/outboxes are authoritative.
- Reconcile active rotation/cursor, Firestore shifts, every affected seasonal
  tab, Android, iOS, develop isolation, and unrelated Functions.
- On failure, restore the prior active revision and exact Sheets/data/config
  state only after stopping/superseding the activation sync command, draining its
  lease/worker and any external Sheets call, and proving read-back. If drain is
  ambiguous, do not interleave recovery. Enter the timeboxed sync residual: retain
  Firestore active as authority, seal the outbox, disable affected Sheet import/
  export, keep only affected tabs/ranges fenced, restore mobile/unrelated traffic,
  and leave HU-085 open with owner/TTL/escalation. Reconcile/read back only after no
  external request remains in flight; recovery is forbidden until then. At expiry,
  revoke exact worker invocation/workbook authority, wait the conservative maximum
  request/drain horizon, and require stable Drive activity/revision plus read-back.
  If proof remains impossible, stop for separate authorization to quarantine/retire
  the workbook and configure a new controlled projection without promising the old
  link, or renew a named external incident and its scoped fence; never roll TTL silently.

### Phase 9 - Notification release, resume, and closure

- Present active reconciliation and held-intent inventory for separate approval.
- Enforce the packet's approval/release deadline. Before any canonical event has
  been released, expiry triggers either the authorized active-revision rollback
  or the separately preapproved safe resume with a sealed outbox; never extend
  production outage indefinitely. The safe-resume residual leaves HU-085 open
  for a notification-only window without repeating the still-valid activation.
- Keep both per-type release leases non-terminal through sealed or partial safe
  resume; reject any new stage/activate touching either.
- Keep all affected shift IDs/revision immutable to swaps, overrides, Sheet
  import/edit, and assignment corrections until the release is terminal. Resume
  unrelated traffic and restore only unrelated Sheet edit ranges. If an emergency
  correction is authorized, supersede/cancel only intents proved never submitted
  under any epoch by a new digest; `unknown`/accepted/delivered events remain
  immutable possible-delivery history and require reconciliation/correction copy.
- Only if the safe-resume or partial-release residual branch is taken, enter named
  degraded mode with its own owner, TTL, alerts, and escalation. At expiry, either
  finish reconciliation or atomically terminalize/cancel/supersede every
  demonstrably unsubmitted intent under a new assignment digest, preserve and
  reconcile `unknown`/accepted/delivered history, lift the scoped fence, and keep
  HU-085 open for incident follow-up.
- Enable only the reviewed candidate notification consumer/delivery for the
  allowlisted canonical event IDs while every unrelated producer/consumer stays
  fenced. Claim each intent and create its stable-key canonical event/inbox entry
  in one transaction/CAS that reads current assignment/member versions; stale
  versions write nothing.
- Before every initial/retried FCM send, freshly revalidate active assignment,
  recipient UID, live membership/eligibility, and token ownership/version while
  holding a dispatch lease respected by all state writers. Cancel/supersede drift
  only before authenticated submission starts; never reuse an old check or silently
  retarget. Persist only generic canonical event/inbox copy and send only a generic
  event reference, with no member name, shift date, or effective assignment. Fetch
  authorized current-revision detail on every push/inbox open; durable offline cache
  remains generic. Persist append-only
  attempts with stable ID, lease epoch/deadline, validation digest, authenticated
  start, and terminal outcome; derive aggregate state. Bounded timeout becomes
  immutable possibly delivered `unknown`; retry appends a revalidated attempt and
  may duplicate. Verify
  event metadata and delayed/duplicate presentation after later state change.
- If creation/delivery becomes partial, enforce its separate deadline, persist
  exact per-event states, and retry only pending IDs. If still incomplete,
  restore unrelated normal traffic through the preapproved durable residual/
  incident path while retaining the affected-revision mutation fence, keep
  HU-085 open, prevent duplicate canonical event/inbox effects, retain explicit
  possible-duplicate FCM presentation, and never claim retraction after delivery.
- Verify candidate revisions, indexes, queues, both environment paths, and
  unrelated Functions one final time.
- On terminal release, activate the full authorized hardened normal Rules release, ingress/
  event deliveries, and workbook editor/protection state only after affected writes
  require the current epoch/active revision and stale client/automation queues are
  quarantined. On a safe residual,
  restore only unrelated traffic/ranges and retain the affected-revision mutation
  fence. Explicitly resume, drain, and observe the permitted queues. Keep the
  dedicated runtime workbook access and protected parameter as production config.
- On every terminal success, rollback, or cancel/supersede outcome, expire all
  operation IDs, close/read back maintenance state, and revoke temporary rollout-
  operator IAM. Retain an endpoint only if it is inert without a new time-bounded
  authorization.
- Revoke/read back the temporary control-plane deployer and Drive permission
  controller grants on every terminal outcome; attach IAM/Drive Audit Logs.
- If recovery needs ACL/protection restoration, reauthorize the Drive controller
  only through its sealed exact-action packet after data commands are terminal;
  verify unchanged cell digest and revoke it again.
- Use the same sealed pattern at terminal exit to restore only the approved prior
  editors/automations/protections. Reauthenticate them, require a server reload and
  current base-revision precondition, observe post-reopen Drive/Workspace activity,
  audit content/revision, and revoke the controller. Leave unconfirmed writers read-only.
- Close HU-085 only after bundle activation, every approved terminal notification
  outcome/correction, and normal operation are green. A safely recovered aborted
  window or unresolved degraded residual is documented but not Done.

## 4. Validation matrix

### Code and contract gates

- Functions `npm run lint` and `npm run build`.
- HU-082 frontier/planner/request/stage/activation/outbox/security suites.
- HU-083 Sheets/migration/trigger-model/security suites.
- Firestore Rules emulator suites and index definition validation.
- Android/iOS shared-contract regressions.
- `git diff --check` and secret/raw-identifier scan.

SwiftLint validates Swift style only. Xcode MCP can build/test iOS. Cupertino MCP
is Apple documentation/API research, not a validation gate. None replaces the
Functions TypeScript or operational gates.

### Operational evidence

- exact project/paths/revisions/accounts/Rules/indexes and workbook fingerprint;
- post-drain quiescent backups/manifests/digests/budgets and renewed authorization
  for every difference from the pre-drain packet;
- complete privileged-writer inventory/freeze plus effective IAM ancestry/
  conditions/deny policies, SA IAM, WIF, transitive-group and key/job state, Drive/
  Workspace/DWD authority and Audit Logs, with chained checkpoints at every gate;
- bootstrap Rules/ingress and current write-epoch proof, all-writer workbook fence/
  offline-editor/revision guard, causal drain/abort evidence, allowlist,
  invoker-only operator/worker IAM with negative impersonation/direct-data proof,
  both-workbook runtime access, in-flight drain,
  phase deadlines, and queue snapshots;
- before/after/absent-object manifests and rollback proofs;
- forward activation and inverse recovery transaction budgets and rehearsal;
- exact two-type baseline -> preview -> stage -> active lineage and orphan cleanup
  proof;
- backend-operation queued-event before/after markers/disposition and exact
  activation/recovery Sheets-sync command states;
- registry tombstone/event-ledger retention horizon and unknown-marker fail-
  closed/dead-letter evidence;
- migration and preview/stage/activation snapshot/digest equality;
- proof stage/outbox are invisible to normal/old consumers;
- public activation and Sheets/Android/iOS/develop read-backs;
- exactly-once canonical event creation, idempotent inbox upsert, explicit at-
  least-once/possible-duplicate FCM evidence, per-attempt fresh recipient/token
  checks, immutable attempt ledger/read-back, and normal-traffic resume.
- generic canonical event/inbox/push content, versioned Android/iOS decoder and
  Rules evidence, fresh authorized detail fetch on both open paths, and stale/
  offline/cache-denial behavior with no persisted member/date/assignment detail;
- candidate runtime exact IAM/negative permissions, database-wide Firestore blast
  authorization, app-level path/operation guard alerts, and stronger isolation option.

## 5. Recovery strategy

### Before activation

- Keep traffic fenced and stop allowlisted operations.
- Invoke restoration and manifested cleanup only through exact digest-bound recovery
  operation IDs on the candidate or pre-rehearsed epoch-aware recovery runtime. The
  operator invokes only; deployer, Drive controller, evidence auditor, and scripts
  never edit application data or Sheet content directly.
- Restore prior business parameter, workbook sharing, and non-security IAM/config.
  Advance—not restore—the security/write epoch and retain hardened epoch-aware Rules.
- Restore unrelated Functions through the rehearsed prior-revision traffic/Eventarc
  path. For every affected server writer, serve an epoch-aware compatibility revision
  with the feature inactive or keep its ingress/delivery closed; never route to a
  legacy Admin writer that bypasses the epoch. No broad `actAs` expansion is permitted.
- Restore frozen/revoked privileged writers only to the approved prior state that
  also honors the current epoch/base revision. Keep every affected legacy Admin
  writer disabled; read back effective IAM and Audit Logs.
- Revoke/restore the rollout operator boundary and both-workbook runtime access
  exactly as recorded in the packet.
- Expire all operation IDs and close/read back maintenance state on rollback; any
  retained rollout endpoint must be inert after temporary operator IAM is revoked.
- Restore only the approved prior human/script/add-on/API/automation sharing and
  protection state that reauthenticates, forces a server reload, and supplies the
  current epoch/base revision. Keep unconfirmed or affected legacy writers read-only/
  disabled, observe post-reopen activity, and verify no concurrent write was lost.
- Through that recovery runtime, restore changed Firestore/Sheet objects and remove
  only exact newly created documents, staged candidates, held intents, rows, and tabs
  from the manifested recovery operation.
- Prove stale offline app, admin, Sheets-import, automation, and legacy-server writes
  still fail after rollback even when the business active revision was restored.
- Traverse the exact baseline lineage and remove/restore only its manifested
  descendants; prove no orphan candidate or command remains while intentionally
  retained terminal operation tombstones/event ledgers outlive all replay.
- Retain/delete new indexes only according to the authorized safe rollback plan.
- Audit/read back both environments and mobile clients before retry.

### After activation but before notifications

- Through the exact recovery-runtime command, atomically restore the prior active
  revision, change the
  backend recovery mutation markers, cancel the held batch, and create the exact
  higher-epoch recovery Sheets-sync command only after the activation command/
  worker/external call is terminal or superseded with proven drain; then reconcile
  Sheets and manifests while fenced. Per-row recovery events are audited no-ops.
- Restore both type rotations/projections as one prior bundle; never retain a
  mixed delivery/market generation after rollback.
- Verify exact semantic equality of business/public/external state while retaining
  the manifested append-only operation markers, registry tombstones, event ledgers,
  advanced security epoch, hardened Rules, and epoch-aware serving fence.
- Record that the activated projection may have been transiently visible.
- Do not release notifications; require a new packet before another activation.
- By the phase deadline, either complete that rollback and resume normal traffic
  or use the separately authorized safe residual: retain the reconciled active
  revision, keep the outbox sealed, restore unrelated traffic/editor access while
  keeping affected rows/ranges immutable, and leave HU-085 open for a
  notification-only release window. A new activation is needed only if the
  retained revision later drifts or fails reconciliation.
- Preserve both active bundle release leases throughout the residual; no later
  stage/activation touching either type may supersede them.
- Preserve a scoped mutation fence on every affected shift/revision and Sheet
  range until notification reconciliation; unrelated traffic/editor access may
  resume. An emergency change must supersede only demonstrably unsubmitted intents
  by a new digest and handle `unknown`/accepted/delivered events as immutable
  possible-delivery correction history.
- Degraded mode has a named owner/TTL/escalation; expiry must finish release or
  terminally account for all demonstrably unsubmitted intents, preserve/reconcile
  every `unknown`, and lift the scoped fence. It may
  not become an indefinite functional outage for swaps or corrections.

### After notification release

Canonical release and inbox upsert are idempotent. FCM transport is at least once
and can present a duplicate push despite stable event ID/collapse metadata.
Delivery is irreversible. Correct data and issue an explicit follow-up if needed;
never claim rollback retracted messages. A partial release retains per-event
terminal/pending state, reaches its deadline, and resumes through the authorized
incident residual while the story remains open for exact reconciliation.

## 6. Main risks

- **Old/mixed revision side effects**: fence, allowlist, drain, and prove no old
  consumer can see stage/outbox.
- **Fence bootstrap circularity**: temporary restrictive Rules plus exact intake-
  producer disable stop new work; drain accepted event cascades before disabling
  their deliveries, and abort if any control/queue is incomplete.
- **Rules-bypassing writers**: inventory and recoverably freeze/revoke every
  Admin SDK/server/IAM writer. Close upstream intake/independent writers, drain only
  the causally bounded accepted set through exact current deliveries, prove empty
  ledgers/quiet horizon, revoke them before migration, and abort for a separate
  bridge story if isolation fails; recheck chained checkpoints before every gate.
- **Installed flat readers**: one bounded public transaction or a blocking
  active-revision client migration; never stage in the public collection or copy
  a projection in visible batches.
- **Oversize inverse recovery**: independently measure and rehearse the exact
  recovery transaction; never activate when the atomic exit does not fit.
- **Half-updated shift types**: one combined digest/stage/transaction/rollback for
  delivery and market; any subplan failure leaves both prior types active.
- **No rollout execution path under fence**: use only the IAM-restricted operator
  boundary and selectively allowlisted candidate workers; never reopen normal
  ingress to advance the window.
- **Operator bypass**: grant the operator endpoint invocation only; deny direct
  Firestore/Sheets roles, runtime impersonation, and token creation so every write
  remains bound to endpoint validation and candidate-runtime logs.
- **Implicit repair/recovery actor**: HU-083 and migration tools emit only immutable
  plans/digests. Every data-changing repair, bootstrap, correction, recovery, or
  cleanup is executed by the exact allowlisted rollout runtime operation.
- **Implicit backup authority**: use a keyless read/export-only auditor with no
  source mutation permission and an encrypted immutable destination; revoke/read
  back each evidence window instead of borrowing operator/deployer/controller access.
- **Implicit deploy authority**: name a separate time-bounded least-privilege
  control-plane deployer with no data path. Treat the Drive controller's temporary
  edit capability as unavoidable: constrain/audit exact ACL actions and cell digest,
  then revoke; recovery uses only a sealed temporary reauthorization.
- **Lingering rollout authority**: every terminal path expires operation IDs,
  closes maintenance state, and revokes temporary operator IAM; a retained endpoint
  is inert until separately reauthorized.
- **Shared runtime identity**: grant minimum explicit access to both required
  workbooks with environment-scoped routing, or split Functions by environment
  before adopting separate identities.
- **Queued legacy triggers**: require a changed before/after backend mutation
  marker registered to activation/repair/recovery/sync correction before delayed
  per-row events no-op; retained provenance on later ordinary edits never
  suppresses them, and explicit commands own side effects.
- **Activation/recovery Sheets race**: serialize by workbook/partition epoch and
  lease, validate revision/digest before every batch, and block recovery until the
  prior worker/external call is proved drained; stale retries fail closed.
- **Ambiguous Sheets drain**: use a separate timeboxed residual with Firestore
  authoritative, outbox sealed, affected Sheet integration/ranges quarantined, and
  mobile/unrelated traffic restored. At expiry revoke worker/workbook authority and
  prove a conservative drain plus stable Drive revision/activity; otherwise require
  a separately authorized workbook quarantine/new projection or renewed named
  incident. Never turn uncertainty into silent indefinite waiting or unproved rollback.
- **Split migration lineages**: one immutable baseline feeds one reviewed preview
  and staged/active chain; manifest and clean every descendant by digest.
- **Superseded held release**: retain both per-type bundle leases through sealed/
  partial residuals and block any stage/activate touching either until terminal.
- **Stale held recipients after safe resume**: keep affected revision/rows/ranges
  fenced and serialize assignment/member/token writers with the dispatch lease;
  supersede drift only before authenticated submission starts. Once it starts,
  `unknown`/accepted history is not retractable; generic payload and authorized fetch
  mitigate the irreducible delayed-presentation race.
- **Prolonged degraded mode**: assign owner/TTL/escalation and, at expiry,
  terminalize every demonstrably unsubmitted intent under a new digest, reconcile
  every `unknown` as possibly delivered, and lift the scoped fence even though
  HU-085 remains incomplete.
- **Concurrent workbook writes**: inventory/fence human editors, Apps Script,
  add-ons, API/OAuth clients, service accounts, and Shared Drive automation; verify
  execution/Drive activity and revision/digest before every Sheet mutation.
- **Unfenceable owner**: resolve My Drive/Shared Drive ownership and capabilities;
  stop for a separately proven same-ID transfer/move if no reversible owner fence
  exists.
- **Shared Functions/Rules project**: exact deploys and both-path smoke.
- **Default account blast radius**: prefer dedicated runtime; approve fallback.
- **Async indexes**: build additive indexes to `READY` before maintenance and
  abort on any newly discovered requirement.
- **Full-season/public visibility**: non-public stage plus separately authorized
  atomic activation and documented transient-visibility recovery.
- **Incomplete rollback**: absent-object manifest plus IAM/share/revision cleanup.
- **Irreversible notifications**: separate release and idempotency evidence.
- **Unbounded outage**: phase deadlines force rollback or an explicitly approved
  safe resume with the outbox still sealed and the story left open.
