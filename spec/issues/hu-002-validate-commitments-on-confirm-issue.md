# [HU-002] Validate commitments on confirm

## Summary

As a member with commitments I want the system to validate my obligations before confirmation so that I avoid invalid orders.

## Links
- Spec: spec/orders/hu-002-validate-commitments-on-confirm/spec.md
- Plan: spec/orders/hu-002-validate-commitments-on-confirm/plan.md
- Tasks: spec/orders/hu-002-validate-commitments-on-confirm/tasks.md

## Acceptance criteria

- If required commitment items are missing, confirmation is blocked with a warning.
- If commitments are met, order confirmation is allowed.
- Eco-basket commitment accepts either `pickup` or `no_pickup` option, and both remain paid.
- Eco-basket price is identical across `pickup`/`no_pickup` and parity producers.

## Scope
### In Scope
- Implement story HU-002 within MVP scope.
- Satisfy linked RFs: RF-ORD-06, RF-COM-01, RF-COM-02, RF-COM-03, RF-COM-06, RF-COM-07, RF-COM-08.

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
