# Local validation - HU-090

> Historical receipt for the pre-camera-fix artifacts below. The preview
> finding is corrected in the [separate camera follow-up](camera-fix-validation.md),
> which records new hashes and results. The original performance measurements
> are not measurements of the new binary.

## Scope and provenance

Execution date: 2026-11-10. The owner authorized Android implementation and
local validation only. No publication, Firebase deployment, production access,
Console declaration, mapping upload, cloud canary or real FCM send was performed.

Base: `cfbd59bc7b60c5ef0838af6628d0e57c983f9c9b` on
`codex/hu-090-android-release-privacy-r8`, integrating main `7491ebae` and the
dependency update `0cff11eb`. These are **working-tree builds captured before
the implementation commit**. Source/configuration hashes,
tool outputs and exact binaries are retained in the local evidence archive.
Private signing/Firebase configuration is not included in repository evidence.
App Java/Kotlin bytecode targets Java 17. The recorded Gradle launcher is
Amazon Java 21.0.6; daemon criteria select Java 21/JetBrains from the existing
`gradle-daemon-jvm.properties`. The host runtime and app bytecode target are
different settings; neither was upgraded by this implementation.

The owner subsequently authorized commit/push of the HU branch on 2026-11-10,
keeping the story open. Git history and issue #282 own the delivery receipt;
the binary provenance above remains the original measurement state. Before
commit preparation, all 369 archived public Android source records matched the
current tree with zero drift. The existing unit, connected, artifact and
performance evidence is reused; only delivery documentation/changelog changed
during this step. Whitespace, JSON, links, scope and staged-file checks are
performed again. Existing lint/camera/canary/#228 gates are not waived.

The pristine pre-change Release was also rebuilt offline from detached main
`7491ebae`, with tracked sources clean and zero upload/publication tasks.
Its AAB is 22,001,243 bytes, SHA-256
`7ebb7202b1fc29f0e7dd31ede119602f8574e6df0bacfa0a7e5355db761ed89f`,
with 68,674,188 DEX bytes and the original advertising permissions. This is fresh
context from the selected pins, distinct from the older dirty-tree observation.
Its temporary worktree and private build inputs were removed after archiving.

The paired baseline is unoptimized `releaseValidation` after the privacy and
local-isolation changes. Its dependencies, PDF behavior, fixture and variant
differences match optimized QA. It isolates the optimization comparison; earlier
dirty-checkout sizes are historical context and are not substituted for it.

## Artifact results

| Measurement | Unoptimized Release | Optimized Release |
| --- | ---: | ---: |
| AAB bytes | 22,002,330 | 11,069,270 |
| APK bytes | 70,900,859 | 9,032,913 |
| Uncompressed DEX bytes | 68,675,776 | 7,272,900 |
| R8 / full mode | disabled | enabled / enabled |
| Resource optimization | baseline | optimized |
| R8/DEX checksum | no R8 metadata | `EXACT_MATCH` |

Exact optimized AAB SHA-256:
`8f427023a0e3afe1f76953051ec8ef2f981bb1e8417b36e977584a70f4a520c9`.
Exact assembled Release APK SHA-256:
`c3908fa858cf618f1cb402fdfa6ba0644b19add8d58e766a7c0f7054bee27480`.

Official Android CLI `1.1.16717390` reports AGP `9.5.1`, R8 `9.5.29`, and
actual R8 metadata ratios: shrinking `0.8825`, optimization `0.8778`,
obfuscation `0.8827`. Each exceeds the approved 0.25 engineering gate. The
candidate is below the documented 10,000,000-byte DEX applicability floor;
metadata and checksum are still required and pass. This is local artifact
evidence, not Google Play acceptance or publication approval.

The quantitative configuration analyzer separately reports optimization
94.41%, shrinking 94.59%, obfuscation 94.60%. These are keep-rule availability
scores, **not** the actual artifact ratios above. No global optimization-disable
switches or app-authored keep rules were found. The largest constraint is the
reCAPTCHA consumer rule; it was not removed or overridden. Full rule provenance
and results are archived separately.

Final merged Release manifest, assembled APK and AAB pass
`scripts/verify-release-privacy.py`: all three advertising permissions absent,
four advertising defaults false, ordinary Analytics not globally disabled.
The guard explicitly does not claim runtime consent verification. The
[privacy inventory](privacy-inventory.md) records remaining identifiers and
the separate Data Safety/Console review.
`assembleRelease` and `bundleRelease` now depend on `verifyReleasePrivacy`,
using that same Python guard against the final merged manifest. Both tasks
pass with the guard selected and keep the exact archived APK/AAB hashes.

## Paired runtime measurements

Both variants are non-debuggable, debug-signed `.validation` apps using the
same demo services, local fixtures and PDF implementation. They differ from
Release as documented in [ADR-0015](../../../docs/decisions/0015-android-release-privacy-and-local-validation.md)
and the [harness README](../../../android/Reguerta/scripts/hu090-local/README.md).
The optimized QA APK SHA-256 is
`25f8d7965985fba46bd25c609912f3a49efb3413fed8485db8f7e4bd0cc15ba9`;
the paired baseline QA APK is
`24b9bfbc20b6a85cfb70ce6f13622fbd0a99cd28828229c094a837f1414046d6`.

Protocol: ART `speed` compilation, three warm-ups, 20 force-stop process-cold
launches without clearing app data, confirmed `Latest news` Home on every
launch, five total-PSS samples after 60 seconds foreground and five after
60 seconds background. Each memory state is checked against the resumed app.
No parallel host build or profiler ran during measurements.

| Device / measurement | Baseline | Optimized |
| --- | ---: | ---: |
| API 29, 4 KB: startup median / P90, ms | 208.5 / 311 | 178.5 / 206 |
| API 29: foreground median / max PSS, bytes | 228,902,912 / 233,126,912 | 149,550,080 / 152,564,736 |
| API 29: background median / max PSS, bytes | 228,185,088 / 228,185,088 | 144,391,168 / 144,391,168 |
| API 37.1, 16 KB: startup median / P90, ms | 285 / 319 | 266 / 307 |
| 16 KB: foreground median / max PSS, bytes | 171,051,008 / 171,051,008 | 108,723,200 / 108,723,200 |
| 16 KB: background median / max PSS, bytes | 167,175,168 / 172,006,400 | 104,868,864 / 109,638,656 |

Both pairs pass the approved local regression limits without an exception.
Exact serials: task-owned `emulator-5564` (`HU090_API29`, SDK 29) and
`emulator-5562` (`HU090_16K`, SDK 37, Android 37.1 system image). Confirmed page
sizes are 4096 and 16384. Full fingerprints, AVD profiles, host/tool versions,
loads and all command/sample outputs are retained in the JSON reports.

Fixture identifier for all four accepted runs:
`hu090-local-36dd87dce41348d8`. Auth/session data was retained across each pair;
the local fixture was not reseeded. Later functional-test fixtures are separate.
The first API 29 attempt failed before warm-ups because the legacy UI dump
could not acquire UI automation. It is retained as a failed attempt; accepted
pairs both use Android CLI layout plus resumed-package checks.

These samples measure `am start -W` TotalTime and total PSS. They do not measure
TTID or Play's 28-day P90 Anon RSS + Swap metric.

## Repository gates and remaining local checks

- Debug JVM unit tests: **489 passed**, no failures/errors/skips.
- Local Debug connected suite on the dedicated API 29 AVD: **38 passed,
  two skipped**. The skips are the separate opt-in Sheets acceptance and the
  package-metadata inspection requiring API 33+. Other local boundary tests,
  real SDK error codes, emulator denial, Auth/Storage/image adapters,
  serialization, AndroidKeyStore/Tink migration and Compose checks pass.
- Final local Debug suite on the 16 KB AVD: **39 passed, one skipped** (the
  separate opt-in Sheets acceptance). The modern package/provider inspection
  and real negative TLS handshake pass here too. The LAN permission is granted
  by scoped test rules after reinstall, and the external UI controller is
  stopped before instrumentation. Initial failures from its automation-service
  collision, the Android-17 implicit localhost policy and a missing LAN grant
  are retained as failed attempts; they are not silently converted into passes.
- In-process optimized-QA instrumentation was abandoned after runner startup
  failures on shared classes removed/inlined by R8 (`Trace`, then `LazyKt`).
  AGP's runtime subtraction/name mapping does not restore these APIs. The
  temporary tracing-JAR workaround and QA test selector were removed; the
  target APK stayed identical. Neither attempt counts as a test pass. Internal
  contracts use isolated Debug; optimized behavior uses the unchanged APK's
  external UI journeys, with no app keep rules or optimization bypass.
- Local Debug lint reports 135 pre-existing warnings and two hints, with no
  new findings against main's 136 warnings/two hints. Ordinary Debug lint also
  passes its command with 136 warnings/two hints, matching main. Existing
  warning debt remains an unmet warning-free
  repository gate; command success is not a waiver.
- Four deprecated Tink test-fixture calls were replaced with the supported
  `generateNew(parameters, configuration)` overload. The subsequent Debug
  instrumentation build has no Kotlin deprecation warnings.
- Release/QA builds and lint-vital tasks pass. NDK `28.2.13676358` is installed;
  the previous missing native-strip-tool diagnostic is absent.
- Static checks pass for every one of the eight native libraries across four
  ABIs: ELF LOAD/RELRO criteria, native ZIP offsets and `zipalign -P 16`.
  AAB config requests `PAGE_ALIGNMENT_16K`. DEX and native bytes match between
  AAB, assembled APK and universal APK derived with bundletool 1.18.3.
- The AAB's embedded mapping matches the archive byte for byte. Local Retrace
  recovers the independently expected `firebaseFunctionUrl` source frame;
  an unmapped negative control remains unmapped. No mapping was uploaded.

## Exact-AAB offline smoke and advertising state

The universal APK derived from the exact AAB is
`710faff3675b091dcf37cbb5a6f1c62473407ec55b63a51f3f99603872fe3c70`.
It uses the standard local debug certificate; signing identity differs from
the Release AAB/APK, while all DEX/native bytes match. This does not reproduce
Play signing/delivery or the later exact-artifact cloud canary.

The entire task-owned API 29 AVD was offline before installation and remained
offline through uninstall. Connectivity reported no active default network and
no nonlocal route. The app launched without a fatal exception and displayed the
expected version-check-unavailable recovery screen. SDK logs on this fresh
installation, in order, show:

1. Analytics measurement collection enabled.
2. Manifest `ad_storage=denied`, `analytics_storage=uninitialized`;
   advertising personalization denied and `ad_user_data=denied`.
3. Locally logged automatic `first_open`, `session_start` and `screen_view`.

All advertising defaults are observed before the first logged event. There was
no consent grant or new consent UI. This establishes fresh-install local SDK
state and event acceptance, not external delivery, historical persisted consent,
Console configuration or real FCM operation. The Release package was uninstalled
while offline, the AVD powered off, then restarted with `-wipe-data` and no
snapshots before any network restoration. Queued SDK data was not retained in
an online environment.

## Optimized external UI journeys and known finding

On the exact optimized QA APK hash recorded above, the 16 KB AVD passes local
Auth/login/session restoration, Home, PDF rendering across several pages with
no model-download UI, Gallery cancel/select/upload/visible preview, camera
permission denial/grant/cancel/upload, notification permission denial/settings
grant/feed, and valid cold/warm notification references. A malformed reference
is ignored. These are local intents and fixture responses, not FCM delivery.

The real optimized Orders adapter also passes three independently observed
outcomes: allowed write with matching server state, `PERMISSION_DENIED` with
the exact denial message and unchanged document, and real SDK `NOT_FOUND` with
the generic failure message and absent document. The operational route used
2026-W45 because the app's Tuesday window selects the previous week. Synthetic
fixtures and deliberate missing-document transition are reproducible; all six
order/orderline fixture documents were cleaned up afterwards.

**Unresolved camera finding:** capture uploads a valid JPEG but its editor
preview disappears. It was reproduced twice with R8 and again in the archived
unoptimized QA baseline. Gallery preview works. An R8-specific regression is
not demonstrated; root cause and production incidence remain unverified.
The complete camera journey is not counted as passing. No product-source fix
or profile Firestore save was performed for this unrelated finding.

## Criterion disposition and retained evidence

| Criterion | Current evidence / boundary |
| --- | --- |
| AC-01 | Final merged manifest, APK, AAB and derived universal pass the advertising guard. |
| AC-02 | Supported defaults and fresh-install offline consent/event order pass; no own re-enable path. External telemetry/FCM and historical/Console state are not verified. |
| AC-03 | Real AAB proves R8/full mode and resource optimization; ordinary Debug remains unoptimized, no custom keep rules. |
| AC-04 | Internal SDK cases pass in Debug; real denied/allowed/NOT_FOUND optimized UI cases agree with independent server state. |
| AC-05 | Actual local AAB metrics/checksum and source/artifact hashes recorded; working-tree provenance is explicit. |
| AC-06 | Local evidence recorded; full camera journey, warning-free gate and exact-artifact cloud canary remain pending. |
| AC-07 | API 29/37, Photo Picker/permission journeys, all native alignment checks, 16 KB runtime and stripping checks recorded. |
| AC-08 | Both complete matched pairs pass without exceptions; not Play vitals. |
| AC-09 | Exact mappings/metadata retained, local retrace positive/negative pass, automatic uploads disabled. |
| AC-10 | Inventory and EN/ES ADR/stack updates complete locally; complete app disclosure/Console submission remains a separate gate. |

The compact [evidence summary](evidence-summary.json) contains hashes, all
accepted performance samples/summaries and test counts. Full local artifacts,
mappings, analyzer results, command logs, screenshots and receipts are archived
outside Git at `/Users/jesusf/Projects/Reguerta-artifacts/hu-090/2026-11-10-local`.
The archive also retains failed attempts and the original source snapshot.

## Acceptance boundary

Keep HU-090 open. AC-06 still requires a separately authorized exact-artifact
cloud canary with trusted reviewer routing to develop. Local QA, fixture Rules
and gateway responses do not establish real backend authorization or real FCM
delivery. Secure-store distribution gate #228 remains independent. No iOS or
backend implementation, user-visible feature-parity gap or production-data
change is introduced by this Android work.
