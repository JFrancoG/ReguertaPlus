# [HU-058] Navegar historico semanal de mis pedidos

## Summary

Convert the side drawer route `Todos mis pedidos` / `Ver mis pedidos` into a weekly navigable personal order history.

## Links
- GitHub Issue: #151
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/151
- Spec: spec/orders/hu-058-weekly-order-history/spec.md
- Plan: spec/orders/hu-058-weekly-order-history/plan.md
- Tasks: spec/orders/hu-058-weekly-order-history/tasks.md

## Acceptance criteria

- Opening `Todos mis pedidos` selects the previous ISO week in Europe/Madrid regardless of the current weekday.
- Shell title shows `Pedido dd MMM - dd MMM` and the selector shows `< aaaa Semana xx >`.
- Arrows are bounded by first/last generated week; swipe navigation is intentionally disabled until it can ship with a clear animation.
- Picker wheel lists continuous ISO weeks between the first and last real order week as `dd MMM - dd MMM · aaaa Sem xx`.
- Missing intermediate weeks show an empty state.
- Android and iOS route away from the placeholder with equivalent behavior.

## Scope

### In Scope
- Personal member order history.
- Android and iOS parity.
- Repository/ViewModel/component split.

### Out of Scope
- Producer received-order history.
- New backend automation.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend/Firestore review
- [x] Testing
- [x] Documentation

## Implementation notes

- Android adds personal order-history domain models/repository, Firestore and in-memory implementations, `MyOrdersHistoryViewModel`, prominent weekly selector/picker UI, grouped summary cards, total bar, dynamic shell title, and `MY_ORDERS` route wiring.
- iOS extends `OrdersRepository`, adds ISO week helpers, Firestore/in-memory history reads, `MyOrdersHistoryRouteViewModel`, Liquid Glass weekly controls, picker row typography, reusable SwiftUI summary components, dynamic shell title, and `.myOrders` route wiring.
- Firestore reads reuse `orders` and `orderlines` with `userId`/`memberId` and `weekKey`; no Functions changes were required.

## Validation evidence

- Android: `./gradlew app:testDebugUnitTest` passed.
- Android: `./gradlew app:lintDebug` passed.
- Android connected tests: attempted after starting `Small_Phone_API_35`, but Gradle reported `No connected devices`; `adb devices` remained empty.
- iOS: full `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test` was attempted, but the local simulator hung while launching `ReguertaUITests.xctrunner`; `xcodebuild ... -only-testing:ReguertaTests test` passed on `iPhone 17`.

## Suggested labels
- type:feature
- area:orders
- platform:cross
- priority:P1
