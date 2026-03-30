# [HU-039] Role-aware home shell and drawer navigation

## Summary

As a member, producer, or admin I want a clearer home shell with role-aware navigation so that I can understand my available areas and key weekly context from a single entry point.

## Links
- GitHub Issue: #56
- Spec: spec/app/hu-039-role-aware-home-shell-and-drawer-navigation/spec.md
- Plan: spec/app/hu-039-role-aware-home-shell-and-drawer-navigation/plan.md
- Tasks: spec/app/hu-039-role-aware-home-shell-and-drawer-navigation/tasks.md

## Acceptance criteria

- Home shows a top-level shell prepared for menu access and notifications.
- Drawer exposes common sections to everyone and additional sections only when user role allows them.
- Drawer can be opened and closed through the menu trigger, and gesture support is reviewed per platform.
- Home reserves visible space for weekly context and latest news, even if backed initially by placeholders.
- App version remains visible in the drawer footer.

## Scope
### In Scope
- Implement story HU-039 within MVP shell/navigation scope.
- Build the visual structure for role-aware home navigation and placeholders.

### Out of Scope
- Real notifications/news logic.
- Final weekly summary business data.
- Unauthorized gating from HU-038.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [ ] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P2

## Dependencies
- #54 (HU-038)
- #1 (HU-010)
