# HU-055 - Home weekly summary market context

## Metadata
- issue_id: 139
- priority: P2
- platform: both
- status: in-progress

## Context and problem

HU-051 introduced the compact Home weekly summary and the rule that, after a delivery day has passed, Home should stop showing the previous delivery and move to the next operational cycle.

The summary now also needs to expose the next/current market shift independently from the delivery week. For example, if delivery was Wednesday May 13, then on Thursday May 14 Home should show the next delivery on Wednesday May 20 and the market shift on Saturday May 16, with the correct producer, delivery responsibles, market responsibles, week labels, and order state. On the day after that market is held, the market row should move to the next scheduled market.

## User story

As a member I want Home to show the next delivery cycle and its market responsibilities immediately after the previous delivery day so that I can prepare the right order and shifts without reading stale operational data.

## Scope

### In Scope
- Resolve the displayed delivery cycle from the day after the effective delivery shift date onward, even if the default delivery weekday is stale.
- Keep the order state tied to the order/market week associated with the displayed delivery cycle.
- Add market date and market responsibles to the Home weekly summary display model.
- Resolve the market row from the next scheduled market date, keeping today's market visible during the market day and moving on from the following day.
- Render the weekly summary as a three-row asymmetric grid on Android and iOS:
  - left narrow column: order state, delivery date, market date,
  - right wide column: producer, delivery responsibles, market responsibles.
- Keep the drawer news destination labelled `News` / `Noticias` while the Home section title remains `Latest news` / `Últimas noticias`.
- Add a divider between the Home action buttons and the latest-news section.
- Add boundary tests for the Thursday-after-Wednesday-delivery case and the day-after-market case on Android and iOS.

### Out of Scope
- Backend schema changes.
- Changing shift planning generation rules.
- Changing order checkout storage semantics beyond choosing the correct Home display key.
- Pixel-perfect cross-platform matching.

## Linked functional requirements

- RF-TUR-01
- RF-PED-01
- RF-COM-01

## Acceptance criteria

- On Thursday May 14, 2026, after a Wednesday May 13 delivery, Home resolves the next delivery cycle and shows May 18-24 / Week 21 / Wednesday May 20 even if the default delivery weekday is still Friday.
- The same Home summary shows producer Tito Fernando, delivery responsibles Felix and Ana Belen, market date Saturday May 16, and market responsibles Valle, Angeles, and Sandra when those are the scheduled records.
- On the day after a market shift is held, the market row moves to the next scheduled market shift.
- Delivery responsibles show the primary responsible and helper in the delivery row.
- Market responsibles show up to three assigned names in the market row.
- The order state is resolved using the order/market week for the displayed delivery cycle.
- The grid uses narrow left cells and wider right cells, with centered labels and values.
- A divider appears between order action buttons and the latest-news section.
- The drawer item for the news destination reads `News` / `Noticias`; the dashboard heading still reads `Latest news` / `Últimas noticias`.
- Android and iOS expose equivalent information and cutoff behavior.

## Dependencies

- HU-051 Home dashboard and drawer redesign.
- Existing shift assignments for delivery and market.
- Existing member display names.
- Existing order state storage.

## Risks

- Risk: delivery week and order/market week are confused in Home state resolution.
  - Mitigation: expose both `weekKey` and `orderWeekKey` in the Home summary display model and cover the boundary with tests.
- Risk: market names overflow in the compact grid.
  - Mitigation: cap the Home summary at three visible market responsibles with single-line truncation.

## Definition of Done (DoD)

- [ ] Acceptance criteria validated on Android and iOS.
- [ ] Agreed test coverage executed.
- [ ] Android/iOS impact reviewed.
- [ ] Documentation updated.
