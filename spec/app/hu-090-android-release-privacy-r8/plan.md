# Plan - HU-090

## 1. Current outcome, decisions, and authorization

- State: **Privacy/R8, camera and lint local validation recorded; HU acceptance remains pending**.
- Authorized now: commit and push the validated Android lint changes and HU
  documentation to the existing branch, keeping HU-090 open. The earlier
  implementation and local-validation authorization remains recorded below.
  Publication, production access/writes, cloud canaries, live FCM sends, and
  mapping/symbol uploads remain outside authorization. No live services are
  used for this implementation's tests.
- Dependency decision resolved: use main `7491ebae84d49c30e32d27cd5de5a74ff94ee3a3`,
  including Android update `0cff11eb`; reproduce measurements from the eventual
  implementation commit using these pins. Additional upgrades are separate work.
- Privacy decision confirmed by the owner: retain non-advertising Analytics,
  Crashlytics, and FCM; remove advertising identifiers, AdServices access, and
  advertising uses/signals. Ordinary usage reporting and non-advertising
  measurement attribution remain permitted.
- Operator status: owner-reported complete on 2026-11-10. This is not an
  independent Console verification, an app declaration, or publication approval.
- Accepted execution approach: local Release-equivalent validation,
  an exact-artifact canary kept as a separate authorized gate, local artifact
  metrics, and the performance protocol below.
- Original privacy/R8 evidence: [validation and exact historical artifact hashes](validation.md).
  Its paired performance runs and offline SDK observations apply to those
  recorded binaries. The current lint candidate has separate artifacts and
  local results in [lint validation](lint-validation.md); no new paired
  startup/PSS result is claimed for that candidate.
- Current authorized follow-up: camera-preview correction implemented and
  locally validated under section 8; see [new evidence](camera-fix-validation.md).
  Its earlier warning debt is historical; the approved lint follow-up below
  clears current Debug/Release/QA lint. The exact-artifact cloud canary,
  external telemetry/FCM proof and secure-store distribution gate #228 stay open.
  The earlier commit/push authorization was fulfilled by `66ecebc2`. The
  owner subsequently authorized commit/push of the camera correction and
  its documentation on this HU branch, keeping the story open. Git history
  and issue #282 own the new delivery receipt. No merge, HU closure,
  publication or production access is authorized.
- Current authorized follow-up: the owner approved the [lint plan](lint-remediation-plan.md),
  Gradle 9.9.1 and four exact KTX exceptions, and authorized local implementation
  and validations. The local gate now passes with 505 JVM tests, 85 connected
  tests (three expected skips), zero diagnostics in all three strict lint
  reports and fresh artifact/runtime checks. See the [historical inventory](lint-inventory.json)
  and [current validation and limits](lint-validation.md). Cart recreation
  returns to Home with its draft retained on reopening; only Circle-mask
  emulator launchers were checked, and API 29 landscape was not established.
  Exact task-owned cleanup and durable archive/hash verification pass.
  The owner subsequently authorized commit/push of these lint changes and
  documentation on 2026-11-11, keeping HU-090 open. Git history and issue #282
  own the definitive delivery receipt. Publication/production access remains
  outside scope.
- Owner approval on 2026-11-10 supersedes the earlier planning-only limit;
  exact-artifact cloud canary/upload authorization stays separate.

## 2. Selected baseline and evidence provenance

### Original committed baseline, before approved follow-ups

The HU branch integrates the published main baseline without rewriting its
previously pushed planning commit. The documentation-only revision preserved
Android source, manifests and dependencies. The approved local implementation
now changes the privacy/build configuration against these same selected pins.

| Component | Selected version |
| --- | --- |
| AGP / Gradle wrapper / Java | 9.5.1 / 9.7.0 / 17 |
| Kotlin / Compose BOM | 2.4.21 / 2026.09.00 |
| Firebase BOM / Google Services / Crashlytics plugin | 35.1.0 / 4.5.0 / 3.0.8 |
| Navigation 3 / DataStore / Coil | 1.2.1 / 1.3.0 / 3.6.3 |
| kotlinx.serialization / Tink | 1.12.0 / 1.24.0 |
| ML Kit prompt, Debug only | 1.0.0-beta5 |
| Compile/target SDK / minimum SDK | 37 / 29 |

The table preserves the initial HU baseline. The approved lint follow-up uses
Gradle **9.9.1** as its sole dependency/tooling exception; all other app/plugin
pins and Java criteria remain unchanged. Current source/artifact provenance and
the 358-file working-tree snapshot belong to [lint validation](lint-validation.md).

The version catalog is authoritative for the remaining pins. Record the full
resolved graph, configuration state, tools, artifact hashes, and actual commit
when establishing the before/after baseline; do not reuse a historical AAB.

The earlier dependency delivery passed 480 unit tests, 23 connected tests with one
opt-in test omitted on a fresh API 29 emulator, and Release bundle generation.
Lint comparison reported 136 existing warnings and two hints, no new findings,
and 13 obsolete-version warnings removed. Command success is not a claim of
warning-free acceptance or authorization to suppress diagnostics. The repo's
warning policy remains in force; distinguish existing debt from new findings
and report any required gate that cannot pass without a further decision.

During dependency delivery, the native-symbol stripping diagnostic was traced
to missing host NDK strip tools: AGP requested NDK `28.2.13676358`. The
documentation-only revision installed nothing. The approved implementation
must record preparation of the required official tool and recheck stripping;
do not change native code or suppress the message as a shortcut.

### Historical audit retained for context

| Observation on 2026-11-10 | Limitation |
| --- | --- |
| Uncompressed DEX 68,674,188 bytes; six DEX files; AAB 21,991,938 bytes | Earlier local 0.3.0.1 (37) candidate from a dirty checkout using AGP 9.5.0. Not an artifact of the selected 9.5.1 baseline and not reusable as a measured baseline. |
| Merged manifest/APK included AD_ID and both AdServices permissions through Analytics | Recheck from the selected dependency graph and final artifacts. |
| Release bundle/APK, metadata and lint-vital tasks succeeded | Neither optimized Release journeys nor warning-free acceptance. |
| APK zip alignment and ELF LOAD/RELRO-tail checks passed | Static checks only; 16 KB runtime evidence still pending. |
| Earlier committed AGP 9.4.0 / Kotlin 2.4.20 / Firebase BOM 34.19.0 | Superseded by the independently delivered dependency update, not by HU-090 implementation. |

Owning sources are the Android version catalog, app build script, manifest,
ProGuard configuration and `ReguertaFirestorePath.kt`, plus
`ReguertaImagePickerField.kt`, `ReceivedOrdersModels.kt`, and
`FirestoreOrdersRepository.kt`. Existing reviewer routing is owned by the
backend; a client environment override is not an authorization mechanism.

## 3. Approved implementation sequence

### Phase 1 - Reproducibility, tooling, and upload controls

Use the selected pins and capture fresh unoptimized baseline artifacts and
reports. Record variant, SDKs, commit, dirty state, dependency/configuration
hashes, signing/build mode, and device/OS. Before any runtime measurement,
prepare the local QA scaffold and fail-closed isolation described in phase 4,
initially with optimization disabled. Do not run ordinary Release against a
live backend to obtain the baseline. Keep the same QA variant and intentional
Release differences on both sides of the eventual R8 comparison.

Prepare official Android CLI tooling that actually exposes `android analyze`;
the CLI inspected during planning lacked it. Record the execution tool's version
and verify its help contract before using it. Prepare the required native strip tool and a 16 KB
runtime. Missing tools leave the corresponding acceptance pending.

Before enabling R8, inspect the Crashlytics task graph and set the supported
variant mapping-upload control for local validation. Keep local builds free
of mapping/symbol/crash submissions. QA runtime telemetry must not send test
reports/events to a live Firebase target. Production diagnostics are preserved;
this is a test-environment control, not a product removal decision.

### Phase 2 - Advertising removal with non-advertising Analytics retained

Remove these three permissions at the app merge boundary and verify both the
merged manifest and final AAB/APK:

- `com.google.android.gms.permission.AD_ID`
- `android.permission.ACCESS_ADSERVICES_AD_ID`
- `android.permission.ACCESS_ADSERVICES_ATTRIBUTION`

For the selected SDK, explicitly disable advertising ID collection, ad
personalization, and advertising data/storage uses through supported default
and consent controls, with no later application path re-enabling them. Retain
usage reporting and non-advertising measurement attribution. Do not conflate
those with advertising attribution or enable an advertising integration.

Current Android guidance documents
`google_analytics_adid_collection_enabled = false` and
`google_analytics_default_allow_ad_personalization_signals = false`.
Review the SDK's advertising consent controls as well: these two flags and
permission removal alone are not the complete proof. Preserve the existing
Analytics collection/consent policy for non-advertising usage; this HU does
not introduce a new consent UI or silently grant analytics consent.

Evidence must include supported SDK defaults, effective advertising consent
state before relevant event collection, absence of code paths re-enabling
advertising, final permissions, and a controlled validation of permitted usage
measurement. Observe only synthetic QA events; external telemetry verification
requires its later bounded authorization.

Non-advertising Analytics does not mean no identifiers or no collection.
Maintain the [remaining data and identifier inventory](privacy-inventory.md)
for Data Safety, including its static-review limits; preserve IDs needed for
FCM/device registration.
Add an artifact-level regression check so dependency updates cannot silently
restore advertising permissions. Submit no Console declaration in this HU's
current documentation work.

After these privacy settings are fixed and before enabling R8 in phase 3,
capture the paired unoptimized QA startup/memory baseline. Keep those same
privacy settings in the optimized comparison; do not attribute effects of
privacy removal to R8. Retain the original pre-change artifact as context.

### Phase 3 - Modern Release optimization and dynamic contracts

Use the AGP 9.5.1 Release DSL:

```kotlin
release {
    optimization {
        enable = true
    }
}
```

Use appropriate `src/<variant>/keepRules/*.keep` files and current Android
consumer rules; remove superseded settings only after verifying replacement.
Keep the IDE on Debug for ordinary work. Explicit Gradle tasks select Release
regardless of the IDE selection; selecting Release alone does not enable R8.

Avoid package-wide keep rules, global `-dontoptimize`/`-dontobfuscate`, and
blanket suppression. Review the reflective `getCode` lookup in
`ReceivedOrdersModels.kt`; prefer typed SDK error translation in Data and
transfer Domain results. Test permission-denied and generic failure behavior.
Inspect serialization and Tink initialization without assuming custom keep
rules are required.

### Phase 4 - Two explicitly distinguished validation levels

**Local, representative optimized validation:** prepare a non-publishable
`releaseValidation` variant connected only to Firebase emulators and synthetic
fixtures. Reuse Release optimization, custom/consumer rules, compiler flags,
dependency pins, relevant resources and PDF-only source-set behavior. Do not
inherit Debug's ML Kit implementation, enable debugging to bypass R8, or add
broad QA keep rules. Record and review every intentional difference from
Release (test application/configuration, local endpoints, test hooks).

All Firebase/Functions/Storage/Auth clients must use a demo project and local
endpoints before their first network access. A missing emulator fails closed
with no live fallback. Runtime Analytics/Crashlytics/FCM submissions must stay
local or be replaced at the QA boundary. Exercise notification permission and
handling locally; Firebase emulators do not establish actual FCM delivery.
Backend production code, allowlists, and live configuration are unchanged.

Run representative authenticated product journeys on that optimized variant.
This is relevant evidence, not proof that the production AAB is identical.
Also inspect the exact Release AAB, generated APKs, manifest, metadata, local
retracing and a fresh unauthenticated/offline smoke run with live submissions
blocked by the test environment.

**Exact-artifact canary gate:** before treating the candidate as distribution
ready, use APKs generated from the exact archived Release AAB and an existing
reviewer account already routed by the backend to `develop`. First present a
bounded test plan naming project/environment, synthetic fixture collections,
roles, operations, telemetry destination and any real push check; obtain its
separate authorization. Verify existing trusted reviewer routing, linked
identity, and effective `develop` context before business writes. Never use
production members/data, change the allowlist/backend, or bypass authorization
with a client override. Stop on an unknown/production context. Real FCM delivery
requires its own bounded check within that authorization.

If the reviewer, environment proof, or authorization is unavailable, record the
exact canary gate as pending. Local QA success cannot complete AC-06 or turn
this HU into a general publication approval. Implementation can progress
locally while that later gate remains pending.

### Phase 5 - Final artifact metrics and performance protocol

Run the AGP configuration analyzer to understand keep-rule effects, then use
actual artifact metrics for acceptance:

```bash
android analyze --format=json app-release.aab
```

Require the exact candidate's R8 metadata, `r8DexChecksumStatus = EXACT_MATCH`,
uncompressed DEX size, and all three applicable optimization, obfuscation and
shrinking ratios at least `0.25`. Analyzer configuration scores are not these
percentages. Missing metadata/tooling or a checksum mismatch leaves AC-05
pending; documenting a gap is not a pass. No Console upload is needed for
this local route. Recheck policy applicability at execution time.

Freeze device/AVD image, OS, page size, CPU/memory profile, dataset, initial
session/cache state, network conditions, compiler/profile-installation mode,
and measurement tools for each before/after pair. Run no parallel host builds
or profilers that would bias the comparison. Compare on the same fresh API 29
phone AVD and a separately verified 16 KB runtime; record exact identities and
`getconf PAGESIZE` (16384 for the latter). Results are relative local evidence.

Approved engineering protocol and regression limits (not Play thresholds):

- Startup: discard three warm-up launches, then collect 20 process-cold
  launches without clearing application data. Use the same launch command and
  `am start -W` TotalTime metric; report median/P90, not an unmeasured TTID.
- Memory: collect five `dumpsys meminfo` total-PSS samples after 60 seconds
  settled on Home and five after 60 seconds in background, with the same data.
  Report median/max PSS; PSS is not Play's Anon RSS + Swap metric.
- Investigate and repeat a full matching pair if either startup median/P90
  increases by more than `max(10% of baseline, 50 ms)`, or either state's
  median/max PSS increases by more than `max(10% of baseline, 10 MiB)`.
- A repeated breach leaves AC-08 pending until corrected or an explicit
  evidence-backed exception is accepted by the owner. Noise, missing measurements, or
  incomparable devices cannot be declared a performance pass.

Local samples do not establish Play's rolling 28-day P90 memory compliance.
Recheck native alignment, packaging and runtime on 16 KB; installation on a
4 KB emulator cannot satisfy that check.

### Phase 6 - Mappings, documentation, and handoff

Archive hashes, AAB/APKs, exact `mapping.txt`, R8 metadata, rules, dependency
reports, versions and measurement evidence together. Prove local retracing
against the exact mapping. Document later mapping upload to the intended
Firebase target without enabling/submitting it during local validation.

Maintain ADR-0015
([EN](../../../docs/decisions/0015-android-release-privacy-and-local-validation.md),
[ES](../../../docs-es/decisions/0015-privacidad-release-android-y-validacion-local.md))
and any required tech-stack mirrors with the final implementation evidence.
Keep secure-store issue #228 and unrelated release gates
visible; this HU cannot close them or authorize publication. No iOS/backend
implementation or feature-parity change is planned.

## 4. Validation commands and journeys

During implementation, from `android/Reguerta`, after upload controls:

```bash
./gradlew app:testDebugUnitTest
./gradlew app:lintDebug
./gradlew app:connectedDebugAndroidTest
./gradlew :app:bundleRelease :app:assembleRelease :app:checkReleaseAarMetadata
./gradlew :app:analyzeReleaseR8Config
android analyze --format=json app-release.aab
```

Confirm actual task/CLI contracts first. Run connected tests on a dedicated
fresh emulator with no existing account/session; default HU-083 live-like
acceptance stays opt-in. Add the planned Release-equivalent black-box journey
run using the exact recorded variant/device, not merely Debug instrumentation.

Cover login/recovery/logout, session/Activity recreation, orders/edit/history,
producer status and permission-denied failures, photos/camera and denial, PDF,
notification handling/denial, encrypted-store upgrades and serialization.
Coordinate #228 evidence without replacing its independent acceptance. Separate
local handling from exact-artifact cloud/push evidence as defined above.

For the earlier documentation-only revision: inspect metadata, local links, consistent
acceptance/checklists, conflict resolution and diff scope; run
`git diff --check` and verify issue/remote branch read-back. That revision
performed no mobile build, SDK installation, emulator startup or runtime test.
The currently authorized implementation runs the local validations above;
results and outstanding acceptance remain separate from that historical check.

## 5. Decision record - 2026-11-10 revision 2 before execution approval

- Owner requested the updated published dependency base and retained
  non-advertising Analytics; earlier baseline-selection ambiguity is resolved.
- Replaced the underspecified Release-test path with local representative QA
  and a separately authorized exact-artifact canary; no live write is granted.
- Replaced the metrics-tool gap allowance with a concrete local command and a
  pending criterion if tools/metadata are unavailable.
- Proposed the explicit startup/memory comparison protocol and limits later approved below.
- Recorded the operator completion as owner-reported only.
- At that documentation checkpoint, implementation was not yet authorized.
  The owner's subsequent approval in section 7 supersedes that restriction.
  The prior audit is retained above; dependency-delivery tests are not claimed
  as HU-090 implementation evidence.

## 6. Official references

Use these sources during implementation and recheck them for the final candidate:

- [Play technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799)
- [Enable optimization with R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Analyze R8 configuration](https://developer.android.com/topic/performance/app-optimization/r8-configuration-analyzer)
- [DEX optimization metrics](https://developer.android.com/topic/performance/vitals/code-optimization)
- [Local artifact analyzer](https://developer.android.com/tools/agents/android-cli/commands/analyze)
- [Analytics collection settings](https://firebase.google.com/docs/analytics/android/configure-data-collection)
- [Crashlytics readable reports and upload controls](https://firebase.google.com/docs/crashlytics/android/get-deobfuscated-reports)
- [16 KB compatibility](https://developer.android.com/guide/practices/page-sizes)
- [Separate secure-store gate #228](https://github.com/JFrancoG/ReguertaPlus/issues/228)

Restore Credentials for April 2027 remains separate future scope. Operator
completion is reported by the owner, not independently checked by this HU.

## 7. Implementation approval - 2026-11-10

The owner approved revision 2 and authorized Android implementation and local
validation, retaining non-advertising Analytics. Production and publication
remain prohibited. Earlier Draft entries describe the preserved decision trail,
not the current authorization. The local implementation and follow-up results
are recorded on this isolated branch; external HU acceptance remains pending.

## 8. Camera preview follow-up — local fix authorized 2026-11-10

Execution base: HU branch commit `66ecebc2`. The owner authorized correcting
the Android preview and local validation. No publication or production access;
the previously delivered artifact/performance receipts remain historical for
their exact hashes. New fix artifacts/results must be recorded separately.

The camera result and JPEG upload succeed. The confirmed cause was the
foreground authorization refresh replacing the unsaved profile draft with its
remote snapshot and invalidating an upload in flight. The baseline reproduction
also lost typed text; gallery did not reproduce that loss. The 15-second refresh
policy must not hide the regression during validation.

Acceptance for this follow-up:

1. Camera success preserves the uploaded URL, visible preview, text edits and
   operation ownership through a refresh of the same authorized context,
   whether refresh finishes before or after upload. Removing a photo remains
   an intentional edit. A pristine editor can still receive remote updates.
2. Identity, environment, role or capability changes still invalidate the old
   editor/upload through the existing session fences. A stale remote read
   cannot overwrite a newer confirmed local profile mutation.
3. Exercise production authorization actions in deterministic regression
   tests, including a failing pre-fix case. Validate optimized local QA camera,
   gallery, cancellation/permission denial and save/readback against demo emulators on
   API 29 and a 16 KB runtime, with time outside the app above the refresh
   interval. Run the relevant Android unit/lint/connected/build gates and
   distinguish existing warning debt from new findings.

Use the existing isolated harness and synthetic accounts; do not run ordinary
Debug/Release against live services. Preserve non-advertising Analytics/R8,
dependencies and backend code. Keep HU-090 open for its remaining gates.

Implementation and deterministic regressions are complete locally. The same-context
reducer preserves dirty drafts and active operation revisions, accepts remote
updates for a clean editor, and rejects stale snapshots after a local ACK.
Identity, member, environment, role and capability invalidations remain intact.
See [camera fix validation](camera-fix-validation.md) for the new artifacts,
API 29/16 KB journeys, test receipts and limits. No dependency, R8, Analytics,
iOS or backend change is part of this follow-up.

Delivery authorization on 2026-11-10: commit and push this correction and its
documentation on the existing HU branch, retaining non-advertising Analytics
and the open story. Git history and issue #282 own the delivery receipt.
The source snapshot and binary hashes remain those of the pre-commit local
validation; delivery preparation changes only documentation and the changelog.

At this camera checkpoint, the next decision was warning remediation; the
approved lint follow-up below now clears that debt locally. Prepare a concrete,
bounded exact-artifact cloud/FCM canary only for later authorization. HU-090
stays open; gate #228 and publication remain separate.


## 9. Lint remediation — review and execution record, 2026-11-10/11

Historical advisory checkpoint: the [plan](lint-remediation-plan.md) reviewed the 136 normal-Debug warnings
and two hints at `ea367ac9`, with a [complete inventory](lint-inventory.json).
It proposes staged resource/asset cleanup, safe API/Compose/localization fixes,
a wrapper-only upgrade and four narrowly reviewed commit-result exceptions.
All 368 source/configuration records matched the camera archive at that review
checkpoint; no build, runtime or implementation was needed for that advisory
review. These are not current lint counts or current source-drift claims.

The review requested approval of wrapper scope, four precise UseKtx exceptions
and the behavior/branding and warning-gate constraints. Its planning-only limit
was superseded by the approval below; alternatives changing those contracts
would still need a revised plan. HU-090 remains open; cloud/FCM and #228 remain
separate gates.


### Lint execution approval — 2026-11-10

The owner superseded the planning-only limit and approved all lint batches,
Gradle 9.9.1 and four function-scoped KTX exceptions. Implementation and local
validation completed on 2026-11-10/11: three strict lint reports contain zero
diagnostics, 505 JVM tests pass, and the two connected suites total 85 passed,
three expected skips and zero failures. Fresh optimized artifacts, privacy,
16 KB packaging, mappings/retrace and scoped external UI checks pass.
Non-advertising Analytics, R8 and session fences remain intact. The initial
local execution included no Git delivery; the owner subsequently authorized
commit/push on 2026-11-11 while keeping HU-090 open.

Exact task-owned data/runtime cleanup and durable archival pass; the manifest
of 950 execution files, six candidate-artifact hashes and 358 public source records
are verified at `/Users/jesusf/Projects/Reguerta-artifacts/hu-090/2026-11-11-lint`.
Record the observed cart route reset and emulator/launcher coverage limits from
[lint-validation.md](lint-validation.md) without treating them as corrected or
proven pre-existing. HU-090 remains open for later separately authorized
exact-artifact cloud/FCM evidence and independent secure-store gate #228.

### Lint branch delivery authorization — 2026-11-11

The owner requested commit/push of the lint changes and documentation to
`codex/hu-090-android-release-privacy-r8`. Reuse the recent local gates only
after confirming all 358 archived public Android source records still match;
delivery preparation changes only HU documentation and changelog. Keep the
pre-commit working-tree artifact provenance intact. Git history and issue #282
own the commit/push result. No merge, HU closure, publication, production access
or binary/mapping upload is included. Cart recreation, launcher/device coverage
and historical-only paired performance limits remain documented in
[lint validation](lint-validation.md).
