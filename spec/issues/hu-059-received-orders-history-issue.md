# [HU-059] Navegar histórico semanal de pedidos recibidos

## Summary

Convert the side drawer producer route into a read-only weekly history of received orders, while keeping the current home `Pedidos recibidos` preparation view unchanged.

## Links
- GitHub Issue: #153
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/153
- Spec: spec/orders/hu-059-received-orders-history/spec.md
- Plan: spec/orders/hu-059-received-orders-history/plan.md
- Tasks: spec/orders/hu-059-received-orders-history/tasks.md

## Acceptance criteria

- Side drawer shows `Histórico de pedidos`.
- Opening the history selects the previous ISO week in Europe/Madrid.
- Shell title shows `Pedidos recibidos dd MMM - dd MMM`.
- Week selector shows `< aaaa Semana xx >`.
- Picker lists continuous ISO weeks as `dd MMM - dd MMM · aaaa Sem xx`.
- Bounds are calculated from first/last real received-order week for the producer.
- Missing intermediate weeks show an empty state.
- History is read-only: opening it does not mark orders read and status controls are not editable.
- The home preparation view keeps its current behavior and status actions.

## Scope

### In Scope
- Producer received-order weekly history.
- Android/iOS parity.
- Repository/ViewModel/component split.
- Story bootstrap skill.

### Out of Scope
- Personal order history.
- Cloud Functions changes.
- Firestore rules/index changes unless current queries are blocked.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend/Firestore review
- [x] Testing
- [x] Documentation
- [x] Story bootstrap skill

## Implementation notes

- Android now has a repository/ViewModel-backed received-orders preparation route and a separate read-only weekly history route.
- iOS now has a `ReceivedOrdersHistoryRouteViewModel`, repository reads for producer history, and a read-only history view using shared summary components.
- The side drawer label is `Histórico de pedidos`; the home dashboard route remains operational.
- No Functions changes were needed. Firestore may still require a production index for the `orderlines.vendorId` history query depending on deployed indexes/rules.

## Validation

- Passed: `./gradlew app:testDebugUnitTest --no-daemon`.
- Passed: `./gradlew app:lintDebug --no-daemon`.
- Passed: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ReguertaTests test`.
- Not run: `connectedDebugAndroidTest`; `adb devices` showed no connected device or emulator.

## Suggested labels
- type:feature
- area:orders
- area:producers
- platform:cross
- priority:P1
