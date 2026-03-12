# Auth/Onboarding Copy Catalog EN-ES (v1)

Date: 2026-03-12

Purpose:

- Provide a single source of truth for auth/onboarding texts.
- Avoid hardcoded strings in Android/iOS UI.
- Define stable keys for HU-033 and HU-034.

## 1. Key Policy

- Key format: `domain.section.name`
- Domains used here: `common`, `welcome`, `login`, `register`, `recover`, `auth_error`, `auth_info`
- English is fallback.

## 2. Strings Table

| Key | EN | ES |
|---|---|---|
| `common.action.accept` | Accept | Aceptar |
| `common.action.cancel` | Cancel | Cancelar |
| `common.action.close` | Close | Cerrar |
| `common.action.continue` | Continue | Continuar |
| `common.input.email.label` | Email | Email |
| `common.input.password.label` | Password | Contrasena |
| `common.input.password_repeat.label` | Repeat password | Repite contrasena |
| `common.input.placeholder.write` | Tap to type | Pulsa para escribir |
| `welcome.title.prefix` | Welcome to | Bienvenido a |
| `welcome.title.brand` | La RegUerta | La RegUerta |
| `welcome.cta.enter` | Enter the app | Entrar a la app |
| `welcome.not_registered` | Not registered yet? | No estas registrado? |
| `welcome.link.register` | Sign up | Registrate |
| `login.title` | Enter your credentials | Introduce tus credenciales |
| `login.cta.submit` | Sign in | Iniciar sesion |
| `login.link.forgot_password` | Forgot your password? | Has olvidado tu contrasena? |
| `register.title` | Sign up | Registrate |
| `register.cta.submit` | Create account | Registrarse |
| `recover.title` | Enter your registered email | Introduce el email de registro |
| `recover.cta.submit` | Recover password | Recuperar contrasena |
| `recover.alert.title` | Recover password | Recuperar contrasena |
| `recover.alert.success` | Password reset email sent. Check your inbox. | Se ha enviado el correo de restablecimiento de contrasena. Revisa tu correo. |
| `recover.alert.error` | We could not send the reset email. Try again later. | No se pudo enviar el correo de restablecimiento. Intentalo de nuevo mas tarde. |
| `auth_error.email.invalid_format` | Enter a valid email format | Ingresa un formato de email valido |
| `auth_error.password.invalid_length` | Enter a valid password (6-16 characters) | Ingresa una contrasena valida (6-16 caracteres) |
| `auth_error.password.mismatch` | Passwords do not match | Las contrasenas no coinciden |
| `auth_error.login.invalid_credentials` | Invalid email or password | Email o contrasena incorrectos |
| `auth_error.login.user_not_found` | No account found for this email | No existe una cuenta para este email |
| `auth_error.register.email_already_in_use` | This email is already in use | Este email ya esta en uso |
| `auth_error.auth.too_many_requests` | Too many attempts. Try again later | Demasiados intentos. Prueba mas tarde |
| `auth_error.auth.network` | Network error. Check your connection | Error de red. Revisa tu conexion |
| `auth_error.auth.generic` | Something went wrong. Please try again | Ha ocurrido un error. Intentalo de nuevo |
| `auth_error.member.unauthorized` | Unauthorized user | Usuario no autorizado |
| `auth_info.member.restricted_mode` | Operational modules remain disabled until an admin authorizes this account | Los modulos operativos seguiran desactivados hasta que un admin autorice esta cuenta |

## 3. Firebase Error Mapping (suggested)

| Provider code | App key |
|---|---|
| `invalid-email` | `auth_error.email.invalid_format` |
| `wrong-password` | `auth_error.login.invalid_credentials` |
| `invalid-credential` | `auth_error.login.invalid_credentials` |
| `user-not-found` | `auth_error.login.user_not_found` |
| `email-already-in-use` | `auth_error.register.email_already_in_use` |
| `weak-password` | `auth_error.password.invalid_length` |
| `too-many-requests` | `auth_error.auth.too_many_requests` |
| `network-request-failed` | `auth_error.auth.network` |
| `*` (fallback) | `auth_error.auth.generic` |

## 4. Legacy Mapping Notes (RGString.swift)

Existing `RGString` values that map directly:

- `RGString.Common.errorEmail` -> `auth_error.email.invalid_format`
- `RGString.Common.errorPassword` -> `auth_error.password.invalid_length`
- `RGString.Common.errorRepeatPass` -> `auth_error.password.mismatch`
- `RGString.Login.credentials` -> `login.title`
- `RGString.Recover.contentDialogInfo` -> `recover.alert.success`
- `RGString.Recover.contentDialogError` -> `recover.alert.error`

Hardcoded texts detected in legacy views and now normalized here:

- `Has olvidado tu contrasena?` -> `login.link.forgot_password`
- `Aceptar` dialog button -> `common.action.accept`

## 5. Open Copy TODO

Pending final product wording (can be updated without key changes):

- Tone alternatives for generic error and network error.
- Any legal/privacy hints in register/recover flows.
- Optional explanatory subtitle on welcome/login.
