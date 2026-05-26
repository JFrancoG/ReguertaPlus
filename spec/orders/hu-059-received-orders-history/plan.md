# Plan - HU-059 (Received orders weekly history)

## 1. Technical approach

Add a separate read-only history route for producer received orders. Reuse the weekly navigation model from HU-058 and reuse the current received-orders rendering, but keep the current home preparation route operational and editable.

## 2. Layer impact
- Domain/Data: add producer received-order week discovery and read-only snapshot reads.
- Presentation: add received-orders history ViewModels, title override, weekly selector, picker, empty/loading/error states, and read-only summary rendering.
- Navigation: add side drawer destination while keeping home dashboard preparation navigation unchanged.
- Docs/Skills: add HU-059 artifacts and `reguerta-story-bootstrap`.

## 3. Platform-specific changes

### Android
- Extend orders repository support for producer received-order weeks and snapshots.
- Extract received-orders data loading from `ReguertaRootReceivedOrdersRoute` into reusable repository/ViewModel code.
- Add `ReceivedOrdersHistoryViewModel` using `StateFlow`.
- Add Compose history route with shared weekly controls and read-only received-order cards.
- Connect `RECEIVED_ORDERS_HISTORY` in the drawer; keep home dashboard using the existing `RECEIVED_ORDERS` preparation route.

### iOS
- Extend `OrdersRepository` with received-order history week keys and read-only snapshots.
- Add `ReceivedOrdersHistoryRouteViewModel` with `@Observable`.
- Reuse/extract received-orders SwiftUI components for read-only rendering.
- Connect `.receivedOrdersHistory` in the drawer; keep dashboard navigation to `.receivedOrders`.

### Skill
- Create `/Users/jesusf/.codex/skills/reguerta-story-bootstrap`.
- Include branch, issue, spec/plan/tasks, issue mirror, labels, and validation guidance.
- Validate with `quick_validate.py`.

## 4. Test strategy
- Unit tests for previous-week default, ISO labels, continuous range, bounds, picker options, empty intermediate weeks, retry, and read-only status behavior.
- Regression tests that the home preparation route keeps the current target-week/window behavior and status update path.
- Standard Android and iOS validations from `AGENTS.md`.

## 5. Rollout and validation
- No Cloud Functions change expected.
- Document any Firestore index/rules blocker if discovered during validation.
