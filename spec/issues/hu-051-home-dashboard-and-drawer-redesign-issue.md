# [HU-051] Home dashboard and drawer redesign

## Summary

As a member, producer, or admin I want the Home screen and side drawer to show the current weekly context, my order entry points, role-specific navigation, and latest news in a compact way so that I can understand what matters this week without scanning multiple screens.

## Links
- GitHub Issue: #125
- Spec: spec/app/hu-051-home-dashboard-and-drawer-redesign/spec.md
- Plan: spec/app/hu-051-home-dashboard-and-drawer-redesign/plan.md
- Tasks: spec/app/hu-051-home-dashboard-and-drawer-redesign/tasks.md
- Design: docs/design/home-dashboard/weekly-summary-proposal.md
- Design: docs/design/home-dashboard/drawer-underlay-proposal.md
- Implementation: #126 (weekly summary behavior)
- Implementation: #127 (dashboard UI)
- Implementation: #128 (drawer UI)

## Acceptance criteria

- Home top bar shows the current date in full Spanish text, e.g. `miércoles 6 mayo`, plus menu and notifications actions.
- Home weekly summary shows the active display week from Monday through the delivery day inclusive; from the day after delivery, it shows the next delivery week.
- Weekly summary displays producer, delivery day, responsible member, helper member, and order state with asymmetric field widths.
- Order state uses distinct visual treatment for `Sin hacer`, `Sin confirmar`, and `Completado`.
- `Mi pedido` and `Pedidos recibidos` remain visible as the primary action row, with `Pedidos recibidos` only enabled/visible for producer-capable users.
- Latest news remains visible below the actions and is the only dashboard area intended to scroll when content overflows.
- Drawer remains an underlay: opening the menu moves the Home layer right and reveals the drawer beneath, rather than presenting the drawer as an overlay.
- Drawer header uses profile/family image when available and falls back to the La Reguerta logo.
- Drawer navigation is grouped by shared, producer, and admin capabilities using subtle dividers rather than visible group headings.
- Drawer footer shows sign-out and app version, with a visible `DEV` marker for develop builds.

## Scope

### In Scope
- Implement story HU-051 across Android and iOS.
- Replace the current dashboard card composition with the approved weekly-summary layout.
- Refine drawer visuals, information hierarchy, and underlay behavior.
- Reuse existing role/capability visibility rules from HU-039/HU-044.
- Reuse existing shifts, delivery calendar, members, news, notifications, and order state data where possible.

### Out of Scope
- New backend collections or schema unless a blocker is discovered during implementation.
- New producer/order business workflows beyond display state and navigation.
- Full Figma migration of the design artifacts.
- Changing the side-menu destination map beyond visual grouping and visibility.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Implementation issues
- [ ] #126 - Home weekly summary behavior and order-state mapping.
- [ ] #127 - Home dashboard UI redesign.
- [ ] #128 - Home drawer underlay redesign.

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P2

## Dependencies
- HU-039 role-aware home shell and drawer navigation.
- HU-044 canonical role permission matrix and test fixtures.
- Existing delivery calendar and shift data from HU-011/HU-015/HU-041.
- Existing order state and cart/confirmation behavior from HU-001..HU-005.
- Existing news and notifications feeds from HU-012/HU-013.
