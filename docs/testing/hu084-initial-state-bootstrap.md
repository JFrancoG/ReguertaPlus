# HU-084 initial coverage-state bootstrap

The maintainer confirms zero initial outstanding credits and no known prior
active reserves on 2026-10-27. The preparation uses each environment's existing
Firestore data. It does not copy develop members into production.

## What is initialized

`users` supplies canonical member IDs, activity, roles and common-purchase
responsibility. `shiftRotations` and ordinary owners in `shifts` supply existing
queue/history evidence. Auth links authorize the operator and do not exclude a
member who has never signed into the app.

The plan proposes only missing `shiftMembershipState` observations and consistent
missing `shiftCoverageLedgerState` generations at zero. Existing users, accounts,
rotations, published assignments and valid private history are retained. Initial
cohort members do not receive a new reserve entry. Current inactivity does not
declare permanent departure. A pending credit or active reserve contradicting the
confirmed opening state blocks all creates for review.

## Local review command

From `functions`, build and supply a complete encoded snapshot from the injected
adapter's read-only `inspect()` and an exact decision JSON:

```sh
npm run prepare:shift-coverage-bootstrap -- \
  --snapshot /absolute/private/capture.json \
  --decision /absolute/private/decision.json \
  --out /absolute/private/new-review.json
```

The decision contains exactly `schemaVersion: 1`, `environment`, `operationId`,
`effectiveAtMillis`, `confirmationReference`, `reserves: "none"` and
`credits: "none"`. The effective time is the initial observation, not a historical
join/FIFO date. `operationId` cannot be `current`. Both environment namespaces
are supported independently; a mismatched capture/decision is rejected.

This tool only reads local JSON, constructs no SDK client and has no apply/project
flag. It refuses to overwrite input/existing output, writes the review with mode
0600 and prints a count/digest summary. Exit 0 means no reported blocker; exit 2
means a blocked review with zero proposed writes; exit 1 means invalid input or
output. An offline review does not attest that supplied source sets are complete.

## Governed application boundary

The injected backend adapter must recapture the real complete bounded sources
and current linked administrator in the applying transaction. It requires the
exact reviewed digest, closed maintenance, the existing trusted intake barrier,
the correct workbook authority and transaction admission. Scope/source changes,
new documents or incompatible existing state reject before any business create.

An immutable receipt and `shiftCoverageMigrations/current` are created atomically
with missing private state. Exact retries preserve later legitimate ledger or
membership changes. A missing/malformed/rewritten initial proof keeps normal
coverage admission closed. An unresolved final barrier acknowledgement retains
its incident rather than reporting clean success.

The adapter is tested through fixed-demo SDK/Rules scenarios; no live CLI apply
or deployed bootstrap endpoint is provided here. Real source capture, control-plane
and operator admission, reviewed bounded application and read-back need a concrete
authorized handoff. `operationalReady` remains false. Native sources are unchanged.

See [ADR-0020](../decisions/0020-initialize-coverage-state-from-reviewed-canonical-sources.md)
and the HU-084 plan/review for accepted evidence and remaining activation gates.

## Shared develop readiness observed on 2026-10-27

A bounded read-only Firebase MCP check in `reguerta-9f27f` requests four exact
develop configuration paths with field masks: `shiftPlanningState/current`,
`shiftPlanningState/sourcePolicy`, `shiftRotations/delivery` and
`shiftRotations/market`. All four return document-not-found. No user collection,
production path, workbook or credential is read or changed by this check.

This is a base-planner readiness gap. It does not imply missing accounts or
missing legacy published shifts. Before an actual develop bootstrap can apply,
prepare/review the canonical rotation baseline from the existing published
history, retaining dates and order, and establish the required governed state.
That is the existing HU-082/HU-083/HU-085 base-planner rollout boundary, not a
reason for this initializer to guess queues or silently enable the feature.

## Subsequent develop preparation

The [2026-10-27 preparation report](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/develop-planner-base-preparation.md)
records the later bounded user/shift/workbook reads and private semantic proposal.
All 72 published dates and 108 ordered places match the retained approved develop
scenario. Helpers (53 blank cells), missing July/August 2027 market dates, the 62
legacy Firestore rows and missing real Drive/runtime authority remain explicit.
This does not supersede the earlier check's scope or apply the initial state.
