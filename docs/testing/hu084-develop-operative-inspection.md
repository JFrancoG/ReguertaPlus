# HU-084 develop operational inspection

Status: the private develop inspection is deployed and verified under dedicated
identities. Workbook access is reader-only; the temporary human OIDC creation
binding has been removed and checked. This operation includes no migration,
maintenance transition, shared writer change or business-data write.

[Spanish version](../../docs-es/testing/hu084-inspeccion-operativa-develop.md).

## Scope

The fixed project is `reguerta-9f27f` and the logical environment is `develop`.
Inspect its configured develop workbook and `develop/plus-collections` only.
Preserve the 72 published dates and 108 ordered places, the 62 raw legacy shifts,
and the current apps. Do not apply the 53 helper suggestions, generate the missing
July/August 2027 market dates, initialize coverage or change planning readiness.

The [local migration rehearsal](hu084-develop-migration-rehearsal.md) proves its
isolated contracts. Its workbook counter, index authority and held control-plane
fixture are not evidence about the shared services. The demo-only runner must
remain demo-only; changing its project/host guard is not an operational entrypoint.

Shared project metadata may describe Functions or Rules serving both logical
environments. Record that scope, but do not read production application data or
its workbook, change shared controls, or infer develop isolation from a path name.

## Observed access boundary — 2026-10-27

The initial read-only inspection established the following limited facts before
the dedicated identity preparation recorded below. They are historical
observations to renew, not a maintenance checkpoint:

| Surface | Observed result | Still unproved |
| --- | --- | --- |
| Firebase / Functions API | Expected shared project; 19 project Functions are `ACTIVE` in `europe-west1`, all Node 22 under the same Compute runtime identity | Writer closure, candidate deployment, effective permissions and drained delivery |
| Shift trigger revision | `onShiftWritten` remains `onshiftwritten-00016-num` from April 7; the relevant Firestore triggers have shared `{env}` paths | Isolation of develop and compatibility of the currently deployed code with the new migration |
| Live Firestore Rules | Read-only source inspection found no explicit shifts/calendar barrier or private-planning collection deny; the authenticated fallback excludes only orders | Closure of direct client writers; the updated repository Rules are not deployed |
| Planning control state | Fresh reads of the five exact paths below returned `NOT_FOUND` | No conclusion about pending workflows, effective writer authority or a closed maintenance barrier |
| Develop Drive sharing | One owner and two service-account writer grants are visible | Effective owner-write control, other inherited/automation authority and an exclusive writer |
| Drive location | The normalized response supplies no Shared Drive metadata | Location/capability evidence sufficient to establish a reversible owner fence |
| Drive version | The connector omits the numeric file `version` | The actual version; modification time or revision-history IDs cannot substitute for it |
| Existing local ADC | Credentials exist, but the attempted Drive file/about reads returned `403 insufficientPermissions` | A credential with the reviewed read scopes and file access |
| gcloud account list | No signed-in CLI accounts were listed | This does not mean ADC is absent and does not justify overwriting it |
| Shared Compute token permissions (initial observation) | Testing `getAccessToken` and `getOpenIdToken` returned no granted permissions | Runtime impersonation; this two-action result does not describe all effective IAM or write authority |
| Previously proposed operator account | IAM GET for the recovery-operator account reused by the initial HTTP source returned `404` | That earlier observation is not the status of the dedicated inspection identities created below |
| Planning request index | The direct API returned five indexes for `orders`, `orderLines` and `products`, even with the specific group requested, and no page continuation | The one `shiftPlanningRequests` index declared locally was not observed; this apparently unfiltered response proves neither its absence nor readiness |

Do not overwrite existing ADC, log another account in or out, reactivate the
retired HU-083 auditor, impersonate the shared Compute runtime or expose tokens
to resolve these gaps. Only the bounded identity/access changes recorded below
are authorized.
The September auditor's revocation and restored ACL are historical evidence; the
old access window and its retained backup cannot be assumed usable today.

The retained September Functions metadata contains six then-active Functions
with April revisions. It is a comparison artifact, not the current deployment
inventory or proof that their old runtime identities remain applicable.

The Rules observation is a source comparison, not a write/exploit probe. It does
not authorize applying repository Rules. Returned index rows must also match
the requested parent and collection group: unrelated results cannot establish
the required index inventory or readiness.

## Deployed inspection contract

The deployed `inspectDevelopShiftMigration` export is IAM-only. Its source fixes
the dedicated runtime and invoker identities described below. Deployment and a
successful real invocation are verified; these identities are separate from the
recovery operator and shared Compute runtime. Its exact POST body is:

```json
{"schemaVersion":1,"environment":"develop","operationId":"inspection-example"}
```

This is a request-shape example, not a command to invoke a deployed service.
There is no approval digest in this read request: a cell fingerprint differs
from the semantic content-proposal digest and neither authorizes application.
The response is a sanitized summary, always `canApply:false`, with
`Cache-Control: no-store`. There is no apply/reopen route.

The source requires `SHEETS_SPREADSHEET_ID_DEVELOP` and a non-empty reviewed
`SHIFT_SHEETS_ALIASES_DEVELOP`, with no other-environment fallback. Its Google
scopes are `spreadsheets.readonly` and `drive.metadata.readonly`. These source
constraints do not create missing OAuth scopes or establish held writer controls.

## Read-only collection order

1. Freeze the inspected commit and load the compiled
   [writer inventory](../../spec/shifts/hu-082-continuous-seasonal-shift-rotation/writer-inventory.md).
   Version 3 has 26 logical writers: 20 barrier controls and six version-rechecked
   fairness writers. Bind its revision and digest; do not replace it with a list
   of Function names or the older version-2 document.
2. Verify the active project before each provider is used. Resolve the exact
   develop workbook from protected configuration and compare its fingerprint.
   Record parameter presence/routing without publishing file IDs, URLs, values,
   principal identities or credentials. The inspection inputs are the two
   develop keys above. Legacy range/import keys belong to the deployment
   comparison; they do not replace the required aliases or authorize changing
   parameters.
3. Read current Functions and the exact Cloud Run/Eventarc metadata, Rules and
   index definitions/status needed to map each logical writer to its deployment.
   Include the private recovery/import/sync entries and newly composed workers
   where present. An undeployed factory is not a disabled live worker, and a
   missing/forbidden observation is not a zero queue. Do not invoke mutation
   endpoints or read unfiltered shared logs that may contain production data.
4. Read `shiftPlanningState/current`, `shiftPlanningState/sourcePolicy`,
   `shiftPlanningState/sheetsSubmission`, `shiftRotations/delivery` and
   `shiftRotations/market`, all under `develop/plus-collections`, plus bounded
   develop work inventories. Distinguish runnable, in-flight and retained
   uncertain work. In particular, `reconciliationRequired` and `pending` work
   with a possible submitted batch are not drained merely because a lease expired.
5. Capture workbook metadata and bounded grids from their observed dimensions.
   Include all six known tabs when collecting a full develop baseline; the
   earlier four-grid capture did not certify historical grids. Capture native
   notes, formats, groups, merges or protections only when the provider actually
   returns them. Preserve dates, participant order, annotations and blank helpers.
6. Obtain the actual Drive file version, owners/roles, capabilities and location
   through an authorized read provider. Where a stable capture is required, read
   the version before and after the grids. Missing `version` leaves stability
   unproved; do not insert an emulator counter or infer absence from omitted
   normalized fields.
7. Capture the effective writer-authority observations available for IAM,
   service-account workloads/keys, inherited groups and Drive/Workspace/Apps
   Script authorities. Retain unavailable scopes as explicit gaps. Direct ACLs
   alone do not establish the absence of Apps Script, OAuth, offline edits,
   domain-wide delegation or privileged writers.

Connected Firebase tools can collect the supported project, Function, Rules,
index and bounded Firestore reads. Connected Drive tools can collect their
supported file/Sheet metadata and cells. Their successful read calls do not
prove complete IAM, Workspace or Apps Script visibility. gcloud is installed;
using it still requires an appropriate authenticated read identity and explicit
resource scope. Do not infer that an installed CLI has those permissions.

## Reader visibility and verified operation

Drive readers cannot inspect detailed file permissions. When the observer cannot
share the file, the provider does not request that inventory: private permissions,
`permissionCount` and `ownerCount` remain `null`, with the explicit
`workbook_permission_inventory_unavailable` blocker. An unknown inventory is not
an empty ACL, and its digest only fingerprints this incomplete observation.
Version and bounded grid inspection continue. The endpoint always returns
`canApply:false`. See [Drive roles](https://developers.google.com/workspace/drive/api/guides/ref-roles).

The deployed check read all six tabs with Drive version **259** before and after.
Anonymous access returned 403, authenticated GET returned 405, and production or
caller-selected-workbook commands returned 400. The valid develop read returned
200 with `no-store`, sanitized fingerprints and the unknown permission counts.
The 19 pre-existing Functions retain their revisions and selected metadata;
event-filter order is normalized when comparing the API's unordered entries.
Both dedicated accounts have no direct project-role bindings.

Local acceptance is 63 passing tests without skips/failures, clean lint/build,
focused CJS checks and the exact one-endpoint package filter. Failure logs expose
only fixed local code/stage values; original SDK messages, causes, URLs, account
identities and cell values are not logged or returned. The initial valid read
returned 503; this correction preserves reader access instead of raising it.

## Dedicated identities and isolated deployment

The authorization is limited to `reguerta-9f27f`,
`inspectDevelopShiftMigration` in `europe-west1` and the configured develop
workbook. It does not permit deploying the other Functions, Rules or indexes.

- Runtime: `reguerta-shifts-inspector`. Invoker: `reguerta-inspect-invoker`.
  Both accounts have been created. Their read-backs returned zero keys and zero
  direct project-role bindings. This does not establish absence of every
  inherited permission. No account key was generated for this operation.
- The current human deployer already had inherited `actAs` permission on the
  runtime identity; no additional runtime `actAs` binding was added.
- The human operator's temporary `roles/iam.serviceAccountOpenIdTokenCreator`
  binding was limited to the invoker account with a one-hour expiry. It was
  used only to obtain an OIDC invocation token with this service as its audience:
  no `getAccessToken`, signing or general OAuth-token minting grant is included. The binding was removed after validation. Direct policy read-back is empty
  and a subsequent `generateIdToken` request is denied with 403. No tokens were
  persisted. The permission-test observation is retained separately; it is not
  the closure proof.
- The invoker's service permission is limited to invoking this new private
  inspection. Its account is separate from the recovery operator. The runtime
  needs reader access only to the configured develop workbook; it receives no
  writer grant or access to the production workbook from this operation.

The connected Drive app's attempt to add the reader grant returned
`403 appNotAuthorizedToFile`. The maintainer shared the develop Sheet as **Viewer** with the runtime account,
and the owner connector verified that role. The six-tab runtime read then passed.
The owner-side sharing observation and the runtime's unavailable detailed ACL
remain separate evidence. This error does not authorize
replacing ADC, starting another OAuth session or widening connector access.

### Isolated CLI configuration and local package proof

Use a private Firebase configuration with the existing `default` codebase, an
absolute `functions` source, a private `configDir` and
`disallowLegacyRuntimeConfig:true`. The private directory contains only the
reviewed develop dotenv values: `SHEETS_SPREADSHEET_ID_DEVELOP` and
`SHIFT_SHEETS_ALIASES_DEVELOP`. Do not copy the global dotenv, production values
or legacy Runtime Config. Ignore `.env*` and `.secret*` when packaging source.
The CLI supplies the reserved project variables itself.

The exact deployment selector is `--only functions:inspectDevelopShiftMigration`,
with explicit `--project reguerta-9f27f`, the private `--config` and
`--non-interactive`, **without `--force`**. Predeploy runs lint and build. Before
executing it, finish the 63-case gate on the frozen source and inspect the local
SDK manifest with the CLI's endpoint filter: require exactly this one endpoint,
the fixed runtime/invoker, no secrets and no event trigger. This package check
must not call `firebase deploy --dry-run`: CLI preparation can enable APIs before
applying the function filter, including during a dry run.

Read back required API availability before deploy. Preserve shared Artifact
Registry cleanup policies; `--force` may configure a missing shared policy. If
the CLI reports a cleanup-policy error after deployment, read the actual Function
state before retrying because the endpoint may already exist.

The accepted inspection gate passed all 63 tests, lint/build and the package filter
check with exactly one target. The predeploy reads found all ten required APIs
enabled and one existing Artifact Registry cleanup policy; neither was changed.
No global Cloud SDK login was started. These are predeployment observations.

Deployment acceptance verified the actual dedicated runtime, private invoker
policy, anonymous rejection and sanitized authenticated response. The temporary
human OIDC binding was removed; a subsequent token request was denied with 403.
None of these access/deployment steps closes a writer, transfers ownership or
makes the inspection executable as a migration.

## Report and operational handoff

Local validation from `functions`: `npm run test:shift-planning:develop-inspection`
and `npm run lint`. The 63 passing cases cover the read provider, strict HTTP
boundary, actual loopback HTTP composition with Google doubles and relevant
Sheets/config/operator regressions. They do not prove deployed IAM or Drive access.

Bounded masked develop reads of `shiftPlanningRequests`,
`shiftPlanningSyncCommands`, `shiftCoverageEffects` and `shiftSwapRequests`
returned no documents or pagination token. These observations do not establish
that invocation queues are drained or writer controls are held.

Retain raw observations privately with restricted access. The sanitized report
must bind the source commit, inventory revision/digest, observation times and
input fingerprints, and distinguish observed facts, unsupported/unavailable
reads and unresolved controls. Record permission failures without tokens,
credentials, raw member data or workbook identifiers. Inspection with gaps may
produce a valid read-only report; it must not claim `closed`, `drained`,
`exclusive writer` or operational readiness without the corresponding proof.

Before any later maintenance operation, the owner must resolve an effective,
reversible owner/editor/automation fence and the treatment of Functions/Rules
shared with production. Editor confirmation of online/closed/no-pending-offline
state is separate from a technical permission fence. A My Drive owner is not
fenced by removing other editor grants. Do not transfer/move a file or disable a
shared revision as an implicit consequence of this inspection.

The real `closeAndCollect`/`readBackClosed` control-plane bindings, dedicated
authorities, post-drain backup, measured indexes/Drive authority and exact
forward/inverse authorization remain HU-085 work. The inspection must feed that
reviewed packet, not populate simulated checkpoints as though controls were held.

The next preparation is the [reversible develop writer-control proposal](hu084-develop-writer-controls.md); it does not close writers or reuse version 259 as a fresh maintenance observation.
