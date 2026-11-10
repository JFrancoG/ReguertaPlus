# Tasks - HU-090

## 1. Bootstrap and decision

- [x] Confirm new ReguertaPlus Android scope; exclude the older Play app.
- [x] Check existing local stories and open/closed GitHub issues for duplicates.
- [x] Reserve HU-090 and prepare the spec, plan, and issue mirror.
- [x] Obtain authorization for an isolated worktree and documentation commit/push.
- [x] Record audit provenance and the pre-existing dependency-version difference.
- [x] Create and verify issue #282 and the isolated local documentation branch.
- [ ] Review the Draft plan and authorize implementation.

## 2. Android privacy implementation - not started

- [ ] Confirm the approved dependency baseline and current SDK configuration.
- [ ] Remove AD_ID and both advertising AdServices permissions at merge time.
- [ ] Explicitly disable advertising identifier collection and advertising signals.
- [ ] Preserve non-advertising Analytics, Crashlytics, FCM, and existing features.
- [ ] Add a focused final-manifest/artifact regression check for advertising access.
- [ ] Record the resulting privacy/data inventory without submitting Console forms.

## 3. Android optimization implementation - not started

- [ ] Inspect task graph and control automatic Crashlytics uploads before R8 builds.
- [ ] Produce a reproducible unoptimized baseline with dependency/configuration hashes.
- [ ] Enable code/resource optimization and obfuscation for Release with modern AGP DSL.
- [ ] Keep Debug unoptimized and use only evidenced, narrow keep rules.
- [ ] Review and replace or narrowly preserve the reflective getCode error contract.
- [ ] Verify permission-denied and generic failure behavior with a meaningful oracle.
- [ ] Inspect SDK consumer rules, serialization, and encrypted-store initialization.
- [ ] Run the applicable configuration analyzer and review its findings.

## 4. iOS and backend boundaries

- [x] Confirm no iOS, backend, live-data, or older-app implementation is in scope.
- [ ] Verify unchanged product contracts and no Android/iOS feature parity regression.

## 5. Implementation validation - not run by bootstrap

- [ ] Run Android Debug unit tests and lint.
- [ ] Run connected instrumentation on an available device/emulator; record destination.
- [ ] Build optimized Release AAB/APK and pass AAR metadata/lint-vital checks.
- [ ] Verify no advertising permissions in merged manifest and final AAB/APK.
- [ ] Validate supported SDK privacy settings and preserved non-advertising services.
- [ ] Measure actual final DEX optimization, obfuscation, and shrinking percentages.
- [ ] Compare artifact size, startup, and memory with the reproducible baseline.
- [ ] Validate auth/session/recreation and order/producer/error journeys on optimized Release.
- [ ] Validate photo/camera, PDF, notifications, denial paths, and serialization on Release.
- [ ] Validate encrypted-storage upgrade behavior and coordinate the separate #228 gate.
- [ ] Recheck API/minimum SDK, Photo Picker, 16 KB packaging/native alignment and runtime.
- [ ] Resolve or justify AndroidX symbol-stripping diagnostics with evidence.
- [ ] Archive exact mappings, R8 metadata, rules, artifact hashes, and tool versions.
- [ ] Prove local retrace; document later authorized Crashlytics mapping verification.

## 6. Documentation and closure - implementation remains pending

- [ ] Link implementation evidence by acceptance criterion without duplicating raw logs.
- [ ] Review need for a durable ADR/tech-stack change and update EN/ES if applicable.
- [ ] Prepare Advertising ID/Data Safety notes for later owner review.
- [ ] Verify all acceptance criteria and outstanding independent release gates.
- [ ] Request release/upload authorization only if distribution is later requested.

## Bootstrap evidence

- 2026-11-10: documentation-only planning authorized; implementation not authorized.
- Main checkout's four pre-existing modified files are excluded from this branch.
- Audit observations and their limitations are recorded in `plan.md` section 2.
- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/282 (open; Draft plan).
- Branch: `codex/hu-090-android-release-privacy-r8`.
- Documentation links, scope, and checklist independently reviewed; `git diff --check` passed.
- The authorized handoff is a documentation-only commit and branch push;
  their receipts belong to Git history and remote branch verification.
- Mobile validation is skipped for this non-behavioral documentation bootstrap.
