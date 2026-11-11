# Approved lint remediation plan - HU-090

## State and evidence

**Approved on 2026-11-10; local implementation and validation completed on
2026-11-10/11.** Fresh Debug/Release/QA strict lint reports contain zero
diagnostics, 505 JVM tests pass, and the two connected suites total 85 passed,
three expected skips and zero failures. See [current results and limits](lint-validation.md)
for the new artifacts, runtime scope and external gates still pending.
The owner approved Gradle 9.9.1, exactly four narrow KTX exceptions and the
remaining plan constraints. Android source/resources, the wrapper and local
validation changed within those approved limits. Non-advertising Analytics
and R8 are preserved.
No production, publication, deployment, real telemetry send, mapping upload,
commit or push is part of this implementation request. The initial review
was documentation-only; its baseline below remains historical.
HU-090 / [issue #282](https://github.com/JFrancoG/ReguertaPlus/issues/282) remains open.

Review base: `ea367ac9b4313cf1d7911e5730e4dd2be378f1fb` on the existing HU branch.
The historical normal Debug XML archived with the camera correction contains **136 warnings
in 14 categories, two hints and zero errors**. Its SHA-256 is
`00dd7a8f798d7a90667e194338a686d4ff917e35f54df6ed1a1fb4101ab022db`.
At the advisory review checkpoint, all **368** public Android source/configuration
records matched that archive, so the review reused its report. This is not a
current source-drift or warning-count claim. The old isolated local Debug
report had 135 warnings/two hints; its label override
removes one normal-Debug finding. It cannot substitute for the normal report.

The [historical inventory](lint-inventory.json) preserves all 138 original diagnostics,
locations, proposed batches and all 100 unused-resource candidate checks.
Counts describe diagnostics, not independent edits: several corrections overlap.
Static searches included main, Debug, Release, releaseValidation, unit and
instrumented tests, resource XML and Android scripts. Dynamic resource-name
lookups were not found. Subsequent variant builds and the recorded visual/runtime
checks support the accepted removals; original static-review limitations remain
visible in the inventory. No original finding was waived beyond the four exact
commit-result exceptions approved below.

## Inventory and proposed treatment

| Lint ID | Warnings | Treatment |
| --- | ---: | --- |
| UnusedResources | 100 | Remove verified unused declarations across their variants/locales. |
| UseKtx | 10 | Six equivalent migrations; four function-scoped commit-result exceptions approved and implemented. |
| IconDuplicates | 5 | Remove obsolete complete Debug bitmap aliases; preserve variant artwork. |
| PluralsCandidate | 4 | Two quantity resources and two messages with independently counted values. |
| ModifierParameter | 3 | Correct parameter order/default; preserve call-site layout. |
| IconXmlAndPng | 3 | Remove unused drawable and obsolete complete launcher bitmap alternatives. |
| ConfigurationScreenWidthHeight | 2 | Read current window bounds, preserving the shortest-edge policy. |
| VectorPath | 2 | Delete one unused vector; optimize the live monochrome artwork separately. |
| TypographyDashes | 2 | EN/ES range typography; keep password policy 6–16. |
| RedundantLabel | 1 | Inherit the application label; check all variant manifests. |
| AndroidGradlePluginVersion | 1 | This finding requests a Gradle wrapper update, not an AGP migration. |
| Typos | 1 | The affected string is also unused: remove it with its EN/ES pair. |
| UseOfNonLambdaOffsetOverload | 1 | Defer animated offset state reading to the layout lambda. |
| MonochromeLauncherIcon | 1 | Supply the existing monochrome layer to the round adaptive icon. |
| **Total warnings** | **136** | |

Two further `AutoboxingStateCreation` hints in `ReguertaRootAuthForms.kt:118/222`
can use `remember { mutableIntStateOf(0) }`. They are outside the 136 count but
should be cleared in the same proposal without changing secret lifetimes or
switching ephemeral state to saved state.

## Approved execution batches

### A. Update only the Gradle wrapper and establish a fresh baseline

The report suggests 9.9.0. At review time, the official distribution metadata
identifies **9.9.1** as current stable, and its release notes recommend that
patch. Propose **9.7.0 → 9.9.1**, rechecking publication, checksum and release
notes when implementation starts. Keep AGP 9.5.1, Kotlin 2.4.21, Firebase BOM
and all application dependency pins unchanged. This is an explicit proposed
exception to the earlier frozen tooling baseline, not a general dependency sweep.

AGP 9.5 documents Gradle 9.6.0 as its minimum and JDK 17 as its minimum.
Meeting those minima does not prove compatibility of Google Services,
Crashlytics, the Gradle DSL or the local QA task graph with 9.9.1. Keep the
existing Java 21 daemon criteria and Java 17 app bytecode target; validate
configuration and builds. Refresh the wrapper files and official distribution
checksum together, retaining URL validation. Do not copy the old 9.7 checksum.

Run normal Debug lint under the candidate wrapper and record any newly exposed
findings before proceeding. Treat the resulting report as the implementation
baseline and reconcile the inventory. If the isolated tooling change fails,
retain its diagnostic and restore only that batch; do not upgrade other plugins
or suppress its warning to make this plan appear complete.

References: [Gradle current release metadata](https://services.gradle.org/versions/current),
[9.9.1 release notes](https://docs.gradle.org/9.9.1/release-notes.html),
[AGP 9.5 compatibility](https://developer.android.com/build/releases/agp-9-5-0-release-notes).

### B. Remove the verified unused resources before editing live UI

The 100 findings comprise **95 string names, four color names and one drawable**.
The strings have 190 EN/ES declarations; remove both languages together.
Remove all matching color declarations, including Debug and night overrides
(`launcherBackground` has four definitions, `icon_foreground` two). Recheck the
inventory immediately before removal; do not infer usage from a file name.

`drawable/ic_launcher_foreground.xml` is unused: adaptive icons refer to the
separate **mipmap** foregrounds. Deleting this drawable resolves one
`UnusedResources`, one `VectorPath` and one `IconXmlAndPng`. Do not delete the
mipmap foreground artwork that the launcher actually uses.

`products_editor_subtitle` has no references and contains the `Aqui` typo.
Remove the unused EN/ES pair instead of correcting abandoned copy. Thus this
batch can retire **103 original diagnostics**: 100 unused-resource findings,
one vector warning, one XML/bitmap collision and the typo. Reconcile actual
counts after lint; this is a static projection, not a completed result.

Build resource processing for every supported variant and confirm no resource
lookup or generated reference fails. R8 resource shrinking is already enabled;
removing dead source declarations is source maintenance, not a claimed new
runtime size or performance improvement.

### C. Apply the safe API/Compose/manifest corrections

**Six KTX migrations:**

- `DevelopmentTimeMachine.kt:29` and `ReguertaRootMyOrderRoute.kt:2269/2362`:
  use `SharedPreferences.edit { … }` retaining asynchronous `apply`, one editor
  per update, existing keys and normalized JSON content.
- `FirebaseImagePipelineManager.kt:54`: use `Bitmap.scale` with the same
  dimensions and filtering. The result can be the input instance: preserve
  identity-aware recycling and the upload/cancellation/error cleanup paths.
- `ReguertaRootBylawsRoute.kt:491`: use the supported `createBitmap` factory,
  preserving the PDF bitmap configuration, dimensions and recycle lifetime.
- `ReguertaRootStartupGate.kt:185`: use `String.toUri()` within the existing
  error boundary, preserving URL routing and fallback behavior.

The resolved core 1.19.1 sources confirm these delegation contracts; no new KTX
or third-party dependency is required. The four synchronous commits are excluded
from this batch and handled in F.

**Six Compose warnings and two hints:**

- `ui/theme/Adaptive.kt:34`: replace `LocalConfiguration.screenWidthDp` and
  `screenHeightDp` with `LocalWindowInfo` bounds. Resolved Compose UI 1.12.1 has
  `containerDpSize`; alternatively convert `containerSize` using `LocalDensity`.
  Keep the **shorter edge**, thresholds **390/600 dp**, token scales and type
  scales. Specify fractional-boundary rounding and initial/unknown bounds in
  the implementation; compare API 29/37 behavior. Do not subtract insets twice
  or make the profile depend on keyboard-covered content height. Replacing the
  policy with standard width-only classes or MediaQuery is outside this fix.
- `PersonalOrderSummaryProducerCard` in `PersonalOrderSummaryCard.kt:44`, and
  `ReguertaImagePickerField.kt:67`: place `modifier = Modifier` first among
  optional parameters. All three current callers of each use named arguments;
  still compile the complete call graph.
- `ProducerGroupHeader`, `ReguertaRootMyOrderRoute.kt:1160`: default `modifier`
  to `Modifier` and apply the existing internal `fillMaxWidth()` to the `Row`.
  Preserve chain order: its one caller supplies `requiredWidth` and a negative
  offset, so an apparently trivial default change needs a layout check.
- `ReguertaRootMyOrderRoute.kt:665`: move the animated horizontal offset to
  `offset { IntOffset(cartPanelOffsetX.roundToPx(), 0) }`. Read the state inside
  the lambda. Retain density conversion, start-relative RTL behavior, target
  positions and animation timing. Do not substitute `absoluteOffset`, a graphics
  translation or a value already read during composition.
- Resolve the two auth hints with primitive integer state; retain current
  ephemeral ownership, revisions and clear/reset behavior.

**One manifest warning:** remove the redundant MainActivity label and inherit
its application label. Inspect merged Debug/Release/QA manifests, including
QA's `Reguerta HU-090 Local` override; keep test installations clearly named.
Permissions, components and non-advertising Analytics controls stay unchanged.

References: [WindowInfo](https://developer.android.com/reference/kotlin/androidx/compose/ui/platform/WindowInfo),
[AndroidX component guidelines](https://android.googlesource.com/platform/frameworks/support/+/androidx-main/compose/docs/compose-component-api-guidelines.md),
[deferred Compose reads](https://developer.android.com/develop/ui/compose/performance/bestpractices#defer-reads),
[core KTX contracts](https://developer.android.com/reference/kotlin/androidx/core/content/package-summary).

### D. Correct the live EN/ES quantity messages

All four `PluralsCandidate` resources are live; the two-counter messages must
not select a single grammatical form from only one of their counts.

| Resource | Proposed change and relevant caller |
| --- | --- |
| `shift_swap_request_waiting_multiple_format` | Add EN/ES quantity resources; preserve the distinct-member count in `ReguertaRootShiftSwapSections.kt:288`. |
| `my_order_quantity_plural_format` | Add EN/ES quantity resources; migrate order summaries/cards and history, retaining existing unit formatting semantics. |
| `settings_shift_planning_summary_format` | Neutral copy, e.g. `Delivery shifts: %1$d · Market shifts: %2$d`, with equivalent ES wording; retain both independent counts in `ReguertaRootSettingsRoutes.kt:480`. |
| `settings_shift_planning_candidate_format` | Neutral copy, e.g. `Staged candidate — shifts: %1$d · assignments: %2$d`, with equivalent ES wording; retain position and assignment counts in `ReguertaRootSettingsRoutes.kt:512`. |

For history, `localizedGenericOrderHistoryQuantityLabel` at
`ReguertaRootMyOrdersHistoryRoute.kt:92` currently parses integer `ud/uds/ud(s)`
labels, otherwise returning the original text. Adapt its quantity-formatting
boundary without passing Android resources into Domain or losing the fallback
for kg, custom units and historical strings. Avoid formatting a plural resource
as an ordinary single format string.

Change the password range hyphen to an en dash in EN/ES
`feedback_password_invalid_length`; preserve the validated bounds **6–16**.
The unused subtitle typo is already accounted for in B.

Reference: [quantity strings and neutral wording](https://developer.android.com/guide/topics/resources/string-resource#Plurals).

### E. Consolidate launcher assets while preserving the existing identity

After B, nine original icon diagnostics remain. With minimum SDK 29 and the
adaptive definitions in `mipmap-anydpi`, propose removing **20 legacy complete
launcher/round WebPs** (five densities × two names × main/Debug). Keep the
**ten referenced foreground WebPs** and their density coverage. Main is green
with transparency; Debug is deliberately yellow/orange and opaque. Do not
replace one variant's artwork with the other or delete all `ic_launcher*` files.

Supply the existing monochrome layer to the round adaptive icon. First attempt
geometry-preserving simplification of the live monochrome vector; if this cannot
remove `VectorPath` with acceptable rendering, rasterize the existing mask at
appropriate densities. Keep alpha, holes, winding and silhouette. Do not split
paths merely to bypass the length detector. The fallback needs visual review
of the concrete rendered output, not advance approval of unseen artwork.

Check API 29/37 launchers, standard/round masks, light/dark/themed icons and
Debug/QA distinction before accepting the resource selection and appearance.
Keep the approved existing identity; no redesign. Local implementation includes
the reviewed raster fallback. Current runtime evidence covers only the recorded
Pixel Launcher Circle-mask emulator cases; other masks/OEM launchers and physical
devices remain unverified before broader visual acceptance.

References: [resource selection](https://developer.android.com/guide/topics/resources/providing-resources),
[adaptive and monochrome layers](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

### F. Preserve four synchronous commit-result contracts

The four `UseKtx` findings in `AndroidKeystoreDeviceRegistrationStore.kt` affect:

- `SharedPreferencesDeviceRegistrationEncryptedStore.write` and `remove`
  (warning lines 33/41).
- `AndroidKeystoreDeviceRegistrationEncryptedStore.write` and `remove`
  (warning lines 107/115).

They return `editor.commit(): Boolean`. `DeviceRegistrationPreferences.kt`
turns false into typed write/delete failures and relies on durable ordering for
registration IDs, removal and migration. Core KTX `edit(commit = true)` returns
**Unit**, discarding the Boolean; default `edit { … }` also changes durability
to asynchronous `apply`. Neither is an equivalent replacement here.

**Owner-approved exception:** keep the framework calls and
add exactly four function-scoped `UseKtx` exceptions with the contract/rationale
beside each, preserving existing failure/migration tests. No file/package-wide
suppression, blanket lint disable, weakened error propagation or helper whose
only purpose is hiding the diagnostic. This accepts a demonstrated detector
false positive; it does not approve deprecation suppressions or waive #228.

The rejected alternative was to leave these four findings open for a separately
reviewed storage-contract/API redesign. Do not silently drop the Boolean or
migrate storage architecture solely to remove a style suggestion.

## Validation and acceptance after implementation

Use one focused validation per changed batch, then one final Android gate. Do
not repeat unrelated suites or add tests that only mirror an API spelling.

- Re-run ordinary Debug lint after each batch; compare IDs and occurrences with
  this inventory and explain new findings. Inspect all three variant reports:
  `:app:lintDebug`, `:app:lintRelease`, `:app:lintReleaseValidation`. Release/PDF
  and QA differences may expose additional findings not present in these 136;
  classify and resolve or obtain a concrete decision rather than hiding them.
- Add focused observable checks only where coverage is absent: window profiles
  around 390/600 dp, fraction rounding, rotation and resize; EN/ES 0/1/2
  quantity forms and independent two-count combinations; history raw-label
  fallbacks. Reuse existing auth secret-lifetime/live-validation, order/history,
  secure-store failure/rollback and migration tests.
- Run `:app:testDebugUnitTest`. On owned API 29/16 KB emulators, run
  `:app:connectedDebugAndroidTest -Phu090LocalDebug=true` with an exact device
  serial and the existing demo harness. Never run ordinary Debug/Release online.
- In optimized local QA check auth/IME and scaled text, producer group/cart
  width, animated panel/scrim/hit regions and RTL, plus camera/gallery/permission
  denial and draft retention, JPEG upload/recycle and PDF rendering. Launchers
  need their separate mask/theme/variant visual checks.
- Build Debug, optimized QA and Release APK/AAB. Check final manifests/privacy,
  R8 analyzer/EXACT_MATCH, 16 KB ZIP/native alignment and matching local mapping/
  retrace. Refresh artifact/source hashes. Old camera and performance receipts
  remain historical; do not reuse their exact-binary results after these changes.
- Once warning debt is resolved, propose enforcing the existing warning policy
  in Gradle lint (`warningsAsErrors = true`, `abortOnError = true`) and verify
  the reports as well as exit status. Do not add a baseline, `ignoreWarnings`,
  `checkOnly` filtering, global disable or dependency changes to conceal findings.
  The two hints also need to be absent; warning promotion alone does not prove it.

Acceptance: zero unresolved warnings/errors in the reviewed variants, both
known hints cleared, exactly the approved narrow exceptions documented, no new
compilation warnings, required functional checks passing, unchanged privacy/
authorization contracts, and no new cross-platform contract gap. Tool success
alone does not satisfy the repository's warning policy.

## Owner decisions approved on 2026-11-10

1. Include a **wrapper-only 9.9.1 update**, subject to verified checksum and
   local plugin/build compatibility; retain all other pins. Both checks now pass.
2. Approve the **four exact UseKtx exceptions** in F so synchronous success/failure
   reporting survives. Exactly those four function-scoped exceptions are implemented.
3. Accept the recommended constraints: current shortest-edge 390/600 policy,
   current icon identity and Debug distinction, quantity resources plus neutral
   two-counter copy. Concrete raster outputs and the Circle-mask emulator
   launcher cases were visually reviewed within the scope and limits recorded
   in lint-validation.md; other OEM/mask coverage is not claimed.
4. Enforce the warning gate after cleanup, with the explicit exceptions only.

The owner approved all four decisions above and authorized local implementation
and validation in batches. The local warning-free gate is now satisfied within
the recorded device/launcher scope. Current cart route-retention observations
are limitations, not declared fixes or proven baseline behavior. Task-owned
cleanup, durable archival and manifest/hash verification pass.
[Lint implementation validation](lint-validation.md) preserves fresh results
and historical evidence separately. HU-090 remains open for the separately
authorized exact-artifact cloud/FCM canary and independent secure-store #228
gate. The owner subsequently authorized branch commit/push of the lint changes
and documentation on 2026-11-11; Git history and issue #282 own that receipt.
This grants no merge, HU closure, production access, publication, deployment,
external telemetry sends or mapping/symbol uploads.
