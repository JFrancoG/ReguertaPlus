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
