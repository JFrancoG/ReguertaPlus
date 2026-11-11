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
- [x] Owner subsequently authorized commit/push of the camera correction and documentation with the same boundaries.
- [x] Owner authorized commit/push of the lint changes and documentation on 2026-11-11, keeping HU-090 open; Git history and issue #282 own the delivery receipt.

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

## 5. Original local implementation validation - historical receipts

- [x] Run Debug unit tests, lint and connected tests on dedicated API 29/16 KB emulators.
- [x] Record the original 136 warnings/two hints without waiving policy; the approved lint follow-up in section 8 clears the current debt with fresh evidence.
- [x] Build optimized Release AAB/APK and pass metadata/lint-vital checks.
- [x] Verify final permissions and supported advertising SDK controls.
- [x] Run android analyze JSON on exact AAB; require applicable ratios and EXACT_MATCH.
- [x] Run paired startup/PSS protocol on matching API 29 and 16 KB environments.
- [x] Validate optimized local Auth/session/producer/status journeys; exercise Activity recreation internally in isolated Debug.
- [x] Correct and locally validate the camera preview, authorized on 2026-11-10; see [follow-up evidence](camera-fix-validation.md) and plan section 8. Regression reproduced before the fix; slow camera/gallery, cancellation, save/readback/restart and deliberate removal pass in optimized local QA. Session/authorization fences remain covered. The owner authorized commit/push of this follow-up; Git history and issue #282 own the delivery receipt.
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

## 8. Lint remediation - local validation complete, 2026-11-10/11

- [x] Review the existing normal-Debug XML and 368 matching public source records; classify all 136 warnings and two hints.
- [x] Prepare the [approved correction plan](lint-remediation-plan.md) and [historical inventory](lint-inventory.json), including overlaps, risks, validations and approval decisions.
- [x] Owner approved Gradle 9.9.1, four exact KTX exceptions and the behavior/branding and warning-gate constraints.
- [x] A: update/verify Gradle 9.9.1 wrapper and capture the isolated lint baseline.
- [x] B: remove verified unused resources across variants/locales.
- [x] C: correct safe KTX/Compose/manifest findings and auth hints.
- [x] D: correct live EN/ES quantity and typography resources.
- [x] E: consolidate launcher assets while preserving identity.
- [x] F: document exactly four approved synchronous commit-result exceptions.
- [x] Reconcile newly exposed variant/tooling findings in [validation](lint-validation.md).
- [x] Validate changed behavior and fresh Debug/QA/Release artifacts, preserving non-advertising Analytics, R8 and session fences. Record exact hashes and scoped runtime limits in [lint validation](lint-validation.md).
- [x] Reach the local strict-lint gate: three variants with zero diagnostics, 505 JVM tests passed, and 85 connected tests passed with three expected skips and zero failures.
- [x] Record the current cart recreation observation: navigation returns Home, draft survives reopening; do not describe route retention as fixed or proven pre-existing.
- [x] Record coverage limits: Circle-mask emulator launchers only, no physical/OEM evidence, and no confirmed API 29 landscape result.
- [x] Clean only the task-owned demo profiles/images, services and AVDs with exact cleanup receipts.
- [x] Retain and verify the durable archive, manifest, six candidate-artifact hashes and 358 source records; preserve pre-commit artifact provenance during the separately authorized Git delivery, without closing HU-090.
- [x] Prepare lint branch delivery with the required changelog and documentation; reuse recent local gates only after verifying unchanged Android sources. Commit/push results belong to Git history and issue #282.

## 9. Final local QA and candidate performance — local PASS 2026-11-11

- [x] Record owner approval of the local-only cart/R8 diagnosis, outstanding QA and candidate startup/PSS batch.
- [x] Freeze same-source unoptimized/optimized QA APKs and record hashes/provenance; no changed app/build inputs.
- [x] Contrast actual Activity recreation in both binaries/OSes: existing MY_ORDER→DASHBOARD policy, exact cart draft retained; News retained as control. No R8 difference or navigation code change.
- [x] Complete actual API 29 landscape and available Circle/Square, Default/Minimal light/dark launcher QA; physical/OEM limits remain explicit.
- [x] Verify observer quiescence, stable HOME/PID fences and exact native target/COLD timing. The corrected harness passes 21 focused tests.
- [x] Run matched V3 pairs with 3/20/5/60 protocol. All 12 limits pass without exception; reject the entire V2 launcher-timing run instead of reusing any of its samples.
- [x] Reconcile current AC-08 evidence and remaining local QA against exact candidate hashes in [validation](final-local-validation.md) and [summary](final-local-evidence-summary.json), preserving remote/#228 gates.
- [x] Restore settings and stop/remove only task-owned demo runtime/AVDs; verify full fixture hash and empty orders/profile storage before shutdown.
- [x] Retain/verify 489 durable execution files and their SHA-256 manifest, candidate hashes and final repository snapshot; local execution preceded Git delivery, without publication or HU closure.
- [x] Record subsequent owner authorization for commit/push of this measurement harness and documentation on the existing HU branch, keeping HU-090 open.
- [x] Prepare focused branch delivery with changelog and documentation; reuse the 21-test receipt and V3 results after matching harness/source hashes. Git history and issue #282 own the definitive receipt; remote/#228 gates remain open.

## Planning history and current execution state

- Revision 1: planning bootstrap only, commit 5de7c804; original dirty measurements retained.
- Revision 2 on 2026-11-10: updated base/privacy and concrete validation recommendations;
  implementation was not yet authorized at that documentation checkpoint.
  The subsequent owner approval authorized the current local implementation.
  Operator completion is owner-reported only.
- [Remaining non-advertising data inventory and review limits](privacy-inventory.md).
- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/282 (open; local privacy/R8, camera and lint validation complete within the documented scope; external gates pending).
- Branch: `codex/hu-090-android-release-privacy-r8`, integrating published main without rebase.
- Commit/remote receipts belong to Git history. Current local validation and
  outstanding criteria must be linked before acceptance; historical
  documentation-only checks do not substitute for implementation evidence.
