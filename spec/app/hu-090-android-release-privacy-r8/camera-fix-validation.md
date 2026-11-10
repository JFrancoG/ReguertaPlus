# Camera preview correction - HU-090

2026-11-10. Local validation of the follow-up to `66ecebc23bb358efee766c966f174fd52bdb3e82`
on `codex/hu-090-android-release-privacy-r8`. The owner authorized correcting the
Android preview and local validation. No publication, production access, cloud
canary, SDK telemetry submission or mapping/symbol upload was performed.

## Cause and change

On the original optimized QA, capture uploaded a valid JPEG but returning to
the editor lost both its preview and typed text. Foreground session refresh
runs after 15 seconds: `applyAuthorizedSession` replaced the unsaved shared
profile draft with its remote snapshot, advanced the editor revision and
cleared upload ownership. This also rejected results still in flight. A slow
gallery round trip did not reproduce the baseline failure; it is not assumed
to have the same Activity lifecycle as the external camera.

The authorization reducer now reconciles the editor atomically with the current
state. For an equivalent authorized context, it preserves dirty drafts,
intentional photo removal and active save/upload/delete ownership. A pristine
editor can receive remote updates. A remote read started before a newer local
save/delete acknowledgement cannot replace that newer profile snapshot.
UID, member, environment, role and capability transitions retain the existing
epoch/revision fences and invalidate the old editor and callbacks.

Only the authorization actions/reducer and their JVM regressions changed in
production/test source. Dependencies, image picker, backend, non-advertising
Analytics and R8 configuration are unchanged. Independent read-only review of
the final diff found no blocking issue in these state/authorization boundaries.

## Regression and local gates

- The initial regression set failed against the original production code:
  65 concurrency tests, five failures. After the fix and an additional UID
  boundary case, all 66 concurrency tests pass. Ten added cases invoke the
  production `refreshSession(FOREGROUND)` action with controlled repository
  completions and independent expected values.
- Full JVM suite: **499 passed**, no failures, errors or skips.
- Normal Debug lint: **136 existing warnings and two hints**, no new findings.
  Isolated local Debug has 135 warnings and two hints (test application label
  differs). Command success does not waive the repository warning policy.
- Connected local Debug on API 29: **38 passed, two skipped** (40 total).
- Connected local Debug on 16 KB: **39 passed, one skipped** (40 total).
  Both omit the opt-in HU-083 Sheets acceptance test; API 29 also omits the
  provider/registrar package inspection that uses the API 33+ metadata API.
  The remaining isolation tests pass on both, and current artifact manifests
  independently cover provider/registrar removal.
- Debug/local test APK, optimized `releaseValidation`, Release APK and Release
  AAB builds succeed. No new Kotlin compilation warning or native stripping
  diagnostic occurred.

Commands from `android/Reguerta`:

```bash
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug \
  :app:assembleDebugAndroidTest :app:assembleReleaseValidation \
  :app:assembleRelease :app:bundleRelease -Phu090LocalDebug=true
./gradlew :app:lintDebug
ANDROID_SERIAL=emulator-5564 ./gradlew :app:connectedDebugAndroidTest -Phu090LocalDebug=true
ANDROID_SERIAL=emulator-5562 ./gradlew :app:connectedDebugAndroidTest -Phu090LocalDebug=true
```

Ordinary Debug/Release were not run against real services. Runtime checks use
the unchanged fail-closed demo-project harness, emulator Auth/Firestore/Storage
and the local gateway. Synthetic users have separate member/producer profile
paths. The user's existing emulator is not used.

## Optimized QA journeys

| Check | API 29 / 4 KB | API 37 / 16 KB |
| --- | --- | --- |
| Camera result keeps visible photo and typed fields beyond refresh interval | Pass | Pass |
| Camera cancellation preserves editor state | Pass | Pass |
| Runtime camera permission denial preserves profile | Pass | Pass |
| Save and independent emulator document/JPEG readback | Pass | Pass |
| Process restart reloads saved photo and text | Pass | Pass |
| Slow gallery selection keeps preview/text | Pass | Pass |
| Intentional image removal survives foreground refresh | Pass | Pass |

API 29 receipts measure about 19 seconds for capture return, 36 seconds for
repeated cancellation, 28 seconds for gallery, and 28 seconds for removal and
foreground return; all exceed the 15-second refresh interval. Screenshots were
visually inspected alongside UI layouts and independent emulator readbacks.
The saved producer JPEG is 3,239 bytes with valid JPEG magic. Only synthetic
local profile/storage data was written.

The first API 29 attempt failed inside the AOSP Camera2 app with
`findCameraId`/`Hashtable.put` after the emulator was started with no front
camera. Restarting that owned emulator with both cameras emulated resolved the
tooling failure; the successful checks above use that configuration. No app
workaround was added. External camera and picker cancellation were exercised. The app also
requests CAMERA at runtime: after revoking the QA permission, denial displays
the expected permission-required message and retains the saved photo and text.
On 16 KB, granting again through Android UI opens the camera; cancellation
after an explicit 21-second wait preserves the profile. No physical-device
check is claimed. Existing focus-dependent Save visibility was handled through the
normal editor exit/re-entry; it was not changed by this fix.

## New artifacts and static checks

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Optimized local QA APK | 9,050,681 | `b3349ee08e7195a6533075ffc3d9c4781f2dab4fdb8c884e78e083fc966b784e` |
| Release APK | 9,032,913 | `4f86f652c43f9dadb6415985c9f8ba6ba3d8001600dc443192f3ac44955348cf` |
| Release AAB | 11,069,669 | `834845a7326ab62eb7e368c615cdde413ffd68d227036cccd4a1847cdf634523` |
| Release mapping | 89,443,189 | `643fc457e56328e1f0dff80c4eb49ef26434abcf5462db4a97b470450d4b4d6a` |

Fresh Android analyzer: uncompressed DEX **7,273,732 bytes**, R8 9.5.29,
optimized resources, `EXACT_MATCH`; shrinking/optimization/obfuscation ratios
0.8825 / 0.8778 / 0.8827. Release privacy guard passes with advertising
permissions absent and advertising defaults false while non-advertising
Analytics remains configured. QA runtime telemetry remains intentionally off.

Both APKs pass ZIP alignment for 16 KB; AAB requests 16 KB page alignment.
Eight native payloads are byte-identical to each other and to the previously
validated payloads, so their archived ELF LOAD/RELRO proofs are reused by exact
hash identity. Release APK/AAB DEX contents match. Embedded mapping matches the
new mapping file exactly; local positive and negative retrace controls pass.
No mapping was uploaded. No extra keep rules or suppressions were added.

The original [paired startup/PSS results](validation.md) remain historical for
their original hashes. This functional correction does not claim a new paired
performance measurement. Any exact-artifact cloud canary must use the eventual
reviewed candidate, not the superseded pre-fix artifact.

## Evidence and remaining scope

Local archive:
`/Users/jesusf/Projects/Reguerta-artifacts/hu-090/2026-11-10-camera-fix`.
It retains source/hash provenance, regression red/green XML, full unit/lint and
connected receipts, layouts/screenshots, emulator readbacks, exact artifacts,
analyzer output, static checks and cleanup evidence. Large binaries, mappings
and synthetic emulator tokens remain outside Git. Cleanup verified deletion
of the two synthetic profiles and eight images, stopped the task servers and
removed its two temporary AVDs. The user’s existing emulator was untouched.

This closes the camera defect locally. HU-090 remains open for existing warning
debt, the separately authorized exact-artifact cloud/FCM canary and secure-store
gate #228. iOS/backend were not changed or retested; no cross-platform contract
changed. The owner subsequently authorized commit/push of this correction and
its documentation on the existing HU branch, keeping the story open. Git
history and issue #282 own the receipt; no merge or additional runtime action
is included.

For delivery, the archived 368 public Android source records are compared with
the current tree. With zero drift, the unit/connected/build/artifact and manual
QA results above are reused. Delivery preparation changes only documentation
and the changelog; whitespace, local links, staged scope and remote readback
are checked separately. This does not waive the existing warning debt.
