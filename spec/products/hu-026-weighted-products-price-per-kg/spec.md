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
- Product fields for `price`, `weightStep`, and required min/max weight limits in weighted mode.
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

## Confirmed product-editor contract

- Selecting `A granel` sets `pricingMode = weight` and fixes the measure to kilograms.
- Bulk products require `minWeight`, `maxWeight`, and `weightStep`; container quantity, measure quantity, and measure selector are hidden.
- The selectable sequence starts at `minWeight`, advances by `weightStep`, and never exceeds `maxWeight`.
- `maxWeight` must be reachable from `minWeight` using whole increments of `weightStep`.
- Approximate gram/kilogram measures are not part of the new mobile catalog.
- Selecting the `Ecocesta` container derives `isEcoBasket = true`; that container is only available to producers with an assigned even/odd `producerParity`.

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
