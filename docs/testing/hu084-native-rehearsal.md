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
workbook and local inbox only; live deployment, VoiceOver approval and the complete
device/layout matrix remain separate.

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
