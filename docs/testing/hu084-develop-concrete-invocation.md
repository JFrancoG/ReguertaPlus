# HU-084 — Concrete develop invocation preparation

Status on 2026-11-01: **prepared, not executable or ready for window authorization**.
The previous adapter implementation is committed/pushed as `5b24be80`. This document
and the refreshed private preparation are the next local block. No runtime source,
permission, maintenance state or production data changes in this block.

## Exact preparation

Private evidence directory: `2026-11-01-concrete-develop-preparation`.
`packet/manifest-private.json` pins the input files; `operator-invocation-private.json`
pins 333 runtime/source/package files and names the existing entry points, writer,
permission actions and recovery obligations. It contains no credentials. Its scope,
binding, receipt ID, window and execution authorization remain null.

| Binding | Value |
| --- | --- |
| Project/database/namespace | `reguerta-9f27f` / `(default)` / `develop/plus-collections` |
| Workbook | `1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A`, version `287` |
| Review package digest suffix | `729e04e5d617d1b8f` |
| Prepared digest suffix | `b3ab962549d061b` |
| Forward operation | `request-hu084-initial-68e09b87cef3ef75a357` |
| Inverse operation | `hu084-inverse-68e09b87cef3ef75a357` |
| Proposed effects | 203 forward Firestore writes; 53 helper cells and two markers; separately admitted inverse of 140 Firestore writes |

Full digests and exact cell/Firestore intents are retained in the private packet.
Refreshing evidence regenerates operation IDs under the existing algorithm, even
when business intents are identical. The former `e4d3844bd0b26308f126` operations,
old bindings and test receipts must not be mixed with this packet. Historical writer,
copy-cycle and inverse receipts remain supporting evidence with their original ages;
they do not become authorization for these new operations.

## Observations renewed in this block

- Firestore census at `2026-11-01T20:47:54.110Z`: all 14 reviewed collections,
  singleton documents and retained capture/delivery/chunk records exactly match the
  earlier snapshot, including service versions. There are 62 shifts, 48 projected
  users, four calendars, three config documents and 117 notices. Initial planner,
  membership, reserve and credit authority remains absent. No unrelated legacy
  `collections` namespace or production documents were read.
- Cloud control read at `2026-11-01T20:49:27.767Z`: 24 Function configurations,
  three paused jobs, Rules, project IAM and invoker policy match the complete reviewed
  baseline. Six indexes are READY. The writer remains disabled, without user keys
  or own IAM bindings, and absent from the complete checked runtime inventory.
- Owner read at `2026-11-01T20:50:39.677Z`: two full independent six-tab images and
  two bounded images agree; complete cells/format/notes/metadata and Drive version
  match the previous observation. Owner plus four readers, no writer; parent ACL
  remains owner-only. Only the parent's human-readable label is retained from the
  earlier observation; identity, owner and permissions were queried anew.
- Owner OAuth was Online without refresh. Revocation returned 200; the same token
  returned 401 from both Drive and Sheets after 62.383 seconds. Intermediate Sheets
  200 responses were retained, not treated as verified closure. Temporary local
  credential file was removed before reading; the browser fields were cleared.
- The real executor's passive admission check performed one read-only Firestore
  transaction, zero control acquisitions and zero writes. Source matches; it rejects
  with `window_scope_missing`, as expected. This is not a passed live admission.

The first Cloud comparison selected an older baseline whose invoker-policy read had
failed. It was rejected, not accepted as control evidence. The successful comparison
uses the later complete, already reviewed baseline; remote configuration was not
changed. All read times stay distinct. These observations are preparation evidence,
not a promise of freshness at a future execution time.

## Concrete composition and remaining ports

Use the existing implementations in this order after all missing inputs are reviewed:

1. Load and verify the pinned manifest, materialized preparation and code hashes.
2. Supply the explicitly authenticated, project-scoped Firestore instance to
   `createControlledDevelopBarrier`, with a real `openObservationSession` and clock.
3. Supply that barrier's `controlPlane` and `failurePersistence` to
   `createControlledDevelopMigrationExecutor` with the same preparation and client.
4. Bind the complete verified scope, actual window and direction using `bindWindow`.
   The observed source digest is the executor's authoritative-source digest; it is
   not interchangeable with the preparation's legacy-source digest. Likewise, a
   full preservation snapshot hash is not automatically the barrier workbook hash.
5. Supply the exact binding and receipt authorization, explicit in-memory owner/IAM
   credentials, reviewed native owner channel, barrier and executor to
   `createOriginalWindowSessions`. Call `runControlledWindow` once. Its normal path
   owns grant/enable/mint, acquisition, admission, one joint direction and cleanup.
   A pre-grant batch plan never bypasses the post-grant version/permission checks.
6. On interruption, use `recoverControlledWindow` with the retained binding and a
   separately reviewed cleanup session. It only inspects and contains owned access;
   it cannot replay a write, mint another writer token or run the inverse. Missing
   credential/closure evidence keeps the root fence. Inverse needs its own admitted
   scope, current source and exact forward receipt/plan.

**Remaining technical connection:** the normal Google lifecycle now has concrete
adapters, but the barrier's `openObservationSession` still receives synthetic
complete evidence in the emulator composition. The standalone real Cloud/owner
readers return observations, not the complete administrator-agreement evidence.
Connect their readbacks, the reviewed causal/historical-risk packet and actual human
agreements to the existing barrier verifier. Do not copy a test fixture, stamp old
observations with a new time, infer queue drain from samples or replace unknown
counters with zero. Every observation lease must settle and close without revoking
another still-needed session's credential. Bind all real observation HTTP to the
same window budget when opening the session; do not create a second clock/budget.

**Remaining operator binding:** native Drive grant/removal callbacks must identify
this original file and exact writer, call the supplied `assertActive` immediately
before the final UI mutation, await completion and retain the result. No read-only
OAuth scope authorizes a Drive permission API write. The callback interface is
implemented and tested; an actual reviewed browser binding is not frozen yet.

Group those connections and their timing checks in the next block. Only afterward
freeze the resulting complete scope and request execution authorization, including
owner/operator/all-admin commitments and the operation-specific ADR-0026 binding.
The previous confirmation that both administrator accounts belong to one person
identifies participants; it does not confirm a future window.

## Time and permission limits

Use the existing ten-minute budget, not the superseded provisional 20+20-minute
reservation: preparation at most 180 seconds (including minimum 120-second IAM
propagation); work at most 150 seconds **including barrier acquisition/admission**;
file/IAM/OAuth cleanup reserves of 60/90/120 seconds. One 300-second writer token.
Submission still requires its existing work/token headroom. No implicit extension.
The synthetic copy cycle and local emulator do not prove joint real-service latency.

The permission proposal remains one direct Editor grant on this develop file,
reactivation of writer UID `110752956317536684858`, and one conditional
`roles/iam.workloadIdentityUser` grant to `user:drpuerk@gmail.com` on that account.
No keys, project role, runtime identity assignment, Rules/Function/job update or
FCM send. Removal, explicit disablement, readbacks and same-token denial remain
mandatory parts of the future separately authorized attempt.

## Validation and delivery boundary

Validation completed: **82 local tests and 90 emulator cases passed, zero failures/skips**. Five concrete journals were independently re-read; the interrupted-process case correctly retains its inspection-required fence.

See the private validation summary for the final results on this renewed packet.
Previous source build/lint and 397-test evidence are reused only after exact hash
verification; this block changes documentation/private preparation, not runtime.
The package and original-file batch are rebuilt offline; the regenerated packet is
rehearsed with the existing emulator suite. The original dates/order, 117 notices
and guard documents remain protected. No native change or parity gap.

HU-084/HU-085 remain open and PR #278 draft. No sheet closure or further user action
is required now. Next: implement/verify the real barrier observation composition and
review the native permission callbacks together; then request the concrete window.
