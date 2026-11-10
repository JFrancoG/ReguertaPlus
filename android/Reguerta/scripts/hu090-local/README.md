# HU-090 local Android validation

This isolated harness uses only `demo-reguerta-hu090`. It is not a production
backend, a production Rules test, an actual FCM delivery test, or approval of
the exact Release AAB. No real Firebase configuration or ADC is read.

Normal `assembleRelease` and `bundleRelease` automatically run
`verifyReleasePrivacy` on the final merged Release manifest. It uses Python 3
and the stdlib-only `scripts/verify-release-privacy.py`; a restored advertising
permission, advertising default grant, or global Analytics disable fails the
build. Final APK/AAB inspection still belongs to candidate validation.

From `android/Reguerta`, start the official Firebase emulators with the fixed
config and demo project (never omit the explicit project):

```bash
firebase emulators:start --config scripts/hu090-local/firebase.json \
  --project demo-reguerta-hu090 --only auth,firestore,storage
```

In a separate local process, start the Functions contract fixture and seed the
emulators:

```bash
python3 scripts/hu090-local/gateway.py
python3 scripts/hu090-local/seed.py
```

Ports: Auth 9098, Firestore 8798, Storage 9198, gateway 5009, emulator hub 4498,
logging 4598. All servers bind `127.0.0.1`; Android Emulator uses its fixed host
alias `10.0.2.2`. Nothing forwards a request to a cloud endpoint. Missing local
services produce failure, with no cloud fallback. Keep emulator debug logs
outside the repository. Stop only the task-owned local processes afterwards.

On Android 17/API 37+, grant the QA-only local-network permission after
installing and before starting the app:

```bash
adb -s <task-device> shell pm grant com.reguerta.user.validation \
  android.permission.ACCESS_LOCAL_NETWORK
```

The permission exists only in the non-publishable QA manifest. Production
Release never requests it. Android 17 otherwise blocks `10.0.2.2` connections
even when the host emulators are healthy. On older Android versions no such
grant is needed. Exercise other permission-denial paths independently.

The gateway's committed `gateway-fixtures.json` is an independent app-contract
oracle: `resolveAuthorizedMember` for the three synthetic accounts and the one
`resolveShiftNotificationDetail` reference fixture are implemented. It accepts
only unsigned Auth-emulator tokens with the exact demo
audience/issuer, verified synthetic email and unexpired lifetime. Other paths,
functions, environments or tokens are rejected. This fixture does not exercise
the real server authorization implementation. The shift detail additionally
requires the exact `hu090-local-shift` event, `develop` environment and
`qa.member@example.invalid` identity; the other fixture accounts cannot fetch it.

Synthetic accounts (public local fixtures, never real credentials):

| Email | Display name | Roles |
| --- | --- | --- |
| qa.member@example.invalid | HU090 Local Member | member |
| qa.producer@example.invalid | HU090 Local Producer | member, producer |
| qa.admin@example.invalid | HU090 Local Admin | member, producer, admin |

All use `Qa-Local-090!`. Seed signs up or reuses only these local accounts,
marks them verified via the Auth emulator's owner endpoint, and seeds synthetic
`develop/plus-collections` users, authLinks, directory, public/member config and
one product. Empty legacy orders/orderLines/containers/measures are readable
only for the compatibility refresh; legacy writes stay denied. It never deletes emulator data, reads a real token, or connects to
any host other than fixed localhost ports. Freeze the seeded data/timestamps
between the before/after performance pair.

Only after both performance pairs finish, seed the single canonical inbox
notification without changing config timestamps or reseeding any other data:

```bash
python3 scripts/hu090-local/seed_notification.py
```

`notification-fixture.json` specifies the generic inbox reference and its
independently expected local detail. A local Activity intent with `eventId`
`hu090-local-shift`, `type` `shift_updated` and `target` `users` exercises app
navigation and authorized detail fetching. It does not send or receive FCM.

`releaseValidation` is non-debuggable and uses Release's PDF-only implementation
and R8 settings. Its variant differences are deliberate: `.validation` app ID,
public demo configuration, QA-only local-network permission, manual emulator
SDK initialization, synthetic local
device-registration ID, no runtime telemetry components, local-only TLS trust
anchor and local cleartext endpoints. Its source-set Application alone selects
the local `develop` namespace; it cannot run in a production variant. The
non-advertising Analytics and real device-registration provider in production
are preserved. The public test CA's private key was discarded and is not a
credential for any service.

## Local evidence

- The optimized app must initialize without a live Firebase provider, log in,
  display `Latest news` on Home, show `HU090 Local Member` in its navigation
  drawer, and read the synthetic product.
- Use the fixture rules' `hu090-denied` document ID for a real emulator
  `PERMISSION_DENIED` negative case. These rules intentionally differ from
  production and provide no production authorization claim.
- Notification permission/handling and PDF can be checked locally. Real FCM
  delivery, real backend rules/functions and exact-artifact cloud canary remain
  separate gates; retain their pending status.
- The QA network policy trusts only the committed synthetic CA for TLS and
  explicitly permits cleartext to `10.0.2.2`. Android 17 also has an implicit
  [localhost policy](https://developer.android.com/privacy-and-security/security-config#localhost)
  allowing device-loopback cleartext; that route cannot reach the host/cloud
  and no configured QA client uses it. Other non-loopback hosts remain denied.
  The instrumented boundary test verifies
  the trust-store fingerprint and rejects a TLS server with an unrelated
  certificate through the local emulator alias. Start that oracle before the
  instrumented tests; it never opens an external connection:

```bash
python3 scripts/hu090-local/negative_tls.py
```

The negative server binds only `127.0.0.1:5998`, creates an ephemeral self-signed
certificate with the correct host IP, and removes its private key on shutdown.
The test requires `SSLHandshakeException`; refusal or timeout does not pass.
Its console must contain no `FAIL: HTTP reached` line. It requires no credentials
or Firebase data changes. Run `LocalValidationBoundaryTest` on the isolated
Debug harness described below; ordinary Debug skips this class.

## Validation lanes

Instrumented tests use the standard Debug target. Opt in to the isolated demo
configuration for tests that need local Auth, Firestore, Storage or the gateway:

```bash
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -Phu090LocalDebug=true
```

The local SDK/boundary and Activity-recreation tests grant `ACCESS_LOCAL_NETWORK`
through an API-37-only permission rule after each connected-test reinstall.
Manual APK installation needs `adb install -g` or an explicit grant to
`com.reguerta.user.debug`. Stop the Android CLI UI
controller on the task device before instrumentation so its automation service
does not conflict with the runner. Start the local services and negative TLS
oracle above, then run the internal SDK, serialization and boundary tests:

```bash
adb -s <task-device> shell am force-stop com.android.cli.interact.instrumentation
ANDROID_SERIAL=<task-device> ./gradlew :app:connectedDebugAndroidTest -Phu090LocalDebug=true
```

This flag preserves the isolated demo endpoints and TLS policy while retaining
Debug's unoptimized runtime. These tests establish internal contracts on the
recorded Debug variant/device; they do not validate the optimized QA APK.

Exercise the exact optimized `releaseValidation` APK through external UI
automation or a recorded manual journey. Record its SHA-256, device/API,
fixture state, observable results and crash logs alongside the HU evidence.
Keep that APK unchanged throughout the journey. The supported Android approach
for future automated release journeys is a self-instrumenting test module with
UI Automator, running outside the target process and importing no app classes.
[Google's UI Automator guide](https://developer.android.com/training/testing/other-components/ui-automator)
explicitly supports testing minified release apps from outside their process.
No separate UI test module is added by this harness.

The attempted in-process optimized-QA tests failed during runner startup,
first on `androidx.tracing.Trace` and then on `kotlin.LazyKt`. AGP excludes
shared runtime libraries from the test APK, while R8 may remove their unused
classes or methods from the app. Remapping names cannot restore those entry
points. The temporary tracing JAR workaround was removed; the harness does not
copy shared runtime libraries or retain app APIs only for tests. These attempts
provide no passing optimized-QA instrumentation evidence and establish no app
regression because test bodies never ran. Paths not exercised through the
optimized app's UI remain pending.

Run the pure fixture-boundary tests without starting Firebase:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -O -m unittest discover \
  -s scripts/hu090-local -p 'test_*.py' -v
```

Endpoint JVM tests additionally prove invalid QA endpoints fail before token
or transport access. Actual app/emulator evidence is recorded separately by
the HU validation runner; this README does not claim it has already passed.

## Real SDK order-status outcomes through the optimized UI

`order-status-fixture.json` and `seed_order_status.py` own exactly three orders
and three lines. They intentionally use `2026-W45`: on Tuesday 2026-11-10 the
operational Received orders screen consults the previous week; current-week
history is read-only. Use the producer fixture, open Received orders and By
member, then tap the Pending status (READ) to advance to Prepared:

```bash
python3 scripts/hu090-local/seed_order_status.py
python3 scripts/hu090-local/seed_order_status.py --read
```

The member row is denied by the independent fixture rule on `hu090-denied`;
verify its exact permission message and unchanged server document. The admin
row is allowed; verify both the Prepared UI and server vendor status. After the
three rows have loaded, remove only the transient missing-order document:

```bash
python3 scripts/hu090-local/seed_order_status.py --remove-missing-order
```

Its producer row must produce SDK `NOT_FOUND`, the generic failure message and
no permission-denied message. Removing it before initial load would exercise
the screen's auto-mark/read load failure instead of the status-write boundary.
Finally remove all six exact task-owned document paths and verify absence:

```bash
python3 scripts/hu090-local/seed_order_status.py --cleanup
python3 scripts/hu090-local/seed_order_status.py --read
```

The seeder refuses to overwrite any existing fixture document. These outcomes
validate the actual optimized client and SDK error classification against local
Rules; they make no production Rules, real backend or cloud-canary claim.
