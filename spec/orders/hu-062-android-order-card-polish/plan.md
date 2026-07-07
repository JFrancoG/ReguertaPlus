# Plan - HU-062 (Android order card polish)

## Approach

Keep this as a focused Android UI polish pass. Reuse the existing order summary route and history route, sharing one corrected card/row treatment where the codebase already shares the component.

## Implementation steps

1. Locate the Android composables for `Mi último pedido`, `Todos mis pedidos`, and shared order summary cards.
2. Compare Android row/card structure against the iOS screenshots and source where useful.
3. Replace the gray/purple producer card surface with the green order-card surface used by the iOS reference.
4. Rework product rows into description, quantity, and price columns with subtle separators.
5. Suppress the duplicate shell title for `Mi último pedido` while keeping the route heading visible below the back arrow.
6. Run focused Android validation and update tasks with evidence.

## Validation

- Android: `./gradlew app:testDebugUnitTest`
- Android: `./gradlew app:lintDebug`
- Android: `./gradlew app:connectedDebugAndroidTest` only if an emulator/device is available, because this is UI-facing.

## Notes

- iOS is the visual reference for this pass.
- There is no expected iOS or backend code change.
