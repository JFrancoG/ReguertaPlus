# Plan - HU-051 (Home dashboard and drawer redesign)

## 1. Technical approach

Implement HU-051 in small, parity-focused slices. Start with testable presentation/domain helpers for weekly summary and order-state display, then replace dashboard composition on each platform, then refine drawer underlay visuals and footer behavior.

Keep the current Home destination map and role permissions. The redesign should change hierarchy, layout, and state presentation, not introduce new navigation semantics.

GitHub tracking:

- #125 - HU-051 umbrella.
- #126 - Weekly summary behavior and order-state mapping.
- #127 - Dashboard UI redesign.
- #128 - Drawer underlay redesign.

## 2. Layer impact
- UI: Dashboard top bar, weekly summary card, action row, latest news placement, drawer header/navigation/footer, underlay animation.
- Domain: Weekly summary resolution, order-state display mapping, role-based drawer visibility reuse.
- Data: Read existing members, shifts, delivery calendar overrides, order/cart state, news, notifications, app version/build environment.
- Backend: No expected changes.
- Docs: HU-051 issue/spec/plan/tasks and references to approved design artifacts.

## 3. Platform-specific changes

### Android
- Replace current dashboard composition in `ReguertaRootHomeRoute`/related components with the weekly summary layout.
- Add presentation helper/model for weekly summary display data.
- Add order-state display mapping and tests where feasible.
- Update drawer components to:
  - keep underlay behavior if existing architecture supports it,
  - align close control left and reduce prominence,
  - use dividers between role groups,
  - show profile/family image or logo fallback,
  - show version with `DEV` marker for develop builds.
- Add/update Spanish strings.

### iOS
- Replace `dashboardRoute`/Home shell dashboard components with the weekly summary layout.
- Add presentation helper/model for weekly summary display data.
- Add order-state display mapping and tests where feasible.
- Refine `HomeDrawerContentView`/shell behavior to:
  - preserve Home-layer translation underlay interaction,
  - align close control left and reduce prominence,
  - use dividers between role groups,
  - show profile/family image or logo fallback,
  - show version with `DEV` marker for develop builds.
- Add/update string catalog entries.

### Functions/Backend
- Not expected.
- Only revisit if required profile/family image or weekly data is missing from existing client data.

## 4. Test strategy
- Unit:
  - weekly summary week-selection boundaries before/on/after delivery day,
  - delivery override behavior,
  - order-state display mapping,
  - drawer role visibility where existing test seams allow it.
- UI/snapshot/manual:
  - dashboard member view,
  - dashboard producer view,
  - dashboard admin/producer view,
  - drawer with common-only permissions,
  - drawer with producer permissions,
  - drawer with admin permissions,
  - develop version marker.
- Regression:
  - menu opens/closes,
  - notifications route still opens,
  - `Mi pedido` still opens and refreshes products,
  - `Pedidos recibidos` still opens for producer users.

## 5. Rollout and functional validation
- Implement Android and iOS in the same story to maintain parity.
- If one platform is blocked, continue with the other and record the temporary parity gap.
- Validate with develop time-machine/date override where available.
- Capture screenshots for:
  - before/on delivery day,
  - day after delivery,
  - drawer common/producer/admin variants.

## 6. Phased implementation sequence

### Phase 1 - Data contracts and helpers
- Track in #126.
- Define `HomeWeeklySummaryDisplay` equivalent on Android and iOS.
- Define week-selection inputs: `now`, default delivery weekday, overrides, delivery shifts, members, current order state.
- Define order-state display enum and labels/colors.
- Add unit tests for date boundary rules and order-state mapping.

### Phase 2 - Dashboard UI
- Track in #127.
- Replace dashboard weekly/shifts placeholder with the compact weekly summary card.
- Update top bar center title to full current date.
- Keep `Mi pedido` and `Pedidos recibidos` action row.
- Keep latest news below actions with constrained/scrollable behavior.
- Verify text truncation and no overlap on compact devices.

### Phase 3 - Drawer UI
- Track in #128.
- Refine drawer close control.
- Replace visible group headings with subtle dividers.
- Add avatar/profile image source with logo fallback.
- Add develop version marker.
- Preserve underlay Home translation behavior and gestures.

### Phase 4 - Parity and polish
- Align strings and visual states across Android/iOS.
- Review accessibility labels/content descriptions.
- Review dynamic type/font scaling impacts.
- Update docs if implementation intentionally differs from design.

### Phase 5 - Validation and closure
- Run Android checks:
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` if UI behavior changed and emulator/device is available.
- Run iOS checks:
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' test`
  - use any valid local simulator if iPhone 16 is unavailable and report it.
- Capture final screenshots and complete HU-051 task checklist.

## 7. Technical risks and mitigation
- Risk: current data exposes only next delivery shift, not enough for "next week after delivery" in all cases.
  - Mitigation: derive from shifts feed when available; define fallback state and avoid blocking Home rendering.
- Risk: delivery overrides and shift dates disagree.
  - Mitigation: prefer existing effective delivery date helpers used by order/shift routes.
- Risk: profile image ownership is ambiguous between member and family profile.
  - Mitigation: implement logo fallback first; use existing shared profile image only when unambiguous.
- Risk: compact dashboard overflows with long names.
  - Mitigation: test with long producer/responsible/helper names and apply line limits/truncation.
