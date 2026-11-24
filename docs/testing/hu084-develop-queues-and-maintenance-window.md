# Develop queues and proposed maintenance window — HU-084 / HU-085

## Delivery and current decision

Prior reconciliation is committed/pushed as
`4cb216824dc908293311a4f9c496fc2326c0f350`, with exact remote and draft PR #278
head verification. Continue the same #268/#269 execution items. This group checks
actual delivery bindings and prepares a future window; it does not open one.

**Window status: NOT READY.** Production remains outside the business-data scope.
No message is pulled, manually acknowledged, sought or replayed. No workbook,
notification, Auth, IAM or business-document mutation is part of the inspection.
Provider payloads, identities and raw configuration stay in private evidence.

## Measured queue and invocation boundary

Eight Function/Eventarc/topic/subscription bindings are read: four shared legacy
triggers and four fixed-develop private collectors. The shared triggers retain
`RETRY_POLICY_DO_NOT_RETRY`; the private collectors retain `RETRY_POLICY_RETRY`.
Their subscriptions retain 600-second acknowledgement deadlines and 86,400-second retention.

| Observation | Meaning and limit |
| --- | --- |
| Four private subscriptions: one pending message each | In the bounded 20:47:55–21:47:55 UTC observation, oldest age is approximately 31,600 seconds. This is a real retry problem, not an empty-queue proof. |
| Four private collectors: 44 payload conflicts and 44 HTTP500s | A subsequent 90-minute log query finds eleven failed attempts per receiver, on one already-retained CloudEvent ID per receiver. Distinct traces establish repeated attempts, not distinct business commands. |
| Shared subscriptions: no returned metric series | UNKNOWN. These subscriptions also cover production and are not develop-partitioned; absence of a series cannot be serialized as zero pending/in-flight. |
| Monitoring alignment and visibility | Sixty-second aligned buckets and documented metric visibility delay (120/240 seconds for the queried counters) are not atomic live drain counters. |
| Cloud Run long-running operation query | Provider rejects the targeted metadata filter. No broad fallback is made; deployment operations are not a runtime invocation census. |

The canonical delivery key hashes entry point/source/ID while its digest includes
all metadata. The same key can therefore conflict on metadata with an unchanged
source core. A traceparent-only change reproduces this locally; the exact field
in the live retries is not yet proven. Do not claim transport equivalence.

## Prepared repair and exact deployment boundary

[ADR-0023](../decisions/0023-retain-develop-delivery-metadata-observations.md)
preserves the first event envelope, all twelve schema1 deliveries and existing
chunks. A different complete metadata observation can be appended as schema2 in
the same collection only after validating its canonical anchor, unchanged source
core and exact CloudEvent id/source/type/subject/time/specversion. The transaction
retains evidence before successful acknowledgement, increments existing counters
once and keeps eventCount unchanged. Core/identity/key/corruption conflicts still
reject, with specific sanitized diagnostics. No business handler runs.

The offline inspector validates both schemas, rejects orphan/inconsistent rows
and binds every row into the stable set digest. Old schema1 set bindings remain
unchanged; a newly retained observation requires refreshing the binding. The five
root fields stay schema1-compatible with the six already-deployed legacy wrappers.
Those six archived codecs are outside this repair and must not be reported updated.

The private `capture-update4` packet exports exactly:

- captureDevelopShiftPlanningRequest
- captureDevelopShiftWritten
- captureDevelopDeliveryCalendarWritten
- captureDevelopNotificationCreated

The seven-file manifest binds six runtime files plus `firebase.capture.json`.
Its SHA256 is `d5bb2d15e607f949edd1336a4eaaaf9f5436f38527d78f3ea244fda38d1cd2b3`;
the compiled intake SHA256 is
`a5617f4da0a44b87ccee112a24fa3f35920c6f07886c33fce6fd54b7f8ee5d34`.
The archived dependency lock/SDK6 and runtime controls are preserved. Real SDK
discovery returns exactly four retry-enabled exports. Full Functions build/lint
and 147 combined emulator/Rules/compatibility/package/census/reconciliation/barrier
tests pass with zero failures/skips. No native source changed.

The maintainer explicitly authorized those four collectors in `reguerta-9f27f`
on 2026-10-29. Deployment succeeded and immutable archives match the packet;
all four runtime controls/IAM and the other twenty Functions are preserved. A fresh GET-only guard must bind all24 Functions, exact selector,
four complete runtimes/IAM and manifest before deployment. Post-readback must
verify immutable source ZIP contents, preserved runtime/identity/env/secrets/
filters/retry/IAM/traffic and the other20 Functions. Keep the packet closed if any
comparison differs. No root application deployment or `--force` is allowed.

After authorization, allow natural redelivery, inspect retained observations and
actual success/failure logs, then recheck lagged metrics. Compare all183 source
documents and original event/delivery/chunk payloads with the retained baseline;
only additional observations and their counters are allowed. Do not assume
exactly four new rows or equate successful private delivery with global drain.

## Proposed future window — no date or participant commitment yet

Reserve provisionally twenty minutes of controlled work plus twenty minutes for
recovery. Start time is chosen only after the following technical preparation:

1. Resolve the observed private retry failure and retain fresh queue/in-flight
   evidence. Shared UNKNOWN observations remain blockers for strict admission.
2. Prepare an explicit source-scoped control contract/adapter for the shared
   ACTIVE capture-only triggers. Their production delivery cannot be disabled
   globally or falsely declared disabled. ADR-0022 human cooperation cannot waive
   technical controls or the eight causal-drain counters.
3. Prepare a controlled bootstrap for the five absent planning-authority paths:
   shiftPlanningState/current, sourcePolicy, sheetsSubmission and the delivery/
   market shiftRotations. Absence does not mean epoch0 or authorization to create.
4. Bind the exact automated authorities, paused jobs, closed HTTP/client writes,
   refreshed source/journal set, workbook literals/permissions and recovery
   preconditions. Preserve dates/order and possibly-delivered/no-replay history.

Only then request current commitments from the workbook owner, all retained
Firebase administrators and a distinct authorized operator principal. They must
be online, stop manual edits and unreviewed automation, close pending/offline
edits and competing tests/deployments, and remain available through recovery.
One principal with two role labels does not satisfy owner/operator separation.
Do not solicit an expiring twenty-minute agreement while technical work remains.

The eventual preflight must fail closed on drift, expired agreements, missing
provider evidence or uncertain effects. Recovery preserves the intake and source
baseline, stops new operational work, and uses the existing scoped incident/
residual path rather than replaying notices or pretending old effects completed.
The exact bootstrap/migration/reversal sequence will be reviewable before its
separate live authorization. This proposed budget authorizes none of those writes.

All admission outputs remain false: physicalHandoffReady, canEnterMaintenance and
canApply. legacyUntracked remains true. HU-084/HU-085 and draft PR #278 stay open.

## Authorized four-collector update — 2026-10-29

The authorized deployment succeeds for exactly four private collectors. Immutable
source archives match the reviewed packet; runtime configuration, identity,
permissions, filters, retries and traffic are preserved, as are the other twenty
Functions. Natural retries retain four schema2 observations: each differs from
its canonical record only in traceparent. The source183 documents, twelve original
events/deliveries and chunks remain byte-equivalent including source versions.
Root captureRevision/deliveryCount advance12→16; eventCount stays12 and
legacyUntracked stays true. No business callback, Sheets write, FCM send, manual
message consumption, maintenance entry or migration is performed.

The 147-test/build/lint gate is reused with unchanged executable inputs. The
Firebase CLI warns about the intentionally preserved archived SDK; this scoped
update does not upgrade runtime dependencies. Native code is unchanged.

Acceptance on 2026-10-29: four natural HTTP2xx requests are correlated by exact
CloudEvent ID/source labels, service and new revision; the bounded query has no
HTTP4xx/5xx or application errors. Four metadata observations differ only in
traceparent; original183 sources/twelve events/twelve V1 deliveries/chunks and
versions are preserved. Revision/deliveryCount16, eventCount12. All four source
archives and controls match; other20 Functions unchanged. Eight unchanged
executable-input hashes retain build/lint and147 tests. Shared UNKNOWN and bootstrap/
provider-sourceScope/participant requirements still block maintenance admission.
The maintainer authorizes source delivery; exact Git/remote evidence is recorded in #268/#269 and draft PR #278.

Final bounded queue observation (2026-10-29): latest returned backlog samples are
0/0/0/1 across the four private subscriptions. Four correlated HTTP2xx responses
and preserved metadata do not establish broker ACK/drain; the remaining value1
is unresolved, not silently treated as metric lag. Shared missing series remain
UNKNOWN. Next operational step is to reconcile that residual provider delivery
before claiming private queue drain or preparing real maintenance admission.

## Residual queue reconciliation — 2026-10-29

The maintainer authorizes commit/push and read-only reconciliation. The reviewed
repair is delivered as `3977fd6f2df13d87748c7db1e3dd31ed36b8db1d`; local, remote and
draft PR #278 heads match. Eight identical executable hashes reuse build/full lint
and147 tests. No new runtime code or provider mutation is needed in this group.

The residual belongs to the private captureDevelopShiftWritten subscription. A
bounded unaligned metric query observes one push response ack_204 and one push
acknowledged message during00:30–00:31 UTC. Its backlog and oldest-unacknowledged
age both report0 at00:36:00 and00:37:00 UTC. This resolves the previously observed
backlog1 through provider evidence, alongside the already-correlated successful
CloudEvent request and retained metadata. Subscription aggregate ACK metrics do
not expose a per-message ACK identifier; no such identity proof is fabricated.

New-revision logs from00:35 to06:22:51 UTC contain no further requests or errors.
The fresh census is unchanged from the post-deployment snapshot:183 sources,
12 events,12 canonical deliveries,4 observations and all chunks/versions preserved;
revision remains16. No additional observations, replay, manual ACK, pull, seek,
Sheets/FCM/business writes, IAM change or deployment occurs. The provider/source
bindings and four Function configurations match the accepted deployment.

The last15-minute raw metric query returns no series. This remains UNKNOWN, not
a continuously fresh zero or global physical-drain proof. The historical residual
is reconciled; maintenance still needs provider/sourceScope admission, controlled
bootstrap and participant/window commitments. Keep legacyUntracked:true and all
maintenance/migration admission flags false. This group's new changes are evidence
documentation only; diff checks suffice, with no new native validation required.

[Google's metric guidance](https://docs.cloud.google.com/pubsub/docs/metrics-autoscaling-best-practices)
warns against treating absent metrics as an empty backlog. Raw bounded observations
and their hashes remain private.


## Shared-trigger control and initial planner preparation — 2026-10-29

Residual reconciliation is delivered as `3dbbd4dadfbfd6f87a9f193afc46b68ad4fad0d7`;
local, remote and draft PR #278 heads match. The following preparation remains local.

`functions/scripts/prepare-develop-planner-entry.cjs` is an offline review tool,
not a deployment or migration command. It compares the eight current Function
configurations with the previously reviewed immutable sources, preserving runtime,
identity, revisions, traffic, filters and retry policy. Filter ordering is normalized;
changed values, widened scope, missing functions or source drift are rejected.
Each shared trigger is described as **capture-only for develop, ACTIVE for production**.
This accurately represents the deployed bridge; it is not physical trigger disablement.
The four matching private collectors remain restricted to develop.

Read-only provider checks match all eight reviewed configurations. The fresh
06:35:52.940 UTC census retains the same183 source documents, twelve events and
sixteen deliveries, including four metadata observations; captureRevision remains16.
Its stable set digest is
`2e759f15bc51e1a3d9f955b4544bd56c35996b514d5f573561c1cd681d6b0692`.
Five authority paths are absent at the absence snapshot. The review recipe is:

| Path below develop/plus-collections | Prepared action after trusted admission |
| --- | --- |
| shiftPlanningState/current | Create revision1/writeEpoch1 with a real closed barrier, operation and lineage; absence is not epoch0. |
| shiftPlanningState/sourcePolicy | Bind actual workbook version/index authority, helper projection, market horizon and planning frontier. |
| shiftRotations/delivery | Retain published ownership and post-published round2/index22 cursor. |
| shiftRotations/market | Retain published ownership and post-published round2/index22 cursor. |
| shiftPlanningState/sheetsSubmission | Keep absent until a governed Sheets submission needs it. |

The retained content proposal is reused exactly:72 shifts,108 positions, both
54-position rotations and their32-member cohort. No date, order or allocation is
regenerated. This is the existing synthetic develop proposal, not a refreshed live
workbook/cohort approval. Missing market July/August2027,53 blank helper cells and
the62 legacy rows still require the previously recorded policy/migration treatment.
The existing migration sequence checker is reused instead of adding another planner.

Private preparation digest:
`shift-planning:v1:sha256:2b84751806ee7ce2fa8905a72e9e10de592a548ee664a4f2c28a11218722303a`.
Provider payloads, source records and the preparation remain outside Git.
Reproduce with `node functions/scripts/prepare-develop-planner-entry.cjs --input
<private-input.json> --output <new-private-review.json>`; output creation is exclusive,
mode0600, and no apply mode exists.

**Admission remains blocked.** The current strict barrier does not yet consume this
source-scoped capture control. The review sets `compatibleWithCurrentBarrier=false`,
null pending/in-flight counts and `initialStateDocument=null`; it never fabricates
an admitted state. Next implement and rehearse that trusted control-plane integration
and atomic initial-state admission together, preserving separate causal drain,
fresh source bindings and owner/administrator agreements. Existing ADR-0022 technical
requirements are unchanged. No cloud writes, deployment, Sheets edits or FCM occurred.

Validation: Functions build/lint, focused CJS lint and60 joint preparation, census,
bridge and migration tests pass with zero skips. Native code is unchanged; native
suites were not rerun. The migration tests here are offline and do not claim a new
shared or emulator migration execution.


## Local integration and recovery rehearsal — 2026-10-29

Preparation delivered as `51b9c514`. [ADR-0024](../decisions/0024-admit-source-scoped-develop-capture-controls.md)
records local integration of the explicit four-pair control into the barrier,
retaining ACTIVE production transport, participant checks and separate causal drain.
Build/lint, CJS lint,72 local and33 emulator tests pass. Emulator cases cover initial
creation, exact inverse, partial-state refusal and incident retention after restart
following lost acknowledgement. Recovery keeps a closed higher epoch; audit is not
deleted and maintenance is never automatically reopened.

The previous offline preparation still cannot admit maintenance: it lacks the new
trusted proofs and actual causal-drain counters. Remaining work is composing real
observations through the existing control-plane port and refreshing sources/policy/
participants for a concrete window. No deployment or shared write occurred.
This new integration remains local and uncommitted.

## Real observations and bounded window preparation — 2026-10-29

Capture-barrier integration delivered as `f7ef299a`; exact remote and draft PR
verification are recorded in #268/#269. This continuation remains local.

`observe-develop-capture-controls.cjs` connects injected read-only provider ports to
the existing eight-function verifier and ADR-0024 binding parser. It validates every
selector before reads, downloads generation-pinned source archives, matches their
reviewed SHA256, checks queue/subscription observations and re-reads all eight
configurations after source/queue reads. Drift rejects the complete observation.
The reusable verifier is extracted from the existing preparer; no second planner
or maintenance engine is added. Missing series remain UNKNOWN; even measured zero
samples remain SAMPLED_ONLY. Neither produces causal-drain counters or a held barrier.

The actual run verified all eight immutable archives and produced four typed source
control proofs. Observation digest:
`shift-planning:v1:sha256:389112b5c8ff04aa6edbefb36f504df4dfbf05fc343d8b57bf8e3367129694db`.
A separate metadata refresh verifies all24 Functions unchanged, all three reminder
jobs PAUSED and the exact accepted Rules release/source unchanged. Fresh develop
sources retain183 documents,12 events/16 deliveries and the same census digest.
All48 members' planning fields are unchanged;32 remain eligible. Credits, reserves,
coverage cases, sync commands, effects and swap requests return no documents.

Bounded A1:M80 formatted projections on the four published tabs match the retained
68/54/7/44-row projections exactly. This is visible published-data parity, not proof
of unchanged formulas/permissions or a new full-workbook version. No cell was edited.
The Drive connector omits the numeric version even when requested. After explicit
authorization, the existing private runtime inspector was invoked once and returned
HTTP200: six tabs read with numeric version259 before and after, canApply:false.
OIDC minting initially returned403; only minting was retried within the original
ten-minute deadline, without extending the grant or repeating the inspection.
Both grant attempts were cleaned up. An independent final IAM read confirms zero
direct bindings and preservation of the prior policy. Tokens were not persisted.
The reader cannot enumerate detailed ACL/owner counts; those remain unknown.
This refresh supplies a workbook observation, not maintenance admission.

The targeted shifts index read initially returned400 for pageSize100. Retrying with
the provider-required pageSize0 returns200 but five indexes belonging to orders,
products and orderLines. These do not establish shifts index readiness or absence.
Treat the authority as UNBOUND, retaining the exact request/response privately.
The request shape was checked against the official [index list API](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/list).
The invoker IAM read was corrected to the documented options.requestedPolicyVersion
query and confirms no direct bindings; this was read-only.

### Proposed window: not scheduled, admission false

| Gate | Current evidence / pending action |
| --- | --- |
| Deployed source controls | Four exact proofs; shared transport remains ACTIVE. Other controls retain their independently checked state. |
| Prior work and delivery drain | No recent metric series. Counts remain UNKNOWN; historical ACK/quiet census cannot replace source-specific causal proof or unresolved-effects reconciliation. |
| Published sources | Planning roster and four formatted projections match; preserve the72-turn proposal and both cursors. |
| Workbook/version/source policy | Runtime version259 is freshly stable across six tabs; ACL/owner inventory and reviewed horizon/helper/frontier bindings remain required. |
| Index authority | Response scope does not match shifts; no readiness claim. |
| Human agreements | Two human project Owners need complete current commitments; the additional human Viewer is not classified as an administrator. No window commitment requested yet. |

Do not name a start time or solicit a20-minute no-edit promise while technical gates
remain unresolved. After resolving them, freeze one intent containing exact controls,
source/policy digests, operation/recovery IDs, all participants and the start/end/recovery
limits. Obtain that concrete window's commitments, re-read every bound authority,
then admit initialization through the existing transaction and read back its results.
On drift, unknown/nonzero work, lost acknowledgement or participant activity, stop and
retain closure/incident; never automatically reopen, replay historical notices or
modify production. No deploy or shared business write is part of this preparation.

Validation: full Functions build/lint, focused CJS lint and73 observation/preparation/
bridge/census/migration tests pass without skips. Native and emulator migration gates
are unchanged from the delivered integration and were not rerun for this read-only
observation adapter. Raw source archives, roster, metrics and window packet stay private.

## Index authority and finite drain diagnosis — 2026-10-29

This read-only follow-up resolves the earlier scope-invalid index response by
listing the complete database inventory (`collectionGroups/-`), following the
provider page contract and reading each returned index by its exact resource name.
A second list matches the first: five READY composite indexes, all for orders,
products or orderLines. The complete field-override list contains only the database
default. Exact reads of the default, shifts wildcard and shifts.date confirm READY
ascending/descending/array indexes inherited by shifts; no shifts composite exists.
Observed configuration digest: `shift-planning:v1:sha256:35561b4957290cffa1a275e84316f674b4a4407d6fbde58fc7cb770265253216`. This is an observation to refresh before
admission, not a Firestore wire/index-size measurement or an apply authorization.

A separate concrete omission affects both native clients: their latest-request
query filters requestedByUserId and schemaVersion, orders requestedAt descending
and limits to one. The matching composite is declared in firestore.indexes.json
but absent from the deployed database. A develop-only Query Explain with
analyze:false returns FAILED_PRECONDITION, "no matching index found". It does not
execute the query or read member documents. See the official [Query Explain contract](https://firebase.google.com/docs/firestore/query-explain).

The prepared private operation creates exactly that one COLLECTION index through
the index-create API, after comparing all five existing indexes. It neither
replaces the inventory nor runs a broad Firebase index deploy. The three ordered
fields are requestedByUserId ASC, schemaVersion ASC, requestedAt DESC. The operation
applies to every collection with that ID, including production. The script permits
one submission only and retains an intent before POST; an uncertain response cannot
be resubmitted. After approval: retain the operation, wait for READY, verify the five
old indexes unchanged, rerun the same explain and refresh the configuration binding.
Authorization is pending. No provider mutation was made by this follow-up.

| Drain item | Fresh finding and limit |
| --- | --- |
| Source set | Same183 documents and stable digest as the preceding read; zero planning requests,62 legacy shifts,4 calendar rows and117 notices. Planned shifts are baseline data, not pending commands. |
| Retained captures | The existing offline reconciler binds all12 captures to accepted test receipts; zero unmatched captures.16 delivery records remain. This does not prove old callbacks terminal. |
| Eight queues | Bounded unaligned24-hour queries find historical backlog/age/outstanding zeros for all eight. Latest backlog zeros are00:28–00:37 UTC29 October for private collectors and13:10–13:11 UTC28 October for shared triggers. They are stale, not current zero counters. |
| Runtime | All23 non-inspector services are ready, with100% traffic on their reviewed revisions and no traffic tags. Twenty retain historical revisions. Configuration/traffic is not a running-invocation census. |
| Earlier notifications | All117 remain possibly delivered and unreplayable, including three old broadcasts without dispatch summaries. Neither expiry nor redeployment proves an unknown external outcome. |

The official [Pub/Sub guidance](https://docs.cloud.google.com/pubsub/docs/metrics-autoscaling-best-practices)
explicitly warns against interpreting missing metrics as no work. The finite
investigation is complete; repeated identical metric reads cannot supply the missing
source-specific terminal evidence. Keep causalDrain:null and legacyUntracked:true.
ADR-0024 still requires every numeric zero counter. The next drain work must map each
remaining writer to actual terminal evidence or effective isolation, and resolve the
mismatch between sampled provider telemetry and the barrier's live-delivery contract
before proposing any contract adjustment. Do not create synthetic zero counters,
clear historical uncertainty, replay old notices, delete revisions or stop shared
production transport to force this gate green. No maintenance window is scheduled.

Validation: private readers and the single-index preparation pass syntax/assertion
checks and the latter's read-only preflight. The existing census inspector/reconciler
passes on the fresh provider snapshot. This follow-up changes documentation/evidence
only, so native/build/unit gates are not rerun under the minimal-change exception;
the previous73-test/build/lint acceptance is unchanged. All raw evidence stays private.

## Authorized single-index creation and query acceptance — 2026-10-29

The maintainer explicitly authorized exactly the previously declared
shiftPlanningRequests composite in reguerta-9f27f/(default). One create POST was
submitted after verifying the five-index baseline; no retry or broad index deploy.
The new index is READY and exact GET matches requestedByUserId ASC, schemaVersion
ASC, requestedAt DESC plus Firestore's implicit __name__ DESC. All five original
composites and the complete field-override configuration are unchanged. The index
is collection-ID-wide and therefore also applies to matching production collections.

The first plan-only Explain after READY still returned FAILED_PRECONDITION. A later
read-only retry returned HTTP200 and explicitly selected that exact composite.
There was no second creation or query execution (analyze:false throughout). This
validates index availability for the query shape shared by Android and iOS; it does
not validate native Rules/session behavior or activate either app's planning feature.
Updated measured configuration digest: `shift-planning:v1:sha256:3e433596c64942e59ae7464ec44161fcb7bfc726de1a733727cd91552c7b028b`. Renew it before maintenance admission.

Validation consists of provider operation/index reads, exact existing-resource
comparisons, query-plan acceptance and script syntax/diff checks. No runtime source
changed, so full/native tests were not repeated; earlier73-test/build/lint acceptance
is unchanged. No documents, Rules, Functions, Sheets or FCM were modified. This
closes the missing-index gate only. The drain/old-execution evidence, source policy,
workbook authority and participant/window requirements remain open. Docs remain local.

Final operation read: done:true, no error; READY and query-plan acceptance confirmed.

## Current decision gate — 2026-10-29

The index gate is closed. The [31-writer assessment](hu084-develop-old-work-boundary.md)
separates current ingress, contained delivery and old business effects. A fresh
read observes 23 reviewed service routes and 284 RETIRED historical revisions;
neither is an external-call terminal proof. Proposed [ADR-0025](../decisions/0025-separate-contained-deliveries-from-business-drain.md)
would admit explicitly contained delivery without fabricating zero counters. It
does not relax old-effect or automated-authority controls. Decision pending; no
implementation, window, migration or cloud mutation in this assessment.

## Accepted contained-delivery implementation — 2026-10-29

ADR-0025 is accepted for local implementation/rehearsal and implemented. Exact
opt-in controls, all eight delivery routes and separate frozen source/core sets
preserve unknown/nonzero observations without weakening old business-work counters.
174 local and37 emulator tests, build/full lint/CJS lint pass, no skips. Immutable
held receipts still reject drift. See the [implementation checkpoint](../decisions/0025-separate-contained-deliveries-from-business-drain.md).
Next reconcile actual old business effects/automated authority, then bind workbook/
source policy and fresh window commitments. Shared admission stays false; no live
change or native change. This block remains uncommitted with the prior observation work.
