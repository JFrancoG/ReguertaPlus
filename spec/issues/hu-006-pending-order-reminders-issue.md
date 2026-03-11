# [HU-006] Pending order reminders

## Summary

As a member with commitments I want reminders when I have not confirmed my order so that I avoid forgetting.

## Links
- Spec: spec/notifications/hu-006-pending-order-reminders/spec.md
- Plan: spec/notifications/hu-006-pending-order-reminders/plan.md
- Tasks: spec/notifications/hu-006-pending-order-reminders/tasks.md

## Acceptance criteria

- If order is not started or in cart, push reminders are sent on Sunday at 20:00, 22:00, and 23:00.
- If order is confirmed, no reminder is sent.

## Scope
### In Scope
- Implement story HU-006 within MVP scope.
- Satisfy linked RFs: RF-NOTI-02, RF-NOTI-03.

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
- priority:P1
