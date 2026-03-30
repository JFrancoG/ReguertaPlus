# HU-027 - Unauthorized authenticated user home gating

## Metadata
- issue_id: #54
- priority: P1
- platform: both
- status: in_progress

## Context and problem

An authenticated Firebase session is not enough to grant operational access in Reguerta. When the signed-in email does not map to an authorized active `users` record, the app must keep the member out of operational flows and explain the situation clearly from home.

## User story

As an authenticated but not yet authorized person I want clear restricted-access feedback in home so that I understand why I cannot use the app and what must happen next.

## Scope

### In Scope
- Explicit unauthorized-state UX in home for authenticated users missing an authorized `users` record.
- Restricted home behavior for operational entry points such as `My order` / `View my orders`.
- Safe account actions available from the restricted state, including sign out.
- Android/iOS parity for unauthorized-state messaging and interaction model.

### Out of Scope
- Session expiry handling already covered by HU-023.
- Admin CRUD for pre-authorizing members, already covered by HU-010.
- Broader home navigation redesigns unrelated to unauthorized access control.

## Linked functional requirements

- RF-ROL-06
- RF-ROL-07
- RF-ROL-08

## Acceptance criteria

- If a user authenticates successfully in Firebase but no active authorized `users` record exists for that email, home shows an explicit unauthorized state.
- Unauthorized state opens a dedicated informational dialog that explains the lack of authorization and offers a clear `Sign out` action without implying session expiry.
- In unauthorized state, operational modules remain disabled and do not allow navigation into protected flows.
- Unauthorized state offers a safe sign-out path without implying session expiry.
- If the same email becomes authorized later, the next session resolution removes the unauthorized gate and restores normal home access.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Depends on HU-010 member pre-authorization rules and HU-023 session refresh lifecycle.

## Risks

- Risk: confusing unauthorized access with expired session.
  - Mitigation: separate copy, state handling, and recovery actions for unauthorized vs expired.
- Risk: platform drift in disabled-home behavior.
  - Mitigation: define parity around card/dialog copy, disabled actions, and sign-out affordance.

## Definition of Done (DoD)

- [x] Story acceptance criteria implemented in code.
- [x] Android/iOS parity reviewed.
- [x] Agreed test coverage executed.
- [x] Documentation updated.
- [ ] Story acceptance criteria validated manually in develop.
