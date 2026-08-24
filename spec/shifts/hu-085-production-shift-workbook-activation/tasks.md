# Tasks - HU-085 (Controlled production shift workbook activation)

## 0. Dependency gate

- [ ] Verify HU-082 / #266 and HU-083 / #267 are merged and ADR-0013 plus
  bilingual contracts are accepted.
- [ ] Attach green Functions, local/emulator, security, Rules, Sheets, Android,
  iOS, trigger-model, and conditional develop-repair evidence.
- [ ] Prove frontier, preview/stage/activate, maintenance fence, outbox/release,
  mixed-revision, and recovery behavior.
- [ ] Prove temporary restrictive Rules deny every currently allowed affected
  direct client write; prove callable/HTTP/scheduled producers can stop new work,
  accepted event cascades drain, and exact deliveries can then be disabled.
- [ ] Prove the inventory and recoverable freeze/revocation of every user/group,
  service account/key, Workload Identity, server job, scheduler/queue, CI/CD,
  script, and console operator that can bypass Rules on affected paths.
- [ ] Prove closing every upstream producer/independent writer leaves exact current
  deliveries only a causally bounded accepted-work set, then prove empty ledgers and
  a conservative quiet horizon. If not, abort before data/workbook mutation and
  scope a separate bridge-revision story with mixed-cutover/drain/rollback design.
- [ ] Prove every affected write reopened after maintenance requires current write
  epoch and active revision; stale/offline/legacy writes fail, and unsupported direct
  clients stay closed or move to a versioned command/callable path.
- [ ] Prove migration/stage stay outside the public `shifts` collection and the
  exact combined delivery/market activation manifest fits one Firestore
  transaction for installed clients, or block rollout for client migration.
- [ ] Prove the distinct inverse recovery manifest also fits and succeeds in one
  Firestore transaction, including restores, deletes, markers, recovery sync
  command, and held-batch cancellation.
- [ ] Prove each subplan's own frontier/replay and that any failed, stale, or
  oversize type activates neither rotation and emits no side effects.
- [ ] Freeze commit, Function allowlist, Rules/indexes diff, runtime identity,
  mutation manifests, and phase authorization packet.

## 1. Final read-only preflight

- [ ] Resolve project, both environment paths, region, deployed revisions,
  triggers/queues, and global Rules/indexes release.
- [ ] Inventory every Rules-bypassing privileged writer and hash effective IAM
  ancestry/conditions/deny policies, service-account IAM, WIF, transitive groups,
  keys/workloads/jobs, recent Audit Logs, and initial affected-data checkpoint.
- [ ] Resolve a temporary control-plane deployer and named Drive permission
  controller with exact roles/targets/actions and credential provenance. Rehearse
  preserved-revision traffic/Eventarc rollback for unaffected surfaces plus an
  epoch-aware compatibility revision/closed affected ingress or, if impossible,
  limit deployer `actAs` to candidate plus exact prior runtime for frozen forward/
  rollback deploys. Record negative data-token permissions, controller ACL/protection
  manifest plus cell-digest audit, sealed recovery path, and revocation commands.
- [ ] Resolve a separate keyless evidence/backup auditor with exact source read/
  export actions, create-only encrypted evidence-destination permission, ACL,
  retention/immutability, digest/read-time and restore-test provenance, negative
  source mutation/rollout invocation rights, and revocation/read-back commands.
- [ ] Inspect effective runtime accounts for
  `onShiftPlanningRequestCreated`, `exportShiftsToGoogleSheets`,
  `syncShiftsFromGoogleSheets`, `onShiftWritten`,
  `onDeliveryCalendarOverrideWritten`, and every new endpoint.
- [ ] Design exact IAM/workbook access for a dedicated shift/Sheets account. Record
  database/project-scoped Firestore server-IAM blast radius, negative Auth/Storage/
  IAM/Secret/token permissions, app path/environment/operation guards and alerts,
  stronger isolation alternative, and Compute fallback risk. Shared revisions keep
  both workbook routes but cannot claim IAM path isolation.
- [ ] Design a separate operator principal/IAM boundary for exact repair,
  migration/bootstrap, preview/stage/activate, sync-correction, recovery, and cleanup
  commands while normal mobile/admin ingress is closed;
  grant invoker only and deny direct data roles/runtime impersonation/token minting.
- [ ] Keep Firebase Admin SDK unshared without a proved caller.
- [ ] Revalidate the supplied workbook by protected fingerprint and inventory
  `TORRE 2025-26`, `MERCADO 2025-26`, aliases, headers, formulas, protections,
  sharing, and parameter presence without exposing raw URL/ID.
- [ ] Resolve `driveId`, My Drive/Shared Drive location, owner(s), roles/capabilities,
  bound scripts, transitive group/domain membership, DWD/OAuth/Workspace admin paths,
  and an effective reversible owner-write fence.
- [ ] Obtain editor online/closed/no-pending-offline confirmations and define forced
  server reload, base-revision validation, post-reopen observation, and read-only/
  versioned-command fallback for unconfirmed humans or automations.
- [ ] Audit/hash deferred develop repair, production rotation/shifts, and Sheets.
- [ ] Compare candidate allowlists/manifests with current and absent state.
- [ ] Inventory human editors/protections, Apps Script triggers/deployments, add-ons,
  API/OAuth clients, service accounts, Shared Drive automations, recent executions/
  Drive activity, and the revision/digest needed for an exclusive writer fence.
- [ ] If an owner cannot be fenced, stop for a separate transfer/move decision;
  prove on a fixture and then read back same file ID/link, bindings, permissions,
  and content before updating the production packet.

## 2. Backup, dry-run, fence, and authorization

- [ ] Through the keyless evidence auditor, back up exact Firestore partitions and
  affected workbook tabs without changing source data.
- [ ] Record encrypted destination, ACL, retention/immutability, source revision/
  read time, digest, restore-test provenance, and auditor revocation/read-back.
- [ ] Mark those as pre-drain recovery points, not the migration/activation baseline.
- [ ] Record prior parameter, Function revision/service account, IAM, sharing,
  Rules/indexes, trigger, and queue state securely.
- [ ] Manifest/rehearse the exact privileged-writer freeze/revocation and its
  least-privilege restoration, separating current-runtime causal-drain authority
  from post-drain candidate/operator authority.
- [ ] Manifest every existing/absent object and planned create/update/delete,
  including requests, rotations, shifts, staged candidates, held intents, rows,
  tabs, digest-bound activation/recovery Sheets-sync commands, and queued
  backend-operation event IDs/before-after mutation markers.
- [ ] Define one immutable lineage and cleanup graph:
  `migrationBaselineRevision/digest -> combined preview digest -> staged bundle
  revision -> active bundle revision`.
- [ ] Prove restore and exact created-object cleanup without live overwrite.
- [ ] Measure/rehearse the exact forward activation and inverse recovery
  transactions; block authorization if either frozen manifest exceeds a limit.
- [ ] Define/test semantic recovery equality for business/public state and the
  narrow client-inert append-only operation/tombstone/event evidence excluded
  from byte equality and planner digests.
- [ ] Dry-run deferred repair, production migration, preview/stage/activation,
  Sheets sync, notification release, and each recovery branch.
- [ ] Present fence/drain, full-season/public-visibility blast radius, exact
  mutations, phase deadlines, aborts, and owners.
- [ ] Obtain explicit phase-bound authorization.

## 2A. Additive index readiness before maintenance

- [ ] Under separate authorization, deploy only reviewed additive indexes
  required by the frozen candidate code through the exact temporary control-plane
  deployer without deploying Functions or opening access.
- [ ] Wait for every required index to reach `READY` outside the main maintenance
  window; prove both paths remain unchanged and apply timeout/rollback on failure.
- [ ] Revoke/read back the Phase 2A deployer grant; require fresh Phase 3 authority.

## 3. Bootstrap and enter maintenance, then provision access

- [ ] Revalidate the packet immediately before mutation.
- [ ] Provision/read back the control-plane deployer only for exact allowlisted
  infrastructure actions; prove it cannot reach data/workbook or mint/impersonate
  runtime credentials.
- [ ] Freeze/revoke unrelated privileged writers; keep inventoried current drain
  identities only under observation until intake closes, then compare IAM/log/
  workload/data state to the current checkpoint and record the next checkpoint.
- [ ] Deploy tested temporary restrictive Rules for every affected direct client
  write, disable exact callable/HTTP/scheduled producers, read back those intake
  controls, and allow only named change-window operation IDs.
- [ ] Only after intake/direct writers read back closed, treat transition writes as
  the causal drain set. Never claim event-ID filtering in legacy revisions; if causal
  isolation is impossible, abort for a separately specified bridge-revision story.
- [ ] Drain planning, shifts, swaps,
  overrides, Sheets, notifications, retry queues, and cascades while current
  deliveries run, then disable exact triggers/deliveries and verify empty queues.
- [ ] After queues/event ledgers plus the quiet horizon are terminal, revoke/disable
  and read back all drain identities/revisions before migration/candidate data write.
- [ ] After Sheets drain is terminal, provision the Drive permission controller,
  apply/read back the fence for every human/automated workbook writer, audit exact
  effective group/domain/DWD/Workspace authority, online/closed/offline-edit
  acknowledgements, Drive/Workspace activity, ACL/protection actions, and unchanged
  cell digest; then freeze/revoke it and prove zero continuing data-write paths.
- [ ] Reauthorize the keyless evidence auditor only for the exact window; capture
  fresh post-drain Firestore/workbook backups, present/absent manifests,
  planner inputs, digests, recovery manifest, and forward/inverse budgets; compare
  the packet, rerun exact isolated-clone commit rehearsal for every manifest delta,
  obtain renewed phase authorization, then revoke/read back the auditor and evidence
  destination controls.
- [ ] Through the infrastructure deployer, provision the dedicated account's exact
  IAM or accepted Compute fallback; prove negative unrelated permissions and
  candidate app-level route/operation guards, but do not grant workbook access or
  assign Function `serviceAccount` yet.
- [ ] Reauthorize the Drive controller through a second sealed exact-action packet
  to grant only the candidate runtime's reviewed workbook role. Audit unchanged
  cell digest/activity, revoke/read back the controller, prove candidate sole writer,
  and preserve both-workbook/cross-route guards for shared revisions.
- [ ] Provision the distinct rollout operator principal/IAM without granting it
  Firestore/Sheets roles, runtime impersonation/token creation, workbook access,
  or ordinary mobile-admin authority; prove each negative permission.
- [ ] Set/read back the protected production workbook parameter by fingerprint.
- [ ] Before every Phase 5+ mutation, recovery, and resume gate, compare effective
  IAM ancestry/SA/WIF/group/deny-policy and Drive/Workspace authority/log/data to the
  prior checkpoint, then record the next exact authority/data result; abort on any
  effective-access diff even when a top-level etag is unchanged.

## 4. Exact shared deploy and readiness

- [ ] Run Functions `npm run lint` and `npm run build`.
- [ ] Run HU-082 planner/frontier/stage/outbox/security and HU-083
  Sheets/migration/trigger/security suites plus Rules/index tests.
- [ ] Run required Android/iOS shared-contract regressions.
- [ ] Run `git diff --check` and secret/raw-identifier scan.
- [ ] Deploy only authorized Functions and apply dedicated `serviceAccount` only
  in those new revisions.
- [ ] Deploy/read back the IAM-restricted operator-only endpoint and exact
  maintenance operation allowlist while normal ingress remains closed.
- [ ] Prove the operator can invoke the exact endpoint but cannot write Firestore/
  Sheets directly, impersonate the runtime, mint its tokens, or bypass digest/
  operation validation.
- [ ] Prove repair, migration/bootstrap, preview lifecycle, stage, activation, sync
  correction, recovery, and manifested cleanup accept only exact operation ID/
  revision/digest and execute solely as candidate-runtime writes. Permit only the
  pre-rehearsed epoch-aware recovery revision under the same governed data identity;
  reject HU-083 script, operator, deployer, controller, or auditor write paths.
- [ ] Deploy exact candidate Rules while retaining the temporary maintenance
  write denials; do not restore normal client writes yet.
- [ ] Prove Rules/server reject every affected stale or absent maintenance epoch/
  active-revision precondition before normal ingress can reopen.
- [ ] With restrictive Rules/ingress still closed, invoke/read back idempotent
  `enterMaintenance`; prove it atomically marks closed and advances the epoch, and
  fail closed on crash/retry ambiguity.
- [ ] Verify every required additive index remains `READY`; abort on any newly
  discovered index rather than building it during outage.
- [ ] Verify revisions/accounts/Rules/indexes, old/mixed-revision containment,
  runtime Sheets access, health/logs, and both environment paths.
- [ ] On failure, execute complete pre-activation recovery.

## 5. Deferred develop repair and hidden production bootstrap

- [ ] Revalidate snapshot/digest and create/update/delete manifests.
- [ ] Use only the authorized post-drain quiescent baseline, never the pre-drain
  recovery point.
- [ ] Use HU-083 only to supply the approved dry-run/manifest. Invoke deferred
  develop repair through its exact candidate-runtime operation ID/revision/digest;
  audit/read back or invoke the exact recovery command on mismatch, and never reuse
  the HU-083 principal/credential.
- [ ] Build exact production rotation/source/projection normalization only in the
  hidden immutable migration-baseline revision; leave public shifts and active
  cursor/frontier unchanged until activation.
- [ ] Invoke the hidden production `migration/bootstrap` only through its exact
  candidate-runtime operation ID/revision/digest and read back its complete manifest.
- [ ] Distinguish the initial cursor/frontier bootstrap committed at activation
  from an HU-083 historical backfill, which cannot advance active live state.
- [ ] Prove no legacy export or notification trigger escaped containment.
- [ ] Change backend-owned last-mutation kind/ID/revision fields atomically on
  repair rows; inventory the before/after validation and immediate/delayed events
  that must audit/no-op safely.
- [ ] Define recovery-delete before-image version/path validation, registry
  tombstone/per-event-ledger retention beyond the maximum delivery horizon, and
  fail-closed alerting for unknown changed backend markers.
- [ ] Prove normal member apps still read unchanged public data and inspect the
  normalized candidate only through the authorized admin boundary.
- [ ] On failure, restore changed state, remove exact created state, revert
  authorized business/share/config state, advance the security epoch, retain hardened
  Rules/epoch-aware serving or closed affected ingress, and leave HU-085 open.

## 6. Side-effect-free preview

- [ ] Run one allowlisted delivery-plus-market preview bundle, with an explicit
  target frontier/replay for each type.
- [ ] Invoke preview only through the rollout operator boundary; keep normal
  mobile/admin request ingress closed.
- [ ] Require the exact migration-baseline revision/digest and prove preview
  cannot read/fall back to the legacy public projection.
- [ ] Prove only private request/operation lifecycle state plus the immutable
  bundle/receipt is written, with no rotation, candidate/public shift, Sheet,
  outbox, or ledger mutation, and prove exact plan/count/invariant/digest
  equality.
- [ ] Execute complete pre-activation recovery on drift.

## 7. Non-public stage

- [ ] Obtain approval for the exact preview digest/full-season candidate.
- [ ] Stage only that two-type bundle candidate revision/manifest.
- [ ] Invoke stage only through the rollout operator boundary and exact operation
  ID/revision/digest.
- [ ] Bind stage as the sole child of the authorized baseline/preview digest and
  reject either invalid subplan plus mixed, mutable, reused, or orphaned lineage.
- [ ] Prove normal members, active cursor, Sheets, old/current notification
  consumers, and unrelated Functions cannot observe it.
- [ ] Reconcile candidate invariants and Android/iOS admin decoding/rendering.
- [ ] Remove exact candidate objects and recover on failure.

## 8. Public activation and reconciliation

- [ ] Obtain separate approval for the exact public activation.
- [ ] Revalidate the single-transaction budget, then atomically commit the exact
  combined delivery/market create/update/delete projection, both rotation/cursor
  bootstraps, new write epoch/active revision, bundle metadata, digest-bound sync commands, and held intents
  through the rollout-only boundary; record one public-visibility timestamp.
- [ ] Revalidate the distinct inverse recovery digest/budget against frozen
  production with no write. Do not activate unless it matches the successful exact
  emulator/isolated-clone rehearsal, includes a higher recovery epoch plus restored
  business revision, and its complete manifest still fits.
- [ ] Explicitly invoke/poll only the candidate Sheets worker after commit for the
  exact pending command IDs; prove transactional claim, rediscovery/retry after
  invocation loss, and no dependency on Eventarc enable-after-create replay while
  other traffic stays fenced and notifications stay held.
- [ ] Acquire the workbook/partition epoch lease, validate current command/active
  revision/digest before every batch, record read-back, and reject stale epochs.
- [ ] Drain/audit activation public-shift events as candidate `onShiftWritten`
  legacy-side-effect no-ops only when their changed before/after marker validates;
  prove retained metadata never suppresses a later ordinary event and explicit
  commands/outboxes own export/notification.
- [ ] Reconcile active rotation/cursor, Firestore, every affected tab, Android,
  iOS, develop isolation, and unrelated Functions.
- [ ] On failure, restore prior active revision/external state, record possible
  transient visibility, and leave HU-085 open, but first stop/supersede activation
  sync and prove its lease/worker/external Sheets call drained; fail closed if not.
- [ ] On every recovery, increment the security/write epoch, retain hardened Rules,
  serve only epoch-aware affected writers or keep their ingress closed, and prove
  stale offline/client/automation/legacy-server writes remain rejected after the
  prior business revision is restored.
- [ ] If Sheets drain is ambiguous, enter a dedicated owner/TTL/escalation residual:
  keep Firestore active, outbox sealed, affected import/export/ranges fenced, resume
  mobile/unrelated traffic, and forbid recovery until external-call terminality and
  exact read-back are proved. At expiry revoke exact worker/workbook authority, wait
  the conservative external-call horizon, and prove stable Drive activity/revision.
  If still ambiguous, obtain separate authorization for workbook quarantine/new
  projection without link-preservation claims or renew a named external incident;
  never silently extend the TTL.

## 9. Notification release, resume, and closure

- [ ] Present active reconciliation and held-intent inventory for approval.
- [ ] Enforce the phase deadline: before any event release, delayed approval
  triggers authorized rollback or preapproved safe resume with sealed outbox;
  never leave production fenced indefinitely and keep HU-085 open on residual.
- [ ] Retain release leases on both bundle types during sealed/partial safe resume
  and reject every stage/activate touching either until terminal reconciliation,
  valid rollback, or explicit terminal incident.
- [ ] During safe resume, keep affected shifts/revision and Sheet ranges fenced
  from swaps, overrides, imports/edits, and assignment changes while unrelated
  traffic/editor access resumes; define the authorized emergency supersede/
  correction path for demonstrably unsubmitted versus `unknown`/accepted/delivered events.
- [ ] Assign degraded-mode owner, TTL, alerts, and escalation; at expiry finish
  release or terminally cancel/supersede every demonstrably unsubmitted intent under
  a new digest, preserve/reconcile `unknown`/accepted/delivered history, lift the
  scoped fence, and keep HU-085 open.
  Run this task only after entering safe-resume or a partial-release residual.
- [ ] For release, enable only the candidate notification consumer/delivery and
  exact allowlisted event IDs while unrelated traffic remains fenced.
- [ ] Create each canonical notification event idempotently exactly once with a
  stable key using one transaction/CAS that reads assignment/member versions while
  claiming the intent; stale versions create no event/inbox state.
- [ ] Before every initial/retried FCM send, freshly revalidate assignment, UID,
  active membership/eligibility, and token ownership/version under a dispatch lease
  honored by every writer; cancel/supersede drift only before authenticated submission
  starts, without reusing old validation or silently retargeting.
- [ ] Persist append-only attempts per canonical event with `attemptId`, lease owner/
  epoch/deadline, validation digest, authenticated start, and terminal outcome; derive
  aggregate state without overwriting evidence.
- [ ] Bound timeout, retain expiry/lost ack as immutable possibly delivered `unknown`,
  and append a new current-state attempt for any at-least-once retry that may duplicate.
- [ ] Persist only generic non-sensitive canonical event/inbox copy/reference and
  send only a generic event reference. Retain no member name, shift date, or
  effective assignment in any artifact; fetch current authorized detail on every
  push/inbox open and keep durable offline caches generic.
- [ ] Verify versioned Android/iOS event/inbox decoders, Rules, repository/cache
  invalidation, logout/demotion/environment/assignment drift, and offline/denied
  opening before release; legacy `title`/`body` fields contain only generic copy.
- [ ] Verify FCM event ID/collapse metadata while explicitly accepting possible
  duplicate presentation only after an authorized at-least-once send.
- [ ] Enforce a separate partial-release deadline; persist per-event pending/
  terminal state, retry only pending IDs, and use the authorized durable
  residual/incident resume if incomplete, leaving HU-085 open.
- [ ] Record irreversible delivered-notification evidence.
- [ ] Recheck revisions, indexes, queues, both paths, and unrelated Functions.
- [ ] On terminal release, activate the full authorized hardened normal Rules, ingress/
  deliveries, and workbook editor/protection state only with current write-epoch/
  base-revision enforcement and stale-queue quarantine. On safe residual, restore
  unrelated traffic/ranges but retain the affected-revision mutation fence;
  explicitly resume/drain/observe the permitted surface.
- [ ] Restore scripts/triggers/add-ons/API clients/automations only to the approved
  prior state appropriate to the terminal/residual outcome and read back activity.
- [ ] On every terminal success, rollback, or cancel/supersede outcome, expire all
  operation IDs, close/read back maintenance state, revoke temporary rollout-
  operator IAM, and prove any retained endpoint is inert until reauthorized.
- [ ] Execute every rollback, correction, and manifested cleanup data mutation
  through an exact candidate/epoch-aware-recovery runtime command; prove no direct
  data write by operator, deployer, Drive controller, evidence auditor, or script.
- [ ] Revoke/read back temporary control-plane/Drive-controller grants on every
  terminal outcome and attach IAM/Drive Audit Logs.
- [ ] Reauthorize the Drive controller during recovery only through the sealed
  exact ACL/protection restore packet after data commands are terminal; verify
  unchanged cell digest and revoke/read back again.
- [ ] At terminal exit, use the same sealed pattern to restore only approved prior
  editors/automations/protections after reauthentication, forced server reload, and
  current base-revision validation; observe/read back content/activity, revoke again,
  and leave unconfirmed writers read-only.
- [ ] Restore previously frozen/revoked privileged writers only to the approved
  prior state that also honors current epoch/base revision; keep affected legacy
  Admin writers disabled and verify effective IAM/Audit Logs.
- [ ] Close HU-085 only when bundle activation, every approved terminal
  notification outcome/correction, and resumed operation are green; an aborted/
  recovered or degraded-residual attempt is not Done.
- [ ] Attach secret-safe fingerprints, manifests, digests, allowlists, timestamps,
  read-backs, recovery state, and links to #269.
- [ ] Prove rollback/cleanup traversed the exact lineage and left no orphan
  baseline, candidate, sync command, or held event.
- [ ] Prove rollback restores both prior type projections/cursors as one bundle;
  no mixed-generation delivery/market state remains.
