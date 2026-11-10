# [HU-090] Preparar privacidad y optimización R8 de Android para publicación

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/282

## Summary

Prepare the unpublished ReguertaPlus Android app for a potential first
release by removing advertising access and validating R8 code/resource
optimization and obfuscation. The existing Play app is outside this story.

**Plan state: Draft. Implementation has not started or been authorized.**
Only HU setup and its documentation commit/push are authorized now.

## Canonical repository sources

- [Spec](../app/hu-090-android-release-privacy-r8/spec.md)
- [Plan](../app/hu-090-android-release-privacy-r8/plan.md)
- [Tasks](../app/hu-090-android-release-privacy-r8/tasks.md)
- Independent distribution gate: [secure-store issue #228](https://github.com/JFrancoG/ReguertaPlus/issues/228).

## Acceptance summary

- Remove AD_ID, ACCESS_ADSERVICES_AD_ID, and ACCESS_ADSERVICES_ATTRIBUTION
  from final artifacts; explicitly disable advertising collection/signals.
- Preserve non-advertising Analytics, Crashlytics, FCM, and product behavior.
- Enable modern Release R8 optimization/obfuscation with narrow rules and
  review the getCode reflection risk; preserve typed Domain contracts.
- Establish reproducible baseline and final metrics; verify every applicable
  Play DEX threshold and compare startup/memory without overclaiming compliance.
- Pass Android gates and functional journeys on the optimized Release binary,
  including SDK/minimum-version, Photo Picker, and 16 KB regression checks.
- Retain exact mappings/metadata and prove local retracing with upload controls.
- Prepare privacy-declaration evidence without changing Console or publishing.

The spec owns the complete acceptance criteria; the plan owns sequencing,
risks, validation, baseline provenance, and official policy references.

## Boundaries

Android only. No implementation during setup, older-app/iOS/backend/live-data
changes, dependency upgrades, operator declaration, Console submissions,
artifact/mapping uploads, store publication, or Restore Credentials work.

The 68,674,188-byte DEX observation came from a dirty local checkout on
2026-11-10. It is context, not a reproducible baseline of the committed base.

## Implementation checklist

- [ ] Approve plan and exact dependency baseline before implementation.
- [ ] Remove advertising permissions and disable advertising signals.
- [ ] Enable and validate R8 optimization/obfuscation and mappings.
- [ ] Complete optimized Release functional and performance evidence.
- [ ] Update privacy documentation and applicable decision mirrors.

## Tracking

- Priority: P1; platform: Android; area: App.
- State: open / Draft plan, not in progress.
- Parent/milestone: none; no existing scope-equivalent parent identified.
- Next step: review the canonical plan, then explicitly authorize implementation.
