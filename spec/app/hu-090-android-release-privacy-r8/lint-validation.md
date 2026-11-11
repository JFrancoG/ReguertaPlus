# Lint implementation validation - HU-090

Executed locally on **2026-11-10/11** at base `ea367ac9`. The approved lint
implementation and local checks are complete within the documented emulator/
launcher scope: **505 JVM tests passed**,
**85 connected tests passed with three expected skips and zero failures**, and
Debug/Release/releaseValidation strict lint contains **zero diagnostics**.
This is local validation, not HU completion or distribution readiness. No
publication, production operation, cloud canary, commit or push was performed
as part of this lint execution.

Durable receipts are retained at
`/Users/jesusf/Projects/Reguerta-artifacts/hu-090/2026-11-11-lint`.
The 950 execution files were compared byte for byte with the execution copy,
its `archive-manifest.json` records SHA-256 entries, six candidate-artifact
hashes verify, and all 358 public source records match without drift.
Transient `node_modules` and `__pycache__` directories are excluded; tooling
lockfiles and provenance remain. Final documentation is copied separately under
`documentation/` with `documentation-manifest.json`. Exact data/runtime cleanup
receipts also pass.

## Batch A — PASS

Gradle distribution 9.9.1 and wrapper checksums independently match official
metadata. Initial Python HTTPS lookup failed due to that interpreter’s CA
configuration; system curl verified the same endpoints without weakening TLS.
The old wrapper first generated the 9.9.1 wrapper; a second run uses 9.9.1
and runs ordinary Debug lint on unchanged app sources.

Fresh normal Debug lint with Gradle 9.9.1: **135 warnings, two hints, zero
errors**; only the wrapper-version warning disappeared. Distribution SHA-256
`d8a18a7a841dd5df825d35a685fad6f2d7f12ac0c280e57b67c27b4a520ba228`
and wrapper JAR SHA-256
`621008afc4f5d59357fcf06ffa644dd5aade5e091bdc363742710445f73cdaf8`
match official metadata. Plugin configuration/lint passed at this isolated
batch checkpoint; the final build results are recorded below.

## Batch B — PASS

Removed 95 unused string names (190 EN/ES declarations), eight declarations
for four unused color names, and the unused drawable foreground. The live
mipmap foreground is retained. Two deletion-script preflight attempts stopped
before any source write because the drawable uses a different inventory shape;
the corrected preflight validates every candidate/XML before writing.

Fresh normal Debug lint: **32 warnings, two hints, zero errors**. Exactly 103
findings disappeared, including the three overlapping typo/vector/namespace
diagnostics. Debug, Release and optimized QA resource processing succeeds.

## Batches C/D/E/F — PASS within the recorded local scope

Four function-scoped UseKtx exceptions preserve Boolean commit-result handling.
The other API, Compose, quantity and launcher changes pass the final local
checks below; device and launcher coverage limits remain explicit.

The first combined C/D/E/F gate compiled and passed **505 JVM tests**. It
removed all original remaining diagnostics but exposed two MissingQuantity
findings (Spanish CLDR `many`) and a Release/QA-only unused resource referenced
solely by a negative UI assertion. These were retained in the first reports,
not suppressed. Both ES quantity resources now include `many`, with literal
EN/ES million-count fixtures. The unused Eco-basket label was removed from the
app; its negative test now checks both known EN/ES labels independently.
A test merely asserting password punctuation was removed; password logic was
not changed and existing behavior coverage remains.

The monochrome vector exceeded the 3,000-character detector limit even after
geometry-preserving command compression. The reviewed raster fallback renders
the original geometry directly at five densities; decoded pixels match the
original render at each size. The master/exporter and renderer provenance are
kept outside Android resources. Actual Pixel Launcher Circle-mask and themed
icon observations are recorded below; no other launcher/mask coverage is claimed.

The final gate enabled `warningsAsErrors` and `abortOnError` and passed ordinary
Debug/Release/QA lint, JVM tests and all APK/AAB builds. Runtime checks used
new owned API 29/16 KB AVDs and the existing local-only demo harness.

## Final build and unit gate — PASS

Executed 2026-11-10/11 locally. Ordinary Debug, Release and releaseValidation
reports contain **zero diagnostics: no errors, warnings or hints** with
`warningsAsErrors = true` and `abortOnError = true`. No baseline/filter/global
suppression was added. Exactly four approved function-scoped UseKtx exceptions
preserve commit-result error handling. Full JVM suite: **505 passed**, no
failures, errors or skips. Debug, optimized QA, Release APK and AAB all build;
no Kotlin/Java compilation warning or native-strip diagnostic was emitted.

The final normal gate completed in 3m 7s. Separate local Debug/test APKs were
built with `-Phu090LocalDebug=true` before device use. Those apps use demo
Firebase emulators only; ordinary Debug/Release are never run against services.

## Current exact artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Optimized QA APK | 8,989,043 | `5addeb32111f310626d6196ae7e763723bb817a7a2af5e77f0a20c4d73b2f62f` |
| Release APK | 8,971,283 | `b3e123a0b2752192053b7d06f244bce500b7f89c7324f95cd43cf34fac1c9c88` |
| Release AAB | 11,036,005 | `ecccb860393e7c68797ff8600d8810b976576621f8bc806941289d3b60c3ef0f` |
| Release mapping | 89,461,287 | `013d1871770915f1018d469efce4f23683a72221973fa224463d2dc07a9e9024` |

Official `android analyze`: **7,274,268 uncompressed DEX bytes**, R8 9.5.29,
full mode, optimized resources and `EXACT_MATCH`. Shrinking/optimization/
obfuscation ratios: 0.8826 / 0.8778 / 0.8827. These are artifact metrics, not
a new startup/PSS performance measurement or store acceptance.

Independent static checks pass: Release privacy and QA isolation, both APKs'
16 KB ZIP alignment, DEX headers/metadata identity, exact embedded/new mapping,
and new-mapping retrace with positive and negative controls. Eight ELF payloads
are byte-identical across artifacts and to the previously verified binaries;
LOAD/RELRO proofs are reused only by that identity. Effective non-comment R8
rules are unchanged; configuration-file hash differences come from Gradle cache
path comments. No new keep rules, app dependency or advertising permission was
introduced; permitted Analytics is not globally disabled in Release.

## Local runtime — PASS with observed limitations

API 29 local Debug: **42 passed, two skipped** (44 total). The skips are the
opt-in HU-083 Sheets acceptance and API-33+ provider metadata inspection. New
resource quantities use independent EN/ES 0/1/2/million examples and two-count
combinations. Remaining isolation/SDK/image/migration/UI checks pass.

API 37/16 KB local Debug: **43 passed, one skipped** (44 total). The skip is
the opt-in HU-083 Sheets acceptance. Together, the two suites report **85
passed, three skipped and zero failures** in `connected-summary.json`. The
current optimized QA APK is exercised externally; internal connected tests
remain on the isolated Debug variant, not an in-process optimized target.

API 29 optimized QA: exact installed hash verified. Auth with IME, a camera
return beyond the refresh interval (39.071 s), retained text/photo, local Save,
authoritative emulator document/JPEG readback and cold restart pass. The saved
JPEG is 3,639 bytes. PDF pages 1–4 rendered; pages 1/2 were visually inspected.
Home is readable in controlled 320×700 dp and 600×900 dp windows. Window settings
were restored exactly. The attempted rotation command left API 29 portrait;
no landscape claim is made from that attempt. Pixel launcher visually shows
the retained green QA mark and orange local Debug mark under its round mask.
The API 29 crash buffer contains a fatal entry from shell UID 2000
`app_process`; it is not an empty buffer and is not attributed to the app by
this receipt. The saved-profile/readback and cold-restart observations above
are the specific app-level evidence; no general crash-free claim is made.

The first external Camera launch completed AOSP first-run/location setup in
ordinary camera mode. It was cancelled back to the editor; a fresh capture
intent after setup presented Done and returned normally. No app workaround or
permission expansion was added.

API 37/16 KB optimized QA independently passes camera, gallery, cancellation,
permission denial/regrant, Save/readback/restart and intentional removal. A
controlled **guest-only** clock scenario derived from the existing order-window
policy makes the synthetic catalog editable on Friday; adding/removing units
uses local cart state only, never Finish order. Cart geometry/hit regions are
verified after reopening in landscape, resize and RTL. **Observed limitation:**
recreating while on My cart returns navigation to Home. The local draft is
present when reopening, but route/panel retention across recreation did not
pass. This observation is not described as corrected or proven pre-existing.
Guest clock/locale/window settings are restored; host time and demo fixtures
are unchanged. No Finish order or backend order-save action was used; final
local readback found no order documents from these cart checks.

Actual Android 17 Pixel Launcher Circle mask was inspected in light/dark mode,
with the colored default icon and the Minimal/themed monochrome icon. The mark
and tint rendered correctly, and Default/Circle was restored. Coverage is
limited to this emulator's launcher and mask; other OEM launchers, masks,
legacy round-resource selection and physical devices were not verified.
API 29 does not establish themed-icon or landscape coverage.

Detailed receipts are `qa16k-journey.md` and `api29-runtime-validation.json`,
including exact installed hashes, explicit external dwell times, independent
profile/JPEG readback, screenshots inspected before subsequent actions, and
settings restoration. The 16 KB crash log is empty. Its SDK log still records
transient Firestore stream/UNAVAILABLE warnings during external camera and
the guest-clock scenarios; zero lint/build diagnostics does not mean a
warning-free SDK network run. These warnings were not suppressed or labelled fixed.

## Scope and pending gates

All source/configuration and exact artifacts are kept separately from prior
camera/R8 receipts. The previous paired startup/PSS measurements remain
historical for their hashes; no new paired performance measurement is claimed.
Runtime coverage is limited to these owned emulators, not physical cameras or
other OEM launchers. Cart route retention remains the observed limitation above.
HU-090 remains open for independent exact-artifact cloud/
FCM and secure-store #228 gates. iOS/backend and cross-platform contracts are
unchanged. The local implementation/validation checkpoint preceded Git delivery; publication,
production, deployment, external telemetry sends and mapping uploads were not
performed. Cleanup receipts `cleanup-data.json` and `cleanup-runtime.json`
confirm removal of the two exact synthetic profiles and three image objects,
closure of nine task service ports, and removal of both task-owned AVDs.
Process ownership was validated before signals; no unrelated process/device
was targeted. Cleanup diagnostics and successful scoped/preconditioned retries
remain in the receipts rather than being omitted. Durable archival and
manifest/hash verification pass. [The final tracker progress receipt](https://github.com/JFrancoG/ReguertaPlus/issues/282#issuecomment-6782155403)
keeps HU-090 open with the remaining external gates; it does not record a new
Git delivery for these local lint changes.

## Subsequent Git delivery authorization — 2026-11-11

The owner subsequently requested commit/push of the lint changes and HU
documentation to the existing branch, keeping the story open. Delivery
preparation changes only documentation/changelog; all **358/358** archived
public Android source files still match. The successful 505 JVM tests,
85 connected passes/three documented skips, three zero-diagnostic strict lint
reports and build/artifact/runtime checks above are reused without rerunning
unchanged source. Documentation JSON/local links and `git diff --check` pass.
Git history and issue #282 own the final delivery receipt; the artifact hashes
and original working-tree build provenance above remain unchanged. This
authorization includes no merge, issue closure, publication, production access
or artifact/mapping upload.
