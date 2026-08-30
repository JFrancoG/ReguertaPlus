# [HU-085] Controlled production shift workbook activation

## Tracking

- GitHub issue: #269
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/269
- State: DRAFT / BLOCKED BY HU-082, HU-083, AND LIVE AUTHORIZATION
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation/rollout branch: not created
- Depends on: HU-082 / #266 and HU-083 / #267
- Independent of: assembly-gated HU-084 / #268

## Summary

Activate the supplied stable production workbook and planner inside a governed
shared-project window. Prebuild additive indexes, establish a temporary Rules/
ingress bootstrap barrier, fence every human/automated workbook writer, deploy
exact revisions, build production migration once as a hidden immutable baseline,
run side-effect-free
preview, stage one delivery-plus-market bundle, atomically activate its bounded
combined public manifest, reconcile, then release canonical notification events
and resume normal traffic. Either both shift types activate or neither does.

Read-only metadata confirmed legacy tabs `TORRE 2025-26` and `MERCADO 2025-26`.
The raw URL/ID remains outside committed/public evidence and becomes a protected
runtime parameter.

## Identity conclusion

The screenshot contains service-account emails, not workbook links/config. A
read-only check on 2026-08-23 confirmed five relevant deployed shift/Sheets
Functions, including `onDeliveryCalendarOverrideWritten`, currently run as
`195744802339-compute@developer.gserviceaccount.com`; deployed metadata contains
only a develop Sheets connection.

Prefer one dedicated least-privilege runtime account applied only in the exact
Function deploy. Because those revisions serve both paths, it needs minimum
explicit access to both stable environment workbooks with protected cross-route
guards; separate identities require first splitting Functions by environment.
Use the distinct invoker-only operator principal pinned in HU-082 as
`reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com` for rollout
commands. HU-082 names it in source but does not provision it. It receives no
Firestore/Sheets role, workbook access, runtime impersonation, or token minting.
Every post-baseline data mutation—repair, migration/bootstrap, preview lifecycle,
stage, activate, sync correction, recovery, or manifested cleanup—uses an exact
operation ID/revision/digest through the candidate endpoint. Only the candidate
runtime, or its pre-rehearsed epoch-aware recovery revision under the same governed
data identity, writes Firestore or Sheet content. HU-083 scripts contribute only
reviewed manifests/dry-runs inside HU-085; their principal or credentials are never
reused for live rollout writes.
Use a third, temporary least-privilege control-plane deployer for exact Functions/
Rules/Eventarc/config/IAM actions and a named Drive permission controller for the
manifested ACL fence. The deployer has no data path; the controller's unavoidable
temporary edit capability is exact-action/cell-digest audited, then revoked. Both
are revoked at terminal exit; recovery requires sealed temporary reauthorization.
The packet must rehearse prior-revision traffic rollback without redeploy or grant
`actAs` only on candidate plus exact prior runtime for frozen rollback deploys.
After baseline approval, a separate sealed Drive-controller action grants only the
candidate runtime, then revokes; terminal ACL restoration uses the same pattern.
Use a separate temporary keyless evidence/backup workload for exact read/export
actions only. It may write only encrypted, access-controlled, retention-bound
evidence artifacts, cannot mutate the source workbook or application data, and is
revoked/read back after each authorized evidence window.
Compute default is an explicit broader-blast-radius fallback. Do not share with
`firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com` without a proved
caller. The protected workbook ID, not either email, is the parameter.

## Links

- Spec: `spec/shifts/hu-085-production-shift-workbook-activation/spec.md`
- Plan: `spec/shifts/hu-085-production-shift-workbook-activation/plan.md`
- Tasks: `spec/shifts/hu-085-production-shift-workbook-activation/tasks.md`
- ADR: `docs/decisions/0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md`

## Hard gate

- [ ] HU-082/HU-083 integrated with green automated/local/emulator evidence and
  any unsafe develop apply handed off by exact digest/trigger model.
- [ ] Final identity, workbook fingerprint, fence/drain, backups/manifests,
  Functions, Rules/indexes, migration, and recovery packet authorized.
- [ ] Runtime data-writer, invoker-only operator, temporary infrastructure deployer,
  audited/revoked Drive permission controller, and keyless read/export-only evidence
  auditor remain distinct. The auditor writes only immutable backup/evidence output.
- [ ] Every post-baseline repair/migration/preview/stage/activation/sync-correction/
  recovery/cleanup mutation is an exact digest-bound runtime command; no operator,
  deployer, controller, auditor, or HU-083 script identity writes affected data.
- [ ] Additive indexes are `READY` before maintenance; temporary Rules and exact
  callable/HTTP/scheduled-producer disable stop new work, accepted cascades
  drain, then exact triggers/deliveries disable with empty queues.
- [ ] Every Admin SDK/server/IAM writer that can bypass Rules is inventoried and
  recoverably frozen/revoked. After every upstream intake/direct writer closes,
  exact current deliveries drain only the causally bounded accepted set; if that
  cannot be proved, HU-085 aborts for a separately specified bridge-revision story.
- [ ] Chained checkpoints hash effective IAM ancestry/conditions/deny policies,
  service-account IAM, WIF, transitive group membership, keys/workloads, logs, and
  data; an effective-access diff aborts even if the project IAM etag is unchanged.
- [ ] Human editors plus Apps Script triggers, add-ons, API/OAuth clients, service
  accounts, Shared Drive automations, group/domain membership, Domain-Wide
  Delegation, and Workspace admin paths are recoverably fenced/digested; Drive/
  Workspace activity first proves zero writers and then candidate sole writer.
- [ ] Editors prove online/closed/no pending offline changes; reopening forces server
  reload plus post-observation. Stale client/automation writes require current write
  epoch and base revision or remain closed/read-only.
- [ ] Recovery never rolls back the security epoch or hardened Rules and never
  re-enables an affected legacy Admin writer; it restores business state under an
  epoch-aware compatibility revision or leaves that ingress closed.
- [ ] My Drive/Shared Drive location, owners, roles, and capabilities are known; if
  no reversible owner fence exists, rollout stops for a separately proven same-ID/
  link transfer or move rather than silently replacing the workbook.
- [ ] A fresh post-drain quiescent backup/manifest/digest/budget packet replaces
  pre-drain data as the migration baseline and is reauthorized on any difference.
  A keyless read/export-only auditor captures it into an encrypted, ACL- and
  retention-bound destination, then its grants are revoked and read back.
- [ ] Dedicated runtime IAM records the unavoidable project/database Firestore
  server-access blast radius, denies unrelated services/token/impersonation, and
  combines audited app-level path/environment/operation guards with a documented
  stronger separate-project/database or mediated-writer alternative.
- [ ] Deferred develop repair and hidden production migration are invoked through
  exact candidate-runtime operation IDs/revisions/digests; HU-083 contributes only
  the approved dry-run/manifest. Production migration stays hidden
  as one immutable baseline and leaves public shifts/cursors unchanged before
  activation; baseline, combined preview, staged bundle, and active bundle form
  one cleanup lineage.
- [ ] Preview writes only private control-plane lifecycle records and stage is
  invisible to normal members/Sheets.
- [ ] Each type passes its own frontier/replay gate; the complete combined flat
  manifest fits and commits in one Firestore transaction for installed clients,
  or neither type activates and rollout blocks for client migration.
- [ ] The distinct inverse recovery manifest is also measured and rehearsed as
  one Firestore transaction in an exact emulator/isolated restored clone;
  production only rechecks its digest/budget without writing before activation.
- [ ] Separate public activation, notification release, and traffic resume are
  authorized and reconciled.
- [ ] Canonical event/inbox creation is idempotent; FCM carries stable event ID/
  collapse metadata but remains at least once with possible duplicate push.
- [ ] Canonical shift events, inbox rows, and pushes contain only generic copy/
  reference, never member name, shift date, or effective assignment. Both clients
  fetch fresh authorized detail on push/inbox open and keep offline caches generic.
- [ ] Exact backend mutation markers, retained operation tombstones/event ledgers,
  and explicit activation/recovery sync commands make delayed per-row trigger
  events no-op without suppressing later ordinary edits/deletes.
- [ ] Sheets sync explicitly pulls/claims pending commands after commit and retries
  discovery; it never depends on enabling a trigger after its creation event.
- [ ] A workbook/partition epoch lease serializes activation and recovery sync;
  stale retries fail and recovery blocks until prior worker/external calls drain.
- [ ] Ambiguous Sheets drain uses a timeboxed residual: Firestore stays authoritative,
  outbox sealed, only affected Sheet surfaces remain fenced, and unrelated/mobile
  traffic resumes. At expiry, exact worker/workbook authority is revoked and a
  conservative drain/activity horizon is proved before recovery; absent proof, a
  separately authorized workbook quarantine/new projection or renewed named incident
  replaces silent indefinite waiting.
- [ ] Phase deadlines force rollback or a preapproved safe resume with sealed
  outbox; a retained reconciled activation can finish later in a notification-
  only window without needless reactivation.
- [ ] Partial release uses per-event idempotency/delivery state and a second
  deadline; normal traffic resumes through the authorized residual path with the
  issue open without duplicate canonical event/inbox effects; FCM may still show a
  duplicate after an authorized at-least-once send.
- [ ] Every terminal outcome expires rollout operation IDs, closes maintenance
  state, revokes temporary operator IAM, and leaves any retained endpoint inert.
- [ ] Event/inbox claim uses a transaction/CAS over current assignment/member
  versions; every FCM send/retry freshly validates UID, eligibility, assignment,
  and token ownership under a writer-honored dispatch lease. Only drift detected
  before authenticated submission starts cancels demonstrably unsubmitted state;
  generic push detail is fetched under authorization on open.
- [ ] Each canonical event has append-only attempts with ID, lease epoch/deadline,
  validation digest, authenticated start, and outcome. `Unknown` is immutable possible-
  delivery history; retry appends a revalidated attempt and may duplicate.
- [ ] The notification residual is named degraded mode with owner/TTL/escalation and
  a scoped affected-shift/range fence; expiry cancels only intents proved never
  submitted and reconciles `unknown`/accepted/delivered history before lifting it.
- [ ] Abort/recovery evidence leaves the issue open; only the completed rollout,
  including terminal notification reconciliation and safe normal operation, is Done.
- [ ] No raw workbook ID/URL, protected parameter value, member export, credential
  key, or secret in committed/public evidence.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:backend`
- `priority:P1`
