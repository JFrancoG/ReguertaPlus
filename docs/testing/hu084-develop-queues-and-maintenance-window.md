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
triggers and four fixed-develop private collectors. All preserve retry-enabled
delivery, 600-second acknowledgement deadlines and 86,400-second retention.

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
