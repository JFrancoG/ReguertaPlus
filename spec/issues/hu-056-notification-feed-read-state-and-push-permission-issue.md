# [HU-056] Notification feed read state and push permission

## Summary

Redesign the notifications screen as a direct feed, persist per-user read state, mark visible notifications as read on exit, and show a Reguerta info dialog when push notifications are inactive.

## Links
- Remote issue: https://github.com/JFrancoG/ReguertaPlus/issues/146
- Spec: spec/notifications/hu-056-notification-feed-read-state-and-push-permission/spec.md
- Plan: spec/notifications/hu-056-notification-feed-read-state-and-push-permission/plan.md
- Tasks: spec/notifications/hu-056-notification-feed-read-state-and-push-permission/tasks.md

## Acceptance criteria
- Notifications appear directly below the `Notificaciones` title, ordered newest first.
- Each notification shows `dd MMMM yyyy`, then a card with type icon, title, and body.
- Read cards use accent/action-primary at 0.15 opacity; unread cards use warning at 0.15 opacity.
- Empty state shows red copy: `Aún no tienes notificaciones`.
- Visible unread notifications are marked read when leaving the screen.
- If push permission is inactive, a Reguerta info dialog offers `Cerrar` and `Ir a Ajustes`.

## Scope
### In Scope
- Android and iOS notification feed UI.
- Read marker persistence under `users/{userId}/notificationReads/{eventId}`.
- Platform permission checks and settings action.
- Home bell unread indicator.
- Tests and Firestore contract docs.

### Out of Scope
- Red badge counts.
- Mutating `notificationEvents`.
- Remote issue creation.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Firestore contract docs
- [x] Testing added
- [x] Validation run

## Suggested labels
- type:feature
- area:notifications
- platform:cross
- priority:P2
