# [HU-055] Home weekly summary market context

## Summary

After a delivery day passes, Home should immediately show the next delivery cycle and the next/current market context. For example, on Thursday May 14, 2026, after the Wednesday May 13 delivery, Home should show May 18-24 / Week 21 / the Wednesday May 20 delivery, the Saturday May 16 market, the correct producer, delivery responsibles, market responsibles, week labels, and order state. Market data should stay visible on the market day and move to the next scheduled market from the following day.

## Links
- GitHub Issue: #139
- Spec: spec/app/hu-055-home-weekly-summary-market-context/spec.md
- Plan: spec/app/hu-055-home-weekly-summary-market-context/plan.md
- Tasks: spec/app/hu-055-home-weekly-summary-market-context/tasks.md
- Related: spec/app/hu-051-home-dashboard-and-drawer-redesign/spec.md

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

## Scope
### In Scope
- Android and iOS Home summary model updates.
- Android and iOS Home weekly-summary UI updates.
- Android and iOS localization updates.
- Boundary tests for the Thursday-after-Wednesday-delivery case and the day-after-market case.

### Out of Scope
- Backend schema changes.
- Shift planning generation changes.
- New order workflows.

## Implementation checklist
- [x] Android
- [x] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P2
