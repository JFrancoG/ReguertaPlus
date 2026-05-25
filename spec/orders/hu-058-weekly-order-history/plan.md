# Plan - HU-058 (Weekly order history)

## 1. Technical approach

Replace the `Todos mis pedidos` route placeholder with a shared order-summary experience driven by ViewModels. Keep the date math and repository reads out of UI views and reuse the existing previous-order summary snapshot shape for both platforms.

## 2. Layer impact
- Domain/Data: add member order-history week discovery and week summary reads.
- Presentation: add weekly selector state, prominent arrows, picker, loading/empty/error states, and summary rendering.
- Navigation: route `MY_ORDERS` / `.myOrders` to the new history screen.
- Docs: add HU-058 spec, tasks, and issue mirror.

## 3. Platform-specific changes

### Android
- Add `OrdersRepository` with Firestore/InMemory implementations for week keys, order summaries, status reads, received orders, and checkout compatibility where needed.
- Add `MyOrdersHistoryViewModel` using `StateFlow`.
- Add Compose components for weekly header, picker, summary list, producer cards, and total bar.
- Connect `HomeDestination.MY_ORDERS`.

### iOS
- Extend `OrdersRepository` with `orderHistoryWeekKeys(currentMember:)` and `orderSummarySnapshot(currentMember:weekKey:)`.
- Add `MyOrdersHistoryRouteViewModel` with `@Observable` state and actions.
- Extract reusable read-only order summary components from the existing previous-order UI where useful.
- Connect `.myOrders`.

### Backend
- No Cloud Functions change is expected.
- If Firestore requires a new index or rule change, document it as follow-up evidence.

## 4. Test strategy
- Unit tests for previous-week default, ISO range/title labels, continuous week generation, bounds, empty intermediate weeks, and retry.
- Existing order and received-order tests must continue to pass.
- Manual route check on both platforms when local runtime permits.

## 5. Rollout and functional validation
- Validate on local test data with at least two non-consecutive order weeks.
- Confirm route remains member-only history and does not alter producer received-order behavior.
- Record any temporary Android/iOS parity gap in closure notes.
