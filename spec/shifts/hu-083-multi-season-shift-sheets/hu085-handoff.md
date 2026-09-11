# HU-083 → HU-085 evidence handoff — updated 2026-09-12

Status: **final HU-083 deferral accepted by the maintainer on 2026-09-12**.
See [accepted closeout](closeout.md); delivery is tracked by issue #267.
Backend implementation is `a1ef9ca`; prior evidence is pushed through
`601676e`. The native acceptance tranche adds the iOS/Android scenario and the iOS
warning/test-host fixes described in [native acceptance](native-acceptance.md).
No shared deploy or live Firestore replacement has occurred. This document identifies what the receiving story can reuse and
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
as fake or change their roles. The new private 139-write content plan and inverse use explicit reset, operation
and two-type baseline identities. Both rotations start the approved new test
queue with all 32 eligible UIDs, then consume 54 positions each. This replaces
the synthetic rehearsal baseline, but **is not a live execution command**: actual
Drive version, deployed admission authority and post-drain source binding remain
activation requirements. The isolated transport version is excluded from this
content plan.

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
| Android native acceptance | 1/1 instrumentation scenario, Pixel 8 Pro / API 35: actual SDK/repository reads 72 turns, real import changes two rows, same repository reads the change and restored 62 records; production presentation selectors checked |
| iOS native acceptance | 1/1 Swift Testing scenario, iPhone 17 / iOS 26.5, `Reguerta-Develop`, official Xcode MCP: actual SDK/repository and the same ViewModel observe all three phases, exact fields and upcoming roles |
| Live source drift check | At 18:50:05Z, two complete shift inventories match all 62 captured names/update times; five planning states remain absent, migration-baseline collection empty, and 48 user projections match the rehearsal input |

The latest live check uses the existing operator's read-only session and selected
fields/metadata. It is **not** a new auditor capture, source backup or post-drain
baseline. The evidence auditor remains revoked. Matching Firestore service update
times bind existing fields to the retained capture; the check does not freeze
future writes. The workbook was intentionally rebuilt earlier, so no claim is made
that both stores still equal the original pre-rebuild capture.

The new iOS acceptance runs in the HU-083 worktree. The first run exposed live
host initialization outside the named emulator repository. Unit/release plans
now pass the existing `-useMockAuth` composition argument; the repeated passing
acceptance has no such live queries. Async Firebase cleanup covers success and
failure. Two pre-existing HTTP command suites now use a named local Firebase
fixture instead of depending on default Firebase initialization by the live host. Independent Swift standards/source-style review has no remaining
findings. FoundationModels uses the SDK27 renamed initializer with its iOS26 back
deployment and retains the SDK26 spelling under older compilers. AppIntents
metadata-tool diagnostics remain distinct from compiler deprecations.

Android general validation passes all 480 unit tests. Lint has zero errors; its
136 warnings and two hints exactly match the existing main-checkout report,
including locations/messages. The new acceptance test introduces no lint finding.

Final iOS validation: the canonical `validate-ios.sh release-gate` runner passed
uninterrupted with exit code 0 on iPhone 17 / iOS 26.5, using Xcode RC. Its native
summary reports 896 tests: 895 passed, one existing screenshot-launch test skipped,
zero failures (the skipped identifier has four UI configuration executions).
SwiftLint checks 487 files with no violations; Debug/Release builds and settings
checks pass. The first attempt exposed the default-Firebase fixture dependency;
that issue was fixed and the entire gate was rerun, not waived. Independent
`fast-unit-v1` also passed all 878 Swift Testing tests (1,349 MCP reported results
including parameterized results). SDK26 API compatibility passes
`-warnings-as-errors`. Earlier AppIntents metadata-tool messages are distinct
from the corrected Swift deprecation; the final runner log has no warning lines.

The final controller passes both native phases, including extra-document and
same-fields/new-updateTime inverse rejection. Its parity receipt verifies equal
native observable values in all three phases across platforms; backend attempt
timestamps/receipt identities remain separate per rehearsal run.

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

1. Review the deferred runtime work below, then bind the approved content baseline
   to actual activation authority and materialize the runtime-owned forward/inverse
   command in HU-085. This is an implementation requirement, not just a missing
   metadata field. The native connector
   omits Drive `version`; the existing operator OAuth scope returns 403 for the
   direct metadata read. No invented version is substituted. The ordinary repair
   parser still cannot reinterpret the raw legacy before-image, and remains strict.
2. In HU-085, obtain fresh post-drain evidence, contain writers/clients, bind the
   actual Drive observation and deployed index authority, and authorize the shared
   deployment/coordinated workbook adaptation. The maintenance document alone
   does not stop currently deployed code. Bind deployed event/notification
   acceptance to that final runtime manifest.
3. Complete the authorized PR/merge delivery after the accepted final deferral
   recorded in `closeout.md` and the validation record below. Native SDK/data acceptance and the
   FoundationModels source correction are no longer implementation blockers.

Cut 28 final deferral is accepted. Items 1 and 2 remain HU-085 implementation
and activation work; the content rehearsal does not represent them as completed. No extra functional cut was
created. Native data/presentation acceptance does not claim UI screenshots,
security Rules coverage, deployed event delivery or FCM dispatch.

## Artifact fingerprints

The private packet binds source, candidate, inverse, import, market and mobile
results. Packet SHA-256:
`1af695fdae3ee167bcfbab6b1ff8be2e0f084b6b0928c131518610106b1d8c48`.

- Source drift receipt: `dbb42e19a1e30b3096195ed553f9ca30a2cd6dc149d288e5393c41bf2234a540`.
- Market carryover receipt: `20ff249f74f8feb16c68fb46720044d8d901347775fb4fc4423e6483110fcdd4`.
- Exact candidate file: `6b157fa890b49b9152c43e9ce26c455ed30a993642cd3e34fb4680dd588f2c89`.
- Replacement/inverse receipt: `368b0c09cc395858695607cf679855625be8e8d01e954326a8f6990393bfbfdc`.

The historical packet above remains immutable. The new content plan SHA-256 is
`1ae67403844d4759d2bd0743db485f714d3386057d702d5ce34633924c183f42`;
its plan/baseline digests and exact scope are in [native acceptance](native-acceptance.md).
An approved content-baseline digest must not be substituted for the remaining
runtime activation authority. `acceptedFinalDeferral` is now true; immutable prior
receipts retain their historical values and `liveExecutable` remains false. See the existing
[HU-085 plan](../hu-085-production-shift-workbook-activation/plan.md) for the live
execution sequence and authorization boundaries.


Final local acceptance packet SHA-256:
`61c0fce8d9984f42230115a5ad71b1bb2f609f2fc6394ef53f5f8a2142d06684`.
The private packet retains the successful unit `.xcresult`, UI evidence, initial
fixture-failure diagnostic, Android result, phase/parity receipts and reproducible
controller sources. Temporary Firebase config copies, dependency link and iOS
opt-in marker were removed after validation; connected physical devices were not
used for installation or testing.


The final, successful integrated gate is bound by `release-gate-receipt.json`,
SHA-256 `b637b7195b49fcdbd01047cad0364a99a4153d6c8b9f44783f60c0ffdf8b6396`.
It supersedes only the interrupted-gate limitation in the previous immutable
packet. The final `.xcresult`, native summary and emulator receipt are retained.

## Exact runtime boundary — 2026-09-12

The additional opt-in `hu083-runtime-boundary.cjs` runs the existing transactional
public-event auditor in `demo-hu083-runtime-boundary`. All four cases pass with
zero skips. This probes the event snapshots from the exact content plan; it does
not invoke deployed Functions or simulate CloudEvent delivery.

| Exact input | Existing runtime result |
| --- | --- |
| 72 marked creates, activation terminal present, no retention in the content plan | 72 alertable fail-closed decisions; all 72 rejection replays persist correctly |
| Same 72 creates plus exact local fixture retention | 72 controlled no-ops; all 72 successful replays persist correctly |
| 72 marked deletes delivered after the content inverse has deleted the operation | 72 alertable fail-closed decisions; all 72 rejection replays persist correctly |
| 62 original `google_sheets` / `planned` records restored or deleted | 62 ordinary creates and 62 ordinary deletes; no backend mutation marker is invented |

The positive control uses an explicitly local retention policy. Its duration is
not a production retry-horizon decision. Ordinary classification alone is not
proof that a deployed trigger or FCM send was exercised.

**HU-085 must not submit the 139-write content plan as a runtime command.** Its
forward command must include exact retained event authority and the real closed
maintenance/write-epoch/source-policy binding. Its inverse must restore business
data while retaining recovery terminals, before-images where required, event
ledgers and the advanced security epoch. Deleting all newly created private
objects is appropriate only for this isolated content-restoration comparison.
The existing canonical activation recovery accepts its own admitted lineage;
this legacy reset has no such runtime-owned staged bundle/authorization. Do not
weaken those parsers or expose a generic arbitrary-write endpoint to bridge it.

The bounded receiving task is to materialize/execute this approved reset through
the fenced runtime using the existing publication, admission and audit contracts,
with the retained recovery evidence above. Recompute both complete transaction
budgets and re-rehearse after binding fresh source/Drive/index authority. HU-083
hands over the exact content/inverse and these executable boundary checks; this
is not evidence that the receiving command is already implemented.

The maintainer accepted the explicit zero-write deferral on 2026-09-12, including
the runtime implementation assigned to HU-085, and authorized HU-083 PR/merge and
closure. This is the accepted scope, not an assertion of live readiness. The
[closeout](closeout.md) reconciles the story criteria and delivery evidence.

Runtime-boundary receipt SHA-256: `8709bfe2f9652a3df907e86bdf70db0f89753961278129c53f31922fe1781f9e`.
Functions lint/build and `node --check` pass. No Android/iOS source changed after
`601676e`; their accepted native/release evidence remains applicable.
