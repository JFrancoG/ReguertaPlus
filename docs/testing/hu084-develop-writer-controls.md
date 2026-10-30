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
  list is empty. Compute instance enumeration returns 403 SERVICE_DISABLED, not
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

### Exact permission records acquired; role changes still prepared — 2026-10-29

The authority review above is committed/pushed as `048497d2`; this follow-up is local.
After explicit authorization, an Online OAuth Playground session requested only
`drive.metadata.readonly`. Two Google Drive `permissions.list` GETs returned200 for
the exact develop file and its parent, with no nextPageToken. The private evidence
retains the displayed JSON semantically, not as a byte-identical HTTP archive.

Both target service-account permissions are user/writer, not deleted or pending
ownership, with a direct file grant (`inherited:false`) and captured permission IDs.
The inspector is a direct reader. The named owner has direct ownership **and an
inherited writer detail**; the parent has only that same owner. Preserve both owner
details: they are not an additional non-owner writer. No expirationTime is returned.

The private plan now binds exactly two role-only PATCH requests and their original
writer recovery roles to the observed file/permission IDs. Apply sequentially, with a
fresh full ACL comparison before each change and full readback afterwards: Google
does not support concurrent permission modifications on one file. If a result is
unknown or only one change succeeds, inspect and retain the partial state; never
blindly retry or restore. Recovery requires an authorized condition and unchanged
non-target records. See [Drive permissions.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/update).

`authorized:false` and `canApply:false` remain. The read-only OAuth grant cannot apply
these changes; later execution needs separately approved write access or the owner's
Sharing UI. No workbook permission/content, project IAM, production resource or
maintenance state changed. New software tests/builds are unnecessary for this
documentation-only preparation; verify the manifest and bilingual diff instead.

Cleanup verified: no refresh token was issued; the temporary Playground connection
was removed, and the same session token returned401 UNAUTHENTICATED/invalid_token on
the same parent GET. Code/token fields were cleared and Playground reset. The exact
two-target manifest and documentation diff checks pass. No user action is required
until separately authorizing the actual role changes and their recovery.

### Develop reader fence applied and exercised — 2026-10-29

Exact-permission preparation is delivered in `25ed6f63`. The maintainer separately
authorized the two develop-only role changes and conditional recovery, then the
bounded identity probe. The owner changed Compute first and Firebase Admin SDK
second through Sharing. Fresh complete API ACLs matched the saved records before
the first change and the expected one-reader/one-writer intermediate state before
the second. No permission was recreated; owner, inspector and parent were preserved.

Both identities passed a positive Sheets control while still writers: the same
`spreadsheets.batchUpdate` resubmitted the existing literal **Fecha** to A1 of the
current delivery sheet, with only `userEnteredValue` in its field mask. After the
demotions, both original still-valid tokens retained file GET200, reported
`canEdit:false` and received403 PERMISSION_DENIED for that identical valid batch.
These are authenticated write denials, not expired credentials or malformed probes.
Six named A1:Z200 ranges, containing742 populated values, match before/after, including
the published dates/order. The accepted same-value writes and ACL updates advance
Drive metadata; do not claim an unchanged modifiedTime/version or whole-file history.

Owner-side final metadata confirms one owner and three readers on the same file;
the parent retains only its owner. Full raw ACL enumeration is denied after demotion under the service reader;
final owner readback supplies the normalized four entries, not fresh raw inheritance
fields. The earlier complete ACLs and targeted UI actions retain the identity trail.
No recovery was required; leave both service accounts as readers. Recovery remains
limited to these two captured writer roles after a fresh drift check.

The separately authorized IAM workflow used account-scoped conditional
`roles/iam.workloadIdentityUser` grants, all bounded by the original ten-minute
deadline. IAM propagation caused denied mint attempts and one incomplete two-account
attempt; every attempt removed its exact grants. Three five-minute Drive-only tokens
were issued in total (two Compute, one SDK); the earlier token was discarded in
memory, without storing credentials. The successful pair's grants were removed
before the Sheet role changes, preserving unrelated bindings. Subsequent
`testIamPermissions` contains no getAccessToken permission for either account. No
key, project-level grant, production read/write, Function change or FCM send occurred.

Private evidence: `2026-10-29-develop-reader-fence` retains exact ACL/role manifests,
742-value snapshots, positive/negative provider results, conditional-grant cleanup,
credential-free token metadata and source hashes. Source/apps are unchanged;
operational provider checks and documentation checks replace unrelated builds.
This verifies new writes under these two identities, not termination of an already
submitted external call, every owner/OAuth writer, or maintenance admission. Keep
old-work/source/window gates and maintenance/migration NOT_READY.

Final credential cleanup: both successful tokens expired and the same file GET
returned401 UNAUTHENTICATED for each. They were discarded and the local probe
process closed; earlier token metadata has an earlier expiry. The two original
empty account policies are restored. Operational evidence and bilingual diff checks
pass; this follow-up remains local after `25ed6f63`.


### Fence joined to maintenance preparation — 2026-10-29

The effective two-account fence is committed/pushed as `e6d02cc2`. The new local
`functions/scripts/prepare-develop-fenced-maintenance.cjs` joins the reviewed
positive/negative probes and credential cleanup to owner file/parent roles and two
validated Firestore censuses. It has no SDK, network, mutation or admission port.
It rejects missing/invalid probes, expired credentials presented as permission
denials, changed values, restored writers, inherited writers and observations out
of order. Source drift invalidates reuse of the previous census. A matching census
preserves unknown pending/in-flight work, `legacyUntracked:true` and no replay.
The output is preparation only: `NOT_READY`, `startAt:null`, no writer controls or
causal-drain declaration. It is not accepted as runtime barrier evidence.

Read-only refresh after the fence: all24 deployed Function configurations match the
reviewed post-reminder baseline; three jobs remain PAUSED. The census has the same
183 sources (62 shifts,4 calendars,117 notices),12 captures and16 deliveries. The
five bootstrap authority paths remain absent. All742 typed values in the six
inspected ranges match the preceding reconciliation; no dates/order were changed.
Owner-side normalized ACLs still show the two service accounts as readers, the
inspector as reader and the same owner; the parent shows only its owner.

**Metadata limitation:** two connector reads return modifiedTime
`2026-10-29T17:47:48.221Z`, older than the direct probe's
`2026-10-29T17:48:31.491Z`, and omit the requested raw version. The preparation
flags this discrepancy; neither a fresh call timestamp nor matching cell values
renews the workbook-version/probe evidence. Do not manufacture a current version
or request another impersonation grant merely to fill this field.

Before proposing a start time:

1. Resolve completion or effective isolation of earlier external calls, separately
   from the117 retained notices (including105 older notices with unavailable logs).
   Do not replay them or repeat searches beyond log retention.
2. Complete automatic-writer authority, including owner OAuth/delegation and other
   server access; the two-account ACL fence does not close the whole writer group.
3. Obtain consistent current workbook version/content and refresh the full control,
   source and causal evidence. Keep the two readers; do not restore writes on abort.
4. Bind owner and both Firebase administrator agreements to that exact evidence and
   only then propose the bounded window, entry checks and conditional recovery.

The private `2026-10-29-fence-window-integration` packet keeps original receipts,
observation times, source hashes, comparisons and explicit outstanding gates.
`npm run test:shift-planning:fenced-maintenance` passes114 tests (19 new cases);
Functions build/lint pass. The new CJS is checked by Node and exercised directly;
the repository ESLint command covers JS/TS, not CJS. No deploy, IAM grant, business
write, Sheets write, FCM or production-data access in this integration step.
Native apps and their previous acceptance are unchanged. New code/docs are local
and uncommitted after `e6d02cc2`; maintenance and migration remain closed.


### Old runtime isolation and remaining owner OAuth — 2026-10-29

The preceding preparation is delivered/pushed as `9f01bae8`. New read-only provider
inspection enumerates all revisions of the24 reviewed Cloud Run services. All288
non-current revisions report `Active/CONDITION_FAILED/RETIRED`; each service routes
100% to its reviewed current revision with no tags. Service generations, traffic
and latest-created/latest-ready bindings are identical before and after each bounded
revision enumeration. No revision or service was deleted, stopped or deployed.

The existing preparation now accepts this separate observation through
`inspectDevelopRetiredRuntimes`. It rejects missing/duplicate services or revisions,
unreviewed destinations, tagged routes, rollout drift, unobserved generations,
reconciling revisions and generic failures/timeouts substituted for retirement.
The real provider packet passes. This closes execution in those retired containers;
it does not prove the outcome of requests already submitted to Sheets/FCM, revoke
issued credentials, or close other automatic writers. Work counts remain unknown,
legacyUntracked stays true, and the preparation cannot admit maintenance.
Google documents RETIRED as retirement of the infrastructure for that revision:
[Cloud Run revision lifecycle](https://docs.cloud.google.com/run/docs/managing/revisions).
A Sheets timeout after180 seconds is not an acknowledged successful/rolled-back
operation and is not used as a drain receipt:
[Sheets limits](https://developers.google.com/workspace/sheets/api/limits).

Owner-side Google Account UI reveals two relevant Drive connections: OpenAI has
write access to all Sheets, and Google AI Studio shows Drive read/modify/create/delete.
The OpenAI permission detail explicitly includes all Sheets. No OAuth Playground
connection remains in the visible full connection list. These are observed grants, not evidence that the
apps are currently writing or that the UI inventories every issued token. Removing
all OpenAI access there would also affect Gmail/Calendar and other unrelated use.
No global access was revoked. The previously supplied test account is signed in and
its Google Account connections page says there are no linked applications.

#### Prepared file-only isolation, pending explicit authorization

Recommended: transfer only the existing develop workbook to the test account;
then make the original owner a reader. Preserve the same file ID/URL, data, dates,
order, three service readers and restricted general sharing. Ensure the old owner's
parent cannot retain inherited write access, moving this file only into the new
owner's My Drive if necessary. This makes the old owner's OAuth clients subject
to that reader permission without disconnecting them from unrelated files/services.
The human-owner maintenance agreement remains necessary under ADR-0021.

Consumer transfers require the recipient's acceptance; the previous owner initially
becomes an editor and must explicitly be changed to reader. Transfer alone is not
isolation. See [Google ownership transfer](https://developers.google.com/workspace/drive/api/guides/transfer-file).
The private plan identifies both accounts, exact file and prior roles. It covers
Google's invitation/acceptance notifications; a positive same-value Fecha/A1 probe
through the existing owner connector before transfer; the identical negative probe
and retained reads afterward; and six-range value comparison. No new OAuth/IAM
permission is planned. Stop on drift or incomplete acceptance; do not automatically
restore writer roles. Cancellation before acceptance differs from recovery after
acceptance, which requires a reverse transfer and acceptance by the original owner.

Do not change the current preparation's hardcoded owner/parent or label the new
identity accepted before authorization and verified transfer. Bind new observed
owner/parent evidence afterward. This operation still does not open maintenance,
apply migration, write production, or settle earlier external effects. The remaining
server/delegation authority and historical effects retain their independent gates.

Private evidence: `2026-10-29-old-call-access-closure` includes bracketed revisions,
validated isolation result and the proposed ownership/recovery manifest. Functions
build/lint and129 focused tests pass (15 added runtime-isolation cases). No native
change or parity gap. New source/docs are local after `9f01bae8`.


### Authorized owner transfer and connector fence — 2026-10-29

The user authorized the exact file-only plan above. Google delivered the transfer
invitation, the signed-in test account accepted it, and the former owner was then
changed from editor to reader. The sharing dialog now shows the test account as
owner, the former owner and all three service accounts as readers, and restricted
general access. The original file ID/link is unchanged. No other file, global OAuth
connection, IAM grant, deployment or production data was changed.

The existing connector successfully sent the same literal `Fecha` to A1 before the
transfer. The identical batchUpdate after demotion returns HTTP 403 PERMISSION_DENIED;
reading all six bounded ranges still succeeds. All742 typed values, dates and order
are identical before/after. No parent move was needed for this effective denial.
As a reader, the connector no longer exposes file permissions or parent IDs: null
fields are **unavailable metadata**, not proof of an empty parent ACL. New-owner
parent authority/version evidence remains required for maintenance admission.

`inspectDevelopOwnerTransfer` binds the observed sharing UI, exact positive/negative
requests and six-range comparison separately from historical owner/parent API
readbacks. The preparation preserves both without renewing old censuses or runtime
observations. It cannot admit maintenance, replay notices, count unknown work as
zero or settle previously submitted effects. The actual packet passes with 742
values; 141 focused tests (12 added transfer cases), Functions build/lint and diff
checks pass. No native changes or parity gap. New source/docs remain uncommitted
after `9f01bae8`; this approval did not request another commit.

Evidence: private `2026-10-29-develop-owner-transfer`, including screenshot/AX roles,
original connector receipts, exact values and the combined NOT_READY preparation.
Recovery after acceptance requires reverse transfer and the former owner's acceptance;
it was not performed. Next finish remaining server/delegation authority and prior
external-effect reconciliation, then obtain coherent current workbook/control and
new-owner/admin window evidence. HU-084/HU-085 remain open and PR #278 remains draft.


### Remaining configured access and prior effects — 2026-10-29

The runtime/owner isolation is committed and pushed as `b69dcf5b` (remote verified).
This subsequent inspection is read-only; this checkpoint records its documentation.

| Area | New observation | Boundary |
| --- | --- | --- |
| Functions and Run | All 24 Functions match the reviewed metadata/source bindings; the global Run inventory contains exactly their 24 services, zero jobs, worker pools or independent instances, with no unreachable regions/continuation. Current traffic remains 100% on reviewed revisions, no tags. | Global v1 endpoints used by installed gcloud resolve the regional me-central2 denials; the denials themselves are not empty inventories. |
| Scheduled/CI work | Three jobs remain PAUSED across 34 Scheduler locations. No triggers or active/pending builds in global plus 43 documented Build regions. No App Engine services or Extensions instances. This GitHub repo has zero workflows, running Actions or repository Actions-secret names. | Does not inventory automation outside this project/repository or secret values. |
| Credentials | All 9 project service accounts have zero USER_MANAGED keys and zero direct IAM bindings; three test identities remain disabled. Zero workload identity pools. Project bindings and Rules are unchanged. | Shared Editor/Admin/Token Creator roles still exist. Neither missing keys nor empty direct policies proves absent issued tokens or automation using human credentials. |
| Source census | Same 62 shifts, four calendars and 117 notices, 12 captures/16 delivery records; all source versions and retained history are identical to the prior census. | Stable content is not a complete old-call ledger or a held maintenance barrier. |
| Known effects | Two exact calendar probes correlate to their reviewed old revision and individual HTTP 200 terminals; updatedCount 0 means the source skips both Sheets writes and notice creation. Prior three imports and 12 FCM attempts retain their earlier evidence. | Covers only these identified invocations; FCM acceptance is not a device receipt. |

The new develop-filtered log query covers only the delta from 16:55:14 through 20:05:12
UTC. All pages finish with no new matching effects. Do not extend that negative result
to unlogged work or reread the expired history. The 105 older notices remain possibly
delivered and unreplayed, not 105 pending sends. Old submitted effects without causal
terminal evidence remain a residual; the investigation cannot manufacture them into
zero in-flight work. `legacyUntracked=true` and NOT_READY remain explicit.

Cloud Asset was SERVICE_DISABLED and was not enabled. Invalid initial regional
field masks, an unsupported Build-locations route and the SDK policy GET were
retained as errors, then replaced with supported reads. Build locations come from
[Google's published catalogue](https://docs.cloud.google.com/build/docs/locations);
Run's global methods match the installed CLI's
[all-regions list contract](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/list).
No new privilege, token impersonation, production data read, deployment or business
write occurred. Existing login-session refresh is not a new service-account grant.

#### Remaining prerequisites

1. The maintainer identifies existing apps/Functions writing `collections` in
   develop/production. Local classic iOS configuration confirms the same
   `reguerta-9f27f` project, ordinary `collections` root and shared HTTP endpoints.
   Reviewed deployed Rules deny develop client writes in **both** namespaces;
   production branches retain their prior permissions. Different names alone do not
   prove isolation: the old calendar callback reads `collections/config` before
   `plus-collections/config`, and the classic checkout contains explicit copy tools
   targeting plus-collections. Local presence does not prove published release
   inclusion or execution; their develop client writes are covered by current Rules.
   This answer identifies known callers, not universal absence of other credentialed
   programs. It neither requires stopping the classic production app nor authorizes
   reopening develop/collections. Private evidence:
   `classic-namespace-clarification-private.json`.
2. Keep the historical external-effect residual explicit. Under ADR-0025, missing
   terminal evidence still needs effective destination isolation or the existing
   scoped residual/incident exit; an incident alone is not successful admission.
   Do not keep querying expired logs, replay notices or weaken the contract silently.
3. Only after those issues are resolved, bind current new-owner parent/version
   evidence, refreshed controls and named owner/admin window agreements. No window
   is requested or opened by this audit.

Private packet: `2026-10-29-remaining-authority-effects`; `assess.py` checks real
provider/source comparisons and preserves failed reads. Its assertions pass. The
pushed implementation reuses the unchanged 141-test/build/lint validation; no new
application test run is claimed. New changes are documentation only: diff/link/parity
checks, no native build or parity gap. HU-084/HU-085 remain open; PR #278 remains draft.


### Historical-effect disposition and decision — 2026-10-29

The preceding access/namespace audit is delivered in `d3ae12d9` (remote verified).
The next step reconciles retained evidence offline, without renewing any live
control, querying expired logs, invoking a Function or changing provider state.

| Notice evidence | Count | Disposition |
| --- | ---: | --- |
| Stored `no_tokens` | 55 | Preserve the summary; it does not prove absence of other attempts. |
| Stored `partial_success` | 34 | Preserve; rejected tokens do not justify replaying possibly accepted ones. |
| Stored `success` | 25 | Preserve; this is not a per-device delivery receipt. |
| No dispatch result | 3 | April 1 admin broadcasts, unchanged since creation; unknown, not newly identified active work. |

All 117 documents have exact private source/version hashes. Twelve of the 59 send
summaries match retained application/request terminal records: six accepted and six
rejected tokens. The 105 without that correlation comprise 55 no-token, 28 partial,
19 successful summaries and three missing results. None is replayed. The three
62-row imports and two no-effect calendar probes keep their separate terminal proof.
No closed-universe claim follows from these 17 known invocation terminals.

The finite evidence reconciliation is complete; complete historical termination is
not established. The current contract therefore still rejects maintenance. Proposed
[ADR-0026](../decisions/0026-accept-bounded-develop-historical-effect-risk.md) makes
that decision explicit: accept a scoped historical risk only for initial develop
migration, preserving unknowns/current controls, or keep strict admission blocked.
The proposal is not accepted or implemented. This is a policy decision, not another
log search; a real window remains separately authorized after implementation/tests
and remaining authority gates.

Private `2026-10-29-historical-effect-disposition/reconcile.py` independently checks
all 117 exact source rows, stored-result consistency and the 12 retained terminal
correlations. It outputs a private per-document disposition and source hashes with
`legacyUntracked=true`, `canEnterMaintenance=false`, `canApply=false`. Assertions,
bilingual links and diff checks pass. New changes are documentation only, local
and uncommitted; no application build/test rerun or native parity change.


### ADR-0026 accepted and rehearsed locally — 2026-10-30

The maintainer accepts bounded historical risk only in develop. Local implementation
and rehearsal are complete: 137 local + 26 emulator passes, build/lint/CJS syntax
and diff checks pass. See the [implementation checkpoint](../decisions/0026-accept-bounded-develop-historical-effect-risk.md#local-implementation-checkpoint--2026-10-30)
for exact bindings, preserved unknowns, rejection/recovery and limits. No historical
notice replay, shared mutation or maintenance admission occurred. Live preparation
stays NOT_READY; fresh authority/operation acceptance and a separately authorized
window remain required. Changes are local after `d3ae12d9`, no native parity gap.


### Real maintenance evidence prepared — 2026-10-30

ADR-0026 implementation delivered in `0539ee40` and verified on the remote and
open draft PR #278. The seven implementation/test hashes still match the validated
137 local + 26 emulator tests, build and lint; those results are reused unchanged.

Fresh read-only observations are retained privately in
`2026-10-30-maintenance-evidence` with an offline assertion report:

- All 24 Functions match the reviewed source/configuration; Rules and project IAM
  are unchanged; all three Scheduler jobs remain paused. A renewed bracketed Run
  read confirms 288 retired revisions across those 24 services. This does not prove
  termination of previously submitted external effects.
- The atomic Firestore snapshot at `2026-10-30T06:48:26.324Z` retains exactly 62 shifts,
  four calendars, 117 notices, zero planning requests and unchanged 12 captures/16
  deliveries. The relevant four-field projection of all 48 users and config/global
  matches the prior snapshot. Reserves, credits, membership state and the inspected
  case/effect/sync/swap collections are empty; all five planner authority documents
  remain absent, not an existing epoch-zero authority.
- All 742 typed content cells/notes across six bounded workbook ranges are unchanged,
  including dates and order. The refreshed owner-session sharing UI shows the test
  owner, four readers and restricted sharing. No write probe was repeated.
- All six deployed composite indexes remain READY, including the exact planning
  request index; inherited shifts/date indexing remains available.

The reader connector omitted numeric Drive version, parent and permission records.
The maintainer subsequently authorized one Online-only `drive.metadata.readonly`
Google OAuth Playground session with the test owner. The exact workbook API read
before/after agrees on **version 278**, the owner, and the test owner's My Drive root
`0AK7v8_RQogQlUk9PVA`. Complete permission lists contain the owner plus four direct
readers on the workbook, and only the owner on that root; no other effective editor
is present in these observations. Its inherited writer entry belongs to the same
owner. The old owner's root is historical evidence, not the current parent.

Only the named file and its returned parent were queried. Authorization was removed
immediately afterwards: Connections shows no linked applications and the same GET
returns HTTP 401. No refresh token was issued; no token is retained in the evidence
files. Cloud metadata reads used the existing Firebase CLI session; no IAM change.
The metadata and cell observations were separate reads, not one held barrier.

The final packet is **NOT_READY**, with no operation acceptance or window times,
`canEnterMaintenance=false` and `canApply=false`. Exact API authority is now observed;
it must still be refreshed and bound at admission rather than reused as a permanent
permission guarantee. Private assertions compare file/parent records and check
revocation; evidence hashes retain their provenance.

Next bind the real source policy and forward/
inverse plans; refresh remaining automatic-authority/queue controls at admission,
then obtain named owner/admin agreements and operation-specific risk acceptance for
an explicitly authorized window. Prior global authority and effective write-denial
proofs remain labelled historical. These observations are not a held maintenance
barrier or a complete bootstrap snapshot. No shared mutation, FCM, production-data
access or native change. Assertion/syntax/diff checks pass; new work is documentary
and private evidence only, uncommitted after `0539ee40`.
