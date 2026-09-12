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
composition with push disabled. Neither route is registered in Release.

All fixture accounts use `local-fixture-password`:

- `d@example.test`: open **Market**, accept the offer and inspect read-back.
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
The test skips in ordinary gates. No notification/Sheets effect, live deployment,
VoiceOver approval or full device/layout matrix is implied by this rehearsal.

After completing delivery as admin, run the AX5 credit read test separately with
`TEST_RUNNER_COVERAGE_CREDIT_REHEARSAL=1` and
`-only-testing:ReguertaUITests/CoverageRehearsalUITests/testLocalEarnedCreditAtAccessibilitySize`.
It requires the completed-delivery state and skips unless explicitly selected by
that environment flag. It records a persistent screenshot in the result bundle.

## Coverage effects rehearsal

`npm run test:shift-coverage:emulator` now includes the command-to-Sheets-to-inbox
integration. It uses only the fixed Firestore demo and the existing in-memory
Sheets API fixture (`coverage-rehearsal-book`). It does not drain the native UI
fixture automatically or connect to a shared workbook.

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
effect keeps case/revision references; case-specific notification navigation and
actual dispatch remain pending, as does governed shared-workbook recovery/activation.
The rehearsal reservation is not a production distributed lock across all writers.
