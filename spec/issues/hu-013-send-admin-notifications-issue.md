# [HU-013] Send admin notifications

## Summary

As an admin I want to send notifications through enabled modes so that I can communicate incidents and updates to registered member devices.

## Links
- Spec: spec/notifications/hu-013-send-admin-notifications/spec.md
- Plan: spec/notifications/hu-013-send-admin-notifications/plan.md
- Tasks: spec/notifications/hu-013-send-admin-notifications/tasks.md

## Acceptance criteria

- Admin can send notifications using the enabled MVP segments/modes.
- Delivery targets are resolved from `users/{userId}/devices/{deviceId}`.
- `users.lastDeviceId` points to the latest active device of each member.

## Scope
### In Scope
- Implement story HU-013 within MVP scope.
- Satisfy linked RFs: RF-NOTI-04, RF-NOTI-05.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:notifications
- platform:cross
- priority:P2
