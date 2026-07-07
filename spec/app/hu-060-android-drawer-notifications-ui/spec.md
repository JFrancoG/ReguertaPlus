# HU-060 - Android/iOS UI spacing and text polish

## Metadata
- issue_id: 157
- priority: P2
- platform: android, ios
- status: in-progress

## Context and problem

Several Android screens diverge from the iOS visual reference used during review, while a few iOS details also need small spacing or typography corrections.

The Android drawer currently exposes route names that do not match the iOS route semantics, opens too quickly, and visually extends too far across the screen. The notifications feed also places date headers too far from the left alignment used by the notification cards; iOS keeps those dates under the screen title and aligned with the content column. Follow-up screenshot review also identified spacing and typography differences in welcome, auth, home week badges, latest news headings, and notification hierarchy.

## User story

As a member I want the app's main entry, home, drawer, and notifications screens to use coherent spacing, route names, and typography across Android and iOS.

## Scope

### In Scope
- Align Android drawer item labels with the iOS labels for equivalent routes.
- Tune Android drawer open/close animation to feel less abrupt.
- Adjust Android drawer width/placement so it remains visually contained while preserving the menu button state.
- Align Android notification date headers with the notification cards and title hierarchy.
- Adjust Android welcome/auth/home typography and spacing where it clearly diverges from the iOS reference.
- Apply small iOS welcome/home typography adjustments when the cross-platform comparison shows Android is closer to the intended balance.
- Consult iOS source and screenshots as the reference for copy and layout intent.

### Out of Scope
- Changing role/capability rules for drawer visibility.
- Changing notification read-state behavior.
- Backend, Firestore, or Cloud Functions changes.
- Pixel-perfect iOS rewrites.
- Final redesign of home order buttons after light/dark review.

## Acceptance criteria

- Android drawer labels match iOS route semantics:
  - all personal orders/history routes use the same conceptual names as iOS,
  - shifts/bylaws/news/community/settings/products/order-history/users/sign-out remain distinguishable and consistent.
- Android drawer width leaves the home content visible like the iOS reference instead of covering nearly the full screen.
- Android drawer animation is slower and smoother than the current abrupt transition.
- Android notifications date headers are placed below the `Notifications` title and aligned with notification cards.
- Android welcome logo/title spacing is calmer and the auth title is less oversized.
- The week badge uses the app font and a regular weight on both platforms.
- Latest news heading hierarchy is closer between platforms.
- No route loses its existing role-based visibility.
- Android validation passes for the touched app area and iOS builds after the small SwiftUI adjustments.

## Dependencies

- Existing HU-039/HU-040 home shell and drawer navigation.
- Existing HU-056 notifications feed.
- iOS drawer and notification layouts as visual reference.

## Risks

- Risk: renaming drawer items changes expected tests or localization strings.
  - Mitigation: update only labels for existing destinations and keep destination identifiers unchanged.
- Risk: slowing drawer animation makes navigation feel laggy.
  - Mitigation: use a modest duration increase and keep gestures/taps responsive.
- Risk: width changes hide drawer content on narrow Android screens.
  - Mitigation: use responsive width constraints and keep text truncation.

## Definition of Done (DoD)

- [x] Acceptance criteria validated on Android.
- [x] iOS reference checked where labels or spacing are ambiguous.
- [x] Android tests/lint run according to AGENTS.md.
- [x] iOS build run after SwiftUI changes.
- [x] Documentation/tasks updated with validation evidence.
