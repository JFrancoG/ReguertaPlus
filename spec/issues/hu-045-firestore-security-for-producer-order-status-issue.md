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

## Dependencies
- #9 (HU-008)
- #15 (HU-009)
- #13 (HU-018)
