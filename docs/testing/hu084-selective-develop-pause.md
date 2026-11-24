# HU-084: selective develop pause rehearsal

> **Policy update — 2026-10-28:** [ADR-0021](../decisions/0021-use-cooperative-owner-maintenance-for-shift-workbooks.md)
> accepts a bounded no-edit agreement with the named owner instead of technically
> removing their manual edit capability. Other writer, delivery, drain and
> notification controls, and `canApply:false`, remain unchanged. Historical results
> and physical-fence limitations below remain valid; implementation and live
> authorization are still pending.

Status: local design and rehearsal; **`canApply:false`**. This is not a deployed
pause or a migration checkpoint.

[Versión en español](../../docs-es/testing/hu084-pausa-selectiva-develop.md).

## Exact baseline and bounded scope

The reversible control preparation is delivered in `f105ca5c`. This follow-up
keeps #268/#269 and draft PR #278 open. It exercises the six audited legacy
callbacks against the exact deployed executable, not this branch's replacement
implementation. Its SHA-256 is
`405d00ce204f64565d553649e1786fb968818024bf437c250c73514f1ffc1883`;
the immutable source archive hash and provenance are recorded in the
[writer-control guide](hu084-develop-writer-controls.md).

Private source files, workbook identifiers and provider observations stay outside
Git. No default deployment configuration or normal Function exports are changed.
All Firestore execution is restricted to a fixed demo project and loopback
emulator. In the local pause suite, Sheets and FCM are recording ports; no real
messages are sent. The separate real Sheets experiment below touches only its copy.

## Required behavior

- Exactly resolved `production` executes the captured callback without reading or
  writing the pause ledger. Compare positive callback effects with its baseline.
- Exactly `develop` uses durable admission. Missing state denies admission;
  unknown or case-variant environments fail before I/O. Legacy configuration
  lowercases environment keys, so an approximate environment parser is unsafe.
- Closing rejects new develop HTTP work. Trigger deliveries are acknowledged as
  retained only after their identity and payload are stored durably. A duplicate
  must not overwrite an uncertain or conflicting delivery.
- An admitted operation remains active until its effects are accounted for.
  Submission without a confirmed acknowledgement leaves uncertainty even when a
  legacy callback catches the exception. A `finally` decrement is not drain proof.
- Zero new active operations does not account for work admitted before the bridge
  existed. Unknown legacy in-flight work and retained/uncertain deliveries prevent
  a closed checkpoint. Elapsed time cannot clear these blockers.

The rehearsal has no automatic replay/reopen path and is not connected to
`closeAndCollect`. Resumption and reconciliation need a later governed operation.

## Accepted local validation

On Node 22.23.4, Functions build/lint and both focused CJS syntax checks pass.
The isolated Firestore suite has **20 passes, zero failures/skips**. Each of the
six original production callbacks has a successful business-result assertion,
equal trace/stored images and no journal construction or effect admission,
including a nested develop context. The suite also rejects changed source bytes,
checks the deployed resolver, missing state, concurrent pause/admission, retained
events and changed duplicates, caught mutation errors, a lost acknowledgement
after an actual Firestore commit, and unfinished/late effects.

From `functions`, provide the private audited executable as
`HU084_DEPLOYED_LEGACY_JS` and run the existing isolated emulator configuration:

```sh
firebase emulators:exec --config ../firebase.develop-writer-controls-emulator.json \
  --project demo-reguerta-writer-controls --only firestore \
  'GCLOUD_PROJECT=demo-reguerta-writer-controls METADATA_SERVER_DETECTION=none node --test --test-concurrency=1 test/develop-legacy-pause-rehearsal.emulator.test.cjs'
```

The final run is retained privately with source/commands and build/lint/TAP logs.
The emulator is stopped. An initial positive fixture incorrectly expected twelve
market months; the exact legacy algorithm defines ten. Its failed run is retained
and the corrected positive assertion passes. This preserves a legacy behavior;
it does not change or approve the future planner's seasonal requirements.
Native sources are unchanged, so their accepted gates are reused. Exact JS under
local SDK/recording ports does not prove every branch or deployed runtime binary.

## Remaining live design constraints

The deployed triggers use `DO_NOT_RETRY`. If durable retention itself fails, merely
throwing can lose the event. Enabling retries globally would also change
production's non-idempotent dispatcher. A real bridge therefore needs a proven
develop delivery handoff and old-in-flight reconciliation before deployment;
this local rehearsal cannot establish either.

Compiled inventory v3 has four public client writers, while the captured Rules
also allow private planning/coverage and legacy writes. The all-develop deny is
physically broader, but it does not reconcile the accepted inventory revision or
digest. That remains an explicit prerequisite to barrier admission.

## Accepted Sheets copy mechanism test

The authorized real experiment used a new private native Google Sheet with six
copied tabs and one dedicated canary tab. The original develop workbook and
production are unchanged. It followed the
[copy-only preconditions and reversal sequence](hu084-develop-writer-controls.md#conditional-content-lock-rehearsal):

1. The owner's actual metadata response confirmed ownership, permission to set an
   owner restriction and no previous restriction. Both the owner and a separate
   service-account writer successfully wrote their canaries through Sheets, then
   restored their baseline values before the lock.
2. The owner set `readOnly:true`, `ownerRestricted:true` and a unique operation
   reason. Actual Drive responses captured the full restriction post-image and
   the owner's effective removal capability. Both previously successful Sheets
   write paths then returned 403, with their baseline cells unchanged.
3. The service account made a successful Drive metadata probe before attempting
   removal. This was a same-value application-authorization probe using personal
   `starred` metadata; it does not prove the editor role. The accepted unlock attempt was
   denied with 403 `insufficientFilePermissions`. Earlier `appNotAuthorizedToFile`
   failures were excluded from lock-denial evidence.
4. Fresh full restriction reads matched the captured post-image for the same
   principals before reversal. The owner removed only this operation's matching
   restriction; the response returned zero restrictions. Both Sheets canaries
   succeeded again and were restored to baseline.

Four captures—initial baseline, immediately before locking, while locked and after
restoration—contain the same selected spreadsheet/sheet metadata and
`userEnteredValue`/`userEnteredFormat` cell data across all seven tabs. Independent
canonical digest recomputation matches in every capture:
`6c41bce8243c01641b0a27bcc28a306946962d46a994bdfbc544c265fb25b95a`.
This verifies those captured images, not every possible Drive property or an
immutable file history. Detailed provider responses and identifiers remain private.

The connector cannot return complete Drive restriction metadata or change it.
The maintainer separately authorized temporary owner `drive.metadata` access and
then `drive.file` access through Google OAuth Playground, using **Open with** for
this copy. Metadata scope alone was insufficient; no full-Drive owner grant was
used. The separate keyless test service account required the full `drive` OAuth
scope, but its file ACL, hardcoded request allowlist and test operations covered
only this copy; it had no project data roles. Its copied-file grant was removed;
the final file ACL contains only the owner and the service-account file read
returned 404. Its exact temporary IAM binding was removed and the account was
disabled. Final read-back confirms zero direct bindings, user-managed keys and
project data roles; an actual new-token request is denied with 404 (account
disabled). The temporary owner OAuth connection was removed, both previous
sessions return 401 and both Playground token/request fields were cleared.
No reusable credential is included in repository evidence.

The mechanism and its reversal pass on the copy. `canApply:false` remains: the
owner can still remove a restriction, and a whole-file lock also blocks the
intended runtime. This does not prove a held owner fence or a gap-free handoff to
the governed writer, and does not authorize applying the control to the real file.

## Administrator contract and remaining server ingress — 2026-10-28

Source delivery `e29b6bdd` contains the accepted live develop client Rules and
ADR-0022 policy. The next grouped implementation keeps the strict v1 and
owner-only v2 contracts unchanged. Explicit v3 adds the named human administrator
agreement to the existing intake CAS, immutable evidence/incident paths and Sheets
batch receipts. It requires every named confirmation, exact operation/source/IAM/
technical-control digests and fresh reports; withdrawal, activity, expiry or drift
blocks progression. Retained human capability is recorded as cooperative, never
as a technical IAM fence. Automated credentials/workloads still need technical
controls. No real participant agreement or maintenance window is manufactured.

The remaining nine deployed HTTP handlers are prepared as two exact-source packs:
eight legacy handlers and the newer `resolveAuthorizedMember` separately. The
reviewed existing HTTP targets are `onProductWrite`, `onContainerWrite`,
`onMeasureWrite`, `onUserWrite`, `onOrderWrite`, `upsertMemberByAdmin`,
`validateGlobalVersionPolicy`, `validateGlobalFreshnessConfig` and
`resolveAuthorizedMember`, all in `europe-west1` of `reguerta-9f27f`. There are
zero new/deleted Functions and no permission change in this package. Both
preserve their archived lock, original callback bodies, runtime identity/options
and environment. Direct develop requests stop before business I/O; effective
reviewer routing to develop stops after existing auth/config resolution but before
member work. The two global validators reject an entire default/mixed request
containing develop; explicit production requests retain the original path.
The actual legacy SDKs load both packs with exactly eight/one exports, no reset
sentinels, and config/source hashes bind the reviewed selectors. The branch's
application index must never replace these shared deployments.

The maintainer authorizes pausing exactly the three develop-only Sunday reminder
jobs. The first pause succeeds; Cloud Scheduler also changes `userUpdateTime`,
which the original guard treated as configuration drift, so the runner correctly
stops before attempting the other two. Read-only reconciliation preserves the
first receipt and confirms unchanged semantic config/Functions/IAM and two
untouched enabled jobs. A separately sealed continuation permits one attempt per
remaining job, retains the first PAUSED state and compares non-target revision
stamps plus the target response/postimage. Neither job pause nor HTTP closure
certifies earlier invocations or external outcomes as drained.

The final joint gate passes Functions build/full lint, 400 planning tests and a
separate 228-case controls/regression run, with zero failures/skips. The emulator
is stopped. The latter includes v3 admission/Sheets incidents, older modes, exact
HTTP production equivalence and develop denial, Rules and intake regression.

**Accepted Scheduler result:** all three jobs are PAUSED with three total pause
attempts (one original and two continuation calls). Fresh before/after reads
verify unchanged semantic job configuration, Function sources/options and IAM.
The continuation passes independent review and 9 local tests/28 scenarios,
including snapshot expiry after journaling and missing/invalid token expiry.
No automatic retry/resume occurs; the first job is never resubmitted.

**Accepted HTTP result:** the maintainer separately authorizes the nine existing
updates in `reguerta-9f27f`. Exact eight/one selectors deploy successfully; all
nine immutable deployed archives match their reviewed runtime file sets/hashes.
Source references, runtime options, identity, environment/secrets, IAM and latest
traffic are read back; the other fifteen Functions preserve their configurations.
The first eight leave sixteen Functions unchanged; the final one leaves twenty-
three unchanged, including those eight accepted revisions. No Function is created
or deleted and no permission is changed.

The real negatives return seven application 503s. `onContainerWrite` and
`onMeasureWrite` retain their existing private IAM policy and return gateway 403
before entering the callback. The initial probe expected all 503 and stops at
that existing 403; its receipt is preserved. A bounded continuation accepts only
those two pre-existing IAM denials, does not repeat either completed request and
checks the remaining seven endpoints. No IAM grant or credential impersonation
is introduced to force a callback test. Those two callbacks are verified through
exact deployed bytes and emulator behavior, not a live authorized invocation.

Final read-only inspection confirms the three PAUSED jobs, their unchanged source/
configuration/IAM, the accepted client Rules hash, and identical captured payloads
for all 183 business documents/twelve journal events. Shared maintenance/migration
remains closed with `legacyUntracked:true`: real complete participant commitments,
automated authority and earlier effects still need their own evidence. No
production business, Sheets or FCM operation occurs. Native apps are unchanged;
the maintainer authorizes this source delivery; exact commit/remote evidence is
recorded in #268/#269 and draft PR #278.

The subsequent [prior-operation reconciliation](hu084-develop-legacy-reconciliation.md)
classifies the observed set with exact probe receipts and bounded provider evidence.
Historical uncertainty remains separate from current executable work; the completed
investigation does not admit maintenance or migration.
