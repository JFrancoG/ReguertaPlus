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


### Technical controls refreshed; Sheets writer not yet admitted — 2026-10-30

The complete-config correction is delivered/pushed as `27920b02`, with the accepted
113 unit/50 emulator gates reused after verifying all seven implementation/test
hashes. This new step changes documentation and private read-only evidence only.
Private packet: `2026-10-30-technical-sheets-review`; offline assertions pass.

Fresh observations confirm unchanged metadata/configuration for all 24 Functions,
unchanged Rules release/source and project IAM, three paused jobs, and six READY
indexes identical to the previous authority. Bracketed Run observations confirm
288 retired revisions across 24 services. The four capture pairs are reverified
against exact immutable deployed source archives and all eight trigger/topic/
subscription bindings. All five sampled metric groups return UNKNOWN; none is
interpreted as zero or completed causal drain. ADR-0025/0026 limits still apply.

There are nine service accounts, zero USER_MANAGED keys/direct account IAM bindings,
zero workload identity pools, 24 global Run services and no Run jobs/worker pools/
instances in the complete bounded listings. The general Cloud Asset endpoint remains
disabled (403); it was not enabled. Other regional services, external automation and
GitHub authority are retained evidence, not a newly complete global inventory. Empty
keys/policies do not prove absence of previously issued tokens or human automation.

The develop workbook ID, six tab IDs/titles and configured legacy-import/export/
private-inspection destinations agree. All 742 observed typed cells/notes in the six
bounded ranges match. The owner's sharing UI shows testplusprojects as owner, the
same four readers and restricted sharing. The connector cannot expose numeric Drive
version, parent or complete permissions under its reader account. The explicitly
authorized Online-only `drive.metadata.readonly` session now confirms version 278
with identical before/after metadata, five complete file permissions and the returned
My Drive root owned solely by testplusprojects. Four direct readers remain; the only
inherited writer detail belongs to that same owner, with no additional editor, group,
domain or public grant. No content restriction is present. A stalled first session
was revoked before a clean-tab retry. The completed session was also revoked: no
linked apps remain and the same GET returns 401. No refresh token was issued; the
Playground fields were cleared and its tab closed. Private evidence retains no tokens.

**Writer finding:** neither `executeShiftPlanningSheetsSync` nor `executeShiftSheetsImport`
is deployed. Compute and Firebase Admin SDK remain readers in the observed sharing UI;
the inspector remains a reader. `reguerta-shifts-runtime` is enabled, has no keys/direct
bindings and is assigned to none of the 24 Functions, but carries project-level
Datastore User, Firebase Auth Viewer, Firebase Cloud Messaging Admin, Eventarc Receiver
and Run Invoker roles. It is not established as a Sheets-only or develop-only principal,
and has no listed file grant. No effective controlled automatic writer is verified.
No service account was enabled/disabled, impersonated, granted access or write-probed.

The observation packet references the exact reviewed migration package
`a2c6923715243faaace634f408520c155c0f9d392bc2719e1cf30a0767bdbf31`;
it does not replace held controls or silently regenerate operation identities.
Owner API metadata verification and revocation are complete. Next prepare a narrowly
scoped Sheets writer identity and explicit grant/probe plan for separate approval.
Keep the existing general backend roles untouched. Real writer capabilities,
current external-control composition and owner/admin/risk window remain unadmitted.
No maintenance entry, shared business/Sheet write, FCM or production-data access.
No native change/parity gap; HU-084/HU-085 open, PR #278 draft.

### Proposed develop Sheets identity and permission test — 2026-10-30

The preceding provider review is delivered as `2a0836b0`. This proposal implements
no new policy exception under ADR-0021/0022/0025/0026. Its reviewable, **non-executable**
[plan](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/develop-sheets-writer-plan.json)
contains proposed names and limits, not live IDs, credentials or an authorization.
`canProvision`, `canApply` and `canEnterMaintenance` remain false.

Use a fresh `reguerta-develop-sheets-writer` service account in `reguerta-9f27f`.
Do not repurpose `reguerta-shifts-runtime`, Compute, Firebase Admin SDK, the inspector
or disabled rehearsal identities. The candidate was absent from the retained nine-account
inventory; repeat the exact lookup before creation and stop on a name collision.
Record the returned immutable unique ID and Drive `about.user.permissionId`; never
infer either from its email. No project roles, user-managed keys, domain delegation,
attached Function/Run service or standing impersonation grant are proposed.

| Boundary | Proposed permission | Evidence needed before use |
| --- | --- | --- |
| File | Direct editor on one new synthetic rehearsal workbook only | Owner, parent and complete ACL before/after; returned permission ID |
| Token issuance | `user:drpuerk@gmail.com`, `roles/iam.workloadIdentityUser` on this account only, explicit UTC condition at most ten minutes | Full policy version/etag; preserve unrelated bindings; stop on drift |
| Child Google token | One 300-second access token, `spreadsheets` and `drive.metadata.readonly`, no delegation/refresh | Actual expiry, exact scopes, in-memory IPC; no token in arguments/logs/files |
| Cloud data | No project role and no shared Firestore/FCM access | Fresh project bindings/keys/account policy and no attached service |
| Original develop | No permission in the first experiment | Excluded destination in the runner, not a remote negative probe |
| Production | No grant, read, write or probe | Protected ID handled locally only; no network request to it |

These two OAuth scopes match the existing composition and copy contract. They are
not a file-ID restriction: the file ACL and exact-destination SDK wrapper provide
that boundary. The IAM role also permits ID-token issuance, and the grant does not
technically restrict requested scopes, token count or requested lifetime to the
values above. Those limits belong to the sealed controller and named operator;
review that residual power in the eventual authorization. Do not add Token Creator,
Service Account User, signing, project-data roles or a custom role to make a failed
probe pass. The parent retains its existing credential; the child receives only the
short token. IAM removal does not by itself prove issued tokens or in-flight writes
have stopped.

**Existing observer constraint:** `observeShiftSheetsWorkbook` reads complete ACLs
only when this observer's `canShare` is true. The guard additionally requires
`canEdit`, `canModifyContent`, exact principal/authority digest, complete restrictions
and only the named owner/runtime as writers. An editor with `canShare=false` therefore
fails this composition; do not silently widen scopes or bypass the ACL check.
The proposed token cannot mutate Drive permissions, although the file role itself
may permit sharing with other credentials. A successful metadata read as owner is
not a successful read as this new writer. Test this explicitly on the copy.

**One coherent copy experiment, after separate authorization:** the owner creates a
new native workbook with the seven synthetic BASE tabs described in the plan, no
real member data and no inherited third-party writers. The existing runner requires
exactly seven initial tabs. Neither the six-tab original nor the prior completed
eight-tab copy qualifies; do not delete their tabs or relax the guard. Bind the
returned workbook/tab IDs and raw before-images, then obtain a fresh online/closed/
no-offline-edits/no-other-automation owner confirmation and the controller agreement
not to mint extra tokens during the bounded session.

Create the new identity and grant only its copy permission and exact conditional IAM
binding. Start the existing runner in a fresh `demo-reguerta-copy-writer-v1` emulator
at `127.0.0.1:8897`; pin parent/child sources and provider-read adapters before minting.
The parent must read real identity/key/policy observations, not supply asserted zeros.
Mint once after the runner starts, with expiry within the remaining grant/window.
Keep the observed grant policy stable for the existing authority digest; remove it
in cleanup. Insufficient time aborts instead of extending the grant or auto-minting.
Preparation/readback must bind the actual Google principal, capabilities, complete
ACL, exact batch and all seven original raw tabs before the single allowed SDK batch.

| Test | Acceptance | Where |
| --- | --- | --- |
| Wrong workbook/environment, missing owner, broad action or another principal | Rejected before provider submission | Existing local contract/runner tests |
| No ADC fallback, short expiry, no refresh on 401/403 | No ambient credential or automatic retry | Existing local runner tests |
| Editor identity/ACL visibility | Exact email + permission ID, complete ACL and required capabilities | Authorized synthetic workbook |
| Successful guarded projection | One new market tab, ten fictitious turns, one SDK batch; seven original tabs identical | Authorized copy + local demo receipts |
| Lost acknowledgement, drift, expired authority | Retain incident and inspect; never blind retry/inverse | Existing local tests; do not inject faults into real Google writes |
| Permission removal | Same still-valid token loses copy access; 403/404 only accepted after a successful positive read | Authorized copy, immediately after removing its grant |
| Identity cleanup | Exact temporary binding removed, account disabled, zero user keys/data grants; fresh mint denied | Authorized new account only |

Keep the synthetic output for review. Remove only the permission/binding created by
this experiment, using exact IDs and an etag-aware merge after a fresh policy read;
never replace a stale entire policy. Disable the new account, verify actual access
loss, clear credentials and retain receipts. If the write result is uncertain, keep
the workbook and receipt for inspect-only recovery; revocation is not proof of
non-execution. An expired token is not proof of an effective ACL denial. Future
re-enablement needs separate approval, expiry/reconciliation of prior credentials
and a new observation; do not recycle the original receipt or blank the ledger.

**Later original-develop gate:** an exact original-file grant and effective write
probe are separate from this copy test. Renew owner/parent/ACL/version, bind the new
principal and ACL to freshly prepared Sheets manifests, preserve published dates/
order and recheck the source census. Do not transplant the version278 packet or
copy authority. Identity success does not implement the missing shared external-
control reader or admit the owner/admin/risk window. The Sheets account has no
Firestore authority: the existing composition must receive separate explicit Google
and Firestore clients; assigning this account as the sole ADC runtime would fail.
Shared composition/deployment and its control observations remain separate work,
without adding Firestore/FCM roles to this file writer. No deployment is proposed here.

Preparation uses source review and offline checks only. The live experiment still
needs exact resource IDs, timestamps, sealed parent-controller evidence and explicit
approval; it is not yet executable. New proposal remains local after `2a0836b0`.

References checked on 2026-10-30: Google [IAM role permissions](https://docs.cloud.google.com/iam/docs/service-account-permissions),
[access-token request](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken),
[Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes),
[Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[account disablement](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable).

### Concrete synthetic writer session — 2026-10-30

The identity proposal is delivered in `44e578d1` (remote and draft PR #278 head
verified). The following implementation is local, pending the next delivery.
No account, workbook, grant or token was created and no maintenance was opened.

`functions/scripts/prepare-develop-writer-rehearsal.cjs` emits a private offline
preparation with account/workbook/permission/token payloads and an input template.
Its digest binds the proposal, controller, provider and existing runner/source
closure. Generate it **after** building Functions; source changes require review
and regeneration, never editing the old digest to force admission:

```sh
cd functions
npm run build
node scripts/prepare-develop-writer-rehearsal.cjs /absolute/private/new-preparation.json
```

The only CLI action is offline output (`wx`, mode 0600); there is no live CLI and
neither controller loads ADC or cached CLI credentials. The synthetic workbook
payload creates seven 20×6 BASE tabs with the same sentinel cell. It does not copy
members, published turns or production content.

#### Exact execution sequence after separate authorization

1. Authorize the new identity and new synthetic workbook, its copy-only editor
   permission, a maximum ten-minute account-scoped workloadIdentityUser grant,
   one requested 300-second token and cleanup. Do not reuse the old copy/session.
   Create with the prepared payloads under the named owner; retain provider
   creation receipts and the account's immutable unique ID. Creation belongs
   outside `runSession`: check ambiguous create results before any retry.
2. Read the copy's actual parent, sole owner, seven tab properties and complete
   raw baseline with `readRawOriginalTabs` (exported by the existing runner), using
   explicit owner Google clients with refresh disabled. Confirm those are exactly
   the synthetic BASE tabs just created. Store the raw snapshot privately. Fill
   `inputTemplate` from those receipts, including the known production exclusion
   ID **locally**, without making a production request. Set its approval digest
   to the reviewed preparation digest; no placeholder grants admission.
3. Obtain the owner's fresh online/closed/no-offline/no-edits confirmation, the
   exact UTC start/end and the no-additional-mint undertaking. Use a fresh private
   output directory and an empty `demo-reguerta-copy-writer-v1` emulator at
   `127.0.0.1:8897`; never clear an earlier session's ledger to rerun it. Operator
   IAM and owner Drive credentials remain distinct in-memory parent inputs.
4. Compose the exported ports as below. `bind` checks all owned resources and
   approval before effects. The owner port verifies file/parent/owner and the
   exact writer permission. The IAM port targets the **unique account ID** for
   every read/change/mint, uses policy-version 3 and etag CAS, checks no user keys,
   project grants or parent authority, and mints only once. It never modifies
   project IAM. Owner credentials only call this copy's Drive resource.
5. The child receives only its one short token over IPC and an environment
   allowlist. It prepares the actual batch, then waits for the parent to compare
   baseline, owner, writer and 45-request/ten-row budget with current authority.
   Rejection stops before Sheets submission. The existing adapter still proves
   the single new-tab batch, full ACL/capabilities and original-tab preservation.
   The parent terminates a stuck child after four minutes (hard kill five seconds
   later) to retain cleanup time inside the five-minute token lifetime.
6. After child termination, including failure, remove the exact copy permission,
   demonstrate denial with the same token **before it expires**, CAS-remove only
   this session's IAM member/condition, disable the owned identity, and check
   disabled/keyless/no direct grants plus denied mint. Cleanup stages run even
   when another stage fails. A concurrent foreign grant is preserved and reported,
   never erased. A failed removal, expired token or uncertain response cannot pass.

Composition (operator inputs shown as variables, never credential files/argv):

```js
const {prepare, bind, runSession} = require("./scripts/prepare-develop-writer-rehearsal.cjs");
const {createProvider, createOwnerControls, createChildRunner} = require("./scripts/develop-writer-copy-provider.cjs");
const owned = bind(reviewedInput, Date.now());
const owner = createOwnerControls({copy: owned.copy,
  protectedWorkbookIds: owned.protectedWorkbookIds, ownerBearer});
const provider = createProvider({identity: owned.identity, copyFileId: owned.copy.fileId,
  protectedWorkbookIds: owned.protectedWorkbookIds, iamBearer});
const runChild = createChildRunner({outputDirectory: freshChildDirectory,
  expectedRunnerDigest: prepare().runnerSourceDigest});
const result = await runSession({input: owned, provider, runChild,
  verifyOwnerCopy: owner.verify, removeCopyPermission: owner.remove, record: writePrivateTypedReceipt});
```

`writePrivateTypedReceipt` must persist each supplied typed body before resolving,
using fresh names/mode 0600 inside a mode-0700 parent directory. Never log bearer
inputs, raw SDK errors, child stderr/stdout or provider response bodies. The
preparation/approval, creation receipts, original raw snapshot, child output and
terminal cleanup receipt are retained; the copy and local ledger are not deleted.
The parent credential must cover IAM cleanup beyond the child deadline and the
owner credential must still allow removal. If the process crashes, inspect its
retained grant intent and exact resources; containment is not proved by elapsed
IAM TTL. Do not re-enable the account or retry a possible write. Reconcile receipts
and the synthetic copy under a separately authorized read-only inspection first.

This controller constrains its own calls; it cannot technically prohibit an
administrator from minting separately. IAM does not enforce the requested token
scope/count/lifetime. See Google's [token API](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken),
[policy CAS API](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/setIamPolicy)
and [disable contract](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/disable).
Live propagation/capabilities are still to be tested; no local test is a live proof.

Local validation: Functions build/lint, focused CJS diagnostics and 30 tests pass
with no failures/skips (16 new controller/transport/IPC tests, nine actual-runner
contracts including four emulator cases, five owner-contract tests). Google is
replaced by transport doubles; Firestore uses the real SDK against the emulator.
The real runner's rejected review submits zero batches. Native code is unchanged,
so no new Android/iOS gate or parity gap. Next: authorize and provision this exact
synthetic session, then execute it and inspect cleanup. Original develop writer
access, current control composition and maintenance/migration remain separate gates.


### Synthetic writer live attempt and contained failure — 2026-10-30

The prepared controller is delivered in `98840300`. The explicitly authorized new
account and native synthetic workbook were created once. The first owner session
expired before any copy grant, writer-token attempt or child execution; cleanup
left the account disabled and removed OAuth. A separately authorized recovery
reused the same seven-tab workbook after a fresh owner/raw-baseline comparison.

The recovery granted only the synthetic file and the bounded account-level mint
binding. It stopped during parent session opening: the child records zero submitted,
in-flight and unknown batches. No batch-review or token-issued receipt exists.
`mintAttempted:true` is an admission flag, not proof that Google issued a token.
The available IAM audit records show enable/grant/remove/disable; they do not
establish the exact failed operation or HTTP response. Do not infer propagation,
credential issuance, successful writer access or a Sheets capability result.

Cleanup removed the exact file permission and temporary IAM binding, disabled the
same account, verified zero user keys/direct bindings/project grants and denied
another mint. Owner OAuth revocation returned 200, its same-token probe returned
401, and Google's account UI showed no linked apps. The copy-access-denial check
remains **unproven**, because no positive writer read was established. The terminal
result remains `inspection_required`, with `canRetry:false` and no maintenance
admission. The synthetic workbook and separate original receipts are retained.

A local diagnostic correction now records the failing parent phase and a bounded
numeric HTTP status through child IPC; it retains no raw error/body/token and adds
no retries or wider permissions. Build/lint, CJS syntax and **31 tests, zero failures
or skips**, pass, including status propagation/redaction and unchanged containment.
The revised preparation has a new digest; the earlier execution approval cannot
be transplanted. These diagnostic changes/evidence are local after `98840300`.

Private receipts: `2026-10-30-develop-writer-live` and
`2026-10-30-develop-writer-live-retry-1`. Preserve both and the exported demo ledger.
Next: review/deliver this diagnostic correction and prepare a separately authorized
fresh attempt with current owner/identity observations; do not claim copy acceptance.
No original develop/production file request, shared business write, deployment,
FCM, maintenance admission or native change. HU-084/HU-085 remain open, PR #278 draft.


### Fresh recovery prepared after diagnostic delivery — 2026-10-30

Diagnostic correction committed/pushed as `b8cebf6f`; exact remote head verified.
The three tested executable/test hashes still match: reuse build/lint and the
31-test joint gate plus final 17-test diagnostic rerun, all green without skips.
Read-only preflight confirms the same account disabled, zero user keys/direct
bindings, unchanged project IAM and expired prior window. No writer token requested.

Private `2026-10-30-develop-writer-live-retry-2` holds fresh preparation, an exact
composition hash, inert approval template and reuse of the retained synthetic
baseline. Startup without a fresh matching approval rejects before any local server
or provider effect. Prior receipts/export are preserved. The new session must
re-read owner/full ACL/raw baseline before re-enablement and saves terminal ACLs.
OAuth Online/drive.file is prepared at consent only; no token, refresh grant, new
account/file, runtime session or shared mutation has occurred. Separate explicit
reactivation/OAuth/execution approval and a fresh ten-minute owner window remain
pending. Maintenance and production remain excluded; no native parity change.


### Recovery identified mint denial; bounded readiness prepared locally — 2026-10-30

The explicitly authorized second recovery used delivered `b8cebf6f`. Fresh owner
and raw seven-tab checks passed. The corrected diagnostic records **mint-token,
HTTP 403** before writer-token handoff, batch review or Sheets submission. Child
counters are zero submitted/in-flight/unknown; no shared Firestore client was opened.
The exact terminal ACL contains only the owner. Account disabled, zero user keys
and direct bindings, temporary grant removed, later mint denied; owner OAuth
revoked (200), same token denied (401), Google UI zero linked apps. Access-loss
acceptance remains unproven without a preceding positive writer read. No retry.

Read-only inspection confirms IAM Credentials enabled and the selected role includes
`iam.serviceAccounts.getAccessToken`. Exact-window audit records show successful
caller enable/grant/remove/disable, but no mint-denial detail. Mint was attempted
about three seconds after the grant. [Google documents eventual IAM propagation](https://docs.cloud.google.com/iam/docs/access-change-propagation),
so propagation is plausible, **not a proven root cause**. No role expansion, API
activation, key creation or production investigation was performed.

Local preparation now checks only that permission using the exact account's
[testIamPermissions](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/testIamPermissions).
It polls at five-second intervals for at most 180 seconds, stopping earlier to
reserve 360 seconds in the unchanged owner window for token/use/cleanup. Every
iteration rechecks source, identity/policy and deadline; even a late positive reply
aborts. The advisory read is not authorization proof: the single actual mint and
all existing checks remain mandatory, and a 403 there is never retried. Missing
readiness or authority drift cleans up without minting. Foreign grants are preserved.

Build/lint, CJS checks and **36 tests, zero failures/skips**, pass. Five new cases
cover delayed readiness, timeout, late positive response, concurrent authority drift
and exact read-only transport. New plan/source/preparation digest; this is local
work after `b8cebf6f`, not another authorized live execution. Receipt directory:
`2026-10-30-develop-writer-live-retry-2`; preserve its original result and demo export.
Next review/deliver this correction before preparing a newly authorized session.
No maintenance, original develop/production file, shared business write, FCM,
deployment or native change. HU-084/HU-085 open; PR #278 draft.


### Readiness accepted; actual mint denied; cleanup complete — 2026-10-30

The authorized recovery-3 used delivered `7d5bd6d6`. Owner/full ACL and the raw
seven-tab baseline matched. Advisory permission readiness returned true after
747 ms; the single actual mint still returned HTTP 403 (`mint-token`). No writer
token handoff, batch review, Sheets submission or shared Firestore access occurred;
child submitted/in-flight/unknown counters are zero. This does not establish a
root cause or justify broader permissions or a different identity.

Cleanup verified owner-only copy ACL, exact temporary IAM removal, disabled
account, zero user keys/direct bindings and a later denied mint. Owner OAuth was
revoked (200), the same token denied (401), and Google showed zero linked apps.
The private retry-3 receipt and emulator export are retained; local bridge and
emulator stopped. Positive writer-read/access-loss acceptance remains unproven:
`inspection_required`, `canRetry:false`, `canEnterMaintenance:false`.

A local diagnostic correction now retains only recognized Google ErrorInfo reason
codes, discarding messages, metadata and unknown values. It preserves the first
recognized reason across child failure reporting. It cannot recover the reason
from this completed attempt. Build/lint and 38 focused tests pass, zero failures
or skips. The correction and this evidence are not yet committed. No retry was
performed with the modified sources; any future packet requires a fresh digest.

Next: deliver the diagnostic correction, then prepare an IAM-only diagnostic
without owner OAuth or workbook sharing/window before proposing another full
rehearsal. That diagnostic is not yet prepared or authorized. Maintenance stays
closed; production, original develop workbook, shared business data and FCM remain
untouched. No native changes or parity gap. HU-084/HU-085 open; PR #278 draft.


### IAM-only diagnostic prepared; no live execution — 2026-10-30

Delivered `d7fb614a` (remote verified): safe denial reasons and the recovery-3
failure/cleanup evidence. Fresh lint/build and 24 transport/controller tests pass;
the preceding 38-case integrated evidence remains recorded above.

The next local preparation isolates IAM without owner OAuth, workbook identifiers,
Drive/Sheets requests, a child or an emulator. `prepare-develop-writer-iam-diagnostic.cjs`
reuses the reviewed authority checks and CAS cleanup; the existing provider now
exposes an IAM-only transport. A fresh approval seals the exact account UID,
source/composition and a maximum ten-minute window. An exclusive receipt directory
is consumed before provider access. Missing/stale approval rejects before credentials
or network in the private composition. Prior receipts are never reused.

The proposed execution reactivates only the existing isolated writer, grants the
same account-level `roles/iam.workloadIdentityUser` to the same caller, checks
readiness for at most 180s and makes one actual mint request (300s, unchanged scopes,
no delegates). These are controller limits, not restrictions imposed by the IAM
role. A returned token is neither logged, persisted nor used. Cleanup removes only
the owned grant, disables the account and rechecks identity/keys/bindings/project
policy; no second mint is issued to test cleanup. Foreign grants survive and prevent
a successful terminal verdict. A crash or uncertain cleanup requires inspection of
the intent receipts and exact identity; never rerun the consumed approval.

Known reasons are accepted only from the generic Google, IAM or IAM Credentials
ErrorInfo domains; unknown domains/reasons, messages and metadata are discarded.
The real API remains decisive, not the advisory permission query; see the official
[generateAccessToken contract](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken).
Success here cannot establish Sheets access, migration admission or the 403 cause
from earlier attempts.

Validation: lint/build; 38 copy regression tests with the local Firestore emulator
plus nine IAM-only tests, all passing without skips. Private packet
`2026-10-30-develop-writer-iam-only` contains an inert approval template, source-bound
preparation/composition and offline rejection evidence. Identity comes from the
retained receipt, not a new live observation; execution rechecks it before effects.
This new preparation is uncommitted and has not loaded credentials or contacted
Google. Next review/deliver, then obtain explicit approval for the isolated IAM
reactivation/grant/single mint/cleanup. No owner action or closed-sheet window is
needed. Maintenance closed; production untouched; native parity unchanged.


### IAM-only execution stopped before grant; cleanup reconciled — 2026-10-30

Commit `43706b14` was pushed and its exact remote HEAD verified. Lint/build and 33
focused tests passed again before the explicitly authorized single execution.
The original ten-minute deadline was retained; the private source-bound packet
matched the delivered code. No owner OAuth, workbook access or data client.

Preflight passed and the isolated account was enabled. A local check at
`grant-identity` then failed before writing a grant intent, changing account IAM,
checking readiness or requesting a token. The original terminal result is
`inspection_required`, `mintAttempted:false`, with `terminal_identity_unproven`.
No replay was attempted and the original receipt remains unchanged.

A separate read-only reconciliation verifies the exact account disabled, zero user
keys/direct bindings, unchanged project policy against retained evidence and the
existing authority checks passing. Scoped Admin Activity records show successful
EnableServiceAccount and DisableServiceAccount calls at 18:53:42 and 18:53:44 UTC.
The cleanup is now reconciled in a separate receipt. No token was requested or
issued; this execution cannot explain the earlier mint 403.

The failed local assertion was not identified by the original receipt. Delayed
account-state visibility and policy drift cannot be distinguished retrospectively;
neither is a proven cause. The local diagnostic now records only constant check
identifiers (lifecycle, identity authority, project policy), phase, expected/observed
disabled booleans and pass/fail, including cleanup. No raw assertion, policy,
credentials or provider response is retained. A focused regression distinguishes
lifecycle mismatch from changed project policy without granting or minting.
Admission, time bounds, cleanup and single-attempt limits are unchanged.

This observation-only correction/evidence is local and uncommitted. Validate and
review/deliver before preparing a fresh approval-bound execution; do not reuse the
consumed journal or prior packet. Maintenance remains closed; production and all
workbooks untouched; no native change. Issues open; PR #278 draft. Private evidence:
`2026-10-30-develop-writer-iam-only`, original terminal plus `cleanup-reconciliation.json`.

Observation correction validation: lint/build and 34 focused tests pass, zero failures/skips.


### Lifecycle oscillation observed; explicit containment corrected — 2026-10-30

Delivered `dfaafc22`, pushed and exact remote HEAD verified; lint/build and 34
focused tests passed again. The new authorized IAM-only retry used a fresh journal,
source-bound preparation and the original ten-minute deadline. Preflight and the
post-enable check passed. The temporary grant was applied, then the next identity
read reported disabled=true during wait-token-permission. The account-lifecycle
observation failed; no readiness result or token request occurred. Grant removal
completed. The automatic terminal's empty cleanupFailures is **not sufficient
containment evidence** for this attempt.

A later exact read found the account enabled. The old transport had skipped its
disable POST on a disabled=true read. Scoped audit shows enable, grant and removal,
then only the later explicit disable; this identifies a concrete containment bug
under inconsistent lifecycle reads. An unconditional disable on the verified UID
returned 200. Subsequent exact read verifies disabled, zero keys/direct bindings
and unchanged project policy. Separate reconciliation supersedes the containment
assessment, preserving the original terminal. No second enable, grant or mint.

Local correction: always issue disable after identity verification, even when a
read says disabled. Google documents that disabling an already disabled account
has no effect ([enable/disable guide](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable)).
The IAM-only controller now observes the expected lifecycle every 5s for at most
60s per observation, clipped to the existing admission/readiness deadline. Only
lifecycle mismatch is waited on; identity, key, bindings and project-policy checks
remain immediate failures. No extra enable or grant, no extended owner/authorization
window, and only one actual mint attempt. Cleanup always sends disable first and
then observes the terminal state within 60s, reporting timeout as unresolved.
Neither a positive read nor bounded observation proves all IAM replicas agree;
actual mint remains decisive. The historical mint403 is still unexplained.

Validation: lint/build, 37 focused tests and 38 copy/emulator regressions (51 unique
cases), all pass with no skips. Regressions cover alternating lifecycle reads,
explicit disable despite disabled=true, timeout, late positive reply and authority
drift during observation. One initial new-test timing assertion counted an unintended
second simulated delay; the fixture was corrected and the full focused suite rerun.
The correction/evidence is local, uncommitted and not executed live. Prior approval
is consumed. Review/deliver before a new authorized attempt with a fresh digest.
Private evidence: `2026-10-30-develop-writer-iam-only-retry-1`.
Maintenance closed; production/all workbooks untouched; no native parity change.


### Single mint denied by IAM; cleanup verified; minimum grant age prepared — 2026-10-30

Delivered `7de7a19a`, exact remote verified; lint/build and 37 focused tests rerun.
The newly authorized IAM-only retry-2 passed lifecycle/authority checks, granted
the exact role and received advisory readiness in 649ms. Its single actual mint
returned HTTP403, **IAM_PERMISSION_DENIED**. No token was issued or used. Explicit
disable and grant removal completed, with no cleanup failures. Independent later
read verifies disabled, zero user keys/direct bindings, unchanged project policy.
Scoped Admin Activity confirms the expected caller's enable/grant/removal/disable.
No second mint, owner OAuth, workbook or business-data access.

Read-only checks confirm IAM Credentials ENABLED and the selected role includes
getAccessToken. The retained grant targets the expected caller and time condition.
Mint intent was about 1.4s after the audit timestamp of grant application. Userinfo
returned401 and does not independently establish bearer identity; expected caller
is supported by the CLI account and scoped administrative audit. The combined
IAM/Credentials audit query did not yield evidence; the successful scoped Admin
Activity query provides the recorded mutation sequence, not mint-denial internals.

Google documents policy propagation as typically two minutes, potentially seven
minutes or longer ([access propagation](https://docs.cloud.google.com/iam/docs/access-change-propagation)).
Propagation is plausible, not proven by this 403. No role expansion or identity
change is justified. Local preparation now requires a minimum grant age of120s,
measured after the grant response, before the only mint. Lifecycle/source/authority
and advisory permission are reread at5s intervals within the unchanged max180s
readiness deadline and ten-minute authorization window, reserving360s. Immediate
advisory success cannot shorten that minimum. Expiry still aborts and cleans up;
there is no retry of enable, grant or mint. Two minutes is not an authorization
proof or guaranteed propagation bound.

Local validation: lint/build and39 focused tests pass, zero failures/skips. New
regressions check immediate readiness cannot mint early and an insufficient window
aborts with zero mints. This minimum-age correction and current evidence are
uncommitted and unexecuted; previous live receipts/authorization stay consumed.
Next review/deliver, then a fresh authorized IAM-only attempt. No owner action or
closed-sheet window is needed. Private evidence:2026-10-30-develop-writer-iam-only-retry-2.
Maintenance closed; production/all workbooks untouched; no native parity change.
