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
`firestore.phase1.rules`. Both local Rules candidates now keep their existing
`deliveryCalendar` and `shifts` read contracts while denying every direct create,
update, and delete; the Phase 1 catch-all explicitly excludes both collections.
Other affected public surfaces remain admitted, so neither file yet constitutes
the complete HU-082 intake barrier. This is repository and emulator evidence,
not a deployment or fresh read-back of the shared Firebase project.

## Barrier writers

| Writer ID | Current evidence | Affected target | Required disposition |
|---|---|---|---|
| `firestore-client-shifts` | The unused Android/iOS upsert capability has been removed from Domain, Data, in-memory/chained repositories, and test doubles. Both local Rules candidates retain their intended reads but deny every direct create/update/delete; emulator coverage rejects old admin/authenticated clients in both environments | `shifts` | Keep every real mutation in an authenticated, fenced backend workflow; deploy and read back the exact deny only inside the no-gap activation procedure |
| `firestore-client-delivery-calendar` | Android/iOS production composition routes every upsert/delete through `resolveDeliveryCalendarMutationContext` + `transitionDeliveryCalendarOverride`; reads remain server-only Firestore reads. Both local Rules candidates now deny every direct create/update/delete, and emulator coverage rejects old creates plus stale/offline updates and deletes in both environments while retaining their intended reads | `deliveryCalendar` | Keep the command as the only mobile mutation path; deploy and read back the exact deny only inside the no-gap activation procedure |
| `firestore-client-shift-planning-requests` | Android/iOS planning-request repositories and admin UI | `shiftPlanningRequests` | `rules-deny` before causal capture; the legacy request must not enter while maintenance starts |
| `firestore-client-shift-swap-requests` | Android/iOS retain server-only Firestore reads and route every mutation through `transitionShiftSwap`. Strict and Phase 1 local Rules candidates preserve their intended reads while denying every direct create/update/delete | `shiftSwapRequests` | Keep the authenticated HTTP transition as the only mutation path; deploy and read back the exact deny only inside the no-gap activation procedure |
| `https-sync-shifts-from-google-sheets` | `syncShiftsFromGoogleSheets`; after the read-only Sheets phase it captures the exact open planning authority, then every upsert and stale imported-shift deletion transaction revalidates it, reads the exact shift notification fence, and rechecks stale-delete ownership | Sheets to `shifts` | Keep both guards, but disable ingress before causal capture and drain; authority drift stops remaining writes, while the multi-shift import stays partially applicable and HU-083 replaces this non-atomic writer |
| `https-export-shifts-to-google-sheets` | `exportShiftsToGoogleSheets`; after its read-only Firestore/member/config phase it captures the exact open planning authority, revalidates immediately before every external `update`/`append`, and checks once more after the final Sheets request | `shifts` to workbook | Keep the compatibility guard, but disable ingress before causal capture and drain; authority drift stops remaining rows, while Sheets stays partially applicable and HU-083 owns the command/lease consumer |
| `https-transition-shift-swap` | Android/iOS HTTP clients and `transitionShiftSwap`; create captures the exact open planning authority, respond/apply revalidate it transactionally, and apply reads every changed shift's notification-resource fence | `shiftSwapRequests`, assignments, helpers and shift status | Keep both guards; disable ingress before causal capture and drain accepted requests. Missing state remains legacy-compatible only before v2 state exists; any maintenance/epoch/active-lineage transition invalidates the request |
| `trigger-on-shift-planning-request-created` | Legacy trigger; immediately before its workbook write it captures the exact open planning authority, then each `persistPlannedShifts` upsert and its final notification transaction revalidate it; shift upserts also read the exact notification fence | request, workbook, `shifts` and notification | Keep both guards, drain only the causally captured accepted set, then disable the delivery; authority drift stops remaining Firestore effects, while its workbook-first flow stays non-atomic and requires HU-083 replacement |
| `trigger-on-shift-written` | Legacy Firestore trigger; after read-only setup it captures the exact open planning authority, revalidates immediately before its Sheets mutation and after the request, then atomically writes `syncMeta` plus the notification only after revalidating authority, the exact shift notification fence, and unchanged source state | `shifts`, workbook and notification delivery | Keep the compatibility guards, drain captured events and cascades, then disable the delivery and prove its queue empty; Sheets remains non-atomic, and HU-083 still owns governed-event suppression plus idempotent ledger integration |
| `trigger-on-delivery-calendar-override-written` | Firestore trigger; when a matching delivery exists it captures the exact open planning authority before Sheets, revalidates before every external row and after the final row, then revalidates transactionally before notification creation | `deliveryCalendar`, workbook and notification | Keep the compatibility guard, drain captured events and cascades, then disable the delivery and prove its queue empty; Sheets remains non-atomic. The local direct-client deny must be deployed and read back before causal capture |
| `trigger-on-notification-event-created` | `onNotificationEventCreated`, `dispatchNotificationEventGeneric` and `fanOutNotificationInbox`; the local candidate now reads the backend-only canonical release receipt first | Notification delivery | Keep receipt-free events on the legacy path; reserve exact receipt-bound HU-082 events for governed dispatch and fail closed on present malformed/drifting evidence. Deployment, causal drain and live proof remain HU-085 gates |
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
| `https-upsert-member-by-admin` | Active membership, real-producer role and common-purchase-manager eligibility; its transaction now reads the member notification-resource fence | Preserve the dispatch fence, bind membership/eligibility revision to preview and candidate, and reject activation drift |
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
- Atomic activation/recovery and any governed reopen. The local measured v2
  forward/inverse transaction adapter already reads every exact public-shift
  notification fence before sealing its batch; the remaining work here concerns
  full maintenance/release ownership rather than dispatch-writer serialization.
