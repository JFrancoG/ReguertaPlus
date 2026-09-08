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

## Result

The canonical adapter, private sync/import entry points, controlled-event audit,
repair tooling and the three seasonal human writer routes have local/emulator
evidence, including reviewed human apply/write-back. HU-083 remains open:
generation/new-tab creation and the activation worker still need the selected
readable contract, and legacy sync remains separate; real-data
safe-apply or exact zero-write deferral is also incomplete. The archive/technical
conversion proposal is not selected for the user workflow.

Continue the existing pipeline integration rather than adding generic review
schemas. Obtain the missing real inputs for the operational evidence gates.

## Implementation and acceptance map

| Requirement | Current evidence | Remaining boundary |
| --- | --- | --- |
| Explicit environment/workbook and seasonal aliases | [Config](../../../functions/src/shift-sheets-config.ts), config tests; new worker/import reject missing or cross-environment authority | Cut 19 routes legacy callers through the shared strict resolver; deployed configuration remains unverified |
| Stable identity, create/merge, carryover and manual-field preservation | [Canonical adapter](../../../functions/src/shift-sheets.ts), [behavior tests](../../../functions/test/shift-sheets.test.cjs) | Actual human tabs reject technical headers; no live conversion is certified |
| Seasonal union and guarded effective assignments | [Import reader](../../../functions/src/shift-sheets-import.ts), [planner](../../../functions/src/shift-sheets-import-plan.ts), [Firestore adapter](../../../functions/src/shift-sheets-firestore-import.ts) | Human apply/write-back is locally integrated in cut 22; legacy sync remains separate |
| Explicit pull, claims, exact manifest and bounded retry | [Worker](../../../functions/src/shift-planning-sheets-worker.ts), [consumer](../../../functions/src/shift-planning-sheets-consumer.ts), exported `executeShiftPlanningSheetsSync` | No live invoker/scheduler configuration or deployment |
| Durable Sheets attempt, replay and unknown-outcome reconciliation | Consumer/import emulator cases, shared workbook reservation, exact cells/marker/version checks | Protocol evidence is not an external-writer fence or physical cross-store CAS |
| Controlled event suppression and recovery identity | [Trigger](../../../functions/src/shift-planning-public-event-trigger.ts), actual exported-trigger emulator cases, durable audit 32/32 | Both candidate trigger revisions and explicit policy need HU-085 rollout; ordinary effects keep their existing route |
| Retention and rejection | Typed retention policy, durable controlled/rejected ledgers, strict/phase1 access tests | Operator logs do not prove alert delivery; real policy/retention lifecycle remains an operational gate |
| Full export, ordinary incremental export and overrides | Cut-20 human routing and exported-handler integration tests | Readable existing-tab updates are local; human-tab creation, worker integration and legacy sync remain open |
| Ownership, completed history and predecessor/current/successor CAS | New import emulator coverage; strict ownership/provenance Rules and retained-marker routing | Does not certify all legacy mutation routes or current deployed behavior |
| Audit, repair documents, baseline and inverse | [Auditor](../../../functions/scripts/audit-shift-planning.cjs), [repair review](../../../functions/scripts/repair-planned-shifts.cjs), [materializer](../../../functions/scripts/materialize-shift-repair.cjs), loopback/demo [rehearsal](../../../functions/scripts/rehearse-shift-repair.cjs) | Supplied snapshots and synthetic commits do not prove capture completeness, historical membership or live inverse authority |
| Human-facing layout | Readable/editable date-name sheets selected; cut-20 writer preserves annotation columns | Archive/technical-table proposal is not selected. Reviewed human apply/write-back is integrated; legacy sync, generation and worker integration remain open |
| Real develop repair or zero-write HU-085 deferral | [Bounded layout inventory](inventory.md) and the supplied-snapshot tooling | No trusted dual-store baseline, exact real-data manifests, unchanged-source proof or completed deferral acceptance |

## Candidate legacy routes still present

These observations refer to the repository at the reviewed commit, not to an
inventory of deployed Functions. The implementation source is
[`functions/src/index.ts`](../../../functions/src/index.ts).

| Entry point / helper | Current behavior | Work required before claiming complete migration |
| --- | --- | --- |
| `getSheetConfig` → `readLegacyShiftSheetsConfig` (cut 19) | Explicit environment book and both ranges; missing values disable routing, with no global/default fallback | Require scoped configuration at rollout; seasonal writer migration remains open |
| `exportShiftsToGoogleSheets` → `exportAllShiftsToGoogleSheets` | Cut 20 iterates shifts through seasonal human ranges from their logical dates | Existing-tab route tested across delivery seasons and market; complete read-back/recovery remains an operational requirement |
| `syncShiftsFromGoogleSheets` → `syncShiftsFromGoogleSheetsInternal` | Reads `sheetRangeDefinitions` through the older parser | Migrate callers or explicitly replace/retire the endpoint under reviewed compatibility |
| Ordinary branch of `onShiftWritten` | Cut 20 resolves the seasonal alias, updates readable fields and retains ordinary notification effects | Existing-tab integration tested, including ignored wrong `syncMeta.sheetName`; live side effects remain unverified |
| `onDeliveryCalendarOverrideWritten` | Cut 20 keeps the logical seasonal tab while changing the visible date within the same ISO week | Exported override integration tested; real workbook read-back remains open |
| Legacy `onShiftPlanningRequestCreated` path | Old generation retains `updateWholeSheet` (`values.clear` then update); newer requests have their separate pipeline | Prove dispatch/compatibility before changing or retiring the old generation path; canonical adapter tests do not remove this code |

The new pipeline is composed in `index.ts` as `executeShiftSheetsImport`,
`executeShiftPlanningSheetsSync` and `onShiftPlanningPublicWritten`. Their presence
is not evidence that the table above already uses them.

## Validation at the reviewed commit

Functions lint and TypeScript build pass. The local test union contains the 60
unique files selected by these existing scripts:

- `test:shift-planning:unit`
- `test:backend-security`
- `test:migrations`
- `test:shift-sheets`
- `test:shift-planning:audit`
- `test:shift-repair:authority`
- `test:shift-sheets:conversion`

The union ran once with Node's test runner: **492 passed, 51 skipped, 0 failed**.
The 51 cases require their emulator context; this run does not claim to execute
them. The focused emulator runs below are their own evidence, not proof that
all 51 skipped cases were subsequently covered.

| Existing npm script | Passed | Skipped |
| --- | ---: | ---: |
| `test:shift-planning:sheets-consumer:emulator` | 17 | 0 |
| `test:shift-sheets:import:emulator` | 40 | 0 |
| `test:shift-planning:public-event-audit:emulator` | 32 | 0 |
| `test:shift-planning:public-event-trigger:emulator` | 12 | 0 |
| `test:shift-planning:sync-command:emulator` | 7 | 0 |
| `test:shift-repair:emulator` | 6 | 0 |
| `test:firestore-role-access` | 32 | 0 |
| `test:firestore-phase1` | 8 | 0 |
| `test:rules` | 6 | 0 |

These are **160 passing emulator test executions**, including some unit cases
also present in the local union; do not sum the tables as unique test coverage.
Each emulator script used its existing `demo-*` project, ran sequentially under
Java 21 and shut down normally. Sheets behavior used the public-API fake; no real
Google Sheet was changed. No Functions/Rules deployment, live source mutation,
IAM change or FCM send occurred. No Android/iOS code changed against the HU-083
base, so their gates were not rerun. Actual app read-back remains a live gate.

## Remaining execution order

1. Keep the selected readable/editable date-name layout; do not deploy the
   unselected archive/technical-table workflow. This choice does not authorize
   live conversion.
2. Integrate generation/new-tab creation, the activation worker and the legacy
   sync endpoint, preserving ordinary notifications and existing fences.
   Reviewed human apply/write-back is locally integrated in cut 22.
3. Obtain trusted Firestore/Sheets evidence through the separately bounded auditor
   defined in [spec.md](spec.md). Inventory alone is not backup authority. Verify
   approved calendars, ownership/bootstrap and historical/helper boundaries.
4. Build the exact real-data materialization and recovery manifests. If effective
   writers or reached triggers cannot be safely contained within develop, prepare
   the exact zero-write HU-085 deferral, including unchanged-source evidence and
   the expected baseline. Do not label the present synthetic fixture as that proof.
5. Reconcile remaining acceptance criteria, then request the separately authorized
   delivery/closure steps. HU-084 and HU-085 stay separate stories.
