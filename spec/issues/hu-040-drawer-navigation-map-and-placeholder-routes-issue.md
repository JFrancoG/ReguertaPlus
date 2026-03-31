# [HU-040] Drawer navigation map and placeholder routes

## Summary

As a member, producer, or admin I want the drawer to open real app destinations, even when some sections are still placeholders, so that navigation is clear and future stories can be implemented on top of stable routes.

## Links
- GitHub Issue: #58
- Spec: spec/app/hu-040-drawer-navigation-map-and-placeholder-routes/spec.md
- Plan: spec/app/hu-040-drawer-navigation-map-and-placeholder-routes/plan.md
- Tasks: spec/app/hu-040-drawer-navigation-map-and-placeholder-routes/tasks.md

## Acceptance criteria

- Every drawer item visible to the user opens a concrete route instead of remaining a dead placeholder.
- Common routes are visible to all authorized users.
- Producer-only routes are visible only when the user has producer role.
- Admin-only routes are visible only when the user has admin role.
- `Sign out` is exposed as a drawer action and asks for explicit confirmation before closing the session.
- Placeholder routes clearly communicate that the destination exists but the business implementation is pending.
- Android and iOS expose the same information architecture and route visibility, even if native navigation presentation differs.
- Settings route is present and visually ready to host role-aware sections later.

## Scope
### In Scope
- Implement story HU-040 within MVP navigation-shell scope.
- Wire drawer entries to actual routes and placeholder destinations.
- Add sign-out confirmation from drawer action.

### Out of Scope
- Real business logic for orders, news, notifications, products, or users.
- Historical data/filter implementations beyond route scaffolding.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P2

## Dependencies
- #56 (HU-039)
