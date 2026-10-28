# HU-084: backend handoff design and local rehearsal

Status: separately authorized develop capture is deployed; shared maintenance
remains **`canApply:false`** and legacy writers have not been paused.
The maintainer accepted the named owner's cooperation exception on 2026-10-28
in [ADR-0021](../decisions/0021-use-cooperative-owner-maintenance-for-shift-workbooks.md).
No custody change, deployment or real maintenance is authorized by that decision.

[Versión en español](../../docs-es/testing/hu084-relevo-backend.md).

## Current baseline

Commit `f5c3b5db` delivers the [selective develop pause and copy-lock rehearsal](hu084-selective-develop-pause.md).
Its 20 accepted emulator cases exercise the six callbacks from the exact audited
deployed executable, including positive production results and no production
access to the develop pause journal. Those cases are rerun unchanged here; they do not
prove a deployed bridge or a complete drain of earlier work.

The authorized copy test proved owner/service-account write denial while locked,
owner-only removal, recovery of both write paths and restoration of the selected
seven-tab images. Temporary access was removed. It also proved the key limit:
the global content lock blocks the intended runtime, while the owner retains the
authority to remove it. The real develop and production workbooks were untouched.

## Three separate lanes

The proposal keeps three obligations separate. Completing one cannot substitute
for either of the others.

| Lane | Required result | Local boundary |
| --- | --- | --- |
| New deliveries | Persist event identity, complete original payload and binding before acknowledging retention; preserve exact duplicates and reject conflicting ones | Rehearse durable capture and failed acknowledgement; provider delivery durability remains unproved |
| Earlier operations and effects | Reconcile every admitted operation, submitted external effect and causal descendant to an evidenced outcome | Pending, uncertain or untracked work prevents closure; no elapsed-time shortcut |
| Workbook maintenance admission | Close other writer paths, bind the named owner's bounded cooperation agreement and grant only reviewed backend commands | Version 2 entry runs locally below; no physical handoff or live admission is proved; the earlier assessment retains `physicalHandoffReady:false` |

The read-only configuration inspection confirms the same six audited legacy
Functions/revisions: 60-second request timeouts, maximum 20 instances, concurrency
one and all traffic on the latest revision. Omitted minimum counts remain unknown.
The four shared wildcard triggers use Functions `DO_NOT_RETRY`; their active
transport subscriptions have a 600-second acknowledgement deadline, 24-hour
retention and 10–600-second retry backoff. These are different retry layers:
application retry disabled does not imply duplicate-free transport delivery.
These metadata are not a queue/invocation census or a drain proof.

Throwing when retention fails is not a proven durable deferral policy; enabling
application retries globally changes the non-idempotent production path. A real
bridge must establish durable develop delivery without changing that production
behavior. A journal entry alone is not a delivery guarantee.

A closed admission flag, revoked grant or Drive lock does not prove that a
previously submitted external request finished or was cancelled. A request may
complete after closure or lose its acknowledgement. Such an outcome remains
unresolved until reconciled; zero new active operations is insufficient.

## Reuse the existing contracts

Use the [trusted barrier adapter](../../functions/src/shift-planning-trusted-intake-barrier-adapter.ts)
and its [closed-intake scope](../../functions/src/shift-planning-intake-barrier.ts).
Bind the exact environment, transition, writer inventory, write epoch, active
revision/digest, causal set, rules and workbook checkpoint. Retain the same
closed checkpoint on success and failure; reopening remains a separate governed
transition. Do not add a production controller for this rehearsal.

The [current pause journal](../../functions/src/develop-legacy-pause-rehearsal.ts)
deliberately keeps `legacyUntracked:true` and provides no drain checkpoint.
The new rehearsal must not clear that uncertainty by copying its counters or by
inventing evidence for a legacy operation it never observed.

The [external writer fence](../../functions/src/shift-planning-external-writer-fence.ts)
revalidates captured authority before each mutation and after the final one; it
detects drift without making Drive transactional. The [Sheets adapter](../../functions/src/shift-sheets.ts)
uses an atomic Sheets batch, but offers no Sheets CAS and cannot fence an editor
between read and write. A lease or repeated version check cannot produce physical
exclusion. The accepted maintenance policy records that residual owner race
instead of claiming exclusion. An uncertain submission remains read-only for recovery.

Version 1 retains its strict human/offline-editor fence and default adapter.
The explicit version 2 contract below represents owner cooperation separately;
it cannot be substituted for version 1 or inferred from a boolean or local fixture.

## Finite local rehearsal

The test-only [helper](../../functions/test/develop-backend-handoff-helper.cjs)
and [Firestore emulator suite](../../functions/test/develop-backend-handoff.emulator.test.cjs)
model a declared finite universe without exporting a Function or contacting
Drive/FCM. The eight new accepted cases exercise:

1. A real Firestore capture transaction commits and loses its SDK acknowledgement.
   A fresh client retains the first envelope, distinguishes source versions from
   delivery IDs and read times, deduplicates exact input and rejects conflicts.
   JSON/Timestamp fixture fields and metadata extensions are preserved; unsupported
   value types are rejected. This is not a general CloudEvent/SDK serializer.
2. An exact legacy callback starts before the pause journal, waits before port
   work and finishes later. Zero new active operations cannot erase that work
   or certify unknown earlier history.
3. A recording provider accepts the exact legacy VM port arguments. The callback
   ends with a lost-response error; a deferred real Firestore write completes
   later and creates a captured notification descendant. Both remain unresolved.
4. An uncertain FCM submission stays possibly delivered, without automatic retry
   or replacement notice. Missing dispatch state is not proof of no submission.
5. The finite known fixture set reconciles against current source values through
   initialized existing epoch/revision CAS. Stale commands cannot overwrite newer
   authority. The live barrier parser rejects the fixture's assessment packet.
6. A new captured event invalidates the frozen manifest before projection writes.
7. Missing authority cannot exploit the legacy both-null compatibility path.
8. Completed notification evidence binds the exact original payload and terminal
   afterimage/version; later payload drift invalidates reconciliation.

Only `knownFixtureReconciliationReady` can become true for the declared finite
demo universe. Every assessment retains `legacyUntracked:true`,
`physicalHandoffReady:false`, `canApply:false` and `canClaimClosure:false`.
The projection command exercises real emulator transactions; it is not the
production Sheets worker. The recording provider does not prove real Drive/FCM
acceptance or cancellation behavior.

Durable broker delivery, persistence-failure/ACK policy, complete old-work census,
lease-expiry transitions and held external authority remain unproved by this suite.
An SDK acknowledgement loss tests retained state, not broker durability. The
earlier copy-lock result is reused as a limitation, not simulated as a new proof.

The existing monotonic write epoch and active-revision checks remain mandatory
for controlled reopening. Recovery may restore business state, but must not
restore permissive Rules or an old writer that bypasses those checks.

## Accepted workbook policy and unselected custody alternatives

[HU-085](../../spec/shifts/hu-085-production-shift-workbook-activation/spec.md)
originally required zero continuing workbook writers, then the runtime as physical
sole writer. ADR-0021 replaces only the named owner's absolute exclusion with a
bounded cooperation agreement. Other writer/effect controls remain intact; a
replacement workbook must not be silently substituted.

| Alternative | Remaining condition or tradeoff |
| --- | --- |
| Keep the file ID and absolute owner exclusion | Not selected; would require a real held owner-control mechanism, currently unknown |
| Governed custody, move or transfer | Separate decision and real fixture proof preserving ID/link, content and bound integrations; no location or transfer is selected here |
| New controlled projection | Explicitly changes the destination/link and custody contract; retain the old file as agreed, not as an automatic replacement |
| Operational change window on the current personal file | Accepted in ADR-0021/HU-085; version 2 entry is locally tested; provider composition, Sheets operations and safe-copy procedure remain pending |

A service account is not assumed to be a feasible workbook owner. Actual custody,
storage, permissions and recovery capabilities need separate verification.
Read-only connector discovery returned no Shared Drives for the connected
account. This does not prove that the association has no Workspace subscription
or that another account cannot access one. The maintainer believes only personal
accounts are used, but is not fully certain. This is a provisional planning
assumption, not verified absence of Workspace or approval of any custody change.

### Accepted decision under the personal-account assumption

Do not require a Workspace purchase or ownership transfer for this work. Use
a bounded maintenance window on the same file: confirm owner/editor closure and
no pending offline edits, temporarily restrict other editors, allow only the
reviewed backend commands, and compare recorded revision/content before and after
each batch. Preserve published dates/order and restore the agreed editor access
only after reconciliation. All effective writers and credentials still need an
inventory; old Admin effects and possibly delivered notifications remain blocking.

The owner retains technical editing capability. This proposal therefore relies
on owner cooperation and detects some drift; it cannot eliminate the read/write
race, guarantee detection of every transient change, or certify physical sole
writing. Observed drift or uncertainty stops automated progression and requires
reconciliation, without blindly retrying or reversing an uncertain write.

**The maintainer explicitly accepted this amendment to only HU-085's absolute
owner-exclusion guarantee.** All other admission, event/effect reconciliation,
epoch/revision and notification gates remain intact. The aligned specification
and ADR record policy acceptance, not operational readiness. The local contract
adaptation below precedes a separately authorized safe-copy procedure rehearsal
and any request for real maintenance permissions.

Google documents that [range protection cannot remove an owner's permissions](https://support.google.com/docs/answer/1218656?hl=en),
that [content restrictions are global and mutable](https://developers.google.com/workspace/drive/api/guides/content-restrictions),
and that [ownership cannot transfer to a service account](https://developers.google.com/workspace/drive/api/guides/transfer-file).
Changing to another personal owner merely moves the same owner capability.

## Operational entry contract and local rehearsal — 2026-10-28

The explicit owner factory in the [existing trusted adapter](../../functions/src/shift-planning-trusted-intake-barrier-adapter.ts)
uses the [agreement codec](../../functions/src/shift-planning-owner-maintenance.ts)
and the existing evidence store and maintenance CAS. No parallel controller,
operation ledger, Function export or default deployment setting is added.

- The strict inventory remains 26 groups/20 intake controls. The owner variant
  has 27 groups/21 intake controls: it retains technical controls for non-owner
  humans/offline edits and records the named owner as `agreement-recorded`, with
  retained capability. The other 25 groups and six activation checks are preserved.
- Version 2 binds environment, file, owner, participants, window/deadline,
  operation/manifest, authority, source and epoch/revision to the confirmations,
  scope, checkpoint, evidence and CAS receipt. Owner=controller admits only the
  exact separately sealed ACL/protection action and recorded credential closure;
  the invoker-only operator cannot alias that owner/controller identity.
- Before and after the callback, the adapter reads a fresh owner observation and
  checks the actual clock. The immutable technical checkpoint retains historical
  agreement evidence; it is not a claim of current owner exclusion or validity.
  Withdrawal, reported activity even with unchanged content, unresolved writes,
  authority/participant drift or expiry stop progression.
- Failure rechecks technical closure and retains a typed incident in the existing
  journal, binding agreement, phase, reason and observation digest. If closure or
  durable retention cannot be proved, the operation fails closed without claiming
  the incident was retained. No automatic retry, inverse recovery or reopening occurs.
- A terminal version 2 replay reads the exact retained CAS receipt, checks current
  ownership and the failure journal on both sides, and makes no new CAS or control
  call. It may be read after expiry; it neither renews admission nor certifies that
  the original callback's final read-back has finished. Future writes/release
  require fresh admission; a receipt alone grants none.

The [new emulator suite](../../functions/test/shift-planning-owner-maintenance.emulator.test.cjs)
uses real Firestore evidence, receipts, afterimages and sentinels in fixed demo
projects. Local ports model technical closure and fresh owner reports; they do
not prove real IAM/Drive control, deployed event delivery or provider drain.
This contract covers maintenance entry while the workbook baseline is unchanged.
It is not a Sheets batch worker: later Sheet operations still require their own
reviewed expected postimage and operation guard, plus safe-copy/live authorization.

Acceptance against delivered baseline `3aafe4e8`: Node 22.23.4, Functions build
and full lint pass. The joint isolated-emulator run passes **438 tests, zero
failures/skips**, including six new contract cases, 18 new entry/persistence
cases, the old barrier/state repositories, all planning cases and the preceding
28-case handoff/pause suite. The 51 cases skipped without an emulator are enabled
in this final run. Independent source review found no remaining blockers.

The first broader run is retained as diagnostic evidence: it exposed a wrong
21/27 test count, a stale inverse-only fixture missing its explicit delivery
spacing slot, and an existing governed-source credit-policy error escaping the
durable fairness rejection. Those are corrected: the credit publication guard
remains closed; only its specific typed unavailability maps to the existing
`fairness_input_drift` failure. Network/programming errors still propagate.
Exact commands, hashes, full TAP and initial/final logs remain private in
`2026-10-28-owner-maintenance`. This contract was validated against `3aafe4e8`;
no shared resource, native source or deployment setting changed.

## Real controls and protected Sheets batches — 2026-10-28

The entry contract is delivered as `2690528e`. The current local group connects
[the concrete composition](../../functions/src/shift-planning-owner-sheets-composition.ts)
to the public Google SDK and existing Firestore command, authorization, submission
and workbook-exclusion records. It adds no Function export, deployment switch,
parallel ledger or retry controller.

The raw reader pins workbook/runtime permission identity, paginates permissions
and observes owner, capabilities, restrictions, protections, metadata and bounded
selected grids. Missing/denied/incomplete authority stays unknown. Metadata-only
tabs do not imply cell coverage. Omitted empty `contentRestrictions` is normalized
only by the explicit trusted raw collector; connector summaries are not that
proof. The deprecated capability is replaced by the
[current editor/owner/removal fields](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

The reviewed authorization binds the complete preservation manifest and exact
request/projection digests to agreement, command, lineage, epoch and claim.
The [preservation compiler](../../functions/src/shift-sheets-owner-manifest.ts)
accepts only the five shapes emitted by the adapter: `addSheet`, growing
`updateSheetProperties`, bounded `updateCells` using only `userEnteredValue`,
and creation/update of its developer marker. It checks expected values/clears,
preserves observed untouched values, formats, notes, rich text and validations,
and rejects unreviewed tab/control changes. Only completely observed grids can
change. Existing request, read-cell, dimension and persistence budgets apply.

Fresh controls precede submission, verification and completion, including cached
physical evidence. The final Firestore transaction compares the pinned approval's
update time, owner-report digest, immutable core and absence of incident alongside
current command/epoch/deadline. A synchronous deadline check precedes the SDK call.
Observed withdrawal/drift is retained in the same authorization/receipt path;
restoring content or permissions does not clear it. Workbook serialization lasts
until command completion across partitions; old consumers reject these receipts.

The physical call remains one `batchUpdate` without SDK retries. Lost
acknowledgement permits inspection only: exact postimage plus current controls
can resolve it; uncertainty retains the incident and lease.
[Google batch atomicity](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
is not compare-and-swap against collaborators. This does not eliminate owner
races, prove cancellation or guarantee server commit before the local deadline.
Historical technical evidence is not a current hold: the independent fresh
control reader is mandatory and defaults to blocked. Real old-writer drain and
effective authority remain operational prerequisites.

### Copy rehearsal packet

Read-only preparation located the previous isolated native copy and seven tabs.
The connector omitted requested raw Drive version/capabilities/restrictions;
those facts remain unknown. No cells, permissions, identities or original files
were changed. Exact identity, observations and access/window proposal remain in
the private `2026-10-28-sheets-maintenance-controls` packet.

`prepareCopyRehearsal` derives the batch/manifest through the actual adapter,
demo source rows and SDK observations. It has no physical batch path, claims
no command, writes no receipt/incident and always returns `canApply:false`.
Its local test is not a real-provider rehearsal. The prepared copy scenario is
one uniquely named canonical delivery tab with synthetic rows, preserving the
seven existing tabs and leaving the canary for review. Blind tab deletion is
not supported recovery.

Before separately authorized execution:

1. Review the exact copy, protected original IDs, synthetic manifest, before/after
   images and window (maximum proposed duration: 20 minutes). No start/end or
   owner confirmation has been collected.
2. Authorize a new keyless test identity and exact temporary token/copy grants;
   verify effective authority and raw SDK readability. Share only this copy.
   The old test identity stays disabled; do not reuse revoked OAuth or real
   business data. Firestore stays on the fixed localhost emulator/`demo-` project.
3. Confirm the owner is online, has closed the copy, has no pending offline edits
   and will not edit during the window. Collect fresh actual technical controls;
   a demo hold cannot authorize shared develop activation.
4. Execute only the reviewed single batch. On ambiguity retain the receipt and
   inspect; do not resend, delete tabs, restore sharing or disable the worker
   until outcome and containment are reconciled.
5. After known terminal reconciliation, read back preservation/permissions,
   revoke/read back exact temporary token-mint and copy grants, disable the test
   identity and retain sanitized results privately.

This packet does not authorize those actions. No user action is needed for local
implementation. Copy execution, shared deployment, original/develop/production
changes, migration and notification release remain separate gates.

Local acceptance against delivered `2690528e`: Node 22.23.4, Functions build/full
lint and five CJS syntax checks pass. The joint isolated Firestore-emulator run
passes **622 tests, zero failures/skips**, including 29 new concrete-composition
cases, the full planning list, existing barrier/state/Sheets repositories and
prior handoff/pause cases. Recording Google protocol exercises the actual Sheets
adapter; it does not prove provider IAM, actual delivery/drain or physical writes.
Independent source review found no remaining blockers for this local scope.
The first run's five sparse-array versus JSON-null comparison failures were
corrected without relaxing cell/content assertions; diagnostic and final logs,
commands, hashes and copy observations remain private. The emulator is stopped.
This group remains local/uncommitted; native sources and deployment exports are
unchanged, so no new Android/iOS run is required and no platform parity gap arises.

## Validation and remaining gate

This rehearsal was validated against baseline `f5c3b5db`. Node 22.23.4,
Functions `npm run build`, `npm run lint` and syntax checks for both CJS files pass.
The isolated `demo-reguerta-writer-controls` Firestore emulator at port 8897 ran
both suites together: **28 passes, zero failures/skips** (eight new handoff cases
and 20 unchanged pause/production cases). The emulator was stopped afterwards.
Exact commands, audited deployed-source binding, helper hashes and complete TAP
are retained in the private `2026-10-28-backend-handoff` evidence packet.
Independent source/evidence review found no remaining blockers for this local scope.
Native sources are unchanged, so no new native build or physical-device run is needed.

Before an operational handoff, establish real durable event intake and effective
control over old develop writers and their submitted effects. The shared legacy
Admin SDK paths bypass client Rules; a new journal cannot count their earlier
work. Selective isolation or the separately authorized bounded shared-project
maintenance path must be demonstrated. No new project or broad shutdown is
chosen here, and no timeout or quiet interval substitutes for that proof.

No real workbook write, grant, deployment or activation is authorized by this
document. A green local run cannot certify durable provider delivery, earlier
runtime drain, other-writer controls or a valid operational owner agreement.
The next live packet still needs fresh
provider evidence, exact source/authority bindings and separately authorized
forward/recovery operations; **`canApply:false` remains mandatory**.


## Authorized real-copy rehearsal — 2026-10-28

This checkpoint supersedes the earlier prepared-only copy status; the historical
622-case local result above remains unchanged. The separately authorized run used
the existing isolated copy, synthetic market data and an actual Google SDK token.
It sent **one physical `batchUpdate`: 45 requests for ten market rows in one new
tab**. The seven pre-existing tabs had identical complete raw before/after
digests, checked before command completion. The new tab remains for review.

The explicit `isolated-copy-runtime` branch uses a schema 2 copy agreement and
copy-bound authority. Its operator is the actual local runner instance, not an
invented second human or an invoker-only IAM principal. Fresh identity, exact
grants/scopes, token deadline, owned process lock, SDK counters and the existing
submission receipt/pointer bound the run to this copy and its localhost demo
Firestore project. No fictitious 27-group develop barrier was constructed. The
shared/default barrier and its real old-writer prerequisites remain unchanged.

The keyless copy identity received a bounded temporary grant and one 300-second
token with only Sheets and Drive-metadata-read scopes. The token-only SDK client
uses an explicit 1 ms eager-refresh threshold and `forceRefreshOnFailure:false`: in
the installed SDK, zero selects its five-minute default and rejects a valid short
token by attempting refresh. Focused tests and the real provider call verified
this configuration; no ADC or automatic token renewal is used by the writer.
A separate real-provider mismatch was corrected only in copy mode: the exact
file/agreement owner may also inherit a writer grant, since that adds no actor to
the already retained owner capability. Inherited runtime writers, groups with
write access and additional writers remain rejected.

The runner checked lock ownership/content/inode and deadlines at submission,
counted the actual SDK call and retained its durable intent before sending. Fresh
provider controls and complete raw preservation checks preceded verification and
completion. The actual emulator command reached `completed`, released its market
lease and created zero notification events; final counters were one submitted,
zero in flight and zero unknown. Earlier blocked attempts sent zero SDK batches;
their incidents were retained rather than cleared to reuse an authorization.

After an initially stale IAM read, repeated idempotent cleanup and fresh
read-back confirmed: copy ACL owner-only, fresh test identity disabled, no
user-managed keys, project roles or temporary bindings, denial with the original
still-valid bearer and denial of a new token request (both observed as 404).
Private receipts, raw images, diagnostics and cleanup evidence remain in
`2026-10-28-isolated-copy-rehearsal`; no account/file identifiers, credentials or
business content are included here.

This proves the bounded physical copy path. It does not establish shared develop
durable intake, effective old-writer/effect control or operational authority, and
it performed no original/production workbook I/O, shared Firebase data operation,
notification release or deployment. Shared admission remains `canApply:false`.
Final validation passes Functions build/full lint and **661 joint
emulator/regression tests, zero failures/skips**. Both reviewed groups are included
in this delivery checkpoint. Their exact commit and remote verification are
recorded in #268/#269 and draft PR #278. Next is the shared develop
intake/old-writer/authority work; HU-084 and HU-085 stay open.

## Durable develop intake and baseline bridge — 2026-10-28

This is the next implementation block after the accepted copy rehearsal. It
prepares capture and containment code; it does not record a shared deployment,
complete historical event capture or certify old operations drained. The earlier
661-case acceptance belongs to the preceding groups. Validation of this block
must be recorded separately after its source and packaged runtime are checked.

### One capture boundary, without legacy replay

The [durable intake](../../functions/src/develop-shift-intake.ts) writes only under
`shiftPlanningDevelopIntake/current`, outside the broad environment/dataset
client grant in the deployed Rules. Member, admin and unauthenticated clients
must be denied all reads and writes there. One Firestore transaction
retains the original event metadata, typed before/after images in bounded chunks,
logical event identity and delivery identity, and advances `captureRevision`.
Acknowledgement follows that commit. A repeated delivery cannot replace the
original payload; aliases for the same source document version share one logical
capture. Source timestamps retain nanoseconds, and delivery/read times remain
distinct from document-version identity.

The retained format supports plain maps/arrays, timestamps, geopoints, bytes,
vectors and all numeric values. It explicitly rejects document references,
unsupported SDK objects, getters, envelopes above 4 MiB or metadata above
256 KiB. Nothing is silently truncated or acknowledged as captured. This is a
bounded inspection format, not a general SDK snapshot serializer. A rejected
old retry-disabled delivery remains a historical gap; verify source-field
compatibility and observe capture failures before admitting the shared handoff.

Capture has no Sheets/FCM port, business executor, callback replay or activation
path. New captures change the revision that a future causal manifest must bind;
an older manifest cannot describe that newer set. The intake is not yet connected
to a trusted operational drain/authority reader. Its counts are diagnostic,
`legacyUntracked` remains true and inspection returns `canClaimClosure:false`
and `canApply:false`. Neither an empty capture collection nor a missing planning
state proves that earlier work did not exist.

The [bridge](../../functions/src/develop-shift-intake-bridge.ts) wraps the audited
deployed callbacks, preserving their SDK registration/options. Its four original
event callbacks capture develop deliveries before returning, including deliveries
generated before the new collectors existed. Its two original HTTP callbacks
resolve the environment with the baseline's own resolver and reject develop with
HTTP 503 before invoking legacy work. Exact production dispatch invokes the
original callback without constructing or reading the intake; unsupported
environment values fail closed.

Four additional capture-only exports use fixed develop paths and `retry:true`:
`captureDevelopShiftPlanningRequest`, `captureDevelopShiftWritten`,
`captureDevelopDeliveryCalendarWritten` and `captureDevelopNotificationCreated`.
They use the same capture repository as the original callbacks. This deliberately
allows overlap without executing the old business effects twice.

### Reproducible runtime and ordered deployment proposal

The [package builder](../../functions/scripts/prepare-develop-intake-bridge.cjs)
requires the audited baseline ZIP and JavaScript digests. It packages that
baseline with the intake/bridge, rather than deploying the current application
`index.ts`. The baseline lockfile stays exact; the only package change is
`scripts.gcp-build = ""`, preventing the buildpack from invoking legacy `tsc`
and overwriting the prepared entrypoint. Dependency versions remain: `firebase-admin` 13.4.0,
`firebase-functions` 6.3.2, `@google-cloud/firestore` 7.11.1 and `googleapis` 144.
One additional audited global option, `preserveExternalChanges:true`, prevents
SDK reset defaults from replacing the live runtime identity, limits or ingress.
The four new collectors explicitly cap instances at 20. The installed Firebase
CLI retains existing environment values when no dotenv file is supplied; these
values remain private and their exact read-back hashes are bound to the plan.
The six original constructors and callback bodies remain unchanged apart from
the explicit callback wrappers. Runtime metadata still needs fresh pre/post
verification at deployment.

Prepared runtime, phase manifests and Firebase configuration stay in the private
evidence packet. Both configurations discover all ten exports, so each phase
requires the manifest's exact `--only` selector for its four or six targets; a
configuration filename alone does not restrict deployment. Existing secrets,
environment files and unrelated application
exports are not copied into it. Building the package does not deploy it.

The proposed shared operation remains ordered and separately authorized:

1. Create only the four new collectors. Read back their exact develop filters,
   destinations and retry configuration, then verify durable capture through
   each route before changing any original callback.
2. Update only the six baseline callbacks with the bridge, preserving production
   behavior. Keep both sets of capture paths during the transition; do not delete
   a destination simply because its replacement is deployed.
3. Reconcile old invocations, delayed causal events and already submitted provider
   effects; establish effective writer/authority controls and fresh read-backs.
   Only that later evidence can support a trusted barrier and maintenance entry.

Firebase's [function migration guidance](https://firebase.google.com/docs/functions/manage-functions)
requires the replacement to be deployed before removing the original and calls
for idempotency during overlap. This package provides that capture boundary; it
does not make deployment, rollback or shared-project shutdown decisions itself.

### Delivery and historical limits that remain blocking

Firestore delivery is unordered and at least once, so arrival order is not a
business sequence. [Firestore trigger limitations](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen)
also state that Admin SDK writes bypass client Rules. Capture and Rules closure
therefore cannot by themselves revoke older privileged invocations.

The four original deployed triggers have `RETRY_POLICY_DO_NOT_RETRY`. A failed
capture there may be dropped; adding retry-enabled collectors does not change
the old destinations retroactively or recover their earlier backlog. Firebase's
[retry contract](https://firebase.google.com/docs/functions/retries) gives
second-generation retries a finite 24-hour window. [Eventarc Standard](https://docs.cloud.google.com/eventarc/standard/docs/overview)
documents a default 24-hour retention period and warns that events generated
before a trigger update can still follow the previous filter/destination within
three days. These transport limits are not a drain certificate or a reason to
clear an unknown operation after waiting.

A separately identified source backfill may describe documents still present.
It cannot recreate deleted documents, overwritten intermediate versions, missing
historical deliveries or FCM already accepted without a reliable terminal receipt.
Such gaps and possibly delivered notices remain unresolved; there is no automatic
resend. A crashed old callback, an expired lease, a swallowed error or an ambiguous
external acknowledgement must not become a successful terminal disposition.

The next operational gate remains effective control and reconciliation of the
old develop writers and their effects. This source block neither clears
`legacyUntracked` nor activates shared develop, migration, production or
notification delivery. HU-084 and HU-085 remain open.

The focused emulator gate is
`npm run test:shift-planning:develop-intake:emulator` from `functions`, with the
private audited files supplied as `HU084_DEPLOYED_LEGACY_JS` and
`HU084_DEPLOYED_LEGACY_ZIP`. `HU084_LEGACY_RUNTIME_METADATA` optionally binds the
read-only six-function metadata capture to the preparation manifest. Missing
metadata never authorizes a deploy. Keep the source archive, environment values
and generated package outside Git.

### Accepted local checkpoint before the provider run

Node 22.23.4, Functions build/full lint and **695 joint tests** pass with zero
failures/skips. Eight production cases run the builder's transformed JavaScript
after its original source pin is checked; all six positive callback traces and
after-images match, including two additional HTTP cases with omitted environment
resolved to production. The private path denies member/admin/unauthenticated
get/list/create/update/delete under both the captured and prepared Rules.

A separately installed source package loads the actual locked Admin 13.4.0,
Functions 6.3.2 and Firestore 7.11.1 SDKs. Its ten exports have the expected
filters/retries and runtime-preservation metadata; eight local callbacks retain
four events and four deliveries without Sheets/FCM submission. Final executable
hashes are unchanged during the gate. Logs, source package, private configuration
capture and receipts stay in `2026-10-28-durable-develop-intake` outside Git.

Only the six shared Functions' configuration/source metadata was read live; all
source generations remain unchanged. No shared data mutation, deployment,
workbook I/O or real notification occurred. Android/iOS sources are unchanged;
their existing accepted physical evidence is reused. Shared rollout, old-effect
reconciliation and current authority remain pending, so `canApply:false` holds.

### Authorized shared capture phase and provider correction

The maintainer separately approved only the four new develop collectors in
`reguerta-9f27f`, using the existing runtime account, plus four create-only
temporary probes and their conditional deletion. CLI 15.15.0 was scoped to their
exact names after checking both generations/all regions for selector-prefix
collisions. The six legacy Functions retain their source, runtime configuration
and behavior; their compatibility bridge is prepared but not deployed.

The first real protobuf deliveries exposed an SDK boundary missed by the earlier
query-snapshot smoke: local event snapshots throw when reading `readTime`.
The four probes were deleted with exact payload/update-time checks after that
attempt timed out. The correction accepts absent read time only for an actual
`DocumentSnapshot` throwing the pinned SDK's exact local-document error; other
errors and existing-document source-version requirements remain strict.

Final validation passes build/full lint and **697 joint tests**, including raw
protobuf through public trigger decoders. A separate packaged SDK 6.3.2/Firestore
7.11.1 run executes **20 callbacks**, including unprojected protobuf creation and
deletion, with ten logical captures/deliveries and no Sheets/FCM submission.
The SDK 7.3.2 test fixture explicitly omits only its derived V1-compatibility
getters when projecting the baseline-6 CloudEvent shape; production has no such
metadata relaxation. Both deployed archives are retained, and every one of the
six accepted runtime files matches for all four repaired Functions.

The existing Eventarc transports remained identical across the repair. They
redelivered all **four original creations and two deletions** without another
create, manual replay, subscription pull/seek or ACK. Exact payloads, source
versions and retained hashes match; the four temporary source documents remain
absent. Current private counts are six events, six deliveries and revision six,
with `legacyUntracked:true`. Positive six-event evidence does not certify all
broker/error history or old-work drain; a partial stderr page is not a zero-error
audit. Private read-back verifies IAM-authenticated invocation, fixed develop
filters, retry policy and maximum 20 instances. Broker metadata records a
600-second ACK deadline, 24-hour retention and 10–600-second retry backoff.

No original/production workbook I/O, production data change or trial notification
send occurred. The next gate is the separately scoped pause/containment of old
develop writers, their outstanding effects and effective authority. Maintenance,
migration and coverage activation remain blocked. Exact commit/remote verification
is recorded in #268/#269; evidence stays in the private `2026-10-28-durable-develop-intake` packet.

### Authorized selective legacy pause and read-only reconciliation

After delivery at `76a96826`, the maintainer separately authorized the six legacy
Function updates in `reguerta-9f27f` and four temporary develop probes. The same
accepted package was used: dispatcher first, then the other five exact targets.
All six immutable sources match the six-file allowlist. Runtime identity, values
of environment variables, limits, ingress/IAM, filters and retry policies are
preserved, with 100% traffic on the new revisions. The four collectors and other
14 Functions remain unchanged. Production callbacks stay byte-identical; no
production business call was used as a probe. This does not establish zero
interruption during deployment.

Both develop import/export paths return the expected HTTP 503 before business
work. The four create-only probes produce four create and two written-delete
captures, verified by content/version/hash and cleaned with exact postimage and
updateTime preconditions. A complete paginated request-log window shows the two
503s and six successful event requests on the four updated legacy revisions.
Intake advances from six to twelve events/deliveries/revisions and retains
`legacyUntracked:true`. This establishes the new callback paths, not a drain of
work admitted by previous revisions. **All develop notices are held**, including
order reminders; clients, users/config writers, manual actors and other services
are outside these six wrappers. On failure, preserve capture/closed develop and
repair forward. Never restore unwrapped callbacks or reopen on elapsed time.

The before/after common-readTime censuses contain the same 183 business documents
and versions: zero planning requests, 62 planned shifts, four calendar overrides
and 117 historical notices. Dispatch summaries are 55 no_tokens, 34 partial_success,
25 success and three absent. The latter are administrative broadcasts created on
2026-04-01, not new shift failures. None is authorized for automatic resend.
Mutable results/no_tokens cannot establish a complete send history; failed
planning can follow an actual Sheets write.

`functions/scripts/inspect-develop-legacy-census.cjs` inspects a private REST census
offline: exact develop paths, complete capture/delivery/chunk sets, hashes,
identities and current version/content relationships. It binds a fingerprint and
capture revision, preserves unknown external outcomes and denies replay/apply/
closure. Atomicity is explicitly reported by the collector, not independently
attested. A probe prefix grants no exemption. Run with
`--input <private-census.json> --output <new-private-report.json>`; the CLI creates
only a new local 0600 report. Raw data/provider receipts/source archives stay
outside Git. This inspection never changes business or journal records.

No original/production workbook I/O or test FCM send occurred. Shared maintenance
and migration remain closed pending the governed assessment of historical effects
and effective authority. Successful containment of these six entry points does
not close other writers or clear `legacyUntracked`.
