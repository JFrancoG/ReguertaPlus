# HU-084 develop operational inspection

Status: draft read-only runbook. Inspection source is prepared but not deployed;
the entrypoint/provider and their concrete invocation must be reviewed before
use. This document authorizes no
deployment, permission change, maintenance transition or data write.

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

The operator's current inspection established the following limited facts. They
are observations to renew, not a maintenance checkpoint:

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
| Runtime token permissions | Testing `getAccessToken` and `getOpenIdToken` returned no granted permissions | Runtime impersonation; this two-action result does not describe all effective IAM or write authority |
| Configured operator account | IAM GET for the account declared by the HTTP source returned `404` | The operator identity is not available today; account/invoker provisioning and any deployment remain pending |
| Planning request index | The direct API returned five indexes for `orders`, `orderLines` and `products`, even with the specific group requested, and no page continuation | The one `shiftPlanningRequests` index declared locally was not observed; this apparently unfiltered response proves neither its absence nor readiness |

Do not overwrite existing ADC, log another account in or out, reactivate the
retired HU-083 auditor, impersonate the runtime, grant permissions, or expose
tokens to resolve these gaps.
The September auditor's revocation and restored ACL are historical evidence; the
old access window and its retained backup cannot be assumed usable today.

The retained September Functions metadata contains six then-active Functions
with April revisions. It is a comparison artifact, not the current deployment
inventory or proof that their old runtime identities remain applicable.

The Rules observation is a source comparison, not a write/exploit probe. It does
not authorize applying repository Rules. Returned index rows must also match
the requested parent and collection group: unrelated results cannot establish
the required index inventory or readiness.

## Prepared inspection source

The prepared `inspectDevelopShiftMigration` export is IAM-only and reuses the
operator identity constant in source. The configured account currently returns
IAM `404`; there is no available operator invocation to assume. Account/invoker
provisioning and deployment remain pending. Its exact POST body is:

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

## Resolve the missing read authority

Two alternatives remain proposals, pending concrete source and scope review:

- A user-authorized OAuth read session: enumerate the exact scopes and their
  wider account-level access before requesting them; restrict the collector to
  the reviewed develop file/resources and preserve existing ADC and unrelated
  sessions. A failed existing token is not permission to mint or reuse another.
- One private inspection endpoint: first review its source, develop/file
  allowlists, authenticated invoker, runtime identity, read-only provider calls,
  output redaction and tests. Deployment is a separate concrete infrastructure
  action. The endpoint must expose no apply/reopen mode, and its existence does
  not prove that its runtime identity is the sole workbook writer.

Neither alternative closes a writer, transfers ownership or enables coverage.
The export name above describes prepared source; no live URL or invocation is
provided before its exact deployment and read identity are reviewed.

## Report and operational handoff

Local validation from `functions`: `npm run test:shift-planning:develop-inspection`
and `npm run lint`. The 58 passing cases cover the read provider, strict HTTP
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
