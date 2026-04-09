# HU-043 - Seasonal commitments and weekly parity producer filter

## Metadata
- issue_id: #90
- priority: P1
- platform: both
- status: ready

## Context and problem

The current My Order flow can show eco-basket products from both parity producers in the same week and commitment validation only checks eco-basket products. This causes false warnings and misses seasonal commitments (for example avocado commitments).

## User story

As a member with eco and seasonal commitments I want My Order to show only the producer that applies this week and enforce all active commitments on confirmation so that checkout feedback is correct.

## Scope

### In Scope
- Filter My Order visible products by weekly producer parity when producer has parity configured.
- Extend checkout validation with active seasonal commitments (`seasonalCommitments`) for the current member.
- Keep eco-basket commitment validation aligned with weekly parity visibility.
- Preserve Android/iOS behavior parity.

### Out of Scope
- Full order submission flow persistence.
- Commitment management CRUD for admins.
- Post-MVP commitment automation changes.

## Linked functional requirements

- RF-ORD-04
- RF-ORD-06
- RF-COM-01
- RF-COM-02
- RF-COM-03
- RF-COM-06
- RF-COM-08

## Acceptance criteria

- In My Order, only the producer parity applicable to the current ISO week is shown for parity-scoped producers.
- Products from non-applicable parity producers are excluded from the listing and from commitment checks in that week.
- If active seasonal commitments are not met, confirmation is blocked with a warning listing missing commitment products.
- If eco and seasonal commitments are met, confirmation is allowed.
- Android and iOS apply equivalent filtering and validation rules.

## Dependencies

- Firestore collection `seasonalCommitments`.
- Existing products/member parity metadata.
- Existing HU-002 checkout validation path.

## Risks

- Main risk: parity calculation mismatch between platforms.
  - Mitigation: shared ISO-week parity rule and test coverage on both clients.
- Secondary risk: seasonal commitments referencing products not offered this week.
  - Mitigation: enforce seasonal commitments only for products currently offered/visible.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
