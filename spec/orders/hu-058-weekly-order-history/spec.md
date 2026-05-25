# HU-058 - Weekly order history

## Metadata
- issue_id: #151
- priority: P1
- platform: both
- status: implemented-local

## Context and problem

The side drawer already exposes `Todos mis pedidos` / `Ver mis pedidos`, but the route is still a placeholder. Members need a real weekly history where they can inspect past personal orders with the same grouped summary used in `Mi ultimo pedido`.

## User story

As a member I want to navigate my personal order history by week so that I can review previous order lines, producer subtotals, and total amounts.

## Scope

### In Scope
- Replace the `Todos mis pedidos` / `Ver mis pedidos` placeholder with a weekly personal order history.
- Select the previous ISO week by default in Europe/Madrid, regardless of the current weekday.
- Show the selected ISO week in the shell title as `Pedido dd MMM - dd MMM`.
- Show the week selector as `< aaaa Semana xx >`.
- Navigate by prominent previous/next buttons and a wheel picker; horizontal swipe is intentionally disabled until it can ship with a clear animation.
- Bound navigation by the member's first and last real order week, while showing empty states for missing intermediate weeks.
- Maintain Android/iOS feature parity.

### Out of Scope
- Producer received-order history.
- Cloud Functions changes.
- Full refactor of the current `Mi pedido` route.

## Linked functional requirements

- RF-ORD-01
- HU-005

## Acceptance criteria

- Opening the route selects the previous ISO week in Europe/Madrid.
- The shell title uses Monday-Sunday ISO ranges and the selector uses the ISO week year/number.
- Previous/next controls are disabled at the first/last available generated week.
- The picker lists every ISO week between the first and last real order week using `dd MMM - dd MMM · aaaa Sem xx`, with the year/week text visually smaller than the day/month range where the platform picker supports rich row typography.
- Weeks without an order show an empty state for that selected week.
- Existing `Mi pedido` previous-order behavior remains compatible.

## Dependencies

- Existing `orders` and `orderlines` Firestore documents with `userId`/`memberId` and `weekKey`.
- Existing order summary read model from HU-005.
- Home drawer route mapping from HU-040/HU-051.

## Risks

- Firestore indexes or rules may block the new week-key queries.
  - Mitigation: reuse current member-scoped order/orderline reads where possible and document any backend gap.
- Android/iOS behavior may drift.
  - Mitigation: mirrored week-range, picker, bounds, and empty-state tests.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] Agreed test coverage executed.
- [x] Android/iOS impact reviewed.
- [x] Documentation updated.
- [ ] PR linked.
