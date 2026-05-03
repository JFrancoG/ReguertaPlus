# Tasks - HU-051 (Home dashboard and drawer redesign)

GitHub tracking:

- #125 - umbrella issue.
- #126 - shared behavior and presentation helpers.
- #127 - dashboard UI.
- #128 - drawer UI.

## 1. Preparation
- [ ] Confirm final dashboard copy and Spanish string keys.
- [ ] Confirm order-state source for `Sin hacer`, `Sin confirmar`, and `Completado`.
- [ ] Confirm profile/family image source and logo fallback asset on Android/iOS.
- [ ] Confirm develop-build marker source for Android and iOS.

## 2. Shared behavior / presentation helpers
- [ ] Android: add weekly summary display model/helper.
- [ ] Android: add order-state display mapping.
- [ ] Android: add unit tests for week boundary and order-state mapping.
- [ ] iOS: add weekly summary display model/helper.
- [ ] iOS: add order-state display mapping.
- [ ] iOS: add unit tests for week boundary and order-state mapping.

## 3. Android dashboard implementation
- [ ] Update Home top bar center content to full current date.
- [ ] Implement compact weekly summary card.
- [ ] Apply asymmetric field widths for producer/responsible vs delivery/state.
- [ ] Add helper line below responsible member.
- [ ] Apply order-state border/text colors.
- [ ] Keep `Mi pedido` and producer-gated `Pedidos recibidos` action row.
- [ ] Keep latest news below actions as the only overflow/scroll area.
- [ ] Add/update Android strings and accessibility labels.

## 4. iOS dashboard implementation
- [ ] Update Home top bar center content to full current date.
- [ ] Implement compact weekly summary card.
- [ ] Apply asymmetric field widths for producer/responsible vs delivery/state.
- [ ] Add helper line below responsible member.
- [ ] Apply order-state border/text colors.
- [ ] Keep `Mi pedido` and producer-gated `Pedidos recibidos` action row.
- [ ] Keep latest news below actions as the only overflow/scroll area.
- [ ] Add/update iOS string catalog entries and accessibility labels.

## 5. Android drawer implementation
- [ ] Preserve underlay behavior where Home moves to reveal drawer beneath.
- [ ] Reduce close button size and align it left.
- [ ] Replace visible role section titles with dividers.
- [ ] Add profile/family image support with logo fallback.
- [ ] Keep role-gated common/producer/admin grouping.
- [ ] Show version footer and `DEV` marker for develop builds.
- [ ] Validate sign-out remains visually separate from navigation.

## 6. iOS drawer implementation
- [ ] Preserve underlay behavior where Home moves to reveal drawer beneath.
- [ ] Reduce close button size and align it left.
- [ ] Replace visible role section titles with dividers.
- [ ] Add profile/family image support with logo fallback.
- [ ] Keep role-gated common/producer/admin grouping.
- [ ] Show version footer and `DEV` marker for develop builds.
- [ ] Validate sign-out remains visually separate from navigation.

## 7. Cross-platform parity review
- [ ] Compare Android/iOS dashboard information hierarchy.
- [ ] Compare Android/iOS drawer grouping and role visibility.
- [ ] Compare order-state labels and colors.
- [ ] Compare date formatting and week-selection behavior.
- [ ] Record any temporary parity gap if one platform is blocked.

## 8. Testing
- [ ] Android: run `./gradlew app:testDebugUnitTest`.
- [ ] Android: run `./gradlew app:lintDebug`.
- [ ] Android: run `./gradlew app:connectedDebugAndroidTest` if emulator/device is available or UI behavior changes require it.
- [ ] iOS: run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' test`.
- [ ] iOS: if iPhone 16 simulator is unavailable, use another valid simulator and document it.
- [ ] Manual: validate before/on delivery day and day-after-delivery dashboard states.
- [ ] Manual: validate drawer variants for common-only, producer, admin, and develop build.

## 9. Documentation and closure
- [ ] Update design docs if implementation intentionally diverges from proposal.
- [ ] Update issue checklist.
- [ ] Capture final screenshots/evidence.
- [ ] Complete DoD checklist in `spec.md`.
