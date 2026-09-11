# HU-083 — consolidated acceptance review

Reviewed on 2026-09-08 at `775be1adaae27d60e506677f6d1832739846c2ba`
(cuts 1–17 pushed). Cut 18 reconciles implementation evidence and reruns the
backend checks. It changes no runtime, schema, permissions or deployment.

## Cut-19 local update

The configuration gap below is now fixed locally: all remaining legacy callers
resolve through `readLegacyShiftSheetsConfig`, requiring the three scoped variables
and rejecting shared workbooks. No global or invented-range fallback remains.
The candidate change does not remove stored parameters, migrate seasonal writers,
choose the visible layout or certify deployed configuration. Validation for this
change: 85/85 focused local cases and 13/13 trigger cases with the Firestore emulator.
The cut-18 validation table below remains the evidence for its reviewed commit.

## Cut-20 local update

The maintainer selected readable, editable date/name sheets. Full export, ordinary
confirmed-row export and delivery-calendar overrides now use the shared seasonal
resolver with explicit aliases and the logical shift date; `syncMeta.sheetName`
and fixed ranges cannot redirect these paths. The human writer validates a bounded
existing tab and named assignees. Delivery updates leave D:E untouched; market writes
three name/phone pairs, preserving C, its date heading and following date block.
Duplicate dates, incomplete/extra market participants, missing destinations and
oversized grids reject. Source notification/fence behavior remains in the existing
handlers. Validation: 90/90 focused local cases, 22/22 trigger/emulator cases,
Functions lint/build. Real Sheets are represented by a fake in these tests.

## Cut-21 local update

Reviewed human preparation now accepts Spanish market dates and inert annotations,
including formulas in turn annotation columns. Reviewed decoration rows still
require exact literal images. Only literal `lo hace Nombre`
annotations propose replacements. The bounded Firestore delivery calendar joins
source/version guards; a visible override resolves to its unique original shift
and logical tab. Calendar changes during preparation or after review reject the
source. Human apply/write-back and the old sync endpoint remain unintegrated.
Validation: Functions lint/build, 104/104 focused cases and 42/42 Firestore import
emulator cases pass without skips/failures. Sheets is a fake; members are fictional.
Audit/repair regressions also pass 64/64. No live workbook or public data is
changed. This cut remains local/uncommitted.

## Cut-22 local update

The private import endpoint now applies and writes back reviewed human blocks,
including mixed canonical/human seasonal plans, through the existing transaction,
submission reservation and adapter. Exact before/after images bind visible cells;
names/phones are normalized and only applied literal replacement instructions are
consumed. Dates, annotations/formulas, formatting and stable ownership survive.
Retained markers recover before-image replacements without resending; calendar
changes between apply and write-back also reject. Functions lint/build pass;
173/173 local regressions, 45/45 import emulator cases and 17/17 existing consumer
emulator cases pass without skips/failures. No live data is used or changed; this
cut remains local and uncommitted.

## Cut-23 local update

Cut 22 is pushed as `e51d16c`. Cut 23 creates/appends readable seasonal tabs
through the existing atomic adapter: literal dates, names/phones, delivery helper
and three-person market blocks. It preserves existing assignments and annotations;
changed identities, ambiguous dates and pending replacements reject before submit.
Visible data binds operation digests; retained operations only inspect. The
round-trip test imports new tabs, including a calendar override across seasons.
Validation: Functions lint/build, 183/183 local cases, import emulator 45/45 and
consumer emulator 17/17; zero failures/skips. Sheets is a fake, members fictional.
Worker composition with trusted Firestore labels/calendar, adoption of other
historical layouts, legacy generation/sync and live develop acceptance remain open.
No mobile contract, endpoint, live data, deploy, IAM or FCM change. Cut 23 is local.


## Cut-24 local update

Cut 23 is pushed as `9c4e507`. The existing worker now generates readable sheets
from activated rows plus bounded Firestore member/calendar data. Private schema-v2
receipts persist exact labels/dates and source versions; the reservation transaction
rechecks all versions, including absent overrides. Recovery uses persisted display
data; old schema-v1 canonical receipts still inspect without directory reads.
Validation: lint/build, 186/186 local cases, consumer emulator 23/23, import 45/45
and repository 7/7, zero failures/skips. Sheets is fake and members fictional.
Cut 24 remains local. Historical-layout adoption, legacy generation/sync and live
develop acceptance remain open. No new endpoint, mobile contract, live mutation,
deploy, IAM or FCM change. Existing external writer-exclusion requirements remain.

## Cut-25 local update

Cut 24 is pushed as `2a50d99`. Legacy sync now returns authenticated HTTP 410;
pending unversioned requests fail transactionally without Sheets/public/notification
writes. Old partial import, generation and whole-tab clear code are removed.
Current mobile codecs use v2; deployed/external callers still require HU-085 review.
Ordinary exports preserve helper names and omit month decorations in newly generated
delivery tabs, retaining historical week semantics elsewhere. Validation: lint/build,
197 local passes (11 emulator-only skips), exported handlers 19/19 and writer fences
12/12 in the emulator, no failures. Cut 25 is pushed as `f1afc6d`; no live/platform/deploy changes.

## Cut-26 local update

Reviewed historical mapping is reused for generation, ordinary export boundaries
and durable worker recovery. Exact titles/month headings and variable spacing
between market blocks are preserved. Historical delivery F remains untouched on
existing rows; appends use the ISO week, while the new labeled layout keeps helper
names. Shared literal-date decoding avoids duplicate append for serial/ISO dates;
managed formulas and invalid dates reject before writes. A synthetic four-tab,
two-season generation/import round-trip and persisted-mapping recovery are covered.
Validation: Functions lint/build pass; focused regression has 200 passes and
11 emulator-only skips, all covered by the separate writer-fence emulator 12/12.
Consumer emulator passes 24/24 and exported HTTP/event/override handlers 27/27.
Sheets is a public-API fake and all people are fictional; no real workbook,
Firestore data, deployment, IAM or FCM was changed. Mobile code and its public
contract are unchanged, so mobile validation was not rerun.

Cut 26 is pushed as `ec301ec`. Actual reviewed decorations, complete protection/
merge inventory and the real repair/deferral artifacts remain unverified.

## Cut-27 integration review — 2026-09-09

Cut 26 is committed/pushed as `ec301ec`. This review covers the HU-083 delta from
`515b9f8`: configuration/routing, readable and canonical adapters, private import/
worker composition, shared submission reservations, event suppression/retention,
repair/materialization/rehearsal, Rules and the unchanged mobile boundary. It is
a source review plus local/emulator evidence, not a deployed-system audit.

Four integration findings were corrected in this cut:

| Finding | Correction and evidence |
| --- | --- |
| **P1 — readable import left helper F stale.** Changing the next lead updated the backend predecessor helper but retained the old visible name. | New-header write-back binds helper ID/name to the projected row and verifies that exact header. A generation → import/apply/write-back → generation emulator test verifies the corrected helper and lost-response recovery. Historical F remains untouched. |
| **P2 — an already-effective `lo hace` instruction remained pending forever.** An unchanged assignment produced no command to consume the instruction. | Reviewed write-back can consume it with a controlled document revision; assignment revision, owners and completed history stay unchanged. Completed-row and no-notification regressions are covered. This does not normalize every unchanged name/phone merely for formatting. |
| **P2 — readers disagreed about decorations and standalone notes.** Formatted trailing empty cells or annotation-only rows could prevent the next generation/import. | All three paths share literal-row comparison; generation preserves annotation-only rows and still rejects orphan identities/instructions. The four-tab round-trip includes trailing formatting. |
| **P1 — repair proposals still required technical tables.** The chosen readable workflow could not produce a repair plan; captured calendar overrides and visible helper drift were absent from offline audit. | Existing offline tools now reuse the reviewed human reader, bind an optional captured calendar, diagnose stale helper names, preserve old row positions/annotations, and allow missing rows only in empty space. New historical F accepts only its exact ISO week. Readable snapshots also reach the existing bounded Firestore materializer and emulator inverse. No live apply or alternate workflow is introduced. |

The existing receipts, digest checks and shared reservation have concrete recovery
responsibilities and are retained. No generic orchestration layer, new endpoint,
queue, deployment or mobile abstraction was added. The ordinary event/export routes
still use their existing writer fences rather than the durable import/activation
receipt protocol; this distinction remains explicit for rollout. Prepared commands
whose recomputed plan changes require a fresh reviewed digest; already submitted
receipts keep their original inspect-only recovery.

## Result

The canonical adapter, private sync/import entry points, controlled-event audit,
repair tooling and the three seasonal human writer routes have local/emulator
evidence, including reviewed human apply/write-back and readable generation/new-tab
creation and the activation worker's trusted display/calendar composition. HU-083
remains open: local integration review is complete; real-data safe-apply or exact
zero-write deferral and final acceptance/delivery remain incomplete. The archive/technical
conversion proposal is not selected for the user workflow.

Next obtain the real inputs for the operational evidence gates. Cut 27 remains
local/uncommitted; no additional implementation cut is planned before that work.

## Implementation and acceptance map

| Requirement | Current evidence | Remaining boundary |
| --- | --- | --- |
| Explicit environment/workbook and seasonal aliases | [Config](../../../functions/src/shift-sheets-config.ts), config tests; new worker/import reject missing or cross-environment authority | Cut 19 routes legacy callers through the shared strict resolver; deployed configuration remains unverified |
| Stable identity, create/merge, carryover and manual-field preservation | [Canonical adapter](../../../functions/src/shift-sheets.ts), [behavior tests](../../../functions/test/shift-sheets.test.cjs) | Readable generation, reviewed historical adoption and their import round-trip pass locally; the real workbook map still needs review |
| Seasonal union and guarded effective assignments | [Import reader](../../../functions/src/shift-sheets-import.ts), [planner](../../../functions/src/shift-sheets-import-plan.ts), [Firestore adapter](../../../functions/src/shift-sheets-firestore-import.ts) | Human apply/write-back is locally integrated in cut 22; legacy sync retires locally in cut 25 |
| Explicit pull, claims, exact manifest and bounded retry | [Worker](../../../functions/src/shift-planning-sheets-worker.ts), [consumer](../../../functions/src/shift-planning-sheets-consumer.ts), exported `executeShiftPlanningSheetsSync` | No live invoker/scheduler configuration or deployment |
| Durable Sheets attempt, replay and unknown-outcome reconciliation | Consumer/import emulator cases, shared workbook reservation, exact cells/marker/version checks | Protocol evidence is not an external-writer fence or physical cross-store CAS |
| Controlled event suppression and recovery identity | [Trigger](../../../functions/src/shift-planning-public-event-trigger.ts), actual exported-trigger emulator cases, durable audit 32/32 | Both candidate trigger revisions and explicit policy need HU-085 rollout; ordinary effects keep their existing route |
| Retention and rejection | Typed retention policy, durable controlled/rejected ledgers, strict/phase1 access tests | Operator logs do not prove alert delivery; real policy/retention lifecycle remains an operational gate |
| Full export, ordinary incremental export and overrides | Cut-20 human routing and exported-handler integration tests | Readable updates, tab creation and worker integration are local; historical adoption passes locally; real acceptance remains open |
| Ownership, completed history and predecessor/current/successor CAS | New import emulator coverage; strict ownership/provenance Rules and retained-marker routing | Does not certify all legacy mutation routes or current deployed behavior |
| Audit, repair documents, baseline and inverse | [Auditor](../../../functions/scripts/audit-shift-planning.cjs), [repair review](../../../functions/scripts/repair-planned-shifts.cjs), [materializer](../../../functions/scripts/materialize-shift-repair.cjs), loopback/demo [rehearsal](../../../functions/scripts/rehearse-shift-repair.cjs) | Supplied snapshots and synthetic commits do not prove capture completeness, historical membership or live inverse authority |
| Human-facing layout | Readable/editable date-name sheets selected; cut-20 writer preserves annotation columns | Archive/technical-table proposal is not selected. Reviewed human apply/write-back and the readable worker are integrated; historical adoption passes locally; real acceptance remains open |
| Real develop repair or zero-write HU-085 deferral | [Bounded layout inventory](inventory.md) and the supplied-snapshot tooling | No trusted dual-store baseline, exact real-data manifests, unchanged-source proof or completed deferral acceptance |

## Candidate legacy routes still present

These observations refer to the repository at the reviewed commit, not to an
inventory of deployed Functions. The implementation source is
[`functions/src/index.ts`](../../../functions/src/index.ts).

| Entry point / helper | Current behavior | Work required before claiming complete migration |
| --- | --- | --- |
| Legacy fixed-range config | Cut 25 removes runtime consumers; stored variables and isolated reader remain | Review deployed/external consumers before removing configuration |
| `exportShiftsToGoogleSheets` → `exportAllShiftsToGoogleSheets` | Cut 20 iterates shifts through seasonal human ranges from their logical dates | Existing-tab route tested across delivery seasons and market; complete read-back/recovery remains an operational requirement |
| `syncShiftsFromGoogleSheets` | Cut 25 preserves admin authentication and returns HTTP 410; old importer is removed | HU-085 checks deployed/external callers; reviewed import remains private |
| Ordinary branch of `onShiftWritten` | Cut 20 resolves the seasonal alias, updates readable fields and retains ordinary notification effects | Existing-tab integration tested, including ignored wrong `syncMeta.sheetName`; live side effects remain unverified |
| `onDeliveryCalendarOverrideWritten` | Cut 20 keeps the logical seasonal tab while changing the visible date within the same ISO week | Exported override integration tested; real workbook read-back remains open |
| Legacy `onShiftPlanningRequestCreated` path | Cut 25 only fails pending unversioned requests transactionally; generator/clear helpers are removed | Current apps use v2; HU-085 must inventory/drain deployed external legacy clients |

The new pipeline is composed in `index.ts` as `executeShiftSheetsImport`,
`executeShiftPlanningSheetsSync` and `onShiftPlanningPublicWritten`. Their presence
is not evidence that the table above already uses them.

## Validation after cut 27

Functions `npm run lint` and `npm run build` pass. The same test-script union as
before now resolves to 61 unique files: `test:shift-planning:unit`,
`test:backend-security`, `test:migrations`, `test:shift-sheets`,
`test:shift-planning:audit`, `test:shift-repair:authority` and
`test:shift-sheets:conversion`. Run once together: **525 passed, 51 skipped,
0 failed**. Every one of those 51 skipped test names was matched to a passing
execution in the emulator suites below; none remains unvalidated for lack of its
emulator context. Two new regressions first reproduced stale helper F and the
unconsumed already-effective instruction before the fixes.

| Existing npm script | Passed | Skipped |
| --- | ---: | ---: |
| `test:shift-sheets:import:emulator` | 48 | 0 |
| `test:shift-planning:sheets-consumer:emulator` | 24 | 0 |
| `test:shift-planning:public-event-audit:emulator` | 32 | 0 |
| `test:shift-planning:public-event-trigger:emulator` | 35 | 0 |
| `test:shift-planning:sync-command:emulator` | 7 | 0 |
| `test:shift-repair:emulator` | 7 | 0 |
| `test:firestore-role-access` | 32 | 0 |
| `test:firestore-phase1` | 8 | 0 |
| `test:rules` | 6 | 0 |
| `test:shift-planning:attempt-outcome:emulator` | 5 | 0 |
| `test:shift-planning:cas-runtime:emulator` | 8 | 0 |
| `test:shift-planning:notification-safe-resume:emulator` | 4 | 0 |
| `test:shift-planning:notification-terminal-repository:emulator` | 6 | 0 |
| `test:shift-planning:source-producer:emulator` | 6 | 0 |
| `test:shift-planning:source-resolver:emulator` | 2 | 0 |
| `test:shift-planning:forward-materializer:emulator` | 7 | 0 |
| `test:shift-planning:inverse-materializer:emulator` | 5 | 0 |
| `test:shift-planning:notification-dispatch:emulator` | 15 | 0 |
| `test:shift-planning:notification-release:emulator` | 6 | 0 |
| `test:shift-planning:notification-writer-fence:emulator` | 12 | 0 |

The table represents **275 passing emulator executions**, including unit cases
also counted in the local union; these are not 800 unique tests. All suites used
their existing `demo-*` projects, sequentially under Java 21, and stopped normally.
After the repair/calendar changes, the affected offline union and repair/import
emulator suites were rerun; unrelated green suites were reused without code drift.
Sheets and transport are fakes. No real workbook/Firestore data, deployment, IAM
or FCM was changed. No Android/iOS code or public wire contract changed against the
HU-083 base, so mobile gates were not rerun; real app read-back remains a live gate.
`git diff --check` passes. The unrelated main-checkout Xcode reorder is preserved.

## Remaining execution order

1. Keep the selected readable/editable date-name layout; do not deploy the
   unselected archive/technical-table workflow. This choice does not authorize
   live conversion.
2. Local integration review (cut 27) is complete, including fixes and full backend
   regression. Preserve ordinary notifications and existing fences at rollout.
3. Obtain trusted Firestore/Sheets evidence through the separately bounded auditor
   defined in [spec.md](spec.md). Inventory alone is not backup authority. Verify
   approved calendars, ownership/bootstrap and historical/helper boundaries.
4. Build the exact real-data materialization and recovery manifests. If effective
   writers or reached triggers cannot be safely contained within develop, prepare
   the exact zero-write HU-085 deferral, including unchanged-source evidence and
   the expected baseline. Do not label the present synthetic fixture as that proof.
5. Reconcile remaining acceptance criteria, then request the separately authorized
   delivery/closure steps. HU-084 and HU-085 stay separate stories.

## Revised remaining forecast after cut 25

At the cut-25 checkpoint four outcomes remained: historical layouts, complete
integration validation, real evidence/repair-or-deferral, and acceptance/delivery.
That checkpoint estimated 4–6 more cuts,
conditional on source access. The former 3–5 forecast omitted integration and
split work too narrowly; it is withdrawn. Any new scope must be reported against
these outcomes rather than silently adding another series of technical cuts.

After cut 26, three planned outcomes remain (cuts 27–29), plus at most 1–2
corrective cuts for demonstrated defects. Access/approval waiting is not a cut.

After cut 27, two planned outcomes remain: (28) real evidence and exact repair or
zero-write deferral, then (29) acceptance/delivery. No new technical cut is added.
Any demonstrated future defect must be reported against these outcomes.


Cut 28 started on 2026-09-09 after pushing cut 27 as `a1ef9ca`. Firebase MCP
and bounded Drive metadata access are working; the CLI has no registered account.
The separate auditor and encrypted backup destination remain unidentified.
[The access checkpoint](inventory.md#cut-28-access-checkpoint--2026-09-09) records
current deployed-function presence and the exact limits of these metadata reads.
No trusted source capture or accepted deferral exists yet; cut 28 remains open.


The maintainer clarified on 2026-09-11 that participant orientation is immaterial,
but writing and reading must agree in both environments and any active-format
change must include the production workbook. The maintainer subsequently confirmed
that Codex prepared the current season provisionally before the app feature was
ready; the next annual generation will use the app. The accepted contract retains
HU-083's stacked market layout and readable delivery fields.

The isolated reference was backed up and adapted without changing dates or
assignees. Fresh bounded read-back verified all four adapted tabs, the unchanged
historical/summary tabs and 54 preserved round values. Visual inspection passed.
The actual read-back, anonymized in memory and processed with a synthetic baseline,
produced 72 shifts, no missing or changed assignments and zero import patches.
This resolves the reference layout discrepancy. It does not establish real
Firestore identities, ownership, helper continuity or production readiness.
Cut 28 remains open for trusted source evidence and exact repair or deferral;
coordinated production adaptation/activation remains HU-085 work.

The separately authorized Android dependency update is pushed as `aa95dc9`.
AGP 9.4.0, Kotlin 2.4.20, Compose BOM 2026.09.00 and Firebase BOM 34.19.0 pass
480 unit tests and 23 connected tests on Pixel 8 Pro API 35 (Android 15).
Lint completes with 136 existing warnings and two hints, compared with 141 warnings
and two hints under the prior catalog; an exact finding comparison shows no new
finding. Physical-phone installation was rejected and is not counted as a pass.
The iOS checkout edits are preserved. No Functions logic changed during this
follow-up; the cut-27 backend gate is not presented as newly rerun evidence.
