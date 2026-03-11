# [HU-004] Edit confirmed order within deadline

## Summary

As a member I want to modify a confirmed order before the cutoff so that I can adjust my needs.

## Links
- Spec: spec/orders/hu-004-edit-confirmed-order-in-time/spec.md
- Plan: spec/orders/hu-004-edit-confirmed-order-in-time/plan.md
- Tasks: spec/orders/hu-004-edit-confirmed-order-in-time/tasks.md

## Acceptance criteria

- With open deadline, user can increase/decrease quantity, remove, and add lines.
- If edits break commitments, confirmation is blocked.

## Scope
### In Scope
- Implement story HU-004 within MVP scope.
- Satisfy linked RFs: RF-ORD-08.

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
- area:orders
- platform:cross
- priority:P1
