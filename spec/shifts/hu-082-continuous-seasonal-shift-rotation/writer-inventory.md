# HU-082 affected-writer inventory

## Scope and authority

This inventory records every current ingress, delivery, or independent authority
that can mutate public shift state, enqueue that mutation, or write the bound
workbook. It also records six logical membership/configuration fairness-input
writers that may remain open only when activation rechecks their version in its
transaction.

The compiled source of truth is
`functions/src/shift-planning-writer-inventory.ts`, schema version 1 and revision
`hu082-affected-writers-v1`. Its canonical digest is part of every intake-barrier
evidence packet. An unknown, missing, duplicated, or newly introduced writer
invalidates that evidence; editing this document alone cannot expand the runtime
inventory.

The repository default deployment configuration currently points at
`firestore.phase1.rules`. Its authenticated catch-all permits legacy writes to
the affected public collections. The stricter local candidate still permits
direct admin writes to `shifts` and `deliveryCalendar`. Neither file therefore
constitutes the HU-082 intake barrier. This is repository evidence, not a fresh
read-back of the shared Firebase project.

## Barrier writers

| Writer ID | Current evidence | Affected target | Required disposition |
|---|---|---|---|
| `firestore-client-shifts` | Android `FirestoreShiftRepository.upsertShift`; iOS `FirestoreShiftRepository.upsert`; Phase 1 catch-all; strict admin write | `shifts` | `rules-deny` before causal capture; migrate any future manual edit to a versioned command |
| `firestore-client-delivery-calendar` | Android/iOS `FirestoreDeliveryCalendarRepository` upsert/delete; active admin UI | `deliveryCalendar` | `rules-deny` before causal capture; replace with epoch/revision-bound backend command |
| `firestore-client-shift-planning-requests` | Android/iOS planning-request repositories and admin UI | `shiftPlanningRequests` | `rules-deny` before causal capture; the legacy request must not enter while maintenance starts |
| `firestore-client-shift-swap-requests` | Phase 1 catch-all permits a direct path although current clients use HTTP | `shiftSwapRequests` | `rules-deny` before causal capture |
| `https-sync-shifts-from-google-sheets` | `syncShiftsFromGoogleSheets` and `syncShiftRowsIntoFirestore` | Sheets to `shifts` | Disable ingress before causal capture and drain; HU-083 replaces this non-atomic writer |
| `https-export-shifts-to-google-sheets` | `exportShiftsToGoogleSheets` | `shifts` to workbook | Disable ingress before causal capture and drain; HU-083 owns the command/lease consumer |
| `https-transition-shift-swap` | Android/iOS HTTP clients and `transitionShiftSwap` | `shiftSwapRequests`, assignments, helpers and shift status | Disable ingress before causal capture and drain accepted requests; then migrate to a server transaction that checks epoch/revision |
| `trigger-on-shift-planning-request-created` | Legacy trigger and `persistPlannedShifts` | request, workbook and `shifts` | Drain only the causally captured accepted set, then disable the delivery |
| `trigger-on-shift-written` | Firestore trigger, workbook write, `syncMeta` write-back and notification | `shifts`, workbook | Drain captured events and cascades, then disable the delivery and prove its queue empty |
| `trigger-on-delivery-calendar-override-written` | Firestore trigger, workbook rewrite and notification | `deliveryCalendar`, workbook | Drain captured events and cascades, then disable the delivery and prove its queue empty |
| `trigger-on-notification-event-created` | `onNotificationEventCreated`, `dispatchNotificationEventGeneric` and `fanOutNotificationInbox` | Notification delivery | Isolate delivery causally attributable to HU-082 before capture without disabling unrelated notification producers; if that isolation cannot be proved, abort or introduce a governed bridge/full fence |
| `iam-firestore-admin-and-server-writers` | Unmanifested Admin SDK use, console, CI, scripts, jobs, keys, workloads and inherited IAM outside separately controlled runtime writers | Database-wide, including fairness inputs and backend-only planning state | Fence/revoke and audit effective authority; Rules do not constrain it, and allowlisted runtime writers remain governed by their own controls |
| `workbook-human-and-offline-editors` | Owners/editors and pending offline edits | Workbook | Fence authority, confirm online/closed/no pending edits, then read back |
| `workbook-apps-script-and-addons` | Apps Script triggers/deployments and add-ons | Workbook | Fence authority and prove absence of continuing executions |
| `workbook-api-oauth-and-service-accounts` | Sheets/Drive API clients and service accounts | Workbook | Fence authority and prove the allowlisted runtime is not yet writing |
| `workbook-shared-drive-and-admin-authority` | Shared Drive automations, transitive groups/domain, DWD and Workspace admin paths | Workbook | Fence effective authority and audit it, not only the direct ACL |

Internal helpers are owned by their entrypoint. For example,
`persistPlannedShifts` closes with its planning trigger and
`syncShiftRowsIntoFirestore` closes with its HTTP import; treating them as
independent controls would create false evidence.

## Version-rechecked fairness writers

These writers are in the full inventory but not in the intake-barrier control
list. A future activation may leave them open only if its candidate contains the
relevant input version/digest and the same atomic activation transaction reads
and rechecks it. That guard is still pending.

| Writer ID | Fairness input | Required disposition |
|---|---|---|
| `firestore-client-membership-fairness` | Direct membership and eligibility changes still admitted by current Rules | Bind the membership/eligibility revision to preview and candidate; reject activation drift |
| `firestore-client-planning-config` | Direct planning-configuration changes still admitted by current Rules | Bind the configuration revision to preview and candidate; reject activation drift |
| `https-resolve-authorized-member` | First-login `authUid`, normalized-email and timestamp metadata on a member document | Exclude authentication-only metadata from the canonical fairness projection and test that invariant; otherwise its write must advance/recheck membership input version |
| `https-upsert-member-by-admin` | Active membership, real-producer role and common-purchase-manager eligibility | Bind membership/eligibility revision to preview and candidate; reject activation drift |
| `https-clone-global-config` | Delivery weekday and other planning configuration | Bind configuration revision to preview and candidate; reject activation drift |
| `https-config-maintenance-writers` | Validation, maintenance-trigger and timestamp writes that can change planning configuration | Bind the exact configuration revision to preview and candidate; reject activation drift |

If any such input lacks a version that activation can recheck atomically, its
writer must join the external fence instead of being assumed safe.

## No-gap evidence order

1. Deploy the exact temporary Rules deny for all four client surfaces, disable
   pre-capture HTTP ingress, isolate HU-082-causal notification delivery, and
   fence every independent Firestore/workbook authority. Take matching initial
   read-backs of Rules and every pre-capture control.
2. Capture the exact accepted causal set only after those controls read back as
   closed, then drain that set while its three mutation deliveries remain
   enabled.
3. Disable those post-drain deliveries, take their matching initial read-backs,
   and read every affected work/delivery queue as zero pending and in-flight.
4. Capture the exact workbook revision/digest after that initial queue read-back
   and start the policy-bound quiet horizon only afterwards.
5. After the quiet horizon ends, take final matching read-backs of Rules, every
   writer control, all causal/delivery queues, and the workbook. Mutation and
   queue counts must remain zero, and every final observation must be no later
   than `verifiedAtMillis`.
6. While every fence remains held, the external control-plane flow builds and
   explicitly authorizes the exact Rules revision/digest, control-manifest
   digest, workbook file/revision/digest, causal-set revision/digest, and timing
   policy. It then invokes the adapter with that already-authorized checkpoint.
7. Inside the adapter-provided held-fence callback, verify the packet, retain it
   under the stable `environment + transitionId` key, read back and reverify the
   full envelope, then start `enterMaintenanceWithBarrierEvidence` before
   expiry. Retention creates when absent, replays only an identical digest, and
   fails on a key collision; it never overwrites evidence. The coordinator
   exposes no reopen capability. The production-shaped local adapter additionally
   verifies one immutable held checkpoint before and after the callback and
   journals any failure under the same transition while the controls remain
   closed. The future real control-plane bindings are contractually responsible
   for holding every fence until the Firestore transaction resolves and for
   keeping fences closed on every failure; rollout validation must prove that
   behavior.

The local verifier binds this packet to environment, transition ID, the complete
maintenance CAS, expected Rules artifact, exact workbook file ID, inventory
revision/digest, evidence-age policy, causal drain, and quiet horizon. Evidence
expires at the oldest of the quiet-horizon end and all final Rules, writer,
queue, and workbook observations plus the maximum evidence age. Both verifier
passes and the trusted clock sampled inside the Firestore transaction callback
must occur by that instant. This is an admission-attempt deadline, not a claim
about the physical server commit time; the held external fence covers commit
latency. The compact
`{revision, digest, verifiedAtMillis}` stored in maintenance state is only the
digest pointer to that retained audit packet; `intakeBarrierExpiresAtMillis`
belongs to the immutable entry intent and gates transaction-attempt admission.
Before applying freshness, the coordinator looks up terminal transition
evidence. A missing transition requires both fresh checks; an exact terminal
transition reads the already-retained envelope in `existing-only` mode and may
replay after expiry, but missing historical evidence is never recreated. Current
state ownership is still rechecked before accepting that replay.

## Explicitly pending

- Real control-plane bindings that read and hold Rules, IAM,
  Eventarc/Functions delivery, Drive/Workspace, editor, and workbook state. The
  repository contains only the injected no-reopen adapter and its local tests.
- Temporary barrier Rules and all shared deployment/read-back.
- Disabling or draining any live endpoint, trigger, principal, queue, or editor.
- Epoch/revision migration of mobile and backend writers.
- Atomic activation/recovery and any governed reopen.
