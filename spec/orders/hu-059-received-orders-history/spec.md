# HU-059 - Received orders weekly history

## Metadata
- issue_id: #153
- priority: P1
- platform: both
- status: implemented

## Context and problem

The home producer route `Pedidos recibidos` is an operational preparation screen tied to the current preparation window. Producers also need a side drawer route where they can review received orders from previous weeks without changing order status.

## User story

As a producer I want to navigate received orders by week so that I can review historical order lines by product or member without modifying old order status.

## Scope

### In Scope
- Add a separate read-only received-orders history route.
- Rename the side drawer entry to `Histórico de pedidos`.
- Select the previous ISO week by default in Europe/Madrid.
- Show `Pedidos recibidos dd MMM - dd MMM` in the shell title and `< aaaa Semana xx >` in the selector.
- Navigate by previous/next buttons and a wheel picker; no swipe.
- Bound navigation by first/last real received-order week for the producer.
- Reuse the existing received-orders visual presentation.
- Maintain Android/iOS parity.

### Out of Scope
- Changing home dashboard preparation behavior.
- Personal order history changes.
- Backend automation.

## Acceptance criteria

- Opening the history selects the previous ISO week in Europe/Madrid.
- The picker lists every ISO week between the first and last real received-order week using `dd MMM - dd MMM · aaaa Sem xx`.
- Previous/next controls are disabled at bounds.
- Missing intermediate weeks show an empty state.
- The history does not call status update APIs and does not mark unread orders as read.
- The existing home `Pedidos recibidos` route still marks unread orders as read and allows status changes as before.

## Dependencies

- Existing `orderlines` documents with `vendorId` and `weekKey`.
- Existing `orders` producer status fields for read-only status display.
- HU-058 shared ISO week formatting and selector behavior.

## Risks

- Android received-orders logic currently lives in the Compose route; it must be extracted carefully without changing home behavior.
- Firestore may require an index for producer week discovery.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] Android/iOS parity reviewed.
- [x] Tests added for weekly navigation and read-only behavior.
- [x] Documentation updated.
- [ ] PR linked.

## Implementation notes

- Added separate Android/iOS navigation destinations for the side drawer history route.
- Preserved the existing home preparation route and status mutation behavior.
- The side drawer label is `Histórico de pedidos`.
- Added read-only producer received-order history loading by `vendorId` and `weekKey`.
- Reused the weekly selector format from personal order history without swipe navigation.
- No Cloud Functions changes were required.

## Validation evidence

- Android unit tests: `./gradlew app:testDebugUnitTest --no-daemon`.
- Android lint: `./gradlew app:lintDebug --no-daemon`.
- iOS unit tests: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ReguertaTests test`.
- Android connected tests: skipped because `adb devices` reported no connected device or emulator.
