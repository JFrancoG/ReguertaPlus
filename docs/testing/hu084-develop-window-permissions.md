# HU-084 — Develop permissions and maintenance window preparation

## Current preparation — 2026-11-01

Original-window connections are delivered as `5b24be80`. The new local
[concrete invocation preparation](hu084-develop-concrete-invocation.md) renews real
Firestore, Cloud, writer and owner evidence and regenerates the exact package.
Published data/service versions and business intents are unchanged; operation IDs
change with the evidence. Passive live admission rejects `window_scope_missing`.
The owner session is revoked with same-token Drive/Sheets denial. No maintenance,
writer grant, migration or production access occurred. The real barrier observation
composition and native owner callback binding remain the grouped technical work
before requesting a window; standalone observations are not a held barrier.


Status: **preparation only; not scheduled or authorized for execution**. Original
writer evidence and admission integration are delivered in `d42ce7fe`. This plan
does not grant access, open maintenance, migrate data or activate either app.


## Original-file observation, batch and session recovery connected — 2026-11-01

Validation completed: Node 22.23.4 build/full lint/CJS lint; **397 local tests and 90 emulator cases pass**, zero skips. Five concrete journals were re-read successfully. The final three constructor rejection checks were added after the emulator pass and covered by the final local suite, including unchanged successful roundtrip/recovery paths. Package and preparation are exactly unchanged.

The adapter review was committed/pushed as `559e6b20`. This implementation remains
local. `createOriginalWindowSessions` now supplies normal and cleanup-only recovery
ports to the existing persistent window; it composes the existing IAM, Sheets,
Firestore executor/barrier and deadline mechanisms. It does not create a second
planner, default credentials, CLI, deployment or maintenance switch.

- **Observation:** the new owner adapter validates the fixed original develop file,
  parent, owner and four readers, with precisely the owned writer during work and
  without it during cleanup. Full six-tab images are read twice between complete
  metadata observations; values, formats, notes, validation, merges and metadata are
  preserved. The existing read-only observer and copy exclusions are unchanged.
- **Permission/version transition:** planning first checks the exact reviewed image
  before granting access. A grant may change Drive version; the retained before/after
  transition must have identical complete cell images and no authority change other
  than that writer. The execution plan records the actual post-grant version and
  transition digest. Fresh owner reads and IAM/runtime checks guard the exact batch;
  an unexplained version/cell/permission change stops execution.
- **One original batch:** the normal Google transport pins the original file and the
  reviewed 53 helper cells plus two markers. The existing adapter performs forward
  or separately admitted inverse reconciliation. The attempt is consumed before
  suspension/dispatch, including concurrent calls and lost responses. Independent
  readback may verify a lost response; it never authorizes a second submission.
- **Ownership and credentials:** the exact receipt ID, binding, fixed identity,
  baseline ACL/IAM policy and grant intent are recorded before effects. A writer
  already enabled or bearing another grant is rejected rather than borrowed. One
  300-second writer token follows the minimum IAM age; owner session IDs, credential
  fingerprints and expiries are persisted, never bearer/refresh tokens. All Google
  HTTP, including response bodies, uses the window's single budget.
- **Recovery:** only inspection and file/IAM/OAuth cleanup are returned. Existing
  receipts remain bound to their credential and window. Recovery removes only the
  owned file grant and IAM member/condition, preserves unrelated authority, disables
  the fixed UID and verifies readback. A separately supplied *same* unexpired writer
  token can prove denial only if its fingerprint/expiry and earlier positive access
  match the journal. It is never minted or refreshed in recovery. A fresh owner
  token closes only its own session; previous owner sessions need their matching
  credential or already verified closure receipt. Missing proof keeps the root fence
  and requires inspection, even after grants have been removed. Expiry alone is not
  silently reclassified as verified revocation.
- **Interruption:** partial setup returns its cleanup ports. A failed journal append
  cannot suppress exact permission removal, explicit disablement or OAuth revocation;
  missing cleanup evidence still prevents a clean terminal. Native owner callbacks
  are explicit reviewed UI actions, receive `assertActive` for the final mutation and
  must settle before cleanup; no Drive permission-writing scope is inferred from
  read-only OAuth. Recovery credentials and UI control are supplied explicitly by
  the operator, not recovered from an environment variable or a secret-bearing journal.

The window entry accepts an explicit HTTP implementation for tests; the existing
Firestore/barrier dependencies retain their project/source/authority checks. Native
permission UI and Google responses are simulated in this block. Firestore uses only
the loopback emulator. Neither this connection nor the boolean fields of a local
preparation are a live execution authorization.

Validation: see `2026-11-01-original-window-integration/validation-summary.json` for
final test counts, source hashes, package equivalence and retained interruption
journals. The first emulator run overlapped the final receipt-binding edit and had
four mixed-version failures; it is retained as diagnosis and excluded from the final
validation. No runtime provider files pinned by historical copy/original evidence
were changed. No live observations, credentials, permissions, Sheets/Firestore/FCM
writes, maintenance or production access; no native change or parity gap.

**Next:** prepare the concrete operator invocation with these adapters, the current
source/control/owner observations and scoped permissions, then obtain the specific
live window authorization. The earlier three code-connection gaps are addressed;
a live joint timing/cleanup outcome remains unverified. If a process loses the only
credential before its closure receipt, recovery reports that gap and does not resume
execution. No OAuth renewal or sheet closure is needed from the user for this local
block. HU-084/HU-085 remain open and PR #278 draft.


## Concrete session/recovery adapter verification — 2026-11-01

Historical review: the missing connections described here are implemented in the section above.

Persistent window composition is delivered in `d8b99067` (remote verified). This
review is local and does **not** certify a live window. The concrete adapters were
checked against the original-writer plan, the retained package, and the new window
ports. Only tests, the test command and documentation change; provider code and
historical executable hashes remain unchanged.

| Boundary | Verified behavior | Remaining connection |
| --- | --- | --- |
| Original owner observation | `createOwnerReader` reads the exact file and parent with the temporary writer present. `createDevelopOwnerObservationSession.capture` requires the owner/four-reader baseline and rejects that grant before reading cells. | A lifecycle-aware observation must validate the exact owned grant while it exists and its absence after removal, preserving every other permission and the independent full snapshot. Do not relax the existing read-only capture globally. |
| Original Sheets execution | `createWorkbookAccess` exposes only one same-value `Fecha` probe. Copy owner/writer transports reject the original file; their successful batch evidence does not widen this scope. | Bind the original destination and exact reviewed forward/inverse batch to a concrete transport. Reuse the existing Sheets adapter and budget; do not repurpose the probe or remove the copy exclusion. |
| IAM cleanup | The actual HTTP adapter can read current policy, remove only the exact retained conditional grant with its current etag, explicitly disable the fixed UID, and re-read it without enable/mint calls. A CAS conflict remains unresolved even when disabling succeeds. | The recovery factory must obtain an explicitly supplied cleanup credential, verify durable ownership and retain incomplete cleanup; account disablement alone is insufficient. |
| Lost owner OAuth session | Closing a replacement session revokes only the supplied credential in the adapter contract. A new successful cleanup receipt cannot certify the earlier session. | Preserve credential-free session identity/expiry and cleanup receipts before effects. If the old credential or a matching verified revocation receipt is unavailable, keep OAuth cleanup unverified; no mint/refresh/replay or automatic claim of expiry containment. |
| Pending HTTP | With `timeBudget.fetch`, real parallel IAM reads (including response bodies) settle before the cleanup phase begins even after a sibling fails. | Every concrete Google transport must receive this common wrapper; raw fetch bypasses its accounting. |
| Firestore/session factory | The executor and durable barrier accept explicit scoped dependencies; `openSession` and `openRecoverySession` for the complete window exist only as injected ports/test compositions. | Compose the actual Firestore/control readers, native owner grant/removal channel and Google lifecycle. Recovery must expose inspection/cleanup only, never acquire/execute/inverse. |

The five new adversarial checks use **real adapter implementations with synthetic
HTTP responses**: active-writer observation rejection, old-versus-new OAuth cleanup,
exact IAM removal preserving another grant, a stale-policy conflict followed by
independent disablement, and pending-body settlement. These tests verify limits as
well as supported behavior; passing them is not an activation result. No credentials
were requested or consulted, no Google calls were made and no observations refreshed.

**Readiness decision:** the session/recovery connection is not ready for a real
window. Finish it as one grouped implementation block: (1) original-file observation
and exact batch transport, (2) durable ownership plus per-session cleanup accounting,
(3) concrete normal/recovery composition with one shared deadline budget. Validate
that block with synthetic HTTP and the Firestore emulator, including lost responses
and process interruption. Only then renew live observations and request a concrete
window. There is no reason to reopen OAuth or ask the owner to close a sheet now.

Validation results are retained in `2026-11-01-window-provider-review`; see the
private validation summary: Node 22.23.4 build, full lint, focused CJS lint and
**150 tests passed, zero failures/skips**. Earlier 86 emulator cases are reused because no
runtime source changed. No native changes or parity gap. HU-084/HU-085 remain open
and PR #278 remains draft; this verification is local/uncommitted.

## Persistent controlled-window composition — 2026-11-01

Joint deadline/uncertain-response integration is delivered as `4dfa4946`. New local
`runControlledWindow` composes session preparation, durable barrier acquisition,
passive admission, one already-authorized joint direction, and independent file/IAM/
OAuth cleanup. It uses the existing executor and budget; it does not create an SDK
client, deployment, CLI, permission choice or maintenance-opening operation. Forward
and inverse remain separately admitted invocations, never automatic compensation.

The local journal publishes numbered immutable JSON records with file and directory
fsync, exclusive creation, a digest chain and bounded sizes. It binds the exact
prepared packet, scope, direction, window and forward evidence before opening a
session. Provider setup receives the same evidence sink for its grant/token intents;
credentials are excluded from records. A shared root fence prevents another window
from taking over while cleanup is unverified. Receipt IDs are consumed permanently.
The trusted session opener must use that sink before external changes and scope its
cleanup to the recorded ownership; these ports have only been exercised with local
doubles in this block, not newly authorized live IAM/OAuth access.

Cancellation waits for pending provider calls. Cleanup attempts file, IAM and OAuth
independently, including after partial setup or evidence-write failure. A successful
terminal requires verified execution, all cleanup receipts and the deadline report.
Partial/corrupt records cannot authorize replay or a clean terminal. Evidence write
failure propagates; uncertain cleanup keeps the root fence for inspection.

`recoverControlledWindow` verifies the existing chain/binding and acquires a separate
recovery lock. It rejects a still-active invocation or a live external process,
including one that just published a terminal. A completed inactive call in the same
process can be inspected safely. Recovery can inspect the barrier/Firestore/Sheets
and repeat exact cleanup, but has no acquisition, execution, token-mint or inverse
path. Missing evidence never grants permission to replay. A crashed recovery lock
or corrupt/incomplete binding requires separate operator inspection; it is not
silently reclaimed. The filesystem is trusted local evidence storage, not a signature
or a substitute for current technical/owner/administrator authority.

Tests include successful acquisition/forward plus separately admitted inverse,
interruption after Firestore before Sheets, failed cleanup followed by explicit
recovery, partial setup, disk-write interruption, concurrency fencing and a real
SIGKILL of a child **after a Firestore emulator commit**. A fresh recovery reads the
persisted receipt, verifies the committed afterimages and cleans synthetic access;
it leaves all business documents untouched. Users/config/calendars/117 notices stay
unchanged and maintenance stays closed. The SIGKILL test stops before Sheets; it does
not claim crash durability of Google or the local disk under power failure.

Private evidence: `2026-11-01-persistent-controlled-window`, including copied journals
for the four final emulator scenarios. Google permissions, token minting, Sheets
transport and elapsed time remain doubles; Firestore transactions and barrier journals
use the real local emulator. No live Google/Firestore, production/original workbook,
IAM, FCM or deployment access. No native changes/parity gap. New implementation remains
delivered in `d8b99067`; issues open and PR #278 draft.

Validation: Node22.23.4 build/full lint and focused CJS lint pass; **270 distinct
local tests** (267-suite plus final14 window tests) and **86 distinct emulator cases**
(85-suite plus final4 persistent/crash cases), zero skips. The final unique-recovery-ID
check is covered by the window rerun and does not change successful emulator paths.
Five retained journals were independently re-read: valid chains, no partial files,
settled providers and no execution-resume authority. The reviewed admission package
is unchanged; no observations were refreshed. Native gates were unnecessary.

**Next:** verify the concrete session/recovery adapters against the retained identity,
permission and source plan, including how a new process obtains cleanup-only access.
Then renew the current observations and prepare the exact window for authorization.
No sheet closure or other user action is needed for the local work just completed.


## Joint scheduling connected to controlled execution — 2026-11-01

The receipt integration and previous joint rehearsal are delivered/pushed as
`f01c40c0`. New local `executeJoint` on the existing controlled executor composes
its current admission/transaction engine with `planBatch` and the Sheets adapter.
It creates no Firebase export, CLI, credentials, permission grant or maintenance
entry. Forward order is Firestore then Sheets; inverse order is Sheets then
Firestore, with an additional fresh inverse admission/forward-receipt validation
before the first Sheets mutation. Caller-owned inputs are detached before awaiting.

The existing deadline controller is checked before/after provider work, before
Firestore's first write, after late fence reads, at every queued mutation and when
the transaction callback finishes. Read-write transactions use one SDK attempt.
Sheets retains its exact request digest, fresh owner snapshot/version and immediate
submission fence. A direction is consumed once per executor; concurrent or repeated
joint calls are refused; inspection remains available. An injected evidence sink receives the intent,
receipts and independent owner readbacks; failure to record an uncertain outcome
propagates rather than claiming it was retained.

`inspectUncertain` is explicitly read-only, including Firestore transaction options,
and can inspect a committed terminal even when barrier failure evidence exists.
Forward inspection verifies exact afterimages and service versions. A retained
inverse terminal proves its commit but is reported as **terminal-only**, not proof
that every recovered row is still current. Missing/unavailable receipts never
permit replay. After any uncertain failure the cycle stops, inspects both services,
records its result, and performs no automatic retry or inverse. Lost Sheets replies
may continue only when the existing adapter independently verifies the exact image
and the budget remains valid. External note/cell drift blocks that claim.

**Timing limit:** these are admission/submission fences, not remote cancellation.
The installed Firestore SDK exposes `maxAttempts` but no per-transaction cancellation
or timeout in its public transaction options. A dispatched commit/read is awaited;
there is no Promise.race or abandoned write. An overrun stops subsequent work and
can invalidate the cleanup deadline; it does not become a claim of timely cleanup.
The caller still owns permission cleanup and `budget.complete()`. A verified joint
step deliberately returns `cleanupVerified:false`; it cannot certify the whole
maintenance lifecycle. Scheduling tests inject elapsed time separately from the
fixture's authority clock; real Google/Firestore combined latency remains unmeasured.

Validation evidence: `2026-11-01-joint-controlled-execution`. No live Google or
Firestore call, IAM change, FCM, deployment, original workbook or production access.
No native changes/parity gap. The review packet and historical receipts are retained;
current controls have not been refreshed. New implementation is local/uncommitted.

Validation: Node22.23.4 build/full lint and focused CJS lint pass. **256 distinct
local tests** (255-suite plus final18 guard/composition rerun) and **82 distinct
emulator cases** pass after the final focused nine-case rerun. Two test assertions
were corrected to expect the actual earlier deadline rejection and the adapter's
`ambiguous` read failure; no runtime guard was relaxed. The shared-develop legacy
execute path now refuses calls without the joint mutation guard. The final shared-only
check does not alter the emulator branch. Native gates were not run: no native edits.

**Next:** assemble the existing acquisition, joint executor and permission-cleanup
adapters into the concrete reviewed window invocation, then rehearse interruption
and restart using its durable evidence sink. Refresh current controls and request
the actual window only after that composition is verified. No user action is needed
for the local work; HU-084/HU-085 remain open and PR #278 draft.


## Full-cycle receipts and joint local rehearsal — 2026-11-01

The previous real-copy outcome is committed and pushed as `2ef610b3`. The new local
`helperCopyCycle` evidence travels through the pinned review manifest, materializer
and read-only admission report. Its reviewer checks both exact 55-request plans,
full owner snapshots, restoration, one-token receipts, all five deadline stages,
OAuth denials and independent final identity isolation. A successful isolated cycle
sets only `uninterruptedRoundtripVerified`; current controls, writer authority,
combined maintenance timing and execution permission remain false.

The retained execution baseline is Drive version **9**, after the separate preparation
capture at version 8. Forward and inverse reads both report version **11**: exact
restored cells and inverse markers prove recovery even without another version increment.
The OAuth receipt measures **31,668ms**; the enclosing cleanup phase is **31,686ms**.
These are distinct measurements, not contradictory results.

Private package: `339726666096f37235087d0705ebcd6daee378face5ce0c13764c37488bfd8aa`;
controlled preparation: `c9adc4eae52fca6769fe95b97c217c6787679fb20cbd42204664d8e7f19ee653`;
full-cycle evidence: `b6a57516f454204ecd44a71864afd44d99d3f687e9098407c39b291021582b23`.
The three older evidence pins, source policy, business intents, operation IDs and
observation ages are unchanged. Raw receipts remain private in
`2026-11-01-full-cycle-admission`; no credentials were incorporated.

The joint rehearsal uses actual Firestore emulator transactions and durable barrier
journals, the real Sheets adapter with an in-memory service, and the real deadline
controller with injected elapsed time. It covers the complete forward/inverse,
exhaustion before Firestore, exhaustion after Firestore, a stopped inverse followed
by separately admitted recovery, and cleanup overrun. It reserves Sheets/readback
capacity before the first Firestore write, preserves committed receipts on a stop,
and refuses to report clean completion when cleanup exceeds its deadline. Both
services recover their original cells/rows; users, configuration, calendars and 117
notification events are preserved. It creates no new live orchestration entry point.

The elapsed clock is separate from the authority-fixture clock. Provider cleanup is
simulated: these tests prove scheduling and retained-state behavior, not real Google
latency, current observation age or combined live timing. Original/shared maintenance
remains closed. No Google calls, live Firestore, IAM, deployment, FCM, original
workbook or production access occurred in this block. No native changes or parity gap.

Validation: Node 22.23.4 build/full lint and focused CJS lint pass; **252 distinct
local tests** (251-test suite plus the final 29-test reviewer rerun) and **73 emulator
tests** pass with zero skips. The initial run had overlapping TypeScript builds and
an incorrect raw observation input; after serializing compilation and selecting the
retained normalized observation, both reruns passed. The test harness was not weakened.
Native gates were not rerun because no Android/iOS source changed.

**Next:** connect this tested joint scheduling order to the controlled composition,
including its Firestore deadlines and post-commit inspection path, before refreshing
current controls or requesting a concrete maintenance window. The successful copy
receipt alone cannot authorize that window. New implementation remains local;
HU-084/HU-085 remain open and PR #278 draft.


## Full budgeted copy cycle completed — 2026-11-01

The budget/compatibility implementation is delivered as `08b3098b`. The authorized
fresh synthetic copy completed one uninterrupted `runBudgetedCopy` execution:
**201,376ms total**, one 300s writer token and two batches of 55 requests each
(53 helper cells and two markers). The forward and inverse owner-preservation
manifests both pass; an independent retained-image comparison confirms all six
sheets' cell data and properties match the baseline after recovery. The two inverse
receipt markers remain intentionally; they are not user-cell changes.

| Phase | Measured duration |
| --- | --- |
| Preparation/readiness, including IAM wait of 124,619ms | 141,418ms |
| Forward, inverse and observations after mint | 19,661ms |
| Copy permission removal, readback and same-token denial | 4,491ms |
| IAM removal, explicit disable and checks | 4,254ms |
| OAuth cleanup phase | 31,686ms |

No deadline breach or pending HTTP request remains. The same unexpired writer token
received 404 after its copy access was removed. Drive and Sheets both returned 401
for the revoked owner token. Independent final IAM/runtime reads confirm the writer
is disabled, has no user keys or temporary bindings and is not used by a runtime.
The local lock was released. The owner may reopen the copy.

Before the confirmed window, initialization of this same new copy succeeded but its
first verification read failed; the sanitized receipt does not establish the root
cause. That session was revoked with both API denials. A separately recorded,
read-only preparation resumption verified the exact baseline at version 8 without
replaying initialization. No writer token or temporary IAM grant preceded the final
confirmed execution. These setup observations are excluded from the 201,376ms cycle.

Private evidence: `2026-11-01-budgeted-copy-execution`, receipt
`single-budgeted-copy-1793555719144`; preparation `ef471969…d80d5`, budget
`dd44fd97…955d2`. Complete raw snapshots, intents, deadline report and independent
verification are retained without credentials. Native visual inspection preserves
the fixture's fixed column widths (long synthetic labels remain clipped as before).
Build/lint and 166 tests are reused from the exact published source hashes; this
outcome update changes documentation only. No additional native/emulator claim.

**Next:** bind this full-cycle receipt and its budget to the existing admission packet,
then rehearse the combined barrier/Firestore/Sheets timing locally. The isolated Google
cycle does not measure that combined execution or refresh the original workbook's
sources/controls. Shared maintenance remains closed and requires its own current
observations and authorization. No original workbook, production, FCM or deployment
was touched. HU-084/HU-085 stay open, PR #278 draft; these outcome docs are local.


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
