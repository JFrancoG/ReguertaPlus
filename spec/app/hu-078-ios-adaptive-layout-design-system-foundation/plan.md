# HU-078 - Implementation plan

## 1. Goal

Close roadmap Phase 5 by replacing global window-derived sizing with a
semantic, container-aware DesignSystem foundation and validating shared
components/routes across the declared device and accessibility matrix without
changing feature behavior.

## 2. Operating state

- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/258
- Branch: `codex/hu-078-ios-adaptive-layout-design-system-foundation`
- Base: `main` at `4b711833374e04e3a066676243b512aecb9f7194`
- Profile: iOS maintenance
- State: approved / ready for merge
- Delivery: local implementation and commits are authorized. Push, PR, merge,
  closure, branch deletion, integration, and deployment are not authorized.

## 3. Preserved contracts

- Existing colors, contrast pairs, custom font family, product copy, route
  meaning, navigation, and business behavior.
- ADR-0005 safe-area ownership and existing route-level bottom-control meaning.
- SwiftUI state and actor ownership established by HU-074 through HU-077.
- App-owned composition and deterministic live/preview/UI-test graphs.
- Existing localization keys and accessibility semantics except the four
  literal feature action labels deliberately moved to resources.
- Existing essential transitions and state visibility when Reduce Motion is on.
- Android behavior and shared semantic intent; no Android source change in this
  story.

## 4. Work sequence

### 4.1 Bootstrap and characterization

1. Freeze the exact Phase 5 inventory in `phase-5-baseline.md`.
2. Add `ReguertaAdaptiveLayoutContractTests` before changing foundation code.
3. Characterize semantic token values, minimum hit-target behavior, existing
   safe-area ownership, gesture thresholds, and motion classification.
4. Add fail-fast structural checks for the complete 37-file legacy surface:
   `.resize*`, `DeviceScale`, capture view, and resize extensions.
5. Create deterministic component fixtures for compact/regular containers,
   Dynamic Type, locale, appearance, and Reduce Motion.
6. Capture explicit RED evidence for missing semantic tokens and retained legacy
   references; do not claim executable red for a purely mechanical rename if
   the existing behavior was already characterized.

### 4.2 Semantic foundation

1. Extend `ReguertaDesignTokens` with semantic spacing, radius, icon, layout,
   readable-width, touch-target, and motion contracts.
2. Keep raw primitive values private to the foundation; call sites consume
   named intent.
3. Replace the manual tokens `EnvironmentKey` with the current SwiftUI entry
   mechanism if it preserves fail-fast injection.
4. Preserve custom fonts with `relativeTo:` and remove width-derived font
   scaling.
5. Introduce one root Reduce Motion policy/value and test its propagation.
6. Keep the color-token catalog unchanged unless a separate contrast review
   demonstrates a necessary semantic change.

### 4.3 Shared DesignSystem components

Migrate and close one component family at a time:

1. Button and button styles.
2. Card and Inline Feedback.
3. Header and action/badge controls.
4. List item/action controls and Floating Action Button.
5. Dialog and its coordinate-space interaction.
6. Screen Scaffold and safe-area/layout values.
7. Input Field as a separately characterized configuration cut.

For every family:

- replace `.resize*` by semantic/component tokens or container behavior;
- prove a minimum 44-by-44-point hit region for interactive controls;
- rename a passive `*ViewModel` to Configuration/Model when touched;
- add deterministic long-text and relevant state previews;
- run focused tests, RenderPreview matrix, strict lint, and diff check;
- avoid introducing a new explicit struct initializer when synthesized
  memberwise construction is sufficient.

### 4.4 Root, Auth, Home, and motion

1. Remove root `DeviceScaleCaptureView` only after its consumers have a valid
   foundation replacement.
2. Migrate Auth forms/routes without changing auth state or errors.
3. Migrate Home shell widths, drawer gestures, and header/padding using current
   container values and semantic interaction thresholds.
4. Keep dashboard, drawer, startup, feedback, and overlays behaviorally stable.
5. Classify the inherited animation/transition sites; essential transitions
   remain visible, while material/non-essential effects honor Reduce Motion.
6. Validate compact phone, iPad full/split, AX5, locale, theme, VoiceOver, and
   reduced-motion states before moving to feature routes.

### 4.5 Route migrations

Migrate in bounded clusters, never by global replacement:

1. Products, Users, and Shared Profile.
2. My Order, My Orders History, Received Orders, and their history/summary
   components.
3. Shifts, Planning, Delivery Calendar, and Settings sheets.
4. News/Notifications and any remaining Presentation consumer.

Each cluster must:

- inventory its `.resize*`, fixed-frame, safe-area, gesture, accessibility, and
  preview surfaces before edits;
- add characterization where behavior is not already protected;
- map each numeric use to typography, spacing, radius, icon, target, layout,
  overlay, or interaction intent;
- use container-aware alternatives for widths and presentation layout;
- remove legacy safe-area compensation rather than stacking it;
- localize affected VoiceOver actions;
- run its focused tests and declared preview matrix;
- finish with zero `.resize*` in that cluster.

### 4.6 Mechanical modernization

Keep these changes separate from visual behavior cuts:

1. Replace four direct `Task.sleep(nanoseconds:)` sites with the appropriate
   injected/current Clock contract while preserving cancellation semantics.
2. Modernize stored content closures and redundant builders only where the
   touched component benefits and behavior is fully characterized.
3. Replace the Dialog named coordinate-space mechanism only if the current API
   expresses the same interaction contract more directly.
4. Re-run structural rules for Swift declaration formatting, synthesized struct
   initialization, inferred Sendable, actor safety, and one-View-per-file on the
   touched files.

### 4.7 Legacy removal

Only after every consumer cluster reports zero:

1. Remove `DeviceScale.swift`.
2. Remove `ResizeExtensions.swift`.
3. Remove `DeviceScaleCaptureView` and its root overlay.
4. Run the full zero searches and compile before any further cleanup.
5. Do not use this deletion as permission for unrelated layout refactoring.

### 4.8 Final matrix and closeout

1. Run the exact focused unit and compact UI commands from `spec.md`.
2. Execute the full visual/accessibility matrix for every affected family.
3. Run fast unit, UI smoke, release gate, color catalog, SwiftLint, settings,
   generic Debug, and Production Release.
4. Recalculate source/test/legacy counts and record the completion delta.
5. Run independent iOS architecture/concurrency and SwiftUI/accessibility
   reviews; remediate all P0-P3 findings.
6. Align `docs/design-system/foundations.md`,
   `docs-es/design-system/foundations.md`, `docs/design-system/components.md`,
   and `docs-es/design-system/components.md`; add only additive implementation
   notes to ADR-0005 EN/ES when the accepted decision requires them.
7. Synchronize issue #258 only with evidence that has actually passed.

## 5. Test strategy

### 5.1 Structural and pure contract tests

- Semantic token availability and ordering.
- Minimum touch-target constant and component hit-region contract.
- Zero use of global DeviceScale/capture/resize APIs at closure.
- Passive DesignSystem value naming.
- Localized accessibility-label keys and no literal regressions.
- Root motion policy behavior.
- Input-field localized-label transformation decision.
- Deterministic fixture construction and preview source coverage.

### 5.2 Behavior characterization

- Header actions/badges, button states, dialog actions, input clear/password,
  list actions, FAB placement, and scaffold safe-area behavior.
- Home drawer gesture thresholds and essential route transitions.
- Route bottom bars, search controls, totals, sheets, overlays, and scroll
  reachability.
- Cancellation behavior at the four Clock migration sites.

### 5.3 Visual and accessibility evidence

- Exact surfaces/states/sizes are the matrix in `spec.md`.
- Use Xcode RenderPreview for deterministic visual states and record
  `errors=[]` plus semantic inspection, not tool completion alone.
- Use runtime simulator/Accessibility Inspector for VoiceOver order, labels,
  actions, focus, and hit targets.
- Use iPhone SE for compact geometry, iPhone 17 for canonical functional gates,
  and iPad Air 11 for full-screen iPad; use a 600-point fixed preview/window for
  narrow multitasking/multiwindow.
- Exercise Large, XXX Large, AX5, ES-light, EN-dark, Increased Contrast, and
  Reduce Motion for every affected shared family.

### 5.4 Full lanes

Use the exact commands in `spec.md`. Final counts come from the produced
xcresult/runner output, never from inferred source counts alone.

## 6. Risk controls

| Risk | Control |
| --- | --- |
| Raw-number replacement masquerades as migration | Classify every use by semantic role; prohibit global replace |
| Double safe-area compensation | Name the owner before the cut; remove legacy padding/inset first |
| Sub-44 target on compact width | Focused geometry contract plus compact runtime check |
| Double Dynamic Type scaling | Relative text styles without width multiplier |
| Changed drawer/swipe behavior | Semantic threshold tests before migration |
| Reduce Motion hides state | Separate essential transition from material effect |
| Large diff drifts into Phase 6 | Route cluster boundaries; no product/state/navigation changes |
| Preview-only false confidence | Runtime accessibility and UI journeys remain mandatory |
| Renames mix behavior | Rename after characterization in the same component family |
| Android parity silently diverges | Record no-code parity gap and retain shared semantic docs |

## 7. Completion definition

HU-078 is complete only when:

- the 303 `.resize*` occurrences and complete 37-file legacy surface are zero;
- semantic layout/touch/motion contracts and shared component coverage exist;
- the full declared visual/accessibility matrix is evidenced;
- all exact validation gates are green;
- completion metrics and residual debt are explicit;
- independent reviews report zero unresolved P0-P3;
- issue/docs are synchronized; and
- delivery remains pending unless the maintainer separately authorizes it.

Any remaining `.resize*`, global window-derived layout state, sub-44 target, or
unreviewed matrix surface keeps Phase 5 open.

## 8. Execution snapshot (2026-08-20)

Sections 4.1 through 4.7 are implemented locally. The semantic foundation,
shared components, Root/Auth/Home, every declared route cohort, Clock migration,
and removal of the complete legacy layout surface are closed with focused tests
and zero static residuals.

The repository portion of section 4.8 is green:

- 72 focused logical responsibilities / 147 executions;
- compact UI 3/3;
- fast unit 668/668 logical responsibilities / 812 executions;
- UI smoke 4/4;
- release 677 total, 676 passed, the inherited launch-matrix skip, 0 failed;
  device/configuration executions 820 passed and 4 skipped;
- SwiftLint 0.61.0 with 0 findings across 391 files;
- effective settings 6/6, generic Debug green, Production Release green;
- color catalog 12 tokens / 11 pairs / 4 modes and clean diff/scope audits;
- both independent reviews with 0 unresolved P0-P3 findings.

The first release attempt exposed a preview helper incorrectly limited by
`#if DEBUG`; that compilation failure was remediated before the successful
`/private/tmp/hu078-final-release-gate-2.xcresult` rerun.

The manual closeout was completed on 2026-08-20 as bounded MVP acceptance.
VoiceOver and Voice Control navigation/actions behaved correctly on the sampled
journeys, sampled controls exposed no issue in Accessibility Inspector, and an
interactive Reduce Motion off/on comparison removed material animation without
hiding observed state changes or actions. This does not claim exhaustive
assistive-technology coverage. The implementation is ready for merge; delivery
authorization remains a separate maintainer decision.

HU-078 intentionally leaves Android UI/source implementation unchanged. A
separately authorized dependency-catalog maintenance commit is not adaptive
parity. The implementation-parity follow-up must reuse the shared semantic
intent while adopting Android-native adaptive APIs.
