# HU-089 combined delivery review

## Scope and authority

Reviewed on 2026-10-11 against HU-084 base
`5f36e041394ada8d3db3949b10691e9974e91669`, the three HU-089 functional blocks
through pushed `69e2ce276ad7d353780014cb4ef1d184fa2e82bf`, and the corrective
changes below. Review covers implementation, policy consistency, transaction
ordering, replay/source fences, native parity and observable regression evidence.
It does not certify shared deployment or collective ratification.

The maintainer explicitly selected late administrative resolution while recording
delay, after review found that the administrative deadline blocked future shifts.
See bilingual ADR-0017 and the reconciled member proposal/matrices.

## Findings and corrections

| Finding | Resolution | Observable evidence |
| --- | --- | --- |
| P1: expired administration prevented resolving a future shift | Keep the original 3/1-day management target; permit bounded administrative offers before the shift, without restarting any search phase. Store actor-bound private delay evidence. | Normal/urgent store and real Auth/HTTP journeys; committed draw cancellation/resumption preserves order, evidence and original timing; replay does not rewrite audit; expiry/start/role/eligibility fences remain. |
| P3: Android minute truncation made the final 1–59 valid seconds unusable | Round the minute input upwards but clamp the actual expiry to the exact remaining limit; display the effective expiry. | Both native clients exercise real action/draft decisions with 1/59 seconds and expired administrative targets; invalid oversized input and offers at/after shift start remain rejected. |
| P3: D06/D12 matrices still described local implementation as pending | Reconcile English/Spanish matrices with completed local reserve and cancellation behavior; retain shared integration and collective ratification as pending. | Spec, tasks, proposal and ADR-0015/0017 agree. |
| P3: lifecycle Android lint count was inaccurate | Correct the retained lifecycle evidence to 138 warnings/two hints, zero errors. | Retained XML/HTML and the repeated final lint report agree; no issue points to the changed coverage files. |

Spacing integration documentation now explicitly binds exception
`planningRequestId` to the stable `bundleId`, shared by preview/stage/activate.
There were no other confirmed blockers in the reviewed local scope.

## Design assessment

The implementation is proportionate. It extends the existing coverage selection,
membership reconciliation and governed publication transactions, with small pure
rules for timing, reserve expiry and spacing. It adds no scheduler, alternative
queue engine, automatic reordering or credit-deferral planner. Immutable receipts,
current actor/source checks and inverse guards preserve the existing safety model.

Ordinary history belongs to the rotation owner. Coverage assignees, helpers and
markets cannot alter its delivery spacing. Credit compression rejects an unsafe
unchanged plan until exact exceptions exist. Bounds reject incomplete/excessive
evidence rather than returning partial planning authority.

## Validation

- Functions lint/build passed. Planning unit lane: 295 passed, 51 existing
  emulator-dependent skips, zero failures. Coverage pure lane: 63/63 passed.
  Log: `/tmp/hu089-review-backend-unit.log`.
- Complete fixed-demo Firestore/Rules/publication workflow: 165/165 passed,
  zero failures/skips, including the four new late-administration store cases.
  Log: `/tmp/hu089-review-backend-emulator.log` (the first Auth pass in this log
  failed on incorrect test projection lookup, corrected before the final rerun).
- Real emulator Auth/HTTP: 26/26 passed, zero failures/skips. Four new journeys
  exercise the amended policy through verified tokens and the HTTP transport.
  Final log: `/tmp/hu089-review-auth-final.log`.
- Android: 508 unit tests passed, zero failures/errors/skips. `lintDebug` passed
  with zero errors, the retained 138 warnings and two hints, no coverage-file
  issue and no compiler warning. API 29 connected execution passed 23 ordinary
  tests; four opt-in Coverage/Sheets cases exited through their existing
  `AssumptionViolatedException` conditions. XML reports these as failures while
  Gradle succeeds; they are not counted as newly exercised journeys.
  Logs: `/tmp/hu089-review-android.log`,
  `/tmp/hu089-review-android-connected.log`.
- iOS canonical release gate passed on Xcode 27.1 / iPhone 17 iOS 26.5
  (`091D93C1-5A53-40D0-887E-83F81A8E0326`): 927 passed, five expected
  opt-in/conditional skips, zero failures/compiler warnings/runtime warnings.
  Lint 511 files clean, settings and Debug/Release builds passed. Final result:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu089-review-ios-ljj218cy/release-gate.xcresult`.
  The earlier gate stopped on test-file lint; new tests were moved to an extension
  in the same suite without weakening diagnostics. Xcode emitted host SDK/debugger
  metadata diagnostics during the successful run; these are distinct from app
  compiler/runtime warnings. Synthetic Firebase configurations were restored
  exactly. Summary: `/tmp/hu089-review-ios-summary.json`.
- Independent correction review, five-file Swift style/accessibility audit and
  `git diff --check` passed. No physical accessibility or real push rerun is claimed.

Only documentation/changelog changed after these successful gates. The initial
spacing commit is pushed as `69e2ce27`; the corrective commit and remote verification
are recorded in the tracker after delivery. No required local implementation or
review finding remains open.

## Remaining scope and next gate

The local story can proceed to PR review after this corrective validation and push.
The intended comparison base is `codex/hu-084-stable-shift-coverage-and-credits`
while draft PR #278 remains unmerged at the base above; comparing directly against
main would mix the parent story into this review.

HU-084 still owns administrative membership/spacing forms on both platforms,
shared source composition and operation, authoritative legacy migration, real draw
provider/observability, and ratified activation/recovery. Physical accessibility and
real notification evidence from the parent are not claimed as new HU-089 runs.
No temporary cross-platform parity gap remains in the implemented local behavior.
Issues #279/#268 and PR #278 stay open; this review does not create or merge a PR,
close an issue, delete a branch, deploy, notify real members or mutate real data.

## Definitive child delivery — 2026-10-11

After this review, the maintainer requested PR preparation and conditional
closeout. [PR #280](https://github.com/JFrancoG/ReguertaPlus/pull/280) merged into
the HU-084 branch as `3a115ac6ed153e7cc533f48ba12b5b621f7e3f56`; its tree is identical
to the validated implementation head `23e085f6`. Issue #279 was closed and its
fully integrated branch removed locally and remotely. Delivery documentation
records these verified results without changing behavior or repeating full gates.
The parent remains draft/open and has not reached main or shared activation.
