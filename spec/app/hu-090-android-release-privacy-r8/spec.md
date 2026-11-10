# HU-090 - Android release privacy and R8 optimization

## Metadata

- issue_id: 282
- priority: P1
- platform: android
- status: draft
- plan_state: Draft - implementation not authorized
- created: 2026-11-10

## Context and problem

ReguertaPlus Android has not yet been uploaded to Google Play. Prepare its
first potential distribution with no advertising identifiers and with a
validated, optimized Release build. The older Reguerta app and its Play
Console findings are outside this story.

The current Release configuration disables R8. Firebase Analytics can add
advertising permissions transitively even though this app has no advertising
feature. Removing manifest permissions alone does not prove that advertising
identifier collection and advertising signals are disabled.

From February 2027, Play requires apps with more than 10 MB of uncompressed
DEX to meet separate 25% code optimization, obfuscation, and shrinking
thresholds. A local candidate measured on 2026-11-10 exceeded that size;
repeat the baseline from the actual implementation checkout before comparing
results. See the plan for provenance and official sources.

## User story

As a ReguertaPlus Android user, I want the distributed app to avoid unnecessary
advertising access and use optimized code and resources, so that it preserves
its existing behavior with a smaller privacy and resource footprint.

## Scope

### In scope

- Remove advertising permissions from the merged manifest and final artifacts,
  and explicitly disable advertising identifier collection and advertising
  attribution/personalization signals using supported SDK configuration.
- Preserve non-advertising Analytics, Crashlytics, FCM, authentication, and
  application behavior; document the resulting data inventory.
- Enable Release code/resource optimization and obfuscation with modern R8
  configuration; use narrowly justified keep rules.
- Address demonstrated reflection/serialization problems introduced or exposed
  by optimization, with focused behavior-based coverage.
- Measure artifact size, DEX metrics, startup, and memory before and after.
- Validate the optimized Release binary, mappings, and local retracing.
- Prepare distribution diagnostics and Advertising ID/Data Safety evidence.

### Out of scope

- Implementing anything during this bootstrap; all execution remains pending.
- Modifying the older app, iOS, backend, live data, account/operator status,
  Play Console declarations, store listings, or publication channels.
- Publishing/uploading binaries, mappings, symbols, or deliberate crash reports
  as part of this planning authorization.
- General dependency upgrades, new ads/Billing/AppFunctions/location/contact
  functionality, Analytics removal, and Restore Credentials integration.
- Certifying overall store readiness or closing unrelated release gates.

## Linked requirements and decisions

- Android platform and architecture baseline in `docs/tech-stack/README.md`.
- Repository validation policy in `AGENTS.md`.
- Existing secure-store release gate: GitHub issue #228 / ADR-0009.
- No accepted ADR is created at bootstrap. Review the need for an EN/ES ADR
  before adopting a new durable telemetry or Release-build policy.

## Acceptance criteria

- AC-01: The final Release manifest and APK/AAB contain none of
  `com.google.android.gms.permission.AD_ID`,
  `android.permission.ACCESS_ADSERVICES_AD_ID`, or
  `android.permission.ACCESS_ADSERVICES_ATTRIBUTION`. A meaningful artifact
  check catches their reintroduction by transitive dependencies.
- AC-02: Supported SDK settings explicitly disable advertising identifier
  collection and advertising signals. Evidence covers both SDK configuration
  and artifact permissions; non-advertising telemetry and FCM still work.
- AC-03: Release optimizes code/resources and obfuscates using the pinned
  AGP's modern DSL. Debug stays suitable for development. There are no broad
  package keep rules or global optimization/obfuscation disable switches.
- AC-04: The named `getCode` reflection path is reviewed. A typed SDK-to-Domain
  mapping in Data is preferred where possible; permission-denied and generic
  failure behavior remain correct in an optimized binary.
- AC-05: Baseline and optimized measurements identify commit, dependency and
  configuration state, variant, version, tools, device/OS, artifact hashes,
  and uncompressed DEX size. The final artifact meets each applicable Play
  percentage threshold; R8 enablement or analyzer scores alone are not proof.
- AC-06: Repository Android gates pass, and representative user journeys pass
  on APKs generated from the optimized Release AAB in an isolated test
  environment. Debug instrumentation alone does not satisfy this criterion.
- AC-07: API 37/minimum 29, Photo Picker, functional permission behavior, and
  16 KB packaging/native alignment remain intact. Validate runtime behavior
  on a compatible 16 KB device/emulator and resolve or justify the observed
  AndroidX native-symbol stripping diagnostic without blanket suppression.
- AC-08: Startup and memory are compared on matching journeys/devices without
  unexplained regressions. Local samples are not claimed to establish Play's
  28-day P90 memory compliance.
- AC-09: Each candidate retains its exact mapping and R8 metadata. Local
  retrace recovers an expected trace. Mapping upload is controlled before
  builds can trigger automatic Crashlytics upload; any external diagnostic
  verification is deferred until separately authorized.
- AC-10: Data-inventory notes support Advertising ID/Data Safety declarations
  for the final configuration. No declaration is submitted by this story's
  planning work. Required decision/stack updates remain aligned in EN/ES.

## Dependencies and risks

- Reconcile pre-existing uncommitted dependency changes before establishing a
  reproducible baseline; this HU must not absorb those changes implicitly.
- Issue #228 remains a separate distribution gate. Include encrypted-storage
  upgrade behavior in Release validation without claiming to close that issue.
- Reflection, consumer keep rules, SDK initialization, and automatic mapping
  uploads require inspection before optimization is enabled.
- Final Play requirements and supported SDK settings must be rechecked when
  execution starts; local measurements cannot represent Console acceptance.

## Definition of Done

- [ ] All acceptance criteria validated with linked evidence.
- [ ] Optimized Release journeys and applicable Android gates pass.
- [ ] Privacy and mapping/diagnostic configuration reviewed.
- [ ] Android-only scope and unchanged product parity confirmed.
- [ ] Documentation and required EN/ES decisions updated.
- [ ] No distribution action inferred from implementation completion.
