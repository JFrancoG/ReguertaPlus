# Plan - HU-090

## 1. Current outcome, decisions, and authorization

- State: **Draft, revision 2; implementation not started or authorized**.
- Authorized now: update this planning set and issue, integrate the published
  main baseline, and commit/push documentation. No SDK/build/manifest edits,
  runtime changes, uploads, or Console operations are authorized now.
- Dependency decision resolved: use main `7491ebae84d49c30e32d27cd5de5a74ff94ee3a3`,
  including Android update `0cff11eb`; reproduce measurements from the eventual
  implementation commit using these pins. Additional upgrades are separate work.
- Privacy decision confirmed by the owner: retain non-advertising Analytics,
  Crashlytics, and FCM; remove advertising identifiers, AdServices access, and
  advertising uses/signals. Ordinary usage reporting and non-advertising
  measurement attribution remain permitted.
- Operator status: owner-reported complete on 2026-11-10. This is not an
  independent Console verification, an app declaration, or publication approval.
- Technical recommendations for review: local Release-equivalent validation,
  an exact-artifact canary kept as a separate authorized gate, local artifact
  metrics, and the performance protocol below.
- Next owner decision: review this revision and explicitly authorize
  implementation. Later canary/upload authorization is requested only when a
  concrete candidate and bounded test operation exist.

## 2. Selected baseline and evidence provenance

### Current committed baseline

The HU branch integrates the published main baseline without rewriting its
previously pushed planning commit. Android source, manifests, and dependencies
must remain identical to that main baseline during this documentation update.

| Component | Selected version |
| --- | --- |
| AGP / Gradle wrapper / Java | 9.5.1 / 9.7.0 / 17 |
| Kotlin / Compose BOM | 2.4.21 / 2026.09.00 |
| Firebase BOM / Google Services / Crashlytics plugin | 35.1.0 / 4.5.0 / 3.0.8 |
| Navigation 3 / DataStore / Coil | 1.2.1 / 1.3.0 / 3.6.3 |
| kotlinx.serialization / Tink | 1.12.0 / 1.24.0 |
| ML Kit prompt, Debug only | 1.0.0-beta5 |
| Compile/target SDK / minimum SDK | 37 / 29 |

The version catalog is authoritative for the remaining pins. Record the full
resolved graph, configuration state, tools, artifact hashes, and actual commit
when establishing the before/after baseline; do not reuse a historical AAB.

The dependency delivery passed 480 unit tests, 23 connected tests with one
opt-in test omitted on a fresh API 29 emulator, and Release bundle generation.
Lint comparison reported 136 existing warnings and two hints, no new findings,
and 13 obsolete-version warnings removed. Command success is not a claim of
warning-free acceptance or authorization to suppress diagnostics. The repo's
warning policy remains in force; distinguish existing debt from new findings
and report any required gate that cannot pass without a further decision.

The native-symbol stripping diagnostic was traced to missing host NDK strip
tools: AGP requested NDK `28.2.13676358`. Prepare the required official SDK tool
before rechecking stripping; do not change native code or suppress the message
as a shortcut. This planning update installs nothing.

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

## 3. Implementation sequence proposed for approval

### Phase 1 - Reproducibility, tooling, and upload controls

Use the selected pins and capture fresh unoptimized baseline artifacts and
reports. Record variant, SDKs, commit, dirty state, dependency/configuration
hashes, signing/build mode, and device/OS. Before any runtime measurement,
prepare the local QA scaffold and fail-closed isolation described in phase 4,
initially with optimization disabled. Do not run ordinary Release against a
live backend to obtain the baseline. Keep the same QA variant and intentional
Release differences on both sides of the eventual R8 comparison.

Prepare official Android CLI tooling that actually exposes `android analyze`;
the currently installed CLI lacks it. Record its version and verify its help
contract before using it. Prepare the required native strip tool and a 16 KB
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
Inventory remaining app-instance/Firebase installation identifiers and
diagnostics for Data Safety; preserve IDs needed for FCM/device registration.
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

Proposed engineering protocol and regression limits (not Play thresholds):

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

Review the need for a durable ADR/tech-stack update and maintain EN/ES mirrors
when applicable. Keep secure-store issue #228 and unrelated release gates
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

For this documentation revision: inspect metadata, local links, consistent
acceptance/checklists, conflict resolution and diff scope; run
`git diff --check` and verify issue/remote branch read-back. No mobile build,
SDK installation, emulator startup or runtime test is performed now.

## 5. Decision record - 2026-11-10 revision 2

- Owner requested the updated published dependency base and retained
  non-advertising Analytics; earlier baseline-selection ambiguity is resolved.
- Replaced the underspecified Release-test path with local representative QA
  and a separately authorized exact-artifact canary; no live write is granted.
- Replaced the metrics-tool gap allowance with a concrete local command and a
  pending criterion if tools/metadata are unavailable.
- Added an explicit proposed startup/memory comparison protocol and limits.
- Recorded the operator completion as owner-reported only.
- Implementation remains unauthorized. The prior audit is retained above;
  dependency-delivery tests are not claimed as HU-090 implementation evidence.

## 6. Official references

Recheck these sources when implementation begins:

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
