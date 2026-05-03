# HU-051 - Home dashboard and drawer redesign

## Metadata
- issue_id: 125
- priority: P2
- platform: both
- status: ready

## Context and problem

The current Home shell already exposes drawer navigation, notifications, weekly placeholders, news, order entry, producer routes, and version metadata. The visual hierarchy is still too placeholder-like for the operational app: weekly context, delivery responsibility, order state, and role-specific navigation need to be clear at a glance.

Approved design artifacts now define a compact dashboard and underlay drawer behavior:

- `docs/design/home-dashboard/weekly-summary-proposal.md`
- `docs/design/home-dashboard/weekly-summary-proposal.png`
- `docs/design/home-dashboard/drawer-underlay-proposal.md`
- `docs/design/home-dashboard/drawer-underlay-proposal.png`

Implementation is split across:

- #126 - Home weekly summary behavior and order-state mapping.
- #127 - Home dashboard UI redesign.
- #128 - Home drawer underlay redesign.

This story turns those design decisions into a cross-platform implementation plan while preserving feature parity between Android and iOS.

## User story

As a member, producer, or admin I want the Home screen and side drawer to show the current weekly context, my order entry points, role-specific navigation, and latest news in a compact way so that I can understand what matters this week without scanning multiple screens.

## Scope

### In Scope
- Dashboard top bar with:
  - menu action,
  - full current date in Spanish, e.g. `miércoles 6 mayo`,
  - notifications action with unread indicator where available.
- Weekly summary card with:
  - displayed week range,
  - ISO week number as secondary pill,
  - producer name,
  - delivery day/date,
  - responsible member,
  - helper member in a smaller secondary line,
  - order state.
- Weekly display rule:
  - before or on delivery day, show the current delivery week from Monday through delivery day inclusive,
  - from the day after delivery, show the next delivery week.
- Order state visual mapping:
  - `Sin hacer`: no products selected,
  - `Sin confirmar`: products selected but order not confirmed,
  - `Completado`: confirmed order.
- Primary action row:
  - `Mi pedido` remains the main action,
  - `Pedidos recibidos` remains the producer action and is only visible/enabled when role allows it,
  - `Mi pedido` subtitle can vary programmatically by date/order state.
- Latest news area below the action row; this is the only dashboard content intended to scroll/clip when there are many entries.
- Drawer redesign:
  - drawer remains an underlay, with the Home layer moving right to reveal it,
  - close control is small and aligned left,
  - profile/family image appears when available,
  - La Reguerta logo is the fallback avatar,
  - navigation groups are separated by subtle dividers, not visible section headings,
  - sign-out and app version remain anchored in the footer,
  - develop builds show a visible `DEV` marker.
- Spanish localization for all new visible strings.
- Cross-platform parity for information architecture, visibility rules, and state semantics.

### Out of Scope
- Backend schema changes unless implementation discovers missing persisted data.
- New order-editing or producer-status workflows.
- New notification/news publishing capabilities.
- Replacing existing role resolution or permission matrix.
- Pixel-perfect identical rendering between Android and iOS; semantic and visual parity is the target.

## Linked functional requirements

- RF-ROL-01
- RF-ROL-03
- RF-ROL-04
- RF-PED-01
- RF-PED-02
- RF-TUR-01
- RF-COM-01

## Acceptance criteria

- Home top bar shows current date in full Spanish text and keeps menu/notifications controls accessible.
- Weekly summary selects current or next delivery week according to the delivery-day cutoff rule.
- Weekly summary displays producer, delivery date, responsible member, helper member, and order state using the approved compact layout.
- Producer/responsible fields have more width than delivery/state fields.
- Order state uses distinct visual treatment for `Sin hacer`, `Sin confirmar`, and `Completado`.
- `Mi pedido` and `Pedidos recibidos` match the approved action-row hierarchy.
- `Pedidos recibidos` is not exposed to users without producer capability.
- Latest news appears below the actions and can overflow independently from the fixed dashboard context.
- Drawer opening reveals the drawer underneath by moving the Home layer.
- Drawer header uses profile/family image when present and La Reguerta logo fallback otherwise.
- Drawer role groups are separated with dividers and keep role-gated visibility.
- Drawer footer shows sign-out, platform/version, and `DEV` marker when applicable.
- Android and iOS expose equivalent semantics, visible states, and role behavior.

## Dependencies

- HU-039 for existing Home shell/drawer architecture.
- HU-044 for role/capability semantics.
- HU-011/HU-015/HU-041 for delivery calendar and shift assignments.
- HU-001..HU-005 for weekly order/cart/confirmed-state behavior.
- HU-012/HU-013 for news and notifications feed data.
- Design artifacts in `docs/design/home-dashboard/`.
- GitHub implementation issues #126, #127, and #128.

## Risks

- Risk: weekly display rules diverge from order-window rules.
  - Mitigation: isolate weekly summary resolution in a shared/testable helper per platform and cover boundary dates.
- Risk: producer/responsible names overflow compact cards.
  - Mitigation: use asymmetric grid widths, line limits, and truncation/secondary-line rules.
- Risk: Android and iOS drawer animations feel different.
  - Mitigation: define the invariant as underlay behavior with Home-layer translation and shadow; let platform animation details differ.
- Risk: profile/family image data is not consistently available.
  - Mitigation: ship logo fallback first and integrate image source opportunistically using existing profile/media pipeline.
- Risk: role-gated drawer options become visually hidden but still reachable.
  - Mitigation: centralize drawer destination visibility and reuse existing permission checks.

## Definition of Done (DoD)

- [ ] Acceptance criteria validated on Android and iOS.
- [ ] Agreed test coverage executed.
- [ ] Android/iOS parity reviewed.
- [ ] Documentation updated.
- [ ] Known parity gaps, if any, documented in handoff.
