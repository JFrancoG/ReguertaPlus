# Plan - HU-090

## 1. Current decision and authorization

- State: **Draft; not started**.
- Authorized now: create the HU, issue, isolated branch, planning documents,
  documentation commit, and branch push.
- Implementation, SDK/build/manifest edits, uploads, publication, and Console
  changes are not authorized by this bootstrap.
- Next decision: review and authorize implementation of the scope and
  acceptance criteria in `spec.md`; then resolve the exact dependency baseline.
- Acceptance for bootstrap: linked issue and documents, isolated documentation
  commit, remote branch, all implementation tasks pending, original checkout
  changes preserved.

## 2. Evidence and provenance

The audit on 2026-11-10 inspected ReguertaPlus only. It did not certify store
approval or represent the older Reguerta app's Alpha build.

| Observation | Provenance and limitation |
| --- | --- |
| Compile/target SDK 37; minimum 29 | `android/Reguerta/app/build.gradle.kts`; unchanged by this plan. |
| R8 disabled | `release { isMinifyEnabled = false }`; custom ProGuard file contains comments only. |
| Advertising permissions | Fresh merged manifest/APK included AD_ID and both AdServices permissions through Analytics. |
| Uncompressed DEX 68,674,188 bytes; six DEX files | Local 0.3.0.1 (37) AAB on 2026-11-10, generated from a dirty checkout with pre-existing dependency changes. Not a reproducible artifact of commit c8b2f358. |
| AAB 21,991,938 bytes | Same local observation; do not confuse compressed AAB size with the DEX threshold. |
| Release validation | `bundleRelease`, `assembleRelease`, AAR metadata and lint-vital tasks passed for that local candidate. Not optimized Release journey evidence. |
| 16 KB static checks | Local APK zip alignment and packaged ELF LOAD/RELRO-tail checks passed; runtime validation remains pending. |
| Packaging diagnostic | Gradle could not strip symbols from AndroidX graphics-path and DataStore native libraries; diagnose during execution. |
| Dependency difference | Committed base c8b2f358 pins AGP 9.4.0, Kotlin 2.4.20, Firebase BoM 34.19.0. The audited dirty checkout used AGP 9.5.0, Kotlin 2.4.21, BoM 35.1.0. This HU includes neither upgrade. |

Owning sources:

- `android/Reguerta/app/build.gradle.kts`
- `android/Reguerta/app/src/main/AndroidManifest.xml`
- `android/Reguerta/gradle/libs.versions.toml`
- `android/Reguerta/gradle.properties`
- `android/Reguerta/app/proguard-rules.pro`
- `android/Reguerta/app/src/main/java/com/reguerta/user/presentation/root/ReguertaImagePickerField.kt`
- `android/Reguerta/app/src/main/java/com/reguerta/user/domain/orders/ReceivedOrdersModels.kt`
- `android/Reguerta/app/src/main/java/com/reguerta/user/data/orders/FirestoreOrdersRepository.kt`

## 3. Technical approach and sequence

### Phase 1 - Reproducible baseline and upload controls

Confirm the approved dependency versions without folding unrelated local work
into this HU. Capture the configuration, dependency resolution, artifact hashes,
manifest, DEX size, startup, and memory from a reproducible baseline.

Before enabling R8, inspect the Crashlytics task graph and disable automatic
mapping uploads for local validation through the supported variant setting.
Keep local builds free of external mapping/symbol/crash submissions. This
control does not disable application diagnostics as a product decision.

### Phase 2 - Remove advertising access

Inventory Analytics configuration and consumer manifests for the selected SDK.
Remove all three advertising permissions at the app merge boundary, disable
advertising identifier collection and advertising attribution/personalization
signals with the supported SDK settings, and prove the final behavior. Retain
non-advertising Analytics, Crashlytics, FCM, and ordinary application features.

Add a focused verification of the final manifest/artifact rather than a test
that merely checks the source XML. Record the resulting data inventory for a
future Advertising ID/Data Safety declaration; submit no Console changes.

The current Android documentation exposes
`google_analytics_adid_collection_enabled = false` and
`google_analytics_default_allow_ad_personalization_signals = false`.
Revalidate the selected SDK's attribution/consent controls as well: disabling
personalization alone does not disable measurement attribution. Treat these
as implementation guidance, not as privacy settings already applied.

### Phase 3 - Enable modern Release optimization

For the selected AGP version, use the supported modern Release configuration:

```kotlin
release {
    optimization {
        enable = true
    }
}
```

AGP 9.4 on the committed base and the locally proposed 9.5 both support this
DSL. Follow current official guidance for `.keep` rules under the appropriate
`src/<variant>/keepRules` source set; remove superseded configuration only
when its replacement is verified. Keep Debug unoptimized.

Honor SDK consumer rules. Do not add package-wide keep rules, global
`-dontoptimize`/`-dontobfuscate`, or blanket warning suppression.

Review the `getCode` lookup by method name in `ReceivedOrdersModels.kt`.
Prefer a typed mapping at the Firebase adapter boundary in Data, transferring
only the Domain result. Verify observable permission-denied and generic error
classification; add a narrow keep rule only if an evidenced dynamic contract
cannot reasonably be removed. Inspect serialization and Tink initialization
without assuming they need custom rules.

### Phase 4 - Measure and validate optimized artifacts

Run the R8 configuration analyzer supported by the selected AGP, inspect its
report and merged rules, then measure the resulting AAB and its actual R8
metadata. Configuration-analyzer scores are not Play optimization percentages.
Use currently available official tooling for final artifact metrics; if the
installed CLI lacks that capability, document the gap instead of inventing
numbers. Console verification can occur only during a later authorized upload.

Require each applicable 25% metric. Compare compressed/download size,
uncompressed DEX, startup, and memory on matching devices and journeys.
Recheck policy applicability and dates at execution time.

Run the repository gates and optimized Release journeys below. Verify 16 KB
packaging/native compatibility and a compatible runtime. Resolve or explain
native-symbol stripping diagnostics with evidence; preserve any required
symbol files separately.

### Phase 5 - Diagnostics and distribution handoff

Archive artifact hashes, exact `mapping.txt`, R8 metadata, consumer/custom
rules, versions, and measurement reports. Prove local retracing with the
matching mapping. Document how to restore mapping upload for the intended
Firebase target during a later authorized distribution; do not enable or
exercise that external action now.

Assess whether an ADR or tech-stack update is needed for a durable telemetry
or Release policy and maintain EN/ES alignment if it is. Link existing accepted
contracts instead of silently replacing them. Keep issue #228 and other
release gates visible; this HU does not certify all publication readiness.

## 4. Layer and platform impact

- Android App/build: manifest merge controls, SDK flags, optimization, artifact
  verification, mapping configuration, and diagnostic ownership.
- Android Data: typed SDK error translation only where needed for safe R8.
- Android Domain/Presentation: preserve contracts and user journeys; no UI
  redesign or new product behavior.
- iOS and backend: no implementation changes. Android build tooling creates
  no product parity gap; do not apply Android advertising settings to iOS.
- Docs: this HU, privacy inventory, evidence, and required decision mirrors.

## 5. Validation and acceptance

From `android/Reguerta`, during implementation:

```bash
./gradlew app:testDebugUnitTest
./gradlew app:lintDebug
./gradlew app:connectedDebugAndroidTest
./gradlew :app:bundleRelease :app:assembleRelease :app:checkReleaseAarMetadata
./gradlew :app:analyzeReleaseR8Config
```

Run connected instrumentation when a device/emulator is available and report
the exact destination and any unavailable check. Execute build commands only
after verifying mapping-upload controls. Confirm the analyzer task against the
actual AGP contract before invoking it.

Install APKs generated from the optimized Release AAB in an isolated test
environment. Cover login/recovery/logout, authorized session and recreation,
order creation/edit/history/producer status and permission-denied failures,
photo selection/camera and denial, PDF, notifications and denial, encrypted
storage/upgrade, and relevant serialization paths. Record the build/device/OS,
result, and evidence. Reuse applicable #228 canary evidence without replacing
that issue's independent acceptance.

Check final permissions, SDK values, 16 KB alignment/runtime, real DEX
percentages, local retrace, and startup/memory comparisons. Do not claim that
one local memory sample establishes Play's 28-day P90 compliance.

Bootstrap validation is documentation-only: links/metadata/checklist review,
`git diff --check`, focused file-scope inspection, and issue/branch read-back.
No mobile tests are needed for this planning-only commit.

## 6. Official references

Recheck these sources when implementation begins:

- [Play technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799)
- [Enable optimization with R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Analyze R8 configuration](https://developer.android.com/topic/performance/app-optimization/r8-configuration-analyzer)
- [DEX optimization metrics](https://developer.android.com/topic/performance/vitals/code-optimization)
- [Firebase Analytics collection configuration](https://firebase.google.com/docs/analytics/android/configure-data-collection)
- [Crashlytics readable reports and upload controls](https://firebase.google.com/docs/crashlytics/android/get-deobfuscated-reports)
- [16 KB compatibility](https://developer.android.com/guide/practices/page-sizes)
- [Secure-store release gate #228](https://github.com/JFrancoG/ReguertaPlus/issues/228)

Restore Credentials for April 2027 is a separate future scope; no integration
or follow-up issue is created by this HU bootstrap. Operator status belongs
to the owner and is not a dependency of creating this plan.
