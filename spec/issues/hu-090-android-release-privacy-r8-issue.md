# [HU-090] Preparar privacidad y optimización R8 de Android para publicación

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/282

## Current outcome and plan state

Prepare unpublished ReguertaPlus Android with no advertising access and a
validated R8-optimized Release. **Privacy/R8, camera and lint local validation recorded; HU acceptance remains pending.**
The owner approved execution on 2026-11-10; publication and production remain prohibited.

## Decisions resolved on 2026-11-10

- Use published main `7491ebae`, including Android dependency update `0cff11eb`:
  AGP 9.5.1, Kotlin 2.4.21, Firebase BOM 35.1.0 and the committed version catalog.
- The owner subsequently approved the wrapper-only Gradle 9.9.1 exception;
  all other application/plugin pins remain unchanged.
- Retain non-advertising Analytics, including ordinary usage reporting and
  non-advertising measurement attribution; prohibit advertising IDs/AdServices
  access and advertising uses/signals. Preserve Crashlytics/FCM.
- Operator status is complete according to the owner; not independently
  verified by this HU and not a publication/declaration approval.

## Canonical sources

- [Spec](../app/hu-090-android-release-privacy-r8/spec.md)
- [Plan](../app/hu-090-android-release-privacy-r8/plan.md)
- [Tasks](../app/hu-090-android-release-privacy-r8/tasks.md)
- [Original local validation and artifact receipts](../app/hu-090-android-release-privacy-r8/validation.md)
- [Camera correction and new local validation](../app/hu-090-android-release-privacy-r8/camera-fix-validation.md)
- [Approved lint remediation plan](../app/hu-090-android-release-privacy-r8/lint-remediation-plan.md), [historical diagnostic inventory](../app/hu-090-android-release-privacy-r8/lint-inventory.json) and [current lint validation](../app/hu-090-android-release-privacy-r8/lint-validation.md).
- [Remaining non-advertising data inventory and review limits](../app/hu-090-android-release-privacy-r8/privacy-inventory.md)
- ADR-0015: [EN](../../docs/decisions/0015-android-release-privacy-and-local-validation.md) / [ES](../../docs-es/decisions/0015-privacidad-release-android-y-validacion-local.md).
- Independent distribution gate: [secure-store issue #228](https://github.com/JFrancoG/ReguertaPlus/issues/228).

## Approved execution approach

- Verify the three advertising permissions are absent from final artifacts,
  and SDK advertising controls are effective; inventory remaining non-ad IDs.
- Use modern R8 code/resource optimization, narrow rules and typed error mapping.
- Validate locally with a non-publishable Release-equivalent QA variant and
  demo-project emulators, preserving Release/PDF behavior with no live fallback.
- Keep the exact archived Release AAB's canary separate: existing reviewer to
  develop, bounded later authorization and environment proof before writes.
  QA is not the exact AAB; absent canary evidence leaves AC-06 pending.
- Use compatible official `android analyze --format=json` for actual ratios
  and EXACT_MATCH metadata; missing tools/metadata leave AC-05 pending.
- Apply the plan's paired 20-launch/five-sample protocol and explicit regression
  limits; retain mappings and prove local retrace without automatic uploads.

## Scope and boundaries

Android privacy/build/local validation and required documentation only. No
older-app/iOS/backend/production-data changes, dependency
upgrades beyond the approved Gradle 9.9.1 wrapper, Console operations,
uploads/publication or Restore Credentials.
Exact-artifact cloud testing and real FCM checks need later bounded authorization.
The old 68,674,188-byte DEX observation is historical dirty-tree evidence;
repeat measurements from the selected implementation commit.

## Current checklist

- [x] Select committed dependency base and retain non-advertising Analytics.
- [x] Record operator completion as owner-reported.
- [x] Define the approved isolation, artifact metrics and performance protocol.
- [x] Owner approved revision 2 and authorized local Android implementation.
- [x] Implement privacy/R8 and record the authorized local validation evidence.
- [x] Correct camera-preview loss and validate locally; owner authorized commit/push with HU-090 open.
- [x] Resolve approved warning debt: zero strict lint diagnostics in Debug/Release/QA, 505 JVM tests and 85 connected tests passed with three expected skips.
- [x] Record current cart/launcher/device coverage limits and complete exact task-owned cleanup.
- [x] Verify durable archive copying, manifest/hashes and exact task-owned cleanup; retain pre-commit build provenance separately from Git delivery.
- [x] Owner authorized lint/documentation commit/push on 2026-11-11, keeping HU-090 open; Git history and issue #282 own the delivery receipt.
- [ ] Obtain later exact-artifact canary authorization/evidence.
- [ ] Complete acceptance criteria and required documentation.

The spec owns the acceptance criteria; the plan owns the execution sequence
and evidence requirements. The issue remains open and in progress. No parent or milestone is added.
Local privacy/R8 implementation and performance/artifact/offline checks are
recorded in validation.md. The owner authorized commit/push of the HU branch
on 2026-11-10; Git history and issue #282 own the `66ecebc2` delivery receipt.
The subsequent camera correction preserves the draft through same-context
authorization refresh, with regression and optimized local QA evidence linked
above. The owner authorized commit/push of the correction and documentation
on the HU branch; Git history and issue #282 own the receipt. The approved
lint follow-up now clears that debt locally, with its own fresh artifact hashes.
The exact-artifact canary,
external telemetry/FCM and #228 gates remain open. The Git delivery does not
authorize merge, issue closure, publication or production operations.


## Historical local lint planning checkpoint - 2026-11-10

The initial request was review and proposal only. The linked historical inventory accounts for
136 warnings across 14 types and two hints, including four commit-result cases
that cannot safely use the proposed KTX quick fix. Wrapper scope, narrow
exceptions and behavior/branding constraints awaited review at that checkpoint.
Its advisory-only implementation limit was superseded by the approval below;
the original report is not a current lint result. Existing external acceptance
gates remain in force.


## Lint execution approval — 2026-11-10

The owner approved the local lint plan, Gradle 9.9.1 and four narrow KTX
exceptions preserving synchronous commit error reporting. Implementation and
local validation completed on 2026-11-10/11; see [current evidence and hashes](../app/hu-090-android-release-privacy-r8/lint-validation.md).
This supersedes the advisory-only limit above. [The local-validation progress comment](https://github.com/JFrancoG/ReguertaPlus/issues/282#issuecomment-6782155403)
records that pre-delivery checkpoint and keeps issue #282 open. The owner
subsequently authorized commit/push of the lint changes and documentation on
2026-11-11, with definitive delivery receipts owned by Git history and issue #282.
Cart recreation returns Home with its draft retained for reopening; this is
an observed limitation, not a corrected or proven pre-existing behavior.
Only emulator Pixel Launcher Circle-mask cases were checked, with no physical/
other OEM evidence or confirmed API 29 landscape result. Prior startup/PSS
receipts remain historical for their own hashes. Exact cleanup, durable
archival and manifest/hash verification pass. HU-090, its later
exact-artifact cloud/FCM canary and #228 remain open.
