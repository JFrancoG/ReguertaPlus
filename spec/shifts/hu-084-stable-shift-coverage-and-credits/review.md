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
| 23 — equivalent native member/admin states | Shared wire fixtures, Android client/operation tests, Swift client/rehearsal tests; local role/cancel and earlier accept/credit journeys | Bounded physical accessibility, API 29 and native notification matrix complete through 2026-10-04 below; live authenticated coverage composition remains separate |
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

## Manual validation matrix — current through 2026-10-04

| Check | Available means / exact limit | Disposition |
| --- | --- | --- |
| Android API 29 | New AVD `Pixel_4_A10_API_29`, `emulator-5554`; runtime properties confirm Android 10 / SDK 29 | Passed on 2026-09-28: 25 connected tests, zero failures/errors/skips, including both opt-in HU-084 role/cancellation journeys at font scale 2 |
| Physical VoiceOver | iPhone 11, isolated offline sample and maintainer interaction | Passed on 2026-09-28: reading, case/action navigation, cancellation focus restoration, maximum-text readability and standard-size picker; detailed evidence below |
| Physical TalkBack | Xiaomi Android 14, isolated local rehearsal and maintainer interaction | Passed on 2026-09-28: guided reading/navigation and cancellation; maximum-text and keyboard-visible Back recheck also passed, as detailed below |
| Android notification tray | Cold/warm activity Intents already passed; shell tray injection previously failed on PendingIntent UID permission | App-owned Debug injection prepared on 2026-09-28; all three guided local tray variants confirmed by maintainer on API 29: login, signed-in re-entry and cold-process login; real FCM remains separate |
| iOS cold-process notification open | Warm simulated Notification Center taps passed previously; OS cold start drops rehearsal launch flags | Passed on 2026-09-28: maintainer confirms tray-to-login-to-market on iPhone 17/iOS 27.0 after process termination; temporary preference removed afterward |
| Real APNs/FCM | Debug-only real transport opens an in-memory sample; local injection remains separate evidence | Passed on 2026-10-04 on iPhone 11 and Xiaomi Android 14: foreground, background and process closed, with maintainer-confirmed receipt/opening; cleanup verified on both |

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
