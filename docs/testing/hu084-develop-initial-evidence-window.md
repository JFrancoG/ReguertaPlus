# HU-084 — Initial evidence and proposed develop window

## Develop migration verified on 20 November 2026

The separately authorized continuation sent one Sheets batch for `request-hu084-initial-73d77a7da377753f11f9`. The owner verified the 53 projected cells, both original operation markers and preservation of the rest of the workbook at 23:23:32 Madrid time. Three read-only Firestore inspections verified the 203 committed destinations in the migration that produced the 72 seasonal shifts. The continuation made zero Firestore writes.

Temporary access closed at 23:24:18 Madrid time. Drive denied the issued writer access to the file (404), IAM confirmed the writer was disabled and isolated, and both Drive and Sheets rejected the revoked owner reader (401). The terminal recorded the verified projection and successful cleanup. The private evidence is `2026-11-20-sheets-continuation15/resultado-develop.md` and `2026-11-20-sheets-continuation15/journal/access-Iy3G5G/events.jsonl`.

The next product step is one comparative UI review of the iOS and Android shift journeys. Engineering can review the candidate against the assembly-approved rules in parallel. Once the candidate meets its integration and access gates, market and delivery are the two outstanding normal-app scenarios on Develop. The four production scenarios belong to the separately authorized base-calendar activation. [Remaining work and acceptance gates](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md#remaining-work-as-of-2026-11-20)

## Local Sheets continuation for the existing operation

The continuation binds the original 55 requests to operation `request-hu084-initial-73d77a7da377753f11f9`. It reads the retained Firestore receipt, the checkpoint and all 203 committed destinations. A local exclusive claim precedes the temporary grant. The operator verifies the original workbook again after the grant, reserves time for readback and cleanup, and persists one dispatch intent before sending the batch. The first failed stage, a sanitized reason and the time are retained. [Continuation](../../functions/scripts/develop-sheets-continuation.cjs) · [Firestore readback](../../functions/scripts/develop-sheets-continuation-firestore.cjs)

| Focused local scenario | Verified outcome |
| --- | --- |
| Original grid and both markers absent | One batch submits 53 cell updates and the two original markers. The final read verifies the projection and preservation. |
| Projection and both markers already present | The operator verifies the workbook without requesting a write. |
| Partial grid, foreign marker, unrelated cell change, Firestore drift or expired authority | The operator stops before dispatch. |
| Response lost or no change observed after dispatch | The retained intent permits inspection. A second invocation cannot resend the batch. |

All four tests passed with a simulated workbook and local journal before the real Develop continuation. [Focused tests](../../functions/test/develop-sheets-continuation.test.cjs) · [Execution composition](../../functions/scripts/develop-sheets-continuation-operator.cjs)

## Attempt 15 closed with Firestore verified and Sheets pending — 2026-11-20

The maintainer authorized one attempt for `request-hu084-initial-73d77a7da377753f11f9` and confirmed the start at 22:39 Madrid time. All eleven replies were recorded. The operator closed at 22:47 with `inspection-required` in the Sheets phase. The authorization for attempt 15 was consumed.

| Destination | Verified outcome |
| --- | --- |
| Firestore | The transaction receipt and independent readback verified all 203 destinations and service versions. All 141 planned documents were created and the 62 original shifts were archived and removed from the active collection. Develop contains 72 seasonal shifts and retains all 117 notices. |
| Sheets | The journal records zero batch submissions. All 742 cell values and formulas on six tabs match the original snapshot. All 53 target cells retain their original value. The two complete owner snapshots after the Firestore commit contain neither of the operation markers. |
| Access and closure | Drive is restricted to its owner and four readers. The writer was disabled and isolated with zero direct IAM bindings or user-managed keys. Revocation of the temporary reader was confirmed by 401 responses from both Drive and Sheets. All provider calls settled and the 85-record journal closed. The Firestore barrier checkpoint is retained. |

The secondary Sheets inspection reported `read_back_mismatch` when checking the projection. The operator omitted the initial Sheets exception. At most 6.049 seconds remained at publication of the Firestore receipt to submit the batch while preserving the readback reserve. An offline simulation that reached the cutoff produced the same secondary result. The journal cannot establish whether the live submission cutoff was reached. The reproduction receipt is `2026-11-20-post15-diagnosis/forensic-receipt-private.json`.

[Local implementation and four scenarios](#local-sheets-continuation-for-the-existing-operation).

Private receipts are under `2026-11-20-interactive15-postflight/observation-vDPE5y/postflight-private.json`, `connected-reader-cells.json` and `visible-drive-permissions.json`. The terminal receipt is `2026-11-20-interactive15-preparation/run-result-private.json`.

## Package 15 ready for authorization — 2026-11-20

At 20:32 Madrid time the desktop entry used for the migration rebuilt package 15 in a fresh session. It verified 345 files and reproduced digest `78be41628977a97124822c4631dc8ccb92ad3316efa5a10ba20e4a02c9f5996a` for operation `request-hu084-initial-73d77a7da377753f11f9`. The startup seal is `e58ab426baff2816ac483df0d6ae1cf50963e93399e1673cd37f7c2ccb0f66e4`. Two independent processes using the corrected entry stopped at the missing authorization before opening Google. This preparation preceded authorization of attempt 15.

The owner read confirmed workbook version 307, the complete reviewed workbook image and its permissions. Both Drive and Sheets returned 401 after revocation. Firestore retained all 62 original shifts and 117 notices. Two read-only transactions found all four new operation keys vacant. The writer is disabled. Historical receipts include the pre-journal closure of attempt 14.

The decision covers one Develop attempt with temporary Drive and IAM access. The intended 203 Firestore writes include archiving 62 original shifts and creating 72 seasonal shifts. Sheets would receive one batch with 53 cell updates and two markers. Late effects from historical operations remain a risk. The maintainer subsequently authorized the attempt, accepted the risk and confirmed the start. The dedicated account can leave the workbook as it is.

The private decision sheet is `2026-11-20-interactive15-preparation/paquete-para-revisar.md`. The `actual-desktop-offline-review.json` and `review-before-consent.json` receipts in `2026-11-20-interactive15-desktop-session` record the desktop reconstruction and the pre-consent denial.

## Attempt 14 closed before the execution journal — 2026-11-20

The maintainer authorized one forward operation, accepted historical risk and confirmed the start. The operator dated the window at 20:15:56.750 Madrid time and stopped during local preparation. The reader began revocation about 91 ms later. No execution journal, lock or run receipt was created. The attempt authorization is consumed.

The desktop entry masked the original exception when closing the session. An offline diagnosis in the same process reproduced `unreviewed backend transition` in `historicalIamPreparation`. The process had retained the compatibility module predating package 14. The seal verified the files on disk while Node continued to run the already-loaded module. A fresh process reconstructed the same dated package offline. Private receipt `2026-11-20-interactive14-postflight/desktop-offline-diagnosis.json`, SHA-256 `8d028638b0682f14f723ef6593f8a014b872004cb44d0119273e7b5225953746`.

At 20:18:17, three read-only transactions and 47 HTTP reads verified all 203 destinations. The 141 documents due for creation were absent. The 62 shifts due for deletion retained their contents and service versions. All 14 collections matched, including 117 notices. The writer account was disabled and isolated. Revocation returned 200 and the reader then received 401 from Drive and Sheets. The Drive sharing panel showed restricted access, one owner, four readers and no temporary writer. The operator stopped before submitting a Sheets batch. At 20:22 an existing read connection compared all six tabs against the version 307 snapshot. All 742 values and formulas, notes, rich-text runs and validations matched. The comparison did not include full formatting, merged cells, metadata markers or the current workbook version. Private receipts `observation-NhdMvK/postflight-private.json` (SHA-256 `18b79090ad114638b2dc00f719c59ca9bc74b4f686f6e8d1b33c1bbb44e0517c`), `visible-drive-permissions.json` and `connected-reader-cells.json` in the same postflight directory.

**Desktop correction verified.** Before requesting access from Google, the operator checks for previously loaded project modules and rebuilds the reviewed package. At 20:22 the original desktop session rejected the cached module. After a desktop restart the same files reproduced the exact package 14 digest and verified all 343 sources. Both checks ran offline. The successor startup retains the first classified failure, its stage and timestamp before releasing access, including when cleanup fails. Six focused tests, Functions lint and the Functions build passed. Private receipts `actual-desktop-cached-rejection.json`, `actual-desktop-fresh-rebuild.json` and `2026-11-20-post14-start-correction/offline-receipt.json`.

**Decision at the close of attempt 14.** Prepare package 15 with the corrected entry and current observations. The private `2026-11-20-post14-start-correction/uso-del-cargador.md` records the template and binding steps. The `outer-entry-verification.json` receipt confirms that the normal desktop entry checks the loader and modules and rejects the spent package 14 before consent. Shared execution requires authorization for the new package. Migration acceptance requires verifying shifts and assignments across Firestore and Sheets and confirming removal of temporary access.

## Package 14 ready for authorization — 2026-11-20

The new package is sealed for one forward operation in Develop. Two owner reads verified workbook version 307 against 305. Cells, reviewed formatting and permissions matched. Google revoked the temporary read grant with HTTP 200. Drive and Sheets then returned 401.

The census of 14 collections retained all 62 shifts and 117 notices with their service versions. The 24 functions, three paused jobs, six ready indexes and reviewed effective permissions matched the reference. Two read-only transactions checked the source and the four unoccupied operation keys. The retained barriers for attempts 10, 12 and 13 and the incident from attempt 13 matched their records.

Operation `request-hu084-initial-d8f6a77838fe221677f4` has package digest `87bc33104403a84461b354380ee13e2f2226438565530d284a22361d1e8eb0fe` and startup seal `90d7a33d4eac164b00ae5c09d9bbb77d05de2b282fd5bf346ef0b2e8ac6e8219`. Independent review checked 23 sources of possible historical effects and 25 receipts. In a fresh process, the operator rejected startup without authorization and the desktop entry stopped before reading the OAuth configuration or opening Google.

**Follow-up.** The maintainer authorized the 203 Firestore writes and one Sheets batch of 53 cell updates and two markers. The session stopped during local startup. [Attempt 14 outcome](#attempt-14-closed-before-the-execution-journal--2026-11-20).

Private review files are `2026-11-20-interactive14-preparation/paquete-para-revisar.md`, `2026-11-20-attempt14-offline-review/sealed-startup-denial-private.json` and `2026-11-20-interactive14-desktop-session/review-before-consent.json`.

## Post-attempt 13 local rehearsal

The corrected Develop operator ran against the Firestore SDK and emulator. The rehearsal simulated human replies, the clock, Google and Sheets. After a 61-second wait for the pre-write observation, the operator checked the source and its service versions against admission, built the execution manifest and verified all 203 Firestore changes. Sheets received one simulated batch of 53 cell updates and two metadata markers. [Execution decision](../decisions/0028-materialize-develop-forward-writes-after-human-observation.md)

With a controlled clock, the write succeeded at an execution-manifest age of 60,000 ms and stopped at 60,001 ms. An external source change before materialization or between recording the manifest and applying it also stopped both destinations. On these rejections, the 141 documents due for creation remained absent and the 62 documents due for deletion retained their service versions. The operator now retains the first Firestore failure category, phase and time even if incident closure hits another error.

The rehearsal also checked authorization of the payload. Changing an admitted shift and recalculating every digest failed exact reconstruction against the original source before the execution manifest was emitted. All seven integration checks passed with zero skips. Functions lint and build passed. The private rehearsal receipt is `2026-11-20-attempt13-local-manifest-order/final-receipt.json`, SHA-256 `dba1aca5ea9221ae78dd68d9b26f6879102c9c26fe22b2e7e3adb79dc4573289`. Compatibility of the historical receipts was verified by reconstructing the 285 backend source hashes. The only changes in that set are the barrier adapter and its compiled JavaScript. In the same directory, `source-candidate-v2.json` identifies the 343 final operator source files, including seven differences from package 13. All 103 local dependencies loaded during an offline startup matched their recorded hashes.

With response delays of 33.886 and 18.245 seconds, the rehearsal had 90.359 seconds of work time left at Sheets submission, 15.359 seconds above the reserve. The second delay came from the incident response during attempt 13. Latency after a successful shared migration still requires observation. This variant uses a 20-minute execution window.

**Follow-up.** Package 14 incorporated the correction. Its authorization and outcome are recorded in the attempt 14 closure. [Package preparation](#package-14-ready-for-authorization--2026-11-20). The maintainer reports that the dedicated test account never uses the workbook manually and it is available for testing. The person attending the window can report known activity in chat without opening or closing the workbook. The operator verifies workbook state and permissions against the execution receipts.

## Attempt 13 closed during Firestore execution — 2026-11-20

The single authorized Develop operation passed admission and obtained its temporary writer credential. The journal recorded all eleven replies. The barrier retained an incident in the Firestore `operation` phase with reason `operation_failed`. Question 11 supported the readback needed to retain that incident. The journal omitted the first underlying exception. The package 13 authorization was consumed.

**Madrid time.** The manifest was materialized at 11:06:30.183 and its 60-second lifetime ended at **11:07:30.183**. Reply 10 arrived at **11:07:26.532**, within the displayed deadline and with 3.651 seconds left for pre-write checks. Observation 60 finished at 11:07:29.156. About 374 ms remained when record 60 was written. Three local replays of the required 61-record journal read took 638, 647 and 610 ms. Each replay exhausted the remaining time before the Firestore reads that precede manifest validation. The live journal records neither the clock at that check nor the underlying error. The expiry explains the locally reproduced failure. The first live cause is unresolved.

Offline replay with the attempt 13 package, original source versions and admitted manifest reproduced all 203 mutations at 60,000 ms and reached the notification fence reads. At 60,001 ms the executor rejected the same manifest as expired. The replay stopped before any write. The live journal does not record the instant when the transaction checked expiry. The attempt 13 postflight contains the private receipt `manifest-clock-offline/receipt.json`, SHA-256 `e28a3a97592f48e2ce6d7881d4650df010e230af762efafbd902879808ad4890`.

**Independent readback.** By 11:10:45 the verifier had completed two transactions and 47 read-only HTTP requests with zero errors. All 234 documents across 14 collections, the six singletons and the capture records matched. The 62 shifts and 117 notices retained their contents and versions. The operation and migration baseline remained absent. The retained barrier and incident matched the journal. Sheets received no batch and the complete workbook image matched the original. Drive and IAM access removal and OAuth revocation were verified. The workbook is available. Private receipt `2026-11-20-interactive13-postflight/observation-c4bvb0/postflight-private.json`, SHA-256 `3b32c26731e10b74b1ec8ee2ead2bbcc39b2ac6169ea03ef6379d40f571cfcb4`.

One additional read-only transaction checked each of the **203 manifest targets**. All 141 documents due to be created remained absent. The 62 documents due to be deleted retained their contents and both Firestore timestamps, `createTime` and `updateTime`. Private receipt `manifest-targets-Sn207x/receipt.json` in the same postflight directory, SHA-256 `aa1716fc55381147a9a7738d035b550a82f3ea86aad8fda7a1451d1891ef6284`.

**Follow-up.** The diagnostic and local rehearsal are documented above. The Develop migration and all six functional acceptance scenarios remain pending. [Local rehearsal](#post-attempt-13-local-rehearsal)

## Attempt 13 package prepared — 2026-11-20

The Develop operator for attempt 13 was prepared and reviewed locally. It includes the three modules that correct the reply deadline. Review covered 343 source files and verified that startup loaded 103 of them. The independent review checked 17 private materialization inputs. The startup seal covers 16 files. A fresh process rejected startup before provider access, and the desktop client stopped before requesting OAuth.

The owner captured two matching snapshots of workbook version **305**, up from version 303 in package 12. The contents and permissions matched. Revocation returned 200 and subsequent Drive and Sheets reads returned 401. All 14 Develop collections matched, including the 62 shifts and 117 notices. Two read-only transactions checked the source and the four unoccupied keys for the new operation. The historical barrier records for attempts 10 and 12 were preserved. The writer remained disabled and isolated.

| Package identity | Value |
| --- | --- |
| Receipt | `develop-original-20261120-interactive-13` |
| Operation | `request-hu084-initial-0eb52a3163ebea83f3b4` |
| Package digest | `shift-planning:v1:sha256:10f10255e4e96326c02bbd87992e5ae4cc3c8e2b9adeaaa73d7bad7490b145b3` |
| Startup seal SHA-256 | `452f2c9eaa1c4a929aac787684fffc396a7f0193ca6f1b27369c1138d512441f` |

The planned forward operation comprised 203 Firestore writes and a Sheets batch with 53 cell updates and two markers. The 140-write inverse required a separate decision. The package had no dated window at preparation time, and preparation preserved business data. Private receipts `2026-11-20-interactive13-preparation/startup-integrity-private.json` and `2026-11-20-attempt13-offline-review/attempt13-independent-package-risk-review-private.json`.

## Attempt 12 closed during admission — 2026-11-20

The operator received eight replies and acquired the barrier for package 12. Reply eight arrived at **09:56:50.498 Madrid time**, 15.963 seconds before the displayed deadline of **09:57:06.461**. The operator never issued a ninth question. Record 47 returned `admission_not_proven` with no final manifest. Record 48 captured the outer admission assertion. Record 64 closed as `inspection-required` with all provider calls settled.

**What prevented admission at reply time.** The observed quiet interval ended at 09:46:44.861. The ten-minute lifetime of its barrier evidence ended at **09:56:44.861**, 5.637 seconds before the reply. The package verifier accepted the evidence from records 24, 39 and 43 at the start of question eight and rejected it at the recorded reply time. Admission stopped during manifest preparation, before the two technical reads subject to the 60-second limit. The journal omits the first inner exception, so a concurrent failure remains possible. Replay receipt in the same postflight directory `chronology-VzNE91/receipt.json`, SHA-256 `d91af15d6ecb09e7acf03e32797dae4bba2e6ab50337ac27e91988ba206b4707`.

**Outcome.** Independent readback at 09:58:14 confirmed the contents and versions of all 62 shifts and 117 notices. The operation document and migration baseline were absent. The retained barrier matched the acquired evidence and had no failure record. The operator never issued a writer token or submitted a Sheets batch. Removal checks passed for Drive, IAM and OAuth. The writer was disabled and isolated, with no keys or bindings. The journal contains 65 records. Private receipt `2026-11-20-interactive12-postflight/observation-smLY0b/postflight-private.json`, SHA-256 `cb14998cbf2a0beae33e9925b353a9cd37f0624f2d1fc5eb8c38882a6517d1c1`.

**Local correction.** The initial activity report and subsequent barrier reports display the earliest applicable deadline. Two focused regressions verified that a reply after evidence expiry is rejected while the phase is still open, and that an earlier phase deadline still takes precedence. The Functions build and lint passed. The correction is local to the worktree and has not been deployed.

**Attempt 12 follow-up.** Package 12 is consumed and immutable. The three corrected modules were reviewed and incorporated into package 13. [Successor preparation](#attempt-13-package-prepared--2026-11-20).

## Test reader setup — 2026-11-20

The maintainer authorized the dedicated Google Cloud project `reguerta-turnos-lector-dev`. Google confirmed the project is active and the Drive and Sheets APIs are enabled. Following the maintainer’s explicit acceptance of Google’s user data policy, Turnos Develop was registered as a desktop client in testing. The console showed one test account (Plus Projects Test) and the two read-only scopes for Drive metadata and Sheets. Two complete owner snapshots matched at version 303. The preserved contents and authority match the baseline. Revocation was verified by 401 responses from Drive and Sheets. The materialized packet contains 203 planned Firestore writes, 53 helper cells and two markers. Two read-only transactions matched the source and confirmed both barrier slots absent for the new operation. The workbook remains available. Today’s census matched all 14 Develop collections, including 62 shifts and 117 notices. All six indexes were ready and writer isolation was verified. The raw runtime inventory digest changed. The previous evidence records only the aggregate digest. Private receipts are in `2026-11-20-reader-project` and `2026-11-20-interactive12-refresh`.

## Chat check before another window — 2026-11-12

With the sheet available, the maintainer acknowledged the availability prompt and the chat operator confirmed receipt in the same conversation. This verifies a round trip to the chat operator. It is neither a late answer for attempt 11 nor a quiet-window confirmation, migration authorization or risk acceptance. No window started. At 17:11 Madrid, one read-only transaction matched the keys and service versions of the 62 Develop shifts and 117 notices. The candidate operation, migration baseline and both barrier records were absent. Private receipt: `2026-11-12-interactive12-source/scope-1794499877958.json`. This check does not cover the workbook or the remaining operator controls. The subsequent owner read established **workbook version 303**, up from 301 in the previous packet.

The owner verified six sheets, 63 merges and the requested protection and developer metadata against the baseline. All 742 populated cell values or formulas and their coordinates were reconciled. A direct cell read resolved one space rendered differently in the Playground. An independent connected reader checked 155,098 grid positions across 47 ranges. Forty-four matched the exact representation. All scalars, arrays and positions in the remaining three historical ranges matched after omitting empty object properties. The census of 14 collections, 24 Functions, three paused jobs and six indexes was renewed. The writer was isolated and disabled. Its IAM policy contents matched despite a changed etag. The historical inventory digest difference cannot be attributed to a particular resource.

The Playground truncated the owner grid response, including the bounded alternative. The independent reader has separate provenance. Google confirmed removal of the temporary connection and the same session returned 401 from both Drive and Sheets after successful 200 probes. Evidence is in `2026-11-12-interactive12-owner/browser`. A proposed next step is to use the local reader with Google's installed-app consent to obtain two complete owner snapshots and prepare the packet for version 303. The operational window has not started.

## Attempt 11 closed before migration — 2026-11-12

After fixing the caller's start reference and verifying the same instance across invocations, the maintainer provided a fresh quiet confirmation. Window 11 was dated **12:21:55–12:41:55 Madrid**. Temporary access was granted. The first owner challenge was emitted at 12:22:29 and sent to chat at 12:22:36, followed by a reminder at 12:29:27. No valid reply was recorded in the journal by the 12:34:25 deadline. Initial evidence collection was rejected at that checkpoint and cleanup completed at **12:34:52 Madrid**, with zero breaches, cleanup failures or pending provider calls. Chat submission evidence does not establish when the prompt was seen.

All 32 journal records were verified, including the native grant and removal. The run stopped before the initial seal, barrier, admission or writer token. No joint intent, Sheets batch or business writes occurred. Independent ADC postflight used two read-only transactions and 31 queries, confirming the original content and versions of all 62 shifts and 117 notices, and absent operation, migration baseline and barrier evidence/failure. The writer was disabled and isolated, with zero user keys or temporary bindings. OAuth revocation was verified against Drive and Sheets. Final native sharing showed the owner and four readers without the writer. The maintainer was notified that the sheet could reopen.

This single-attempt authorization is consumed. The next investigation concerns the first challenge's response channel. Any further execution needs a new review and its own authorization. [Spanish evidence](../../docs-es/testing/hu084-evidencia-inicial-ventana-develop.md#intento-11-cerrado-antes-de-la-migración--2026-11-12).

## Authorization and preparation of window 11 — 2026-11-12

The maintainer authorized the single Develop forward operation with its scoped temporary permissions and separately accepted the historical risk. Both receipts (12:00:55 Madrid) and the startup seal verified. The first quiet reply arrived at 12:12:48 Madrid. The caller did not retain its verified start handle across invocations. No dated window receipt, migration journal, lock or run result was created. The quiet reply expired and the maintainer was told the sheet could reopen. No writer grant or business migration took place. The single forward authorization remains unconsumed. Local evidence is in `prewindow-caller-outcome.json`.

## Successor operator and attempt 10 review — 2026-11-12

All 72 chained records and the matching postflight were verified. Records 39, 52 and 55 retain the barrier, admission and positive writer check. Inspection at 56 reports Firestore `not-observed` and Sheets `not-started`. Terminal 71 requires inspection with verified cleanup and settled provider calls. The source was unchanged and the maintenance document absent. There is no business mutation to reverse. The historical barrier occupies its operation key. The first live exception was not recorded.

The private successor imports the canonical session wrapper through the attended entry for both normal and recovery factories. Its review pins 341 source files (336 old pins unchanged, three changed and two newly pinned). Offline reconstruction of the prior 17 package inputs reproduces the consumed operation. The successor rejects that operation, package and preparation even under a new receipt. That initial check used an unbound successor with authorization and window unset.

The existing CLI session renewed 42 project-control requests and 37 Develop-only Firestore reads. The census matches all prior payloads and service versions, including 62 shifts and 117 notices. Six indexes are ready, the writer remains disabled and isolated with no user keys or temporary grants, and 24 Functions match after filter-order normalization. The writer policy etag and raw isolation inventory digest changed. Current isolation checks passed; retained evidence cannot attribute the raw inventory change to a particular resource. This difference remains visible for packet review. All requests were read-only.

The runner retains the first caught exception's stage and a safe reason. Unrecognized provider errors retain a generic classification without provider text. Functions build and lint, scoped CJS lint, three runner checks and three private wiring checks passed. After aligning the packet directory with the materializer, only its affected entry check was rerun (1/1). The prior 356 regression and 98 emulator executions remain historical evidence. The changed entry and failure handling were tested locally with simulated providers.

The first preparatory read used the usual Firebase account, as confirmed by the maintainer. It produced no observation; the original bridge did not retain its exception. Revocation and subsequent Drive/Sheets denials were verified. The second session used the verified owner with the two read-only scopes and no refresh token. Thirteen reads verified the workbook, its parent and ACLs, and two identical content captures. Workbook version 301 succeeds the historical 299. Revocation returned 200 with eventual same-token 401 on both services.

Fresh package `beab18309646…d94e4ea6` preserves business content. Its forward plan specifies 203 Firestore writes, 53 helper cells and two Sheets markers; the 140-write inverse requires separate recovery authority. Two read-only transactions confirmed matching source and absence of both barrier evidence and failure for the new operation. The only passive blocker was `window_scope_missing`; there were zero write attempts. An independent review verified the source/packet pins, 23 predecessors and 25 receipts. The concrete operator is now bound to the reviewed packet under a 16-file startup seal. A fresh process verified the identifiers and refused to continue without operation approval and risk acceptance, with zero provider calls. Its status is `READY_FOR_FRESH_AUTHORIZATION`. The maintainer can now review the exact package and residual risk of delayed historical Develop work. Single-attempt forward authorization, acceptance of that risk for this package and confirmation of the actual twenty-minute quiet window are separate decisions. No writer grant, barrier acquisition or migration occurred. [Spanish evidence and private receipt locations](../../docs-es/testing/hu084-evidencia-inicial-ventana-develop.md#operador-sucesor-y-revisión-del-intento-10--2026-11-12).

## Interactive twenty-minute preparation — local, 2026-11-02

The second stopped attempt and attended private-launch evidence are delivered in
`d7d11eaf`; exact remote HEAD was verified before this work. The maintainer offered
20 or 30 minutes. **Twenty minutes is the reviewed maximum for a new explicit
original-develop variant; thirty is not supported.** No actual dated window or new
execution authorization has been collected.

[ADR-0027](../decisions/0027-collect-coherent-develop-observations-before-writer-token.md)
records the local correction. A complete phase observation now supplies its owner
and administrator projections together, with fresh independent phases before/after
the callback. Held entry reads its immutable checkpoint separately. Acquisition,
admission and execution use 3 + 3 + 2 full observations instead of 7 + 8 + 7.
`original-develop-deferred-writer-v1` is bound to the exact operation/journal and
moves acquisition/admission before the single writer token. Default/copy ten-minute
behavior remains unchanged. Preparation may use 780 s, initial collection 750 s;
IAM waits at least 120 s there. Token 300 s, work 150 s, cleanup 60/90/120 s,
manifest age 60 s and evidence age ten minutes remain unchanged. An unanswered
human request expires at the current stage deadline, not the outer window end.

The new private operator uses the attended start/reply interface. Each actual human
reply keeps its own request/response identity and observed time; unchanged report
facts keep a stable administrator revision. This prevents fresh acknowledgements
from being mistaken for administrative identity drift. Outer technical-template
package/preparation/plan bindings are checked against the regenerated packet.

Historical evidence compatibility is explicit: all 285 backend-source entries
reconstruct the previous digest by replacing only the barrier adapter TS/compiled
JS. The default historical budget is reconstructed by replacing only its reviewed
source hash; deadlines and receipts are not changed. All 17 raw input files remain
pinned. Package `7201f1cf…f257715` replaces `9d528701…b8f` solely through historical
provenance summaries; source policy, forward/inverse intents/digests, operation IDs,
203/140 Firestore writes, 53 helper cells, two markers and published dates/order
remain identical. Materialized preparation is `373ee000…faced`.

Final local readiness is **READY_FOR_FRESH_AUTHORIZATION**, never live admission.
The real-observer regression first proved that frozen source-set equality rejects
the owned 62-to-72-row commit before Sheets. The final phase now independently
inspects the committed receipt and verifies exact source afterimages/service
versions, unchanged unrelated rows and append-only capture history. New observed
cores must match exact owned create/delete transitions. The actual current-source
digest remains separate from historical causal identity; unknown deliveries stay
unknown and unreplayed. The strict path still rejects drift. The new proof and
twenty-minute mode are forward-only; they do not enable another inverse.

Final Node 22.23.4 validation: **328 repository regressions + 30 owned-transition
unit/SDK-emulator cases + 14 private tests**, zero failures/skips. Full Functions
build/lint, scoped CJS lint and diff checks pass. The decisive emulator gate uses
the real observer, actual Firestore snapshots/versions and independent retained
inspection. Its 98.702s positive cycle includes eight real 12s waits and asserts
post-mint work below 150s. Field drift, version ABA, unrelated source/capture,
slow mint/response and unanswered-human expiry preserve stop/cleanup behavior.
All 553 code/script/test/compiled files stayed identical during the final SDK gate.
Google/human/IAM lifecycle ports remain explicit doubles: no live latency or actual
human/browser execution is certified. The initial collector separately accepts
slower challenge replies under twenty minutes and rejects them under default ten.
An initial raw-payload hash discrepancy was corrected with the existing production
public materializer and production-built fixtures; the failed gate is retained.

Private evidence: `2026-11-02-interactive-window-preparation` and
`2026-11-02-interactive-window-local`. Both preceding 21-entry journals and their
cleanup validate. The fresh receipt `develop-original-20261102-interactive-03` is
unconsumed; approval, dates and human commitments remain empty. Its local execution
readiness guard binds the validated forward variant and exact packet; actual
approval and the dated quiet window remain mandatory. No Google/IAM/OAuth/Sheets/production action or
maintenance entry was performed in this preparation. No Android/iOS change or new
parity gap. No app rebuild is needed for backend-only changes.

## Second authorized attempt: stopped and cleaned up — 2026-11-02

After renewed access and matching workbook/batch/control/source preflight, the
maintainer confirmed ten minutes from the immediately announced start. Receipt
`develop-original-20261102-active-context-02` binds **09:37:55.386–09:47:55.386 UTC**
(**10:37:55–10:47:55 Europe/Madrid**). The all-day closed-workbook statement does not
extend the window or permission lifetime. The single attempt is consumed.

The executor enabled the writer and added its temporary IAM grant. It queued the
native editor grant, but the launching invocation returned without attending it;
the 20s wait expired. Retained events and the code path identify this coordination
failure. The attempt journal retains only the generic terminal reason; it is not
credited with a diagnostic it did not record. Native dispatch never occurred. No
workbook editor grant, writer token, post-grant human agreements, maintenance entry,
business writes, FCM, inverse, replay or production access occurred.

Cleanup finished at **09:39:03.593 UTC (10:39:03 Madrid)**: owner/four readers,
temporary IAM removed, writer explicitly disabled and isolation verified. Online
owner OAuth without refresh was revoked; the same token returned 401 from both
Drive and Sheets after two probes. The verified journal has 21 entries, no pending
files, zero in-flight calls and no stage-budget breaches. Native-action expiry is
the setup failure, not successful migration. Local exclusion is released and the
maintainer's quiet window has ended. Develop migration remains pending; HU-084 and
HU-085 stay open and PR #278 draft.

The exact executed composition and its SHA-256 are retained privately under
`2026-11-02-native-context-retry-preparation`, alongside events, preflight, visual
capture and receipts. The real journal reader verifies the full chain. The package
is unchanged: 17 pinned inputs, 203 Firestore writes, 53 helper cells and two markers.
The workbook was version 287 before launch; this session did not write it.

The subsequent local correction puts foreground attendance in the actual interface:
`startAndAttend` launches and attends native actions in the same active invocation;
`answerAndAttend` resolves an actual human reply and attends its continuation.
Separate public `run`/`answer` entry points are removed. `attend` resumes a provider
wait. It hands back a human question, terminal state or explicit provider wait after
up to 45s between actions; an already-started action settles before handback under
its existing stage deadline. Unattended expiry now records its own diagnostic.
There is no deadline extension, invented reply or repeated action.

This fixes the concrete launch mistake; arbitrary interruptions between invocations
can still expire the operation, with containment retained. Before another attempt,
prepare a fresh receipt/authorization and use the attended interface directly.
Consumed approval does not permit execution now. No workbook closure is needed for
local preparation.

The eight preceding tests predated this execution and did not establish the actual
launch path. Subsequent local validation passes **16 tests, zero failures/skips**,
with focused lint clean. Independent review found and corrected diagnostic-write
failures interrupting containment; both paths have regression coverage. Private
tests ran with Node 23.11.0, not a new deployed Node 22 runtime gate. An actual browser
read through the new driver completed successfully without granting permission or
writing. It uses the same driver as the concrete interface and covers grant/removal
success and failures, unattended expiry, slice boundaries, human replies and action
settlement. Native/emulator builds are not repeated for documentation/private
composition; no Android/iOS changes or new parity gap. New documentation remains
local after `874146e3`.

Historical preparation: the maintainer authorized a single new attempt; one read
session was retired while waiting for the window reply. An earlier session whose
credential accidentally appeared in diagnostic output was revoked and verified by
401 from both APIs before renewal. Receipts contain no credentials. Those preflight
reads neither granted writer access nor opened maintenance. The later authorization
was consumed by the attempt described above.

## Authorized 2 November attempt: stopped and cleaned up

The preceding review is delivered in `86af466b`. The maintainer authorized the forward
operation/temporary permissions and confirmed the workbook closed, online and without
other intervention until 10:15 Europe/Madrid. Actual preflight retained version 287,
owner/four readers, matching technical controls and matching Firestore sources;
read-only admission still rejected only `window_scope_missing`.

The single attempt began at **09:05:11.669 UTC**. It enabled the dedicated account and
added its temporary IAM grant, but stopped before native Share dispatch. No Sheets
editor grant, writer token, post-grant agreement, maintenance entry or business write
occurred. No FCM, retry, inverse or production access. Terminal state is
`inspection-required`.

Cleanup finished at **09:06:23.770 UTC**, without timing breaches or pending calls:
owner/four readers, temporary IAM removed, writer explicitly disabled and isolation
verified. The owner's Online OAuth session had no refresh token and was revoked;
the same token returned 401 from both Drive and Sheets after four probes (32.837s).
The maintainer may use the workbook again.

The original setup error was not retained in detail. A subsequent read-only
reproduction shows that browser calls after the `cua_repl` invocation ends fail with
`node_repl exec context not found`, while the same read succeeds inside an active
invocation. This proves a concrete private-composition incompatibility without
retroactively claiming an unrecorded original error. The local composition now queues
the native action for an active invocation that awaits completion, expires before
dispatch after 20s unattended, retains failure diagnostics and does not retry. The
exact executed file is preserved separately. Deployed code and the package are unchanged.

Validation: four new local tests (single dispatch, timeout without UI, retained failure,
and in-flight settlement), focused lint and an actual read through the corrected
connection. No further permission change or write was tested. Private evidence:
`2026-11-02-authorized-develop-window`, including the 21-record journal and receipts.
Native/emulator builds were not repeated: repository changes are documentation only,
with private operator composition outside Git. No app parity gap.

Next: review the corrected composition and prepare a new attempt with a new dated
window and receipt identity; consumed authorization does not permit replay of this
window. Post-grant confirmations remain required; the initial closure statement
cannot certify later facts. Issues stay open and PR remains draft.

## Authority and owner refresh; dated review — 2026-11-02

The receipt/human-input block is committed and pushed as `8edfc7df`; exact remote
and draft PR #278 head match. Its 126 local tests, three private checks and build/lint
results were reused after all 346 execution/package file hashes matched.
The following read-only renewal and documentation are local, pending commit.

Private evidence: `2026-11-02-authority-owner-refresh`. Actual UTC observations:
Cloud `2026-11-02T08:07:46.878Z`, atomic develop census `2026-11-02T08:07:40.706Z`,
owner/Sheets `2026-11-02T08:11:33.635Z` (Madrid is UTC+1 on this date).

- All 24 Function configurations and 24 Run service names/revisions/identities
  match; Rules, project/invoker IAM, three paused jobs and six READY indexes match.
  Global Run jobs/worker pools/instances are empty. Scheduler covers 34 regions;
  all 88 trigger/active-build queries in 44 explicit locations succeed and are empty.
  App Engine services, Extensions and workload identity pools are empty.
- Ten service accounts, four disabled, zero user-managed keys and zero direct
  account IAM bindings. The only addition since the nine-account October inventory
  is the reviewed develop Sheets writer; it is disabled and absent from runtimes.
  Cloud Asset remains disabled; inventories use the individual provider APIs.
  Cloud Build has no usable locations listing here: coverage is the 44 named locations,
  not a claim that a failed discovery call proves no resources.
- All reviewed Firestore collections/singletons and private intake contents/service
  versions match exactly, including 12 events and 16 deliveries. The real executor
  performs one read-only source transaction, zero control calls/writes, and rejects
  admission solely with `window_scope_missing`. This is not a historical drain proof.
- The original develop workbook remains version 287 with its owner and four readers;
  its parent has only the owner. Two direct full-preservation reads and two bounded
  six-zone reads agree with each other and the previous evidence. Dates, order,
  values and reviewed formatting are unchanged. No writer permission is present.
- Explicitly authorized owner OAuth used only metadata/Sheets read scopes, Online,
  no refresh token. Revocation was accepted and the same token returned 401 from
  both Drive and Sheets after six probes (53.492s); temporary local credential removed.

The renewed 23-control binding uses these actual observation times and pins the
25 receipt/source files (including ten retained verified source archives). Historical
closure receipts retain their original dates. All 23 predecessor work counts remain
unknown. Current disclosure, authority observations and future human consent remain
separate. The package reproduces exactly from its 17 pinned inputs; package/prepared/
forward/inverse identities and the 203 forward / 140 inverse Firestore writes,
53 helper cells and two markers are unchanged. No new algorithm or provider control.

### Concrete proposal for review, not authorization

**2 November 2026, 10:00–10:15 Europe/Madrid (09:00–09:15 UTC).**
OAuth and the native permission channel must be ready before this interval. The
five-minute read-only preflight is separate from the ten-minute writer budget.

| Madrid time | Proposed boundary |
| --- | --- |
| 10:00–10:05 | Final read-only reconciliation and explicit operation/risk review |
| 10:05–10:08 | Exact permission lifecycle, minimum 120s IAM wait and initial evidence; collection must finish before 10:07:30 |
| 10:08–10:10:30 | One forward direction, only after successful admission |
| 10:10:30–10:11:30 | Withdraw file access and verify denial |
| 10:11:30–10:13 | Withdraw IAM and explicitly disable writer |
| 10:13–10:15 | Revoke owner OAuth and verify denial |

The dates exist only in `dated-inputs-private.json` / `dated-review-private.json`.
No receipt, risk acceptance, owner/admin confirmation or report was fabricated.
The normal undated input forms remain unconfirmed. No grant or writer token was made.
Exactly one future 300s token, 180/150/60/90/120s stage caps and 600s total remain.
These boundaries are maxima, not sleep targets or guarantees about noncancellable
provider/human calls. Strict submission/headroom checks can reject earlier.
The morning snapshots will be too old for this proposed window: collect fresh initial
observations and the 30s quiet interval after actual permission closure, together with
new owner/admin commitments/reports. Maximum evidence age remains 600s. If the date
is missed, redate/review and obtain a new explicit confirmation; never start late.

Validation: three renewed private offline checks pass, the dated plan passes the real
initial-plan validator, the budget accepts the proposed interval and rejects expiry,
and the actual barrier rejects the unconfirmed template. Package reproduction and
17 input pins pass. Cloud read 1.113s, owner capture 8.246s; these isolated measurements
and the 53.492s cleanup do not certify the complete Google/human cycle.
No runtime code/native changes: full build/lint and 126 tests reused as pinned above;
no emulator/native gates rerun for this evidence/docs-only block, no parity gap.

Next review this proposal, authorize the exact operation/temporary permissions/risk,
then prepare the access channel and request the actual owner/admin quiet window.
No maintenance, migration, Sheets write, FCM, deployment, IAM/ACL change or production
access occurred. No need to close the workbook now. HU-084/HU-085 remain open; PR draft.

## Previous checkpoints (retained history)

Concrete initial collector committed/pushed as `4dd7bb54` (2026-11-02). The retained
technical-receipt binding and human input adapters below are **local, pending commit**.
No maintenance is open. Retained observations keep their actual times.

## Exact evidence and unchanged operation

Private directory: `2026-11-02-initial-evidence-window`.
`initial-evidence-draft-private.json` pins the reviewed package, current Cloud/census
observations, retained owner image, source inspection and native-channel review.
It enumerates all 25 writer controls and all eight contained delivery routes.
The envelope, scope, owner/admin agreements, operation-specific historical-risk
acceptance, permission-action closure receipt and actual quiet interval remain null.
The draft fails the real observation constructor before any provider access.

The package remains `9d5287014d6ac4ff82b62841f164aeb3137e6545bbf72ad729e04e5d617d1b8f`;
forward operation remains `request-hu084-initial-68e09b87cef3ef75a357`, inverse
`hu084-inverse-68e09b87cef3ef75a357`. The new observations match the pinned sources;
there is no reason to regenerate the package merely to attach later readbacks.
The reviewed forward intent remains 203 Firestore writes, 53 helper cells and two
markers; dates/order and historical notices remain protected. Inverse stays a
separately admitted direction, never an automatic retry.

Fresh read-only observations (Europe/Madrid, 2 November):

- Census at 00:17:55: all 14 reviewed collections, singletons and retained intake
  records preserve their exact contents/service versions. There are 62 shifts,
  48 projected users, four calendars, three config documents, 117 notices,
  12 captured events and 16 delivery records. Initial planner authority is absent.
- Cloud at 00:18:02: 24 reviewed Function configurations, three paused jobs, Rules,
  project/invoker IAM and six READY indexes match. Writer disabled, no user keys
  or own IAM bindings; absent from the checked runtime inventory.
- A raw inventory digest differed. Two complete new inventory responses differ
  only in event-filter order. After normalizing that order, they match; the
  24 Function names/configurations and 24 service names/revisions/identities match
  the reviewed configuration. The previous raw response was not retained, so its
  hash alone is not described as proof of an unchanged complete historical response.
- The real executor performs one read-only source transaction and zero control
  acquisitions/writes. Sources match; admission rejects `window_scope_missing`.
- Owner Sheets evidence is **retained**, from 1 November at 21:50:39 Madrid time.
  It is not a new window observation. Its OAuth session was revoked previously.

The Cloud read took 1.072s and the census 3.709s. These isolated read durations do
not establish total permission, admission, Sheets or cleanup latency. Unknown
historical work and delivery counts remain unknown; no notice is replayed.

## Proposed schedule, not a started window

Reserve **up to 15 minutes** from a later explicit confirmation: up to five for
read-only initial inputs and ten for the existing writer cycle. OAuth setup must be
ready before that confirmation. No actual start/end or IAM condition is filled now.

| Offset from future confirmation | Maximum purpose |
| --- | --- |
| 0–5 minutes | Read-only reconciliation, reviewed plan and preliminary commitments; no grants or maintenance |
| 5–8 minutes | Exact owned permissions, minimum 120s IAM propagation, actual initial-evidence completion, one token |
| 8–10:30 minutes | Barrier/admission and one forward direction |
| 10:30–11:30 minutes | File permission withdrawal and same-token denial |
| 11:30–13 minutes | IAM withdrawal and explicit writer disablement |
| 13–15 minutes | OAuth revocation and Drive/Sheets denial verification |

These are upper bounds, not sleep targets. Operational caps stay 180/150/60/90/120s
inside 600s; no permission lifetime is enlarged. Existing strict headroom checks
may reject before a displayed boundary. Missing an initial-input or execution
boundary stops progression; it never silently extends the window.

Proposed command-level values: a 30s observed quiet interval, at most 600s evidence
age. The initial capture and quiet interval now follow the actual permission closure
and final agreement confirmations, within the existing preparation budget. The older
proposal to finish that interval before starting the writer cycle is superseded.
The immutable quiet-end remains part of freshness; later readbacks must not redate
it. These values are proposals, not deployed defaults or proof of historical drain.
No agreement, risk acceptance or provider timestamp is generated from this schedule.

## Corrected startup and recovery

The journal first records the immutable operation/package, window, planned scope,
owner/admin intent, historical-risk acceptance and reviewed observation inputs. Only
four derived scope hashes remain null: owner agreement, administrator agreement,
combined controls and the historical assessment. The intended participants, authority,
source, operations, deadlines, risk acceptance time and confirmation ID cannot change.
The latter hash may change only because the actual assessment time is now observed.

After granting the exact permission, the native channel closes the sharing dialog,
checks that it is dismissed, independently reads the ACL and returns a closure receipt.
Its grant capability is single-use; it creates no temporary owner write credential.
The named owner's login remains a retained human capability under ADR-0021; dismissing
a dialog does not claim to revoke ownership or close unrelated owner automation.
A lost acknowledgement or a dialog that stays open yields no successful closure.

The original session binds that receipt to this attempt, its pre-effect binding and
the complete before/after permission transition. The explicit `readInitialReview`
port then supplies real final confirmations and the initial evidence; it receives
the same bounded fetch/clock, owner capture and authority guard. It must await all
reads. The sealer does not synthesize confirmations, timestamps, quiet intervals or
closure facts. Confirmations must bind the completed intent after this grant closes;
the capture and quiet interval follow them. Old receipts, future dates, changed
participants/windows/sources, substituted inputs or stale evidence fail closed.

`google-initial-evidence-sealed` is durably appended before requesting the single
writer token. Service construction now occurs after that receipt exists. The IAM
minimum wait still starts at the actual grant and includes time spent completing
the evidence; no additional 120-second wait or larger permission window is added.
After propagation, the session rechecks the workbook and evidence freshness before
minting. Admission uses only the verified sealed scope, never the nullable plan.

Recovery reads the same seal historically and never recollects confirmations,
regrants permissions, mints or resumes execution. If setup stopped before the seal,
barrier/business inspection remains unavailable and independent ACL/IAM/OAuth cleanup
still proceeds. An interrupted journal append retains inspection-required status.
Abort during collection awaits settlement, then cleans without requesting a token.
No business validator, production path, journal format, auto-inverse or runtime
permission/token limit was relaxed.

## Startup-correction validation (published in `25109ad4`)

Validation: **115 distinct local passes** (91 unchanged regressions from the 113-case run plus the final 15 seal and nine native-channel cases), **90 emulator passes**, zero failures/skips. Build, full lint, focused CJS lint and diff checks pass.

Private correction evidence: `2026-11-02-startup-seal`. Functions build/full lint and
focused CJS lint pass. Local tests cover successful ordered sealing, the actual
service factory, changed/old/missing receipts, stale confirmations, expiry during
IAM propagation, interrupted collection/disk writes and cleanup-only restart.
The Google HTTP and native UI results in these new tests are synthetic; the emulator
regression uses real local Firestore. They do not certify joint Google/UI latency or
actual closure of the live Spanish dialog. Android/iOS app sources are unchanged.

Next prepare the exact pre-effect plan and the concrete initial-review collection
for the proposed window, retaining the package and refreshing only the evidence
that requires renewal. Verify that final confirmations, capture and quiet interval
fit the same preparation deadline before requesting execution. Existing live review
hashes must be regenerated for this changed code. The historical incomplete draft
remains non-executable; no real receipt or window is manufactured by this rehearsal.

No IAM/ACL mutation, owner OAuth renewal, Sheets write, FCM, deployment, maintenance
or production access in this correction. HU-084/HU-085 stay open and PR #278 stays
draft. No sheet closure or user action is required now.

## Concrete collection and timing rehearsal — 2026-11-02

`develop-initial-review-collector.cjs` replaces the generic initial-review input
with explicit existing read adapters. Its reviewed template must already contain
the technical closure receipts and manifest; dynamic readback dates, human agreements
and the quiet interval must be absent. The factory checks the exact prepared/review
package before any provider call. Nothing discovers credentials or starts a live run.

After the verified native permission receipt, it collects the owner's confirmation
for that completed intent, then the administrator confirmation bound to the owner
agreement. It reads Cloud controls/authority, the four-route census, the whole source
through a read-only SDK transaction, and the owner's direct workbook image. After
the minimum quiet interval it repeats those observations and obtains explicit final
human reports. Unchanged contents never substitute for a human report. The existing
causal comparator permits only the reviewed append-only capture history and preserves
unknown delivery counters. The real evidence validator must accept the resulting
scope before sealing. Every group settles before the next phase or cleanup.

The collection deadline is **window start +150 seconds** in the ten-minute window,
leaving 30 seconds inside the existing 180-second preparation allowance for remaining
checks. Native grant time and both confirmation challenges consume this same allowance.
The two-minute IAM wait still runs from the actual grant, including collection time;
there is no additional wait or expanded token/permission lifetime. HTTP receives the
stricter deadline. Cancellation propagates through collection and its quiet wait.

| Synthetic scenario | Collection elapsed | Result |
| --- | ---: | --- |
| Normal: two 10-second confirmations, two 3-second source reads, two 2-second workbook reads, 30-second quiet interval | 60.400 s | Accepted; 79.470 s before collection deadline |
| Two 60-second confirmations | 125.200 s | Rejected: quiet interval cannot fit |
| 80-second source reads | 212.200 s | Rejected after the pending SDK read settles; deadline exceeded by 72.330 s |
| Grant consumes 145 seconds | 10.000 s | Rejected after confirmation; deadline exceeded by 5.130 s |

These are deterministic simulated durations, **not measured Google/UI latency**.
An already-started SDK request or human callback may not be cancellable. The collector
waits for settlement and denies token issuance; it cannot guarantee cleanup completes
within ten minutes under arbitrary external latency. Callbacks receive the deadline
and cancellation guard. A timed-out attempt remains an inspection/containment case,
not evidence of successful cleanup or a reason to repeat a write.

Private `2026-11-02-initial-collection/collection-preparation-private.json` binds seven
unchanged retained inputs, the exact existing package/operations, provider order,
25 control mappings, timing receipts and outstanding fields. The 23 technical control
rows in the earlier draft still lack reviewed closure dates/digests: this preparation
does not promote them to verified facts. The two human rows require actual window
confirmations. No fixture values enter that real preparation; it stays non-executable.

Current validation: 106 local cases and 90 local Firestore emulator cases, zero
failures/skips; Functions build/full lint, focused CJS lint and diff checks pass.
The added factory case verifies package mismatch before providers and a failed
read-only SDK inspection before sealing; the successful collector test uses synthetic
source/Google/human providers. Emulator regression does not certify a full live
collector-to-migration run. Android/iOS are unchanged; no parity gap is introduced.

Next complete the concrete reviewed technical template and final read/confirmation
wiring against the retained receipts, renew only the evidence/credentials requiring
freshness, and check the same budget before requesting a real window. Neither real
maintenance nor its authorization is present. No user action or sheet closure now.

## Retained receipts and explicit human inputs — 2026-11-02

The concrete static template now binds all **23 technical controls**, the two future
human rows, exact package/forward/inverse/source/workbook identities, and the owner,
operator and both administrator accounts. Private `2026-11-02-technical-receipts`
contains the reproducible offline preparation, 25 pinned receipt/source files,
`technical-receipts-private.json`, `initial-template-private.json` and
`confirmation-inputs-private.json`. Ten deployed source archives match their retained
provider checksums and current retained configuration. The old Rules response lacks
provider metadata added in a later read: name, source and creation time match exactly;
the fresh-reader baseline keeps the full later response, without relaxing comparison.

`bind-develop-technical-receipts.cjs` rejects missing controls/receipts, changed bytes,
closure dates without the cited retained field, Rules/capture mismatch and invented
zero work. Its output distinguishes verified closure readbacks, observations of absent
registrations, and conditional composite authority evidence. This is provenance
binding, not a proof that every current writer is technically fenced. The new coverage
workers are logical factories with no registration in the inspected composition;
the HTTP coverage route is `shiftCoverage`, not an invented worker endpoint.
All 23 predecessor work counters remain unknown and must bind the operation-specific
historical-risk acceptance. The maintainer now explicitly declares no additional
external automation beyond the known apps/Functions. That disclosure does not prove
historical termination or replace a fresh automatic-authority inventory.

`createDevelopHumanInputs` provides the collector's three input ports: owner/admin
confirmations, initial reports and later fresh reports. Its explicit `exchange`
transport must show the exact challenge; it does not open a browser or ask now.
Requests include named accounts/roles, exact UTC window, operations, immutable intent
binding and a unique sequence. Answer templates contain null consent/times/status,
never a prefilled acceptance. Each reply carries the request digest, unique reply ID
and actual observed response time; the existing domain parsers validate the complete
participant set and commitments. Request/reply records go to the existing durable
journal. Empty, negative, stale, future, substituted, reused, withdrawn or active
reports stop progression. An ongoing report requires a new reply, never cached consent.
The initial offline-edit count remains null until the validated explicit closed/online
owner confirmations exist. Cancellation waits for pending input to settle; no timing
limit or cleanup guarantee has been expanded.

The forms contain all static scope/intents/risk fields; actual receipt ID, window,
risk acceptance ID/time, permission closure, confirmations and observed reports stay
unfilled. The earlier ADR-0026 policy acceptance is not copied into a new execution
approval. Full automatic-authority enumeration, undeployed-entrypoint absence and
direct owner/file/parent observations must be renewed before treating conditional
rows as current. These are the remaining evidence renewals, not another migration
algorithm or a need to regenerate the unchanged package.

Validation: **126 distinct local tests plus three private offline checks**, no failures
or skips; Functions build/full lint and focused CJS lint pass. The private positive
check completes a detached clone with explicitly synthetic times/consent and passes
the actual barrier codec; it writes no operational acceptance. The real unconfirmed
forms are separately rejected. Prior 90 emulator cases are retained historical evidence,
not rerun or claimed as new full live acceptance. No Android/iOS change or parity gap.
Next renew the identified observations and review the exact dated input packet before
requesting execution. No maintenance, live provider call, permission change, token,
Sheets write, FCM or production access in this block. No sheet closure needed now.
## Interactive attempt stopped before the grant — 2026-11-02

The authorized attempt `develop-original-20261102-interactive-03` began at
11:22:03 UTC and stopped while preparing the editor grant in the sharing dialog:
the adapter could not uniquely find a native control. The journal does not identify
which selector failed. The subsequently observed invitation had not been sent; it
was cancelled and no workbook access was granted. No writer token was issued and
neither the Sheets batch nor the migration started.

Cleanup verified removal of the temporary IAM grant, disabling the writer and OAuth
revocation. A subsequent read confirmed the account disabled with no keys or
bindings; Drive and Sheets returned 401 for the same revoked read token. The sharing
dialog again showed the owner and four readers, without the writer. A subsequent
Firestore inspection found the expected source and only the missing-window blocker.
No inverse was executed and this attempt does not authorize another. Private
evidence: journal `2026-11-02-authorized-develop-window/journal/develop-original-20261102-interactive-03`.

The local fix waits a bounded time for the controls and reports which is missing
or ambiguous. It repeats accessibility reads only; it does not repeat text entry,
recipient confirmation or permission submission. Twelve adapter tests, Functions
lint and build pass. The delayed form is simulated: the fix has not yet been tried
with Google and does not establish the exact cause. A further attempt needs a new
channel source review, refreshed observations and explicit authorization.

## Real form verified without submission — 2026-11-11

With fix `caefdcf7`, the same adapter recognized the recipient, Editor role and
notification checkbox in Google's real form. It reached the pre-share boundary
at 16:09:59 UTC; the rehearsal explicitly blocked submission and cancelled the
invitation. The list again showed the owner and four readers, without the writer.
No editor access was granted and maintenance was not opened.

The rehearsal used synthetic metadata to pass the adapter's local checks, with
the real UI and two independent submission guards. It validates form recognition,
not effective permission grant/removal or migration admission. Private evidence
`2026-11-11-native-form-unsent` retains nine AX reads, the result, the post-cancel
screenshot and the new channel review bound to source SHA-256 `8f8e48ae…9e3cb`.
The consumed 2 November attempt remains unchanged.

All 17 pinned files remain intact and reproduce review package
`7201f1cf…f257715` and materialization `373ee000…faced`: 203 Firestore writes,
53 cells and two markers. The next attempt still needs fresh authority, source
and workbook/parent reads and a new authorization/window; the form result does
not replace them.

The real read-only refresh (`2026-11-11-readonly-refresh`) verifies Cloud controls,
six indexes and the disabled, isolated writer with no keys or temporary bindings.
The old packet is rejected because only `versions.ios.min` changed in
`config/global` and `config/public`; `config/member` retains its image. A fresh
atomic census confirms the other reviewed sources are identical. Neither
migration direction writes config.

Private candidate `41d3109d…05fd`, preparation `1175a90e…bbea`, retains identical
public intents, legacy images and 53 cells with 203/140 forward/inverse writes.
It renews provenance, operation, archive and marker bindings; physical audit paths
are not byte-identical. It does not reuse the previous attempt's authorization. Historical
Drive/Sheets observations remain explicitly historical and this candidate is
**not executable**: fresh direct observations, window manifests/controls and new
authorization are still required. The current connector still omits the complete
version/permissions; its partial metadata response does not verify them.

A real read-only transaction with this candidate verifies the source and returns
only `window_scope_missing`, with zero writes and no maintenance entry. This
partial admission does not prove the pending Google observations or allow
candidate execution.

### Direct workbook and parent refresh

The authorized read session produced a retained complete direct observation in
`2026-11-11-owner-refresh`: two identical cell images, version 287 and stable
workbook/parent ownership and permissions. The preservation image remains
`2682cfb7…81b3`. Tool-session closing timed out after the observation was saved.
Recovery found the token invalid (400 on a further revocation request) and
verified 401 for the same token on Drive and Sheets. No initial 200 revocation
response was retained or manufactured. No further token, editor grant or
maintenance entry occurred.

Final composition `2026-11-11-next-window-preparation` binds refreshed package
`bcb7d82a…2632f`, preparation `0926cf4b…39645` and operation
`request-hu084-initial-fd4a76de51ab9a9280cd` to the forms and new channel review.
All 17 pinned files, three previous journals and rejection without authorization
validate. Isolated construction and three private codec/binding checks use
explicitly synthetic data/replies without providers. New receipt
`develop-original-20261111-interactive-04` retains authorization false, window null
and empty confirmations. Preparation is ready for an authorization request;
runtime manifests and fresh evidence remain under the real barrier, with the
reviewed 20-minute budget and one 300-second token. Historical effect/authority
observations are not promoted to new proof or stripped of their pending risk
acceptance.

## Attempt 04 stopped after granting access — 2026-11-11

Authorized single attempt `develop-original-20261111-interactive-04` dispatched
the grant at 16:40:55 UTC. Google added the writer as Editor, but the adapter did
not recognize the resulting state. Automatic removal also failed while checking
the newly reopened dialog. The original terminal retains `inspection-required`
and `file-unverified`; no writer token, maintenance, migration or cell batch
started. The prior unsent rehearsal did not exercise these post-grant transitions.

The operator removed access through Share, saved and reopened the dialog: at
16:42:46 UTC it showed only the owner and four readers. Independent postflight
confirms the writer disabled, zero keys/IAM bindings, isolation and unchanged
Firestore source; the same OAuth token returns 401 on Drive and Sheets. A manual
recovery entry links the evidence and hashes, and the journal API released the
local fence. All 23 original entries remain intact, including the automatic
cleanup failure. Recovery cannot resume or repeat migration.

Private evidence: journal `develop-original-20261111-interactive-04`,
`2026-11-11-next-window-preparation/manual-file-cleanup-*`,
`2026-11-11-postflight04-164322` and the postflight OAuth receipt. The window ended
early and its single authorization was consumed.

The local correction adds bounded read-only waiting after sharing, closing,
reopening and saving removal, without repeating those clicks. An already
dispatched action is observed until a settled state even if its deadline expires;
the deadline error is retained and prevents progress. If grant outcome remains
uncertain, the session cannot promote an absent ACL read to closure proof,
including on recovery. Nineteen channel and 25 session tests pass with Node 22,
along with Functions lint/build and scoped CJS lint. The correction was published
afterward as `fcdab63e`; the subsequent real rehearsal follows below.

## Grant and removal with the writer disabled — 2026-11-11

The authorized permission-only rehearsal passed with the `fcdab63e` adapter:
one complete grant/removal, independent ACL verification, no uncertain outcome
and no cleanup failure. From 17:02:17 to 17:02:45 UTC it verified the account
disabled with zero user-managed keys and IAM bindings before/after both actions.
The writer was not enabled and no writer token was issued; the rehearsal excludes IAM
mutations, Sheets calls, Firestore and migration.

The owner session requested only `drive.metadata.readonly`, Online without
refresh. Revocation returned 200 and the same token returned 401 on Drive. The
reopened dialog showed the owner and four readers without the writer. Private
evidence: `2026-11-11-native-disabled-writer-rehearsal`, ten phase records, result,
current-source-bound review, OAuth closure and final screenshot. Four local
helper cases validate its guards; they do not replace the real rehearsal or
prove a complete migration.

The previously failing native cycle is now verified. Another migration attempt
requires review regeneration against the published code, renewed observations
affected by permission changes and its own authorization/window. This rehearsal
does not open maintenance or authorize that execution.

## Refreshed review for attempt 05 — 2026-11-11

The new authorized direct read observed the workbook and parent from 17:37:42
to 17:37:50 UTC: actual version **291**, owner and four readers, no writer access.
Two complete captures of all six tabs are identical and retain image
`2682cfb7…81b3`, including published dates and order. Thirteen bounded GETs were
made. Online OAuth without refresh was revoked with status 200; the same token
first returned Drive 401/Sheets 200 and, at 17:38:44, 401 on both. Both probes are
retained without concealing revocation propagation.

Regenerated package `6177be45…9f73a81`, preparation `f3b5a9b0…faa2b5b8` and
operation `request-hu084-initial-6678cf8a7c2756773ef8` bind this capture and the
Cloud/identity controls refreshed at 17:08:24 UTC. All 17 pinned files validate;
the planned 203 forward/140 inverse writes, no config writes, and 53 cell requests
plus two markers are retained. Cell requests exactly match the previous package;
audit identifiers and markers are regenerated. Exact-package inspection at
17:39:38 UTC uses one read-only Firestore transaction and zero writes: the source
matches and the sole blocker is `window_scope_missing`. This is not full admission.

New template `develop-original-20261111-interactive-05` includes the channel review
bound to the real grant/removal cycle. It distinguishes the three automatically
closed journals from attempt 04's original failure and separate manual recovery.
Local checks verify the bindings, rejection without authorization, isolated
construction and three codec/form tests; positive data are synthetic without
providers. Preparation left authorization false, window null and empty
confirmations; the subsequent attempt records their consumption. The proposal
allowed twenty minutes and one 300-second token; it left dates unset and reused
no human commitments.

Independent review links 337 current hashes to the preceding review and the two
already validated channel/session corrections. The historical comparison against
1 November retains its differences; literal equality is not claimed. The private
operator pins the manifest and checks files and evidence when loading, preparing
and starting the attempt. Five local cases for drift, a missing file, a changed
manifest, an added file and drift before start stop with zero provider calls.
Loading the operator requires a fresh Node context or clearing only its cache and
the worktree cache in the CUA session; disk checks do not attest already loaded
modules. The repository executor is unchanged.

Private evidence: `2026-11-11-interactive05-owner-refresh`,
`2026-11-11-interactive05-rebind` and `2026-11-11-interactive05-preparation`.
The writer remained disabled. This preparation granted no editor/IAM access,
opened no maintenance and performed no migration. Execution required its own
authorization and actual window, current observations and post-permission
confirmations. Android/iOS are unchanged with no parity gap; native checks and
build/lint are reused because no app or Functions code changed. The private start
script is validated separately.

## Attempt 05 stopped during confirmations — 2026-11-11

The authorized single attempt started at 18:19:26 UTC, with a maximum end of
18:39:26. Editor access was verified and a fresh owner confirmation was received.
Collection rejected the administrator step 457 ms after publishing its question,
with more than ten minutes left. The 18:21:40 terminal retains
`inspection-required` and `file-unverified`: automatic removal waited twenty
seconds without an attended CUA call. No writer token, barrier acquisition,
Sheets batch or migration write occurred. The administrator reply received
afterward remains in record 31; it is late and not an accepted confirmation.

Manual removal was saved and verified by reopening Share at 18:23:46 UTC:
owner and four readers, no writer. Independent postflight confirms the writer
disabled, zero user-managed keys/IAM bindings, isolation and unchanged Firestore
source. Automatic OAuth cleanup retains status 200 and same-token 401 on Drive and Sheets. The
human window was released early. The CUA process was closed after preserving
evidence; local-fence recovery uses the existing API, retains all 32 original
records including the terminal and late reply, and adds two recovery receipts;
both local locks are removed. No recovery guard is changed to
release a live process, and execution cannot resume.

The composition supplied a `notify` callback using `nodeRepl.write`. A local
probe reproduces `node_repl exec context not found` when another invocation
resolves an asynchronous continuation using that callback; the synchronous call
succeeds. Journal ordering and code point to this instrumentation failure, though
the original exception was not retained. The correction must keep notices in
queryable state, invalidate the question/timer when closing, and reject late
replies before recording them. It must also attend removal requests while waiting
for human input. Increasing the window does not fix this problem.

Local correction `2026-11-11-coordinator-fix` connects human exchange, the native
queue and supervision in a template with no package, credentials or authorization.
A rejected collection invalidates the question before recording its event; a
late grant is cancelled when closing and removal can be attended during cleanup.
In-flight native actions keep inspection required. Twelve Node 22 tests and
focused lint pass. A two-invocation NodeREPL wait resolves without a context error,
and an answer after closure adds no records. This is a synthetic rehearsal without
providers; the template rejects execution and still needs binding to a newly
reviewed package.

Private evidence: `2026-11-11-interactive05-live`,
`2026-11-11-postflight05-182301` and journal
`develop-original-20261111-interactive-05`. Authorization is consumed. The earlier
version-291 observations and attempt-05 preparation are historical; another
attempt requires review of the corrected coordinator and renewal of bindings
affected by permission changes. Production and both apps are unchanged.
Functions and native gates are reused: this block changes repository documentation
only; the private coordinator checks are those stated above.

## Refreshed package and connected coordinator — 2026-11-11

Attempt-05 closure and its local correction were published in `5df19c52`. New
preparation refreshes Cloud/IAM/indexes and the atomic develop census: payloads
and service versions match the preceding source. Direct workbook/parent reads
observe actual version **293**, owner and four readers. Two complete images of
all six tabs retain `2682cfb7…81b3`. Online OAuth without refresh was revoked with
status 200; after two Drive401/Sheets200 probes, the same token returns 401 on
both at 18:55:13 UTC.

Package `e97cf026…22377d1`, preparation `10cc98e4…e3ed760` and operation
`request-hu084-initial-1215bc534e8eba0f9007` pin these observations. All 17 pins,
the planned 203/140 writes and 53 cell requests plus two markers validate; cell
requests are identical and configuration is not written. Exact Firestore inspection
uses one read-only transaction and zero writes; the source matches and only
`window_scope_missing` remains.

Private operator 06 connects corrected human exchange, native queue and driver
to the existing executor. Its inspection, cleanup and recovery ports close the
question before acting, including when opening returns `setupFailed`. Session
recording invalidates the question before appending rejected collection. Supervision
attends removal, cancels late grants and keeps inspection required for native
actions still in flight. Asynchronous continuations contain no tool callbacks.
It retains the 337-source/seven-evidence guard and also pins the three new modules.

**Twenty-two operator tests and three independent tests** pass with Node 22,
alongside synthetic construction and focused lint. They exercise the real
`runControlledWindow` with simulated ports, barrier failure, `setupFailed` opening,
late replies without writes, one attended removal and operator rejection before
provider access when authorization is missing. Five prior journals and their
recoveries retain their hashes. This verifies local connection, not a real
multi-service cycle.

Receipt `develop-original-20261111-interactive-06` leaves authorization false,
window null and confirmations empty. The proposal still allows twenty minutes
and one 300-second token. Execution needs new authorization, current observations
and actual confirmations; supervision must remain attended in CUA calls and an
interruption is not cleanup proof. This block enables no writer, grants no
editor/IAM access, opens no maintenance, migrates nothing, deploys nothing and
sends no FCM. Production and both apps are unchanged.

Private evidence: `2026-11-11-package-coordinator-refresh-184922`,
`2026-11-11-interactive06-owner-refresh`, `2026-11-11-interactive06-preparation`
and `2026-11-11-interactive06-wiring-tests`. Native/Functions gates are reused
because their code and contracts are unchanged; new checks are the local ones
stated above. New preparation remains local after the published commit above.

## Attempt 06 closed at the confirmation deadline — 2026-11-11

Preparation was published in `29ea717c`. The authorized single attempt started
at 19:50:36 UTC, with a maximum end of 20:10:36. The grant was verified and a
post-permission owner confirmation requested. Collection ended without a
recorded reply two milliseconds after its 20:03:06 UTC deadline. That ordering
matches the response timer; the journal retains no exception text. The controller
remained attended throughout the wait.

The 20:03:35 UTC terminal retains `inspection-required` and cleanup without
failures: one verified native removal, IAM removed, writer disabled and OAuth
revoked with status 200 and same-token 401 on Drive and Sheets. No native action
is in flight; there are no budget breaches, pending files or local locks. All 31
records remain intact, ending in the terminal. No writer token, barrier
acquisition, Sheets batch or migration occurred. Independent postflight confirms
the exact source unchanged, writer disabled, zero user-managed keys/IAM bindings
and isolation. Share again shows the owner and four readers.

The reply “Sí, todo sigue vigente” arrived after the terminal and is retained
separately from the journal, without accepting consent or resuming the operation.
The question stated a commitment until 21:10:36 Madrid but omitted its 21:03:06
reply deadline. Future prompts must distinguish **reply before** from **keep the
commitment until**, using both actual challenge times. The human window was
released after verified closure; the single authorization is consumed.

Required challenge wording: “**Reply before [Madrid time from `deadlineMillis`]**.
Keep the commitment until [Madrid window-end time].” Apply a reply only if
`status().pending` retains the same digest and its deadline is current. Store a
post-terminal reply separately; never call `answerAndAttend` to reopen a closed
question.

Private evidence: journal `develop-original-20261111-interactive-06`,
`2026-11-11-interactive06-live`, `2026-11-11-postflight06-200456` and
`2026-11-11-interactive06-result`. This verifies real automatic closure with the
corrected supervision, not a live migration. The 25 local checks are reused for
unchanged code; native/Functions gates are not repeated for this documentation
record. Production and both apps are unchanged. Another attempt needs renewed
permission-affected observations, package review, authorization and actual new
confirmations; the late reply supplies none of those.

## Attempt 07 preparation — 2026-11-11

After attempt 06 was closed and recorded in `6c97de0e`, Develop observations
were renewed. The workbook is at version 295 with the complete reviewed image,
dates and order preserved. Package `7ef0b3f0…d1041c3`, prepared state
`21bd0830…a1ef64aa` and operation `request-hu084-initial-0d45873f91ccf634adc1`
retain 203 planned Firestore writes, 53 cells and two markers. Exact admission
used one read-only transaction and no writes; its only recorded blocker is the
missing concrete window.

Independent review checked the 17 package files, content and source equivalence,
and rejection before provider access when confirmations are missing. Twenty-eight
local tests passed: 11 coordinator, one wiring, seven source guard, three form,
two deadline display and four temporary-copy dating tests. These do not prove a
live migration. The new guard refuses to date a window unless the owner's read
session conservatively covers the full 20 minutes. Each question must separately
show the reply deadline and the commitment end, in Madrid time.

The user authorized one attempt and confirmed the window. The dater recorded an
interval beginning at 20:29:06 UTC, but operator construction failed before it
could start because our call omitted `ownerCredential.sessionId`. This is an
operator-composition failure, not a user-response failure. The operator was not
created or started, and the window did not begin operationally. No permissions,
writer token, maintenance or migration were initiated; no retry was made. The
owner read OAuth session was revoked with status 200 and the same token received
401 on Drive and Sheets. Independent postflight confirmed the source still matches package 07 and the
writer remains disabled and isolated, with zero user-managed keys or IAM bindings:
ten reads and one read-only transaction, with no writes. There is no attempt-07
journal or local execution or recovery lock. The OAuth tab was closed, the SDK
terminated and token references cleared. The window was released and the user
may reopen the workbook. Validate the complete descriptor before dating a new
window, and obtain a new authorization.

A local pre-dating validation now requires the complete owner descriptor,
sufficient session lifetime, IAM access, SDK identity and the four tab controls.
Three Node 22 tests passed: a missing session ID is rejected before the dater or
providers; the complete case constructs the exact 07 operator in a copy using a
synthetic window and confirmations with stub providers. This is not a real run.
The next startup must use those same validated inputs and receive a new
authorization; the consumed 07 record is unchanged.

The late reply from 06 is not reused. Private evidence:
`2026-11-11-interactive07-refresh`, `2026-11-11-interactive07-owner-refresh`,
`2026-11-11-interactive07-preparation`, `2026-11-11-interactive07-live` and
`2026-11-11-postflight07-202959` and `2026-11-11-operator-input-preflight`.

## Attempt 08 stopped during confirmations — 2026-11-11

The closure of attempt 07 was published in `e106d4cd`. Package 08
`a21f4f0c…f54bce2` and exact admission preserved the 203 planned writes, 53 cells
and two markers. The live workbook observation confirmed version 295, authority
and complete image equal to the retained 07 reference; its historical revocation
applies only to that earlier session. Thirty-two local tests and independent
review passed. The controller also validated the complete startup inputs before
dating the actual window.

The single authorized attempt began at 21:42:27 Madrid, with a maximum end of
22:02:27. Owner confirmation was received and recorded at 21:54:17, within the deadline. The
subsequent administrator request began at 21:54:18 with the same 21:54:57 limit,
leaving about 39 seconds to respond. No reply was recorded before the deadline
and collection was rejected. This is not attributed to the user: agree a viable
initial response window before proposing another attempt, without silent retries.
Before the first question, explain that owner, administrator and reports are three
consecutive confirmations sharing one common deadline.

The 21:55:28 terminal retains `inspection-required`, no cleanup failures, settled
operations, no action in flight and no time-budget breaches. The 34 journal records
have no pending files. File and IAM removal are recorded as verified; the runner
revoked OAuth with status 200 and received same-token 401 responses from Drive
and Sheets. The OAuth tab was closed and the caller dropped its references. No
writer token, barrier, Sheets batch, migration or production access occurred.
The single authorization for 08 is closed. Independent read-only postflight
confirmed the exact source, writer disabled and isolated, with no keys or IAM
bindings: ten reads and one transaction, with no writes. The journal has no
pending files and no local execution or recovery locks remain.

Private evidence: journal `develop-original-20261111-interactive-08`,
`2026-11-11-interactive08-refresh`, `2026-11-11-interactive08-preparation` and
`2026-11-11-interactive08-live` and `2026-11-11-postflight08-205619`.

The administrator reply received after closure (confirming both accounts until
22:30 Madrid) is retained in a separate private receipt. It is not appended to the
journal, does not extend the 08 window and does not authorize another attempt;
the 34 records and their head remain unchanged.

## Attempt 09 stopped after confirmations — 2026-11-11

After attempt 08 was closed and published as `7ed436eb`, package
`432623c0…d01d0f4` was prepared with the current version 297 workbook reading.
Its read session was active and its own cleanup remained pending; no earlier
session's cleanup was attributed to it. The content, 203 planned writes, 53 cells
and two markers were preserved. Exact admission was read-only; 32 local tests and
independent review passed.

The user confirmed the window and all three consecutive replies were recorded
within the deadline. Initial collection was subsequently rejected although the
recorded stages completed successfully before the deadline. Failure occurred
during subsequent collection processing; the journal does not retain the caught
error, so that record alone cannot identify the first exception. The
terminal retains `inspection-required`, no cleanup failures, settled operations,
no action in flight and no time-budget breaches. The 39 journal records have no
pending files. File and IAM removal are recorded as verified; the runner revoked
OAuth with status 200 and the same token received 401 on Drive and Sheets. The
tab was closed and caller references were discarded.

Inspection records that Sheets had not started and that barrier and Firestore
were unavailable to that inspection. Independent postflight confirmed the exact
source unchanged and the writer disabled and isolated, with no keys or bindings:
ten reads and one transaction, with no writes. There are no local locks and the
window was released. No exception trace was retained that would attribute the
first rejection to a read failure or timeout. The single
attempt has ended; no retry has been authorized.

A local reproduction with the package and recorded replies identified an
incompatibility sufficient to reject admission: the historical-risk acceptance
predated ten closure observations included in the package, while the validator
requires that evidence to precede acceptance. Because the actual exception was not retained,
the reproduction does not establish that this was the first cause of the live
rejection. No additional attempt was run and the consumed evidence is unchanged.

The local correction checks that chronology before opening a session or contacting
providers. A later collection failure records a stable checkpoint and generic
category without messages, values or credentials; a failed failure record keeps
the original error and cleanup continues. All 112 integrated local tests of the
seal, collector, controlled window, human inputs and original session passed, along with Functions lint and build and
targeted checks on the four `.cjs` files. These checks do not establish the
first real exception in 09 or constitute a live run. Before another attempt,
genuine historical-risk acceptance must follow preparation and review of the
corresponding evidence and closures and precede any provider call; its date must
not be altered and the 09 quiet-window confirmation is not risk acceptance. The
two changed scripts require new hash review before another attempt.

Private evidence: journal `develop-original-20261111-interactive-09`,
`2026-11-11-interactive09-refresh`, `2026-11-11-interactive09-preparation`,
`2026-11-11-interactive09-live` and `2026-11-11-postflight09-212435`.

## Attempt 10 stopped after admission — 2026-11-11

The 09 correction was published as `8105d0cf`. For attempt 10, package
`8d81fbb5…9408d7c` and the current version 299 workbook reading were reviewed.
Source review fixed 339 files: 337 previous files unchanged and two added scripts,
with eight supporting receipts; the 112-test integrated regression was reused and
39 new local tests passed. Explicit risk acceptance was separate from operation
authorization and followed review of the package and 23 predecessors. Quiet-window
confirmation was also separate.

During the authorized window the three initial confirmations and six subsequent
replies were recorded in time. Initial collection was verified and sealed, the
barrier acquired, admission checks passed, and the single writer token was minted
and positively checked. The executor then stopped and entered inspection. The
journal contains no joint-execution intent. It does not retain the original
exception; the subsequent review is described below.

The terminal retains `inspection-required`, with no cleanup failures or actions
in flight; the 72 records have no pending files. The executor verified file, IAM
and OAuth closure. The OAuth tab was closed and caller references discarded. The
barrier was acquired. Independent read-only postflight confirmed the exact source
unchanged, the writer disabled and isolated with no keys or bindings, and no
maintenance state document. The historical barrier checkpoint remains retained
and matches the journal; its release is not claimed. There are no local locks or
recorded joint intent or batch dispatch.

Local review identified two reproducible obstacles: the session wrapper did not
reflect writer data added later, and admission took 88.115 seconds to complete,
exceeding its 60-second limit. The original exception was not retained, so the
first live failure and its order cannot be established. The historical checkpoint
is retained and its release is not claimed.

The local correction preserves session identity so deferred writer fields remain
visible. Admission retains the real collection start and begins its 60-second
technical limit with two fresh source reads. The manifest is generated after the
initial and final human observations with the barrier verified, without retiming
it or extending its limit. A joint Firestore Emulator test passed using the real
executor and session, 88.115 synthetic seconds of replies across observations,
16.728 seconds of writer preparation and two subsequent six-second reports. The
first write was prepared in the CAS transaction at a manifest age of 26.858 seconds;
203 writes, 53 cells and two markers were verified. An injected expiry rejected
CAS and the batch and cleaned permissions. Google, Sheets, humans and timing are
doubles; census `readTime` follows the test clock. This does not guarantee real
latency fits the margin. Six engine emulator tests also covered generation after
the observations in both directions and rejection of altered reports or source.
These operator corrections follow commit `8105d0cf`. The next operator must
incorporate the corrected helper and review new hashes before any recovery or
further attempt is considered.

The subsequent local gate ran 356 test executions across 19 files, with no
failures or skips; these are not claimed as unique cases. Functions build and lint
and targeted ESLint on the seven `.cjs` files passed. The full emulator gate ran
96 executions across three files, including the six new engine tests; the two
joint tests passed separately: 98 emulator executions total, without counting the
six twice. Logs are in `2026-11-11-window10-local-fix-validation` and
`2026-11-11-attempt10-joint-emulator`; they are not a live Develop run.

Private evidence: journal `develop-original-20261111-interactive-10`,
`2026-11-11-interactive10-refresh`, `2026-11-11-interactive10-preparation` and
`2026-11-11-interactive10-live` and `2026-11-11-postflight10`.

### Commit-and-push validation — 2026-11-12

The seven runtime/test file hashes and raw validation-log hashes match the final
11 November gate, so its 356 regression and 98 emulator executions, build and lint
are reused for this delivery. Only delivery wording and the changelog date changed
after validation. Native code and app contracts are unchanged; native gates are
not repeated. Incorporating the helper into the next concrete operator and reviewing
its package/source bindings remain pending before another authorized attempt.
