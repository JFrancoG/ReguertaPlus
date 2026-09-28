# HU-084 final provisional review — 2026-09-13

## Scope and conclusion

Reviewed the complete HU-084 change inventory against merge base
`327e563db8315ad59657c83417d522700c8c01c3` and pushed head
`6c199c005968008d4264a59a0cf5bb27b3d73db0`, plus the working-tree corrections
recorded here. The branch contains 117 changed files before this review. Inspection
covered the coverage lifecycle, selection/draw, membership/credit planners, shared
HU-082 forward/inverse/source changes, Sheets/effects/recovery, HTTP/Auth, Rules,
Android and iOS composition/state/forms/notification routing, tests and documentation.
An independent iOS review inventoried all 26 changed Swift files, fixtures and copy.
This is source review and bounded local validation, not a proof of every execution.

No unresolved functional defect was confirmed in the authorized provisional scope.
The review found formatting violations in new Swift and outdated current-status
paragraphs in spec/plan; both are corrected. Twelve Swift files have layout-only
corrections, with one test predicate inlined to retain the existing SwiftLint body
limit. No test assertion, input, timeout or business rule was changed. The second
independent Swift audit passed, including the final predicate adjustment.

No structural rewrite is recommended. The existing rotation cursor, whole-unit
solver, publication/inverse transaction, writer authority, trusted barrier and Sheets
adapter are reused. Operation identity and uncertain-result retention address real
retry/crash risks. Access/session, operation state, form draft and read projection
have distinct responsibilities; merging them would not remove that complexity.
The private single-unit rehearsal is test infrastructure, not a second live
publication mechanism. Keep it outside live composition. Do not introduce another
generic workflow engine, automatic unknown-push retry or parallel writer lock.

## Acceptance matrix

Numbers refer to the 25 criteria under `spec.md` / Acceptance criteria after approval,
in their current order. `Local` means the provisional policy is implemented and
has local evidence; it does not check off the assembly-approved criterion.
Paths below are relative to the repository root.

| Criteria | Current evidence | Remaining boundary |
| --- | --- | --- |
| 1, 10 — stable dates, immutable owner/effective replacement | `functions/test/shift-coverage.emulator.test.cjs`: delivery/market acceptance and departure preservation | Local; no shared data exercise |
| 2 — reserve and first unfrozen round | `shift-membership-planning.test.cjs`, membership scenarios in `shift-coverage.emulator.test.cjs`: FIFO, re-entry, per-type admission and August continuity | Reserve exit and simultaneous-entry policy still require ratification |
| 3, 4 — public departures versus frozen/unfrozen positions | Same membership suites plus `shift-credit-publication.test.cjs`: individual public cases and frozen ownership | Local tombstone proposal; pending swaps remain explicit resolution cases |
| 5, 6 — atomic omissions and complete physical units | `shift-credit-unit.test.cjs`, `shift-credit-publication.test.cjs`: minimum cohorts, zero partial writes, publication/inverse and source drift | Ratify tombstones or fully specify the alternative |
| 7, 8 — eligibility and company/role races | `shift-coverage.emulator.test.cjs`, `shift-membership-planning.test.cjs`, `shift-credit-publication.test.cjs`: purchase manager/producer, reactivation and demotion | Ratify reason-specific eligibility treatment |
| 9 — reserve/volunteer/draw/admin hierarchy | `shift-coverage.emulator.test.cjs`: FIFO exhaustion, volunteers, draw and explicit admin recovery | Synthetic ordering/windows; final policy remains open |
| 11, 12 — adjacent leads and completed helper history | Coverage, credit-season and membership suites: predecessor/successor revisions, completed history and prospective helper updates | Local regression evidence, no rewriting completed helpers |
| 13 — committed reproducible draw | `shift-coverage-draw.test.cjs`, draw emulator cases: signed future round, tamper rejection, concurrency, no new seed through cancellation | Synthetic issuer only; real provider/unpredictability not certified |
| 14 — explicit response | Coverage emulator and both native client suites: accept/decline/expiry, stale response rejection | Local; final windows and fallback need ratification |
| 15, 16 — earned credit and no stacking | Coverage emulator: only authoritative completion earns credit; simultaneous same-type acceptance rejects; failure releases claim | Ratify cap, expiry, prolonged leave and proximity policy |
| 17 — ledger binding and atomic consumption | `shift-credit-publication.test.cjs`: full source capture, stage drift, competing activation, exact inverse and monotonic revisions | Fixed demo only |
| 18, 19, 20 — deferred credit and whole-unit backtracking | `shift-credit-unit.test.cjs`, `shift-credit-season.test.cjs`: all subsets of small cohorts, N=2, queue wrap, ten complete markets and credited carryover | Ratify reverse-order fallback; no unstated replacement-credit accounting |
| 21 — market staffing and delivery handover | Unit/seasonal planners plus coverage and publication emulator suites | Local |
| 22 — independent HU-016 swaps | Existing swap/shift-planning unit regressions included in final Functions run; shared helper/lineage changes reviewed | Does not certify live swap deployment |
| 23 — equivalent native member/admin states | Shared wire fixtures, Android client/operation tests, Swift client/rehearsal tests; local role/cancel and earlier accept/credit journeys | Physical accessibility and real push delivery remain below; API 29 and local Android/iOS OS openings passed on 2026-09-28 |
| 24 — backend-only authority | Strict/phase1 Rules matrix, nested recovery authorization/results/push records and Auth emulator revocation/link tests | No Rules deployment |
| 25 — all ratified branches before activation | Provisional workflow/Auth/projection/inbox/push/recovery suites and native gates | Cannot certify a policy the assembly has not yet ratified |

Test names and historical journey evidence are retained in `plan.md` and the bilingual
native rehearsal guides. Receipts establish audit history; they do not implement the
still-open structured operational logs/metrics for stuck cases, exhaustion, retries
and credit failures.

## Validation of this review

Functions lint/build pass. The combined coverage/planning/Sheets/HU-016 regression
run has 420 passing tests and 51 explicit emulator-only skips. The fixed HU-084
Firestore/Rules suite has 122 passing tests, zero skips; the separate Auth/HTTP
emulator suite has 22 passing tests, zero skips. Android has 502 passing unit tests
and 25 passing connected tests on Pixel 8 Pro/API 35, including the two opt-in
HU-084 role/cancellation journeys. The unrelated HU-083 fixture journey is explicitly
excluded. Android lint passes with 135 existing warnings and two hints; none lies on
a line changed by HU-084. This is not a zero-warning Android baseline.

Localization inventory: all 71 iOS coverage keys have English/Spanish entries;
Android has matching sets of 66 coverage keys in both languages. Static catalog
completeness does not prove spoken labels or screen-reader navigation.

The canonical iOS release gate passes on iPhone 17/iOS 26.5: 919 passed, five
expected skips, zero failures. SwiftLint reports zero violations in 509 files; all
three first-party targets retain nonisolated defaults, Swift 6, strict complete
concurrency and approachable concurrency in Debug/Release. Closed xcresult build
summary reports zero errors, warnings and analyzer warnings. The five skips are the
three opt-in HU-084 journeys, one opt-in HU-083 journey and conditional launch test;
they remain explicitly outside this gate, not silently certified.

Xcode MCP additionally builds the active Release/iphoneos26.5 configuration. Its
structured warning query is empty, but the full raw log contains one tool warning:
`Metadata extraction skipped. No AppIntents.framework dependency found.` This is
retained as a toolchain diagnostic; do not claim the complete MCP log is warning-free
or add an unused framework solely to silence it. The CLI test run also emitted LLDB
version-metadata diagnostics while completing successfully; the closed result is the
authority for execution and failure counts. No physical-device runtime is implied.

Evidence:

- `/tmp/hu084-final-functions-test-files.txt` (60 regression files) and
  `/tmp/hu084-final-functions-units.log`.
- `/tmp/hu084-final-functions-emulator.log`, `/tmp/hu084-final-functions-app.log`.
- `/tmp/hu084-final-android-unit-lint.log`, `/tmp/hu084-final-android-connected.log`.
- `/tmp/hu084-final-ios-release.log`, `/tmp/hu084-final-review-release.xcresult`,
  `/tmp/hu084-final-ios-summary.json`, `/tmp/hu084-final-ios-build-summary.json`.
- Xcode MCP full build log: `BuildProject-Log-20260913-142154.txt` in its returned
  ActionArtifacts directory.

Temporary Firebase
build configurations use the fixed demo project; the missing ignored worktree configs
are not copied from production. Temporary configs, dependency symlink and owned
Firebase emulators have been removed/stopped after validation. No live Firebase/Sheets/APNs/FCM is used.

## Pending manual matrix and feasibility

| Check | Available means / exact limit | Disposition |
| --- | --- | --- |
| Android API 29 | New AVD `Pixel_4_A10_API_29`, `emulator-5554`; runtime properties confirm Android 10 / SDK 29 | Passed on 2026-09-28: 25 connected tests, zero failures/errors/skips, including both opt-in HU-084 role/cancellation journeys at font scale 2 |
| Physical VoiceOver | Requires an accessible physical iPhone and human assistive-technology interaction | Device availability and focused journey remain to be agreed |
| Physical TalkBack | An Android phone is connected; this gate selected only `emulator-5554` | Confirm test installation/account scope before operating the phone |
| Android notification tray | Cold/warm activity Intents already passed; shell tray injection previously failed on PendingIntent UID permission | App-owned Debug injection prepared on 2026-09-28; all three guided local tray variants confirmed by maintainer on API 29: login, signed-in re-entry and cold-process login; real FCM remains separate |
| iOS cold-process notification open | Warm simulated Notification Center taps passed previously; OS cold start drops rehearsal launch flags | Passed on 2026-09-28: maintainer confirms tray-to-login-to-market on iPhone 17/iOS 27.0 after process termination; temporary preference removed afterward |
| Real APNs/FCM | Local dispatcher uses simulated transport; `simctl push` bypasses APNs | Requires isolated app/project destinations and separate live transport setup |

Do not count font scaling as VoiceOver/TalkBack evidence. All local/manual residuals
must remain visible in a provisional PR. None authorizes production access. Assembly
ratification, the real provider, live coverage wiring/observability and activation
handoff remain separate from this review. HU-085/#269 currently owns the base planner
and workbook rollout; it does not implicitly absorb every unfinished HU-084 task.

## API 29 follow-up — 2026-09-28

The user created `Pixel_4_A10_API_29` and reported a successful Debug launch.
Live `adb` checks independently confirm `ro.build.version.release=10` and
`ro.build.version.sdk=29`. At that run, the branch was at `6c199c0` with the review's
uncommitted corrections. No Android source change was required.

The connected suite passes 25/25 tests with zero failures, errors or skips on
`emulator-5554`, including both `CoverageRehearsalAcceptanceTest` journeys against
the fixed demo Auth/Firestore/HTTP fixture. The independent HU-083 fixture journey
is explicitly excluded, as in the API 35 run. This closes the API 29 local acceptance
row, not physical TalkBack, tray interaction or real push delivery. Functions build
also passes; unrelated unit/lint/iOS suites were not repeated for this device-only
validation and documentation update.

Reproduction: run the native fixture documented in the rehearsal guide, then from
`android/Reguerta`:

```sh
ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.hu084Acceptance=true \
  -Pandroid.testInstrumentationRunnerArguments.notClass=com.reguerta.user.presentation.shifts.ShiftSheetsEmulatorAcceptanceTest
```

Evidence: `/tmp/hu084-api29-connected-20260928.log`,
`/tmp/hu084-api29-results-20260928.xml` and
`/tmp/hu084-api29-fixture-20260928.log`. Temporary synthetic Google Services config,
dependency symlink and owned Firebase services are cleaned up after the run.
No production resources or physical phone were used. No commit/push is included.

## Delivery checkpoint — 2026-09-28

The maintainer subsequently authorized committing and pushing these review
corrections and evidence. Dependency update `a50ec52` precedes this checkpoint;
its repeat Android validation passes 502 unit tests and 25 connected API 29 tests,
with 135 existing lint warnings and two hints. Evidence:
`/tmp/hu084-dependency-update-20260928.log`,
`/tmp/hu084-dependency-connected-20260928.log` and
`/tmp/hu084-dependency-connected-20260928.xml`.
The Swift changes are the same corrections validated by the recorded release gate.
Only documentation was adjusted afterward; `git diff --check` passes. Full suites
are not repeated just to commit these non-behavioral changes. The remaining manual,
policy and activation boundaries above are unchanged.


## Guided Android result and iOS cold preparation — 2026-09-28

The maintainer confirmed all three app-owned Android tray journeys on API 29:
login from a tray tap, same-case re-entry while authenticated, and direct case
opening after process termination and a fresh login. The cold launch used a newly
observed process. This closes local Android tray acceptance, not real FCM/TalkBack.

For iOS, the only Swift change adds a Debug simulator-only explicit preference,
`coverageColdLaunchRehearsal`, to preserve the isolated local composition without
launch arguments. It is not written automatically and has no physical Debug or
Release effect. A read-only one-file style audit and candidate scan pass; SwiftLint
has zero violations across 509 files. Xcode 27.0 Service builds Release successfully
(the existing raw AppIntents extraction warning remains), then builds Debug and
passes 25 focused configuration/session/push cases plus all four canonical UI smoke
cases on iPhone 17/iOS 27.0, with no failures or skips. These are targeted validation,
not a new full release gate. Test result bundles:

- `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RunSomeTests/Test-Reguerta-2026.09.28_16-07-25-+0200.xcresult`
- `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RunSomeTests/Test-Reguerta-2026.09.28_16-09-09-+0200.xcresult`

The simulator is `C0534329-7329-4763-A3E9-FD3F45F6E368`. Launch without arguments
visibly opens the local rehearsal login; notification permission is granted. The
process was terminated and a current demo market notice injected with `simctl push`;
the actual system banner is visible. User observation of the cold tap/login is pending.
The explicit preference must be removed after the guided test. Temporary Firebase
build plists and generated-only catalog changes were removed/restored; the original
Xcode destination was restored. The local demo server and dependency symlink remain
active for the guided interaction. No commit/push or production action is included.


## Guided iOS cold-opening result — 2026-09-28

The maintainer confirms the expected login and direct market offer after tapping
the pending notice with the original process terminated. Local Android tray and
iOS cold-opening rows are complete. The simulator-only preference was removed and
the iOS app terminated after the test. Physical VoiceOver, physical TalkBack and
real isolated APNs/FCM delivery remain open, alongside the independent policy/live
activation boundaries. No additional code change or repeat suite was needed to
record the guided observation. This checkpoint remains uncommitted.


## Notification checkpoint delivery — 2026-09-28

Commit/push of this completed block is now authorized. The owned demo services are
stopped and the temporary dependency symlink removed. Android and iOS preparation
remain Debug-only, with the documented automated and maintainer-observed results.
No behavioral edits followed those validations; delivery checks include the final
diff and whitespace checks. Physical VoiceOver/TalkBack and real isolated transport
remain separate pending rows. iPhone 11 is proposed next; the current iOS loopback
transport needs a suitable physical rehearsal setup before its local login can work.


## Physical accessibility preparation — 2026-09-28

A Debug-only `-coverageAccessibilityRehearsal` route reuses the existing preview
repository and real UI on iPhone 11 without relaxing the loopback transport.
It displays an EN/ES offline notice, binds a sample session, and refuses writes.
Live Firebase and push registration remain disabled through `.uiTesting`.
This enables bounded physical VoiceOver/form-cancellation observations; it does
not close VoiceOver, TalkBack, authenticated backend or real APNs/FCM acceptance.

Preparation validation: Xcode 27.0 Debug build-for-testing succeeded for physical
iPhone 11 / iOS 27.2; SwiftLint strict passed. The raw build log retains the known
App Intents metadata-extraction warning. The selected scenario/session/push and
four UI-smoke checks report 25 passed, zero failed/skipped on iPhone 17 / iOS 27.0
(`Test-Reguerta-2026.09.28_20-15-36-+0200.xcresult`). No iOS 26 runtime is installed.
The Debug bundle was installed and launched on iPhone 11 with the offline flag;
this confirms deployment/launch, not user-observed VoiceOver behavior. Temporary
Firebase demo configuration and generated string-catalog churn were removed;
Xcode destination was restored to iPhone 11. Changes are not yet committed.


## Guided physical VoiceOver observations — 2026-09-28

The maintainer confirms complete overview reading with the case announced as a
button, detail navigation without focus traps, readable acceptance confirmation,
and absence-form shift selection/sample-reason entry on iPhone 11. Using Back
without submitting restores focus to Accept coverage and Report an absence,
respectively. These bounded offline VoiceOver checks pass. Physical Dynamic Type,
TalkBack and real isolated APNs/FCM transport remain pending; no backend write or
authenticated-role evidence is inferred. This update records observations only,
so no automated suite was repeated.


## Physical maximum-text finding and correction — 2026-09-28

Maintainer screenshots at 21:03:24 and 21:04:30 show truncated coverage/action
navigation titles and a truncated shift selection label. The rest of the flow is
reported usable. Accessibility-size titles now wrap inside the scrollable content
on overview, detail and command sheet; the shift picker uses native inline rows
with wrapping option text. No font shrinking or Dynamic Type limit is introduced.
Physical acceptance remains pending the corrected build. Xcode previews were
blocked by the service's cached optimized Run configuration; runtime inspection
is used instead and the temporary scheme edit is restored.

Validation of the correction: strict SwiftLint and changed-source style audit pass.
Debug build-for-testing succeeded for iPhone 11 / iOS 27.2 and iPhone 17 simulator
/ iOS 27.0; raw logs retain the known App Intents metadata warning. The native
21:07:07 xcresult contradicts the MCP all-pass summary: 21 unit checks passed on
iPhone 11, but UI automation initialization timed out. A simulator-only retry
(`Test-Reguerta-2026.09.28_21-12-13-+0200.xcresult`, under DerivedData/Logs/Test)
confirms all four UI-smoke tests passed, zero failures, on C0534329 / iOS 27.0.
The native 20:15:36 result was also checked and confirms the previous 25-pass
preparation evidence. Use native results rather than the inconsistent MCP summary.

Runtime inspection on iPhone 17 / AX5 / Spanish shows full overview and absence
headings and the complete selected label “Mercado · 16 ene 2027” across lines.
The corrected Debug app is installed and running in offline rehearsal on iPhone
11 for maintainer recheck. Simulator text size was restored to large; the original
scheme and iPhone 11 destination were restored, and temporary Firebase config and
generated catalog churn removed. Physical recheck remains pending. No commit/push.


### Physical recheck and standard-size picker — 2026-09-28

The maintainer confirms all corrected maximum-text content is readable. The
follow-up identifies the original dropdown interaction, so inline shift options
are now restricted to accessibility sizes; standard sizes preserve the original
automatic picker. No draft logic or binding changes. The accessibility branch is
unchanged from the confirmed build. The final standard-size selection/return
check is pending. Debug build-for-testing for iPhone 11 succeeds (21:23:05 log),
strict SwiftLint and the changed-source style audit pass. The known raw App Intents
metadata warning remains. The preceding unit/UI suites were not repeated for
this presentation-only branch; manual validation targets the changed control.
Temporary demo plist and generated catalog churn were removed. No commit/push.


### Final standard-size physical confirmation — 2026-09-28

The maintainer confirms the restored dropdown opens, preserves the sample shift
selection and returns without saving on iPhone 11. This completes the guided
iPhone checks within their documented offline scope, alongside the earlier
VoiceOver observations and maximum-text readability confirmation. No backend
write or real push transport is inferred. Physical TalkBack and isolated APNs/FCM
remain pending. This update records observations only; no suite was repeated
and no commit/push performed.


## iPhone checkpoint delivery — 2026-09-28

The maintainer authorizes commit/push of the completed iPhone block before physical
Android TalkBack. The reviewed scope is the isolated Debug accessibility route,
wrapping coverage titles, accessibility-only inline shift choices, EN/ES copy and
the physical observations above. Recent build/lint and native test evidence is
reused; only documentation changed after the final physical confirmation. The
known App Intents tool warning is recorded, not reported as a warning-free build.
HU-084 stays open; physical TalkBack and real isolated push delivery are pending.
