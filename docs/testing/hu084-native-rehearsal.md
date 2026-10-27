# HU-084 native local rehearsal

This Debug-only route uses memory-only Auth emulator credentials and the provisional
coverage API. It never enters the normal Firebase login graph. The provisional
policy, entropy provider and production activation remain separate decisions.

From `functions`, with dependencies and a compatible Java runtime installed:

```sh
npm run build
firebase emulators:exec --config ../firebase.coverage-emulator.json \
  --project demo-reguerta-hu084-coverage --only firestore,auth \
  'GCLOUD_PROJECT=demo-reguerta-hu084-coverage METADATA_SERVER_DETECTION=none node test/shift-coverage-native-rehearsal.cjs'
```

The fixture resets only `develop/plus-collections` and Auth accounts inside the
fixed demo emulators (Firestore 8798, Auth 9098). The API binds to 127.0.0.1:8799.
Virtual time is 2027-09-02 10:00 UTC. Stop the command to close the local services.
Restarting rebuilds the fixture, so keep this rehearsal separate from other tests.

Launch the iOS Debug app with `-coverageRehearsal`, or launch Android Debug on an
emulator with:

```sh
adb -s EMULATOR_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity
```

Android uses a separate `:coverage_rehearsal` process, with no default-process
FirebaseInitProvider or MainActivity composition. Cleartext is allowed only for
127.0.0.1 and Android's emulator host alias 10.0.2.2. iOS uses the existing test
composition with remote push registration disabled. Neither route is registered in Release.

All fixture accounts use `local-fixture-password`:

- `d@example.test`: open the generic notification, inspect **Market**, accept the offer and inspect read-back.
- `admin@example.test`: open **Delivery**, confirm that coverage was completed.
- `e@example.test`: inspect the resulting pending delivery credit.
- `a@example.test`: original assigned member, available for absence forms.

The route also renders volunteer/reserve/draw/admin states when supplied by the
local API. The fixture does not configure an entropy provider. iOS edits an offer
expiry as a date/time; Android edits minutes from the form's reference time. Both
validate against the server policy and revalidate the current deadline before
sending. Shift dates are shown without implying a service time.

Unsigned credentials are accepted only for the fixed Auth emulator project and
captured UID; the server verifies identity and canonical membership again. Tokens
are never persisted or logged, and expiry/revocation requires signing in again.
Unknown command outcomes retain the exact operation for explicit retry; new
mutations remain disabled. The backend owns eligibility, conflicts and credits.

The read model includes future assigned slots (maximum 500), minimal member names
and admin-only eligibility hints (maximum 500 members), including an inactive owner
still assigned to a future slot. It does not expose private selection snapshots,
exclusions, Auth UIDs, emails or another member's credit.

The iOS acceptance test is explicitly opt-in, while the services above are ready:

```sh
TEST_RUNNER_COVERAGE_REHEARSAL=1 xcodebuild test \
  -project Reguerta.xcodeproj -scheme Reguerta -testPlan release-gate-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:ReguertaUITests/CoverageRehearsalUITests \
  -parallel-testing-enabled NO
```

Run from `ios/Reguerta`. Recreate the fixture before repeating the acceptance test.
The test skips in ordinary gates. The effects are verified against the simulated
workbook and local inbox only; live deployment remains outside this rehearsal.
The bounded manual device, layout and accessibility matrix is complete as of
2026-10-04; results and limits are recorded in [review.md](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md).

After completing delivery as admin, run the AX5 credit read test separately with
`TEST_RUNNER_COVERAGE_CREDIT_REHEARSAL=1` and
`-only-testing:ReguertaUITests/CoverageRehearsalUITests/testLocalEarnedCreditAtAccessibilitySize`.
It requires the completed-delivery state and skips unless explicitly selected by
that environment flag. It records a persistent screenshot in the result bundle.

## Coverage effects rehearsal

`npm run test:shift-coverage:emulator` now includes the command-to-Sheets-to-inbox
integration. It uses only the fixed Firestore demo and the existing in-memory
Sheets API fixture (`coverage-rehearsal-book`). The native fixture also drains each new effect automatically through this same
worker, after seeding the readable workbook. It never connects to a shared workbook.

Every successful new command writes a private `shiftCoverageEffects` record in the
same transaction as its receipt, assignment and any earned credit. The receipt
binds its digest. The fixed-demo worker reuses the HU-083 importer, identity resolver,
exact-cell adapter and read-back marker, plus the existing generic notification
copy and inbox builder. It preserves rotation owners and historical backend markers.
Only changed assignment/helper projections require a Sheet write; completion alone
never rewrites a Sheet or awards another credit.

Acceptance projects the effective lead and prospective predecessor helper across
season tabs, or one member in the existing four-row market block. Notes, formulas
and formatting survive; a conflicting manual assignee/helper or ambiguous name stops
before submission. Readable round-trip imports retain the same effective members.
No coverage reason, candidate evidence or credit fields are added to the workbook.

A private workbook reservation serializes different projection operations. Before
external mutation and inbox release, the worker checks writer authority, the exact
case revision and the complete bounded source snapshot (at most 500 documents in
each of shifts, users and deliveryCalendar). Persisted submissions bind document
update times and exact human before/after images. Unknown acknowledgements retain
that submission and reservation: verified read-back resumes without another write.
Source drift stops recovery rather than replacing the pending submission. A
pre-submission conflict releases its reservation; an uncertain submitted operation
requires explicit reconciliation before another operation can use the workbook.

Generic per-recipient inbox records are created atomically with effect completion
only after verified projection; inactive recipients are skipped. Offers are checked
for expiry/supersession. Replays and concurrent drains cannot duplicate inbox
records. No `notificationEvents` fan-out event or FCM send is created. The private
effect keeps case/revision references. Real dispatch and governed shared-workbook
recovery/activation remain pending. The simulated dispatcher below now consumes these inbox references.
The rehearsal reservation is not a production distributed lock across all writers.

## Open an authenticated notification

Both native routes list generic notices from the signed-in member's local inbox.
Opening a notice sends only its opaque event ID. The backend checks the recipient,
completed effect and bound command receipt, then returns the current minimal case
projection. An affected delivery helper or market companion can inspect that case
without gaining administrative reasons, credit evidence or new mutation privileges.
A copied event ID does not grant another member access; inactive sessions are denied.

An old offer notice opens the current accepted/resolved state and never repeats its
old action. Refresh retains the verified notification scope. Back reloads the full
list, including when a request is still pending; an uncertain command stays available
for explicit retry and is never replayed by navigation. Session changes discard late
responses and navigation intent.

The fixture includes a further delivery vacancy on 2027-09-08 to check that Back
restores more than the single notification case. iOS acceptance exercises Back both
before and after market acceptance. Delivery notices can be inspected as `e@example.test`.
The fixture reports completed effect IDs and simulated workbook batch counts, without
tokens or personal data. This list is local rehearsal navigation, not OS push dispatch.

## Role and large-text acceptance

Keep the fixed demo fixture running. These scenarios open and cancel confirmation
forms without accepting or completing a case; they can share the unchanged fixture.
They check member/admin action differences, return to the full list and fresh server
read-back after cancellation. They do not certify VoiceOver or TalkBack interaction.

Android uses the real local Auth/HTTP adapter and production Compose screens with
font scale 2. Select an emulator explicitly so Gradle cannot include a connected phone:

```sh
ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.reguerta.user.presentation.shiftcoverage.CoverageRehearsalAcceptanceTest \
  -Pandroid.testInstrumentationRunnerArguments.hu084Acceptance=true
```

Run from `android/Reguerta`, replacing the serial with the emulator shown by `adb devices`.
Without the opt-in argument the two tests skip. The full suite can include them with
the same opt-in argument; the unrelated HU-083 test needs its own fixture or exclusion.

From `ios/Reguerta`, run the Spanish AX5 role journey on a phone or iPad:

```sh
TEST_RUNNER_COVERAGE_LAYOUT_REHEARSAL=1 xcodebuild test \
  -project Reguerta.xcodeproj -scheme Reguerta -testPlan release-gate-v1 \
  -destination 'platform=iOS Simulator,name=iPhone SE (3rd generation),OS=26.5' \
  -only-testing:ReguertaUITests/CoverageRehearsalLayoutUITests \
  -parallel-testing-enabled NO
```

For landscape iPad also set `TEST_RUNNER_COVERAGE_LANDSCAPE=1` and select its exact
destination. The test restores the previous orientation and retains three screenshots
in the xcresult bundle: admin confirmation, replacement detail and member offer.
The ordinary release gate skips this opt-in journey. A fresh fixture is required
before the separate mutating market-acceptance journey described above.

### Recorded local matrix — 2026-09-13

| Environment | Result |
| --- | --- |
| Android unit / lint | 501 tests pass; 137 unrelated baseline lint findings, none in shiftcoverage |
| Pixel 8 Pro + Small Phone / API 35 | 25 connected tests pass on each, including both opt-in font-scale-2 journeys |
| iPhone 17 / iOS 26.5 | Full release gate: 917 pass, five expected skips; Debug/Release and SwiftLint pass |
| iPhone SE (3rd generation) / iOS 26.5 | Spanish AX5 role/cancellation journey passes |
| iPad mini (A17 Pro), landscape / iOS 26.5 | Spanish AX5 role/cancellation journey passes |

The full Android suite excludes the independent HU-083 fixture test. The iOS skips
are three HU-084 opt-in journeys, one HU-083 opt-in journey and the conditional
launch/performance test. The native navigation titles abbreviate on the SE and admin iPad sheet at AX5;
body content and actions remain reachable by scrolling. This evidence covers local
simulator/emulator behavior. Physical VoiceOver/TalkBack and API 29 acceptance,
real OS push delivery and live/shared-writer activation remain open.

## Simulated push submission and OS opening

The native fixture now runs the coverage dispatcher through the existing generic
Messaging transport interface, injecting fake destinations and an accepted SDK
result. It logs `Local push payload` with only `eventId`, `type` and `target`.
No real FCM/APNs call or destination lookup occurs. Six seed submissions have durable
per-recipient receipts beneath `shiftCoverageEffects/{operationId}/pushes/{memberId}`.
Repeated drains return the original receipt, including after current case/destination
changes. A submitting/unknown result requires governed reconciliation; it is never
resent automatically. Raw tokens are not persisted. Generic text contains no case,
member or administrative reason. APNs collapse keys are 64 bytes, while the opaque
coverage event ID is preserved in data.

For iOS, launch the Debug app with both `-coverageRehearsal` and
`-coveragePushRehearsal`. Allow notifications on the owned simulator. The additional
flag requests only local notification authorization: Firebase composition and
remote registration remain disabled. Keep the app process running; a cold OS launch
does not preserve these command-line rehearsal flags. Copy the current market-offer
payload for recipient `d` from the fixed fixture and add the APNs alert envelope:

```json
{
  "eventId": "COPY_CURRENT_COVERAGE_EVENT_ID",
  "type": "shift_updated",
  "target": "users",
  "aps": {
    "alert": {"title": "Turnos actualizados", "body": "Consulta la aplicación para ver la información actualizada."},
    "sound": "default"
  }
}
```

Save as a temporary `.apns` file and run:

```sh
xcrun simctl push SIMULATOR_UDID com.plusprojects.Reguerta.debug /tmp/coverage.apns
```

Open the actual Notification Center notice, then sign in as `d@example.test`.
The offer detail should appear without choosing an inbox row. Repeat while that
detail is open: it must remain on the same case. Do not accept/decline for this
read-only journey. The callback copies a typed reference and completes on MainActor,
including rejected payloads, because UIKit performs scene restoration in completion.
The simulated system tap exposed and now verifies the fix for that main-thread crash.

For Android, verify the equivalent entrypoint with the current opaque event ID:

```sh
adb -s EMULATOR_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity \
  --es eventId CURRENT_COVERAGE_EVENT_ID --es type shift_updated --es target users
```

Run before login and again with the activity on top. `singleTop` delivers the latter
through `onNewIntent`. Pending opening waits for authentication and any draft or
uncertain command; logout discards it and late reads. Live routes do not forward
coverage events to the seasonal-planning detail. Android shell notification posting
was rejected by OS permission checks, so those Intent checks do not prove tray taps.

### Push-block evidence — 2026-09-13

- Functions: lint/build, 45 coverage units and 108 emulator/Rules scenarios pass.
- Android: 502 units, lint and 25 connected tests pass on Pixel 8 Pro/API 35;
  cold/warm activity Intent journeys open the offered September 4 market case.
- iOS: 908 fast-unit passes/one existing opt-in skip, four UI-smoke passes, and
  18 final focused tests (19 parameterized executions) pass on iPhone 17/iOS 26.5.
  Xcode MCP build and final SwiftLint pass with no warnings/violations. The earlier
  full release-gate table applies to committed native acceptance (`3dcc84c`).
- iPhone SE/iOS 26.5: actual simulated system taps before login and with detail open
  both retain the correct offer, without crashing or navigating back to overview.
- Recursive local read-back: 51 documents, six accepted simulated push receipts,
  three unchanged case states/revisions, zero credits. No coverage action was sent.

Local evidence: `/tmp/hu084-push-ios-system-tap.json`,
`/tmp/hu084-push-ios-repeat-tap.json`, `/tmp/hu084-push-callback-focused.xcresult`,
`/tmp/hu084-push-firestore-after.json`, and backend/Android result logs. This is not
physical-device, real FCM/APNs, iOS cold-process or Android notification-tray evidence.
Live destination admission, uncertain-result/shared-writer recovery, entropy-provider
selection, assembly ratification and HU-085 remain pending.

## Governed recovery rehearsal

The recovery adapter operates only in the fixed demo project/workbook. It has no
HTTP endpoint or live control-plane implementation. `inspect(operationId, actorId)`
provides the source-version digest to the trusted operator harness; it does not
create authority. The harness must already hold closed maintenance and backend
permission to persist the exact authorization under:

`shiftCoverageEffects/{operationId}/recoveryAuthorizations/{recoveryId}`

The exact fields are `schemaVersion: 1`, `actorId`, `evidenceDigest`, and `scope`.
The scope is HU-082's complete closed-barrier binding; its authoritative digest
binds this coverage source snapshot, and it names the fixed workbook and current
maintenance revision/epoch/lineage. The control plane must durably fence and drain
all affected writers, including coverage workers and external editors, and return
the matching held checkpoint before and after recovery. Neither closed Firestore
maintenance nor waiting for a timeout replaces that evidence. There is no reopen
method. Real controls/allowlist issuance remain HU-085 work.

`reconcile(operationId, recoveryId, actorId)` rechecks the authorization and source
inside its commit transaction. It only reads Sheets and never submits push.

| Observed outcome | Recovery behavior |
| --- | --- |
| Pending effect, verified projection and current canonical assignments | Complete effect, atomically release generic inbox and remove its reservation |
| Superseded or expired notice with no outstanding projection | Retire effect without releasing the old notice |
| Missing/mismatched projection or changed canonical assignments | Keep pending effect and reservation; retain closed-barrier incident |
| Interrupted push submission | Keep its attempt/destination evidence and mark unknown; no resend |
| Accepted/failed/unknown push or no recorded submission | Preserve outcome; list unsent recipients separately; no resend |
| Final barrier verification fails after commit | Keep recovery receipt and incident; retry does not claim clean completion |

The immutable result is under `shiftCoverageEffects/{operationId}/recoveries/{recoveryId}`.
Authorizations and results remain backend-only, even for authenticated app admins.
Replays do not rewrite case/credit/assignment history, re-open writers or renew the
original effect's writer authority. Inbox release is not FCM/APNs admission under a
new epoch. A mismatched workbook requires a separate reviewed repair, not overwriting
cells through this recovery path.

Run the existing `npm run test:shift-coverage:emulator` from `functions` with no native
fixture running. The suite includes 14 recovery scenarios with a stateful Sheets fake
and a simulated trusted control plane. The 2026-09-13 run passes all 122 emulator/Rules
scenarios; 86 coverage/barrier/reconciliation units and Functions lint/build also pass.
No Android/iOS code changed in this block. Those tests prove local behavior, not live
multi-service fencing or delivery. See the current plan for the remaining acceptance
and HU-085 boundaries.

## Final branch review — 2026-09-13

The current criterion/evidence matrix is
`spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md`. Functions lint/build,
420 regression tests, 122 coverage Firestore/Rules tests and 22 Auth/HTTP tests pass
(51 other-emulator cases explicitly skip in the regression run). Android passes
502 units and 25 connected tests on Pixel 8 Pro/API 35; lint retains 135 baseline
warnings and two hints, none on changed lines. iOS passes the canonical release
gate with 919 passed/five expected skipped/zero failed on iPhone 17/iOS 26.5,
SwiftLint zero violations across 509 files and closed build summary zero warnings.
Xcode MCP also builds Release/iphoneos; its raw log retains an AppIntents metadata
extraction warning, documented separately from compiler diagnostics.

Only new Swift layout and stale status text changed during review. At that date, manual VoiceOver,
TalkBack, genuine API29, Android tray, iOS cold-process and real APNs/FCM remained
unverified. `Pixel_4_A12_API29` misleadingly uses an API31 image; there was no installed
API29 image (resolved by the follow-up below). The next step is that bounded manual/device matrix. This review does
not close #268, ratify policy or authorize activation. Temporary demo configuration
and owned Firebase services were cleaned up.

## Android 10 / API 29 acceptance — 2026-09-28

The new AVD `Pixel_4_A10_API_29` is independently verified at runtime as Android 10,
SDK 29. The full connected suite passes 25 tests, zero failures/errors/skips,
including both opt-in HU-084 member/admin role and cancellation journeys at font
scale 2 using the local Auth/Firestore/HTTP fixture. The unrelated HU-083 fixture
journey is excluded. No Android source changes were needed. Reproduction and logs
are recorded in `spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md`.

API 29 local acceptance is now complete. Physical VoiceOver/TalkBack, Android tray,
iOS cold-process notification opening and real APNs/FCM remain pending. The run
used synthetic demo configuration; temporary configuration and owned local Firebase
services are removed/stopped afterward. Production and the physical phone are untouched.

The dependency update in `a50ec52` was also validated on API 29: 502 unit tests
and 25 connected tests pass; lint retains 135 existing warnings and two hints.
The maintainer authorized commit/push of this review checkpoint on 2026-09-28;
the remaining manual checks stay open.


## App-owned Android tray notice — prepared 2026-09-28

Debug `CoverageRehearsalActivity` accepts `coveragePostNotification=true` together
with the existing validated coverage payload. It posts a generic local notice from
the app UID with an immutable, event-specific activity PendingIntent. Posting does
not select the case: only the tray tap forwards the reference to the rehearsal model.
Both the code and translated notice resources live in `src/debug`. On API 33+ the
app must already have notification permission; disabled notifications are not posted.

With the demo fixture running and the current offer event for `d@example.test`:

```sh
adb -s EMULATOR_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity \
  --es eventId CURRENT_COVERAGE_EVENT_ID --es type shift_updated --es target users \
  --ez coveragePostNotification true
```

Return Home, open the notification shade, tap the notice and sign in as
`d@example.test` / `local-fixture-password`. The September 4, 2027 market offer must
open without selecting an inbox row. Do not accept or decline. Repeat while signed
in, then with the background rehearsal process killed (not force-stopped, which
removes notifications). Record each observed outcome before marking tray acceptance.

Preparation passes 502 unit tests, lint with the existing 135 warnings/two hints,
and 25 connected API 29 tests. The system confirms the posted app-owned notice;
human tray-tap and cold-process results remain pending. This is local OS opening,
not real FCM delivery. The demo fixture stays running for the guided test.


### Guided tray check: login route — 2026-09-28

The maintainer followed the notification-tap/login steps and supplied screenshot
`Captura de pantalla 2026-09-28 a las 15.32.46.png`: the Market detail shows
September 4, 2027, Awaiting response, and demo member d, with accept/decline actions.
This confirms the first guided tray-to-login-to-offer journey. No acceptance or
rejection was requested. A second notice is prepared with the existing authenticated
process for the warm re-entry check; that result and cold-process opening remain
pending. Screenshot evidence does not certify real FCM delivery or TalkBack.


### Guided tray check: authenticated re-entry — 2026-09-28

The maintainer confirms that tapping the second notice while signed in keeps the
same offer open without another login or errors. Warm re-entry passes. A new notice
was posted, the app backgrounded and `am kill com.reguerta.user.debug` executed
once background killing became eligible. The rehearsal PID is verified absent
while the notice remains in the system tray. Cold-process tap and subsequent login
are prepared, with user observation pending.


### Guided tray check: cold process — 2026-09-28

The maintainer confirms that tapping the surviving notice after process termination
asks for login again and directly opens the same September 4, 2027 market offer
without errors. The new rehearsal PID differs from the terminated process.
All three Android tray variants now pass: unauthenticated login, authenticated
re-entry and cold-process login. Physical TalkBack and real FCM delivery remain open.


## Simulator-only cold-launch route — 2026-09-28

Debug simulator builds may read the explicit `coverageColdLaunchRehearsal` Boolean
from the app's own preferences. It selects the same local rehearsal composition and
local notification authorization as the two existing launch flags, even when iOS
launches from a notice without arguments. Release builds omit the branch; physical
Debug builds ignore this preference. The app never sets it automatically.

For a guided cold test, install Debug on the selected simulator, stop its process,
and set that single preference in its data container before launching without flags.
After notification permission is granted, inject the current fixture payload with
`simctl push`, terminate the app with `simctl terminate`, and tap the notice. Login
must resolve the original offered market case. This remains a simulated notification
transport, not APNs delivery. Remove only `coverageColdLaunchRehearsal` from that
same simulator app's preferences after the guided tests and terminate the app.


### Guided iOS cold opening: passed — 2026-09-28

After reopening the iPhone 17/iOS 27.0 simulator window, the maintainer confirms
that the pending system notice opens the isolated login and then directly resolves
the offered September 4, 2027 market case without errors. The process had been
terminated before injection. This closes the local iOS cold-opening check; it does
not certify APNs transport or physical VoiceOver. The app was terminated afterward
and only the temporary `coverageColdLaunchRehearsal` preference removed from its
simulator container. Remaining manual checks: physical TalkBack/VoiceOver and real
isolated APNs/FCM delivery. Changes remain uncommitted.


The completed notification rehearsal is committed as a checkpoint. Its owned demo
services are stopped and dependency symlink removed. For physical iPhone VoiceOver,
prepare a device-compatible rehearsal first: the current loopback transport reaches
the iPhone itself, not the Mac. A normal live-app launch does not exercise this UI.


## Physical iPhone accessibility rehearsal — prepared 2026-09-28

Launch the Debug app with `-coverageAccessibilityRehearsal`. It reuses
`CoveragePreviewAccess` and the real coverage views/model with in-memory sample
data, a pre-bound sample session, and an explicit offline notice. This mode uses
the UI-testing composition: no live Firebase, remote push registration, or local
HTTP server. Commands intentionally fail rather than save changes. The launch
flag is compiled out of Release and takes precedence over the emulator/push flags.

On iPhone 11, the guided scope is VoiceOver reading order and control labels,
case navigation, form fields and cancellation, plus Dynamic Type. Begin at the
overview, open the sample market case, inspect the action sheet, and cancel it.
Do not treat this as backend, authenticated-role, saved-command or APNs evidence.
The maintainer confirms the following physical VoiceOver checks on iPhone 11:

- The overview is read completely and the case is announced as a button.
- The case detail opens and can be traversed without trapped or jumping focus.
- The acceptance confirmation is readable; using Back without confirming returns
  focus to Accept coverage.
- The absence form allows shift selection and entry of a sample reason; using
  Back without saving returns focus to Report an absence.

These bounded VoiceOver checks pass by maintainer observation. Physical Dynamic
Type remains pending, as do TalkBack and real isolated APNs/FCM transport.


### Physical Dynamic Type finding — 2026-09-28

At the maximum accessibility text size on iPhone 11, the maintainer reports the
rest of the flow usable but provides screenshots showing truncated navigation
titles and a truncated shift picker value. This check is not yet passed. The
correction moves screen titles into wrapping, scrollable headings at accessibility
sizes and displays shift choices inline with wrapping labels. Physical recheck
of these two findings is required; the earlier VoiceOver observations remain
valid for the version tested and focus should be spot-checked after this change.

The corrected Debug app is installed and running on iPhone 11. Runtime AX5
inspection in Spanish on iPhone 17 confirms both full headings and the complete
selected shift label. Strict SwiftLint passes; native results show 21 unit checks
passed on iPhone 11 and four UI-smoke checks passed in the simulator after a
physical automation-start timeout. Maintainer recheck remains pending.


The maintainer confirms that the corrected maximum-text screen content is fully
readable on iPhone 11. Following their observation about the former dropdown,
the shift picker now preserves its original automatic style at standard text
sizes and uses inline wrapping options only at accessibility sizes. Both styles
bind to the same draft selection. The final standard-size dropdown/return check
is pending. Relaunch from the icon does not retain the offline launch argument;
launch again with `-coverageAccessibilityRehearsal` to resume the isolated flow.


The maintainer confirms the final standard-size check on iPhone 11: the shift
dropdown opens, the sample shift can be selected and remains selected, and Back
returns without saving. The guided iPhone checks are complete within the offline
scope described above. Physical TalkBack and real isolated APNs/FCM delivery
remain pending.


## Physical Android TalkBack setup — 2026-09-28

With the fixed demo services above running, connect the physical Debug app through
USB; the loopback/API and Auth destinations remain fixed. Configure only:

```sh
adb -s DEVICE_ID reverse tcp:9098 tcp:9098
adb -s DEVICE_ID reverse tcp:8799 tcp:8799
adb -s DEVICE_ID shell am force-stop com.reguerta.user.debug
adb -s DEVICE_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity \
  --ez coverageUsbRehearsal true
```

Force-stop the Debug app before changing between emulator and USB transport, since
the ViewModel owns its access adapter for the activity lifetime. Without the extra,
the existing emulator host remains unchanged. No arbitrary hostname is accepted.
Remove only these two reverse mappings after the guided session and stop the
owned demo services; remove the temporary functions dependency symlink then.

Xiaomi 21081111RG / Android 14 (API 34) is connected, the Debug APK installed and
the isolated login visible. TalkBack is installed but not enabled by the agent.
USB input injection is denied by the device, so the maintainer enters the fixture
credentials manually. Authentication over USB and physical TalkBack are pending.
Local validation: 502 unit checks passed; lint completed with the unchanged
135 warnings and two hints. API 29 connected run succeeds with 23 executed checks
and three opt-in assumption exits (the XML labels these as failures; each is
`AssumptionViolatedException` for a disabled rehearsal flag). Functions build passed.

USB reconnection removes adb reverse mappings. If fixture login fails, recheck
`adb reverse --list` and restore both fixed mappings before retrying credentials.
During physical setup the transport reconnected and both mappings disappeared;
after restoring them, phone-side HTTP probes reached Auth (200) and the API
listener (404 at `/`, whose supported endpoint is `/coverage`). Fixture login
was separately confirmed at Auth with the expected sample UID. App login remains
pending maintainer retry.


The maintainer confirms successful USB login as the offered member, TalkBack
reading of the case with its activation hint, complete detail traversal, and
readable acceptance confirmation with focus restored after cancellation. The
absence-form check is still pending: account `a` returns a writable market slot
from the local API, but USB reverse mappings disappeared again while the device
transport reconnected. Both fixed ports were restored; the app needs a refresh
before the guided check can continue. No fixture or business rule was changed.


### Guided physical TalkBack checks passed — 2026-09-28

On the connected Xiaomi / Android 14, the maintainer confirms case reading with
the activation hint, full detail traversal, acceptance-confirmation reading and
focus restoration on cancellation. After signing in as `a@example.test`, the
absence form also permits shift selection and sample-reason entry; closing
without saving returns focus to Report an absence. The earlier disabled button
was observed while `d@example.test` was still in the login field; no business
rule was changed. USB reconnections required restoring the two fixed reverse
ports during the session. Physical maximum-text inspection remains pending.

### Physical Android XXL detail check — 2026-09-28

The maintainer selects the rightmost XXL setting in Xiaomi Font settings. The
rehearsal activity reports `fontScale=1.5`; the prior scale was 1.33. The overview
screenshot shows readable case cards, and the maintainer confirms the complete
market detail is readable without clipping or overlap. The increase is modest;
this proves the device's offered XXL setting, not a 2.0 scale. The absence form
at XXL remains pending. Only acceptance notes changed; automated tests were not
repeated.

### Physical Android keyboard obstruction — 2026-09-28

The maintainer can enter an absence reason at XXL, but the keyboard hides Back;
a physical screenshot confirms the obstruction. The command dialog now opts out
of decor fitting and applies safe-drawing insets outside its scrollable surface,
so keyboard and system bars constrain the available content height. A regression
test at font scale 2.0 waits for the real IME, scrolls to Back, touches it and
checks dismissal with unchanged snapshot and no pending command.

Validation: 502 unit tests pass; lint has no errors (135 existing warnings and two
hints); Debug app/test APKs build. All three opt-in coverage acceptance tests pass
on API 29, including the IME regression (zero skips). Logs:
`/tmp/hu084-ime-build.log`, `/tmp/hu084-ime-connected.log`. The updated demo-only
Debug APK is installed on the physical Xiaomi for recheck; physical confirmation
is pending. Temporary synthetic Google configuration was removed after building.

The maintainer then confirms the corrected flow on the physical Xiaomi: with XXL
and the keyboard open, entering a reason, scrolling to Back and cancelling without
saving work. This closes the guided physical maximum-text check at scale 1.5;
scale 2.0 remains emulator evidence. Only documentation changed after validation.
Owned demo emulators/API are stopped, the two USB mappings and temporary dependency
symlink removed. Font settings are reopened so the maintainer can restore XL.
Real isolated APNs/FCM delivery remains pending.

### Real APNs/FCM transport preparation — 2026-10-04

The maintainer reports notifications worked before the shift remodel. This is a
regression check of the coverage payload and tap route, using the existing Debug
registrations, not a replacement notification system. Preparation is local;
registration and sends below have **not** been executed.

Use Firebase project `reguerta-9f27f`, Android Debug app
`1:195744802339:android:65308f6405a03baaadb396` (`com.reguerta.user.debug`), and iOS
Debug app `1:195744802339:ios:3fa2544ff8ed478aadb396`
(`com.plusprojects.Reguerta.debug`). Real SDK configuration must match exactly;
synthetic emulator files and Release apps are rejected. Verify existing APNs
credentials/signing and notification permission before diagnosing reception.
Obtain explicit authorization for registration and at most three one-device FCM
sends per phone in this project; do not change APNs/Firebase configuration as an
implicit part of that authorization.

- Android: build `app:assembleDebug -PcoverageRemotePushRehearsal=true`. The
  launcher enters the in-memory case; the selected Debug Messaging service never
  uploads business device records. `register()` requests FCM registration and
  `onRegistered` exports the confirmed FID, including renewals. The activity and
  service use the default process so Firebase initialization is available.
- iOS: first launch Debug with `-coverageRemotePushRehearsal`. The preference
  persists across OS cold launch without arguments. `-disableCoverageRemotePushRehearsal`
  clears it; explicit mock/local rehearsal flags also clear it and take precedence.
  Existing APNs/Messaging delegates remain in use, but the app graph is in-memory
  and tokens are saved locally instead of forwarded to the live device registrar.
- Both open only the fixed event `coverage-` followed by `84` repeated 32 times,
  resolving `preview-case`. Commands cannot save changes. This exercises real
  transport plus native routing; it does not prove live coverage backend access,
  authorized-device persistence, business triggers, or deployment readiness.

Export the destination into a private directory outside the repository (directory
mode 0700, file mode 0600), without printing its contents. On Android use `adb
exec-out run-as com.reguerta.user.debug cat no_backup/coverage-push-destination.json`
redirected into the private file. On iOS copy
`Documents/coverage-push-destination.json` from the Debug app's data container via
Xcode/devicectl. The iOS rehearsal removes its previous export before Firebase starts. It exports
only after the successful FCM token fetch following APNs registration in this
launch; an early cached-token delegate callback cannot mark the device ready.

With Functions dependencies and `npm run build` complete, run from repository root:

```sh
node functions/scripts/coverage-remote-push.cjs --destination /PRIVATE/destination.json
```

This default is offline and prints metadata and a destination hash, never the
FID/token. Only after the concrete authorization, use authenticated ADC for the
same project and a new receipt path for each planned delivery:

```sh
node functions/scripts/coverage-remote-push.cjs --destination /PRIVATE/destination.json \
  --send --confirm-project reguerta-9f27f --receipt /PRIVATE/foreground-receipt.json
```

The script sends to exactly one exported destination, with no topic/fanout.
iOS uses one HTTP v1 POST with redirects disabled and no retry (the Admin SDK
otherwise retries some errors internally); Android retains the existing transport.
The exclusive receipt prevents accidental reuse; an unknown result must be
inspected before any retry. Provider acceptance does not prove reception. Record device, state, receipt outcome, actual arrival and tap.

| State | iPhone | Android | Expected result |
| --- | --- | --- | --- |
| Foreground | Passed: real receipt and maintainer-confirmed tap | Passed: real receipt and maintainer-confirmed tap | Notice appears; tapping opens the sample coverage |
| Background | Passed: maintainer confirms receipt and case opening | Passed: maintainer confirms receipt and case opening | System notice appears; tapping opens the same case |
| Process closed | Passed: process absent before send; maintainer confirms case opening | Passed: process absent before send; maintainer confirms case opening | System tap starts Debug directly in the same sample |

On Android, background the app then terminate its process for the cold check;
do not use force-stop before sending, because that blocks normal push delivery.
Clear the previous notification and return to the list between cases.

After the test, clear the iOS opt-in, delete its app-container export, remove the
Android `no_backup` export and rebuild/install ordinary Debug without the Gradle
property. Remove host destination files and clear test notifications. Keep only
redacted receipt evidence; do not delete normal FCM registrations as cleanup.

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

#### iPhone 11 installation checkpoint — 2026-10-04

The connected iPhone 11 runs iOS 27.2. The Debug app is built and installed, with
its bundle/project/app identity, `aps-environment=development`, development
signing and device provisioning verified. The rehearsal has not been launched or
registered, and no FCM message has been sent. The installed SDK configuration was
read from the existing Firebase Debug app and is ignored by Git.

A preflight review caught an early cached-token callback that could export a
stale destination before APNs. The export now clears on launch and waits for the
explicit token fetch after APNs; later token changes can update it. Nil tokens
clear the file. The independent reviewer rechecked the correction. Four focused
Swift Testing cases pass on iPhone 17 / iOS 27.2 (including the destination
lifecycle regression and existing AppDelegate policy test); physical Debug
build-for-testing passes. Existing test-target AppIntents metadata warnings
remain. This checkpoint does not establish APNs/FCM receipt.

#### First authorized iPhone attempt — 2026-10-04

The maintainer authorized registration and at most three notices to this iPhone
only, and confirmed the sample screen open. Fresh APNs/FCM registration exported
the private destination. One foreground HTTP v1 POST was submitted and rejected:
HTTP 401, `UNAUTHENTICATED`, `THIRD_PARTY_AUTH_ERROR`. Zero accepted targets and no
foreground callback were observed. This points to missing/invalid APNs credentials
for the Debug app, not to a demonstrated coverage-navigation defect. See the
[FCM error reference](https://firebase.google.com/docs/cloud-messaging/error-codes).
The precise missing/invalid credential is not yet identified. Two authorized
attempts remain unused; no retries or background/cold sends were performed.

A sender preflight found Admin SDK internal retries; the iOS rehearsal now uses
a single native-fetch POST, redirects disabled and a 15-second timeout. Seven
sender tests, Functions lint/build, and independent review pass. Android's SDK
transport remains unchanged; its internal retry behavior must be accounted for
before promising a strict number of HTTP attempts on that platform.

Firebase Cloud Messaging settings were opened read-only, but the browser requires
sign-in. No APNs key/certificate, Firebase configuration, production app, or business
record was changed. Retain the private destination and first redacted receipt
only for this pending session; clean up after completion as above.

#### APNs configuration diagnosed — 2026-10-04

After the maintainer signed into Firebase, Cloud Messaging settings were inspected
read-only at `settings/cloudmessaging/ios:com.plusprojects.Reguerta.debug` in
`reguerta-9f27f`. The selected app is iOS Reguerta Debug. The console explicitly
reports no development or production APNs authentication key and no development
or production APNs certificate. The missing Debug configuration explains the
first `THIRD_PARTY_AUTH_ERROR`; this is not evidence of a shift-routing regression.

Next: check whether an existing retained `.p8` is active in the matching Apple
team and permits Sandbox plus the Debug bundle. Do not assume a Production-only
or other-topic key is reusable. Configure only the Debug development key after
authorization; credential entry requires the maintainer. No key has been located,
created, uploaded, replaced or revoked in this inspection. No additional send was
made; two authorized attempts remain. The console stays on the Debug APNs section.

#### Development key uploaded; foreground receipt observed — 2026-10-04

The maintainer reports uploading the retained APNs key. Read-only Firebase UI
verification confirms a development authentication key in iOS Reguerta Debug,
with the same Apple team as the signed Debug app. The agent did not upload or
modify the key. Production APNs configuration was not changed by the agent.

The Debug rehearsal was relaunched on the connected iPhone 11 and a fresh
post-APNs destination exported; its token hash matches the first attempt.
Authorized attempt 2: exactly one HTTP v1 POST, accepted for one target. The app
console records one `Foreground push received` callback and zero APNs registration
errors. This confirms real foreground receipt after configuring the development
key. The maintainer's confirmation of banner tapping and case opening is pending.
One of the three authorized attempts remains; background/cold checks remain pending.

The maintainer confirms that tapping the received foreground notice opens the
sample coverage detail on the physical iPhone 11. Foreground receipt and tap are
now confirmed. Next: background receipt/tap, using the last authorized attempt.
Cold-start delivery remains pending and will require one additional authorized
attempt because the initial APNs configuration rejection consumed attempt 1.

After the maintainer confirmed the app on the Home Screen in the background,
authorized attempt 3 submitted one HTTP v1 POST and was accepted for one target.
Receipt: `/tmp/hu084-iphone-push-0g9rul0r/03-background-receipt.json`. Physical
arrival and tap remain pending maintainer confirmation. All three authorized
attempts are now consumed; do not send the cold-start check without additional
authorization.

The maintainer confirms the background notice worked and opened shift coverage,
then reports the app closed. Device process inspection no longer lists the
installed Debug executable. Background receipt/tap is passed; cold launch is
prepared but no fourth message has been sent. The first rejected attempt counts
against the explicit three-attempt authorization, so one more is requested.

The maintainer explicitly authorizes one additional attempt for cold launch. Before
submission, device process inventory confirms the installed Debug executable is
absent. Attempt 4 makes one HTTP v1 POST and FCM accepts one target. The post-send
inventory shows a new Debug process (PID 2087); the agent did not launch the app.
Direct sample-case opening still awaits explicit maintainer confirmation after
this delivery. Receipt: `/tmp/hu084-iphone-push-0g9rul0r/04-cold-receipt.json`.
The extra one-attempt authorization is consumed; no further sends are authorized.

#### Final iPhone transport acceptance — 2026-10-04

After attempt 4, the maintainer confirms that the app opened the sample coverage.
All three real APNs/FCM states pass on the physical iPhone 11: foreground,
background and process closed. Four single-POST attempts were made in total:
one rejected for missing Debug APNs configuration, then three accepted deliveries
with maintainer-confirmed opening after the development key was configured.
Android's three real-delivery checks remain pending. This acceptance covers
transport and native opening of the in-memory sample; it does not validate
authenticated backend commands, business writes or production activation.

Cleanup verified on the same Debug installation: the persisted remote-rehearsal
preference is absent/false after an offline launch, and the exported destination
was overwritten with `{}` and read back without a token. Both private host
destination copies and the temporary preferences copy were removed; redacted
receipts remain available. Only the verified Debug process was stopped. The
maintainer's APNs key remains configured; no further notification was sent.

#### Android connection and APK preflight — 2026-10-04

The Xiaomi 21081111RG (Android 14 / API 34) is authorized and visible to ADB
after moving its cable to another direct Mac port. Before that change macOS
listed no phone over USB, while Studio connected successfully to ADB; there is
no evidence that the Android Studio update caused the missing device.

The real Debug SDK configuration was fetched read-only and checked against the
project/app IDs above. `app:assembleDebug -PcoverageRemotePushRehearsal=true`
passes. Inspection of the final APK confirms the Debug package/signature, the
remote rehearsal service (without the business device service), and the rehearsal
activity in the default process. A private copy of the previously installed
Debug APK is retained for restoration. Notification permission is currently off.
The rehearsal APK has not been installed/launched and registration/sends remain
pending Android-specific authorization. The existing Android transport can retry
internally (up to five HTTP attempts per logical submission), so three planned
state checks must not be represented as a strict three-POST limit.

The maintainer subsequently authorized this Android Debug registration and the
three logical state checks, including normal SDK retries. Installation/update
and launcher redirection to the isolated rehearsal succeeded. `onRegistered`
exported the confirmed installation destination; its private host copy passes the
offline sender plan for exactly this Debug app. No send yet: Android's notification
permission dialog is still awaiting the maintainer's response.

#### Android foreground transport acceptance — 2026-10-04

On the same Xiaomi 21081111RG / Android 14 / API 34, `POST_NOTIFICATIONS` is now
granted and `CoverageRehearsalActivity` was resumed before the first logical FCM
send from `reguerta-9f27f`. The registered destination had already passed the
offline sender plan. FCM accepted one target (`acceptedTargetCount=1`), and the
maintainer confirms receiving the notice, tapping it and opening the sample
coverage. Foreground transport and opening pass. Background and process-closed
checks remain pending; two authorized logical sends remain. Receipt:
`/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu084-android-push-uyn4qyns/01-foreground-receipt.json`.

The second logical send was accepted for one target. Before sending, activity
inspection showed the MIUI launcher resumed and Debug PID 15319 still running,
establishing the background state. The maintainer then confirms receipt and
opening of the sample coverage, so background transport and opening pass. Only
the process-closed check remains pending, with one authorized logical send left.
Evidence in the same private directory: `02-background-preflight.json` and
`02-background-receipt.json`.

The third logical send was accepted for one target after the maintainer returned
to Home and the Debug process was terminated with `am kill`. Pre-send inspection
confirmed the MIUI launcher resumed, no Debug package process or subprocess,
`stopped=false` and notification permission granted. No force-stop was used.
The maintainer confirms receipt and opening, then clarifies that only the Recents
card remained and the app was not reopened manually. Together with the verified
pre-send process absence, this confirms the process-closed case passes.
All three authorized logical sends are consumed; no further sends are authorized.
Evidence in the same directory: `03-cold-preflight.json` and `03-cold-receipt.json`.

Final Android result: all three authorized logical sends were accepted for one
target each, with receipt, tap and sample-case opening confirmed in foreground,
background and process-closed states. The real transport matrix now passes 3/3
on both the physical Xiaomi and iPhone. This verifies transport and native sample
opening, not authenticated backend commands, business writes or production
activation.

Android cleanup is complete: after all sends and confirmations, Debug was stopped
and its private destination export removed. The exact previously installed Debug
APK was restored and its on-device SHA-256 matched the saved baseline. App data
was preserved. The host destination and both temporary APK copies were deleted;
normal Firebase registration was not revoked. Redacted receipts and
`cleanup-verification.json` remain in the private evidence directory. No further
send occurred during cleanup.


## Administrative forms rehearsal — 2026-10-26

This is a separate fixed-demo fixture; stop other coverage test services first.
It resets only the known demo Firestore root and Auth emulator accounts. No shared
Firebase project, Sheet or OS notification is used. Node 22 and compatible Java
are required. Build the current Debug apps and use their existing rehearsal entry.

```sh
npm run build
firebase emulators:exec --config ../firebase.coverage-emulator.json \
  --project demo-reguerta-hu084-coverage --only firestore,auth \
  'GCLOUD_PROJECT=demo-reguerta-hu084-coverage METADATA_SERVER_DETECTION=none node test/shift-coverage-administration-native-rehearsal.cjs membership'
```

Sign in as `admin@example.test` / `local-fixture-password`, then open the
administrative reserves/exceptions entry. Virtual time is 2026-06-01 UTC.

1. Inspect **Socio de ensayo: reserva**, apply the current situation and confirm.
   Both reserve pools become active. Repeat: FIFO entry time must stay unchanged.
2. Inspect **Socio de ensayo: baja permanente**. Its account is already inactive
   and has one pending delivery credit. Applying its current situation alone keeps
   that credit. Open permanent departure, cancel/back without confirming, and
   verify that no state changes. Then enter a reason and confirm the permanent
   cancellation; one cancelled credit remains visible in history.
3. Check navigation, reason editing/keyboard, maximum text and VoiceOver/TalkBack.
   Refresh does not silently resend an uncertain command; retry is explicit and
   retains the original operation. Session change clears private forms/data.
4. Stop and restart the command with `spacing` instead of `membership`, then
   sign in again. Membership writes are read-only in this closed-maintenance
   fixture, while exact spacing proposals are available. Select a pair, inspect
   both dates/rounds, provide a force-majeure reason and confirm. Refresh removes
   the approved pair; no public assignment is created or changed.

Each mode reset is deliberate test isolation. `--smoke` after the mode verifies
the fixture through real emulator Auth/HTTP and exits. This validates fixture
preparation, not physical accessibility. New native physical checks are pending;
the earlier coverage/notification matrix does not establish these new forms.

Physical iOS keeps the existing `-coverageAccessibilityRehearsal` offline sample
route, now including the administrative list and forms. It supports reader/text/
keyboard/navigation checks and cancellation; its commands deliberately remain
unavailable and cannot prove a successful backend write. The authenticated local
fixture above runs on Simulator (or Android emulator/verified USB reverse), where
its loopback addresses resolve correctly. No new physical network bridge is added.


### Physical administration preparation — 2026-10-26

Current Debug app is installed on the connected/unlocked iPhone 11/iOS 27.2.
Xcode 27.1 physical build/run passed without compiler warnings/errors; devicectl
then relaunched the offline accessibility argument after Xcode-state cleanup.
First new VoiceOver check is the administrative member “Beatriz de prueba”: inactive,
one pending delivery credit, update-situation and permanent-departure buttons.
Preparation is verified; actual reading/focus/text/keyboard outcomes are pending.
Open, edit and cancel forms; do not submit offline commands.


### VoiceOver: administrative member row confirmed — 2026-10-26

The maintainer confirms complete reading of Beatriz de prueba on the prepared
iPhone 11, including inactive status, one pending credit and both update-situation
and permanent-departure buttons. This bounded row-reading check passes. Forms,
cancellation/focus return, exact spacing pair and large-text/keyboard checks remain
pending; no command was submitted.


### Update-situation reading and corrected return focus — 2026-10-26

The maintainer confirms complete explanation reading. Original cancellation
returned focus to the top navigation Back control. A narrow presenting-view
SwiftUI accessibility-focus correction now restores the eligible invoking action
once after dismissal, with session/availability fences. After the corrected
physical build/install, the maintainer confirms that Back returns VoiceOver to
Update situation. No command was submitted; departure/spacing returns and
text/keyboard remain pending.


### VoiceOver: permanent-departure form confirmed — 2026-10-26

The maintainer confirms full reading of the cancellation notice, reason, explicit
acknowledgement and initially disabled Confirm. Back returns focus to the invoking
permanent-departure button. No command was submitted. Spacing-pair and text/keyboard
checks remain pending.


### VoiceOver: exact spacing pair and return confirmed — 2026-10-26

The maintainer confirms complete reading of Ana de prueba's proposal, the
2027-01-06/round 3 and 2027-02-17/round 4 pair, and focus returning to its
exception button after Back. All three administrative open/cancel return paths
are physically confirmed on the corrected binary. No command was submitted;
reason/acknowledgement editing, maximum text and keyboard remain pending.


### Reason/acknowledgement guard confirmed; keyboard dismissal — 2026-10-26

The maintainer confirms that typing “Prueba” alone leaves Confirm disabled,
checking the explicit departure acknowledgement enables it, and Back cancels
without submitting. VoiceOver reading outside the field leaves text editing
active, so the admin sheet adds a native localized Hide keyboard control which
preserves reason/acknowledgement. Back also ends editing before dismissal.
Actual keyboard dismissal/preservation and maximum text remain pending recheck.


### Physical Hide keyboard confirmed — 2026-10-26

After the updated warning/error-free physical build, the maintainer confirms
Hide keyboard closes the software keyboard and preserves “Prueba” in the
permanent-departure reason. No command is submitted; maximum text remains pending.


### Maximum-text departure and touch selection — 2026-10-26

At maximum accessibility text the maintainer confirms the departure title, notice
and acknowledgement are complete, with reason/Back reachable by scrolling.
Spacing and keyboard at that size remain pending. New UI regressions additionally
find finger taps on a member-row action can select its first automatic List
action. Separate explicit button styles and scaled touch targets correct routing;
the unchanged tests are rerun. Prior physical VoiceOver activation is distinct
from this finger-tap evidence.


The unchanged keyboard regressions pass 2/2 after the independent button-target
correction, covering both admin forms, actual software-keyboard hiding/text
preservation and cancellation while editing. The preceding four UI-smoke checks
passed separately. Physical maximum-text departure is confirmed; spacing and
maximum-text keyboard checks continue. The latest touch-style change still needs
the physical app update/spot check after the current screen review.


### Maximum-text exception form confirmed — 2026-10-26

On iPhone 11 at maximum accessibility text, the maintainer confirms complete
proposal/date/round reading and scroll access to reason/Back. Maximum-text
keyboard interaction and the final physical touch-style update/spot check remain
pending; no command was submitted.


### Maximum-text keyboard confirmed — 2026-10-26

The maintainer confirms Back is reachable with the keyboard open at maximum text,
Hide keyboard preserves the reason, and Back cancels without submission. This
closes the bounded new-form reader/focus/reason/acknowledgement/text/keyboard
checks on iPhone. Latest independent touch-style installation/spot check, physical
Android new-form checks and final validation remain separate.


### Latest touch correction installed on iPhone — 2026-10-26

Current independent-button Debug source is installed and open on iPhone 11/iOS
27.2, with a clean physical build and original scheme/project/catalog restored.
Pending direct touch at ordinary text with VoiceOver off: open/cancel update,
permanent departure and spacing, checking each distinct form without submission.
Physical acceptance of the new Android forms remains separate and unperformed.


### Bounded physical iOS administration acceptance complete — 2026-10-26

The maintainer confirms direct-touch opening of each corresponding latest form
and cancellation without submission. The bounded iPhone 11/iOS 27.2 matrix now
covers VoiceOver reading, invoking-button return, reason/acknowledgement, maximum
text, keyboard and independent touch. This offline rehearsal performs no backend
commands. New-form physical Android acceptance remains separate and pending;
the full iOS gate is being refreshed with all corrections.

### Physical Android membership administration — 2026-10-27

The maintainer confirms the following on the physical Xiaomi / Android 14,
using the authenticated fixed-demo `membership` rehearsal:

- TalkBack reads the reserve reconciliation form, and cancelling returns focus
  to its opening button. The permanent-departure warning and reason are read;
  Confirm is disabled with an empty reason. Entering `Prueba` enables Confirm,
  the system Back gesture hides the keyboard without losing the reason, and
  cancelling returns focus to the departure button.
- Native Xiaomi XXL is selected and the reported font scale is 1.5. Text remains
  readable, content scrolls, and Back is reachable with the software keyboard
  open. An attempted shell adjustment to 2.0 was rejected by `WRITE_SETTINGS`;
  the scale did not change and no additional permission was granted.
- Confirming reconciliation activates both delivery and market reserves. A
  repeated reconciliation preserves their entry timestamps and membership
  revision, as verified by local read-back. Reconciling the inactive example
  retains its one pending delivery credit. Explicit permanent departure then
  leaves zero pending credits and one cancelled credit in history.

The backend uses the fixture's fixed virtual date, 2026-06-01 UTC. These writes
are confined to the local demo; they do not activate HU-084 or affect shared
Firebase, production Sheets or real notifications. The spacing-form reader,
focus-return, large-text/keyboard checks and independent direct-touch selection
remain pending. Earlier physical coverage/push checks are separate evidence.

### Bounded physical Android administration acceptance complete — 2026-10-27

In the independent `spacing` fixture, the maintainer confirms closed maintenance
and disabled membership actions. TalkBack reads Ana's proposal and the exact
2026-09-03/round 1 to 2026-10-15/round 2 pair; empty reason disables Confirm,
`Prueba` enables it, and cancellation returns focus to the same pair's button.
At native Xiaomi XXL/1.5, text and controls remain legible and scrollable with
the keyboard open; hiding the keyboard preserves the reason and Back cancels.

After cancelling and disabling TalkBack, the maintainer opens that same pair
from its list button by direct touch and authorizes it. Read-back removes only
that pair, from 48 proposals to 47. Exactly one exception and one operation are
added, bound to actor `member-1`, `bundle-2026`, the observed dates/rounds and
submitted reason. All pre-existing records, including request/configuration and
rotations, compare unchanged; public shifts and persisted planning candidates
remain absent. After a fresh `membership` reset, direct touches open the correct
reconciliation and permanent-departure forms; cancelling both leaves the complete
local read-back unchanged.

Together with the membership observations above, this completes the bounded
new-form Android reader/focus/reason/native-maximum-text/keyboard/direct-touch
matrix and supersedes its earlier pending notes. The scale is 1.5 and the backend
clock remains fixed at 2026-06-01 UTC. All submissions are confined to the local
demo. This checkpoint does not close HU-084 or establish shared-service activation,
production changes or a warning-free iOS gate; iOS diagnostics remain separate.

Cleanup restores the original installed Debug APK without clearing app data;
installed read-back matches the original SHA-256. TalkBack is off and display
size/density are unchanged. Final font scale is normal 1.0, different from the
initial verified XXL/1.5; the current setting is preserved. Demo services, owned
USB mappings and the temporary backend dependency link are removed. Detailed
snapshots and cleanup evidence are linked from the story review.

### iOS keyboard-action placement correction validated — 2026-10-27

The two unchanged keyboard UI tests reproduced the invalid-frame diagnostics.
An initial experiment using an immutable toolbar condition did not remove them
and was reverted exactly. Unified logs, `atos` symbolication and live pre-call
registers identify the emitter in the tested SwiftUI 26.5 runtime: native
`InputAccessoryBar.body` supplies a fixed width of positive infinity to
`FrameLayout`; no application geometry calculation supplies that width.

The existing Hide keyboard action now uses `topBarTrailing`, at the top of the
form while its reason field has editing focus, preserving its text, identifier,
focus-dismissal action and reason/acknowledgement guards. A wrapping Form header
and an empty navigation title at accessibility text sizes follow the existing
coverage command sheet's pattern and replace the truncated navigation title.

The focused result passes 6/6 unchanged UI tests (two keyboard and four smoke),
with zero runtime, compiler or analyzer issue summaries. Two AX5 previews were
refreshed on the actual iPhone 18 Pro Max/iOS 27.2 renderer. Four runtime captures
on iPhone 17/iOS 26.5 show both complete headers and legible Back/Hide keyboard
actions while editing. These are separate preview/runtime environments and
visible-layout evidence, not physical VoiceOver acceptance. The evidence manifest
is `/tmp/hu084-warning-final-focused-evidence.json`; the current source hash
`8877b7c3…` differs from its tested `43ed5623…` source only by a comment.

The canonical full gate on final source `8877b7c3…` now passes on iPhone 17/iOS
26.5: 943 total tests, 938 passed, five expected skips and zero failures. The
closed root/build/action results contain zero compiler, analyzer or runtime
issue summaries. SwiftLint checks 521 files with zero violations. Five original
files are restored exactly, all 531 source/configuration hashes remain unchanged,
the 28 intended administrative localization keys are retained, and temporary
demo configurations are removed. Evidence: `/tmp/hu084-warning-corrected-summary.json`,
`/tmp/hu084-warning-corrected-result-object.json`,
`/tmp/hu084-warning-corrected-issue-counts.json`,
`/tmp/hu084-warning-corrected-cleanup.json` and
`/tmp/hu084-warning-corrected-release-gate.log`.

The maintainer now confirms the targeted physical spot check on iPhone 11/iOS
27.2 with unchanged source `8877b7c3…`: the offline rehearsal is visible at very
large text, VoiceOver reads Beatriz's complete permanent-departure header and
Hide keyboard at the upper right, activating that action hides the keyboard while
preserving `Prueba`, and Back returns focus to Register permanent departure.
No confirmation or backend command is submitted. This closes the requested
physical check of the new header and shared action through the departure form.
The 2026-10-26 physical matrix used the earlier location; spacing after this
correction has AX5 Simulator/runtime and UI-test evidence, without a new physical
spacing observation. The full gate above remains applicable because source is
unchanged. One AppIntents metadata-extraction warning from the physical-build
tool is recorded separately from source diagnostics and the zero-issue Simulator
result. Diagnosis and result paths remain in the story review. No production or
Git delivery is established by this checkpoint.

### AppIntents tooling-warning investigation — 2026-10-27

The target has no AppIntents implementation. In the installed Xcode 27.1 tool
specification, `LM_ENABLE_LINK_GENERATION=NO` maps to `-d`/`--disable`. An isolated
probe of the physical metadata-processor invocation, with output redirected to
temporary storage, exits 0 but still emits one warning: `Metadata extraction
disabled by --disable`. It replaces the earlier warning rather than resolving it;
original outputs remain unchanged. Evidence:
`/tmp/hu084-appintents-disable-probe-summary.json`.

`LM_FILTER_WARNINGS` only hides diagnostics and is rejected. The real
`LM_SKIP_METADATA_EXTRACTION` guard is internal to SwiftBuild; no public contract
was found, so it is not adopted. No build setting, import or application source
changes are made. The corrected gate (938 passed, five expected skips, zero
failures/issues) and prior bounded physical observations are reused because this
investigation/documentation changes no source. The external tooling warning and
the parent story's live activation gates remain open; no Git delivery is claimed.
