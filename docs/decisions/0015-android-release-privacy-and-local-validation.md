# ADR-0015: Android release privacy and local validation

## Status

Accepted for local Android implementation on 2026-11-10 by the maintainer's
approval of HU-090. Implementation and verification are ongoing. This decision
does not certify passing tests, Play compliance, or publication readiness.

## Context

The unpublished ReguertaPlus Android app uses Firebase Analytics without an
advertising feature. Analytics dependencies can still contribute advertising
permissions. Release optimization was disabled, while Debug selects different
routing, application identity, and on-device AI behavior. Testing Debug alone
cannot establish the behavior of optimized production code.

The selected baseline is main `7491ebae`, including dependency update
`0cff11eb`: AGP 9.5.1 and the committed Android version catalog. Earlier
measurements of a dirty checkout are context, not a reproducible baseline.
The owner approved retaining non-advertising Analytics and authorized Android
implementation and local validation only, without publication or production
operations.

## Decision

1. Retain ordinary usage reporting and non-advertising measurement attribution,
   Crashlytics, and FCM. Remove `AD_ID`, `ACCESS_ADSERVICES_AD_ID`, and
   `ACCESS_ADSERVICES_ATTRIBUTION` from final artifacts and explicitly deny
   advertising ID collection, advertising storage/data uses, and ad
   personalization through supported SDK defaults. Permission removal and the
   personalization flag are not sufficient proof by themselves. Inventory
   remaining non-advertising identifiers, including app-instance/Firebase
   installation identity; preserving Analytics is not a claim of anonymity or
   no data collection.
2. Optimize and obfuscate Release code and resources using AGP 9.5.1's modern
   optimization DSL, current consumer rules, and only narrowly evidenced custom
   rules. Keep Debug suitable for development. An unoptimized comparison is a
   controlled local measurement state, not the shipping policy. Replace
   avoidable reflection at the Data boundary instead of keeping whole packages
   or disabling optimization globally.
3. Use a separate non-publishable, non-debuggable `.validation` application for
   representative local journeys. It shares Release's dependency/optimization
   policy and PDF-only source-set behavior; Debug's ML Kit path is not inherited.
   Review and record its deliberate differences from Release. Establish this
   isolated scaffold before runtime measurements and compare the same QA variant
   and privacy settings before and after R8.
4. Initialize QA with the fixed `demo-reguerta-hu090` project and local Auth,
   Firestore, and Storage emulators before product SDK access. Route the local
   Functions contract only through the fixed fixture gateway on the host loopback
   interface, reached as `10.0.2.2` by the emulator. The gateway never proxies a
   request to the cloud. Its synthetic responses and fixture Rules are not
   evidence of real backend authorization, Functions, or production Rules.
5. Restrict QA networking with its own trust anchor, no ordinary system-CA
   fallback, explicit cleartext access for the fixed emulator host, and rejection of invalid
   endpoint/project combinations before credentials or connection access. Keep
   QA runtime telemetry, automatic SDK initialization, and background cloud
   submissions disabled or replaced locally. Negative egress checks must verify
   these boundaries; a network-security XML file alone is not evidence that all
   traffic is contained. Normal Release retains production routing and trust
   defaults, with no client override of backend authorization. Android 17's
   implicit localhost policy also allows device-loopback cleartext; it cannot
   reach host/cloud services and is not used by any configured QA endpoint.
6. Disable automatic mapping uploads during local builds; retain exact mappings,
   R8 metadata, and artifact hashes for local retracing. Measure the actual AAB
   with compatible official tooling and require matching R8/DEX metadata and the
   applicable optimization percentages. Local QA and artifact checks cannot
   substitute for a later canary of the exact archived Release AAB.

## Alternatives considered

- Removing all Analytics is rejected because the approved product policy retains
  non-advertising measurement.
- Testing Debug or enabling Debug behavior in QA is rejected because it changes
  routing/source behavior and does not represent optimized Release execution.
- Running the production artifact against live services now is outside the
  authorization. An exact-artifact canary remains a separate later gate.
- Broad keep rules or optimization bypasses are rejected because they conceal
  dynamic-contract defects and undermine the optimization objective.

## Consequences and verification boundaries

Advertising access is reduced while useful operational services remain. The
additional QA variant, fixture gateway, and local-network policy require upkeep;
QA success does not establish exact production-binary behavior or real FCM
delivery. No iOS implementation or user-facing feature-parity change follows
from this Android tooling decision. ADR-0006's PDF boundary and ADR-0009's
process-live device-registration authority remain in force.

HU-090 owns the acceptance criteria and current evidence: final artifact privacy
checks, typed error behavior, local optimized journeys, paired performance
measurements, applicable DEX ratios with exact metadata, 16 KB validation, and
matching retrace evidence. This ADR records no test-pass result.

No Firebase deployment, production read/write, Console change, binary/mapping
upload, or real push/canary operation is authorized here. The exact-artifact
canary requires a later bounded authorization and an existing reviewer routed
by trusted backend policy to develop before business writes. Until that evidence
exists, the corresponding HU acceptance gate remains pending; #228 remains a
separate secure-store distribution gate.

## Related work and references

- [HU-090 plan and evidence](../../spec/app/hu-090-android-release-privacy-r8/plan.md)
- [HU-090 / issue #282](https://github.com/JFrancoG/ReguertaPlus/issues/282)
- [ADR-0006: on-device bylaws and PDF fallback](0006-ground-bylaws-answers-on-device.md)
- [ADR-0009: process-live push authorization](0009-require-process-live-push-authorization.md)
- [Secure-store release gate #228](https://github.com/JFrancoG/ReguertaPlus/issues/228)
- [Firebase Analytics collection controls](https://firebase.google.com/docs/analytics/android/configure-data-collection)
- [Android R8 optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Android network security configuration](https://developer.android.com/privacy-and-security/security-config)
- [Official local artifact analyzer](https://developer.android.com/tools/agents/android-cli/commands/analyze)
