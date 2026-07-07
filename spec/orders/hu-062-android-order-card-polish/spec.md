# HU-062 - Android order card polish

## Metadata
- issue_id: 161
- priority: P2
- platform: android
- status: implemented-local

## Context and problem

Android already has functional personal order summary screens, but the current visual treatment diverges from the iOS reference captured during review.

The producer cards in `Mi último pedido` and `Todos mis pedidos` use a gray/purple surface that reads as accidental inside the dark green app shell. `Mi último pedido` also shows an extra shell title above the real screen title. Product rows are readable, but they do not follow the iOS structure where description, quantity, and price sit in clear columns with subtle separators.

## User story

As a member I want my Android order summaries to match the iOS visual structure so that recent and historical orders feel coherent across platforms.

## Scope

### In Scope
- Update Android producer summary cards for `Mi último pedido`.
- Update Android producer summary cards for `Todos mis pedidos`.
- Remove or suppress the duplicate shell title on `Mi último pedido` while keeping the real screen title under the back arrow.
- Format product rows with left description, centered quantity, right price, and subtle dividers aligned with iOS.
- Keep all order totals, week selection, and data reads unchanged.

### Out of Scope
- iOS UI changes.
- Backend, Firestore, or Cloud Functions changes.
- Navigation model changes outside the affected title treatment.
- Broad design-system refactors.

## Acceptance criteria

- Android producer cards use a green order-card surface aligned with the iOS screenshots instead of the current gray/purple background.
- `Mi último pedido` does not show a duplicate `Order`/shell title above the main `Mi último pedido` heading.
- `Mi último pedido` does not show the raw week-key line (`Semana 2026-Wxx`) under the heading.
- `Todos mis pedidos` keeps the weekly range title and selector while reusing the corrected card and row treatment.
- `Todos mis pedidos` renders the order range below the back arrow inside the route content instead of centered in the shell top bar.
- Weekly previous/next buttons and picker use green theme surfaces instead of the purple `primaryContainer` fallback.
- Each product row visually separates description, quantity, and price into stable columns on phone widths.
- Product metadata under the name shows optional container quantity + container name followed by measure quantity + measure name.
- Producer subtotal remains visually distinct and right aligned.
- Existing empty/loading/error states continue to work.
- No order data, totals, Firestore queries, or history bounds change.

## Dependencies

- Existing HU-058 weekly order history.
- Existing HU-005 previous-order summary behavior.
- iOS screenshots and implementation as visual reference for row formatting.

## Risks

- Risk: tighter columns may truncate long product names on narrow screens.
  - Mitigation: keep the name column flexible, allow line wrapping, and use fixed-width trailing columns only where needed.
- Risk: title changes could affect other routes that rely on the same shell API.
  - Mitigation: scope the shell-title override to the previous-order route.
- Risk: shared order summary components may affect both current and history screens.
  - Mitigation: intentionally reuse the corrected card treatment and validate both routes.

## Definition of Done (DoD)

- [x] Acceptance criteria validated on Android.
- [x] Android unit tests run.
- [x] Android lint run or skipped with a documented reason.
- [x] Android connected tests run on an available emulator.
- [x] Documentation/tasks updated with validation evidence.
- [ ] PR linked.
