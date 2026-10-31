# Develop old-work boundary — 2026-10-29

## Result and authority

Read-only assessment; maintenance remains NOT_READY. The missing query index is
already READY and independently verified. The remaining problem is not that index.
[ADR-0025](../decisions/0025-separate-contained-deliveries-from-business-drain.md)
was accepted after this assessment and is implemented/rehearsed locally; see its
implementation checkpoint. It amends only the develop capture-delivery requirement
of ADR-0024. Old business-effect and authority requirements still block live admission.

This table supersedes the **current-status use**, not the historical evidence, of
the earlier 26-writer preparation. The current cooperative inventory in
`functions/src/shift-planning-writer-inventory.ts` has exactly 31 identities:
25 intake controls and six activation rechecks. Private collectors are paired
evidence for four existing trigger identities, not additional invented writers.

## Finite writer assessment

“Closed” below describes the observed current route only. It is not old-operation
completion, a signed maintenance receipt or exclusion of undiscovered workloads.

| Canonical writer ID | Current evidence / remaining obligation |
| --- | --- |
| `firestore-client-shifts` | Deployed Rules deny develop writes; preserve source/version rechecks. |
| `firestore-client-delivery-calendar` | Same client closure; four current documents are a baseline, not older terminal evidence. |
| `firestore-client-shift-planning-requests` | Same client closure; current collection empty does not count invocations. |
| `firestore-client-shift-swap-requests` | Same client closure; retain transition/work census. |
| `https-sync-shifts-from-google-sheets` | Reviewed develop 503 before original callback. The observed 62-row import has terminal evidence; this is not a complete invocation census. |
| `https-export-shifts-to-google-sheets` | Reviewed develop 503 before original callback. Earlier Sheets submissions still need completion or effective destination isolation. |
| `https-transition-shift-swap` | No counterpart in the reviewed 24-Function inventory; confirm owning runtime/authority, not global absence by name alone. |
| `https-shift-coverage` | Same bounded deployment absence; local code/readiness is not live exclusion. |
| `scheduler-order-reminder-sunday20` | Job PAUSED. Twelve recent reminder runs across the three jobs have matched terminals; older dispatch outcomes and direct invocation authority remain separate. |
| `scheduler-order-reminder-sunday22` | Same; pausing Scheduler alone does not disable its target service. |
| `scheduler-order-reminder-sunday23` | Same; no invented zero in-flight count. |
| `worker-shift-coverage-effects` | No separate deployed counterpart observed; bind any owning runtime and retained work before claiming closure. |
| `worker-shift-coverage-push` | Same; empty current work collections do not prove absence of an external invocation. |
| `trigger-on-shift-planning-request-created` | Exact shared/private capture pair reviewed. Current delivery cannot invoke original develop callback; earlier business invocations remain independent. |
| `trigger-on-versioned-shift-planning-request-created` | No counterpart in reviewed deployment inventory; preserve bounded absence and authority check. |
| `trigger-on-shift-written` | Exact capture pair reviewed. Old Sheets/notification effects remain separate; import-origin callback exits explain only the observed import. |
| `trigger-on-delivery-calendar-override-written` | Exact capture pair reviewed. Probe updatedCount0 is not a terminal proof for older calendar updates. |
| `trigger-on-notification-event-created` | Exact capture pair reviewed. All 117 historical notices remain possibly delivered and unreplayable. |
| `firestore-client-membership-fairness` | Develop Rules deny writes; activation must still bind current planning fields/cohort. |
| `firestore-client-planning-config` | Develop Rules deny writes; activation must still bind exact configuration/version. |
| `https-resolve-authorized-member` | Reviewed closure includes develop reviewer routing; bind activation projection again. |
| `https-upsert-member-by-admin` | Reviewed develop 503; preserve server/activation rechecks. |
| `https-clone-global-config` | Archived original reads develop config and writes production config. It is not a develop mutation in that body. Keep inventory identity and revalidate actual deployed source; never invoke it for this check. |
| `https-config-maintenance-writers` | Five marker endpoints and two validators reject requests affecting develop; bind source/configuration and current activation projection. |
| `iam-firestore-admin-and-server-writers` | Shared privileged identities remain. Rules do not constrain them; automated uses and old effects require technical evidence. |
| `workbook-human-and-offline-editors` | Exact effective ACL and offline-editor closure remain to bind; prior agreement windows have expired. |
| `workbook-apps-script-and-addons` | Maintainer declares only apps/actions here; retain declaration and exact file/control scope, not a claim of visibility into every account. |
| `workbook-api-oauth-and-service-accounts` | Identify/restrict actual non-owner writers during the window; earlier API submissions remain independent. |
| `workbook-shared-drive-and-admin-authority` | Effective location/inheritance/authority evidence needed; limited reader visibility is not absence. |
| `workbook-owner-retained-capability` | ADR-0021 permits a fresh named, scoped, time-bounded owner agreement; no current window commitment. |
| `develop-firebase-administrator-retained-capability` | ADR-0022 requires every identified human administrator's fresh agreement; it excludes automated credential use. |

## What the new provider read establishes

At 2026-10-29 09:41:56 UTC, metadata for 23 non-inspector services reports readiness
and 100% traffic to their reviewed revisions. Across the 20 services with history,
284 noncurrent revision resources have a RETIRED condition. Names were normalized
to the revision resource ID before excluding the 23 current revisions. This is
provider lifecycle metadata, **not** an invocation census or terminal receipt for
Firestore, Sheets or FCM submissions. No function was invoked by this inspection.

The previously measured 183 source documents, 12 classified probe captures and
16 delivery records remain the last reconciled census, not a new census obtained
by reading runtime metadata. Eight subscriptions had historical zero samples;
missing current samples remain UNKNOWN. No pull, acknowledge, seek or replay is used.

Private evidence: `2026-10-29-old-work-boundary/runtime-metadata-private.json`,
the reviewed legacy archive/body and earlier source/census/receipt manifests under
the HU-084 artifact directory. Raw identities, provider payloads and credentials
are not added to the repository.

## Next actions and stopping rules

1. Completed locally: accept ADR-0025 and implement/rehearse its narrow evidence
   branch as one group. This does not establish real business-work drain.
2. Resolve the remaining **business-capable** old work and automated authority by
   identified runtime/destination. Preserve the 117 historical notices without
   replay. Unknown outcomes do not require reconstructing every device receipt,
   but they cannot be treated as proof that a writer or external call has stopped.
   An unresolved case blocks admission or enters the existing scoped residual.
3. Bind workbook effective permissions, actual source policy, cohort/published
   dates and cursors; collect fresh owner/administrator window commitments only
   when those technical prerequisites are ready. Then rehearse/apply the separately
   authorized bounded migration and recovery with those exact inputs.

No claim that these three groups are three small cuts or that a date is guaranteed.
No live window, policy acceptance, migration, replay, native change or production
mutation occurs in this assessment. This is documentation/evidence work: validate
table completeness, bilingual alignment, local links and diff hygiene; reuse the
previous 73-test/build/lint result without reporting a new runtime test execution.

## Direct reminder admission closure prepared — 2026-10-29

ADR-0025 and its preceding observation work are committed and pushed as
`5f648963398d2e600f70129bc8fdec19317b77aa`. The following reminder correction is
new local work, not deployed or committed at this checkpoint.

Read-only inspection confirms the three `sendPendingOrderReminderSunday20`,
`sendPendingOrderReminderSunday22` and `sendPendingOrderReminderSunday23` Functions
remain ACTIVE with their reviewed original sources and runtime configuration.
Their Scheduler jobs are PAUSED, but each ready Cloud Run service still permits
its shared execution identity to invoke it directly. The original resolver selects
develop. Pausing the jobs therefore did not close this business-capable entrance.
A corrected log query used lowercase Cloud Run service names from 2026-10-28
22:00 UTC to the inspection: no matching entries returned. This is bounded log
coverage, not proof that earlier invocations or external submissions terminated.

The existing source preparer now supports `reminders3`. It wraps exactly the three
archived callbacks with the original environment resolver: any target set including
develop is rejected before original reads/writes, including mixed targets. It does
not redirect to production. Original non-develop callback bodies, schedules,
dependencies and runtime settings remain preserved. The archived scheduler SDK
returns HTTP **500**, not 503, for this rejected callback; the local real-SDK test
checks that contract. No real Function is invoked for the preparation.

Validation under Node22.23.4: Functions build/full lint, focused CJS lint, **15 local
and24 Firestore-emulator tests**, no failures or skips. For each reminder the
unmodified archived callback writes a synthetic reminder in the emulator, while
the wrapper rejects before any business port. Production-only fake-data runs
retain the original trace/effects. Missing/default/mixed target sets, changed source
bytes and invented max-instance settings are covered. Apps are unchanged.

### Exact proposed deployment

- Project `reguerta-9f27f`, region `europe-west1`; update only the three Functions
  above. All three Scheduler jobs must remain PAUSED; preserve all other21 Functions.
- Source ZIP SHA256:
  `f8827f509ca6d4bab29e025a0b78857097616dfbfe12d9bae2db40fb4cc653fe`.
  Six runtime files match the package manifest. Original archive SHA256:
  `98175ecc32c5c2e4b94c82df856aeadb9d804b38f625d9db4a2cd6b0871de1a5`.
- Use the Functions v2 source upload and PATCH with explicit `buildConfig.source`
  updateMask, preserving build options, runtime environment, IAM and Scheduler.
  Do not use Firebase CLI deployment for scheduled exports: this step must not
  reconcile or resume Scheduler jobs. The API's explicit field mask limits the
  requested fields ([official PATCH contract](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch)).
- Before upload/update, re-read all24 Functions, the three source/configuration
  bindings, jobs and service IAM; stop on drift. Retain a baseline for the other21.
  Apply sequentially, retain operation IDs and inspect any uncertain outcome before
  retry. Verify source bytes/provenance, effective runtime/IAM, ready traffic, jobs
  still PAUSED and the other21 unchanged. Do not invoke Functions or production paths.
- An unexpected change stops the sequence. Do not automatically restore a callback
  that can write develop. Record partial completion and keep maintenance closed.

Private packet: `2026-10-29-old-business-closure/reminder-package`,
`reminder-source-reviewed.zip`, `reminder-update-plan.json` and the authority snapshot.
No credentials, environment values or raw provider identities are committed.
Deployment needs a new explicit scoped authorization. This prepares closure of
**new admission only**: previous business calls, Sheets/FCM outcomes and shared
credential uses remain separate obligations. Keep `legacyUntracked=true`, all117
historical notices unreplayed and maintenance/migration NOT_READY. Workbook source
policy/permissions and fresh owner/admin agreements remain pending.

### Authorized deployment completed — 2026-10-29

After explicit authorization of the three Functions in `reguerta-9f27f`, all three
sequential `buildConfig.source` updates completed. Fresh reads verify ACTIVE/ready
revisions, 100% latest traffic and the exact reviewed source ZIP bytes for all three:

| Function suffix | Verified Cloud Run revision |
| --- | --- |
| Sunday20 | `sendpendingorderremindersunday20-00002-mec` |
| Sunday22 | `sendpendingorderremindersunday22-00002-niw` |
| Sunday23 | `sendpendingorderremindersunday23-00002-gel` |

All three jobs remain PAUSED with their complete metadata unchanged. Function
runtime/build options, environment and service IAM are preserved; the other 21
Functions retain their complete metadata. Google added only exact function/region
identity labels and an identity annotation to the updated Cloud Run services.
The verifier validates these values rather than ignoring arbitrary metadata drift.
No Function invocation, business-data write, Sheets write or FCM send was performed.

The first upload attempt failed before any deployment; an exact object GET returned
404. Reusing the signed URL with the pinned CLI's signed-upload header contract
succeeded and its generation was read back. Unordered provider `eventFilters` were
normalized only after proving identical contents; changed-content tests still reject.
Negative verifier checks also reject runtime, job, IAM and identity-label changes.
The unchanged application/package reuses the prior build/lint and 15 local/24 emulator
acceptance. This turn validates the real deployment, not a new application test run.

Private `authorized-deployment-result.json`, operation records and immutable source
readbacks under `2026-10-29-old-business-closure` retain the result. Source/docs remain
uncommitted after `5f648963`. This completes direct reminder admission closure only;
old business submissions/automated authority, workbook permissions/source policy and
fresh maintenance agreements still need evidence. `legacyUntracked=true`, all 117
historical notices unreplayed and maintenance/migration NOT_READY remain unchanged.
