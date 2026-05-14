# HU-053 - iOS Liquid Glass screen header migration

## Metadata
- issue_id: #136
- priority: P2
- platform: ios
- status: implemented

## Context and problem

HU-052 created the reusable `ReguertaScreenHeader` component without migrating screens. HU-054 then aligned the iOS design-system component architecture so the header and the rest of the reusable components follow a predictable view/view-model split.

The app still has multiple screen-level top chrome patterns: local back buttons, custom title rows, duplicated title text, Home-specific controls, and internal section headers that sometimes act like route headers. Migrating everything at once can easily introduce spacing, title duplication, or navigation regressions, so this story treats the migration as a deliberate iOS-only pass.

## User story

As an iOS user I want screen headers to behave and look consistently across app routes so that back navigation, screen titles, contextual text, and optional actions feel predictable.

## Scope

### In Scope
- Audit iOS screens that define custom route headers, local back buttons, title rows, or internal top bars.
- Replace applicable screen-level top chrome with `ReguertaScreenHeader`.
- Use the existing `ReguertaScreenHeaderViewModel` API:
  - `title`
  - `leadingAction`
  - `leadingText`
  - `trailingAction`
- Migrate auth back-button usage where it is part of screen chrome.
- Remove duplicated title text where `ReguertaScreenHeader` becomes the title owner.
- Preserve navigation behavior and route state.
- Preserve existing accessibility labels and identifiers, or replace them with equivalent header action identifiers.
- Review `HomeShellTopBarView` separately and document the decision:
  - migrate to `ReguertaScreenHeader`,
  - adapt partially,
  - or keep specialized because Home behaves differently.
- Document screens intentionally left out and why.

### Out of Scope
- Redesigning `ReguertaScreenHeader`.
- Adding new header features beyond the HU-052 API.
- Android/Compose header parity.
- New navigation destinations or business workflows.
- Broad screen redesign unrelated to top chrome.
- Reworking the design-system component architecture already completed in HU-054.

## Initial migration candidates

- Auth routes with local back buttons and form titles.
- Feature routes using local `commonBack` buttons.
- Order routes with modal/dialog top chrome where the header is screen-level.
- Products, news, users, settings, shifts, profile, bylaws, and received-orders routes with screen title/back patterns.
- Home shell top bar, only after a specific decision because it carries menu/date/notifications and may remain a specialized home control.

## Linked functional requirements

- RF-APP-HEADER-01
- RF-APP-HEADER-02
- RF-APP-ACCESSIBILITY-01

## Acceptance criteria

- Applicable iOS screens use `ReguertaScreenHeader` for screen-level top chrome.
- Existing custom back buttons are removed where `ReguertaScreenHeader` owns the back action.
- Existing duplicated screen titles are removed where `ReguertaScreenHeader` owns the title.
- Screen titles remain optional and are not added to Home unless intentionally decided.
- Long titles and optional leading text do not overlap leading or trailing actions.
- Header actions use the right SF Symbols, accessibility labels, and accessibility identifiers.
- The Home shell top bar decision is documented in the spec/tasks or implementation handoff.
- Screens intentionally not migrated are listed with rationale.
- iOS build/test validation passes or any blocker is documented.
- Android impact is reviewed and recorded as out of scope.

## Implementation notes

### Home shell decision

`HomeShellTopBarView` now delegates to `ReguertaScreenHeaderView` instead of keeping its own Liquid Glass button implementation. The dashboard remains the only Home route without a screen title: it uses the header leading text slot for the date, with menu and notifications actions. Non-dashboard Home routes use the header title slot below the back action, matching the HU-052 component contract.

The existing Home navigation closures are unchanged:

- Dashboard primary action opens the drawer.
- Feature-route primary action returns to the right parent route and clears editor/draft state where it already did.
- Notifications and cart actions keep their route-specific behavior.

### Migrated screen chrome

- Auth login/register/recover routes now use `ReguertaScreenHeaderView` for back + title.
- Home shell routes now get their visible screen title from the reusable header.
- Duplicate route-level titles were removed from bylaws, shifts, settings, news list, notifications list, My Order product list, received orders, news editor, notification editor, shift swap request, and placeholder routes.
- Duplicate local back buttons were removed from news editor, notification editor, shift swap request, and placeholder routes because the shell header back action owns the same navigation behavior.
- Home menu/back/cart/notification action identifiers remain feature-specific. The top title identifier now uses the shared header identifier `reguerta.screenHeader.title`.

### Visual follow-up adjustments

- The header no longer wraps the full title/top-row composition in `GlassEffectContainer`; each icon circle owns its own glass effect so titles and badges do not participate in the lens.
- Badges are rendered as siblings above the glass button instead of inside the button label.
- The iOS 26 glass button follows the simple custom Liquid Glass pattern: apply `.glassEffect(.regular.tint(...).interactive(...), in: Circle())` directly to the button, using light/dark adaptive tints instead of custom backgrounds, borders, or shadows.
- Header glass buttons use a 52-point circle and lighter tints so route backgrounds remain visible through the glass.
- The fallback material shadow was reduced to keep non-iOS-26 rendering subtle.
- The Home shell paints the app surface behind the reusable header so side-menu routes do not refract or amplify route content underneath the glass buttons.
- The My Order shell title now reflects route state:
  - `Lista de productos` while editing/selecting products.
  - `Mi pedido` for a confirmed current order.
  - `Mi último pedido` for read-only previous-order summary.
- The My Order header no longer receives extra horizontal padding.
- Previous-order `weekKey` text was removed from the UI.
- Bottom total bars in My Order use a stronger action-primary opacity.

### Intentionally left out

- Products, users, and shared-profile internal back buttons remain because they close local editor/detail state rather than navigating the Home destination back to dashboard.
- Products, users, shared profile, order detail, and admin/settings section headings remain where they are content or section labels rather than route chrome.
- Bylaws PDF sheet toolbar, delivery-calendar sheets, dialogs, and overlays remain specialized modal chrome.
- Android/Compose parity remains out of scope for HU-053.

## Validation evidence

- `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build` succeeded.
- SwiftLint ran through the Xcode build phase. It reported one pre-existing warning in `Data/Orders/FirestoreMyOrderPreviousOrder.swift`, outside the touched files.
- `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test` succeeded.
- After visual follow-up adjustments, the same build and test commands were run again successfully.
- Xcode emitted simulator/debugger launch warnings after the test result, but the test session completed with `** TEST SUCCEEDED **`.
- Manual visual pass was performed through user-provided light/dark screenshots during the header iterations.

## Dependencies

- HU-052 reusable `ReguertaScreenHeader`.
- HU-054 design-system component architecture refactor.
- Existing iOS navigation and route state.
- GitHub issue #136.
- GitHub PR #137.

## Risks

- Risk: duplicated titles remain after migration.
  - Mitigation: inspect each migrated route for local title text and remove only the duplicate screen chrome title.
- Risk: Home top bar has semantics that do not map cleanly to a normal screen header.
  - Mitigation: decide and document Home separately instead of forcing it into the generic component.
- Risk: call-site changes disturb navigation behavior.
  - Mitigation: keep existing closures/state mutations and only change the visual wrapper.
- Risk: accessibility identifiers change unexpectedly.
  - Mitigation: preserve identifiers where tests depend on them and validate UI tests.
- Risk: visual spacing changes compound across many routes.
  - Mitigation: migrate in small groups, validate with screenshots/previews/manual pass where possible.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] iOS validation executed or blocker documented.
- [x] Android impact reviewed and recorded as out of scope.
- [x] Home header decision documented.
- [x] Screens intentionally left out documented.
- [x] Issue and PR linked.
