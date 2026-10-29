# HU-084 provisional review

## Current review — 2026-10-04

The maintainer authorized the final review, validation, issue reconciliation and
opening a provisional PR. The full branch review below is complemented by an
independent review of the delta from `6c199c0` through `c6690b47`, including 16
changed Swift files and the Android/Functions transport boundaries. No functional
blocker was confirmed. Stale manual-acceptance summaries are corrected in the spec
and both native guides. The Debug destination export now uses `JSONEncoder`, with
the existing test decoding through `JSONDecoder`; no additional model or abstraction
is introduced. The subsequent two-file Swift style audit is clean.

The canonical `release-gate` passes on the final Swift sources, using Xcode 27.0
and a freshly installed iOS 26.5 runtime: iPhone 17, exact simulator ID
`091D93C1-5A53-40D0-887E-83F81A8E0326`. Debug and Release builds pass. SwiftLint
0.61.0 reports zero violations in 511 files; all three targets preserve the
required isolation/concurrency settings in both configurations. The closed result
contains 927 tests: **922 passed, five expected skips, zero failures**. Skips are
three opt-in HU-084 journeys, one opt-in HU-083 journey and the conditional launch
test; their separate rehearsal evidence is not replaced by this ordinary gate.
The result reports zero build/analyzer warnings, errors and runtime warnings. The
raw log also retains 16 Xcode debugger-version lookup messages (`noURL`), with no
failed launch or test; these are not hidden or counted as compiler diagnostics.

Reused unaffected evidence: the recent Android run has 503 unit passes, normal and
transport-opt-in Debug builds, and lint with zero errors plus 135 baseline warnings
and two hints. Its ordinary API 29 connected run has 23 executed checks and four
opt-in assumption exits; the earlier explicit acceptance run has 25 passes. These
are separate runs. Functions retains the September 13 full regression evidence
(420 passes/51 emulator-only skips, 122 Firestore/Rules passes and 22 Auth/HTTP
passes), supplemented by the current transport block's lint/build and seven sender
guard tests. No Android or Functions source changed during this final follow-up.

Evidence is retained outside Git under
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu084-final-ios-ipf2goyb/`:
`release-gate.log`, `release-gate.xcresult`, parsed summary/build/tests JSON and
`config-restoration.json`. Synthetic demo Firebase configurations were used for
the run. The original ignored Debug configuration was restored byte-for-byte;
the temporary Release configuration and private backup were removed. No live
registration, remote notification, shared business write or deployment occurred.

The bounded native manual matrix is complete, including six physical APNs/FCM
state cases. Assembly ratification and bilingual requirements, the real entropy
provider, structured operational logs/metrics and real coverage composition,
destination admission and operator recovery remain open. An explicit activation
handoff is still required; HU-085's planner/workbook scope does not absorb these
coverage tasks. The PR references #268 without closing it.

## Full branch scope and conclusion — 2026-09-13

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
| 23 — equivalent native member/admin states | Shared wire fixtures, Android client/operation tests, Swift client/rehearsal tests; local role/cancel and earlier accept/credit journeys | Bounded physical accessibility, API 29 and native notification matrix complete through 2026-10-04 below; live authenticated coverage composition remains separate |
| 24 — backend-only authority | Strict/phase1 Rules matrix, nested recovery authorization/results/push records and Auth emulator revocation/link tests | No Rules deployment |
| 25 — all ratified branches before activation | Provisional workflow/Auth/projection/inbox/push/recovery suites and native gates | Cannot certify a policy the assembly has not yet ratified |

Test names and historical journey evidence are retained in `plan.md` and the bilingual
native rehearsal guides. Receipts establish audit history; they do not implement the
still-open structured operational logs/metrics for stuck cases, exhaustion, retries
and credit failures.

## Validation of the full branch review — 2026-09-13

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

## Manual validation matrix — current through 2026-10-04

| Check | Available means / exact limit | Disposition |
| --- | --- | --- |
| Android API 29 | New AVD `Pixel_4_A10_API_29`, `emulator-5554`; runtime properties confirm Android 10 / SDK 29 | Passed on 2026-09-28: 25 connected tests, zero failures/errors/skips, including both opt-in HU-084 role/cancellation journeys at font scale 2 |
| Physical VoiceOver | iPhone 11, isolated offline sample and maintainer interaction | Passed on 2026-09-28: reading, case/action navigation, cancellation focus restoration, maximum-text readability and standard-size picker; detailed evidence below |
| Physical TalkBack | Xiaomi Android 14, isolated local rehearsal and maintainer interaction | Passed on 2026-09-28: guided reading/navigation and cancellation; maximum-text and keyboard-visible Back recheck also passed, as detailed below |
| Android notification tray | Cold/warm activity Intents already passed; shell tray injection previously failed on PendingIntent UID permission | App-owned Debug injection prepared on 2026-09-28; all three guided local tray variants confirmed by maintainer on API 29: login, signed-in re-entry and cold-process login; real FCM remains separate |
| iOS cold-process notification open | Warm simulated Notification Center taps passed previously; OS cold start drops rehearsal launch flags | Passed on 2026-09-28: maintainer confirms tray-to-login-to-market on iPhone 17/iOS 27.0 after process termination; temporary preference removed afterward |
| Real APNs/FCM | Debug-only real transport opens an in-memory sample; local injection remains separate evidence | Passed on 2026-10-04 on iPhone 11 and Xiaomi Android 14: foreground, background and process closed, with maintainer-confirmed receipt/opening; cleanup verified on both |

Do not count font scaling as VoiceOver/TalkBack evidence. Preserve the bounded scope
of this matrix in the provisional PR. None authorizes production access. Assembly
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


## iPhone delivered; physical Android preparation — 2026-09-28

The iPhone checkpoint is committed and pushed as `bd1fea281269a702101857a98ccbc359c42275ea`;
remote branch parity was verified and HU-084 #268 remains open. A separate local
Debug-only `coverageUsbRehearsal` extra now selects the existing loopback adapter
for Android USB reverse ports 9098/8799. Default emulator routing is unchanged.
The Xiaomi/API 34 app is installed and shows the isolated login; device policy
rejects injected taps, so the maintainer must enter fixture credentials. No device
security setting was changed. Login/TalkBack are not yet validated.

Validation: 502 unit checks pass, lint completes with 135 existing warnings/two
hints, and API 29 connected run succeeds (23 checks plus three opt-in assumption
exits represented as failures in XML, not assertion failures). Functions builds.
Logs: `/tmp/hu084-talkback-build-20260928.log`,
`/tmp/hu084-talkback-connected-20260928.log`, and
`/tmp/hu084-talkback-emulators-20260928.log`. Demo services and the temporary
functions dependency symlink remain active for guided testing; only USB ports
9098/8799 were mapped on the physical device. The synthetic google-services file
was removed after building. Android preparation is not committed yet.


## Guided physical TalkBack result — 2026-09-28

The maintainer confirms case/detail reading, activation semantics, acceptance
confirmation/cancellation and restored focus on Xiaomi / Android 14. The absence
form also passes shift selection, sample-reason entry and cancellation returning
focus to Report an absence after entering the assigned-member account. The earlier
disabled control was investigated without weakening eligibility; the login field
confirmed the offered-member account was still selected. USB reconnection was a
separate setup problem and the fixed reverse ports were restored as needed.
Physical maximum-text inspection and isolated real APNs/FCM remain pending. This
update records observations only; automated suites were not repeated.

### Physical Android XXL progress — 2026-09-28

Xiaomi Font settings shows the rightmost XXL selection; the rehearsal activity's
runtime configuration confirms `fontScale=1.5` (previously 1.33). Overview cards
are readable in the captured screen, and the maintainer confirms full market
detail readability without clipping or overlap. This is the device's offered
maximum, not evidence at 2.0. XXL absence-form inspection remains pending, as does
isolated real APNs/FCM transport. Documentation only; no automated rerun.

### Android keyboard obstruction fixed; physical recheck pending — 2026-09-28

The XXL absence-form check finds Back hidden behind the keyboard. The dialog now
uses `decorFitsSystemWindows=false` and safe-drawing padding outside the scrolling
surface. A real-keyboard/touch cancellation regression at font scale 2.0 verifies
that dismissal leaves the snapshot unchanged and no pending command. All three
opt-in coverage acceptance tests pass on API 29; 502 unit tests pass and lint has
no errors, with the existing 135 warnings/two hints. Build/test logs are
`/tmp/hu084-ime-build.log` and `/tmp/hu084-ime-connected.log`. Updated isolated
Debug APK installed on Xiaomi; physical keyboard recheck remains pending.

Physical recheck confirmed by the maintainer: at XXL, reason entry and scrolling
to/touching Back work while the keyboard remains visible, cancelling without
saving. The guided physical TalkBack and maximum-text journeys are complete;
the latter uses the device's 1.5 maximum, distinct from the emulator's 2.0 test.
Owned demo services stopped; USB mappings and temporary dependency symlink removed.
Font settings reopened for manual restoration to XL. No code changed after the
passing validation; real isolated APNs/FCM delivery remains pending. No commit,
push or PR is included in this confirmation step.


## Real push preparation review — 2026-10-04

Current checkpoint starts at committed/pushed `9b87bb6d` (physical Android IME
confirmation included). The next uncommitted block prepares only explicit Debug
transport rehearsal in both apps and a single-destination offline-by-default
sender. It reuses the prior Firebase app registrations and transport. The
maintainer reports push delivery worked before shift remodeling; the pending
matrix targets coverage regression, not a replacement push implementation.

Independent source review covers composition, cold/warm route, Debug service
selection and sender guards. Two P2 findings are resolved: local/mock iOS launch
flags now clear persistent remote opt-in, and Android exports a destination from
`onRegistered` after FCM registration rather than from installation-ID existence.
The reviewer rechecked the latter correction and found no further concrete defect.
Android exports use no-backup storage; iOS/host cleanup is explicit in both guides.

Local preparation validation: Android 503 unit tests pass, both ordinary and
opt-in Debug builds compile, lint completes with zero errors and the existing
135 warnings/two hints. The ordinary API 29 connected run executes 23 checks;
four opt-in tests exit via `AssumptionViolatedException` (reported as failures by
the XML wrapper, not assertion failures). iOS selected six Swift Testing cases
and four UI smoke cases pass on iPhone 17 / iOS 27.2, device
`0B3A9F32-B9D5-4ED5-A13F-CB66F7917E75`, built with Xcode 27.0. The requested iOS
26 runtime is absent; the initial iOS 27.0 destination also fails because its
runtime path is unavailable. No full release gate is claimed. SwiftLint passes;
two existing AppIntents metadata-extraction warnings remain in test build tasks.
Functions lint/build and both sender guard tests pass. The independent review's
iOS local-mode precedence and Android registration-readiness findings are fixed.
No registration, real delivery, deployment or shared business write was performed.

Evidence: `/tmp/hu084-remote-android-final.log`,
`/tmp/hu084-remote-default-build.log`, `/tmp/hu084-remote-connected.log`,
`/tmp/hu084-remote-functions.log`; native Xcode result
`/Users/jesusf/Library/Developer/Xcode/DerivedData/Reguerta-bajtvkmuoeupuearliilpmxpctjc/Logs/Test/Test-Reguerta-2026.10.04_10-08-35-+0200.xcresult`
confirms 10 passed/zero failed/zero skipped. Physical foreground/background/cold
receipt and tap remain pending on each phone. No cross-platform implementation
gap is introduced; live transport evidence is pending on both platforms.


### Physical iOS preflight — 2026-10-04

Installed the signed Debug build on the connected iPhone 11 / iOS 27.2 after
checking exact Firebase Debug identity, development APNs entitlement and device
provisioning. No launch, registration or FCM send yet. Preflight found and fixed
a cached FCM token being exportable before this launch's APNs registration:
startup removes the previous file, early delegates cannot export, and explicit
FCM fetch after APNs exports readiness; later renewals update it and nil clears it.
Independent review confirms the finding resolved. Four focused tests pass in the
native `Test-Reguerta-2026.10.04_11-08-50-+0200.xcresult` on iPhone 17 / iOS 27.2;
physical Debug build-for-testing also passes. The next live scope is registration
and at most three single-device FCM sends to this iPhone in `reguerta-9f27f`,
pending explicit authorization. Firebase configuration read only; no remote
configuration changes, deployment or business writes.

### Authorized iPhone transport session — 2026-10-04

The maintainer explicitly authorizes registering `com.plusprojects.Reguerta.debug`
and up to three FCM notices from `reguerta-9f27f` to the connected iPhone 11 only.
The installed Debug app was launched with `-coverageRemotePushRehearsal` and
exported a fresh destination after APNs/FCM readiness. The private destination
was copied from that app container to a mode-0700 host directory (file mode 0600);
the offline sender plan confirms the exact iOS Debug app and one destination.
No delivery is claimed by this registration step. Project configuration and
business records remain unchanged.


First authorized foreground send: one HTTP v1 POST, zero retries; FCM returns
HTTP 401 / UNAUTHENTICATED / THIRD_PARTY_AUTH_ERROR. No accepted delivery and no
foreground reception callback. Two of the three authorized attempts remain
unused. Missing/invalid APNs credentials are indicated, but the exact credential
has not been identified: Firebase Cloud Messaging console requires browser login.
No remote configuration or business mutation was made. Physical background/cold
checks remain pending; registration success is not delivery evidence.

Before sending, the iOS sender was narrowed to one HTTP v1 fetch without redirects
or retry because the Admin SDK has internal retries. Seven sender tests and
Functions lint/build pass; a separate reviewer found no blocker. Android's existing
transport remains unchanged, including its SDK retry behavior.
Private session receipt: `/tmp/hu084-iphone-push-0g9rul0r/01-foreground-receipt.json`.
Destination SHA-256: `047cc787a519be0c969eb2f4e13c0bbe54f8642e79f12728996fb64c1cb10165`.


APNs cause confirmed in authenticated Firebase console (read-only): selected
`iOS Reguerta Debug`, bundle `com.plusprojects.Reguerta.debug`, has neither
Sandbox/Production APNs auth keys nor either APNs certificate configured. This
explains the first THIRD_PARTY_AUTH_ERROR; real transport checks remain pending.
No key/configuration mutation or additional send was performed. The next step
requires identifying a retained compatible Apple APNs key and maintainer-owned
credential entry for Debug development only. Existing app delivery is a separate
baseline; this observation does not establish a production notification failure.


APNs development key was uploaded by the maintainer and verified read-only under
`iOS Reguerta Debug` with the signed app's Apple team. After relaunch and fresh
registration export, authorized attempt 2 was accepted for one target and the
physical app console records one foreground notification callback (zero APNs
registration errors). Receipt: `/tmp/hu084-iphone-push-0g9rul0r/02-foreground-receipt.json`;
console: `/tmp/hu084-iphone-push-0g9rul0r/02-console.log`.
Real foreground delivery is now observed; banner tap/case-opening confirmation is
pending. One authorized attempt remains. No extra retries, background/cold send,
agent credential upload, production configuration change or business write.

Maintainer confirmation: tapping the real foreground notice opens the sample
coverage detail on iPhone 11. Foreground transport + tap passed. Background and
cold launch remain pending; one of the three authorized attempts remains.

Authorized attempt 3: maintainer reports background/Home Screen state; one HTTP
v1 submission accepted for the same single iPhone destination. Background arrival
and tap await confirmation. Three-attempt authorization exhausted; cold-start
send needs explicit additional authorization. Receipt: `/tmp/hu084-iphone-push-0g9rul0r/03-background-receipt.json`.

Maintainer confirms successful background receipt and opening of shift coverage.
Both foreground and background matrix rows pass on iPhone 11. Maintainer then
closes the app; device process inventory confirms the installed Debug executable
is absent. Cold launch is prepared; no fourth send made. One additional FCM send
to the same iPhone/project is requested because the original three-attempt scope
is exhausted (one APNs rejection plus two accepted/confirmed deliveries).

Explicit extra authorization received: one additional FCM attempt, same project
and iPhone. Attempt 4 verifies Debug process absent before sending, submits one
HTTP v1 POST and receives acceptedTargetCount=1. Post-send inventory shows Debug
PID 2087 without an agent launch; direct case opening still needs confirmation
after this delivery. Receipt: `/tmp/hu084-iphone-push-0g9rul0r/04-cold-receipt.json`.
No further sends authorized. Temporary dependency symlink removed.

## Final iPhone real transport acceptance — 2026-10-04

The maintainer's confirmation after attempt 4 closes the cold-process case:
the app opened the sample coverage. Real APNs/FCM receipt and native opening pass
in all three states on the physical iPhone 11: foreground, background and process
closed. Four single-POST attempts were made: one rejected for missing Debug APNs
configuration, then three accepted and confirmed after the maintainer configured
the development key. Android's three real-delivery checks remain pending.
This closes the iOS transport matrix only; authenticated backend commands,
business writes and production activation are outside this rehearsal's evidence.

Cleanup verified: the persisted remote opt-in is absent/false after launching
offline; the app's exported destination now contains only `{}` (read back).
Both private host destination copies and the temporary preferences copy were
removed, and only the verified Debug process was stopped. Redacted receipts are
retained. The maintainer's APNs key stays configured; no additional send occurred.

## Android real transport preflight — 2026-10-04

Xiaomi 21081111RG / Android 14 / API 34 is authorized in ADB after moving to a
different direct Mac USB port. Studio-to-ADB communication was healthy; no phone
was enumerated by macOS before the port change. Opt-in `assembleDebug` passes with
the verified real Debug Firebase configuration. Final APK inspection confirms
the rehearsal service/default process and a signature matching the installed
Debug app, whose APK is privately retained for restoration. Notification
permission is off. No rehearsal install/launch, remote registration or Android
send has occurred. The three physical cases remain pending explicit Android
authorization; the existing SDK transport may internally retry each logical send.

Explicit Android authorization received for registration and three logical
state checks with normal SDK retries. Debug installation/update and isolated
launcher routing succeeded; `onRegistered` exported the confirmed destination,
which passes the offline sender plan. No send yet: notification permission
remains pending in the native Android dialog.

## Android foreground transport acceptance — 2026-10-04

Xiaomi 21081111RG / Android 14 / API 34: `POST_NOTIFICATIONS` is granted and
`CoverageRehearsalActivity` was resumed before the first logical FCM send from
`reguerta-9f27f`. The real registration export passed the offline sender plan;
FCM accepted one target (`acceptedTargetCount=1`). The maintainer explicitly
confirms receipt, tap and opening of the sample coverage. The foreground case
passes. Background and process-closed cases remain pending, with two authorized
logical sends remaining. Receipt:
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu084-android-push-uyn4qyns/01-foreground-receipt.json`.

The second logical send was accepted for one target. Pre-send inspection showed
`com.miui.home/.launcher.Launcher` resumed and Debug PID 15319 alive: the app was
in the background. The maintainer then confirms receipt and opening of the sample
coverage. Foreground and background both pass; only the process-closed check is
pending, with one authorized logical send left. Evidence in the same private
directory: `02-background-preflight.json` and `02-background-receipt.json`.

The third logical send was accepted for one target after the maintainer returned
to Home and `am kill` terminated Debug. Pre-send inspection confirmed the MIUI
launcher resumed, no Debug package process or subprocess, `stopped=false` and
notification permission granted; no force-stop was used. The maintainer confirms
receipt and opening, then clarifies that only the Recents card remained and the
app was not reopened manually. The verified pre-send process absence therefore
establishes the process-closed case. All three authorized logical sends are
consumed. Evidence in the same private directory:
`03-cold-preflight.json` and `03-cold-receipt.json`.

## Final Android real transport acceptance — 2026-10-04

All three authorized logical sends were accepted for one target each. The
maintainer confirms receipt, tap and sample-case opening in foreground,
background and process-closed states on Xiaomi 21081111RG / Android 14 / API 34.
The real transport matrix now passes 3/3 on both physical platforms. The retained
Recents card did not represent a live process or a manual relaunch before the
cold notification. This closes transport and native sample opening only;
authenticated backend commands, business writes and production activation remain
outside this rehearsal's evidence.

Android cleanup is verified: Debug was stopped after acceptance, its destination
export removed, and the exact prior Debug APK restored (on-device SHA-256 matches
the saved baseline). App data and normal Firebase registration were preserved.
The host destination and both temporary APK copies were deleted. Redacted
receipts and `cleanup-verification.json` remain; no extra send occurred.

## Real push delivery checkpoint — 2026-10-04

The maintainer authorized commit/push of the completed rehearsal block. The final
independent changed-Swift audit covers five files; one compact `if` was expanded
without changing behavior, and strict SwiftLint reports zero violations. The
recent Android unit/lint/connected results, Functions lint/build and seven sender
guard tests, iOS focused/unit/UI-smoke results and six physical transport cases
above are reused: only formatting and evidence/tracking documentation changed
after their validation. `git diff --check` passes. No full iOS release gate is
claimed for this checkpoint; it remains part of the final provisional PR pass.


## Grouped native administration — 2026-10-26

Maintainer-authorized local implementation connects the existing HU-089 reserve,
permanent-departure and exact ten-week exception policies through the existing
authenticated emulator adapter to both native apps. No shared Firebase/Sheets,
notification dispatch, production deployment or parent delivery is performed.

The administrative query exposes minimal current membership, derived reserves and
credit counts, including inactive/missing members with history. Writer guards bind
source document versions, accounting and planning context; source/authority drift
rejects without partial writes. UID/member link and active administrator are
resolved in each writer transaction, including exact replay. Inactivity alone
keeps compensation; explicit reasoned departure cancels only pending credits,
retains history and never edits account activity or restores cancelled credit.

Spacing choices reuse persisted preview requests, the governed source and the
existing full planner for diagnostic output only. The shared conflict enumerator
keeps actual validation equivalent. Native clients select immutable names, dates,
rounds and proposal identity; they never edit internal IDs or publish a plan.
Approval rederives the exact context in its write transaction. After the last
approval, a valid empty list is distinguished from unavailable planning evidence.

Native operation ownership serializes case/admin mutations, discards late session
responses, clears private drafts on session changes, retains exact uncertain
commands for explicit retry and stops replay immediately after acknowledgement,
even if read-back fails. Confirmations require current source and an explicit
reason; iOS departure also asks for cancellation acknowledgement.

Validation already closed:

- Functions, Node 22.23.4: lint/build clean; pure coverage 65/65; planning 295
  passed plus 51 existing emulator-dependent skips; coverage/Rules/publication
  workflows 174/174; real emulator Auth/HTTP 39/39, all without failures.
- Independent preparation smoke for both `membership` and `spacing` manual
  fixture modes passes through real local Auth/HTTP. All owned emulator ports
  and the temporary dependency symlink are cleaned up.
- Android: 518 unit passes; API 29 connected XML contains 25 passes (including
  both new administrative journeys) and four existing opt-in assumption exits
  recorded as XML failures by the wrapper. Gradle reports BUILD SUCCESSFUL.
  Lint has zero errors, 142 warnings/two hints outside touched coverage paths;
  compiler warnings zero. The final read-only proposal-label addition compiles.
  Owned emulator stopped and its hardware keyboard setting restored.
- Independent native architecture, security/behavior, source-style and SwiftUI
  reviews close all actionable findings: modern UTC date parsing, semantic
  departure eligibility, scaled spacing, acknowledged-read recovery, localized
  proposal identification and correct empty-state behavior. Swift audit covers
  18 changed/new files; no remaining style deviations.
- Nine actual iOS snapshots cover list/departure/spacing form at Large, XXX
  Large and AX5, on iPhone 18 Pro Max/iOS 27.2. Visible content is readable
  and scrollable. These are previews, not physical accessibility validation.

Canonical iOS release-gate results are recorded below.
New physical VoiceOver/TalkBack, maximum text and keyboard journeys remain
explicitly pending; the earlier physical notification matrix is not new evidence
for these administrative forms. Guided scripts and exact limits are in both
native rehearsal guides. This local checkpoint remains uncommitted until a
separate delivery instruction; #268/#278 stay open and HU-089 stays closed.


### Definitive iOS gate and cleanup — 2026-10-26

`./scripts/validate-ios.sh release-gate --destination
'platform=iOS Simulator,id=091D93C1-5A53-40D0-887E-83F81A8E0326'`
completed with exit 0 using Xcode 27.1, iPhone 17/iOS 26.5 (device display name
`HU084 Final Gate iPhone 17`). Canonical summary: **941 total, 936 passed,
five expected skips, zero failures**. The per-device execution counts include
dynamic-parameter executions; the canonical runner summary is the reported total.
SwiftLint finds zero violations in 520 files; all six target/configuration checks
preserve nonisolated/Swift 6/strict complete/approachable/iOS 26 settings, and
Debug/Release builds succeed. The closed result contains no compiler, analyzer,
test or runtime warning/error summaries. Raw host SDK/debugger metadata messages
(`invalidDigitCount`, debugger version lookup) remain in the log; they are separate
from the clean app/build/test result.

- Gate log: `/tmp/hu084-admin-ios-release-gate.log`.
- Canonical summary: `/tmp/hu084-admin-ios-summary.json`.
- Closed result object: `/tmp/hu084-admin-ios-result-object.json`.
- Bundle: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/reguerta-release-gate.fTuzlofX8C/release-gate-v1.xcresult`.
- Nine preview paths/actual destination/limits: `/tmp/hu084-admin-ios-previews.json`.
- Backend: `/tmp/hu084-admin-pure.log`, `/tmp/hu084-admin-planning-final.log`,
  `/tmp/hu084-admin-workflows-final.log`, `/tmp/hu084-admin-auth-complete.log`,
  `/tmp/hu084-admin-rehearsal-smoke.log`.
- Android: `/tmp/hu084-admin-android-final.log` and final label-only compile
  `/tmp/hu084-admin-android-proposal-label.log`.

Original Firebase Debug bytes restored, synthetic Release removed, private backup
deleted. Xcode scheme/project match HEAD exactly. String Catalog preserves every
old entry and adds 27 administrative EN/ES keys only. Owned Xcode workspaces,
Android emulator and fixed backend services are stopped; temporary dependency
symlink removed. Git diff whitespace check passes. Main-checkout user dependency/
project changes remain untouched. The worktree is intentionally uncommitted.


### Physical administrative rehearsal prepared — 2026-10-26

The maintainer connected/unlocked the iPhone 11 (iOS 27.2), authorizing the
guided new-form checks. Official Xcode 27.1 built, signed, installed and ran the
current Debug app on that physical device (26.617 seconds; no compiler warnings
or errors in the completed build log). Its Device Interaction tool rejected the
physical device despite normal RunProject eligibility; no interaction session
was created. No simulator was substituted for this physical check.

After stopping the owned Xcode run and closing only the temporary worktree
workspace, devicectl relaunched `com.plusprojects.Reguerta.debug` with the exact
`-coverageAccessibilityRehearsal` argument. This leaves the offline in-memory
example open for the maintainer, with no remote push registration/business writes.
Temporary scheme Debug/argument changes, project reordering and catalog metadata
were restored. Pre-existing Xcode workspaces and main-checkout edits are untouched.
The source/UI is unchanged, so no additional full regression run is warranted.

This establishes preparation/launch only. VoiceOver reading, focus return,
maximum text and keyboard behavior on the new administrative forms remain pending
the maintainer's observations. First check: open “Reservas y excepciones” and
read “Beatriz de prueba”, inactive status, one pending delivery compensation and
the “Actualizar situación” / “Registrar baja permanente” buttons. Open/cancel only;
the offline adapter intentionally cannot save commands.


### Physical VoiceOver: administrative member row confirmed — 2026-10-26

On the prepared iPhone 11 offline rehearsal, the maintainer confirms that
VoiceOver reads the complete Beatriz de prueba row, including inactive status,
one pending compensation and both “Actualizar situación” and “Registrar baja
permanente” buttons. This closes the first new administrative reading check only.
Form explanation, cancellation/focus return, permanent-departure confirmation,
spacing-pair reading and text/keyboard checks remain pending. No command submitted.


### Physical cancellation focus finding and correction — 2026-10-26

The maintainer confirms that the complete update-situation explanation is spoken,
but the original binary returned VoiceOver focus to the top navigation Back button
on cancellation. This did not meet the expected return-to-invoker behavior.

The correction is confined to `CoverageAdministrationView` and its member row.
The presenting view owns a VoiceOver-scoped optional typed focus binding, records
the accepted invoking action/current session, and consumes that origin once in
`sheet`'s `onDismiss`. It requests focus only when VoiceOver remains enabled, the
same session still owns the screen, no write is pending/busy and that exact button
is still rendered/enabled. Session replacement clears both values. Reopening the
same action clears the binding before presentation. No delayed tasks, retries or
global accessibility observers are introduced. Spacing and departure buttons use
the same narrow mechanism.

Official Apple references: `AccessibilityFocusState`, `accessibilityFocused(_:equals:)`
and `sheet(item:onDismiss:content:)`, verified through Cupertino. Independent
read-only review and two-file Swift style audit close without blockers. Focused
SwiftLint is clean. The corrected physical Debug build/install/launch passes in
17.545 seconds without compiler warnings/errors. Xcode's temporary project, scheme
and catalog changes are restored after the owned run; the offline sample is
reopened with devicectl and the explicit accessibility argument.

**Physical recheck passed:** the maintainer reports that cancelling “Actualizar
situación” now returns VoiceOver focus to “Actualizar situación”. The earlier
member-row and explanation reading confirmations remain valid. Departure/spacing
return and remaining text/keyboard checks are still pending. New regression test
results follow when complete; the earlier 936-pass release gate predates this
two-View focus correction and is not reported as a run of the corrected code.


Post-correction regression: official Xcode MCP on iPhone 17/iOS 26.5
(`091D93C1-5A53-40D0-887E-83F81A8E0326`) reports **19/19 passing**, zero
failures/skips: 15 administrative parameter-expanded results and the four existing
UI-smoke journeys. The completed build log contains no warnings/errors. Bundle:
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RunSomeTests/Test-Reguerta-2026.10.26_22-57-13-+0100.xcresult`.
These are regression results, not automated proof of actual VoiceOver position.
The maintainer's physical update-situation recheck supplies that bounded proof.
Source review/style and diff whitespace checks are clean. Temporary scheme,
project/catalog metadata and destination restored; owned workspace/simulator
closed. The physical offline sample remains open for the continuing manual checks.


### Physical VoiceOver: permanent-departure form confirmed — 2026-10-26

The maintainer confirms that the permanent-departure form reads its complete
cancellation notice, reason field, cancellation acknowledgement and initially
disabled Confirm control. Selecting Back returns VoiceOver focus to the invoking
“Registrar baja permanente” button. This validates the second corrected action
on the actual iPhone 11 binary. No confirmation was submitted. Spacing-form
reading/return and the remaining text/keyboard checks are still pending.


### Physical VoiceOver: exact spacing pair and return confirmed — 2026-10-26

The maintainer confirms complete reading of Ana de prueba's exception proposal,
including the two dates/rounds (2027-01-06, round 3; 2027-02-17, round 4), and
that Back returns focus to the exception button. All three administrative
open/cancel focus-return paths are now physically confirmed on the corrected
iPhone 11 binary. No command was submitted. Reason/acknowledgement editing,
maximum text and keyboard checks remain pending.


### Physical reason/acknowledgement guard and keyboard observation — 2026-10-26

The maintainer confirms on the actual iPhone 11 that entering “Prueba” alone
keeps permanent-departure Confirm disabled, checking its explicit cancellation
acknowledgement enables it, and Back cancels without submitting. This closes the
physical editing/guard check. They also report that the software keyboard remains
while VoiceOver reads outside the reason field. Accessibility reading focus and
text-input focus are independent; changing the former need not finish editing.

A narrow admin-form improvement binds the reason to SwiftUI FocusState and adds
a localized native keyboard-toolbar “Ocultar teclado”/“Hide keyboard” button.
It ends editing without changing reason, acknowledgement or submission logic.
Back also clears editing focus before dismissing the sheet. No automatic keyboard
dismissal follows VoiceOver exploration. Both departure and spacing reason forms
share the same sheet; unrelated legacy coverage forms remain outside this change.
Official FocusState/keyboard-toolbar docs were verified through Cupertino.
Physical keyboard-dismissal/preservation and maximum-text checks remain pending
on the updated binary.


### Physical keyboard-dismissal recheck passed — 2026-10-26

The updated physical Debug build/install/launch passes in 17.994 seconds with
no warnings/errors in the completed build log. The maintainer confirms that
activating “Ocultar teclado” in the permanent-departure reason form closes the
software keyboard and preserves “Prueba”. No command is submitted. This closes
the new explicit keyboard-dismissal check on iPhone 11; maximum-text checks
continue. Two new offline UI regressions cover hide/preserve and cancel-while-
editing for both departure and spacing; their coordinated execution is pending.


### Maximum text and touch-selection regression — 2026-10-26

The maintainer enables maximum accessibility text on iPhone 11 and confirms that
the permanent-departure title, complete notice and acknowledgement remain legible,
with reason and Back reachable by scrolling. Maximum-text spacing and keyboard
checks continue.

The first new automated keyboard run reports four existing UI-smoke passes and
two failures before keyboard entry: tapping the uniquely identified departure
button opens the update-situation sheet. Its navigation title and absence of the
reason field independently identify the wrong route. Source/log review finds two
automatic-style Buttons in the same List cell; the first presentation wins and
the later one is rejected by the existing draft fence. VoiceOver activation had
correctly targeted each action, so the physical reader results do not establish
finger-tap behavior. The UI test selectors and reason/keyboard oracles are kept
unchanged.

The production correction gives the three administrative buttons an explicit
borderless style and separate full-width rectangular label targets, with a
44-point body-scaled minimum height. It retains Button semantics, destructive
role, session/permission fences and the already verified focus-return mechanism.
The unchanged keyboard tests are rerun to validate actual touch routing, not
relaxed to accept the wrong form.


The unchanged new keyboard UI tests now pass **2/2** after the production
button-style correction, with zero skips/failures. Both tests traverse departure
and spacing forms: touch routing reaches the correct reason field, an actual
software keyboard is visible, Hide keyboard dismisses it and preserves “Prueba”,
and Back closes the form/keyboard without submitting or leaving a pending command.
The four existing UI-smoke tests passed in the initial combined run and are
recorded separately from these corrected reruns. Completed build log: zero
warnings/errors. Xcode 27.1, iPhone 17/iOS 26.5; bundle:
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RunSomeTests/Test-Reguerta-2026.10.26_23-22-37-+0100.xcresult`.
Independent three-file source/style review closes without blockers. Test
expectations are unchanged; this result validates the diagnosed touch selection
defect rather than weakening the oracle. Temporary project/scheme/catalog state
is restored, the owned workspace/simulator closed, and the physical offline
session is left untouched while the maintainer completes maximum-text checks.
The latest touch-style correction still needs the physical app update/spot check;
its keyboard and modal content are unchanged from the physical checks already
confirmed. The earlier full release gate predates these focused corrections.


### Physical maximum-text spacing form confirmed — 2026-10-26

At maximum accessibility text on the prepared iPhone 11, the maintainer confirms
that the exception proposal, both dates and round numbers read completely and
that reason and Back remain reachable by scrolling. This closes the maximum-text
spacing layout/readability check. Maximum-text software-keyboard interaction and
the final physical touch-style update/spot check remain pending. No submission
was made.


### Physical maximum-text keyboard check confirmed — 2026-10-26

The maintainer confirms on iPhone 11, at maximum accessibility text, that Back
remains reachable with the software keyboard open, Hide keyboard preserves the
reason, and Back cancels without submitting. This closes the bounded new
administrative reading, return-focus, reason/acknowledgement, maximum-text and
keyboard checks on the prepared iPhone binary. The latest independent touch-style
correction still requires installation and direct finger-tap confirmation;
Android new-form physical checks and refreshed final gate remain separate.


### Latest touch correction installed physically — 2026-10-26

Official Xcode 27.1 builds, signs, installs and runs the complete current Debug
source on the connected iPhone 11/iOS 27.2 in 17.156 seconds. The completed build
log has zero warnings/errors. After stopping the owned Xcode run, restoring the
original scheme/project/catalog metadata and closing the temporary workspace,
devicectl relaunches the explicit offline accessibility sample. The latest
independent borderless buttons/scaled touch targets are now on the physical
device. No new source change was made in this preparation, so the corrected
2/2 touch/keyboard UI regressions remain applicable. Physical direct-touch
opening/cancellation is pending the maintainer's next observation.

The combined physical checklist is split by platform: iPhone new-form
reader/focus/reason/acknowledgement/text/keyboard observations are confirmed;
Android new-form physical TalkBack/text/keyboard remains untested. Prior
physical coverage/notification checks do not fill that gap.


### iPhone new administrative forms: bounded physical acceptance complete — 2026-10-26

On the latest installed independent-button binary, the maintainer confirms that
a direct finger tap opens each corresponding form: update situation (explanation,
no reason or acknowledgement), permanent departure (reason and acknowledgement),
and spacing exception (exact pair and reason, no acknowledgement). They cancel
all three with Back without submitting. This closes the final physical touch
regression on iPhone 11/iOS 27.2.

The bounded new-form matrix is complete for this phone: VoiceOver member/form
reading and all three invoking-button focus returns; reason plus explicit
acknowledgement gating; maximum-text departure/spacing readability and scrolling;
software-keyboard dismissal retaining the reason; reachable Back while editing;
and independent direct-touch routing on the latest binary. No real business
command, membership edit, credit cancellation, planning publication or push was
performed by these offline physical checks. They do not validate authenticated
backend writes on the phone. Android new-form physical TalkBack/text/keyboard
acceptance remains pending. The complete iOS release gate is now being refreshed
with all in-scope corrections and both new keyboard UI regressions.


### Android preflight and maintainer deferral — 2026-10-26

Read-only Android preflight finds no connected adb device and no local listeners
on 8798/8799/9098. The current ordinary Debug APK builds with remote-push rehearsal
explicitly false; no install, device modification, local fixture start or real
notification occurs. The maintainer reports the Android phone is out of battery
and will charge it for continuation the next morning. Its physical acceptance
remains pending. iPhone physical checks are complete.

Prepared APK: `android/Reguerta/app/build/outputs/apk/debug/app-debug.apk`, package
`com.reguerta.user.debug`, version 0.3.0.1/code 37, API 29+. SHA-256 at preparation:
`7761b09d399955e593e161a09c82e9f0e7a79417e9daea4a6d8010d3b34a34f3`.
Reverify device/artifact state on resumption. Node 22.23.4, Java 21 and compatible
existing backend dependencies are available; no dependency symlink or service is
left running. The exact resume plan is retained in `plan.md`.

### Refreshed iOS gate: tests pass, runtime diagnostics remain — 2026-10-26

The canonical release gate on Xcode 27.1, iPhone 17/iOS 26.5, simulator
`091D93C1-5A53-40D0-887E-83F81A8E0326` exits 0: **943 total, 938 passed,
five expected skips, zero failures**. This includes both new keyboard UI tests
and all current focus, keyboard-dismissal and independent-touch corrections.
SwiftLint is clean across 521 files; all six concurrency/platform checks and
Debug/Release builds pass. There are zero compiler/analyzer warnings or errors.

The closed result nevertheless records **two runtime warnings**, one in each
`CoverageAdministrationKeyboardUITests` method: `Invalid frame dimension
(negative or non-finite).` Test success does not close these diagnostics. Initial
source review finds no negative/non-finite fixed-size expression in the new
forms. Both warnings occur on the first tap into the departure reason, during
keyboard activation, before typing, hiding the keyboard or cancelling. The
spacing iteration adds no reported warning. Both recorded stacks contain 62
zero-address entries without symbols, module or useful source location, so they
cannot attribute the warning to application code or SwiftUI/UIKit. The
focus-dependent keyboard-toolbar transition is a hypothesis, not a proven cause.
Do not add dimension clamps or suppressions without a demonstrated cause, and do
not describe this refreshed gate as free of runtime warnings. Diagnosis remains
an explicit local follow-up, separate from the accepted iPhone observations and
the deferred Android physical checks.

- Log: `/tmp/hu084-admin-ios-final-release-gate.log`.
- Summary: `/tmp/hu084-admin-ios-final-summary.json`.
- Closed result: `/tmp/hu084-admin-ios-final-result-object.json`.
- Bounded warning diagnosis: `/tmp/hu084-admin-ios-final-warning-diagnosis.json`.
- Restoration/hash evidence: `/tmp/hu084-admin-ios-final-cleanup.json`.
- Bundle: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/reguerta-release-gate.tHl06Ck2Aa/release-gate-v1.xcresult`.

All 531 recorded source/configuration hashes remain unchanged by the gate.
Original project, scheme, String Catalog and Firebase configuration bytes are
restored; the private backup is removed. The catalog retains the 28 intended
administrative EN/ES additions. No source change, commit, push, Android service
start or shared-service mutation is made by this validation.

### Android physical TalkBack: reserve cancellation confirmed — 2026-10-27

On the connected Xiaomi 21081111RG/Android 14, the maintainer signs into the fixed
local membership rehearsal. With TalkBack enabled, they open the reserve example's
Apply current member situation action, read the entire explanation and cancel
with Back. They confirm that the accessibility focus returns to the same action
button for that member. No confirmation or business submission is performed.
The maintainer also reads the inactive permanent-departure example and its one
pending delivery credit, opens the departure form, reads the full warning and
reason field, and confirms that Confirm is disabled without a reason. Back
returns TalkBack focus to Register permanent departure. In a second opening,
entering "Prueba" enables Confirm; the system Back gesture dismisses the software
keyboard while preserving the reason, and cancelling returns focus to the same
departure button. They never press Confirm. These observations close the bounded
membership reading/cancellation/reason/keyboard checks at the existing font
scale of 1.5. Maximum-text layout, spacing, direct-touch and local write checks
remain pending; this does not close the whole Android administrative matrix.

Device font preparation: the Xiaomi rejects a shell write to `font_scale` with
WRITE_SETTINGS denied; no setting changes. Its installed font-settings intent
opens the native font controls, whose accessibility tree shows XXL checked as
the largest offered text-size option (XXS, XS, S, L, XL, XXL). The measured scale
remains 1.5. Thus earlier physical checks already used this control's maximum;
do not label them as a 200-percent run. Return the existing rehearsal task to
the foreground without resetting its authenticated session. Visual layout and
Back reachability while the keyboard remains open still need observation.

The maintainer now confirms the departure form's visual readability and scrolling
at the native XXL/1.5 setting: title, warning and controls read completely; after
typing "Prueba", Back remains reachable and cancels with the software keyboard
still open. They do not confirm a command. This closes that bounded maximum-font
and keyboard-open cancellation check. Local membership writes, direct-touch
spot checks and the spacing fixture remain separate pending observations.

The maintainer confirms Apply current member situation for the reserve example:
both delivery and market reserves become active. Authenticated read-back from
the fixed local API agrees: both entries are active with enteredAtMillis
1780272000000 (the fixture's fixed 2026-06-01 UTC date) and admissionAfterRound 0.
The inactive departure example still has one pending delivery credit and no
cancelled credit. Preserve the first-write snapshot in the private physical-test
evidence directory as `membership-after-first-reserve.json` before repetition.
The fixed clock limits any inference about preservation across elapsed time;
compare actual reconciliation changes/entry state as well as the visible date.

The maintainer repeats the reserve update and separately applies the inactive
example's current situation: both reserves remain active with the same displayed
entry date, and the inactive account retains its one pending delivery credit.
Authenticated local read-back confirms that the reserve entries and membership
revision are unchanged; the inactive example remains non-permanent with one
pending and zero cancelled delivery credits. Evidence is retained as
`membership-after-repetition-and-inactivity.json` beside the first-write snapshot.
This confirms the bounded no-op/inactivity behavior without inferring a moving
clock or a permanent-departure cancellation that has not yet occurred.

The maintainer then explicitly registers the sample's permanent departure with
a reason. The phone shows Permanent departure recorded and delivery credits move
to zero pending/one cancelled. Authenticated local read-back agrees: the permanent
marker is true, sourceActive remains false, and the historical credit is cancelled
rather than consumed (zero used). The final membership snapshot is retained as
`membership-after-permanent-departure.json` before resetting the fixed demo for
the independent spacing rehearsal. No real account, credit or shared dataset is
changed. Direct-touch spot checks and the spacing physical matrix remain pending.

### Android physical spacing form: reading and cancellation — 2026-10-27

After fresh login to the independent fixed-demo spacing fixture, the maintainer
confirms that TalkBack reads the closed-maintenance notice and that membership
reconciliation actions are disabled. They open Ana's first proposed exception:
the proposal, 03/09/2026 round 1 and 15/10/2026 round 2 are read completely.
Confirm remains disabled without a reason. Cancelling returns TalkBack focus to
the same pair's exception button. No exception has been authorized. Spacing
reason/keyboard and direct-touch checks, followed by one local authorization and
read-back against the retained 48-pair baseline, remain pending.

The maintainer next enters "Prueba" in that spacing form: Confirm enables, all
content remains legible at native XXL/1.5, and Back is reachable with the software
keyboard open. Hiding the keyboard preserves the reason; they cancel without
authorizing. Authenticated read-back confirms all 48 exact proposals remain
unchanged and membership actions stay read-only. Preserve
`spacing-after-cancellations.json` beside the initial API/Firestore snapshots.
The spacing reading, guard, cancellation/focus, maximum native font and keyboard
checks are now observed physically. Authorization and independent direct touch
remain pending until their separate observations and persisted read-back.

After cancelling the earlier form, the maintainer follows the direct-touch
sequence with TalkBack disabled: reopen the same Ana pair from its list button,
enter the sample force-majeure reason and confirm. They observe that pair
disappearing. Authenticated read-back leaves 47 proposals and removes exactly
Ana's 03/09/2026 round 1 to 15/10/2026 round 2 pair, with no newly added pair.
The persisted exception and operation agree on member-1, bundle-2026, both dates
and rounds, reason and administrator member-1. All pre-existing collection
contents, including request, configuration, source policy and rotations, remain
unchanged; public shifts and persisted planning candidates stay absent. Only one
exception and its operation receipt are added. Compare normalized JSON values:
SDK Timestamp instances and their serialized representation are not different
stored content. Evidence is retained in `spacing-after-approval.json`,
`spacing-firestore-after-approval.json` and `spacing-verification.json` beside the
before snapshots. The spacing physical matrix is complete; the final membership
direct-touch opening/cancellation spot check remains pending.

### Bounded Android administrative acceptance complete and cleanup — 2026-10-27

With TalkBack disabled, the maintainer opens both remaining membership actions
using direct touch. Reconciliation opens its explanation without a reason;
permanent departure opens its warning and reason. They cancel both without
confirming. Authenticated read-back before/after these final cancellations is
identical. Together with the earlier direct-touch spacing authorization and
TalkBack/text/keyboard observations, this completes the bounded new-form physical
Android matrix on Xiaomi 21081111RG/Android 14 at native maximum XXL/1.5.
Historical pending entries above are superseded by this checkpoint.

The original Debug APK is restored through replacement installation without
clearing app data. Installed APK read-back matches its preserved SHA-256 exactly:
`8cec21e47fafb203a57304cf70939c15dca4d96708b253a339a973aa56ba4bcc`.
TalkBack is disabled and display size/density match the original values. The final
font scale is 1.0, different from the initial native XXL/1.5; preserve that current
normal-text setting. No shell font write succeeded. This is not an assertion
that every original setting was restored byte for byte.
Both owned USB reverse mappings, all owned demo services/ports and the temporary
backend dependency link are removed. Evidence, including `membership-touch-before`
and `membership-touch-after` snapshots, `spacing-verification.json` and
`cleanup.json`, is retained privately at
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu084-admin-android-physical-20261027-x74kuawo`.

Today's changes record physical evidence and planning only; Functions build passed
for the local preparation. No executable source changed, so unaffected Functions,
Android and iOS automated gates are reused with the explicit limits already
recorded. No commit, push, merge, deployment, shared Firebase/Sheets change or real
notification occurs. HU-084/#268 and draft #278 remain open; the two invalid-frame
runtime diagnostics in the latest iOS keyboard UI tests remain an explicit next
local gate. Physical acceptance does not establish live composition/activation,
and the fixed-clock rehearsal does not replace the existing automated lifecycle,
session or elapsed-time tests.

### iOS invalid-frame diagnosis and focused correction — 2026-10-27

The unchanged two keyboard UI tests reproduce both runtime warning summaries.
Making the keyboard-toolbar condition depend on immutable draft requirements
does not remove them; that experiment is reverted exactly. No expectations or
validation rules are changed.

Unlike the zero-address stacks in xcresult, the Simulator unified log preserves
symbolicatable image offsets. Symbolication and a live pre-call breakpoint agree:
native SwiftUI 26.5 InputAccessoryBar.body passes a present fixed width of
+infinity to FrameLayout (x0 0x7ff0000000000000, x1 0; height nil). The call path
is InputAccessoryBar/InputAccessoryGenerator/UIKeyboardSceneDelegate, without an
application geometry calculation supplying that width. This establishes the
emitter in this runtime; it is not an assertion about every SwiftUI version.

The warning correction changes the existing action's placement from keyboard to
topBarTrailing. Its editing-focus condition, label, identifier, dismissal,
reason/acknowledgement guards, cancellation and deadline refresh remain unchanged.
Interactive AX5 inspection then identifies central-title elision; reuse the other
command sheet's wrapping Form header and empty navigation title at accessibility
sizes. The full localized title and Back/Hide keyboard actions are now complete
in both modal captures, including focused editing with the keyboard visible.

The same two keyboard tests and four canonical UI-smoke tests pass: six passed,
zero skipped/failed, and zero runtime/compiler/analyzer issue summaries in the
closed result. Independent full-file source/style review has no findings; the
final source SHA-256 is 8877b7c316e1658e4ea4297f76ec2785ccb13859357fffcbabe7c47ad4afaa04.
Large/XXX Large previews retain unchanged idle layouts; both AX5 previews are
regenerated after the header change. Preview rendering actually uses iPhone 18
Pro Max/iOS 27.2, while focused runtime captures use iPhone 17/iOS 26.5.
The changed button's physical VoiceOver spot check is now confirmed below,
alongside the corrected canonical gate. The earlier two-warning
full gate is historical evidence, not the clean result for this source.

Focused evidence: `/tmp/hu084-warning-baseline-object.json`,
`/tmp/hu084-warning-candidate-object.json` (rejected condition experiment),
`/tmp/hu084-warning-navigation-object.json`,
`/tmp/hu084-layout-unified-log.json`,
`/tmp/hu084-layout-symbolicated-frameworks.json`, and
`/tmp/hu084-warning-live-registers.txt`,
`/tmp/hu084-warning-live-callsite.txt` and
`/tmp/hu084-warning-live-backtrace.txt`.
The correction uses supported native placement, without suppression, fixed-frame
clamps, UIKit wrappers or timing workarounds. No Git delivery or live action is
performed at this checkpoint.

Final focused result: `/tmp/hu084-warning-final-focused-object.json` and
`/tmp/hu084-warning-final-focused-evidence.json`. AX5 runtime captures:
`/tmp/hu084-warning-final-ax5-departure-header.png`,
`/tmp/hu084-warning-final-ax5-departure-focused.png`,
`/tmp/hu084-warning-final-ax5-spacing-header.png`,
`/tmp/hu084-warning-final-ax5-spacing-focused.png`.

### Corrected definitive iOS gate and restoration — 2026-10-27

The canonical release-gate runner exits 0 on Xcode 27.1, iPhone 17/iOS 26.5,
exact destination `091D93C1-5A53-40D0-887E-83F81A8E0326`, with frozen source
8877b7c316e1658e4ea4297f76ec2785ccb13859357fffcbabe7c47ad4afaa04:
**943 total, 938 passed, five expected skips, zero failures**. Closed xcresult
root, buildResult and actionResult all have zero compiler/analyzer warnings,
testWarningSummaries (runtime), errors and test failures. SwiftLint checks 521
files without violations, all six concurrency/platform checks pass and both
Debug/Release builds succeed. This supersedes the prior full gate's two runtime
warnings; it does not equate Simulator or previews with new physical acceptance.

Five original project/scheme/catalog/Firebase files and all 531 recorded hashes
are restored exactly; original Debug configuration is restored, the temporary
Release configuration and private backup are removed, and the 28 intended
administrative EN/ES keys remain intact. No application logic changes after
freeze; the only change after the six focused UI tests was the explanatory
comment. Existing main-checkout user changes remain untouched. No commit/push or
live-service action is performed; subsequent physical preparation follows below.

- Log: `/tmp/hu084-warning-corrected-release-gate.log`.
- Canonical summary: `/tmp/hu084-warning-corrected-summary.json`.
- Closed result/issue counts: `/tmp/hu084-warning-corrected-result-object.json`,
  `/tmp/hu084-warning-corrected-issue-counts.json`.
- Restoration: `/tmp/hu084-warning-corrected-cleanup.json`.
- Bundle: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/reguerta-release-gate.KrFwESokWQ/release-gate-v1.xcresult`.

### Corrected physical VoiceOver spot check accepted — 2026-10-27

The iPhone 11/iOS 27.2 is built and installed with frozen 8877 source, Spanish,
process-only AX5 and the explicit offline sample. Five originals and 531 hashes
are restored exactly after installation, with the 28 intended keys preserved.
The maintainer confirms visible offline text with very large letters despite
detached screenshots omitting text; do not diagnose the app from that artifact.

In permanent departure, VoiceOver reads the full wrapping title and the top-right
Hide keyboard action. Activating it hides the keyboard while preserving Prueba;
Back cancels and returns focus to Register permanent departure. No submission is
made. This accepts the changed shared control/header on the phone, not a new
physical spacing-form journey: that post-fix path has Simulator AX5 evidence.

The physical build succeeds with zero structured/source compiler diagnostics,
but its raw log has one Apple appintentsmetadataprocessor warning:
`Metadata extraction skipped, no AppIntents.framework dependency found`.
This is separate from the layout warnings and the zero-issue canonical Simulator
gate. Read-only inspection finds no App Intents/Siri/Shortcuts implementation or
explicit framework dependency in this app. No unused import, unrelated setting
change or warning suppression is introduced.
Raw log: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RunProject/RunProject-Log-20261027-155422.txt`, line 2855.
Restoration: `/tmp/hu084-iphone-final-cleanup.json`.

The two layout warnings and their targeted physical regression are closed.
Documentation-only observation updates reuse the unchanged accepted source;
no new build/test is required. Git delivery remains pending. HU-084/#268 and
draft #278 stay open; broader activation/ratification requirements are unchanged.

### AppIntents correction feasibility — 2026-10-27

Read-only inspection of the installed Xcode 27.1 `AppIntentsMetadata.xcspec`, the
actual target settings and the processor help identifies a supported generation
switch, `LM_ENABLE_LINK_GENERATION=NO`. Replaying the physical-build invocation
with its `-d` argument and temporary outputs exits zero but emits one replacement
warning: `Metadata extraction disabled by --disable`. Original outputs remain
unchanged. Evidence: `/tmp/hu084-appintents-disable-probe-summary.json`.

`LM_FILTER_WARNINGS` only filters warnings. The official Swift Build producer has
an internal `LM_SKIP_METADATA_EXTRACTION` guard, but no public build-setting
contract was found; it is not adopted as a supported user setting. The inspected
revision is [6c0642b](https://github.com/swiftlang/swift-build/blob/6c0642b05c4046ea99c8b3fbc9fb648f21afa040/Sources/SWBApplePlatform/AppIntentsMetadataTaskProducer.swift#L50-L60).
No unused dependency, warning filter or project setting is added. This
investigation cannot claim the physical-build warning resolved; it remains
separate from the corrected zero-issue Simulator gate.

The application source still matches the accepted freeze and no build
configuration changed. Reuse the recorded full gate and physical observations;
documentation-only recording needs no repeated build or phone action. The
maintainer authorizes commit/push of the native administration block, plus a
separately validated commit for their Android library updates. Parent HU-084 and
its draft PR remain open, with the existing activation/ratification limits.

### Maintainer Android dependency delta — 2026-10-27

The catalog update preserves the existing branch versions and adds the six
remaining maintainer changes: Kotlin 2.4.20→2.4.21, Firebase BoM 34.19.0→35.1.0,
DataStore 1.2.1→1.3.0, serialization 1.11.0→1.12.0, ML Kit prompt beta4→beta5 and
Tink 1.23.0→1.24.0. AGP/Core/Compose/Navigation/Coil were already updated on this
branch; the resulting catalog matches the maintainer's file exactly. The source
checkout and its unrelated iOS project edit are preserved.

The build uses `resources.directories.add` with the same shared-fixture path.
Four instrumented-test `KeysetHandle.generateNew` calls use the supported
two-argument overload with their existing `RegistryConfiguration.get()` value.
The deprecated Tink 1.24 overload delegates to that same implementation, as
verified in the installed source archive. AES256_SIV/AES256_GCM parameters and
all test assertions stay unchanged.

The first connected invocation fails before running tests because AGP 9.4.1's
`--serial` selector attempts to remove from an immutable `ListProperty` result.
The supported `ANDROID_SERIAL` provider filter selects only the isolated API 29
AVD and avoids that plugin defect without a project workaround. The corrected
connected run exits successfully; the failed selector attempt is not an app-test
result. Logs: `/tmp/hu084-library-connected-selector.log` and
`/tmp/hu084-library-connected-final.log`. No physical phone is installed or
modified by these checks. Physical accessibility/transport observations above
predate this dependency refresh and are not presented as repeated physical runs.

Final validation: 518 unit tests pass; API 29 runs 29 instrumented entries with
25 passes and four pre-existing opt-in assumption exits (encoded as failures by
the XML wrapper, not assertion failures); Gradle succeeds. Both new native
administration tests and all encrypted-storage migration tests pass. Final lint
passes with zero errors, 135 warnings and two informational hints. The
DSL and four Tink compiler deprecations are resolved without suppression.
Unit/build/lint evidence: `/tmp/hu084-library-unit-lint.log`,
`/tmp/hu084-library-final.log` and `/tmp/hu084-library-lint-final.log`;
instrumented evidence is the corrected connected log above. The initial combined
log includes the old selector failure and predates the Tink call correction;
it must not replace the successful final connected/lint results. iOS/Functions
evidence is reused because this follow-up changes Android only.

### Normal-app backend composition — 2026-10-27

The maintainer authorizes this grouped integration after pushed `c56031f9`.
The existing coverage algorithm moves to one shared store with injected SDK
client and environment. Its fixed-demo wrapper retains project/port/registration
guards and owns its client cleanup. Shared composition rejects direct actor IDs;
queries, cases, effects, membership, credit-cancellation and spacing paths bind
the same environment. Independent review finds no reachable cross-environment
escape; remaining develop-only planner/publication helpers retain their guards.

New HTTP boundaries validate exact transport before Auth and reuse the existing
Admin clients and canonical error envelope. Access is a minimal projection, not
a future write permission. Every transaction, including replay, rechecks current
readiness and reciprocal account linkage. The private activation namespace is
bound to environment and supported policy, with an explicit offer bound and
ratification reference. Changing its digest or rebinding the account between
preflight and the transaction rejects without writing.

Both normal apps reuse their authenticated transport, existing coverage forms
and operation owner. UID, canonical member, environment and session authorization
are fenced before/after token acquisition, before transport and after response.
Normal routes reject impersonation and hide the entry until admission matches
that exact session. A closed gate or changed policy during an uncertain retry
preserves the original operation ID; it is not proof that the previous request
failed. `coverage_unavailable` remains uncertain, while the exact backend
`coverage_session_changed` / `coverage_environment_changed` codes invalidate
private context. No actor, roles or expected local policy field enters the wire.

Review additionally finds an Android legacy metadata-refresh path that replaces
the authenticated member without advancing its epoch. The coverage session now
copies typed roles and common-purchase responsibility; a same-epoch change clears
admission/forms/private state and rejects suspended old responses. No historical
Auth pipeline refactor is needed. iOS already increments its central revision on
the corresponding Member value changes; its SDK UID check also protects the gap
before UI Auth observers update. The new adapters retain no extra mutable policy
cache. Shared preview/form extraction avoids duplicating a workflow engine.

Functions final evidence (Node 22.23.4): full lint/build pass; **68 pure passes,
47 real local Auth/SDK passes, 174 workflows/Rules/publication passes** and
**295 planning passes/51 existing emulator-only skips**, all zero failures.
The SDK tests use the ordinary Admin Firestore client, not the registered local
store client, and isolate both namespace roots in the fixed demo project. They
cover exact commands/receipts, disabled/malformed policy, operational closure,
configuration drift, real Auth revocation and reciprocal rebinding during a
request. Logs: `/tmp/hu084-live-functions-{lint,build}-final.log` and
`/tmp/hu084-live-final-{pure,auth,workflow,planning}.log`. Owned emulators stop
cleanly and the task-owned dependency link is removed.

Android final evidence: **542 unit passes**, zero failures; final lint **zero
errors, 135 warnings and two hints**, with no findings in touched files and zero
Kotlin compiler warnings. On isolated Android 10/API 29, **27 instrumented passes
plus four existing opt-in assumption exits** (AGP XML encodes them as failures;
no assertion failures), Gradle successful. The final typed metadata equality
change repeats unit/lint and reuses that immediately preceding native run because
UI composition, layout, input and transport are unchanged. Two new Compose
acceptances exercise normal Turnos entry and forms through the real repository
and common client with an injected transport; they are not shared-cloud E2E.
`assembleDebugAndroidTest` additionally recompiles production/instrumentation and
packages the test APK against the final Session.Authorization constructor ABI,
with zero warnings or errors; no new device run is implied.
Evidence: `/tmp/hu084-live-android-summary.json`,
`/tmp/hu084-live-android-verified-final.log` and
`/tmp/hu084-live-android-metadata-final.log`, plus
`/tmp/hu084-live-android-test-apk-final.log`. Only task-created AVDs are removed;
the physical phone and main checkout remain untouched.

Independent iOS review closes session/policy/retry/SDK ownership, SwiftUI and
changed-source style findings. Four deterministic previews cover admitted/closed
states in Large/AX5; root visually checks all four. The actual renderer is iPhone
18 Pro Max/iOS 27.2, not the canonical test simulator. Six focused UI tests (four
smoke, two shared keyboard) pass. Catalogue cleanup preserves every previous key
and adds only `coverage.access_disabled`; project and scheme originals are
restored. The 47-file freeze (46 Swift plus catalogue) matches exactly. Final
canonical results and restoration are recorded below once that runner closes.
Preview/freeze manifests: `/tmp/hu084-live-ios-previews.json` and
`/tmp/hu084-live-ios-source-freeze.json`.

Read-only Firebase metadata inspection in `reguerta-9f27f` finds 19 deployed
functions and neither new endpoint. No shared Auth record, business document,
configuration, notification or deployment is changed. The exported composition
remains operationally closed in code: effect ownership versus ordinary events,
workbook leases, writer intake, real entropy and authoritative credit/membership
migration remain prerequisites. Existing provisional planner/publication guards
are not lifted. This prepares normal authenticated composition; it does not
establish deployed/physical shared coverage or parent HU-084 completion.

### Corrected canonical iOS result — 2026-10-27

The first definitive attempt records 956 total: 950 passed, five expected skips
and one architecture-test failure, with zero warning issues. The boundary test
correctly detects an `InactiveShiftCoverageRepository` construction inside
Presentation's closed preview. Replace that single unused dependency with the
existing `CoveragePreviewAccess` double; the nil-session preview does not read
either repository. Do not weaken the test or add another composition factory.
The existing closed-state renders remain applicable to that one-line substitution.

The corrected full runner then exits zero on stable Xcode 27.1 and iPhone 17/iOS
26.5, exact destination `091D93C1-5A53-40D0-887E-83F81A8E0326`: **956 total,
951 passed, five expected skips, zero failures**. Root, buildResult and
actionResult all contain zero compiler/analyzer warnings, runtime/test warnings,
errors and test failures; runtimeWarnings is empty. SwiftLint checks 528 files
with zero violations, all six target/configuration checks pass and both canonical
Debug/Release builds succeed. Parameterized executions are not added again to
the summary's test count. Skips remain the three rehearsal opt-ins, the conditional
launch/performance template and the Sheets-emulator opt-in.

All 538 protected inputs, five original configurations/resources and the updated
47-file freeze match exactly after restoration. The catalogue contains only the
new `coverage.access_disabled` key; no prior key changes. Private backups and owned
workspaces/processes are removed, while the three unrelated GUI workspaces remain
intact. No physical phone or shared service is modified.

Final artifacts: `/tmp/hu084-live-ios-corrected-release-gate.log`,
`/tmp/hu084-live-ios-corrected-release-gate.xcresult`,
`/tmp/hu084-live-ios-corrected-summary.json`,
`/tmp/hu084-live-ios-corrected-result-object.json`,
`/tmp/hu084-live-ios-corrected-issue-counts.json`, and
`/tmp/hu084-live-ios-corrected-cleanup.json`.
The earlier `/tmp/hu084-live-ios-final-*` result retains the diagnosed one-failure
attempt and is not the final accepted gate. The final source change is confined
to preview injection; Functions and Android evidence above remains unchanged.
## Shared Sheets/notification coordination — accepted locally, 2026-10-27

The preceding normal-app block is committed/pushed as `be3fde49`; its exact
remote hash matches. The next maintainer-authorized backend block is complete
locally and remains uncommitted/unpushed. Issue #268 stays open and PR #278 draft.

Coverage now records each effective public write, including completion without
a Sheets-cell delta, with immutable private receipt/outbox claims and a sidecar
bound to the exact server commit. The planner audit remains first; historical
coverage ownership suppresses ordinary Sheets and generic notices independently
of today's case/gate/worker state. Partial evidence fails closed. A later manual
body reapply remains ordinary. Retention is indefinite and backend-only; total
administrative deletion of all evidence remains outside the admitted contract.

Coverage, HU-083 sync/import and ordinary full/row/calendar exporters now share
`shiftPlanningState/sheetsSubmission`. Coverage reuses partition claim fencing;
ordinary sources load under the shared reservation. A public coverage transaction
cannot cross an active ordinary reservation, and ordinary export cannot overtake
pending/frozen coverage projection work. An actual SDK interleaving verifies this
command-to-worker boundary. Ordinary event export also rejects stale snapshots.

Possible Sheets batches are durable before I/O. Competing or expired invocations
cannot resubmit a recorded batch; matching read-back and a stable advanced Drive
version are required for coverage inbox release. Ambiguous outcomes freeze for
governed read-only recovery, keeping their pointer/leases. If readiness, source or
authority revocation prevents the freeze-state update, `pending` plus the durable
batch still cannot authorize resubmission; independent controls must account for
that retained uncertainty before proving drain. Recovery neither writes Sheets
nor resends push. One per-recipient coverage push owner follows inbox release;
no duplicate generic `notificationEvents` path is created. Factories inject SDK,
environment and authority; fixed-demo wrappers preserve their limits.

Ordinary exports preserve SDK-acknowledgement semantics and add stable Drive
version evidence for the shared chain; this is not exact-cell coverage read-back.
Their possible-send failures retain the reservation; proven pre-send failures
restore the predecessor. The first governed reservation also checks the partition
baseline when no earlier pointer exists. Inventory v3 adds coverage ingress,
effects and push; closed intake still needs independent actual-in-flight proof.
ADR-0019 records these contracts and their operational costs in both languages.

Final accepted evidence under Node 22.23.4:

- Functions build and lint: pass, zero diagnostics.
- Coverage/business/public-event/workbook pure suites: **75 passed**.
- Planning suite: **297 passed, 51 existing emulator-only skips**.
- Local Auth/SDK native/backend boundary suites: **47 passed**.
- Full coverage workflow/publication/Rules/coordination emulator gate: **204 passed**.
- HU-083 sync/import/consumer and legacy-trigger regression set: **108 passed**.
  Independent review then splits one helper-update/append fixture into two real
  initial states; the final trigger file repeats as **28 passed**, retaining the
  unchanged 81 sync/import/consumer passes. No repeated test is added twice.
- All accepted results have zero failures; diff-check is clean. New cases cover
  simultaneous writers, the command-to-worker gap, claim takeover, before/after-I/O
  crashes, lost Firestore acknowledgement, TTL, unknown outcomes, source/authority
  drift, manual conflicts, missing/corrupt ownership, environment isolation,
  closed access, inventory mismatch and Rules isolation.

The first implementation run finds three test setup/paused-snapshot problems
and one obsolete static fence assertion; these are corrected without weakening
business invariants. A first HU-083 invocation omits its mandatory demo project
environment and fails hooks before execution. The corrected invocation exposes
an old fixture that mocks Sheets but not the new Drive dependency: metadata reads
of the fictitious workbook identifier are rejected with Insufficient Permission.
Stop that attempt, add a default-throw Drive guard before importing the export,
and supply a mutation-driven version model. Review also separates the two helper
scenarios so an unversioned external edit is not hidden. The corrected gates pass;
the rejected reads establish no shared workbook access or provider validation.

Logs: `/tmp/hu084-coordination-{build,lint,pure,planning,workflow}-final.log`,
`/tmp/hu084-coordination-auth.log`, `/tmp/hu084-coordination-hu083-final.log`,
`/tmp/hu084-coordination-ordinary-trigger-final.log` and
`/tmp/hu084-coordination-event-final.log`. Summary/freeze:
`/tmp/hu084-sheets-notifications-coordination-summary.json`.

Android/iOS have no changes against `be3fde49`; accepted Android 542-unit/lint/
API-29 component evidence and iOS 951-pass/five-skip canonical evidence are reused
explicitly, without new native builds or physical claims. No parity gap is added.
Owned emulators and the exact task-created dependency symlink are removed; the
main checkout's unrelated files and both phones remain untouched.

The exported composition retains `operationalReady:false`. No shared-data write,
real push send, deployment, merge, issue closure or branch deletion occurs. Next:
prepare authoritative initial membership/reserve/credit migration and shared
destination/operator admission before proposing an authenticated shared rehearsal.
Real entropy, collective ratification and operational rollout remain parent gates.
## Initial coverage-state bootstrap — prepared and validated, 2026-10-27

Coordination is delivered as `fd225f35` with exact remote identity confirmed.
The maintainer authorizes the next initial-state preparation and explicitly
confirms zero outstanding initial credits and no known prior active reserves.
The new bootstrap source is implemented and validated locally, uncommitted and
unapplied to shared environments. Issue #268 remains open and PR #278 draft.

Canonical users and ordinary rotation/public-owner evidence in each environment
feed one deterministic bounded review plan. Complete encoded source sets and
update versions are digest-bound to the explicit decision. Missing private
membership observations and consistent missing ledger generations are create-only;
existing accounts, user flags, order, published dates/assignments and valid private
history remain unchanged. Current cohort members do not become new reserves.
Inactive legacy reserve history can remain without a fabricated admission frontier;
active or contradictory reserve evidence blocks instead. No manual-credit variant,
fake completion or inferred entitlement is introduced for the confirmed zero start.

The injected apply adapter reuses the existing trusted closed-intake barrier,
current reciprocal administrator, full source-set recapture/CAS and transaction
admission, including the two receipt writes. A source change or phantom, active
lease/work, conflicting plan/identity/environment/workbook, future cutoff or
existing initializer prevents a partial commit. One immutable receipt/current
pointer binds the atomic initialization; exact replay preserves later legitimate
membership and ledger changes. An uncertain Firestore acknowledgement resolves
only through its exact historical receipt. A failed final barrier read-back keeps
the committed baseline and proven incident; it cannot claim a clean retry.

Normal backend availability now additionally requires that matching immutable
bootstrap proof and includes its digest in the captured command fence. Missing,
rewritten, forged, cross-environment or replaced proof closes access; later ledger
changes do not invalidate historical initialization. The shared workbook summary
exposes its persisted environment for exact checks; legacy canonical schema-v1
has no such field and returns null rather than inventing it. Persisted/native wire
schemas remain unchanged and `operationalReady:false` remains explicit in index.

The offline CLI reads local snapshot/decision JSON, has no apply/project flag,
constructs no cloud client and produces a private create-only review artifact.
It refuses input/output replacement and returns a blocked plan with zero creates
for contradictions. English/Spanish ADR-0020 and operator guides explain the
same source, accounting and operational boundaries.

Accepted validation under Node 22.23.4:

- Functions final build/lint pass, zero diagnostics.
- Coverage/business/bootstrap pure suites: **103 passed**, including 28 focused
  planner/credit/CLI cases. CLI subprocess tests work with no credentials or server.
- Planning regressions: **297 passed, 51 existing emulator-only skips**.
- Full coverage workflows/publication/Rules/bootstrap SDK: **215 passed**.
- Full Auth/SDK native/backend boundary: **50 passed**.
- HU-083 sync/import/consumer/ordinary-trigger regressions: **109 passed**.
- Final focused bootstrap/live readiness SDK: **22 passed**, included in the
  corresponding full gates rather than added again. All accepted failures: zero.

Independent reviews close workbook/environment, authority, budget, immutable-proof
and stale-readiness findings. A focused valid release-lease vector covers both
rotations and all three states even after expiry. Initial type-narrowing diagnostics
and fixture errors are corrected before the final gates: a completed-helper fixture
needs canonical timestamp/helper evidence; an identical Firestore set can preserve
updateTime, so rewrite testing changes/restores actual data; in-flight rejection
requires a valid retained hold and later closed read-back to journal the incident.
No production barrier or business rule is weakened to satisfy these tests.

Evidence: `/tmp/hu084-bootstrap-{build,lint,pure,planning,workflow,auth,hu083}-final.log`,
`/tmp/hu084-bootstrap-focused-{pure,sdk}.log` and summary/source freeze
`/tmp/hu084-initial-state-bootstrap-summary.json`.

A separate **bounded read-only live check** through Firebase MCP verifies project
`reguerta-9f27f` and requests masked configuration fields at exactly four develop
paths: current/sourcePolicy under shiftPlanningState and delivery/market under
shiftRotations. All four return document-not-found. No user collection, production
path, workbook or Auth/business write is accessed. This proves a base-planner
readiness gap; it does not prove missing users or missing legacy published shifts.
Before shared application, prepare/review the canonical rotation baseline from
existing published history while retaining dates and order, then establish its
governed state through the existing HU-082/HU-083/HU-085 rollout boundary.

No Android/iOS source changes: reuse the accepted native gates (Android 542 units
and API 29/lint evidence, iOS 951 passes/five expected skips), without a new physical
or deployed claim and with no new parity gap. Owned emulators and the task dependency
symlink are removed after validation; main-checkout user changes remain intact.
No new deployment, notification, shared-data mutation, merge or parent closure.
The maintainer's two initial-state answers are recorded; no phone action is needed.

### Develop base content preparation — 2026-10-27

Initial-state source is committed/pushed as `537188bd`; remote HEAD is verified.
The next authorized preparation uses fresh bounded develop Firebase reads and
metadata-first, full bounded seasonal-grid reads through Google Drive. No shared
write, production access, permission change, deployment or notification occurs.

All 399 populated literal cells, 72 dates/108 ordered places and the corrected
48-user/32-eligible scenario match retained HU-083 evidence. Its approved synthetic
queue is reused without sorting or inferring original owners from assignees.
The private semantic proposal passes current validators for 72 canonical public
templates, coherent authority-template shape and 54-position consumption per
rotation (round 2/index 22). Runtime metadata is excluded from that proposal;
repeated preparation is byte-identical. The helper draft changes only 53 `F`
cells; the terminal helper stays null. Existing published assignments are retained.

Readiness remains explicitly blocked: 62 legacy payloads are not canonical,
all their server versions differ from September (only import/update metadata
changed), the 53 helpers are not yet visible, July/August 2027 market dates are
absent, all five planning-state paths are absent, and no real Drive version or
deployed writer/admission authority is available. The old 139-write reset is not
the new execution proposal. No full v2 cross-store audit is reported as passed.

Functions build/lint pass under Node 22.23.4; focused eligibility, contract/wire,
rotation and initial-state suites pass **47/47**, zero skips/failures. Detailed
scope, content/receipt digests and next governed operation are in
[the preparation report](develop-planner-base-preparation.md). No new platform
code or parity gap; prior Android/iOS evidence is reused without a new device run.

### Controlled develop migration/inverse rehearsal — 2026-10-27

The preceding preparation is delivered as `73001988`; this rehearsal remains
local after it. The user authorizes preparation and local rehearsal, preserving
published dates/order. No shared source/permission/deployment/notification action
or production read occurs. No new live endpoint or canonical parser exception is
introduced; the loopback-only resolver reuses the existing trusted barrier,
public transaction admission and notification writer fences.

Acceptance on `demo-reguerta-hu084-migration`/`127.0.0.1:8798` verifies:

- 203 forward writes archive 62 exact raw legacy images and promote the 72
  reviewed canonical rows; 140 inverse writes restore every original raw field,
  retain the operation/archive/retention and leave closed write epoch 2.
- The captured 48-user projections and four historical calendar sentinels remain
  unchanged, including service versions. Restored public service versions are
  newly assigned, while their timestamp field values are preserved.
- Source query/version/absence guards reject ABA, extra documents, changed
  eligibility, pending workbook reservation, mismatched scope revision, active
  notification fence and re-digested afterimage adoption. The immutable manifest
  and atomic commit version anchor read-back and inverse.
- Actual handlers persist 72 controlled activation and 72 recovery ledgers,
  including 36 first activation deliveries after reversal. Raw Sheets-origin
  retirements/restores are ordinary no-effect events. Google factories and the
  real FCM methods are trapped; no notification or credit effect occurs.
- Barrier/journal and real SDK commit-acknowledgement failures stay closed.
  Advancing the fixture clock seven days does not release the incident or
  resubmit the already committed forward.
- The real Sheets reader/adapter separately applies/reverses exactly 53 helper
  cells and retains technical markers. Its literal oracle does not confuse
  sparse fixture arrays or stale formatted values with product state.

Final accepted gates under Node 22.23.4: Functions build/lint; scoped CJS syntax
and undefined/unused checks; **8 pure + 62 existing-contract regressions + 15
portable SDK + one captured-data SDK + five Sheets = 91 passes**, zero skips or
failures. Independent review findings are fixed and the accepted run binds the
private input and runner hashes. Initial failures were fixture/assertion issues:
sparse-array comparison, replay-result shape and Firestore microsecond precision
in a synthetic extra-row oracle; no product rule is weakened to make them pass.

Evidence and exact receipt/runner digests are in the
[English](../../../docs/testing/hu084-develop-migration-rehearsal.md) and
[Spanish](../../../docs-es/testing/hu084-ensayo-migracion-develop.md) guides.
The actual Drive version, deployed indexes/admission, writer containment/drain,
post-drain backup and finite real application handoff remain open. The two
market gaps remain explicit; no annual readiness or cross-service atomicity is
claimed. Native sources are unchanged; previous native acceptance is reused
without a new physical test. Owned emulator/dependency cleanup follows the gate.


## Develop capture-control integration review — 2026-10-29

Previous preparation delivered as `51b9c514`; new implementation remains local.
ADR-0024 and the existing intake verifier require all four reviewed capture pairs,
complete source/configuration bindings, the explicit control-manifest approval and
separate zero causal/work counters. Production, partial routes, absent proof,
source/configuration drift, UNKNOWN counts and expired evidence are rejected.
Owner/admin freshness and withdrawal remain enforced. No new deployed export.

Validation: Functions build/lint, focused CJS lint;72 barrier/control/agreement tests,
60 preparation/bridge/census/migration regression tests and33 Firestore emulator
tests pass without skips. Initial creation preserves72 published dates/assignments
and both cursors; inverse restores62 exact legacy payloads and keeps closed higher-
epoch audit. Durable evidence and lost-ACK incidents survive a new service instance
and block unreviewed replay. Partial initial authority cannot be overwritten.
Actual multi-service observation composition, refreshed policy/workbook/cohort and
participant/window admission remain required; synthetic controls are not live proof.
No native behavior changed; native validation was not repeated.


## Real observation boundary review — 2026-10-29

Delivered `f7ef299a`; continuation remains local. Eight immutable archives and
initial/final Function configuration match; four actual capture proofs are produced.
The adapter exposes read ports only, validates fixed selectors before access, rejects
archive/configuration drift and stale queue observations, and never promotes sampled
zero or absent metrics to causal drain.73 joint tests and build/lint pass. Live checks
are read-only and preserve source data. Exact Rules, paused jobs, roster planning
fields and bounded sheet projections match. Shifts index response is unbound; numeric
workbook version is now freshly verified as259 before/after six-tab inspection.
The authorized single invocation returned HTTP200/canApply:false; only OIDC minting
was retried on403, within the original deadline. Both temporary grants were removed;
an independent IAM read confirms zero direct bindings and preserved prior policy.
No token was persisted, and no detailed ACL/owner inventory is inferred from the
reader response. This follow-up changes evidence/docs only; the73-test gate is reused.
Window stays NOT_READY,
with no human no-edit commitment requested and no automatic reopen/apply capability.

## Index and drain evidence review — 2026-10-29

The index authority is now measured from an exhausted database-wide inventory and
exact resource reads, not inferred from a wrong-scoped list. A real plan-only Explain
rejects both apps' latest-request query because its declared composite is absent.
A single-create packet compares the existing five indexes, records intent before
submission and cannot repeat an uncertain POST; user authorization remains pending.
The fresh census passes the existing inspector/reconciler with12 accepted canary
captures and no unmatched capture. Stale zeros on all eight subscriptions and100%
reviewed traffic on23 services are expressly insufficient for causal-drain admission.
No source/runtime change; documentation-only validation reuses the prior73-test gate
and checks diff hygiene. See bilingual queue/window guide for the finite residual.

## Authorized index acceptance — 2026-10-29

Exactly one create POST after explicit authorization and unchanged-baseline check.
The new index is READY with the declared fields and implicit descending name; five
old composites and all field overrides match. The initial post-READY plan returned
FAILED_PRECONDITION; a later read-only Explain returns200 and selects the exact new
index, with analyze:false and no documents returned. Updated configuration binding
is retained privately and in the bilingual guide. No full tests rerun for provider
configuration/evidence only; prior73-test/build/lint acceptance remains unchanged.
No other deployment or business mutation. Drain and maintenance admission remain open.

## Old-work boundary and proposed contract correction — 2026-10-29

Read-only runtime metadata gives 23 reviewed routes and284 RETIRED historical
revisions after normalized-ID exclusion of current revisions. It does not establish
external-call termination. The bilingual table covers exactly all31 current canonical
writer IDs, not the earlier26-item snapshot. Proposed ADR-0025 separates contained
transport from business work without coercing unknown/nonzero counts to zero or
weakening old-effect/production controls. It explicitly requires a source-set versus
delivery-history distinction before implementation. Accepted ADRs and runtime code
are unchanged. Documentation-only checks validate membership, local links and diff;
no new runtime tests claimed. Prior73-test/build/lint evidence remains reusable.
Policy decision and operational blockers remain open; no maintenance admission.

### ADR-0025 implementation acceptance — 2026-10-29

Maintainer explicitly accepted local implementation/rehearsal. Four control opt-ins
bind the new evidence alternative into the approved manifest. Eight-route nullable/
nonzero observations and source/core/history bindings cannot relax old business-work,
quiet business-effect, owner/admin or production checks. Offline census projection
preserves append-only captures and legacyUntracked; it never authorizes live entry.
Held receipt drift still stops progression instead of silently refreshing evidence.
174 local tests and37 emulator tests pass without skips, plus build/full lint and
focused CJS lint under Node22.23.4. Initial creation/inverse, late classified versus
unseen events, retained evidence and lost-ACK restart are covered. No native/shared
service change. Work remains local/uncommitted. Next resolve real old business effects
and automated authority before workbook/source-policy/window admission.

### Direct reminder admission correction prepared — 2026-10-29

ADR-0025/observations are delivered as `5f648963398d2e600f70129bc8fdec19317b77aa`.
Read-only authority inspection found that all three PAUSED reminder jobs still target
ACTIVE, directly invocable original develop callbacks. The existing source preparer
now wraps those three callbacks, preserving original production-only behavior and
rejecting whole develop/mixed target sets before data access. New work remains local.
Build/full lint/focused CJS lint,15 local and24 emulator tests pass without skips.
The exact reviewed ZIP and build-source-only update plan preserve all jobs PAUSED,
all other21 Functions, runtime configuration and IAM; no live invocation is proposed.
Deployment requires explicit approval. It closes new admission, not old-call or
external-effect uncertainty. All117 notices remain unreplayed, legacyUntracked stays
true and live maintenance/migration stays NOT_READY. No native changes/parity gap.
See the bilingual `docs/testing/hu084-develop-old-work-boundary.md` guide for package
hashes, preflight/readback requirements and stopping rules.

### Authorized reminder closure deployed — 2026-10-29

The maintainer explicitly authorized the three reminder Function updates in
`reguerta-9f27f`. Sequential build-source-only patches completed and exact source
ZIP/readiness/traffic were verified for all three. Jobs remain PAUSED; effective
runtime configuration/IAM and all other 21 Functions are unchanged. Provider-added
identity metadata is checked against exact function/region values. No Function was
invoked; no business data, Sheets or FCM was written. Private operation/readback
records retain the result; bilingual old-work-boundary guide records revisions and
reconciled preparation incidents. Reuse the unchanged 15 local/24 emulator tests and
build/lint; this turn adds real deployment verification and negative verifier checks.
Code/docs remain uncommitted after `5f648963`. Old work/automated authority and
workbook/window evidence remain open; no replay or maintenance/migration admission.

### Post-reminder effects reconciliation — 2026-10-29

Reminder closure delivered/pushed as `34aa7aaec1b9ddcd44b970b540ec700a4f4e80c1`.
Read-only reconciliation joins12 recent FCM attempt terminals to exact traces,
reviewed revisions and matching Firestore summaries: six token sends reported successful/six
failed by the SDK, without claiming device receipt, non-delivery or replay safety. Three62-row imports
and five probe exits have matching HTTP200s. Current183 sources/12 captures/16
recorded deliveries and six inspected Sheets ranges (742 typed values) are unchanged.
Five negative correlation checks pass; reuse unchanged application acceptance.
The105 older notices are unreplayable/unverifiable history, not a pending-send count.
Stop repeating expired-log searches; next bind actual automated credential/destination
and workbook-writer authority to old-work completion or effective isolation. Keep
legacyUntracked and maintenance/migration NOT_READY. New documentation remains local;
no cloud mutation, production data access or native change. See bilingual legacy-
reconciliation guide for exact bounds, evidence and limitations.

### Effective writer authority reviewed — 2026-10-29

Prior reconciliation delivered/pushed as `713c09020b46d0317399a1dd3fb0d60f8e952286`.
Owner-side metadata identifies one owner, two service-account writers and one inspector
reader on the develop workbook; parent My Drive shows only its owner. Compute runs23
of24 Functions; SDK is a file writer without a Function runtime assignment. All24
source/runtime bindings remain unchanged. Four reviewed accounts have no USER_MANAGED
keys but project delegation/data authority persists. Three jobs PAUSED; no extra Run
service/job in europe-west1, no Build triggers in global/europe-west1, no App Engine
services. Compute inventory is unknown because its API is disabled; no API enabled.
Prepared exact-file writer-to-reader changes for the two service accounts, preserving
production/IAM/owner/inspector. Not authorized/applied; exact permission IDs and fresh
reversible readback are required before mutation. Two human project owners identified
privately for the later window. No source/platform change; docs checks only. New docs
local; maintenance NOT_READY. See bilingual develop-writer-controls guide.

### Exact develop ACL acquired; mutation not authorized — 2026-10-29

Authority review delivered in `048497d2`. Separately authorized Online metadata-only
OAuth reads return complete file/parent permission lists, capturing IDs and original
records for both direct service-account writer grants. Preserve the inspector and
the named owner's direct ownership/inherited writer detail; parent has only owner.
Private plan contains exactly two sequential role-only changes plus conditional
recovery, fresh whole-ACL drift checks and unknown/partial-result handling. No ACL
mutation, production access or admission. Read-only acquisition does not establish
effective write fencing. Manifest/document checks replace unrelated builds; no
native change or parity gap. See bilingual develop writer-controls guides.

Cleanup: temporary Playground connection removed; original session token denied401
on the same parent request, no refresh token issued, credential fields cleared.
Exact two-target manifest validation and bilingual diff checks pass.

### Develop service writers demoted and effective denial observed — 2026-10-29

Permission preparation delivered as `25ed6f63`. Authorized owner UI changes demote
exactly the two direct service writers to reader, with exact pre/intermediate ACL
comparison and owner-side final four-entry role readback. Both same-token controls
move from valid identical-header batch200 to read200/canEdit=false/write403;742 values
across six ranges remain equal. Drive metadata advances; no full-history claim.
Raw ACL enumeration becomes forbidden to the readers; final owner metadata is
normalized, preserving the stated observation limit. No recovery needed.
Account-scoped temporary IAM grants are removed before role changes; all attempts
retain the original expiry. Propagation retries issued three short Drive tokens
(two Compute, one SDK), with no stored credentials; no current getAccessToken grant.
Private evidence and bilingual guide capture the exact scope. No app change or
parity gap; provider/document checks only. No production data, deployment or push.
Maintenance stays NOT_READY pending integration with old-work/source/window evidence.

Final token cleanup verified: both original successful tokens now return401
UNAUTHENTICATED after expiry. Earlier token expiry precedes them; credentials are
discarded and the owned probe process closed. Original empty account policies
restored, evidence assertions and documentation diff pass. New docs remain local.


### Fenced maintenance preparation — 2026-10-29

Fence evidence delivered/pushed as `e6d02cc2`. Local offline preparation joins the
two-account probe/credential cleanup to normalized owner roles and validated old/current
censuses without producing barrier admission or zero work counts. The real packet
matches183 sources/12 captures/16 deliveries, all24 Function bindings, three PAUSED
jobs and742 typed workbook values. The connector metadata timestamp regresses versus
the direct probe and has no raw version; this is an explicit remaining gate.
114 focused tests (19 new), Functions build/lint pass. No native change/parity gap,
cloud mutation, production-data access or renewed impersonation. Local code/docs remain
uncommitted. Next resolve prior external-call completion/isolation and complete automatic
writer authority, then fresh consistent workbook/control evidence and owner/admin window
agreements. Do not reinterpret retained historical notices as pending sends or revisit
expired logs. Maintenance/migration remain NOT_READY; see bilingual writer-controls guide.


### Old containers retired; owner isolation prepared — 2026-10-29

Previous preparation delivered as `9f01bae8`. Provider-bound inspection confirms288
old revisions across24 services are RETIRED, current traffic100% with no tags and
stable service readbacks. Added15 tests;129 focused tests/build/lint pass. This closes
old-container execution only; previously submitted effects and other writers remain
independent. Owner OAuth grants include broad Sheets/Drive write access; the known
test account's Google UI reports no linked apps. Prepared transfer of only the same
develop file to that account, demotion of the former owner to reader, parent-inheritance
check, connector probe/value comparison and conditional reverse-transfer recovery.
No ownership/permission change authorized or performed yet. New code/docs local;
maintenance/migration NOT_READY. See bilingual writer-controls guide for scope.


### Owner isolation executed with authorization — 2026-10-29

The exact develop workbook transfer was accepted by the test account; the former
owner is now a reader alongside the three service readers, with restricted sharing.
Same-value Fecha/A1 connector write succeeded before and returns 403 PERMISSION_DENIED
after; reads remain available and all 742 typed values across six ranges are unchanged.
No move was necessary for the observed denial. Parent/permission metadata is now
unavailable to the reader connector; do not fabricate a parent ACL or refresh the
historical owner API record. The preparation binds current UI/probe evidence separately.
141 focused tests/build/lint pass; actual combined evidence remains NOT_READY with
unknown prior effects/other writers and explicit current-parent/version/control gates.
No new OAuth/IAM, global revocation, deployment, FCM or production change. No native
parity gap. New changes remain local after `9f01bae8`. See bilingual writer-controls guide
and private `2026-10-29-develop-owner-transfer` evidence. Next complete remaining automatic
authority/prior effects before a bounded agreed window; HU-084/HU-085 and draft PR #278
remain open. Recovery would require reverse transfer and acceptance.


### Remaining access/effects audit — 2026-10-29

`b69dcf5b` delivered and remote verified. Fresh provider inventory confirms only 24
reviewed Run services globally, no Run jobs/worker pools/instances, three paused
Scheduler jobs, no Build triggers/active builds across 44 locations, nine keyless
service accounts and unchanged project IAM/Rules. Census remains 183 sources plus
12 captures/16 deliveries. Two known calendar probes have exact HTTP 200 terminals
and no Sheets/notice effects. No global old-effect closure is inferred.
The maintainer identifies the existing apps/Functions using `collections`, distinct
from `plus-collections`. Both use the same project; current develop Rules cover both
namespaces and legacy HTTP endpoints are shared. This identifies known callers, not
an exhaustive external-credential inventory. The 105 older notices remain unreplayed
history and residual effects still block admission.
No cloud mutation or production-data read. This audit is documentation only; prior 141 tests/
build/lint reused unchanged. See bilingual writer-controls guide for finite next
steps and private 2026-10-29-remaining-authority-effects evidence. No native parity gap.
