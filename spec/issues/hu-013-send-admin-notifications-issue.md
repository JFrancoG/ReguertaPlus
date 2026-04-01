# [HU-013] Send admin notifications

## Summary

As an admin I want to send notifications through the enabled MVP mode so that I can communicate incidents and updates to registered member devices, and as an authorized member I want to consult notifications from the app shell.

## Links
- Spec: spec/notifications/hu-013-send-admin-notifications/spec.md
- Plan: spec/notifications/hu-013-send-admin-notifications/plan.md
- Tasks: spec/notifications/hu-013-send-admin-notifications/tasks.md

## Acceptance criteria

- Authorized members can open notifications from the home bell or the drawer and see them ordered by `sentAt` descending.
- Admin can send notifications from the admin drawer entry and from the notifications screen.
- Notifications remain immutable in this MVP iteration.
- App clients persist and consult `notificationEvents` correctly for in-app usage.
- App clients upsert `users/{userId}/devices/{deviceId}` and `users.lastDeviceId` after an authorized session, including the latest known `fcmToken` when available.
- Real push delivery is dispatched from backend when a new `notificationEvents` document is created.

## Scope
### In Scope
- Implement story HU-013 within MVP scope.
- Satisfy linked RFs: RF-NOTI-04, RF-NOTI-05.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.
- Read/unread state persistence and unread badge.
- Editing existing notifications.
- Mandatory automatic cleanup by age in this first pass.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore push delivery
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:notifications
- platform:cross
- priority:P2
