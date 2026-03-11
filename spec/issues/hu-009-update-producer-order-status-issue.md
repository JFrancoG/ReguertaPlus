# [HU-009] Update producer order status

## Summary

As a producer I want to update whole-order status so that members know preparation progress.

## Links
- Spec: spec/producers/hu-009-update-producer-order-status/spec.md
- Plan: spec/producers/hu-009-update-producer-order-status/plan.md
- Tasks: spec/producers/hu-009-update-producer-order-status/tasks.md

## Acceptance criteria

- Only allowed statuses are unread, read, prepared, and delivered at full-order level.
- Initial value for a new or untouched producer order is `unread` (no null state).

## Scope
### In Scope
- Implement story HU-009 within MVP scope.
- Satisfy linked RFs: RF-PROD-04.

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
- area:producers
- platform:cross
- priority:P2
