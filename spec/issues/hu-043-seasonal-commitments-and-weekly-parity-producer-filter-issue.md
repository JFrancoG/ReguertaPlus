# [HU-043] Seasonal commitments and weekly parity producer filter

## Summary

As a member with eco and seasonal commitments I want My Order to show only producers applicable to the current parity week and enforce all active commitments on confirmation so that checkout feedback is accurate.

## Links
- Spec: spec/orders/hu-043-seasonal-commitments-and-weekly-parity-producer-filter/spec.md
- Plan: spec/orders/hu-043-seasonal-commitments-and-weekly-parity-producer-filter/plan.md
- Tasks: spec/orders/hu-043-seasonal-commitments-and-weekly-parity-producer-filter/tasks.md

## Acceptance criteria

- In My Order, only producer parity applicable to the current ISO week is shown for parity-scoped producers.
- Products from non-applicable parity producers are excluded from listing and commitment checks in that week.
- If active seasonal commitments are not met, confirmation is blocked with a warning listing missing commitment products.
- If eco and seasonal commitments are met, confirmation is allowed.
- Android and iOS apply equivalent filtering and validation rules.

## Scope
### In Scope
- Add weekly parity producer filtering in My Order feed.
- Add seasonal commitments (`seasonalCommitments`) read path and checkout validation.
- Keep Android/iOS parity.

### Out of Scope
- Order submission persistence and backend automations.
- Admin commitment CRUD.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:orders
- platform:cross
- priority:P1
