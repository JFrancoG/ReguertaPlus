# HU-040 - Drawer navigation map and placeholder routes

## Metadata
- issue_id: 58
- priority: P2
- platform: both
- status: implemented

## Context and problem

HU-039 introduced the home shell and role-aware drawer, but several drawer entries still act as visual placeholders without a complete navigation map. Before implementing more business stories on top of that shell, the app needs a stable route inventory and placeholder destinations so future work can plug into existing navigation instead of redefining it repeatedly.

## User story

As a member, producer, or admin I want the drawer to open real app destinations, even when some sections are still placeholders, so that navigation is clear and future stories can be implemented on top of stable routes.

## Scope

### In Scope
- Define the canonical drawer navigation map for common, producer, and admin areas.
- Wire drawer items to actual routes on Android and iOS.
- Add placeholder screens for destinations that do not yet have business functionality.
- Add a sign-out confirmation dialog when `Sign out` is triggered from the drawer.
- Add route placeholders for:
  - Home
  - My order
  - My orders
  - Shifts
  - News
  - Notifications
  - Profile
  - Settings
  - Products
  - Received orders
  - Users
  - Publish news
  - Send extraordinary notification
- Keep role visibility aligned with existing authorization and role resolution.
- Make `Settings` ready to host role-aware sections.

### Out of Scope
- Real business functionality inside placeholder destinations.
- Historical order query logic itself.
- Historical received-orders filtering logic itself.
- Real notification sending logic.
- Real news authoring/publishing logic.
- Global settings backend contracts.

## Navigation inventory

### Common routes
- Home
- My order
- My orders
- Shifts
- News
- Notifications
- Profile
- Settings

### Producer routes
- Products
- Received orders

### Admin routes
- Users
- Publish news
- Send extraordinary notification

### Global actions
- Sign out with confirmation dialog

### Deferred subflows inside routed screens
- My orders: historical query by other week
- Received orders: history filtered by week or month
- Settings: role-aware sections by common / producer / admin

## Linked functional requirements

- RF-ROL-01
- RF-ROL-03
- RF-ROL-04

## Acceptance criteria

- Every drawer item visible to the user opens a concrete route instead of remaining a dead placeholder.
- Common routes are visible to all authorized users.
- Producer-only routes are visible only when the user has producer role.
- Admin-only routes are visible only when the user has admin role.
- `Sign out` is exposed as a drawer action and asks for explicit confirmation before closing the session.
- Placeholder routes clearly communicate that the destination exists but the business implementation is pending.
- Android and iOS expose the same information architecture and route visibility, even if native navigation presentation differs.
- Settings route is present and visually ready to host role-aware sections later.

## Dependencies

- Depends on HU-039 for the drawer shell and role-aware presentation.
- Enables HU-011, HU-012, HU-013, HU-014, and future drawer-driven stories.

## Risks

- Risk: route naming drifts between platforms.
  - Mitigation: define a single canonical route inventory in this HU and reuse it across Android and iOS.
- Risk: placeholders become misleading if they look too final.
  - Mitigation: make placeholder status explicit in destination copy and keep unsupported actions disabled.

## Definition of Done (DoD)

- [x] Canonical route inventory implemented in code.
- [x] Android/iOS parity reviewed.
- [x] Agreed test coverage executed.
- [x] Documentation updated.
- [ ] Manual validation of role visibility and route entry completed in develop.
