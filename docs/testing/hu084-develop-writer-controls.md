# HU-084: reversible develop writer controls

> **Policy update — 2026-10-28:** [ADR-0021](../decisions/0021-use-cooperative-owner-maintenance-for-shift-workbooks.md)
> accepts a bounded no-edit agreement with the named owner instead of technically
> removing their manual edit capability. Other writer, delivery, drain and
> notification controls, and `canApply:false`, remain unchanged. Historical results
> and physical-fence limitations below remain valid; implementation and live
> authorization are still pending.

Status: **historical preparation with current inventory — `canApply:false`**.
The original capture below predates the four collectors and six compatibility
updates. Their verified live checkpoint is in the [backend handoff guide](hu084-backend-handoff-rehearsal.md).
Direct-client Rules are now applied and verified through the authorized real
Auth/document probe. Remaining server authority still awaits its separate gates;
`closeAndCollect` has not admitted shared maintenance. ADR-0022 separately accepts
develop-only human-administrator cooperation; its versioned contract, current
confirmations and all automated-writer controls remain required.

[Versión en español](../../docs-es/testing/hu084-controles-escritores-develop.md).

Follow-up on 2026-10-28: the [selective pause and isolated-copy mechanism
rehearsal](hu084-selective-develop-pause.md) passes locally, including the real
copy-only lock/reversal and cleanup. It does not apply these controls to develop.

The original preparation conditions, retained as history, are:

1. The published dates and participant order stay as they are. This preparation
   describes how to pause changes safely; it does not migrate or regenerate shifts.
2. The prepared Firestore rule change pauses **all writes from develop apps**,
   including users and orders. Reads continue. Production keeps its captured rule
   behavior, but deploying this shared Rules release would need a later review.
3. Several backend services also serve production. Stopping them or revoking their
   shared account permissions would affect production. Their develop-only pause is
   still unresolved.
4. The develop Sheet's owner retains control of the file. A file content lock is a
   possible option to test on a new copy, subject to verified capabilities. It is
   not yet an available, held migration control.

## Scope and authority

This work continues HU-084 (#268) and the activation safeguards of HU-085 (#269).
It prepares controls for `develop` in the existing shared Firebase project. It
does not authorize deployment, IAM/Drive permission changes, a content lock,
ownership transfer, maintenance entry, migration, reopening, or production writes.

Preserve the 72 published dates, 108 ordered places and 62 raw legacy shifts.
Keep the 53 helper suggestions unapplied and the missing July/August 2027 market
dates ungenerated. These controls do not change planning readiness or initialize
coverage. Raw principals, permission IDs, workbook IDs and provider observations
remain in restricted evidence outside Git.

The authority is the compiled inventory
[`hu082-affected-writers-v4`](../../functions/src/shift-planning-writer-inventory.ts):
schema 1, **29 logical writers**, comprising 23 intake-barrier writers and six
activation-version rechecks. Function count is not writer count. The private
inspection is read-only and does not add a writer.

The compiled v4 inventory is the logical source inventory, not a completed
reconciliation of live authority. Its four public client IDs do not implicitly
cover the deployed catch-all's private planning/coverage access. The stronger
all-develop candidate closes that access physically, but the client group/targets
and accepted inventory revision/digest must be reconciled before any held-barrier
checkpoint can be admitted. Explicit owner cooperation adds one participant:
30 logical writers and 24 intake controls. V4 adds the three Sunday reminder
Scheduler jobs missing from V3; each requires disabled ingress and independent
pending/in-flight reconciliation before causal capture. Rehashed V3 evidence
without them cannot admit a new transition. Live jobs are still enabled and
resolve only develop; setting their target to production would change behavior.

## Current evidence and its limits

The read-only control capture on **2026-10-27** records:

- 20 active Functions: the 19 prior services plus the dedicated private inspector.
- `syncShiftsFromGoogleSheets` and `exportShiftsToGoogleSheets` are deployed HTTP
  services with Cloud Run `roles/run.invoker` bindings. Invocation IAM does not
  establish that develop mutation is closed or in-flight calls are drained.
- Four relevant Firestore trigger filters use `{env}`:
  `shiftPlanningRequests/{requestId}`, `shifts/{shiftId}`,
  `deliveryCalendar/{weekKey}` and `notificationEvents/{eventId}`, under
  `{env}/plus-collections`. Their services are shared with production.
- Both service accounts with visible develop-file writer grants are active and
  have zero user-managed keys. The Compute account has `roles/editor`,
  `roles/eventarc.eventReceiver` and `roles/run.invoker` project bindings. The
  other account has `roles/firebase.sdkAdminServiceAgent`,
  `roles/firebaseauth.admin`, `roles/storage.admin` and
  `roles/iam.serviceAccountTokenCreator`. These are shared, broad authorities;
  zero keys does not mean zero workloads, tokens or effective write access.
- The owner-side connector shows one owner, two service-account writers and the
  inspector reader. It omits permission IDs and inheritance detail. This is not
  a complete, executable ACL patch or proof that no other authority exists.

The inspector's earlier **63 passing tests**, successful six-tab read and Drive
version **259** before/after remain retained evidence. They were **not renewed**
for this preparation. The temporary OIDC creation grant remains removed; no
regrant was made to refresh those observations. Version 259 cannot be used as a
current apply precondition. This new capture is metadata inspection, not a
maintenance checkpoint, a full workbook baseline or delivery-drain evidence.

## Exact deployed-source audit

The six legacy entrypoints were inspected from their immutable GCS source
provenance, not inferred from this branch: `syncShiftsFromGoogleSheets`,
`exportShiftsToGoogleSheets`, `onShiftPlanningRequestCreated`, `onShiftWritten`,
`onDeliveryCalendarOverrideWritten` and `onNotificationEventCreated`.
All six archives have identical content: 152,987 bytes, SHA-256
`07cd231c91df1e7bd31ab6a9f6a711559536aca3e7de697e641628d6c8216b49`.
The package runs `lib/index.js`; both that JS and its TS source were checked.
Source, revisions, generation references and declaration hashes remain private.

None of these handlers contains a develop pause, maintenance/epoch/active-revision
check or in-flight guard before effects. Planning replaces the seasonal Sheet,
persists shifts and creates notification work; the other shift/calendar paths
also perform external effects. The notification dispatcher sends before recording
its result and has no causal/idempotent submission ledger.
The Sheets config resolver falls back from the environment-specific key to a
generic key: deleting develop parameters is not a safe pause. The current local
branch differs from this deployed source.

A develop-only compatibility bridge must therefore be designed against this exact
baseline and tested before any shared revision changes. `DO_NOT_RETRY`, concurrency
one and a 60-second timeout do not themselves prove causal drain or safe reopening.
This audit supplies provenance, not a closed checkpoint or deployment authority.

## Prepared Firestore candidate

[`firestore.develop-writer-controls.rules`](../../firestore.develop-writer-controls.rules)
is derived from the captured deployed Rules, not from the broader local strict
policy. The exact captured baseline is **6,712 bytes**, SHA-256:

```text
bb87cdacc63dc4e285ac24d50b8f2f8c64eff3def1e4fcf24265030059591dfa
```

It adds `env != "develop"` to each applicable write admission. It pauses all
develop client creates, updates and deletes, including legacy collections,
private planning/coverage roots, orders, users and configuration. Existing reads,
the anonymous public-config exception and production admissions are preserved.
Adding a separate deny match would not override another matching allow.

The deliberately broad develop pause avoids leaving private roots writable via
the captured fallback. It is a temporary client control; Admin SDK/IAM writers
bypass it. No physical app or production behavior is proved by an emulator run.

The isolated
[`firebase.develop-writer-controls-emulator.json`](../../firebase.develop-writer-controls-emulator.json)
and [local Rules suite](../../functions/test/firestore/develop-writer-controls.rules.test.cjs)
compare the exact baseline, candidate and pre-write restoration using synthetic
data. All 12 cases pass, with zero failures/skips. They verify develop denial,
read/production parity, actual captured published images and epoch unchanged,
and privileged server access remaining outside this fence. The accepted run
uses real captured emulator images; callback return values are not used as snapshots.
The emulator configuration is not a deployment route.

The current Firestore release and its immutable prior ruleset were also read
through the Rules API; their exact source matches the frozen baseline above.
Those identifiers stay in the private packet. Restoring that release reference
requires held publication authority and current own-post-image checks throughout;
a read/compare/patch sequence alone is not an exclusion guarantee.

## Prior state and reversal conditions

Each future control must bind the exact resource, captured prior state, intended
post-image, operation owner, observation time, digest and restoration action.
Unknown prior values are blockers, never an empty default. The codes below apply
to the writer matrix; none is an executable authorization.

| Code | Required prior state | Reversal condition and current limitation |
| --- | --- | --- |
| R | Exact deployed Rules source/release and complete own candidate post-image | Restore the old permissive Rules only before any authoritative business write, epoch transition or uncertainty, and only while the current Rules still match this operation's post-image. Otherwise keep the fence and use governed recovery. |
| H | Exact deployed HTTP revision/source, runtime, ingress and IAM policy | A develop-only admission bridge remains unprepared. Reversal must preserve production behavior and match the operation's current post-image; closing the shared service/IAM globally is outside scope. |
| T | Exact deployed trigger source/revision, event filter, delivery and causal-work state | A selective develop pause/drain remains unproved. Do not treat trigger deletion/recreation or expired leases as safe reversible drain; replay/loss and retained uncertainty must be resolved. |
| N | Exact causal notification IDs, work state and serving contract | Isolate only the manifested shift-caused delivery. Do not stop all production notifications. A generic notification trigger being active is not a closed shift-delivery control. |
| A | Effective IAM, inherited/conditional access, token/workload provenance and all relevant server entry points | Rules do not fence Admin access. Do not revoke shared account roles or credentials for develop. Missing ancestry, delegated authority or execution visibility remains a blocker. |
| W | Exact develop-file location, owner capabilities, full restrictions/ACL prior state, stable version and content digest | A file-scoped control is only a candidate. Restore only the operation's exact current restriction/ACL post-image and unchanged content binding; any unknown or drift stops reversal. Owner unlock and the no-gap transition remain unresolved. |
| V | Candidate activation source/version, captured fairness projections and bound planning authority | Recheck the actual activation version and inputs. No global disable/re-enable is proposed, and local candidate checks do not prove the older deployed runtime implements them. |

After any authoritative migration/write or write-epoch advance, or when submission
is uncertain, **keep the controls closed**. Use the distinct governed inverse and
epoch-aware recovery. A pre-write control restoration is not migration rollback;
never restore old permissive Rules merely to recover availability.

## Exact 26-writer disposition

“Not observed” means this capture did not establish a deployed counterpart. It is
not an accepted `disabled`, zero-queue or absent-authority checkpoint. Logical
workers remain bound to their actual exported runtime when one is identified.

| Writer ID | Current surface and prepared scope | Prior/reversal | Blocker or required evidence |
| --- | --- | --- | --- |
| `firestore-client-shifts` | Shared Rules; candidate denies develop client writes | R | Local candidate only; no deployed closure |
| `firestore-client-delivery-calendar` | Shared Rules; candidate denies develop client writes | R | Same; no server fence |
| `firestore-client-shift-planning-requests` | Shared Rules; candidate denies develop client writes | R | Same; old accepted requests still need causal drain |
| `firestore-client-shift-swap-requests` | Shared Rules; candidate denies develop client writes | R | Same; retained transitions remain to inspect |
| `https-sync-shifts-from-google-sheets` | Deployed `syncShiftsFromGoogleSheets`; shared HTTP/IAM | H | No verified develop-only bridge or invocation drain |
| `https-export-shifts-to-google-sheets` | Deployed `exportShiftsToGoogleSheets`; shared HTTP/IAM | H, W | No selective bridge; workbook lock also blocks governed exports |
| `https-transition-shift-swap` | No deployed counterpart observed | H | Establish actual deployment/admission/work state; absence is not closure |
| `https-shift-coverage` | No deployed counterpart observed; local readiness stays false | H | Candidate availability is not runtime closure evidence |
| `worker-shift-coverage-effects` | Source worker; no separate deployed Function observed | T, W, N | Identify owning runtime and prove accepted work drained/retained safely |
| `worker-shift-coverage-push` | Source worker; no separate deployed Function observed | T, N | Same; do not invent a Function switch |
| `trigger-on-shift-planning-request-created` | Deployed `onShiftPlanningRequestCreated`, shared `{env}` | T | Audited source has no develop guard; causal drain remains unproved |
| `trigger-on-versioned-shift-planning-request-created` | No deployed counterpart observed | T | Candidate checks cannot certify old shared runtime |
| `trigger-on-shift-written` | Deployed `onShiftWritten`, shared `{env}` | T, W, N | Develop-only export/notification pause unproved |
| `trigger-on-delivery-calendar-override-written` | Deployed `onDeliveryCalendarOverrideWritten`, shared `{env}` | T, W | Develop-only pause and workbook drain unproved |
| `trigger-on-notification-event-created` | Deployed `onNotificationEventCreated`, shared `{env}` | N | Causal isolation required; blanket notification shutdown excluded |
| `firestore-client-membership-fairness` | Candidate Rules also deny develop users; activation fairness recheck remains required | R, V | Client closure does not certify server writes or activation version |
| `firestore-client-planning-config` | Candidate Rules also deny develop config; activation recheck remains required | R, V | Same; public reads retained |
| `https-resolve-authorized-member` | Shared deployed member endpoint | V, A | Recheck fairness projection/version in actual activation path |
| `https-upsert-member-by-admin` | Shared deployed admin endpoint | V, A | Same; no global shutdown proposed |
| `https-clone-global-config` | Shared deployed config endpoint | V, A | Same; no global shutdown proposed |
| `https-config-maintenance-writers` | Shared validators and product/container/measure/user/order triggers | V, A | Actual source/projection check required; unrelated production delivery stays active |
| `iam-firestore-admin-and-server-writers` | Shared Admin/IAM, console, jobs, CI and other workloads | A | Broad shared roles are not path-scoped; no external-authority fence is proved |
| `workbook-human-and-offline-editors` | Develop file owner/editors and pending offline edits | W | ACL cannot demote its My Drive owner; lock capabilities/no-gap control unproved |
| `workbook-apps-script-and-addons` | Bound/standalone scripts, triggers and add-ons | W | Maintainer declares only the app and actions here; other accounts' triggers may be invisible |
| `workbook-api-oauth-and-service-accounts` | Two visible active service-account writers plus possible OAuth clients | W, A | Permission IDs/inheritance missing; file-scoped patch is not ready |
| `workbook-shared-drive-and-admin-authority` | Location, transitive groups/domain, delegation and administrator routes | W, A | Omitted connector metadata does not prove absence |

## Conditional content-lock rehearsal

Drive documents `contentRestrictions.readOnly` and `ownerRestricted`; restrictions
can block edits by scripts/add-ons, but remain removable by the owner. They do not
make a file immutable and do not freeze external-formula results. Setting a
restriction overwrites the previous restriction. See [Drive content restrictions](https://developers.google.com/workspace/drive/api/guides/content-restrictions).

Only prepare an **explicitly authorized rehearsal on a new copy**, after verifying
that it is a Google Sheet, `ownedByMe`, has the required owner restriction
capabilities and no existing restriction. First require successful edit canaries
from the owner and the service-account writer through the same principals and
paths used in the locked checks. Restore their canary cells to the baseline and
capture version, full restriction prior state and content digest. A service
account lacking write access to the new copy cannot prove a content-lock denial.

Use `readOnly:true`, `ownerRestricted:true` and a unique operation reason. Capture
the full restriction post-image, including returned restriction actor/time, and
verify the owner's effective unlock capability. Require both edit canaries to be
denied without removing the lock, the data to remain intact, and a service-account
unlock attempt to be denied. Restore only when the full current restriction
matches this operation's own captured post-image and the content digest still
matches; otherwise stop. Never send blanket `readOnly:false` against an unknown
prior restriction. After removing only this operation's lock, verify both edit
paths work again, restore the canary cells and compare the final content digest.

A global content lock also blocks the candidate backend: there is no runtime
write exception. Passing the copy rehearsal would still leave the owner's unlock
authority and a held, gap-free handoff to an exclusive governed writer unproved.
Do not buy Workspace, transfer ownership or move the real file automatically.
If this candidate cannot meet HU-085's held fence contract, present the separate
transfer/move decision and rehearse it without replacing the original file/link.
Drive's [roles](https://developers.google.com/workspace/drive/api/guides/ref-roles)
and [ownership transfer rules](https://developers.google.com/workspace/drive/api/guides/transfer-file)
must be checked against the actual account capabilities.

Closing a browser or an owner saying “no pending offline edits” is useful evidence,
not a technical owner fence. Apps Script installable triggers run under their
creator's authority and are not all visible from another account; a negative
single-account list cannot establish their absence. See [installable triggers](https://developers.google.com/apps-script/guides/triggers/installable).

## Next finite group and the human dependency

1. Retain the accepted 12-case local Rules result and renew exact observations
   before any later application. Keep live controls unchanged and `canApply:false`
   during preparation.
2. Use the audited **exact deployed source and revision** to design and rehearse
   a develop-only compatibility bridge, preserving the production path. Copying
   the current branch's broader implementation is not evidence of equivalence.
   The bridge must address accepted/in-flight effects and held drain, not just
   check a flag once at handler entry.
3. The maintainer confirms no other known Apps Script, add-on, scheduled task
   or external writer beyond the app and actions performed here. Record this
   as an operator declaration, not a technical all-writer exclusion. Conditionally
   prepare the new-copy owner-lock rehearsal once capabilities and authorization
   are available.

No further manual action is needed for this preparation. Any later copy
rehearsal or real control application must be presented
with exact scope and restoration conditions for separate authorization. No new
generic multi-service controller is needed for this preparation.

The existing [trusted barrier adapter](../../functions/src/shift-planning-trusted-intake-barrier-adapter.ts)
requires durable closure on success **and failure**, with initial/final read-back
and causal-drain evidence. A list of proposed controls cannot satisfy it. Do not
wire this document or emulator result into `closeAndCollect`, reopen the inspector's
OIDC grant, or report an admitted migration until those real contracts are proven.

## Effective develop workbook writers and automatic authority — 2026-10-29

The preceding effects reconciliation is delivered as
`713c09020b46d0317399a1dd3fb0d60f8e952286`, verified against the remote branch.
This new inspection is read-only. It does not reuse the earlier inspector's unknown
ACL counts as an empty permission set: the connected owner-side Drive metadata now
returns permission entries and canShare=true for the exact develop workbook.

| Observed principal class | Workbook role | Relevant current capability |
| --- | --- | --- |
| Named human owner | owner | Retained manual/owner capability under ADR-0021; no current window agreement. |
| Default Compute service account | writer | Executes23 of24 Functions, including shared production paths; project Editor plus Eventarc receiver/Run invoker. |
| Firebase Admin SDK service account | writer | Executes none of the24 Functions; retains SDK-admin/data, Auth, Storage and project Token Creator roles. Absence from runtime selection does not mean unused. |
| Dedicated shift inspector | reader | No workbook write grant observed. |

The workbook is directly under My Drive; the parent shows only its owner. The
returned file permission list contains exactly one owner, two writers and one
reader, with no group/domain/public entry. The connector omits permission IDs and
detailed inheritance fields, so obtain exact restorable permission records before
mutation. No production workbook permission was read or changed.

### Automatic identities and workload scope

- All24 immutable Function source bindings and runtime identities/revisions still
  match the accepted post-reminder deployment. The24 Cloud Run services in
  europe-west1 match those Functions; no additional service or Run Job is observed
  there. All three Scheduler jobs remain PAUSED.
- Cloud Build trigger lists are empty in global/europe-west1; App Engine's service
  list is empty. Compute instance enumeration returns403 SERVICE_DISABLED, not
  an empty instance list. Its API was not enabled.
- USER_MANAGED key metadata is empty for the two workbook writers, the prepared
  shift runtime and default App Engine account. No key material was fetched, token
  minted for those accounts, identity impersonated or grant changed. Existing
  configured OAuth session refresh is not a new service-account credential grant.
- Correct POST getIamPolicy reads show no direct bindings on those four accounts.
  Initial GET404s were protocol errors, not evidence of missing permissions. Project
  bindings still grant impersonation/deployment/data capabilities to humans and
  managed service agents. In particular the SDK account has project Token Creator;
  zero user-created keys cannot establish zero automatic authority.
- Two named human project Owners are identified privately for the later ADR-0022
  window agreement. No group binding or organization/folder parent is returned in
  this project snapshot. Do not generalize this into an issued-token inventory.

The original Sheets adapter uses GoogleAuth/ADC. The running shared identity and
its develop-file writer grant therefore matter independently of Firestore Rules.
No broader claim is made about other-region Run workloads, external clients, already
issued tokens or owner OAuth delegations. Prior operations remain a separate gate.

### Concrete reversible permission plan (prepared, not applied)

On the **exact develop file only**, change the two identified service-account
permissions from writer to reader; retain the owner and inspector grants, parent,
all production-file permissions and all project IAM/account state. This avoids
revoking an identity shared with production. It also restricts direct file writes
under either identity regardless of which caller obtains that identity's token;
it does not revoke Firestore authority or prove old external-call completion.

Before applying, obtain a fresh exact ACL with permission IDs, save original records,
reject extra/inherited writer drift and bind the authorized scope/recovery. Verify
both reader roles and all untouched entries afterwards; restore exactly the two
captured writer roles when the approved recovery requires it. Do not grant a new
backend writer as part of this two-permission action. A successful role change alone
cannot admit maintenance or migration, nor replace fresh owner/admin agreements,
source-policy checks and old-work evidence. No changes were authorized in this audit.

Private evidence: `2026-10-29-writer-authority` contains owner-side file/parent reads,
project/account roles and key metadata, bounded workload inventories, source binding
comparison and `develop-sheet-permission-plan-private.json` with the exact principals.
Public documentation intentionally omits raw ACL IDs, workbook IDs and human emails.
No application source changed: documentation diff/parity checks suffice; no native
build or emulator rerun is needed. New documentation is local after the delivered
commit. Preserve legacyUntracked and maintenance/migration NOT_READY.

A changed ACL readback alone is not proof that write-fence propagation is complete;
its effective enforcement must be verified before it can support admission.
