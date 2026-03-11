# HU-026 - Weighted products priced by weight unit

## Metadata
- issue_id: TBD
- priority: P3
- platform: both
- status: ready

## Context and problem

Producers currently duplicate the same product in multiple entries to represent different weights and prices. This adds maintenance overhead and makes ordering less clear.

## User story

As a producer I want to configure a product with `price` in `weight` mode and as a member I want to enter weight quantity directly so bulk buying is simple and avoids duplicated product entries.

## Scope

### In Scope
- Product-level pricing mode `weight` in addition to `fixed`.
- Product fields for `price`, `weightStep`, and optional min/max weight limits.
- Orderline snapshot fields for weighted mode (`pricingModeAtOrder`, `priceAtOrder`).
- Decimal weight input in consumer order flow.
- Real-time subtotal calculation for weighted lines.

### Out of Scope
- Advanced producer-side fulfillment workflow for variable delivered weight.
- Cross-product bundle discounts for weighted products.

## Linked functional requirements

- RF-CAT-09

## Acceptance criteria

- Producer can create/edit product with `pricingMode = weight` and single `price`.
- Member can input decimal weight quantity for weighted products.
- Subtotal is computed as `quantity * price` and shown in real time.
- Saved orderline keeps weighted snapshot fields (`pricingModeAtOrder`, `priceAtOrder`).
- Existing fixed-unit products keep working unchanged.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.
- Depends on existing product CRUD foundations from HU-007.

## Risks

- Risk: inconsistent decimal rounding between platforms.
  - Mitigation: shared rounding rule and cross-platform test cases.
- Risk: backward compatibility regressions in legacy product reads.
  - Mitigation: keep `fixed` as default and explicit mode-aware mapping.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
