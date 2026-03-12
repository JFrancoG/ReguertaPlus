# Backlog Audit + Auth/Onboarding/i18n Plan (2026-03-12)

## 1. Audit Summary (HU-001..HU-025)

Review performed against GitHub issues and local spec artifacts.

Findings:

- `25/25` open HU issues currently reference `common/spec/...` paths in GitHub body text.
- Repository source of truth already uses `spec/...` paths.
- Local issue markdown templates under `spec/issues/*.md` are already aligned to `spec/...`.

Impact:

- High confusion risk during implementation and review.
- Broken traceability from issue -> spec/plan/tasks.

Recommendation:

- Keep existing HU issues and numbers.
- Bulk-update issue bodies from `spec/issues/*.md` (do not delete/recreate).

## 2. Why Keep Existing Issues (instead of recreating)

- Preserves links, comments, and historical context.
- Avoids renumbering dependency chains.
- Allows fast cleanup with low risk.

## 3. Proposed New Workstream (Auth + Onboarding + i18n)

Current HUs do not cover this as a dedicated, modernized flow.

Create a new grouped workstream (new HU IDs after confirming numbering policy), with this split:

1. Auth app-shell and navigation states.
2. Splash (cross-platform animation contract).
3. Welcome screen.
4. Login.
5. Registration.
6. Password reset.
7. Shared input component v2 + auth error mapping.
8. Localization foundation (EN/ES) + language selection behavior.

## 4. UI Baseline From Provided Captures

Screens reviewed:

- Splash
- Welcome
- Login (empty, valid, invalid)
- Registration (empty, valid, mismatch)
- Password reset (empty, valid, invalid)

Detected baseline:

- Soft green palette and high visual brand consistency.
- Form pattern with underlined input, inline error under each field, and a right-side action icon.
- Disabled primary button style clearly differentiated.
- Typography with decorative heading style and plain body/input text.

## 5. Cross-Platform UX Decisions (recommended)

Navigation parity:

- Use one simple stack flow on both platforms.
- Remove iOS-only sheet behavior for auth forms.
- Keep platform-native polish (SwiftUI feel vs Material feel), but preserve same flow and states.

Proposed route flow:

- `Splash -> Welcome -> Login`
- `Login -> Register`
- `Login -> Recover Password`
- On successful auth: `Home`

## 6. Splash Animation Contract (cross-platform and easy)

Replace current iOS-only animation with a common contract:

- Logo starts slightly small and transparent.
- Simultaneous scale up + slight rotation + fade out.
- Total duration around `1200-1800ms` plus navigation handoff.

This is easy to implement in:

- SwiftUI (`scaleEffect`, `rotationEffect`, `opacity`, timed transition)
- Compose (`animateFloatAsState`/`Animatable`, `graphicsLayer`) 

## 7. Input Component v2 Contract

Shared behavior:

- Label + input + trailing action icon.
- States: `default`, `focused`, `error`, `disabled`.
- Inline field error text.
- Optional clear icon.
- Optional password eye toggle.
- Validation timing: after interaction (`touched`) and on submit.

Auth usage:

- Login: email, password.
- Register: email, password, repeat password.
- Recover: email.

## 8. Firebase Auth Error Mapping (field/global)

Introduce deterministic mapping layer in both platforms:

Field-level examples:

- `invalid-email` -> email field error.
- `weak-password` -> password field error.
- password mismatch (client-side) -> repeat-password field error.

Global feedback examples:

- `invalid-credential`, `wrong-password`, `user-not-found` -> generic auth failure message.
- `email-already-in-use` -> account already exists.
- `too-many-requests` -> temporary lock warning.
- `network-request-failed` -> connectivity warning.

Do not show raw Firebase error text directly in UI.

## 9. Localization Plan (EN/ES)

Baseline rules:

- English as fallback default.
- Spanish fully supported.
- No hardcoded UI strings in views.

Platform implementation:

- Android: `values/strings.xml` + `values-es/strings.xml`.
- iOS: `Localizable.xcstrings` with `en` and `es`.

Product behavior:

- Default language = system language.
- Optional in-app override saved locally.
- Fallback chain: user override -> system -> English.

## 10. iPad/Tablet and Responsive Notes

- Keep current responsive strategy as migration bridge (`resize` logic and equivalents).
- Define breakpoints and max-width containers for forms.
- Avoid over-wide forms on large displays.

## 11. Immediate Next Steps

1. Bulk sync GitHub issue bodies (`#1..#25`) with `spec/issues/*.md`.
2. Publish new workstream issues for auth/onboarding/i18n using the split in section 3.
3. Convert provided captures into explicit acceptance criteria and text keys.
4. Start implementation from foundation order:
   i18n base -> auth shell/navigation -> input v2 -> splash/welcome -> auth screens.
