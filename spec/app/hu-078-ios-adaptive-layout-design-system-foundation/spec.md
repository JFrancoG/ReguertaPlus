# HU-078 - Establish adaptive iOS layout and DesignSystem foundation

## Metadata

- issue_id: #258
- priority: P1
- platform: ios
- status: ready_for_merge
- plan_state: approved

## Authorization and delivery boundary

The maintainer activated Phase 5 on 2026-08-19 with the verbatim instruction:
"ok, adelante con la siguiente fase, abre issue etc".

That instruction authorizes the HU-078 issue, branch, specification, plan,
tasks, baseline, tests, and implementation within this document. On 2026-08-20
the maintainer separately authorized committing this completed scope and two
pre-existing Android dependency-catalog version updates. Push, pull request,
merge, issue closure, branch deletion, deployment, and integration still
require a separate delivery instruction.

HU-078 starts from clean, synchronized `main` at
`4b711833374e04e3a066676243b512aecb9f7194`. HU-077 / #255 is closed as
completed and fully contained in that base.

## Context and problem

The iOS DesignSystem already owns semantic colors and reusable controls, and
ADR-0005 establishes route-level safe-area ownership. Layout sizing still
depends on the process-global `DeviceScale`, however. A root capture view writes
window dimensions and safe-area values into static state; numeric `.resize*`
extensions then scale typography, spacing, icon sizes, hit targets, fixed
widths, gesture thresholds, and bottom compensation across unrelated routes.

This model cannot describe two windows with different sizes, is not driven by
the actual container, and can shrink nominal 44-point controls below the
accessibility minimum on compact widths. It also compounds Dynamic Type by
scaling custom font sizes by width before SwiftUI applies their relative text
style.

The inherited tree contains 303 `.resize*` occurrences in 35 files and a total
legacy surface of 37 files after including `DeviceScale.swift` and the root
`DeviceScaleCaptureView` consumer. Shared components have incomplete adaptive,
state-preview, localization, VoiceOver, and Reduce Motion coverage. This story
closes that foundation debt before Phase 6 changes individual feature behavior.

## User story

As an iOS user, I want controls and content to remain readable, reachable, and
correctly positioned on compact phones, iPads, split windows, large text,
different languages, and reduced-motion settings, so that the same feature
semantics remain usable without relying on one global window size.

As a maintainer, I want layout decisions expressed by semantic tokens,
container proposals, and explicit safe-area ownership, so that shared
components can be verified independently and feature stories do not inherit
global scaling debt.

## Scope

### In scope

- Define semantic spacing, radius, icon, layout, readable-width, touch-target,
  and motion tokens while preserving established color and typography intent.
- Eliminate `DeviceScale`, `DeviceScaleCaptureView`, `ResizeExtensions`, and
  every `.resize*` production consumer.
- Migrate incrementally in this order: DesignSystem, Auth/Root, Home,
  Products/Users/Shared Profile, Orders, then Shifts/Settings/News and remaining
  Presentation consumers.
- Replace global window-derived sizing with container-aware layout,
  `ViewThatFits`, relative frames, explicit safe-area ownership, and
  `@ScaledMetric` only for meaningful non-text metrics.
- Keep custom fonts relative to a Dynamic Type text style without an additional
  width-derived multiplier.
- Guarantee at least a 44-by-44-point hit target for every migrated interactive
  control at compact phone width.
- Preserve ADR-0005 ownership: scaffold/header owns its inset, each route owns
  its scroll and route-specific bottom controls, and intentional overlays remain
  explicit.
- Rename the six passive DesignSystem `*ViewModel` values to Configuration or
  Model when touched. Characterize and redesign `ReguertaInputField`
  configuration as a separate cut rather than hiding it in a rename.
- Add deterministic previews for applicable loading, empty, error, content,
  disabled, long-text, and action variants.
- Localize the four identified Products/Users VoiceOver action labels and audit
  uppercase transformation of localized input labels.
- Add an explicit root Reduce Motion policy and classify existing material,
  essential, and non-essential animation.
- Modernize stored content closures, the manual DesignSystem `EnvironmentKey`,
  redundant builders, four `Task.sleep(nanoseconds:)` uses, and the Dialog named
  coordinate-space implementation only in separate mechanical cuts with
  preserved behavior.
- Align `docs/design-system/foundations.md`,
  `docs-es/design-system/foundations.md`, `docs/design-system/components.md`,
  and `docs-es/design-system/components.md`. Add an implementation-status
  addendum to `docs/decisions/0005-ios-swiftui-safe-area-screen-scaffold.md`
  and its `docs-es` counterpart only if the accepted scaffold contract is
  materially extended.

### Out of scope

- Phase 6 vertical feature redesigns or changes to business behavior.
- Navigation, authentication, session, repository, Firebase, rules, schema,
  backend, or live-data changes.
- A brand, color, or font-family redesign.
- Android implementation. The story must report the temporary parity gap and
  keep semantic documentation cross-platform compatible.
- General one-View-per-file cleanup; that remains Phase 8 unless required for a
  directly touched component contract.
- New snapshot-test dependencies or visual automation services.
- Package upgrades, `Package.resolved`, Functions, CI-provider selection,
  test-framework migration, deployment, or iOS/Xcode 27 adoption.
- Commit, push, PR, merge, issue closure, branch deletion, deployment, or
  integration without later authorization.

## Adaptive layout contract

1. Layout derives from the current container proposal, not a process-global
   window or key-window snapshot.
2. Semantic tokens express intent. Feature code must not replace `.resize`
   mechanically with arbitrary literals or raw primitive scales.
3. Text uses semantic styles and Dynamic Type. Width scaling is not applied to
   font point sizes.
4. `@ScaledMetric` is reserved for a non-text metric whose visual meaning should
   track Dynamic Type; its use requires a named rationale and focused coverage.
5. Every interactive element owns or composes a hit region of at least 44 by
   44 points at the compact test width, even when its visible glyph is smaller.
6. Safe-area compensation has one owner. Migrating a route removes the legacy
   compensation before adding any new inset so top/bottom space is not doubled.
7. Gesture thresholds are semantic interaction metrics and remain stable or
   container-relative; they are not decorative width scaling.
8. Essential state transitions remain visible. Non-essential/material motion
   is reduced or removed when `accessibilityReduceMotion` is enabled.
9. Localization is evaluated in layout and accessibility output. Uppercase
   styling cannot corrupt translated input or VoiceOver content.
10. Preview fixtures are deterministic, local, and side-effect free. A preview
    completion does not substitute for VoiceOver or runtime accessibility
    inspection.
11. Each component/route migration is behavior-preserving and closes its own
    focused tests, preview matrix, lint, and whitespace check before the next
    cluster starts.

## Linked requirements and decisions

- `AGENTS.md` repository workflow and iOS maintenance rules.
- ADR-0001: MVVM and Clean Architecture.
- ADR-0004: App-owned root dependency injection.
- ADR-0005: safe-area scaffold for iOS SwiftUI Home routes.
- ADR-0011 and ADR-0012: explicit isolation, owners, and runtime context.
- HU-074 roadmap Phase 5 and its activation contract.
- HU-077 / #255, integrated before this story.
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/258
- Reproducible initial inventory: `phase-5-baseline.md`.

No new ADR is required at activation because this story implements the accepted
responsive and safe-area direction. Work stops for a new ADR if it changes the
public scaffold ownership, introduces global layout state, adopts a visual
testing dependency, or creates a new cross-platform motion/design decision.

## Acceptance criteria

- Semantic spacing, radius, icon, layout, readable-width, touch-target, and
  motion contracts are explicit and tested.
- `DeviceScale`, `DeviceScaleCaptureView`, `ResizeExtensions`, and all
  `.resize*` production references are zero.
- Shared and migrated route layouts derive from their current containers and
  preserve ADR-0005 safe-area ownership.
- Every migrated interactive control has a verified minimum 44-by-44-point hit
  target on iPhone SE (3rd generation) / iOS 26.5.
- Custom text remains Dynamic Type-aware through relative semantic styles and
  is not width-scaled.
- DesignSystem and affected routes pass the declared phone, iPad,
  multitasking/multiwindow, Large, XXX Large, AX5, light/dark, Spanish/English,
  VoiceOver, Increased Contrast, and Reduce Motion matrix.
- The six passive DesignSystem `*ViewModel` values are renamed when their APIs
  are touched; InputField configuration is characterized as an independent cut.
- The four identified hardcoded feature accessibility labels are localized;
  the uppercase input-label audit has an explicit resolved outcome.
- A root Reduce Motion policy is injected/read once at the appropriate UI
  boundary and non-essential motion honors it without hiding state changes.
- Applicable shared surfaces provide deterministic loading, empty, error,
  content, disabled, long-text, and action previews.
- Mechanical SwiftUI/API cleanups remain behavior-preserving and separately
  reviewable.
- The final color-catalog generator remains green with no unintended semantic
  palette change.
- Fast unit, UI smoke, release gate, strict SwiftLint, effective settings,
  generic Debug, and Production Release pass with exact evidence.
- `git diff --check`, package/scope review, and independent iOS architecture,
  concurrency, SwiftUI, and accessibility reviews complete with zero unresolved
  P0-P3 findings.
- Android, Functions, `Package.resolved`, project settings, and iOS/Xcode 27
  remain outside the diff unless separately authorized.

## Validation contract

Commands run from `ios/Reguerta`. The primary functional destination is
`platform=iOS Simulator,name=iPhone 17,OS=26.5`. Compact functional checks use
`platform=iOS Simulator,name=iPhone SE (3rd generation),OS=26.5`; iPad checks
use `platform=iOS Simulator,name=iPad Air 11-inch (M4),OS=26.5`.

| Gate | Exact command or identifiers | Required result |
| --- | --- | --- |
| Adaptive foundation focal | Run the exact focused unit command below. | Exit 0; 72 logical responsibilities / 147 executions; 0 failed/skipped |
| Compact safe-area UI | Run the exact focused UI command below on iPhone SE. | All three existing journeys pass; no obstruction or sub-44 target introduced |
| Fast unit | `./scripts/validate-ios.sh fast-unit --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` | Exit 0; every discovered unit responsibility accounted for; 0 failed/skipped unless justified |
| UI smoke | `./scripts/validate-ios.sh ui-smoke --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` | Exactly the four repository-owned journeys pass |
| Release | `./scripts/validate-ios.sh release-gate --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` | Exit 0; exact logical counts; only the known launch-matrix skip accepted |
| Color contract | `python3 scripts/design-system/generate_color_catalog.py --check` from repository root | Exit 0; 12 tokens, 11 pairs, 4 modes unless an intentional documented contract change occurs |
| SwiftLint | `./scripts/run-swiftlint.sh` | SwiftLint 0.61.0; 0 findings |
| Settings | `./scripts/verify-swift-settings.sh` | 6/6 target/configuration pairs pass |
| Debug build | `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` | Exit 0 |
| Release build | Same command with scheme `Reguerta-Production` and configuration `Release` | Exit 0 |
| Static/scope | Baseline searches, final zero searches, package/platform diff, and `git diff --check` | Targets met; no out-of-scope diff |
| Review | Independent maintenance-profile architecture/concurrency and SwiftUI/accessibility reviews | 0 unresolved P0-P3 |

Final focused unit command; the result-bundle path must not already exist:

```sh
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta \
  -configuration Debug -testPlan fast-unit-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -onlyUsePackageVersionsFromResolvedFile \
  -resultBundlePath /private/tmp/hu078-focused.xcresult \
  -only-testing:ReguertaTests/ReguertaAdaptiveLayoutContractTests \
  -only-testing:ReguertaTests/AppShellDependencyBoundaryTests \
  -only-testing:ReguertaTests/ReguertaColorContrastTests \
  -only-testing:ReguertaTests/ReguertaHomeNavigationTests \
  -only-testing:ReguertaTests/ReguertaDesignSystemAdaptiveMetricsTests \
  -only-testing:ReguertaTests/ReguertaDesignSystemPreviewMatrixTests \
  -only-testing:ReguertaTests/RootAuthHomeAdaptiveLayoutTests \
  -only-testing:ReguertaTests/HU078AdaptiveFeatureLayoutTests \
  -only-testing:ReguertaTests/ReguertaOrdersAdaptiveLayoutTests \
  -only-testing:ReguertaTests/SettingsShiftsAdaptiveLayoutTests \
  -only-testing:ReguertaTests/AdaptiveCommunityRoutesPreviewTests \
  -only-testing:ReguertaTests/AdaptiveOperationsRoutesPreviewTests \
  -only-testing:ReguertaTests/PresentationDelayClockTests test
```

Focused compact UI command:

```sh
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta \
  -configuration Debug -testPlan release-gate-v1 \
  -destination 'platform=iOS Simulator,name=iPhone SE (3rd generation),OS=26.5' \
  -only-testing:ReguertaUITests/ReguertaUITests/testHomeShowsLatestNewsWithoutBottomObstruction \
  -only-testing:ReguertaUITests/ReguertaUITests/testMyOrderSearchBarStaysAboveBottomSafeArea \
  -only-testing:ReguertaUITests/ReguertaUITests/testUsersAddButtonStaysAboveBottomSafeArea test
```

The four unchanged UI-smoke identifiers are:

- `ReguertaUITests/testUnauthorizedUserShowsRestrictedMode`
- `ReguertaUITests/testPreAuthorizedProducerEntersHomeWithActionRowEnabled`
- `ReguertaUITests/testDrawerNavigationOpensSelectedRoute`
- `ReguertaUITests/testInvalidCredentialsShowsInlineErrorWithoutCrash`

## Required visual and accessibility matrix

RenderPreview/Xcode checks use deterministic fixtures. Runtime accessibility
checks use the simulator or Accessibility Inspector; preview rendering alone is
not accepted as VoiceOver evidence.

| Surfaces and states | Geometry | Type | Appearance and locale | Accessibility and motion |
| --- | --- | --- | --- | --- |
| Button variants; Input default/focus/error/disabled/long text; Dialog one/two actions; list actions; FAB; Header variants; Scaffold | 320-point compact preview, iPhone 17, iPad Air 11 full screen, 600-point split/multiwindow preview | Large, XXX Large, AX5 | ES-light and EN-dark for each component family; Increased Contrast for semantic pairs | VoiceOver order/labels/actions; 44-point hit regions; Reduce Motion |
| Auth welcome/login/register/recover and root startup states | iPhone SE, iPhone 17, iPad full/split | Large, XXX Large, AX5 | ES-light, EN-dark | Focus order, secure/clear controls, no essential transition hidden |
| Home dashboard/drawer/news loading-empty-error-content | iPhone SE, iPhone 17, iPad full/split | Large, XXX Large, AX5 | ES-light, EN-dark | Drawer/header/FAB semantics, unobstructed scroll, reduced drawer/material motion |
| Products editor; Users editor/list; Shared Profile | compact phone, iPad full/split | Large, XXX Large, AX5 | ES-light, EN-dark | Localized edit/archive/deactivate labels, image actions, 44-point controls |
| My Order/cart/history; Received Orders/history | iPhone SE, iPhone 17, iPad full/split | Large, XXX Large, AX5 | ES-light, EN-dark | Bottom bars/search/totals unobstructed, list and status actions reachable |
| Shifts/planning/calendar; Settings sheets; News/notifications | iPhone 17, iPad full/split | Large, XXX Large, AX5 | ES-light, EN-dark | Dialog/sheet action order, non-essential motion reduced |

Each migrated cluster records the exact previews, device/size, state, locale,
appearance, and result. A generic statement such as "looks equivalent" is not
evidence.

## Initial-to-final delta

| Measure | Initial | Required closure |
| --- | ---: | ---: |
| `.resize*` occurrences | 303 | 0 |
| `.resize*` files | 35 | 0 |
| Complete legacy layout surface | 37 files | 0 files |
| `DeviceScale` / capture definitions and uses | 11 combined mentions | 0 |
| Passive DesignSystem `*ViewModel` structs | 6 | 0 for touched APIs; all six expected in this complete phase |
| Hardcoded feature VoiceOver labels identified | 4 | 0 |
| Root Reduce Motion reads | 0 | 1 policy boundary with tested propagation |
| DesignSystem previews | 12 in 8 files; 5 Header previews lack the shared modifier | Every shared component/state family has deterministic matrix coverage |
| Direct `Task.sleep(nanoseconds:)` sites in the Phase 5 audit | 4 | 0 |

Any residual requires an owner, rationale, focused evidence, removal condition,
and explicit maintainer approval. A residual `.resize*` consumer means Phase 5
remains open.

## Risks and controls

- A textual replacement can freeze inappropriate numbers.
  - Control: migrate by semantic role and component/route, with before/after
    characterization.
- Safe-area migration can double bottom/top compensation.
  - Control: identify the single owner and remove legacy padding before adding
    an inset.
- Dynamic Type can be double-scaled.
  - Control: remove width multipliers from text and use relative text styles.
- Gesture behavior can change when thresholds move.
  - Control: name interaction metrics and preserve deterministic threshold
    tests.
- Token APIs can become another raw-number layer.
  - Control: expose semantic intent and keep raw primitives private to the
    foundation.
- Visual review can become subjective or incomplete.
  - Control: named fixtures, exact sizes/states/locales, tool output, runtime
    accessibility evidence, and independent review.
- The broad route inventory can drift into Phase 6 refactoring.
  - Control: no product/state/navigation change; defer vertical redesigns.

## Bootstrap state

Issue #258 is open with `enhancement`, `platform:ios`, `priority:P1`, and
`area:app`. The local branch is
`codex/hu-078-ios-adaptive-layout-design-system-foundation` at the synchronized
base above and has no upstream. The first implementation cut is the adaptive
foundation characterization suite; no commit, push, PR, merge, issue closure,
branch deletion, or deployment was authorized at bootstrap. The maintainer later
authorized local commits only.

## Current implementation evidence (2026-08-20)

The local Phase 5 implementation is complete through the repository release
gate and the bounded manual accessibility acceptance. The story is
`ready_for_merge`; delivery remains a separate maintainer decision.

| Measure | Initial | Current |
| --- | ---: | ---: |
| iOS production | 261 files / 36,243 lines | 267 files / 39,202 lines |
| iOS unit tests | 112 files / 27,365 lines | 122 files / 29,191 lines |
| iOS UI tests | 2 files / 384 lines | 2 files / 423 lines |
| Total Swift inventory | 375 files / 63,992 lines | 391 files / 68,816 lines |
| Fast-unit responsibilities | 608 | 668 |
| Release responsibilities | 617 | 677 |
| `.resize*` occurrences/files | 303 / 35 | 0 / 0 |
| Complete legacy layout surface | 37 files | 0 files |
| Passive DesignSystem `*ViewModel` structs | 6 | 0 |
| Direct audited `Task.sleep(nanoseconds:)` sites | 4 | 0 |
| DesignSystem | 19 files / 1,872 lines / 12 previews | 19 files / 2,444 lines / 30 previews |
| Presentation preview support | none | 6 files / 1,998 lines / 26 previews |

Final executable evidence:

- focused adaptive selection: 72 logical responsibilities, 147
  device/configuration executions, 0 failed/skipped;
- compact safe-area journeys: 3/3 on iPhone SE (3rd generation), iOS 26.5;
- fast unit: 668/668 logical responsibilities, 812 executions, 0
  failed/skipped;
- UI smoke: 4/4 on iPhone 17, iOS 26.5;
- release: `/private/tmp/hu078-final-release-gate-2.xcresult`, 677 total, 676
  passed, the one inherited launch-matrix skip, and 0 failed; across device and
  configuration executions, 820 passed and 4 skipped;
- SwiftLint 0.61.0: 0 findings across 391 Swift files;
- effective Swift settings: 6/6 target/configuration pairs;
- generic Debug and `Reguerta-Production` Production Release builds: passed;
- color catalog: 12 tokens, 11 pairs, 4 modes;
- `git diff --check`, platform/package/project scope, and both independent
  reviews: clean, with 0 unresolved P0-P3 findings.

The first full release attempt failed during compilation because a preview
helper was hidden by `#if DEBUG` while release-plan tests still compiled its
boundary. The helper was moved to the appropriate compilation boundary and the
complete release gate above passed. Earlier foundation, preview, focal, compact,
gesture, virtualization, and composition-boundary failures remain recorded in
`phase-5-baseline.md` as honest RED evidence.

The automated matrix covers deterministic component/route states, compact and
regular containers, the 600-point split fixture, Dynamic Type through AX5,
ES-light, EN-dark, Increased Contrast, minimum targets, and motion-policy
contracts. On 2026-08-20 the maintainer also completed representative manual
MVP acceptance: VoiceOver and Voice Control navigation/actions behaved
correctly, sampled controls inspected with Accessibility Inspector exposed no
issue, and Reduce Motion suppressed material animation while preserving the
observed states and actions. This is bounded manual evidence rather than an
exhaustive certification of every assistive technology and route.

HU-078 made no Android UI/source implementation change. The separately
authorized Android dependency-catalog maintenance is not adaptive-layout parity.
Semantic documentation remains cross-platform compatible, but implementation
parity for this iOS adaptive foundation is a follow-up rather than part of
HU-078.
