# Tasks - HU-090

## 1. Planning and owner decisions

- [x] Confirm unpublished ReguertaPlus Android scope; exclude the older Play app.
- [x] Check duplicates, create HU-090 / issue #282 and isolated planning branch.
- [x] Obtain authorization for documentation commit/push; implementation stays pending.
- [x] Record prior dirty-tree audit and independently delivered dependency evidence.
- [x] Select published main 7491ebae / Android dependency commit 0cff11eb as base.
- [x] Ratify retention of non-advertising Analytics and define permitted usage measurement.
- [x] Document local QA versus exact-artifact canary, local metrics and performance protocol.
- [x] Record operator completion reported by owner on 2026-11-10, without Console verification.
- [ ] Review revision 2 and explicitly authorize implementation.

## 2. Tooling and reproducible baseline - not executed by this revision

- [ ] Prepare an official CLI that provides android analyze; record version/help contract.
- [ ] Prepare required NDK strip tool and a confirmed 16 KB runtime.
- [ ] Inspect task graph and disable automatic mapping uploads for local validation.
- [ ] Create local QA demo-project emulator fixtures and fail-closed endpoint configuration.
- [ ] Establish the actual commit/dependency/configuration/variant/artifact hashes.
- [ ] Prepare the non-publishable QA scaffold/isolation before any runtime baseline, initially unoptimized.
- [ ] Capture the pre-change artifact; after privacy changes, capture the paired unoptimized QA baseline.

## 3. Android privacy implementation - not started

- [ ] Remove AD_ID and both advertising AdServices permissions at merge time.
- [ ] Disable advertising ID collection, personalization and advertising data/storage uses.
- [ ] Verify effective SDK advertising state before relevant events and no re-enable path.
- [ ] Preserve usage Analytics, Crashlytics, FCM and non-advertising measurement attribution.
- [ ] Add a final-manifest/artifact regression check for advertising permissions.
- [ ] Inventory remaining non-advertising identifiers/data for later Data Safety review.

## 4. Android optimization implementation - not started

- [ ] Enable Release code/resource optimization and obfuscation with AGP 9.5.1 DSL.
- [ ] Keep Debug unoptimized; use only evidenced narrow rules and SDK consumer rules.
- [ ] Review and replace or narrowly preserve reflective getCode error classification.
- [ ] Verify permission-denied and generic failures with an independent behavior oracle.
- [ ] Inspect serialization and encrypted-store initialization under optimization.
- [ ] Apply reviewed Release-equivalent optimization/PDF settings to the prepared releaseValidation scaffold.
- [ ] Run the applicable R8 configuration analyzer and review its findings.

## 5. Local implementation validation - not run by documentation work

- [ ] Run Debug unit tests, lint and connected tests on a fresh dedicated emulator.
- [ ] Report existing warning debt and any new finding without silently waiving policy.
- [ ] Build optimized Release AAB/APK and pass metadata/lint-vital checks.
- [ ] Verify final permissions and supported advertising SDK controls.
- [ ] Run android analyze JSON on exact AAB; require applicable ratios and EXACT_MATCH.
- [ ] Run paired startup/PSS protocol on matching API 29 and 16 KB environments.
- [ ] Validate local auth/session/recreation and order/producer/error journeys on optimized QA.
- [ ] Validate photos/camera, PDF, notification handling/denial, storage and serialization locally.
- [ ] Check exact AAB artifacts, offline smoke, local retrace and archive hashes/mappings/metadata.
- [ ] Recheck SDK values, Photo Picker, 16 KB packaging/native alignment and runtime.
- [ ] Re-run native stripping with the required SDK tool; resolve diagnostics with evidence.

## 6. Exact-artifact canary - later bounded authorization required

- [ ] Prepare candidate hash, project/develop fixture paths, roles, operations and telemetry plan.
- [ ] Obtain authorization for that cloud canary and any real FCM delivery check.
- [ ] Verify existing reviewer routing/linked account and effective develop before business writes.
- [ ] Run APKs from the exact archived Release AAB without backend/allowlist changes.
- [ ] Record real push evidence separately from local notification handling if required.
- [ ] Keep AC-06 pending while this canary is absent; coordinate separate secure-store gate #228.

## 7. Documentation and closure - implementation remains pending

- [ ] Link evidence by criterion; preserve exact mapping and test-environment distinctions.
- [ ] Review need for ADR/stack changes and maintain EN/ES mirrors if applicable.
- [ ] Prepare Advertising ID/Data Safety notes; submit no Console forms without later scope.
- [ ] Confirm no iOS/backend/production-data or feature-parity changes.
- [ ] Verify all criteria and independent release gates before claiming completion.
- [ ] Treat distribution/mapping upload as a separate later action when requested.

## Planning evidence

- Revision 1: planning bootstrap only, commit 5de7c804; original dirty measurements retained.
- Revision 2 on 2026-11-10: updated base/privacy and concrete validation recommendations;
  implementation is still unauthorized. Operator completion is owner-reported only.
- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/282 (open; Draft revision 2).
- Branch: `codex/hu-090-android-release-privacy-r8`, integrating published main without rebase.
- Commit/remote receipts belong to Git history; documentation-only validation is recorded at handoff.
