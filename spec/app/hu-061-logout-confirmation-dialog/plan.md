# Plan - HU-061 (Logout confirmation dialog)

## Approach

Keep the change in the drawer/session UI layer. The logout callback already knows how to sign out and transition to the unauthenticated state; this story only adds an explicit confirmation step before that callback is invoked.

## Implementation steps

1. Locate Android drawer/footer sign-out wiring and existing `ReguertaDialog` API.
2. Locate iOS drawer/footer sign-out wiring and existing `ReguertaDialog` API.
3. Add local confirmation state to Android drawer/home shell and show the dialog from `Cerrar sesión`.
4. Add local confirmation state to iOS drawer/home shell and show the dialog from `Cerrar sesión`.
5. Ensure cancel/back/dismiss clears confirmation state without invoking sign-out.
6. Ensure confirm clears or consumes the dialog state and invokes the existing sign-out once.
7. Update focused UI/session tests where the current expectation is immediate logout.
8. Run relevant Android and iOS validation.

## Layer impact

- UI: drawer footer action and `ReguertaDialog` presentation on Android/iOS.
- Domain: no expected changes.
- Data: no expected changes.
- Backend: no expected changes.
- Docs: HU-061 spec, plan, tasks, and issue mirror.

## Platform-specific changes

### Android

- Reuse the existing Compose `ReguertaDialog` component.
- Add `showLogoutConfirmation` state in the composable that owns drawer sign-out interaction.
- Replace immediate sign-out with opening the confirmation dialog.
- Invoke the existing logout callback only from `Confirmar`.

### iOS

- Reuse the existing SwiftUI `ReguertaDialog` component.
- Add a local state flag in the view/shell that owns drawer sign-out interaction.
- Replace immediate sign-out with opening the confirmation dialog.
- Invoke the existing logout action only from `Confirmar`.

### Functions/Backend

- No changes expected.

## Test strategy

- Unit: keep existing auth/session unit tests unchanged unless UI callback ownership requires a small focused test.
- UI/component: validate that tapping `Cerrar sesión` opens the dialog instead of calling sign-out.
- UI/component: validate that `Volver`/dismiss does not sign out.
- UI/component: validate that `Confirmar` calls sign-out once.
- Manual: inspect Android and iOS drawer flows if automated UI coverage is limited.

## Validation

- Android: `./gradlew app:testDebugUnitTest`
- Android: `./gradlew app:lintDebug`
- Android: `./gradlew app:connectedDebugAndroidTest` when an emulator/device is available because drawer behavior changed.
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
- If the named simulator is unavailable, use a valid local simulator and record it.

## Technical risks and mitigation

- Risk: the confirmation dialog competes with drawer close animation.
  - Mitigation: let existing drawer state remain unchanged unless current architecture already closes it on footer actions; the visible confirmation is the source of truth.
- Risk: platform dialog APIs expose different dismissal behavior.
  - Mitigation: map all non-confirm dismissals to cancel semantics.
