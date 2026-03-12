# Auth/Onboarding Text Inventory (2026-03-12)

Source inputs reviewed:

- `/Users/jesusf/Documents/APPs/Reguerta/Strings.swift`
- `/Users/jesusf/Documents/APPs/Reguerta/Login.zip`

## 1. Existing Centralized Keys (RGString)

Relevant auth/onboarding keys already centralized in `RGString`:

- `Authentication`: welcome, app name, main CTA, sign-up hint.
- `Login`: title, placeholders, submit CTA.
- `Register`: title, placeholders, submit CTA.
- `Recover`: title, submit CTA, dialog title/content.
- `Common`: shared labels/placeholders and validation texts (`errorEmail`, `errorPassword`, `errorRepeatPass`, etc.).

## 2. Hardcoded Texts Found In Legacy Login Code

`Login.zip` still contains user-facing hardcoded strings that should move to localization keys:

- `"¿Has olvidado tu contraseña?"` in `Login/Login/LoginView.swift`
- `"Aceptar"` in `Authentication/AuthenticationView.swift` dialog primary button

## 3. Error-Handling Gap Found

Legacy auth view model still forwards raw Firebase/provider messages:

- `AuthenticationFBViewModel.msgError = error.localizedDescription`

This should be replaced by mapped error keys/messages by case (`invalid-email`, `wrong-password`, `email-already-in-use`, `too-many-requests`, etc.).

## 4. Planned Text Domains For New Flow

To support HU-027..HU-034, add explicit keys for:

- `splash.*`
- `welcome.*`
- `login.*`
- `register.*`
- `recover.*`
- `auth_errors.*` (field-level and global)
- `common_actions.*` (accept/cancel/close/continue)
- `alerts.*` (success/info/error feedback)

## 5. Localization Rules

- No hardcoded user-facing strings in views.
- English fallback required.
- Spanish parity required for all shipped auth/onboarding text.
- Provider errors must be mapped to internal user-safe keys before rendering.

## 6. Open Copy Items (Pending Product Text Lock)

- Final wording for Firebase auth error variants.
- Final wording for info/success alerts.
- Any tone/style adjustments on welcome and auth CTA copy.
