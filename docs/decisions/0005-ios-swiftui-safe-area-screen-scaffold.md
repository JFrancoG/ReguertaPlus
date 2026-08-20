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

## Implementation Addendum: HU-078 (2026-08-20)

HU-078 implements the accepted decision without changing its ownership model.
`ReguertaScreenScaffold` now receives the width of its active SwiftUI container,
centers regular-width content, and caps readable content at 720 points. Compact
containers continue to use their available width.

The implementation no longer reads process-global window geometry:
`DeviceScale`, its capture view, resize extensions, and all `.resize*` consumers
were removed. This makes two windows or split containers independent while
retaining the original safe-area decision:

- the scaffold owns the header through its top safe-area inset;
- optional shell-level bottom content remains a scaffold bottom inset;
- each feature route owns its scroll and route-specific bottom inset; and
- the drawer scrim, dialogs, and My Order cart remain explicit overlays because
  their intentional z-axis ownership did not change.

Semantic layout and spacing tokens replace width-ratio compensation. The
focused 3/3 compact UI journeys, complete repository release gate, and
independent reviews validate the implementation boundary. Runtime VoiceOver
order/focus/actions and an interactive Reduce Motion journey remain tracked as
manual HU-078 evidence; this addendum does not treat those checks as complete or
alter the ADR's Accepted status.

No Android, Domain, Data, Firebase, repository, or backend contract changes as a
result of this addendum.

## HU-078 Manual Acceptance Note (2026-08-20)

The maintainer subsequently completed the manual gate tracked by the addendum.
Representative VoiceOver and Voice Control navigation/actions behaved
correctly; sampled controls exposed no issue in Accessibility Inspector; and an
interactive Reduce Motion off/on comparison suppressed material animation
without hiding observed states or actions. This closes HU-078's bounded MVP
acceptance and does not alter the decision or claim exhaustive accessibility
certification.
