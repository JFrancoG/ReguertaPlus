# Inventario de Textos Auth/Onboarding (2026-03-12)

Fuentes revisadas:

- `/Users/jesusf/Documents/APPs/Reguerta/Strings.swift`
- `/Users/jesusf/Documents/APPs/Reguerta/Login.zip`

## 1. Claves centralizadas existentes (RGString)

Claves de auth/onboarding ya centralizadas en `RGString`:

- `Authentication`: bienvenida, nombre app, CTA principal, enlace de registro.
- `Login`: titulo, placeholders, CTA submit.
- `Register`: titulo, placeholders, CTA submit.
- `Recover`: titulo, CTA submit, titulo/contenido de dialogo.
- `Common`: labels/placeholders compartidos y validaciones (`errorEmail`, `errorPassword`, `errorRepeatPass`, etc.).

## 2. Textos hardcoded detectados en login legacy

En `Login.zip` aun hay textos visibles hardcoded que deben migrar a claves:

- `"¿Has olvidado tu contraseña?"` en `Login/Login/LoginView.swift`
- `"Aceptar"` en `Authentication/AuthenticationView.swift` (boton primario de dialogo)

## 3. Gap detectado en gestion de errores

El view model legacy sigue exponiendo mensajes raw de Firebase/proveedor:

- `AuthenticationFBViewModel.msgError = error.localizedDescription`

Esto debe sustituirse por mapeo a claves/mensajes internos por caso (`invalid-email`, `wrong-password`, `email-already-in-use`, `too-many-requests`, etc.).

## 4. Dominios de texto previstos para el flujo nuevo

Para soportar HU-027..HU-034, anadir claves explicitas para:

- `splash.*`
- `welcome.*`
- `login.*`
- `register.*`
- `recover.*`
- `auth_errors.*` (por campo y global)
- `common_actions.*` (accept/cancel/close/continue)
- `alerts.*` (feedback success/info/error)

## 5. Reglas de localizacion

- Cero textos hardcoded visibles en vistas.
- Fallback obligatorio a ingles.
- Paridad completa en espanol para todo texto auth/onboarding enviado a produccion.
- Errores de proveedor siempre mapeados a claves internas antes de pintar UI.

## 6. Textos abiertos (pendientes de cierre de copy)

- Redaccion final para variantes de errores Firebase Auth.
- Redaccion final para alerts informativos/de exito.
- Ajustes de tono/estilo en copies de bienvenida y CTAs de auth.
