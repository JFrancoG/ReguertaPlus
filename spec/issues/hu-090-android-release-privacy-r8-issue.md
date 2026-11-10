# [HU-090] Preparar privacidad y optimización R8 de Android para publicación

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/282

## Current outcome and plan state

Prepare unpublished ReguertaPlus Android with no advertising access and a
validated R8-optimized Release. **Draft revision 2; implementation not started
or authorized.** The owner requested documentation commit/push only.

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
- Independent distribution gate: [secure-store issue #228](https://github.com/JFrancoG/ReguertaPlus/issues/228).

## Execution recommendations incorporated for review

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

Android privacy/build/validation and required documentation only. No current
implementation, older-app/iOS/backend/production-data changes, dependency
upgrades, Console operations, uploads/publication or Restore Credentials.
Exact-artifact cloud testing and real FCM checks need later bounded authorization.
The old 68,674,188-byte DEX observation is historical dirty-tree evidence;
repeat measurements from the selected implementation commit.

## Current checklist

- [x] Select committed dependency base and retain non-advertising Analytics.
- [x] Record operator completion as owner-reported.
- [x] Define proposed isolation, artifact metrics and performance protocol.
- [ ] Review revision 2 and authorize implementation.
- [ ] Implement privacy/R8 changes and obtain local evidence.
- [ ] Obtain later exact-artifact canary authorization/evidence.
- [ ] Complete acceptance criteria and required documentation.

The spec owns the acceptance criteria; the plan owns the execution sequence
and evidence requirements. The issue remains open and unstarted. No parent or
milestone is added. Next step: review this revision, then authorize implementation.
