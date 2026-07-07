# [HU-061] Confirmar cierre de sesión desde el menú lateral

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/159

## Summary

Al pulsar `Cerrar sesión` desde el menú lateral en iOS y Android, la app cierra sesión inmediatamente. La salida debe pasar por un `ReguertaDialog` de confirmación con el estilo visual existente de Reguerta para evitar cierres accidentales.

## Links

- Spec: `spec/app/hu-061-logout-confirmation-dialog/spec.md`
- Plan: `spec/app/hu-061-logout-confirmation-dialog/plan.md`
- Tasks: `spec/app/hu-061-logout-confirmation-dialog/tasks.md`

## User story

Como persona usuaria autenticada, quiero que la opción `Cerrar sesión` del menú lateral me pida confirmación antes de salir para no perder la sesión por un toque accidental.

## Acceptance criteria

- Al tocar `Cerrar sesión` en el menú lateral de Android, no se ejecuta el cierre inmediatamente.
- Al tocar `Cerrar sesión` en el menú lateral de iOS, no se ejecuta el cierre inmediatamente.
- Ambas plataformas muestran un `ReguertaDialog` de confirmación con:
  - icono informativo,
  - título `Cerrar sesión`,
  - mensaje `¿Estás seguro que quieres cerrar la sesión?`,
  - acción secundaria `Volver`,
  - acción primaria `Confirmar`.
- `Volver` cierra el diálogo y mantiene la sesión activa.
- `Confirmar` ejecuta el cierre de sesión existente una sola vez y navega al estado actual de usuario no autenticado.
- El diálogo respeta el estilo visual ya usado por `ReguertaDialog` en cada plataforma y no introduce un componente paralelo.
- La interacción es equivalente entre iOS y Android, incluyendo back/dismiss cuando aplique.

## Scope

### In Scope

- Reutilizar los componentes `ReguertaDialog` existentes en iOS y Android.
- Conectar la acción de drawer/footer `Cerrar sesión` a un estado de confirmación.
- Mantener el flujo de sign-out/auth actual detrás de la confirmación.
- Añadir o ajustar cobertura donde ya existan tests de drawer/session.
- Documentar validación y cualquier brecha temporal de paridad.

### Out of Scope

- Cambiar autenticación, Firebase Auth, token refresh o permisos.
- Rediseñar el menú lateral completo.
- Cambiar navegación de login/onboarding fuera del resultado actual de cerrar sesión.
- Crear un nuevo sistema de diálogos.

## Implementation checklist

- [x] Localizar el flujo actual de `Cerrar sesión` en Android.
- [x] Localizar el flujo actual de `Cerrar sesión` en iOS.
- [x] Android: mostrar `ReguertaDialog` antes de invocar el sign-out existente.
- [x] iOS: mostrar `ReguertaDialog` antes de invocar el sign-out existente.
- [x] Verificar que cancelar/dismiss mantiene sesión y drawer estable.
- [x] Verificar que confirmar cierra sesión una sola vez.
- [x] Ejecutar validación Android relevante.
- [x] Ejecutar validación iOS relevante.

## Validation evidence

- Android manual follow-up: iOS worked, but Android did not surface the dialog from the real drawer footer. Fixed by deferring the confirmation display after closing the drawer and adding a drawer-click instrumented test.
- Android visual follow-up: adjusted the shared `ReguertaDialog` treatment to keep the new proportions while using the active `MaterialTheme` colors, so light devices render the light Reguerta dialog and dark devices render the dark version.
- Android icon follow-up: aligned the icon with the current Android `ReguertaAlertDialog` pattern: translucent outer badge plus the Material `Info`/`Error` icon tinted with the accent, without an extra inner circle.
- Android lint follow-up: cleared the `ReguertaRootHomeRoute.kt` warnings by using the state-backed `Modifier.offset { ... }` overload and keeping the logout dialog helper private.
- Android: `./gradlew app:compileDebugKotlin app:lintDebug` passed, and the lint report no longer lists `ReguertaRootHomeRoute.kt`.
- Android: `./gradlew app:testDebugUnitTest app:lintDebug` passed.
- Android: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.reguerta.user.HomeDrawerContentTest` passed 4 focused tests on `Pixel_4_A12_API29`.
- Android: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed 7 tests on `Pixel_4_A12_API29`.
- iOS: full `xcodebuild ... test` for `iPhone 17` was attempted; the UI test runner failed to launch with `FBSOpenApplicationServiceErrorDomain Code=1` / `RequestDenied`.
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test -only-testing:ReguertaTests -quiet` passed.

## Labels

- `type:feature`
- `area:app`
- `platform:cross`
- `priority:P2`
