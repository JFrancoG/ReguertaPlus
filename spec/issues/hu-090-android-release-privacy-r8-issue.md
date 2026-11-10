# [HU-090] Preparar privacidad y optimización R8 de Android para publicación

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/282

## Current outcome and plan state

Prepare unpublished ReguertaPlus Android with no advertising access and a
validated R8-optimized Release. **Local privacy/R8 implementation recorded; acceptance remains pending.**
The owner approved execution on 2026-11-10; publication and production remain prohibited.

## Decisions resolved on 2026-11-10

- Use published main `7491ebae`, including Android dependency update `0cff11eb`:
  AGP 9.5.1, Kotlin 2.4.21, Firebase BOM 35.1.0 and the committed version catalog.
- Retain non-advertising Analytics, including ordinary usage reporting and
  non-advertising measurement attribution; prohibit advertising IDs/AdServices
  access and advertising uses/signals. Preserve Crashlytics/FCM.
- Operator status is complete according to the owner; not independently
  verified by this HU and not a publication/declaration approval.

## Canonical sources

- [Spec](../app/hu-090-android-release-privacy-r8/spec.md)
- [Plan](../app/hu-090-android-release-privacy-r8/plan.md)
- [Tasks](../app/hu-090-android-release-privacy-r8/tasks.md)
- [Local validation and artifact receipts](../app/hu-090-android-release-privacy-r8/validation.md)
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
upgrades, Console operations, uploads/publication or Restore Credentials.
Exact-artifact cloud testing and real FCM checks need later bounded authorization.
The old 68,674,188-byte DEX observation is historical dirty-tree evidence;
repeat measurements from the selected implementation commit.

## Current checklist

- [x] Select committed dependency base and retain non-advertising Analytics.
- [x] Record operator completion as owner-reported.
- [x] Define the approved isolation, artifact metrics and performance protocol.
- [x] Owner approved revision 2 and authorized local Android implementation.
- [x] Implement privacy/R8 and record the authorized local validation evidence.
- [ ] Resolve camera-preview/local-acceptance and existing warning-debt gates.
- [ ] Obtain later exact-artifact canary authorization/evidence.
- [ ] Complete acceptance criteria and required documentation.

The spec owns the acceptance criteria; the plan owns the execution sequence
and evidence requirements. The issue remains open and in progress. No parent or milestone is added.
Local privacy/R8 implementation and performance/artifact/offline checks are
recorded in validation.md. The owner authorized commit/push of the HU branch
on 2026-11-10; Git history and issue #282 own the delivery receipt. Review the
camera preview failure reproduced in both QA variants
and existing lint debt before local acceptance. The exact-artifact canary,
external telemetry/FCM and #228 gates remain open. The Git delivery does not
authorize merge, issue closure, publication or production operations.
