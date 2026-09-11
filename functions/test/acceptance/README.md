# HU-083 native acceptance

This is a bounded, opt-in test harness for the approved disposable develop
scenario. It is not a deployment or migration command. Both scripts reject
anything except `demo-hu083-develop-rehearsal` at `127.0.0.1:8797` before creating
a Firestore client. They never call Drive, Sheets, Functions endpoints or FCM.
Sheets I/O uses the existing stateful API fixture with the captured native grid.

Use the retained private evidence directory containing
`backend-fixture-input.json` (four rebuilt seasonal grids and 48 users) and
`captured-firestore.json` (62 original shifts and four calendar entries). Do not
copy those files into Git. The fixture resolves all names uniquely, requires
32 eligible users and 27 effective assignees, and uses the production bootstrap,
publication and authoritative-state validators.

After building Functions and starting a Firestore emulator at the address above:

```sh
HU083_EVIDENCE_DIR=/absolute/private/evidence \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8797 \
GCLOUD_PROJECT=demo-hu083-develop-rehearsal \
node test/acceptance/hu083-native-controller.cjs
```

The controller writes `develop-reset-plan.json` and private per-run receipts into
that directory. Run the platforms **sequentially**. Commands and responses travel
through a separate emulator collection; the actual app repository still reads
its normal `develop/plus-collections/shifts` path with server reads.

- iOS: create the ignored empty JSON marker
  `ios/Reguerta/ReguertaTests/hu083-emulator-enabled.json`, then run
  `ShiftSheetsEmulatorAcceptanceTests` on an iOS simulator. The test requires
  `-useMockAuth`, supplied by the unit/release test plans, so the host does not
  start live services. Remove the marker afterwards. Ordinary runs skip this
  opt-in case when the marker is absent.
- Android: select an emulator explicitly with `ANDROID_SERIAL`; run
  `app:connectedDebugAndroidTest` with
  `-Pandroid.testInstrumentationRunnerArguments.class=com.reguerta.user.presentation.shifts.ShiftSheetsEmulatorAcceptanceTest`
  and `-Pandroid.testInstrumentationRunnerArguments.hu083Acceptance=true`.
  Its named Firebase client uses `10.0.2.2:8797`. Ordinary instrumentation runs
  skip the case without that argument. No Activity is launched by this test.

Each run replaces the isolated legacy dataset, normalizes the 53 missing helper
cells, reads all 72 turns through the native SDK/repository, applies and replays
the two-row September replacement through the real import implementation, and
restores the 62 exact legacy field sets. The same iOS ViewModel or Android
repository survives all three observations. The oracle comes from captured
sheet assignments and raw legacy fields, not from either native decoder.

Restoration checks the complete emulator inventory and service update times,
including nested import receipts. An unexpected record and a change-and-restore
with a newer update time must both reject the inverse guard. The local probe
renews its guard only after verifying exact fields again. Users and calendar fields remain unchanged;
Firestore service update times are not restorable. This harness does not prove
deployed Rules, event delivery, notification dispatch or on-screen UI behavior.

The approved content plan has explicit bootstrap/baseline identities and no
invented Drive version. Its live source-policy binding remains an activation
requirement: the connector omits Drive `version` and the operator's existing
OAuth scope rejects `files.get`. The test copy starts its own numeric revision
counter at 1; that counter is excluded from the content plan. HU-085 must bind a
fresh actual Drive observation and deployed index authority after writer drain,
then materialize the runtime-owned forward/inverse command before any live write.
