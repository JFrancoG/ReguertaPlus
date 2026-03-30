# HU-028 - Role-aware home shell and drawer navigation

## Metadata
- issue_id: TBD
- priority: P2
- platform: both
- status: draft

## Context and problem

The app needs a more intentional home shell that can host future modules, notifications, weekly context, and role-aware navigation without overloading the current placeholder layout.

## User story

As a member, producer, or admin I want a clearer home shell with role-aware navigation so that I can understand my available areas and key weekly context from a single entry point.

## Scope

### In Scope
- Home top shell with menu trigger and notification entry point.
- Side drawer with common sections for all users and role-specific sections for producers and admins.
- Profile area in the drawer, including optional profile image placeholder.
- Version footer in the drawer.
- Home placeholders for weekly context and latest news list.
- Drawer open/close interaction by button and gestures where supported by platform patterns.

### Out of Scope
- Real notification center logic.
- Real news feed backend integration.
- Final weekly-summary data contract and live business calculations.
- Unauthorized access handling, already tracked by HU-027.

## Linked functional requirements

- RF-ROL-01
- RF-ROL-03
- RF-ROL-04

## Acceptance criteria

- Home shows a top-level shell prepared for menu access and notifications.
- Drawer exposes common sections to everyone and additional sections only when user role allows them.
- Drawer can be opened and closed through the menu trigger, and gesture support is reviewed per platform.
- Home reserves visible space for weekly context and latest news, even if backed initially by placeholders.
- App version remains visible in the drawer footer.

## Dependencies

- Depends on HU-027 for unauthorized-state gating rules.
- Depends on existing role resolution from HU-010.

## Risks

- Risk: shell redesign leaks unfinished modules into navigation.
  - Mitigation: allow placeholders visually while keeping unsupported destinations disabled or clearly labeled.
- Risk: Android/iOS drawer behavior diverges too much.
  - Mitigation: align information architecture and role visibility even if native interactions differ slightly.

## Definition of Done (DoD)

- [ ] Story acceptance criteria implemented in code.
- [ ] Android/iOS parity reviewed.
- [ ] Agreed test coverage executed.
- [ ] Documentation updated.
- [ ] Story acceptance criteria validated manually in develop.
