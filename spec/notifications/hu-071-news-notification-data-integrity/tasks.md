# Tasks - HU-071 (News and notification data integrity)

## 1. Preparation

- [x] Confirm no duplicate issue and reserve HU-071.
- [x] Create GitHub issue #230 and branch
  `codex/hu-071-news-notification-data-integrity`.
- [x] Confirm the canonical News/Notification Firestore contract.
- [x] Confirm live repository composition and exclude chained fallbacks.
- [x] Record ADR-0010 in English and Spanish for the non-critical community
  refresh boundary.
- [x] Record current non-canonical Functions writers as a deferred backend
  compatibility gate in issue #231.
- [x] Complete the isolated pre-implementation iOS standards review.

## 2. Android implementation

- [x] Add throwing News DTO decoder/mapper and typed repository errors.
- [x] Add throwing Notification DTO decoder/mapper and exact audience schema.
- [x] Replace live `mapNotNull` pipelines with atomic throwing maps.
- [x] Fence feed refresh state, feedback, and loading by operation and session.
- [x] Treat cancellation separately from failure, with no feedback and
  ownership-aware loader cleanup.
- [x] Clear prior community snapshots on every identity, access, epoch, or
  environment boundary.
- [x] Decouple community-feed reads from authorization-critical hydration.
- [x] Separate confirmed news/notification mutations from fenced read-back
  convergence.
- [x] Fence News/Notification editor mutations and deletion requests by
  context, token, and editor/request generation.

## 3. iOS implementation

- [x] Add throwing News DTO decoder/mapper and typed repository errors.
- [x] Add throwing Notification DTO decoder/mapper and exact audience schema.
- [x] Replace live `compactMap` pipelines with atomic throwing maps.
- [x] Fence feed refresh state, feedback, and loading by operation, session,
  and runtime environment.
- [x] Treat cancellation separately from failure, with no feedback and
  ownership-aware loader cleanup.
- [x] Clear prior community snapshots on every identity, access, epoch, or
  environment boundary.
- [x] Separate confirmed news/notification mutations from fenced read-back
  convergence.
- [x] Fence News/Notification editor mutations and deletion requests by
  context, token, and editor/request generation.

## 4. Backend / Firestore

- [x] Keep Firebase in standby; no backend or live-data change is required for
  this client cut.
- [ ] Normalize non-canonical Functions writers and existing documents only in
  a later separately approved Firebase gate.
- [ ] Validate, through a later PII-free Firebase inventory/Rules gate, News
  documents that the required member query excludes when `active` is absent or
  mistyped; tracked in issue #232.

## 5. Testing

- [x] Record RED mapper failures on Android.
- [x] Record RED mapper failures on iOS.
- [x] Record RED presentation/fencing failures on Android.
- [x] Record RED presentation/fencing failures on iOS.
- [x] Record RED cross-context clearing/privacy failures on both platforms.
- [ ] Record RED current/obsolete cancellation behavior on both platforms.
- [x] Record RED Android authorization/non-critical-feed failure.
- [x] Record RED confirmed-write/failing-refresh behavior on both platforms.
- [x] Record RED clear/reopen mutation ownership and duplicate-delete behavior
  on both platforms.
- [x] Turn focused Android and iOS tests GREEN.
- [x] Run Android `app:testDebugUnitTest`.
- [x] Run Android `app:lintDebug`.
- [x] Run focused/affected iOS tests on the target simulator.
- [x] Run iOS build through Xcode MCP.
- [x] Re-run the final expanded iOS test set through Xcode MCP on iPhone 17.
  The combined run exposed one transient UI keyboard-focus flake; its isolated
  official rerun passed 1/1, and only the historical launch-test skip remains.

The current/obsolete cancellation contract tests were added and are GREEN, but
they did not fail during the RED cut because the pre-existing cancellation
guards already satisfied those isolated cases. This ledger therefore does not
claim RED evidence that was not observed.

## 6. Documentation

- [x] Add issue mirror, spec, plan, and task ledger.
- [x] Reconcile acceptance criteria and validation evidence.

Validation evidence:

- Android RED decoder/composition snapshot:
  `/tmp/reguerta-android-red.q2TCTp/Reguerta` (13 expected compile diagnostics).
- Android RED routing snapshot:
  `/tmp/reguerta-hu071-routing-red2.V3n8h7/android/Reguerta` (53 tests, 1
  expected routing/privacy failure).
- Android mutation-ownership RED snapshot:
  `/tmp/reguerta-hu071-mutation-red.HXaGHp/android/Reguerta` (34 tests, the 3
  expected save, send, and duplicate-delete failures).
- Android raw-role boundary RED snapshot:
  `/tmp/reguerta-hu071-role-red.Ha65nq/android/Reguerta` (1/1 expected privacy
  invalidation failure before raw roles joined the context identity).
- Android parity-ownership RED snapshot:
  `/tmp/reguerta-hu071-ownership-red2.S0EsQd` (45 tests, the 5 expected
  save/upload, stale-convergence, and same-ID delete-request failures).
- Android restoration RED: `HomeNavigationTest` ran 9 tests with the new
  transient-confirmation contract as the sole expected failure while the six
  pending fields still used `rememberSaveable`.
- Android final GREEN on the real working tree: focused Home/community suites
  passed 56/56, full unit tests passed 434/434, lint completed with 0 errors
  and no new findings, and connected tests passed 18/18 on API 37 / Android 17.
  The concurrent `app/build.gradle.kts` edit had already been resolved outside
  this cut; the file matches `HEAD` and HU-071 did not modify it.
- iOS RED: initial mapper/presentation cut 15 expected failures out of 18;
  confirmed-write race 1/1 expected failure; final hydration test 1/1 expected
  failure; routing contract absent at compile time before the synchronous
  transition signal was introduced.
- iOS mutation/editor RED bundles:
  `/tmp/reguerta-hu071-red.gzJO6A/RED.xcresult`,
  `/tmp/reguerta-hu071-upload-red.DcDJjP/RED.xcresult`, and
  `/tmp/reguerta-hu071-confirmation-red.V6nc5G/RED.xcresult`.
- iOS final focused GREEN: ownership/races 12/12, confirmations 9/9, and the
  8/8 draft/context boundary cases. The last boundary cases passed on their
  first run because the general production fences were already correct.
- iOS final full-unit fallback: 607/607 passed with 0 failures or skips in
  `/tmp/reguerta-hu071-final-unit.3ahvGk/FINAL.xcresult` on iPhone 17 / iOS
  26.5.
- Final official Xcode MCP validation after selecting iPhone 17:
  - mutation-boundary focal: 2/2 passed in
    `RunSomeTests/C6683C39-5BDC-437A-8F9E-BA3965461AF1.txt`;
  - expanded run: 616 total, 614 passed, 1 transient UI keyboard-focus failure,
    and the 1 historical launch-test skip in
    `RunAllTests/8141AC4B-33AA-4C0A-A508-5AF87345774B.txt`; all
    `ReguertaTests` and HU-071 cases passed;
  - isolated rerun of `testDrawerNavigationOpensSelectedRoute()`: 1/1 passed in
    `RunSomeTests/795F66FF-1D90-4F0E-936D-4E460DE41FB4.txt`, leaving no
    reproducible failure.
- Final Xcode MCP build passed with 0 errors; SwiftLint retains 17 baseline
  warnings and none belongs to HU-071.
- `git diff --check` passes. No Functions, Firebase configuration, Rules, or
  live-data file changed.

## 7. Closure

- [x] Complete isolated Android final review with no blocking findings.
- [x] Complete isolated iOS standards review with no blocking findings.
- [x] Confirm Android/iOS parity and inspect the final diff for unrelated work.
- [x] Prepare a focused commit/PR when delivery is authorized.
- [ ] Close issue only after every acceptance criterion and delivery gate is
  complete.
