# HU-084 — Develop permissions and maintenance window preparation

Status: **preparation only; not scheduled or authorized for execution**. Original
writer evidence and admission integration are delivered in `d42ce7fe`. This plan
does not grant access, open maintenance, migrate data or activate either app.

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
2. Complete the real control-plane composition that acquires and persists the held
   barrier, reads back owner/admin observations and records failure/recovery. The
   existing `controlled-develop-migration.cjs` only consumes an already-held barrier;
   its passive check must still reject a missing window.
3. Rehearse that composition locally against the exact regenerated forward/inverse
   package, including interruption and cleanup. Review the original-workbook batch
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

Validation: build and 50 emulator tests pass with zero failures/skips on the regenerated
package; 203 forward/140 inverse writes, 62 originals restored, 117 notices preserved.
All eight previously accepted executable/test hashes are unchanged; the 146 focused
cases and lint are reused. Private scripts pass syntax and docs pass diff checks. This group changes only documentation and private preparation, with no
native change or parity gap. Maintenance and apply remain false.
