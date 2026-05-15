# ADR-0005: Use Safe-Area Screen Scaffold for iOS SwiftUI Home Routes

## Status

Accepted

## Date

2026-05-15

## Context

The iOS Home shell had several routes composed inside a full-screen `ZStack`
that ignored the vertical safe area. Individual routes then compensated with
manual bottom padding, nested scroll views, and bottom overlays for search,
totals, and primary actions.

That pattern made small-device layout fragile: bottom controls could cover the
last rows of a scroll, route content had to know about shell-level safe area
details, and extracting routes away from `ContentView` extensions became harder.

## Decision

Use `ReguertaScreenScaffold` as the Home route presentation container on iOS.
The scaffold owns the screen header through a top safe-area inset and supports
optional shell-level bottom content through a bottom safe-area inset. The screen
background may ignore safe areas, but route content should stay inside the safe
area.

Each feature route owns its own scroll view and any route-specific bottom
control with `safeAreaInset(edge: .bottom)`. Floating or modal interactions such
as dialogs, the drawer scrim, and the My Order cart overlay remain explicit
overlays because they intentionally sit above the route.

The first migrated routes under this convention are:

- `MyOrderRouteView`
- `ReceivedOrdersRouteView`
- `UsersRouteView`

Do not add new Home screens to the legacy pattern where route layout is owned by
`ContentView` or `AccessRootRoutingView` extensions.

## Consequences

### Positive

- Header, route content, and bottom controls have clearer ownership.
- Scroll views reserve space for bottom bars without hard-coded bottom padding.
- Routes can be extracted incrementally without depending on the root view's
  manual safe-area calculations.
- UI tests can target route-level bottom controls directly.

### Negative

- Existing routes still using manual layout compensation need incremental
  migration.
- Some modal overlays still need careful review because they intentionally cover
  safe areas.

## Notes

This ADR is presentation-layer only. It does not change domain, Firebase,
repository, or Android contracts.
