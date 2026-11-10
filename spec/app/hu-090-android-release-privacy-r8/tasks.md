# Tasks - HU-090

## 1. Planning and owner decisions

- [x] Confirm unpublished ReguertaPlus Android scope; exclude the older Play app.
- [x] Check duplicates, create HU-090 / issue #282 and isolated planning branch.
- [x] Obtain the initial documentation commit/push authorization; implementation was pending at that checkpoint.
- [x] Record prior dirty-tree audit and independently delivered dependency evidence.
- [x] Select published main 7491ebae / Android dependency commit 0cff11eb as base.
- [x] Ratify retention of non-advertising Analytics and define permitted usage measurement.
- [x] Document local QA versus exact-artifact canary, local metrics and performance protocol.
- [x] Record operator completion reported by owner on 2026-11-10, without Console verification.
- [x] Owner approved revision 2 and authorized Android implementation/local validation on 2026-11-10.
- [x] Owner authorized commit/push of the HU branch while keeping the story open and publication/production outside scope.

## 2. Tooling and reproducible baseline

- [x] Prepare an official CLI that provides android analyze; record version/help contract.
- [x] Prepare required NDK strip tool and a confirmed 16 KB runtime.
- [x] Inspect task graph and disable automatic mapping uploads for local validation.
- [x] Create local QA demo-project emulator fixtures and fail-closed endpoint configuration.
- [x] Record the measurement base commit, working-tree source snapshot, dependency/configuration, variant and artifact hashes; preserve this pre-commit build provenance separately from Git delivery.
- [x] Prepare the non-publishable QA scaffold/isolation before any runtime baseline, initially unoptimized.
- [x] Capture the pristine pre-change main artifact and the separate post-privacy unoptimized QA baseline.

## 3. Android privacy implementation

- [x] Remove AD_ID and both advertising AdServices permissions at merge time.
- [x] Disable advertising ID collection, personalization and advertising data/storage uses.
- [x] Verify fresh-install SDK advertising defaults before local events and no first-party re-enable path.
- [x] Preserve usage Analytics, Crashlytics, FCM and non-advertising measurement attribution in Release configuration; external delivery stays separate.
- [x] Add a final-manifest/artifact regression check for advertising permissions.
- [x] Inventory remaining non-advertising identifiers/data for later Data Safety review.

## 4. Android optimization implementation

- [x] Enable Release code/resource optimization and obfuscation with AGP 9.5.1 DSL.
- [x] Keep Debug unoptimized; use SDK consumer rules with no app-authored keep rules.
- [x] Replace reflective getCode error classification with typed Data translation.
- [x] Verify real denied, allowed and NOT_FOUND outcomes through the unchanged optimized UI and independent emulator state.
- [x] Inspect optimized session/cache/store initialization; exercise serializers and legacy encrypted migration internally in Debug, keeping #228 separate.
- [x] Apply reviewed Release-equivalent optimization/PDF settings to releaseValidation.
- [x] Run the quantitative R8 configuration analyzer and review its findings.

## 5. Local implementation validation - in progress

- [x] Run Debug unit tests, lint and connected tests on dedicated API 29/16 KB emulators.
- [x] Report existing warning debt and new findings without waiving policy: normal Debug retains 136 warnings/two hints, unchanged from main.
- [x] Build optimized Release AAB/APK and pass metadata/lint-vital checks.
- [x] Verify final permissions and supported advertising SDK controls.
- [x] Run android analyze JSON on exact AAB; require applicable ratios and EXACT_MATCH.
- [x] Run paired startup/PSS protocol on matching API 29 and 16 KB environments.
- [x] Validate optimized local Auth/session/producer/status journeys; exercise Activity recreation internally in isolated Debug.
- [ ] Complete the camera journey: uploads succeed but the preview disappears in both QA variants. PDF, Gallery, permissions, notifications, Storage and internal serialization checks pass.
- [x] Check exact AAB artifacts, offline smoke, local retrace and retain hashes/mappings/metadata.
- [x] Recheck SDK values, Photo Picker, 16 KB packaging/native alignment and runtime.
- [x] Re-run native stripping with the required SDK tool; previous diagnostic is absent.

## 6. Exact-artifact canary - later bounded authorization required

- [ ] Prepare candidate hash, project/develop fixture paths, roles, operations and telemetry plan.
- [ ] Obtain authorization for that cloud canary and any real FCM delivery check.
- [ ] Verify existing reviewer routing/linked account and effective develop before business writes.
- [ ] Run APKs from the exact archived Release AAB without backend/allowlist changes.
- [ ] Record real push evidence separately from local notification handling if required.
- [x] Keep AC-06 pending while this canary is absent; retain separate secure-store gate #228.

## 7. Documentation and closure - acceptance review pending

- [x] Link [local validation](validation.md) by criterion; preserve exact mapping and test-environment distinctions.
- [x] Maintain ADR-0015 ([EN](../../../docs/decisions/0015-android-release-privacy-and-local-validation.md), [ES](../../../docs-es/decisions/0015-privacidad-release-android-y-validacion-local.md)) and stack mirrors.
- [x] Prepare Advertising ID/Data Safety notes; submit no Console forms.
- [x] Confirm no iOS/backend/production-data or feature-parity changes.
- [ ] Verify all criteria and independent release gates before claiming completion.
- [x] Treat distribution/mapping upload as a separate later action when requested.

## Planning history and current execution state

- Revision 1: planning bootstrap only, commit 5de7c804; original dirty measurements retained.
- Revision 2 on 2026-11-10: updated base/privacy and concrete validation recommendations;
  implementation was not yet authorized at that documentation checkpoint.
  The subsequent owner approval authorized the current local implementation.
  Operator completion is owner-reported only.
- [Remaining non-advertising data inventory and review limits](privacy-inventory.md).
- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/282 (open; approved revision 2, local implementation in progress).
- Branch: `codex/hu-090-android-release-privacy-r8`, integrating published main without rebase.
- Commit/remote receipts belong to Git history. Current local validation and
  outstanding criteria must be linked before acceptance; historical
  documentation-only checks do not substitute for implementation evidence.
