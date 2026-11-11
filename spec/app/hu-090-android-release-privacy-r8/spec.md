# HU-090 - Android release privacy and R8 optimization

## Metadata

- issue_id: 282
- priority: P1
- platform: android
- status: in-progress
- plan_state: Approved revision 2 - local privacy/R8, camera and lint validation recorded
- created: 2026-11-10

## Current local outcome

Privacy controls and R8 are implemented locally. See [validation](validation.md)
for exact artifacts, performance, SDK/offline observations and test scopes.
The [camera follow-up](camera-fix-validation.md) corrects the preview loss
and validates it locally after the original HU delivery. The owner subsequently
authorized commit/push of this correction and its documentation on the HU branch.
Git history and issue #282 own that receipt. Acceptance remains pending for
exact-artifact cloud/FCM evidence and independent gate #228.
Git history and issue #282 record the earlier `66ecebc2` delivery. Publication,
production operations and HU closure remain outside scope.
The owner approved the [lint correction plan](lint-remediation-plan.md), including
Gradle 9.9.1 and four exact KTX exceptions, and authorized local implementation
and validation. [Current lint results and limits](lint-validation.md) record
zero diagnostics in Debug/Release/QA strict lint, 505 JVM tests and 85 connected
tests passed with three expected skips. The owner subsequently authorized
commit/push of these lint changes and documentation on 2026-11-11, keeping
HU-090 open; Git history and issue #282 own the definitive delivery receipt.
Historical hashes/performance receipts do not represent the new
candidate. Cart recreation returns Home while retaining its draft for reopening;
only the documented emulator/Circle-mask launcher scope was checked, and API 29
landscape was not established. Those observations are not declared corrected
or proven pre-existing. Exact task-owned cleanup and durable archive
manifest/hash verification pass. Built artifacts retain their original
pre-commit working-tree provenance; branch delivery does not authorize merge,
publication, production access, artifact uploads or acceptance closure.

## Context and problem

ReguertaPlus Android has not yet been uploaded to Google Play. Prepare its
first potential distribution with no advertising identifiers and with a
validated, optimized Release build. The older Reguerta app and its Play
Console findings are outside this story.

The pre-HU-090 Release configuration disabled R8. Firebase Analytics can add
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
  uses/signals using supported SDK configuration. Preserve ordinary usage
  reporting and non-advertising measurement attribution.
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

- Publishing or touching production; local Android implementation is authorized
  by the owner on 2026-11-10.
- Modifying the older app, iOS, backend, production data, account/operator status,
  Play Console declarations, store listings, or publication channels.
- Publishing/uploading binaries, mappings, symbols, or deliberate crash reports
  under the current local implementation authorization. Exact-artifact cloud canaries and
  synthetic develop writes require a later bounded authorization.
- General dependency upgrades beyond the explicitly approved Gradle 9.9.1 wrapper,
  new ads/Billing/AppFunctions/location/contact
  functionality, Analytics removal, and Restore Credentials integration.
- Certifying overall store readiness or closing unrelated release gates.

## Linked requirements and decisions

- Android platform and architecture baseline in `docs/tech-stack/README.md`.
- Repository validation policy in `AGENTS.md`.
- Existing secure-store release gate: GitHub issue #228 / ADR-0009.
- Selected base: main `7491ebae`, including Android dependency update `0cff11eb`.
- Non-advertising Analytics is explicitly retained by owner decision.
- Operator status was reported complete by the owner on 2026-11-10; not verified here.
- Accepted local implementation decision: ADR-0015
  ([EN](../../../docs/decisions/0015-android-release-privacy-and-local-validation.md),
  [ES](../../../docs-es/decisions/0015-privacidad-release-android-y-validacion-local.md)).
- [Remaining non-advertising data inventory and review limits](privacy-inventory.md).

## Acceptance criteria

- AC-01: The final Release manifest and APK/AAB contain none of
  `com.google.android.gms.permission.AD_ID`,
  `android.permission.ACCESS_ADSERVICES_AD_ID`, or
  `android.permission.ACCESS_ADSERVICES_ATTRIBUTION`. A meaningful artifact
  check catches their reintroduction by transitive dependencies.
- AC-02: Supported SDK settings explicitly disable advertising identifier
  collection and advertising signals. Evidence covers both SDK configuration
  and artifact permissions; non-advertising telemetry and FCM still work.
  Usage reporting/non-advertising attribution remain allowed. Inventory the
  remaining non-advertising identifiers; claim neither anonymity nor no collection.
- AC-03: Release optimizes code/resources and obfuscates using the pinned
  AGP's modern DSL. Debug stays suitable for development. There are no broad
  package keep rules or global optimization/obfuscation disable switches.
- AC-04: The named `getCode` reflection path is reviewed. A typed SDK-to-Domain
  mapping in Data is preferred where possible; permission-denied and generic
  failure behavior remain correct in an optimized binary.
- AC-05: Baseline and optimized measurements identify commit, dependency and
  configuration state, variant, version, tools, device/OS, artifact hashes,
  and uncompressed DEX size. The final artifact meets each applicable Play
  percentage threshold, using a compatible official `android analyze` and
  exact-match R8/DEX metadata. Missing tools/metadata/checksum proof leave the
  criterion pending; R8 enablement or analyzer scores alone are not proof.
- AC-06: Repository gates and optimized local Release-equivalent QA journeys
  pass with demo-project emulators, no live fallback, Release/PDF behavior and
  reviewed variant differences. The exact Release AAB passes artifact/offline
  checks and a separately authorized canary with an existing reviewer routed
  to develop before business writes. QA is not the exact AAB; without canary
  evidence this criterion remains pending. No production writes or client
  authorization bypass is permitted; local notification tests do not prove FCM delivery.
- AC-07: API 37/minimum 29, Photo Picker, functional permission behavior, and
  16 KB packaging/native alignment remain intact. Validate runtime behavior
  on a compatible 16 KB device/emulator and resolve or justify the observed
  AndroidX native-symbol stripping diagnostic without blanket suppression.
- AC-08: The paired protocol in plan section 3 phase 5 is followed: three warm-ups,
  20 process-cold starts, five samples per memory state, matching devices/data
  and tool modes. Repeated increases above max(10%, 50 ms) for startup or
  max(10%, 10 MiB) for PSS keep the criterion pending until fixed or explicitly
  excepted by the owner. These engineering limits are not Play thresholds or proof of
  Play's 28-day P90 compliance.
- AC-09: Each candidate retains its exact mapping and R8 metadata. Local
  retrace recovers an expected trace. Mapping upload is controlled before
  builds can trigger automatic Crashlytics upload; any external diagnostic
  verification is deferred until separately authorized.
- AC-10: Data-inventory notes support Advertising ID/Data Safety declarations
  for the final configuration. No declaration is submitted under this story's
  local implementation scope. Required decision/stack updates remain aligned in EN/ES.

## Dependencies and risks

- Dependency selection is resolved by the published main `7491ebae` and Android
  update `0cff11eb`. Regenerate the measured baseline from the actual execution
  commit; the earlier dirty-tree AAB is historical context only.
- Compatible analyzer/strip tools, a 16 KB runtime and isolated QA fixtures are
  execution preconditions; their preparation and verification belong to the
  current local implementation evidence.
- The exact-artifact canary requires a later bounded authorization; implementation
  may progress locally, but missing canary evidence cannot close AC-06.
- Issue #228 remains a separate distribution gate. Include encrypted-storage
  upgrade behavior in Release validation without claiming to close that issue.
- Reflection, consumer keep rules, SDK initialization, and automatic mapping
  uploads require recorded inspection and validation with optimization enabled.
- Final Play requirements and supported SDK settings must be rechecked when
  the final candidate is assessed; local measurements cannot represent Console acceptance.

## Definition of Done

- [ ] All acceptance criteria validated with linked evidence.
- [ ] Optimized Release journeys and applicable Android gates pass.
- [ ] Privacy and mapping/diagnostic configuration reviewed.
- [ ] Android-only scope and unchanged product parity confirmed.
- [ ] Documentation and required EN/ES decisions updated.
- [ ] No distribution action inferred from implementation completion.
