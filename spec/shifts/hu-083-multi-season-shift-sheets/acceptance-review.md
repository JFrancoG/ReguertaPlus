# HU-083 — consolidated acceptance review

Reviewed on 2026-09-08 at `775be1adaae27d60e506677f6d1832739846c2ba`
(cuts 1–17 pushed). Cut 18 reconciles implementation evidence and reruns the
backend checks. It changes no runtime, schema, permissions or deployment.

## Result

The canonical adapter, private sync/import entry points, controlled-event audit
and offline repair/conversion tooling have local and emulator evidence. HU-083
is still open: ordinary/full/override export and legacy import/generation have
not all migrated to the canonical pipeline, the human-facing layout is undecided,
and neither the real-data safe-apply nor the exact zero-write deferral is complete.
Passing adapter tests cannot certify those remaining paths.

Do not add further generic review schemas or rehearsal layers to resolve these
remaining requirements. The next implementation must address the existing writer
routes after the layout decision; the evidence work must obtain the missing real
inputs rather than manufacture another synthetic readiness artifact.

## Implementation and acceptance map

| Requirement | Current evidence | Remaining boundary |
| --- | --- | --- |
| Explicit environment/workbook and seasonal aliases | [Config](../../../functions/src/shift-sheets-config.ts), config tests; new worker/import reject missing or cross-environment authority | Legacy `getSheetConfig` still uses global fallback; repository-wide replacement is open |
| Stable identity, create/merge, carryover and manual-field preservation | [Canonical adapter](../../../functions/src/shift-sheets.ts), [behavior tests](../../../functions/test/shift-sheets.test.cjs) | Actual human tabs reject technical headers; no live conversion is certified |
| Seasonal union and guarded effective assignments | [Import reader](../../../functions/src/shift-sheets-import.ts), [planner](../../../functions/src/shift-sheets-import-plan.ts), [Firestore adapter](../../../functions/src/shift-sheets-firestore-import.ts) | Legacy sync remains separate; human apply remains closed |
| Explicit pull, claims, exact manifest and bounded retry | [Worker](../../../functions/src/shift-planning-sheets-worker.ts), [consumer](../../../functions/src/shift-planning-sheets-consumer.ts), exported `executeShiftPlanningSheetsSync` | No live invoker/scheduler configuration or deployment |
| Durable Sheets attempt, replay and unknown-outcome reconciliation | Consumer/import emulator cases, shared workbook reservation, exact cells/marker/version checks | Protocol evidence is not an external-writer fence or physical cross-store CAS |
| Controlled event suppression and recovery identity | [Trigger](../../../functions/src/shift-planning-public-event-trigger.ts), actual exported-trigger emulator cases, durable audit 32/32 | Both candidate trigger revisions and explicit policy need HU-085 rollout; ordinary effects keep their existing route |
| Retention and rejection | Typed retention policy, durable controlled/rejected ledgers, strict/phase1 access tests | Operator logs do not prove alert delivery; real policy/retention lifecycle remains an operational gate |
| Full export, ordinary incremental export and overrides | Existing candidate paths listed below | Local migration is incomplete; cannot be marked done as merely pending deployment |
| Ownership, completed history and predecessor/current/successor CAS | New import emulator coverage; strict ownership/provenance Rules and retained-marker routing | Does not certify all legacy mutation routes or current deployed behavior |
| Audit, repair documents, baseline and inverse | [Auditor](../../../functions/scripts/audit-shift-planning.cjs), [repair review](../../../functions/scripts/repair-planned-shifts.cjs), [materializer](../../../functions/scripts/materialize-shift-repair.cjs), loopback/demo [rehearsal](../../../functions/scripts/rehearse-shift-repair.cjs) | Supplied snapshots and synthetic commits do not prove capture completeness, historical membership or live inverse authority |
| Human-layout conversion | [Offline proposal](../../../functions/scripts/plan-shift-sheets-conversion.cjs), full original images, canonical clone and integration tests | Archive-and-create is a proposal, not approval of the human-facing format; formula-reference behavior and real clone restoration remain open |
| Real develop repair or zero-write HU-085 deferral | [Bounded layout inventory](inventory.md) and the supplied-snapshot tooling | No trusted dual-store baseline, exact real-data manifests, unchanged-source proof or completed deferral acceptance |

## Candidate legacy routes still present

These observations refer to the repository at the reviewed commit, not to an
inventory of deployed Functions. The implementation source is
[`functions/src/index.ts`](../../../functions/src/index.ts).

| Entry point / helper | Current behavior | Work required before claiming complete migration |
| --- | --- | --- |
| `getSheetConfig` / `getEnvScopedConfigValue` | Environment lookup can fall back to global values; default fixed ranges remain | Bind every migrated caller to the explicit environment contract; preserve separately governed compatibility while callers remain |
| `exportShiftsToGoogleSheets` → `exportAllShiftsToGoogleSheets` | Iterates all shifts through fixed delivery/market ranges and `upsertShiftRowInSheet` | Route by reviewed seasonal identity and the agreed layout, with coherent authority/read-back |
| `syncShiftsFromGoogleSheets` → `syncShiftsFromGoogleSheetsInternal` | Reads `sheetRangeDefinitions` through the older parser | Migrate callers or explicitly replace/retire the endpoint under reviewed compatibility |
| Ordinary branch of `onShiftWritten` | Marked backend events are separated; ordinary confirmed app rows still use human-range `A:C`/`A:F` upsert and notifications | Prove the chosen seasonal writer path preserves ordinary-event and notification behavior |
| `onDeliveryCalendarOverrideWritten` | Sends matching shifts through `sheetConfig.deliveryRange` | Route overrides through the same reviewed layout and seasonal authority |
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

1. Decide the human-facing layout. The cut-17 archive/technical-table option is
   reviewable but unapproved; preserving the editable human format has different
   implementation requirements. Neither choice authorizes live conversion.
2. Finish the concrete legacy-route integration above with focused behavior tests,
   preserving ordinary notification semantics and existing governance fences.
3. Obtain trusted Firestore/Sheets evidence through the separately bounded auditor
   defined in [spec.md](spec.md). Inventory alone is not backup authority. Verify
   approved calendars, ownership/bootstrap and historical/helper boundaries.
4. Build the exact real-data materialization and recovery manifests. If effective
   writers or reached triggers cannot be safely contained within develop, prepare
   the exact zero-write HU-085 deferral, including unchanged-source evidence and
   the expected baseline. Do not label the present synthetic fixture as that proof.
5. Reconcile remaining acceptance criteria, then request the separately authorized
   delivery/closure steps. HU-084 and HU-085 stay separate stories.
