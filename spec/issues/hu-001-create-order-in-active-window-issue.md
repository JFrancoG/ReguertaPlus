# [HU-001] Create order in active window

## Summary

As a consumer member I want to create my order inside the weekly ordering window so that I receive my products at delivery.

## Links
- Spec: spec/orders/hu-001-create-order-in-active-window/spec.md
- Plan: spec/orders/hu-001-create-order-in-active-window/plan.md
- Tasks: spec/orders/hu-001-create-order-in-active-window/tasks.md

## Acceptance criteria

- During active window, products are shown grouped by producer.
- Common purchases and committed eco-basket producer are prioritized.
- Search and producer filter are available while keeping companyName visible.

## Scope
### In Scope
- Implement story HU-001 within MVP scope.
- Satisfy linked RFs: RF-ORD-03, RF-ORD-04, RF-ORD-05.

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
