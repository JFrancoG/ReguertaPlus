# [HU-011] Manage delivery calendar

## Summary

As an admin I want to move upcoming delivery days so that operations adapt to holidays and weather alerts.

## Links
- Spec: spec/admin/hu-011-manage-delivery-calendar/spec.md
- Plan: spec/admin/hu-011-manage-delivery-calendar/plan.md
- Tasks: spec/admin/hu-011-manage-delivery-calendar/tasks.md

## Acceptance criteria

- Only admin can modify upcoming delivery calendar weeks.
- After a day change, blocking/opening windows are recalculated correctly.
- Overrides are stored as `deliveryCalendar/{weekKey}` where document ID equals `weekKey`.
- Weeks without a `deliveryCalendar/{weekKey}` document resolve using `config/global.deliveryDayOfWeek`.
- Removing a week override reverts that week to default schedule resolution.

## Scope
### In Scope
- Implement story HU-011 within MVP scope.
- Satisfy linked RFs: RF-CAL-01, RF-CAL-02, RF-CAL-03, RF-CAL-04, RF-CAL-05.

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
- area:admin
- platform:cross
- priority:P1
