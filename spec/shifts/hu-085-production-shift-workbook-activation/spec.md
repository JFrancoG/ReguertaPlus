# HU-085 - Controlled production shift workbook activation

## Metadata

- issue_id: #269
- priority: P1
- platform: backend
- status: draft
- blocked_by: HU-082 / #266, HU-083 / #267, final live authorization
- depends_on: HU-082 / #266, HU-083 / #267
- live_gate: explicit phase-by-phase production authorization after final preflight

## Context and problem

HU-082 changes planning and HU-083 delivers multi-season Sheets plus audited
repair tooling. The project currently uses one Firebase project,
`reguerta-9f27f`, for both `{develop}` and `{production}` paths. Functions
revisions and Firestore Rules/indexes are project-wide; a develop-only deploy is
not isolated from production.

Activation is therefore one governed shared-project change window. It owns the
first shared deploy, any HU-083 repair deferred because old triggers were unsafe,
hidden production rotation bootstrap, workbook connection, side-effect-free preview,
non-public staging, explicit public activation, Sheets reconciliation, and a
separate irreversible notification release.

## User story

As the production operator, I want to activate the verified shifts planner and
stable production workbook through a quiesced, staged change window so that the
complete seasonal projection becomes active only from the reviewed revision,
with exact identity, backup, read-back, notification, and recovery evidence.

## Production workbook target

The maintainer supplied the intended production workbook out of repository on
2026-08-23. Read-only connector metadata confirmed that it contains legacy tabs
`TORRE 2025-26` and `MERCADO 2025-26`; no cell, name, permission, parameter, or
sharing state was changed.

The raw URL/ID stays outside committed specs and public issue evidence. The
change-window packet records a non-sensitive fingerprint and keeps the exact ID
in the protected runtime-parameter path.

- Keep this as one stable production workbook with seasonal tabs inside it.
- Its display name may change without changing the shared URL, ID, or permissions.
- Do not create a workbook per season without a later measured reason and ADR.
- Firestore is the app source and rotation authority; Sheets is a synchronized
  projection and governed effective-assignment input.

## Screenshot and runtime identity conclusion

The screenshot contains two service-account emails, not workbook links or
configuration values:

- `195744802339-compute@developer.gserviceaccount.com`
- `firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com`

Read-only verification on 2026-08-23 confirmed that these five relevant deployed
Functions currently run as the first address, the Compute default account:

- `onShiftPlanningRequestCreated`
- `exportShiftsToGoogleSheets`
- `syncShiftsFromGoogleSheets`
- `onShiftWritten`
- `onDeliveryCalendarOverrideWritten`

None runs as the Firebase Admin SDK account. Deployed metadata currently contains
only the develop Sheets connection; verification made no production mutation.

Prefer a dedicated least-privilege runtime service account assigned only to the
reviewed shift/Sheets Functions. Those revisions serve both logical environment
paths, so the same account needs minimum explicit access to both stable develop
and production workbooks; environment-scoped protected parameters/allowlists
must still prevent cross-routing. If separate workbook identities are required,
the Functions must first be split by environment/revision rather than removing
develop access from a shared worker. Provisioning IAM/workbook permissions does
not assign the account to a Function; `serviceAccount` changes only inside the
exact allowlisted Function deploy because that creates a new Gen2 revision. If
the maintainer rejects that identity change, Compute default is an explicit
fallback whose broader blast radius must be accepted. Never share with Firebase
Admin SDK without a separately proved deployed caller.

Preflight rechecks every candidate revision. The selected account is a sharing
principal; the protected workbook ID, not any email, is the parameter value.

The change window separates five authorities: the rollout data runtime, an
invoker-only operator, a temporary control-plane deployer, a Drive permission
controller, and a temporary keyless evidence/backup auditor. The deployer receives
only the exact Functions/Rules/Eventarc/config/IAM
permissions needed for the frozen plan. Prefer a rehearsed rollback that preserves
the prior revision for unaffected surfaces and switches traffic/Eventarc without
redeploy; affected legacy Admin writers remain closed and use an epoch-aware
compatibility revision. If the
platform cannot prove that path, `actAs` may cover only the candidate plus the exact
prior runtime, and only for allowlisted forward/rollback deploys;
it has no Firestore/Sheets data role, workbook access, runtime token-minting, or
broad service-account impersonation. A separately identified Drive permission
controller necessarily has temporary edit capability while applying the manifested
ACL/protection fence. It is bound to exact actions/digests, its activity and cell
content are read back to prove no content edit, and it is then frozen/revoked as a
writer. Recovery/restore can reauthorize it only through a sealed exact-action
packet and must revoke/read back again. The same sealed mechanism separately grants
only the candidate runtime's reviewed workbook role after the quiescent baseline is
authorized, and restores only prior editors/automations that reauthenticate, reload
the current server/base revision, and satisfy the epoch-aware reopening gate; all
others remain read-only. The rollout operator remains invoker-only. Every
post-baseline repair, migration/bootstrap, preview lifecycle, stage, activation,
sync correction, recovery, and manifested-cleanup write uses an exact allowlisted
operation ID/revision/digest. Only the candidate runtime, or its pre-rehearsed
epoch-aware recovery revision under the same governed data identity, may write
Firestore or Sheet content. HU-083 scripts supply manifests/dry-runs only inside
HU-085; neither their principal nor credentials are reused for rollout writes.

The evidence auditor has only the exact source read/export actions and encrypted
backup-destination create permission needed by the packet. It cannot invoke rollout
operations, mutate affected Firestore/application data, edit the source workbook,
overwrite/delete retained evidence, or impersonate another authority. Each artifact
records source revision/read time, digest, encryption, destination ACL, retention,
and restore-test provenance. Its keyless grant is timeboxed and revoked/read back
after each approved backup/read-back window. Every authority, credential/workload,
IAM etag, action, and Audit Log is read back; temporary grants are revoked on every
terminal exit.

"Minimum Firestore access" is not collection-scoped security. Server/Admin SDK IAM
normally grants data permissions at database/project scope and bypasses Firestore
Rules. The packet records the candidate account's exact roles/actions and that wider
Firestore blast radius even when Compute fallback is not used. It denies unrelated
Auth, Storage, IAM, Secret Manager, token-minting, and service-account impersonation
permissions. Candidate code additionally enforces exact path, environment, operation
ID, revision, and digest allowlists, with Audit Log alerts for any out-of-contract
access. A separate project/database or mediated narrow writer is the stronger future
isolation option; workbook access alone cannot provide Firestore route isolation.

## Bootstrap, quiescence, and mixed-revision boundary

No suitable server-side fence is currently deployed, while existing Rules allow
affected direct administrator writes. HU-085 therefore has one separately
authorized bootstrap mutation: deploy tested temporary restrictive Rules for the
affected client-write paths and disable the exact callable/HTTP/scheduled event
producers. Anything accepted during that intake transition is treated as in
flight. Existing event deliveries remain enabled only long enough to drain those
accepted events and all cascades; the exact triggers/deliveries are then disabled
and their queues verified empty. Quiescence is established only after this
sequence reads back successfully.

The rollout also audits offline-capable client writes. Before affected direct writes
can reopen, a backend-owned maintenance/write epoch and expected active revision must
be enforced by Rules/server validation on every command. Any queued write carrying an
older or absent epoch/revision fails instead of reaching the new projection. If an
installed client cannot provide that precondition, its direct path remains closed and
is migrated to a versioned callable/command path, or rollout waits for the client
update; restoring the old permissive Rules is not an allowed exit.

Firestore Rules do not fence Admin SDK, server SDK, or other IAM-authorized
writers. Before bootstrap, the operator inventories every user/group principal,
service account and key, Workload Identity binding, Function/Run job, scheduler,
queue, CI/CD workflow, maintenance script, and console operator that can write the
affected paths. Unrelated writers are revoked, disabled, or placed under an
auditable change freeze. Current deliveries may remain enabled only after every
upstream producer and independent privileged writer is closed, so their sole
possible input is the causally bounded set accepted before intake closure. The
packet proves that dependency graph, empty queues/event ledgers, and a conservative
quiet horizon; it never claims that a legacy revision enforces an event-ID allowlist
it does not implement. If causal isolation is impossible, HU-085 aborts before data/
workbook mutation and a separate bridge-revision story must specify its own intake
snapshot, mixed-revision cutover, authorization, rollback, and drain. Once the bounded drain
is terminal, those identities/revisions and deliveries are disabled or revoked and
read back before migration. Only the frozen candidate runtime may write Firestore
or Sheets afterward. The rollout operator has invoker-only IAM on the exact
endpoint and no Firestore/Sheets role, runtime impersonation, service-account token
creation, or direct data path.

An effective-authority manifest—not one project IAM etag—is rechecked before
bootstrap and immediately before every migration, preview, stage, activation, sync,
release, recovery, and resume gate. It hashes project/database policy plus inherited
organization/folder bindings, conditions and deny policies; service-account IAM;
Workload Identity pools/providers/bindings; keys/workloads; and transitive/nested
group membership. Audit Logs, writer/job state, and affected-document update times
join the checkpoint. After each operation, the exact manifested authority/data
result becomes the next expected checkpoint. Any effective-access diff, unknown
writer, or unmanifested drift aborts even if the project policy etag is unchanged.

If that exact bootstrap/rollback cannot be proved, the window stops before
workbook access, parameters, candidate Functions, or data migration.

Separately authorized additive indexes may be deployed and must reach `READY`
before the main maintenance window. They grant no access and activate no feature.
After the bootstrap barrier, the operator drains in-flight work covering at
least:

- planning requests and candidate/activation commands;
- shift writes, swaps, overrides, and delivery-calendar overrides;
- Sheets import/export/sync and retry queues;
- notification consumers and pending event deliveries.

Pre-drain backups remain recovery evidence but are not the migration baseline,
because authorized drain work may legitimately change Firestore or Sheets. After
queues/event ledgers are terminal, causal-drain writers are revoked, and workbook
writers are fenced to zero, the keyless evidence auditor captures a new quiescent
Firestore backup plus workbook copy/revision, present/absent manifests, hashes,
planner inputs, and forward/inverse transaction budgets. The operator recomputes
the full packet against that
state. If either manifest changed, its exact forward/inverse commit rehearsal is
rerun in an isolated restored clone. Any difference from the earlier packet
requires renewed phase authorization; no runtime/workbook access, parameter change,
candidate deploy, migration, preview, or stage proceeds from a stale baseline.

After candidate deployment, repair, migration/bootstrap, preview lifecycle, stage,
activate, controlled sync correction, recovery, and manifested cleanup run only
through HU-082's operator-only rollout execution boundary. The separate
operator principal has only endpoint invocation authority; the endpoint validates
the exact maintenance operation ID/revision/digest and delegates writes to the
candidate runtime. Normal app/admin ingress and unrelated triggers remain disabled;
selectively enabled workers accept only exact allowlisted event IDs.

Every terminal exit—successful completion, rollback recovery, or terminal
cancel/supersede residual—expires all operation IDs, closes the maintenance state,
revokes temporary operator IAM, and reads those changes back. A deployed endpoint
may remain only if it is inert without a fresh time-bounded authorization.

Every workbook writer is fenced, not only human editors. The inventory covers
editors, Apps Script simple/installable triggers and deployments, add-ons, OAuth/
API clients, service accounts, Shared Drive automations, workflows using an owner's
credentials, transitive Google Group/Shared Drive/domain membership, Domain-Wide
Delegation grants/scopes, and Workspace administrator impersonation/control paths.
These authorities are frozen/digested or proved absent, with Drive and Workspace
audit read-back. The window recoverably disables/removes their write paths,
records recent executions/Drive activity and prior sharing/protection state, then
first proves there are zero continuing workbook data-write paths. Only then does it
provision the candidate runtime and prove that account is the sole writer. It
rechecks the exact Drive revision/content digest immediately before each batch
mutation. If either zero-writer or sole-writer boundary cannot be proved, the
window aborts rather than racing a write.

Every prior human editor must explicitly confirm the workbook is online, closed,
and has no pending offline edits before the writer fence is accepted. A permission
revoke alone cannot invalidate an edit queued on a device. Affected ranges stay
protected through terminal reconciliation. Controlled reopening requires editor
reauthorization, a forced server reload before editing, and a post-reopen observation
and revision/digest read-back. An editor who cannot provide that confirmation is not
restored in this window; affected changes use a versioned command channel or remain
read-only. The same base revision/digest precondition applies to re-enabled Apps
Script, OAuth/API, and automation writers so stale deferred work is quarantined.

Preflight must resolve whether the file lives in My Drive or a Shared Drive, its
`driveId`, owner(s), membership/roles, and effective capabilities. A My Drive owner
may make the zero-writer fence impossible through ordinary file permissions. The
packet must prove a reversible organizational control that removes/suspends that
write path; otherwise HU-085 stops and raises a separate transfer/move decision.
Any move/ownership transfer must first prove on a safe fixture and then by read-back
that the same production file ID/link, bound scripts, permissions, and content
remain valid. Creating a replacement workbook is not silently substituted.

Only exact change-window operation IDs are allowlisted. The packet assigns a
maximum duration and recovery outcome to every fenced phase. The fence normally
remains until candidate Functions are serving, migrations reconcile, activation
is verified, canonical notifications are released, and traffic resumes. It may
not remain indefinitely while waiting for approval: before any notification
event is released, the deadline forces either the authorized post-activation
rollback or a separately preapproved safe resume with the active revision and a
sealed non-consumable outbox. The latter leaves HU-085 open until a later
authorized notification-only release finishes; it does not require repeating a
still-reconciled activation unless drift invalidates it. After any canonical
event is created, a second deadline governs partial release/delivery: persist
per-event state, retry only by stable idempotency key, and, if still incomplete,
resume normal traffic under the preapproved durable residual/incident path with
HU-085 open. Never hold an outage indefinitely or claim that delivered messages
were rolled back. That residual is named degraded mode and has a separate owner,
TTL, affected-shift/range fence, and escalation. At TTL expiry the operator must
finish release or terminally cancel/supersede every intent proved never submitted
under any dispatch epoch. `Unknown`, accepted, and delivered results stay immutable
possible-delivery history and require reconciliation/correction before the scoped
fence lifts; the residual cannot become
an indefinite swap/correction outage. If no mechanism safely fences/drains old
revisions and triggers, the window stops before further mutation.

Held notification intents use the separate backend-owned outbox from HU-082,
outside every normal current/old notification trigger. Release alone creates
canonical consumable events idempotently through the assignment/member-version
transaction/CAS. Every asynchronous FCM attempt performs its own fresh recipient/
token check while holding the shared dispatch lease before submission. Canonical
shift events, inbox rows, and push payloads contain only generic non-sensitive copy/
reference and lifecycle metadata; they never persist member names, shift dates, or
effective assignments. Current-revision detail is fetched under authorization
whenever either the push or inbox row is opened, and durable offline caches remain
generic. Each canonical event stores immutable attempts with stable `attemptId`,
lease owner/epoch/deadline, validation digest, authenticated start, and terminal
`accepted|unknown|failed`; aggregate state is derived without replacing attempts.
Authenticated submission start under
the current lease—not a possibly lost acknowledgement—is the guarantee boundary.

In this story, **exact recovery** means semantic restoration of business/public
fields, rotation/cursor state, Sheet values, and the manifested non-security
configuration. It intentionally preserves append-only backend operation markers,
terminal registry tombstones, per-event replay ledgers, and the monotonic security/
write epoch. Hardened epoch-aware Rules never revert to the permissive release, and
an affected legacy server writer that bypasses Rules is never re-enabled; rollback
serves an epoch-aware compatibility revision with the feature inactive or keeps that
ingress closed. The recovery transaction restores the prior business active revision
but advances the security epoch, so an old queued write cannot become valid again.
These intentional security/audit residuals are client-inert, excluded from canonical
business/planner equality, listed in the recovery manifest, and tested.

## Authorization packet

Planning this story authorizes no live mutation. The refreshed packet contains:

- commit, project/paths/region, exact Function allowlist, current/candidate
  revisions, Rules/indexes diff, and effective runtime identities;
- maintenance-fence/allowlist/drain procedure and in-flight baseline;
- complete Rules-bypassing privileged-writer inventory, freeze/revocation state,
  causally bounded drain and abort evidence if it cannot be proved, effective IAM
  ancestry/SA/WIF/group/deny-policy manifest, Audit Logs/update-time checks, and
  exact restoration plan;
- dedicated-account IAM/workbook permissions, or accepted Compute fallback;
- temporary least-privilege control-plane deployer, exact targets/actions,
  chosen rehearsed unaffected-prior/epoch-aware rollback path, narrowly bounded `actAs` if that
  path requires redeploy, negative data/token/workbook proof, and revocation;
- named Drive permission controller, ACL/protection-only operation manifest,
  activity evidence, and subsequent writer freeze;
- invoker-only operator principal/IAM, negative direct-data/impersonation proof,
  rollout-only endpoint, and exact command allowlists;
- workbook fingerprint, tabs/aliases, sharing state, and protected parameter
  presence/fingerprint;
- complete workbook-writer/automation inventory, execution/Drive activity,
  editor/protection/API/trigger fence, revision/digest comparison, timeout, and
  exact restoration procedure;
- workbook location (`driveId`/My Drive/Shared Drive), owners/roles/capabilities,
  reversible owner fence or separately authorized transfer/move proof;
- post-drain quiescent Firestore/workbook backups, present/absent manifests,
  planner/digest inputs, forward/inverse budgets, comparison, and renewed approval;
- degraded-mode owner, TTL, affected shift/range mutation fence, escalation, and
  terminal intent cancellation/supersession procedure;
- Firestore/workbook/config/revision/Rules recovery points and a manifest of
  objects that apply/stage/activate will create, update, or delete;
- HU-083 trigger model, deferred develop repair (if any), production migration
  plan, one `migrationBaselineRevision`/digest, its derived preview/stage lineage,
  orphan cleanup, and rollback actions;
- full-season preview/stage/activation impact for each type, public-visibility
  boundary, one combined two-type digest and bounded single-transaction bundle
  promotion for installed clients,
  digest-bound activation/recovery Sheets-sync command IDs, backend-mutation
  event disposition, held notifications, time limits, read-backs, aborts, and
  owners.

The maintainer explicitly authorizes every fence, IAM/sharing, parameter,
Function deploy, Rules/indexes deploy, migration apply, stage, activation,
notification release, and traffic-resume operation. Approval is bound to exact
targets/snapshot/digest/revisions and expires on drift.

## Scope

### In scope

- Read-only identity/configuration/data/deployment preflight.
- Separately authorized additive-index readiness and temporary restrictive
  Rules/ingress bootstrap, followed by a proven maintenance fence, exact
  operation allowlist, and in-flight drain.
- Inventory, fence, and repeated drift checks for every Admin SDK/server/IAM
  writer that can bypass Firestore Rules on the affected paths.
- Recoverable Firestore, workbook, parameter, Function, Rules, IAM, and sharing
  state plus create/update/delete manifests.
- Dedicated least-privilege runtime identity or accepted Compute fallback.
- Separate temporary least-privilege control-plane deployer and named Drive
  permission controller; neither becomes an application data writer.
- Temporary keyless evidence/backup auditor with exact read/export-only source
  access and append-only encrypted evidence-destination access.
- Digest-bound runtime execution for every post-baseline repair, migration/
  bootstrap, preview lifecycle, stage, activation, sync correction, recovery, and
  manifested cleanup; no direct operator/deployer/controller/auditor/script writes.
- Minimum access to both stable environment workbooks for shared revisions, or a
  prior environment-specific Function split, plus a distinct IAM-restricted
  operator-only rollout channel.
- Protected production workbook parameter and minimum sharing.
- Recoverable fence for human and automated workbook writers plus revision/digest
  checks for the affected workbook surface.
- Exact allowlisted Functions deploy and exact Rules/indexes deploy/rollback, or
  proof that Rules/indexes are unchanged; additive indexes are `READY` before
  entering the main maintenance window.
- Digest-bound apply/read-back/rollback for deferred develop repair. Production
  rotation/source/projection bootstrap is built once as a hidden immutable
  migration baseline and cannot advance the active cursor or alter public rows.
- One production bundle `preview` for delivery and market whose only writes are
  private request/operation lifecycle state plus its immutable bundle/receipt;
  it has no rotation, candidate/public shift, Sheet, outbox, or ledger effects.
- One digest-bound versioned two-type `stage` hidden from normal members, Sheets,
  active rotation state, and notification consumers.
- Explicit atomic `activate` of that exact staged bundle. For installed flat-
  collection readers, the combined delivery/market public shifts, both rotation/
  cursor bootstraps, active metadata, controlled sync commands, and held intents
  must fit one Firestore transaction. Both types activate or neither does. This
  is the public-visibility boundary and may briefly be seen if rollback restores
  the prior bundle.
- Controlled Sheets synchronization plus Firestore, Android, iOS, and
  cross-environment reconciliation while notifications remain held.
- Explicit post-commit invocation/polling of the idempotent pending-command Sheets
  worker; no sync depends on enabling a document trigger after command creation.
- Workbook/partition epoch and lease serialization across activation and recovery
  commands, including worker/external-call drain and per-batch revision read-back.
- Separate idempotent canonical notification-event/inbox release, explicit
  at-least-once/possible-duplicate FCM evidence, and normal-traffic resume.
- Pre-activation rollback, post-activation recovery, and operational evidence.

### Out of scope

- New product design beyond safety corrections required by HU-082/HU-083.
- HU-084's assembly-gated coverage/credit policy.
- Calling a complete-season activation a small canary.
- Broad/unreviewed deploys, unrelated migrations, speculative access for both
  screenshot accounts, key files, or secrets in source/issues/logs.
- Normal-member visibility before activation or notification delivery before its
  separate release gate.
- Continuing after drift/failure without recovery, a revised packet, and new
  authorization.

## Preconditions

- HU-082/HU-083 code is merged; automated/local/emulator gates are green.
- Any HU-083 live apply is either safely reconciled or handed off as an exact
  zero-write digest/trigger model/manifest.
- ADR-0013 is accepted and bilingual requirements/data contracts are aligned.
- Production audit/dry-run reports no unresolved ownership ambiguity.
- Backups/restores and create/update/delete recovery are independently verified.
- The exact combined activation transaction and the distinct inverse recovery
  transaction are each measured and committed successfully in an exact emulator or
  isolated restored clone. Recovery includes prior-value restores, creates/deletes,
  mutation markers, recovery sync command, and held-batch cancellation. Production
  receives only a no-write digest/budget revalidation; activation is blocked if
  either manifest cannot commit atomically for installed flat readers.
- The staged candidate is in a separate backend-only partition; production
  admin builds understand and can inspect it, all supported member builds can
  read the final flat public projection, and the exact combined two-type promotion
  manifest fits every Firestore transaction limit. Otherwise activation is
  blocked pending a mobile active-revision migration.
- Preview/stage/activate binding, notification outbox/release, maintenance fence,
  mixed-revision behavior, and rollback are proven in tests/emulators.
- One immutable lineage binds `migrationBaselineRevision/digest -> preview
  digest -> staged revision -> active revision`; preview cannot read the legacy
  public baseline, and cleanup/rollback covers every exact descendant.
- Candidate `onShiftWritten` compares before/after backend-owned last-mutation
  markers for activation, repair, rollback/recovery, and sync correction, then
  validates the changed marker against the operation registry/digest. Only that
  exact event becomes an audited legacy-side-effect no-op; later ordinary edits
  retaining old metadata remain normal. Explicit commands/outboxes, not per-row
  events, own rollout side effects. Recovery deletes additionally require exact
  before-image version/path manifest validation. Registry tombstones/per-event
  ledgers survive the maximum configured delivery horizon plus safety margin;
  unknown changed backend markers fail closed and alert.
- A keyless independent evidence auditor can capture and verify every required
  pre/post-drain backup and phase read-back without source-data mutation. Backup
  destination encryption, ACL, retention, immutability, digest, and restore-test
  provenance are frozen in the authorization packet.

## Acceptance criteria

- [ ] Final preflight revalidates exact non-sensitive targets and the supplied
  stable workbook immediately before mutation.
- [ ] Tested temporary Rules block affected direct client writes; exact callable/
  HTTP/scheduled producers stop new work, accepted events/cascades drain, and
  exact triggers/deliveries are disabled with empty queues before access/config.
- [ ] Reopened affected writes require the current maintenance/write epoch and active
  revision in Rules/server validation. Stale/absent offline-client preconditions fail;
  unsupported direct clients remain closed or move to a versioned command path.
- [ ] Every Rules-bypassing writer is inventoried and either causally isolated for
  bounded accepted-work drain or recoverably frozen/revoked. Legacy revisions are
  not credited with an event-ID allowlist they lack; an unprovable causal drain aborts
  HU-085 for a separately specified bridge story. All drain identities are disabled/
  read back before migration.
- [ ] Effective IAM ancestry/conditions/deny policies, service-account IAM, WIF,
  transitive group membership, keys/workloads, Audit Logs, and affected state match
  the prior gate's expected checkpoint. Each result records the next authority/data
  checkpoint and any effective-access diff aborts despite an unchanged project etag.
- [ ] Required additive indexes reached `READY` before the main maintenance
  window, with timeout/rollback evidence for any non-additive release change.
- [ ] The dedicated runtime account has exact minimum roles/actions and no unrelated
  Auth/Storage/IAM/Secret/token/impersonation access. Its unavoidable database/project-
  scoped Firestore server-IAM blast radius, app-level path/operation allowlists,
  audit alerts, stronger isolation alternative, and any Compute fallback are explicit.
- [ ] A shared runtime identity retains only the required access to both stable
  environment workbooks and cannot cross-route protected configuration; the
  separate rollout operator is the only principal able to invoke allowlisted
  maintenance commands and has no Firestore/Sheets write or runtime-impersonation
  authority.
- [ ] Every post-baseline repair/migration/bootstrap/preview/stage/activate/sync-
  correction/recovery/cleanup mutation is invoked by exact operation ID/revision/
  digest. Only the candidate or pre-rehearsed epoch-aware recovery runtime writes
  affected Firestore/Sheet content; HU-083 script, operator, deployer, Drive
  controller, and auditor identities cannot do so.
- [ ] The temporary control-plane deployer can execute only the exact authorized
  deploy/Rules/Eventarc/config/IAM operations, can `actAs` only as needed to assign
  candidate/prior runtimes under the frozen rollback branch, and cannot read/write
  Firestore/Sheets, access the workbook, mint tokens, or impersonate any other
  service account. Unaffected prior-revision traffic rollback or exact hardened
  redeploy is rehearsed; affected legacy Admin writers are never re-enabled.
- [ ] The named Drive permission controller performs only the manifested ACL/
  protection fence while necessarily holding temporary edit capability. Activity/
  cell-digest evidence proves no content edit, and it is frozen/revoked before the
  quiescent baseline. Separate sealed, exact, temporary reauthorizations grant the
  candidate runtime after baseline approval and restore recovery/terminal ACLs.
- [ ] The temporary keyless evidence auditor has exact read/export-only access to
  source Firestore/workbook state and create-only access to an encrypted, ACL- and
  retention-bound evidence destination. It cannot edit source data or delete/
  overwrite retained artifacts; source revision/read time, digest, restore-test
  provenance, revocation, and read-back are recorded for each evidence window.
- [ ] Every existing/absent object, row/tab, event, IAM binding, parameter,
  Function revision, and Rules/indexes release has exact recovery evidence.
- [ ] Runtime `serviceAccount` changes occur only in the allowlisted deploy, not
  while merely provisioning IAM/workbook access.
- [ ] Human editors, Apps Script/installable triggers, add-ons, API/OAuth clients,
  service accounts, Shared Drive automations, transitive group/domain membership,
  Domain-Wide Delegation, and Workspace admin paths are inventoried and recoverably
  fenced/digested or proved absent. Drive/Workspace audit first proves zero continuing
  data-write paths; after access it proves candidate runtime sole writer per batch.
- [ ] Prior editors confirm online/closed/no-pending-offline state. Affected ranges
  remain protected until controlled reauthorization, forced server reload, and
  post-reopen observation/read-back; unconfirmed editors/automations remain read-only
  or use a versioned base-revision command path.
- [ ] Workbook location, owner(s), roles, and capabilities are resolved. A reversible
  mechanism truly fences every owner write path; otherwise rollout stops for a
  separate move/transfer decision with fixture and same-ID/link read-back evidence.
- [ ] After drain and zero-writer workbook fencing, fresh Firestore/workbook
  backups, absent/present manifests, digests, planner inputs, and forward/inverse
  budgets define the quiescent baseline. Any delta from the pre-drain packet is
  commit-rehearsed in an isolated restored clone and reauthorized before access/
  config/deploy/migration proceeds.
- [ ] Exact Functions/Rules/indexes are deployed; all required indexes reach
  `READY`; old/mixed revisions cannot process an unapproved event.
- [ ] Deferred develop repair and production bootstrap run only as exact candidate-
  runtime commands bound to the approved HU-083 manifest and operation revision/
  digest; no HU-083 apply credential is reused. Production bootstrap writes one
  immutable hidden migration baseline, leaves existing
  public rows/cursor unchanged, and cannot reach legacy export/notification
  consumers before activation.
- [ ] Preview writes only private request/operation lifecycle state plus its
  immutable bundle/receipt and matches the authorized two-type migration-baseline
  revision/digest with no domain/projection side effects or fallback to legacy
  public input.
- [ ] Stage writes only the exact versioned candidate and remains invisible to
  normal member queries, Sheets, active cursor/cohort, and notification consumers;
  its delivery/market bundle is the sole child of the authorized baseline/preview
  lineage.
- [ ] Activation requires separate approval and one bounded Firestore transaction
  atomically promotes the exact combined flat public manifest, both rotation/
  cursor bootstraps, active bundle metadata, digest-bound sync commands, and held
  intents; delivery and market become visible together or neither does.
- [ ] The separately measured inverse recovery manifest also fits and succeeds in
  one Firestore transaction in an exact emulator/isolated restored clone, including
  prior-value restores, created-object deletion, markers, recovery sync command,
  and held-batch cancellation. Production only rechecks digest/budget without
  writing; public activation cannot start without this matching tested exit.
- [ ] Activation/repair/rollback-recovery/sync-correction `onShiftWritten` events
  produced while deliveries are fenced are retained/audited and no-op on delayed
  replay only when create/update mutation markers validate or recovery deletes
  match exact before-image version/path. Tombstones outlive retry; unknown markers
  fail closed; later ordinary events cannot be suppressed.
- [ ] After activation/recovery commit, the rollout endpoint explicitly invokes or
  polls the candidate worker, which transactionally claims the exact pending sync
  commands and rediscovers them after call loss. No Eventarc creation replay is
  assumed.
- [ ] Each Sheets batch validates the current workbook/partition command epoch,
  active revision, and digest. Recovery first stops/supersedes and drains the
  activation command/lease plus any external call; an unproved drain blocks recovery
  and an old-epoch retry can never overwrite recovered values.
- [ ] An ambiguous Sheets call/drain enters its own timeboxed sync residual instead
  of extending the full outage: Firestore stays active/authoritative, notification
  outbox remains sealed, affected import/export and ranges stay fenced, and mobile/
  unrelated traffic resumes. Recovery is forbidden while a request may be in flight.
  At TTL expiry, revoke the exact worker invocation and workbook authority, wait a
  conservative maximum request/drain horizon, then require stable Drive activity,
  workbook revision, and read-back before reconciliation/recovery. If terminality
  still cannot be proved, obtain separate authorization either to quarantine/retire
  that workbook and publish a newly configured controlled projection without claiming
  link preservation, or to renew a named external incident and scoped fence. A TTL
  never silently rolls forward and HU-085 remains open.
- [ ] Active Firestore, controlled Sheets sync, Android, iOS, and develop
  isolation reconcile while held intents remain outside consumable notification
  paths.
- [ ] Any pre-activation failure restores exact business/external state and cleans
  manifested new objects while advancing the security epoch, retaining hardened
  Rules, and serving only epoch-aware affected writers (or keeping ingress closed).
- [ ] Any post-activation **rollback** recovery restores the prior active revision
  through an atomic backend recovery operation plus explicit Sheets-sync command
  and exact semantic business/external state, acknowledging possible transient
  member visibility. Append-only operation/tombstone/event evidence remains as
  manifested; the distinct safe-resume outcome retains the active revision.
- [ ] After separate approval, one transaction/CAS reads current assignment and
  membership versions while claiming the intent and creating its canonical event/
  inbox entry idempotently; stale versions write nothing.
- [ ] Every initial/retried FCM dispatch freshly revalidates current assignment,
  recipient UID, active membership/eligibility, and token ownership/version
  while acquiring a short lease honored by every writer of those values. Drift
  detected before authenticated submission starts terminally cancels/supersedes
  demonstrably unsubmitted state and never reuses old validation or silently retargets.
- [ ] Every canonical event has an append-only attempt ledger with `attemptId`, lease
  owner/epoch/deadline, validation digest, authenticated start, and terminal outcome.
  Bounded timeout/lease expiry becomes immutable possibly delivered `unknown`; retry
  appends a new lease/current-validation attempt and may duplicate.
- [ ] Canonical shift event, inbox, and FCM artifacts carry only generic non-sensitive
  copy/reference plus lifecycle metadata—never member name, shift date, or effective
  assignment. The app fetches current authorized detail on every push/inbox open;
  offline or stale caches remain generic. Evidence explicitly accepts delayed/
  duplicate generic OS
  presentation after a later membership change, defines authenticated submission
  start as the guarantee boundary, and makes no presentation-time membership or
  exactly-once guarantee.
- [ ] Every fenced phase has a maximum duration. Delayed/failed notification
  approval cannot prolong outage: the authorized rollback or safe-resume-with-
  sealed-outbox outcome runs by the deadline, and HU-085 remains open if release
  is incomplete.
- [ ] Partial release/delivery has a separate deadline and per-event ledger;
  pending canonical claims retry idempotently, completed canonical event/inbox
  effects never duplicate, and a durable residual resumes normal traffic while
  keeping HU-085 open. FCM may still present a duplicate after an authorized send.
- [ ] A sealed or partially released batch keeps both per-type release leases and
  blocks every stage/activate touching either type until terminal reconciliation
  or valid bundle rollback; safe resume does not clear them.
- [ ] Safe resume also keeps affected shift IDs/revision immutable to swaps,
  overrides, Sheet imports/edits, and other assignment changes until release is
  terminal. Unrelated traffic/editor access may resume; emergency corrections
  must explicitly supersede only intents proved never submitted under any epoch;
  `unknown`/accepted/delivered events remain immutable possible-delivery history.
- [ ] Notification degraded mode has a named owner/TTL/escalation. By expiry,
  release finishes or every demonstrably unsubmitted intent is terminally
  cancelled/superseded under a new digest, every `unknown` is retained and
  reconciled as possibly delivered, and the scoped fence is lifted; HU-085 remains open.
- [ ] Normal traffic resumes only after final revision/index/queue/read-back
  checks, and no unapproved operation was processed during the window.
- [ ] Every terminal exit expires operation IDs, closes maintenance state, revokes
  temporary rollout-operator IAM, and proves any retained endpoint is inert without
  a new time-bounded authorization.
- [ ] No secret, raw workbook ID, parameter value, member export, or credential
  key enters committed/public evidence.

## Dependencies

- HU-082 / #266: rotation, frontier, stage/activate, notification, and mobile
  visibility contract.
- HU-083 / #267: multi-season adapter, trigger model, and migration tooling.
- HU-084 / #268 is independent and does not block base activation.
- Extends the production rollout/manual acceptance gap left by HU-020 / #19.

## Abort criteria

- Target, snapshot/digest, identity, workbook fingerprint, revision, Function
  allowlist, Rules/indexes diff, or manifest differs from approval.
- Post-drain quiescent state lacks fresh backups/manifests/budgets, or differs from
  the authorized packet without renewed phase approval.
- Fence/drain, backup/restore, or created-object cleanup is absent/stale.
- Audit contains ambiguous ownership or unexplained disagreement.
- Any deferred repair/migration write can reach an uncontained old/current
  trigger.
- A required index is not `READY`, a mixed revision can receive work, or access/
  parameter read-back targets the wrong boundary.
- Temporary Rules/ingress cannot close direct and callable/event writes, any human
  or automated workbook writer cannot be fenced, exclusive writer ownership is
  unproved, or workbook revision/digest drifts before a mutation.
- My Drive/Shared Drive location, ownership, or capabilities are unknown; an owner
  remains able to write; or a required transfer/move cannot prove the same file ID/
  link and bound integrations before production authorization.
- Any Admin SDK/server/IAM writer is unknown, unfrozen, newly active, or disagrees
  with the current expected IAM/log/workload/data checkpoint; any state change not
  produced by the preceding manifested operation is drift.
- Upstream intake/independent writers cannot be closed to leave a causally bounded
  accepted-work drain, its ledgers/quiet horizon are unproved, or any drain identity
  remains write-capable after terminal drain/before migration.
- The operator-only boundary or exact selective worker allowlist is absent, the
  shared runtime loses develop workbook access/can cross-route, or queued shift
  event disposition is unproved.
- The rollout operator can write Firestore/Sheets directly, impersonate the runtime,
  mint its tokens, or bypass endpoint operation-ID/revision/digest validation.
- The control-plane deployer/Drive controller is implicit, overprivileged,
  unaudited, or retains temporary authority at exit; the deployer reaches data, or
  controller activity/cell digest shows anything beyond exact ACL/protection work.
- A terminal outcome cannot close/read back maintenance state, expire all operation
  IDs, or revoke temporary operator IAM.
- Preview writes, stage becomes normally visible, or activate is not atomic and
  bound to the exact candidate, including when the public manifest exceeds the
  single-transaction budget for installed clients.
- The exact inverse recovery transaction exceeds Firestore limits or has not been
  exercised successfully against the frozen manifest.
- Baseline/preview/stage digests do not form one exact lineage, preview falls back
  to legacy public input, an orphan candidate is unmanifested, or a pending
  release lease can be superseded.
- Operation tombstones/event ledgers would be cleaned before delivery expiry, an
  unknown changed backend marker could cause side effects, or recovery deletion
  events lack exact before-image manifest evidence.
- Firestore/Sheets/apps diverge, or a notification reaches a normal consumer
  before release.
- Sensitive values appear or an unreviewed target becomes necessary.

## Definition of Done and aborted outcomes

The story is complete only when every acceptance criterion is evidenced, the
intended bundle revision is active, migration/activation reconcile, and every
intent has an approved terminal outcome: valid recipients have idempotent event/
inbox evidence, stale recipients are cancelled/superseded with audit, and any
incident residual/correction plus FCM evidence is reconciled. Normal operation
must also have resumed safely.

If an attempt rolls back before or after activation, it may be recorded as safely
recovered, but HU-085 remains open/not done until a newly authorized activation
completes. If the preapproved safe-resume branch retains a reconciled active
revision with a sealed or partially released outbox, that activation remains
valid unless later drift invalidates it; HU-085 stays open until a separately
authorized notification-only window reconciles every event and normal operation.
Neither residual is successful completion by itself.

- [ ] Completed activation links every phase authorization and evidence.
- [ ] No unreported Android/iOS parity, develop-isolation, queue, or data residual
  remains.
- [ ] Operational docs and public evidence are secret-safe.
- [ ] Issue and any PR/commit/deployed revision are linked.
