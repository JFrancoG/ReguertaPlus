# HU-084 — Develop permissions and maintenance window preparation

Status: **preparation only; not scheduled or authorized for execution**. Original
writer evidence and admission integration are delivered in `d42ce7fe`. This plan
does not grant access, open maintenance, migrate data or activate either app.

## Google observations and joint batch rehearsal — 2026-11-01

The durable-barrier block is committed and pushed as `9ed3a9ef`; exact remote HEAD
was verified. The following readers, batch materializer and tests are local after
that commit. They reuse the existing Sheets adapter, preservation manifest and
Firestore barrier/transaction contracts; no additional operation ledger or live CLI.

`develop-google-observations.cjs` reads the fixed develop workbook and parent with
explicit credentials. It compares two complete grid captures (values, entered formats,
notes, text runs, validation, protected ranges, merges and operation metadata), plus
the two former A1:Z100/Y100 captures. The bounded projection must match the retained
review package. Google-omitted empty repeated arrays are normalized only for that
complete field mask; raw evidence and empty cell/format objects are preserved.
The reader also checks the exact 24 reviewed Functions, three paused jobs, Rules,
project IAM and inspection-invoker IAM. These reads do not supply runtime/key
inventory, current source/causal reconciliation or human window commitments.

The separately authorized read session observed original version **287**, owner and
four readers, no writer grant and unchanged reviewed controls. Measured samples:
owner capture **8,460ms**, Cloud reads **1,022ms**, owner OAuth cleanup **62,263ms**.
Revocation returned 200; Drive denied the same token immediately, while Sheets
returned 200 for six minimal probes and then 401. No refresh/new token was requested.
The access was revoked, fields cleared and Playground closed. These are individual
read/cleanup samples, not a combined migration deadline guarantee or writer-denial
proof. No IAM, file permissions or Google cells were changed in this block.

`prepare-develop-helper-batch.cjs` materializes exactly **53 F-cell updates and two
operation markers** through the existing adapter. The forward ID uses the existing
Firestore `request-` mapping; inverse uses its reviewed recovery ID. It binds the
package, raw observation, version, before-images, preserved notes and request digest.
The inverse verifies the complete expected after-image before preparing any write.
Managed formulas/protection, changed published cells, edited review, distant changes
or wrong markers reject. The time-only fence requires more than **150s** before both
token expiry and window end: the adapter's 30s request bound plus 120s cleanup reserve.
It grants no authority and never renews credentials or silently extends a deadline.

The joint rehearsal uses the actual newly captured grids and retained source package
with **Firestore emulator transactions and a stateful Sheets API double**. Durable
acquisition/admission, 203 forward/140 inverse document writes, 55/55 Sheets requests,
lost Sheets acknowledgement and read-only result reconciliation succeed. It restores
62 originals and all observed cell data, preserving 117 notices and guard versions.
Only the two expected technical markers remain updated. All 44 simulated observation
sessions close. If time expires or interruption occurs after Firestore commits but
before Sheets submission, the receipt remains, Sheets is unchanged and no automatic
inverse or retry runs. This explicitly does not provide cross-service atomicity.

Build/lint and syntax/diff checks pass: **247 focused +68 emulator tests**, zero failures
or skips. Private evidence: `2026-11-01-google-batch-integration`, including raw/normalized
captures, revocation probes and `joint-results/joint-sheets-roundtrip.json`. The initial
offline marker-normalization diagnostic is retained; no live write failed or ran.
Native code is unchanged; there is no platform parity gap.

Remaining grouped gate: compose these readers with the remaining current authority,
source/risk and participant observations; give the owner credential one explicit
window lifecycle (not one OAuth grant/revocation per barrier read); bind the existing
writer grant/removal lifecycle to this exact batch and rehearse the combined timing
on an explicitly reviewed isolated destination. Current A1 and ten-row copy runners
remain narrowly scoped and must not be repurposed silently. Their previous permissions
are not current grants. A real full-batch lifecycle, writer access withdrawal and its
timing are **not proven by this emulator**. Refresh/freeze the resulting package and
request the concrete permissions/window only when those checks pass. No maintenance,
production, FCM or deployment. No sheet closure or user action is needed now.


## Exact resources and participants

The only workbook is `1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A`,
“Regüerta — DEVELOP — Turnos de prueba”, owned by the test account. The separate
operator is the existing Firebase administrator account. The retained project IAM
inventory contains two human Owner principals. The maintainer confirms exclusive
control of both accounts; no second administrator needs to be contacted on that
basis. Private evidence retains the identities and confirmation. This is not a
commitment to the future window, and the IAM inventory must still be refreshed.

The future scope is the existing develop initial-migration package and its inverse,
not annual planning activation. Preserve published dates/order, all 117 notices and
the original 62 documents on reversal. Keep historical effects classified under
ADR-0026; do not replay notices or turn unknown counters into zero.

## Permissions to prepare, without granting them

| Resource | Proposed action for a separately authorized execution | Closure evidence |
| --- | --- | --- |
| Owner observations | Online `drive.metadata.readonly` and `spreadsheets.readonly`, no refresh; fixed file/parent metadata and two direct six-range reads | Revoke owner OAuth, same-token denial, clear fields and RAM references |
| Original workbook | Direct Editor for `reguerta-develop-sheets-writer` on this file only; preserve owner/four readers and parent ACL | Remove exact newly added permission; complete owner ACL readback and denial with still-valid writer token |
| Writer identity | Enable exact existing disabled service account; no keys, project roles or runtime assignment | Explicit disable plus independent identity/policy/runtime readback |
| Writer IAM | Conditional `roles/iam.workloadIdentityUser` for the exact operator, on this service account only | Remove exact owned member/condition, preserving unrelated policy entries |
| Firestore | Existing operator authority, restricted in the executor to the reviewed develop scope; no new IAM grant | Atomic source/version/manifest checks, retained forward/inverse receipts and closed controls |

IAM remains technically broader than the file-level restriction. Existing Firestore
Owner authority is also broader than develop; the scope is enforced by reviewed
adapters and the accepted administrator agreement, not an invented project-level
permission boundary. Do not reuse authorization from the completed writer probe.

The tested writer lifecycle uses at most 600s conditional IAM, at least 120s propagation
wait, one 300s token and 120s reserved for cleanup. These are **probe limits**, not proof
that a combined maintenance/migration sequence fits that budget. Do not extend them
or request another token implicitly.

## Concrete order before choosing the start time

1. Renew owner observations; compare two exact raw captures with the retained
   baseline. Bind current file version, complete ACL and parent to the package.
   Keep Firestore/control observation ages separate; owner reads do not refresh them.
2. Bind fresh provider observations to `controlled-develop-barrier.cjs`. Durable
   acquisition and its connection to admission have passed the local rehearsal below;
   live observation providers and a real window have not been exercised together.
   `controlled-develop-migration.cjs` still only consumes an already-held barrier;
   its passive check rejects a missing window.
3. Rehearse the combined provider/writer lifecycle and timing. The exact regenerated
   forward/inverse package already passes durable acquisition locally, including
   interruption and observation-session cleanup. Review the original-workbook batch
   separately: same-value A1 success proves access, not the 53 helper cells and two
   technical markers. Do not repurpose the copy-only runner for the original file.
4. Refresh technical controls, source census and retained causal-risk bindings;
   verify the exact writer/Firestore authority and byte-equivalent business intents.
   Freeze the resulting package, operation IDs, participant list and permission
   actions. Drift requires new review, not silent substitution.
5. Present one execution request covering those frozen actions and recovery. Only
   then collect the owner/operator/all-admin commitments with explicit start, end
   and recovery deadline. No sheet closure is needed for the current read-only work.
6. Inside the separately authorized window, acquire/read back the barrier, inspect
   admission and execute only its matching manifest while fresh. An expired or
   changed scope stops progression. An uncertain write is inspected through retained
   receipts; never blindly retry, replay notifications or reopen develop.
7. Complete the approved recovery/cleanup, verify original dates/order and exact
   access removal, retain receipts, and leave operational controls closed. Activation
   is a later, separate decision.

The earlier 20-minute work plus 20-minute recovery proposal remains a **provisional
reservation**, not a measured executable window. Start/end/recovery timestamps,
participant confirmations and execution authorization remain absent until the
composition and timing checks pass. Preparing this document cannot fill those fields.

## Durable acquisition rehearsal — 2026-10-31

`controlled-develop-barrier.cjs` composes the existing Firestore evidence/failure
repository and trusted administrator adapter with the controlled migration executor.
It pins the project, develop environment, closed source policy, prepared digest,
workbook revision, forward/inverse identities and historical-risk plan bindings.
Source/version reads bracket the first evidence collection. Subsequent technical,
owner and administrator readbacks verify the same scope; evidence is immutable.
There is no new journal, provider deployment, maintenance-state write or reopen API.

Acquisition writes only the existing barrier evidence/incident records. A reconstructed
composition reads the checkpoint from Firestore instead of trusting process memory.
A consumed evidence key is inspect-only: no automatic second acquisition. Historical
inspection never grants admission or renews an expired agreement. Admission and the
business transaction still require independent fresh control/source checks and CAS.
This record certifies already-closed controls; it is not a new distributed mutex.

Observation sessions are explicit trusted dependencies. Every successfully opened
session reaches `close`, including read failure and cancellation. An opener must
clean any partial open before rejecting; an unverifiable cleanup rejects acquisition.
Cancellation before retention writes nothing. Lost acknowledgement and cancellation
after retention, including the final human checks, retain an incident when closed
controls can still be independently proven. If that proof or the journal fails, the
operation fails closed without claiming durable closure. The final administrator
read is the cancellation boundary; a later abort cannot undo completed acquisition.
Abrupt process termination cannot promise a `finally` cleanup: inspect retained
evidence and reconcile actual resources before any further authorized operation.

Validation uses the real loopback Firestore SDK/repository, with **test doubles for
Google/provider observations and session cleanup**. No live account permission,
OAuth revocation, current Google control or combined provider timing is proven by
this test. The production-shaped factory requires explicitly supplied Firestore,
trusted observation sessions and clock; it has no executable live CLI or credentials.
The local test constructs fresh synthetic commitments, never real user consent.

Build/lint pass; 166 focused and 65 emulator tests pass, no failures/skips. Fifteen
new emulator cases cover acquisition/restart, forward/inverse, interruptions, cleanup
failure, expiry, source/control drift and foreign package rejection. The regenerated
package performs 203/140 local writes, restores 62 originals and preserves all 117
notices and guard-document versions. Private results:
`2026-10-31-durable-barrier-acquisition`. That acquisition block was subsequently committed/pushed as `9ed3a9ef`.
No native changes or parity gap. No real maintenance, production, Sheets, FCM or deploy.

## Current evidence boundary

Private preparation: `2026-10-31-owner-window-preparation`; published base:
`2026-10-31-original-admission-binding`. The maintainer authorized both read-only
scopes and confirmed exclusive control of both Firebase Owner accounts. No future
window commitment is inferred from those answers.

Owner observation at 2026-10-31T20:11:55.064Z: file version 287 stable across metadata
reads bracketing two direct raw Sheets captures; complete owner/four-reader ACL,
owner-only My Drive parent and no writer access. Both raw responses equal each other
and the retained independent baseline, including 3286 selected cell objects, typed
values, notes and entered formats. The previously omitted empty format objects are
preserved. No file permission or content was changed.

OAuth revocation succeeded and Drive immediately returned 401. An additional minimal
Sheets read initially returned 200; a bounded same-token follow-up returned 401 about
89 seconds after the recorded revocation. Both intermediate observations are retained;
no uniform immediate-denial claim is made. No refresh token or second token was
requested. Playground fields were verified empty, its tab closed and token references
cleared after the final denial.

The manifest now binds those renewed owner observations. Review package
`4b140ae7fb447fd3cc40c488d713f5021a0e2b352d5dbf6eaff32185c4488a52` and preparation
`a8686633ddafb3962523816fe5172818bb1fb6c42638d800cf1141bfd4dec496` have regenerated
operation identities because provenance hashes changed. Source policy and all exact
business mutation fields remain equal. An initial comparison of entire envelopes
correctly rejected the changed evidence/identity fields; the completion check compares
business fields separately and retains that diagnostic. No runtime validator changed.

Firestore sources, technical controls and historical causal evidence remain explicitly
retained from the previous package; this owner-only read does not renew them. The
window plan names the new package/operation IDs, with no start/end/confirmations or
execution authorization. A later execution must refresh observations again.

Previous owner-renewal block: build and 50 emulator tests pass with zero failures/skips on the regenerated
package; 203 forward/140 inverse writes, 62 originals restored, 117 notices preserved.
All eight previously accepted executable/test hashes are unchanged; the 146 focused
cases and lint are reused. Private scripts pass syntax and docs pass diff checks. This group changes only documentation and private preparation, with no
native change or parity gap. Maintenance and apply remain false.
