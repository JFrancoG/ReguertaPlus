# HU-083 → HU-085 evidence handoff — 2026-09-11

Status: **handoff prepared; final HU-083 deferral acceptance remains open**.
Implementation is `a1ef9ca`; the subsequent workbook, import and replacement
records are pushed through `eec8a55`. No shared deploy or live Firestore replacement
has occurred. This document identifies what the receiving story can reuse and
what still prevents a release decision.

## Decision and data treatment

Defer live develop replacement because the actual deployed writer does not honor
the new maintenance/provenance contract. Its initial planned creates are quiet,
but later confirmation reaches the old exporter. Retain the rebuilt develop
workbook and its private native backup; the old 62-document Firestore dataset
remains in place. Full replacement/inverse findings are in
[the reconciliation evidence](offline-reconciliation-proposal.md).

Develop's new test scenario keeps all 48 users and all 32 eligible members. It
retains the reference's 27 effective assignees; it does not label the other five
as fake or change their roles. The exact 139-write candidate and inverse are
private, emulator-only artifacts. They use synthetic operation/source-policy
state and **must not be submitted as live migration authority**.

Production's current season was prepared manually through Codex before the app
feature was ready. HU-085 must adapt its readable workbook and activate the backend
together, preserving existing dates, assignees, rounds and annotations. The next
annual generation runs through the app; this handoff does not regenerate the
current production season or authorize production access.

## Verified evidence

| Evidence | Result and practical limit |
| --- | --- |
| Native develop workbook | Four seasonal tabs, 72 turns, 108 filled phone cells, retained historical tabs and ACL; original private backup verified |
| Real import implementation | Emulator preparation/apply/replay plus stateful Sheets write-back; 53 helper normalizations and two cross-season patches; users/ownership/completion preserved |
| Exact disposable replacement | 62 deletes + 72 public creates + five private creates in one emulator transaction; inverse restores all original fields; stale/extra/repeated operations reject |
| Market target and carryover | Actual captured grid has ten 2026–27 dates/30 positions and eight 2027–28 dates/24 positions. Existing planner/adapter adds the two missing target dates, preserves every inherited block and the other three tabs, then carries the queue into two later boundary dates. One simulated batch; replay adds none |
| Android presentation read-back | 26/26 existing tests in `SessionShiftActionsFailureTest` and `ShiftSeasonBoundaryProjectionTest`; repository doubles, not the exact 72-document Firestore dataset |
| iOS presentation read-back | 2/2 existing Swift Testing cases for activation refresh and season boundary on iPhone 17 / iOS 26.5, `Reguerta-Develop`, official Xcode MCP; repository doubles |
| Live source drift check | At 18:50:05Z, two complete shift inventories match all 62 captured names/update times; five planning states remain absent, migration-baseline collection empty, and 48 user projections match the rehearsal input |

The latest live check uses the existing operator's read-only session and selected
fields/metadata. It is **not** a new auditor capture, source backup or post-drain
baseline. The evidence auditor remains revoked. Matching Firestore service update
times bind existing fields to the retained capture; the check does not freeze
future writes. The workbook was intentionally rebuilt earlier, so no claim is made
that both stores still equal the original pre-rebuild capture.

The iOS source tree matches HU-083; tests ran in the already-open main checkout,
whose unrelated project ordering edit was preserved. The complete Xcode log has
one FoundationModels initializer deprecation outside shifts, plus AppIntents
metadata-extraction tooling warnings. Therefore the two passing tests are not a
zero-warning release gate. No new product code or tests were added in this step.

## Receiving runtime and configuration contract

Review the exact HU-083 exports in `functions/src/index.ts`, including
`executeShiftSheetsImport`, `executeShiftPlanningSheetsSync`,
`onShiftPlanningPublicWritten`, `onVersionedShiftPlanningRequestCreated`,
`resolveShiftPlanningRequestContext`, `resolveDeliveryCalendarMutationContext`,
`transitionDeliveryCalendarOverride`, `transitionShiftSwap`, and
`executeShiftPlanningRecovery`. Reconcile the existing shift/calendar/notification
handlers and the retirement of legacy import/planning paths as one shared revision.
This list identifies the integration surface; it is not a deployment allowlist.

Keep per-environment `SHEETS_SPREADSHEET_ID_*`, `SHIFT_SHEETS_ALIASES_*`,
`SHIFT_SHEETS_IMPORT_TABS_*` and `SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_*`
consistent with the reviewed native workbook and current mapping. Stable workbook
IDs, phone data and principals' credentials remain outside Git. Drive versions
are observations, not compare-and-swap tokens. HU-083's private scripts/credentials
are not an execution identity for HU-085.

## Remaining acceptance work

1. Materialize the reviewed operational two-type baseline, expected digest and
   runtime-owned replacement/rollback command. The local candidate's synthetic
   version `100`, operation identity and cursor are not an approved live baseline;
   the ordinary repair materializer cannot reinterpret the legacy before-image.
2. Exercise both apps against the exact chosen post-operation dataset, not just
   their existing presentation doubles; bind request/export/notification/recovery
   evidence to that same final manifest.
3. Resolve the existing FoundationModels compiler warning before claiming the
   required iOS zero-warning gate. AppIntents tooling messages must be reported
   separately from Swift diagnostics.
4. In HU-085, refresh the post-drain evidence, contain current writers/clients and
   authorize the shared deployment and coordinated workbook adaptation. A
   maintenance document alone does not stop the currently deployed code.

Items 1–3 keep cut 28/final acceptance open. Item 4 remains the receiving story's
live activation work. Do not create another implementation cut merely to rename
these remaining requirements or mark the final zero-write deferral accepted.

## Artifact fingerprints

The private packet binds source, candidate, inverse, import, market and mobile
results. Packet SHA-256:
`1af695fdae3ee167bcfbab6b1ff8be2e0f084b6b0928c131518610106b1d8c48`.

- Source drift receipt: `dbb42e19a1e30b3096195ed553f9ca30a2cd6dc149d288e5393c41bf2234a540`.
- Market carryover receipt: `20ff249f74f8feb16c68fb46720044d8d901347775fb4fc4423e6483110fcdd4`.
- Exact candidate file: `6b157fa890b49b9152c43e9ce26c455ed30a993642cd3e34fb4680dd588f2c89`.
- Replacement/inverse receipt: `368b0c09cc395858695607cf679855625be8e8d01e954326a8f6990393bfbfdc`.

The operational baseline digest is deliberately absent until item 1 is satisfied;
a hash of this handoff must not be substituted for it. Packet field
`acceptedFinalDeferral` is false. See the existing
[HU-085 plan](../hu-085-production-shift-workbook-activation/plan.md) for the live
execution sequence and authorization boundaries.
