# HU-084 — Develop permissions and maintenance window preparation

Status: **preparation only; not scheduled or authorized for execution**. Original
writer evidence and admission integration are delivered in `d42ce7fe`. This plan
does not grant access, open maintenance, migrate data or activate either app.


## Complete copy deadline budget and historical compatibility — 2026-11-01

Admission-receipt integration is delivered/pushed as `3aa1b467`. New local work
composes the existing copy runner and Google transports through `runBudgetedCopy`.
It requires an exact `budgetDigest` bound to the copy preparation and budget source.
No live CLI, credential lookup, token renewal or new migration executor is introduced.
The next live copy composition must use this entry; bare `runCopy` remains the core
for focused fixtures and historical receipt interpretation, not proof of this budget.

| Deadline allocation | Bound |
| --- | --- |
| Confirmed owner window | At most600s, unchanged |
| Preparation/IAM readiness | Must finish while more than420s of the window remain; existing120s IAM minimum remains |
| Work after mint | At most150s, shared by both batches and their observations |
| File removal, owner readback and same-token denial |60s reserved; always before writer-token expiry |
| IAM removal, disable, identity/runtime readback |90s reserved |
| Owner OAuth revocation and both API denials |120s reserved |
| Total cleanup reserve |270s, separate from work; unused earlier capacity may carry forward |
| Writer token | One300s token; no grant or token extension |

These are enforced ceilings, not predicted provider latencies. Before each batch,
75s must still fit in the work slot (30s request and45s bounded readback), while the
existing150s token fence still applies. HTTP deadlines cover body consumption and
combine with each transport's own timeout. Exhaustion rejects the next write; after
an already verified forward it may leave an inspectable forward state, never an
automatic inverse or replay. A late/aborted HTTP request is not proof of non-execution.

Cleanup stages have absolute deadlines and remain independent. The composition
joins outstanding sibling HTTP reads after an early `Promise.all` rejection before
changing phase; it does not race or abandon an in-flight operation. Breaches or
unverified cleanup produce `inspection_required` and retain the local lock. OAuth
cleanup also runs if runner preflight fails after the owner session is constructed.
A process crash still requires receipt/resource reconciliation; no finally guarantee
or universal provider-response guarantee is claimed.

Historical compatibility is now reviewed rather than merely deferred. Rebuilding
`eae86a89^`'s manifest validator using the installed TypeScript compiler reproduces
the old full backend digest `2c63c31b…ce669`; current digest is `049fe823…d741`.
Only `src/shift-sheets-owner-manifest.ts` and its compiled `.js` differ. A narrow
pinned transition preserves the older ten-row and original-A1 outcomes; every other
preparation field and source transition still rejects. The separately pinned copy
runner transition retains the previous53-cell inverse as **pre-deadline history**,
not evidence that the new budget was exercised live. No raw receipt is rehashed or
rewritten. Unknown future code changes require another compatibility review.

Private packet `2026-11-01-complete-copy-budget` restores all three original evidence
pins into the review package. Package `1bb66f7931ee94184fc5b7e7ef6316126fcfa8bc00563defd87e5c4cc2df8dab`;
controlled preparation `79e90ac1b26e386bc2dae27f40be92606ef34be2d211b703db9cfbbfd5d21074`.
Source policy, original business intents, operation identities and observation ages
remain unchanged; admission remains false. A separate budget template uses only a
local placeholder destination; it is not an executable live-copy authorization.

Validation: Node22.23.4, build/full lint, focused CJS lint and **166 tests**, zero
failures/skips. Fourteen new cases cover historical compatibility, slow OAuth, work
exhaustion before first/second batch, each cleanup overrun, lost-response inverse,
exact budget binding, late HTTP settlement, joining sibling reads and a complete
real-transport composition against synthetic HTTP. Dates/order/content restore in
that local roundtrip. No external provider call occurred. Existing Firestore emulator
engines and native apps are unchanged; no new emulator or physical-app claim.

Next: prepare and separately authorize one fresh synthetic-copy full-cycle run with
this exact budget, then measure actual uninterrupted provider timing. Shared develop
maintenance still needs fresh controls/source/owner observations, held admission and
its own combined Firestore/Sheets window; these local tests do not authorize it.
No maintenance, production or native parity change. New work remains local/uncommitted.

## Recovery receipts bound to admission preparation — 2026-11-01

Recovery outcome documentation is delivered/pushed as `82029bf8`. New local code
reviews the retained approval, exact execution sources, inverse intent, complete
readback, marker/preservation manifest, single-mint receipt, timing and independent
cleanup evidence. It uses the existing package/materializer/admission path; no
second executor or live client is added. The raw evidence is digest-pinned in the
manifest. Invalid content, leftover access, changed sources or inconsistent times
reject; no historical result makes current controls or writer authority true.

Private packet: `2026-11-01-helper-recovery-admission`. Evidence digest ends
`247e0f75b4d41`, review package `fc6baf6f6a5502a2376f117151c10eccc18423a1818fc78bf4e97e4ec55db4ee`,
controlled preparation `50a4e1bc48d27cb9e1e7800bf31b9c21bbb601c7c4452ccd3c9ba7c196e06471`.
Regeneration is offline from retained sources; source policy, forward/inverse business
intents, operation identities and original observation ages remain unchanged.
`canApply:false` and `canEnterMaintenance:false` remain explicit.

The first regeneration correctly rejected the older ten-row and original-A1 proofs:
their source binding includes all backend src/lib bytes, preceding the later
Sheets marker-validator correction. Their original files/digests and previous review
package are preserved in `retained-prior-evidence-private.json`, indexed alongside
the new package. They are **not recertified for current execution** or silently
rehash-replaced. The new executable-code-compatible evidence is the 53-cell recovery.
The separate historical source-compatibility review remains pending; no original-file
permission or current-control claim follows from this synthetic-copy result.

### Timing review and remaining gates

| Stage | Actual recovery receipt | Remaining limit or missing evidence |
| --- | --- | --- |
| IAM propagation | 122,346ms, before token | Existing minimum120s / maximum180s; no implicit extension |
| Inverse verified | 142,992ms from runner start | One inverse only; not the combined forward/inverse duration |
| Full attempt and cleanup | 194,571ms | Includes IAM and OAuth; do not add other attempts to claim one-window proof |
| OAuth cleanup | 42,288ms | Provider allows up to120s; earlier owner read needed about89s |
| Writer token | One requested300s token | Before **each** batch, remaining token and owner window must exceed150s |
| Shared barrier, fresh reads, Firestore and Sheets | No joint live measurement | Emulator/doubles do not establish Google timing |

**Finding:** the120s reserve is not a proven worst-case allowance for the entire
cleanup. Owner OAuth alone can consume120s, in addition to file removal/readback,
same-unexpired-token denial, IAM removal, identity disable/readback and runtime checks.
The150s submission fence (30s request +120s reserve) therefore must not be advertised
as proof that all cleanup fits. No timing limits, token scope or grant were extended.

Next group the remaining local work: review historical source compatibility and
bind an end-to-end deadline budget, separating writer-token denial from owner OAuth
and the overall window deadline. Rehearse slow/error paths and a complete two-batch
cycle with that budget before requesting another live copy run. Keep a single token;
stop before a write if the remaining budget is insufficient. Original maintenance
requires its own fresh observations, admission and explicit window afterward.

Validation: build/lint, focused CJS lint and **152 tests**, zero failures/skips;
21 new cases use actual runner/adapter receipts with in-memory providers. The real
retained receipts pass independent offline review; altered content, second mint,
cleanup failures and false timing reject. No new Google, IAM, Sheets, Firestore or
production calls; no native changes/parity gap. This integration remains local and
uncommitted. Existing emulator migration engines are unchanged and were not rerun.

## Authorized inverse completed and contained — 2026-11-01

The recovery runner is committed/pushed as `a2a0b963`; branch, remote and draft
PR #278 agree. After explicit inverse authorization and a fresh ten-minute closed-copy
confirmation, one batch restored **53 helper cells** and updated **two existing markers**
in `HU-084 — ENSAYO LOTE COMPLETO — 20261101-full-batch`. The forward was not resent.
The complete owner readback and a separate offline verification of retained receipts
confirm preservation of dates, names, order, notes, formulas, formatting and structure.
The two markers remain as inverse receipts; this is not byte-identical metadata to the
original baseline. Reviewed preflight version was **14**; batch readback version **16**.

IAM propagation waited **122,346ms** before the sole **300s** token. Full inverse
verification completed at **142,992ms**; the attempt including cleanup took **194,571ms**.
The created copy permission was removed and the same unexpired writer token denied
with **404**. Independent identity read confirms disabled account, no temporary IAM
bindings and no user keys. Owner OAuth denied in both Drive and Sheets after cleanup
(**42,288ms**); the local lock was released and the private execution server stopped.
There were no execution or cleanup failures. Browser review confirms restored helper
cells in both affected tabs and private owner-only sharing; full preservation is
established by the retained raw image, not by screenshots alone.

Private evidence: `2026-11-01-copy-inverse-execution`, including the consumed approval,
window receipt, inverse intent/readback, independent content and identity verification,
terminal result and visual captures. The preparation request remains an unchanged,
unauthorized historical template; actual authorization is a separate execution receipt.
No original workbook, shared maintenance, business Firestore, deployment, FCM or
production access occurred. No native changes or parity gap.

This proves recovery after the interrupted forward attempt; it does **not** prove an
uninterrupted real forward/inverse lifecycle or combined maintenance-window timing.
Next incorporate these measured receipts into develop admission preparation and review
those remaining timing gates before proposing any new execution. Current authorization
is consumed (`canRetry:false`, `canEnterMaintenance:false`). Build/lint and 133 focused
passes from the exact delivered code are reused; this result update changes docs only.
HU-084/HU-085 remain open and PR #278 draft. The outcome documentation is local/uncommitted.

## Historical preparation: inverse-only recovery — 2026-11-01

The preceding correction and full-copy reconciliation are committed and pushed as
`eae86a89` and `61fe86e9`; remote HEAD was verified. This new recovery preparation is
local after that delivery. No Google, IAM or Sheets operation was executed here.

`prepareCopyRecovery` reuses the existing copy runner and Sheets adapter. It verifies
the consumed preparation, forward request/manifest, terminal cleanup and complete
retained image. It regenerates the business recipe with current code while retaining
the historical source identity as evidence. A changed recipe, incomplete cleanup,
wrong marker or unrelated cell/format change rejects preparation. The package binds
the current adapter/validator code, exact inverse requests, image and reviewed version.

For this copy the reviewed version is **14**. The single inverse batch contains
**53 helper-cell restorations and two existing-marker updates** (55 requests).
Dates, order, names, notes, formulas and formatting are preserved; the two markers
remain as receipts of the inverse, rather than being deleted. The new runner mode
never executes the forward operation and the concrete transport permits one attempt.

Execution still requires new explicit inverse authorization and a separate confirmed
ten-minute owner window. Before permissions, reread owner-only ACL, full image and
version, disabled identity and runtime isolation. Any drift stops for reconciliation.
Recheck the image after the grant and before the sole 300s token, wait at least 120s
for IAM, and retain 150s for submission/cleanup before writing. Reuse the exact batch
and preservation manifest; save full readback before validation. An uncertain result
stops without retry. Remove the created copy permission, prove denial with the same
unexpired token, remove only the own IAM condition, disable/read identity and revoke
owner OAuth with denial in both APIs. Prior approvals/windows are not reused.

Run a fresh Node process with current modules; do not use a persistent module cache
from earlier code. The private `2026-11-01-copy-inverse-preparation` packet contains
the exact plan and an **unauthorized** execution request, with no credentials. Its
network-trapped rehearsal applies the inverse to the saved real image, loses the
response, verifies readback/restoration and exercises cleanup entirely with doubles.
It makes zero Google calls and does not restore the real copy.

Validation: build/lint, CJS syntax/diff, **133 focused tests**, zero failures/skips,
plus the offline rehearsal on the retained real image. The nine new cases cover
inverse-only scope, consumed receipts, pre/post-grant drift, version/marker changes,
unknown result and one-attempt transport. No native change/parity gap. The previous
nine Firestore-emulator cases are unchanged and were not rerun for this Sheets-only
preparation. At that point, real inverse, uninterrupted roundtrip, maintenance and
activation remained pending. The subsequent authorized inverse and its limits are
recorded above; this preparation record does not grant another execution.

## Full synthetic-copy permission lifecycle — 2026-11-01

The Google-read/batch block is delivered as `a2ba5dfa`. The new explicit copy
composition uses the existing IAM provider/checks, 120s minimum propagation wait,
one 300s token, existing Sheets adapter and preservation manifest. It prepares
53 fictitious delivery helpers on six tabs in a new copy of the existing synthetic
template; no personal develop content is copied. Both original workbook IDs are
hard-denied by the owner and writer transports, before network access.

A consumed approval and exclusive local lock bind the exact code, copy ID, baseline,
operations and a confirmed maximum ten-minute window. The operator enables only
the existing dedicated account, grants conditional IAM and copy-only Editor, then
waits before the single mint. Two batches at most apply and reverse 53 F values and
two markers. Each batch checks identity, isolated runtime inventory, full owner
image/version and the 150s time fence immediately before submission. Lost responses
use readback; ambiguity stops without automatic inverse or replay. The inverse is
part of the explicitly approved recipe, and runs only after verified forward content.

Independent cleanup steps remove only the newly granted copy permission, prove denial
with the same still-valid token, remove the owned IAM condition, explicitly disable
and read back the identity, and revoke the single owner OAuth session. Drive and
Sheets denial are both required; owner OAuth is not renewed per observation. A failed
cleanup retains the local lock and an inspection-required receipt. Abrupt process loss
still requires reconciliation using recorded intents; no finally guarantee is claimed.

The copy is prepared before the ten-minute confirmation, using one Online `drive.file`
session with the owner. This scope covers the existing synthetic template and the new
copy only in the controller. The complete preparation permits initialization of the
new copy; it never modifies the template. A separately confirmed window precedes IAM
or file grants. No real Firestore, maintenance, deployment or notification operation
exists in this copy runner. The earlier emulator already covers joint migration;
this run measures the real copy/permission lifecycle separately.

Local tests cover successful roundtrip, enable/grant/mint/write/cleanup failures,
expired budget after forward, one-token/two-attempt limits, grant reply loss, protected
destinations, complete raw read normalization and incomplete runtime inventory. The
real read-only preflight finds the account disabled, no keys or temporary bindings,
and no assignment in the reviewed global Functions/Cloud Run inventory.

### Authorized live attempt and contained stop

The six-tab copy was initialized and independently matched its complete baseline,
with only the test account owner. After the initial owner session expired while
waiting for the reply, execution rejected before IAM or a writer token. The same
Online scope was renewed and a new explicit ten-minute owner window was confirmed.
The approved attempt waited **121,616ms** after IAM grant, minted **one 300s token**,
and submitted the forward batch of 53 helper values and two operation markers.
The adapter's readback passed, but the next full-owner observation/preservation
check rejected at the recorded forward-stage line 121. The inverse was never sent.
`completedBatches: 0` means no fully preservation-verified batch, not zero writes.
The synthetic copy retains the forward data and must not be replayed or treated as
restored. Browser review after cleanup confirms visible helper values and private
owner-only sharing; it cannot establish full raw preservation.

All cleanup completed: copy permission removed, **404 with the same unexpired
writer token**, owned IAM binding removed, account explicitly disabled and verified
independently with zero bindings and clear reviewed runtime inventory. OAuth
revocation returned successfully; Drive denied immediately, Sheets denied after
**41,937ms** with the same token. The run took **197,363ms** including cleanup.
The local lock was released, transports stopped and browser credential fields reset
and tabs closed. No original workbook, real Firestore write, maintenance, deployment,
FCM or production access occurred.

The owner readback was not persisted before the failing preservation assertion, so
its precise mismatch cannot be reconstructed from this attempt. A local regression
reproduces rejection of Google's read-only `locationType: SHEET` on newly created
metadata. The narrow correction accepts only that derived type for the exact
expected sheet marker; wrong types, locations, values, visibility, extra fields and
changes to existing metadata still reject. This follows the
[Google metadata-location contract](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.developerMetadata#DeveloperMetadataLocation).
It is a verified validator defect, not proof that it was the only live mismatch.
The runner now journals the complete owner readback before asserting preservation;
a rejection test proves no inverse and full cleanup, and the roundtrip fixture now
returns Google's derived location type.

Validation after the local correction: build/lint, syntax/diff, **124 focused tests
and 9 emulator tests** pass with zero failures/skips. The expected regression failed
before the fix. An intermediate run overlapped a build and rejected two source-bound
checks; the complete focused suite passed once the build was stable. Native apps are
unchanged, with no parity gap. All new implementation remains local after `a2ba5dfa`.

### Read-only reconciliation of the retained copy

The authorized owner-only inspection captured all six complete grids under stable
Drive version **14**, with only the test owner in the ACL. The corrected validator
accepts the unchanged capture against the retained forward preservation manifest;
the adapter independently verifies all 53 helper values and both operation markers.
The previous validator rejects this same capture and accepts it after removing only
the two derived `locationType: SHEET` fields. This isolates the mismatch in the
current real response; the historical after-image is still unavailable.

The first private inspector failed before retaining its capture because the persistent
Node session held an older cached module without `normalizePreservationSnapshot`.
A diagnostic read under the same authorized scope saved every provider response;
a fresh Node process verified those saved responses and the original manifest offline.
Both sessions were revoked and denied in Drive/Sheets (62,399ms and 63,176ms).
No writer activation, IAM grant, service token or spreadsheet write occurred.
OAuth fields were reset and the tab closed. The full capture is now retained, so
further comparison does not require another Google session.

Next: prepare an explicit inverse-only recovery of this reconciled copy, with fresh
preconditions, permissions and a separately authorized writer/window. Do not resend
the forward batch. The real inverse and a complete uninterrupted roundtrip remain
pending; current read acceptance does not reopen the consumed attempt or admit
maintenance. Private evidence: `2026-11-01-helper-copy-lifecycle`, including provider
responses, normalized image, old/new validator comparison and both cleanup receipts.
This inspection adds no repository executable changes; the prior build/lint and
124 focused + 9 emulator passes remain applicable, with document/diff checks repeated.

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
