# [HU-045] Firestore security for producer order status

## Summary

As an admin I want strict Firestore rules for producer status updates so only authorized actors can change status and data remains trustworthy.

## Links
- Spec: spec/orders/hu-045-firestore-security-for-producer-order-status/spec.md
- Plan: spec/orders/hu-045-firestore-security-for-producer-order-status/plan.md
- Tasks: spec/orders/hu-045-firestore-security-for-producer-order-status/tasks.md

## Acceptance criteria

- Consumers cannot write producer status fields.
- Producers can only update status for their own producer-scoped lines/orders.
- Admin role can apply status corrections under explicit rule constraints.
- Security tests cover allow/deny cases per role and environment and pass in CI.

## Scope
### In Scope
- Implement story HU-045 within MVP scope.
- Satisfy linked RFs: RF-PROD-04, RF-ROL-05.

### Out of Scope
- Replacing the current status model with a new domain model.
- Non-status order editing workflows.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Implementation notes (2026-04-17)
- Added `firestore.rules` with producer/admin producer-status mutation contract for both `develop` and `production` roots.
- Added emulator security tests: `functions/test/firestore/producer-order-status.rules.test.cjs`.
- Added explicit producer-status denied-write UX feedback in Android and iOS received-orders flows.
- Producer status updates now write `producerStatusUpdatedBy`.
- Consumer checkout payload no longer persists producer status fields directly.

## Suggested labels
- type:feature
- area:orders
- platform:cross
- priority:P1

## Dependencies
- #9 (HU-008)
- #15 (HU-009)
- #13 (HU-018)
