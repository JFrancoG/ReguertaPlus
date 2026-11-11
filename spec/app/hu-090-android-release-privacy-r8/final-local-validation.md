# Final local QA and candidate performance — HU-090

Executed locally on **2026-11-11**, against application source at `5ab157ff`.
**Cart comparison and remaining available QA pass; both matched performance
pairs meet all approved local regression limits.** No application/navigation,
backend, dependency or advertising configuration changed. The local measurement
harness and its tests were corrected. This local validation checkpoint preceded
the subsequently authorized commit/push described below; no publication is
included. HU-090 remains open for the independent remote and #228 gates.

The [machine-readable summary](final-local-evidence-summary.json) owns the
current numbers and receipt names. Execution files are under
`/tmp/hu090-final-local-evidence`; the durable destination is
`/Users/jesusf/Projects/Reguerta-artifacts/hu-090/2026-11-11-final-local`. Cleanup/archive closeout is recorded at the end below.
Earlier camera/lint and performance receipts retain their original artifacts
and scopes; none of their samples is reused in the new accepted pairs.

## Exact pair and provenance

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Unoptimized QA APK | 70,821,025 | `148bd63a4398d2038a32547bc41a811f3fa2917cd6583c0bda65e9160f5e1811` |
| Optimized QA APK | 8,989,043 | `5addeb32111f310626d6196ae7e763723bb817a7a2af5e77f0a20c4d73b2f62f` |
| Associated existing Release AAB | 11,036,005 | `ecccb860393e7c68797ff8600d8810b976576621f8bc806941289d3b60c3ef0f` |

The optimized APK/AAB/mappings are exact retained lint candidates. The new
baseline uses the same `releaseValidation` sources/pins with
`-Phu090Optimization=false`; its build passes in 1m 1s. Both QA APKs are
non-debuggable `com.reguerta.user.validation`, versionCode 37, with the same
Debug signing certificate, permissions and LocalValidationApplication. The
native payloads are byte-identical (eight ELF libraries); both ZIP alignment
checks pass with 16 KB alignment. QA DEX bytes are 68,678,396 → 7,282,420;
those are QA sizes, distinct from the Release AAB's existing analyzer result.

356 archived Android public files remain identical; only the two measurement
Python files differ. There is no changed input to the APKs. Existing exact
Release privacy/R8/analyzer/mapping/retrace checks and 505 JVM / 85 connected
passes with three skips and zero strict lint diagnostics remain valid within
[their documented scope](lint-validation.md). They were not rerun for unchanged
app inputs. Ordinary Release retains non-advertising Analytics, Crashlytics
and FCM; QA keeps its existing emulator-only SDK substitutions.

## Recreation diagnosis — same established behavior

Both APKs on **API 29 and API 37/16 KB** were observed through real
portrait-to-landscape Activity recreation, established by changed display
bounds/rotation and native relaunch/create/destroy events. The app process is
preserved. From My cart, the destination becomes Home. Reopening My order
retains HU090 Carrots, one unit and total €2.50; both variants reopened the cart
panel directly. Settled landscape quantity hit regions correctly produce
1 → 2 → 1 units and €2.50 → €5.00 → €2.50. Drafts were emptied afterward;
no Finish order action or backend order write occurred. As an independent
route control, News remains News after the same actual recreation in both APKs.

[HomeDestinationSaver](../../../android/Reguerta/app/src/main/java/com/reguerta/user/presentation/home/ReguertaRootHomeRoute.kt)
applies [restoredHomeDestination](../../../android/Reguerta/app/src/main/java/com/reguerta/user/presentation/home/ReguertaRootHomeModels.kt)
on save and restore. It explicitly maps MY_ORDER to DASHBOARD so reentry passes
through the HU-022 freshness gate. Commit `405161c5` predates HU-090; the saver,
helper and [existing navigation regression](../../../android/Reguerta/app/src/test/java/com/reguerta/user/presentation/home/HomeNavigationTest.kt)
are identical to `ea367ac9`. Current runtime agrees with this source-backed
policy, with no observed R8 difference. The earlier uncertainty in the lint
receipt is resolved by this diagnosis; no navigation behavior was changed.

The test initially assumed reentry showed the catalogue. It actually already
showed My cart: an extra View tap toggled it closed, then another reopened it.
Raw snapshots establish this selector mistake, not an ignored tap or hydration
bug. Latest news is also below the fold in landscape and is a non-clickable
dashboard heading; Home was identified by its menu/tiles, and News was entered
through the portrait drawer. These failed probes remain in the evidence.

## Remaining available QA

API 29 now has observed landscape, compact-to-expanded-to-compact configuration
coverage, restored draft/hit targets, and an intact default Circle launcher
icon. The emulator emits host ColorBuffer warnings despite correct observed
rendering; no general emulator graphics-health or frame-time claim is made.

Android 17 Pixel Launcher offered Circle, Square, cookie and Arch shapes.
Actual **Square** was exercised with Default/Minimal themed styles in light
and dark modes; all four inspected renders preserve the complete readable Ü.
Circle/Default/night-no were restored. Earlier Circle/themed and camera/gallery
checks belong to the same exact optimized APK and remain in the lint receipt;
no repeat camera/gallery run is claimed on these new AVDs. All new screenshots
were visually inspected before subsequent actions. Physical/OEM launchers,
other shapes and physical cameras remain outside the observed coverage.

For the editable cart window, only the owned guest clocks were temporarily set
to Friday 2026-11-13. Host/server time and fixture timestamps were unchanged.
Guest clocks, locale, window, rotation, auto-time and theme settings were
restored; final clock deltas are under three seconds. Both final crash buffers
are empty. Per-device details are `api29-qa-journey.md`, `16k-qa-journey.md`,
`16k-icons-qa.md` and `post-performance-device-receipts.json` in the archive.

## Accepted performance protocol and results — V3 only

Run sequentially on the same owned device for each pair: fixed image/API/page
size, RAM/CPU/window, tool versions, signing/version, fixture and authorized
Home state; ART compilation mode `speed`; three warm-ups, **20 process-cold
starts**, then **five PSS samples in each state after 60 seconds**. There were
no parallel builds/profilers/other UI jobs from this session, and the other
owned QA app was stopped. Host load is retained in every raw report. These
are relative local `am start -W` TotalTime and total PSS, not TTID, Play vitals
or measurements of a cloud-connected exact Release AAB.

Startup columns report median / nearest-rank P90; memory uses median / max:

| Device | Metric | Without R8 | With R8 |
| --- | --- | ---: | ---: |
| API 29 / 4 KB | Startup median / P90, ms | 261 / 299 | 251.5 / 274 |
| API 29 / 4 KB | Home PSS median / max, MiB | 217.66 / 217.81 | 144.87 / 148.06 |
| API 29 / 4 KB | Background PSS median / max, MiB | 217.15 / 217.17 | 144.79 / 144.81 |
| API 37 / 16 KB | Startup median / P90, ms | 279.5 / 310 | 260.5 / 305 |
| API 37 / 16 KB | Home PSS median / max, MiB | 164.89 / 164.89 | 106.01 / 106.01 |
| API 37 / 16 KB | Background PSS median / max, MiB | 161.14 / 165.66 | 102.30 / 106.78 |

All **six statistics per pair** satisfy the approved limits: increases no
larger than `max(10%, 50 ms)` for startup and `max(10%, 10 MiB)` for PSS.
Every accepted delta is negative; no threshold exception or repeated matching
pair was required for V3. Independent calculations from raw values agree.
The 92 native starts (12 warm-ups + 80 measured) and 40 PSS readings match the
reported arrays and strict runtime fences.

### Measurement safeguards and discarded attempts

The harness now stops/verifies the Android CLI controller after every Home
snapshot, observes Home **before** settling, and never reopens layout during
memory settle/sampling. Each PSS sample checks controller absence, target PID
and foreground/background state. It resolves HOME once and requires two
consecutive observations of that exact launcher before target force-stop/PID
absence and the timed start. A result needs one `Status: ok`, the exact target
Activity and `COLD` when LaunchState is emitted. The comparator requires all
23 launch fences, 24 quiesced Home snapshots and sample-state evidence per report.
**21 focused Python tests pass**; independent review found no blocking defect.

The initial fixture preflight preceded fresh-session preparation. Cleaning
only the owned QA app before either pair removed guest-clock caches and caused
two expected initial local lastDeviceId registrations. The final full-dataset
freeze was taken after that preparation: SHA-256
`cbbc10006ea939ae8f67700cca4a555d535431d57b42000057498f78365e1bde`, 12 documents.
All V3 pre/post readbacks match that full hash; there was no reseed or app-data
reset between variants. Four plus/compat order collections stay empty. No
changed fields were normalized away or silently ignored.

The first API 29 timing run (V2) returned launcher Activity times of 7/6 ms for
warm-up ordinal 3 and overall launch ordinal 11. Home observed later could not
validate those timings. The **entire V2 report, including its memory samples,
is rejected** and retained with its raw outputs; none contributes to V3. The
harness was then corrected and the complete pairs rerun under the explicit new
protocol. Older performance receipts are also historical and not comparable
to V3 merely by substituting their hashes or summaries.

## Acceptance boundary and closeout

This batch closes the current-candidate local performance evidence for AC-08
and resolves the cart/R8 recreation diagnosis. It strengthens the remaining
available window/launcher QA. Application/privacy/R8 configuration and product
parity are unchanged; iOS/backend are untouched. It does not establish real
Analytics/Crashlytics/FCM delivery, historical persisted consent, Console
settings, production authorization, physical/OEM coverage, or Play acceptance.

The exact-AAB cloud canary and external telemetry/FCM still need separate
bounded authorization. `develop` is a namespace in the configured Firebase
project, not by itself an isolated project; this batch never accesses it live.
Secure-store #228 remains an independent distribution gate. No merge, HU
closure, production operation, publication, artifact/mapping upload or Git
delivery is inferred from the local results.

Cleanup passes: the full fixture hash and empty shared-profile Storage prefix
were read back before stopping the fixed demo services, without export or
collection deletion. All required ports and the additional owned ports are
free. Process argv/PID and AVD-path preconditions were verified before stopping
only the owned services/AVDs and removing their two temporary directories/two
INI files. SDK, other AVDs/processes and production remain untouched.

The durable archive contains **489 execution files**, compared byte for byte
with the execution copy; candidate hashes and its SHA-256 manifest verify.
Transient Python caches are excluded. Final repository documentation/harness
snapshot has a separate `repository-snapshot-manifest.json`. The original
execution paths/hashes remain provenance. This checkpoint was local and
uncommitted, with previous delivery `5ab157ff`; the snapshot is retained as
historical validation evidence rather than rewritten during Git delivery.

[Final tracker progress receipt](https://github.com/JFrancoG/ReguertaPlus/issues/282#issuecomment-6794165453) records this local outcome and keeps HU-090 open; it is not a Git delivery or distribution receipt.

## Subsequent Git delivery authorization — 2026-11-11

The owner requested commit/push of the corrected measurement harness and this
batch's documentation to the existing HU branch, keeping HU-090 open. Delivery
preparation changes only documentation/changelog. The two Python files match
the archived 21-test receipt; their recent tests and V3 results are reused
after hash verification, with unchanged application/build inputs and exact
candidate hashes. No emulator restart or new build is needed for this delivery.
Git history and issue #282 own the final commit/push receipt. Application source,
artifact hashes and their `5ab157ff` provenance remain as recorded. No merge,
closure, publication, production access or binary/mapping upload is included;
exact-artifact cloud/FCM and #228 remain independent pending gates.
