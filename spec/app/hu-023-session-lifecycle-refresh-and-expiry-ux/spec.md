# HU-023 - Session lifecycle refresh and expiry UX

## Metadata
- issue_id: #23
- priority: P1
- platform: both
- status: ready

## Context and problem

Session and token state must stay valid across startup/foreground transitions and provide clear recovery when expired.

## User story

As a member I want session refresh on lifecycle events and explicit expiry feedback so access is stable.

## Scope

### In Scope
- Session/token refresh on startup and foreground.
- Explicit expired-session message and safe recovery path.

### Out of Scope
- Identity provider changes.

## Linked functional requirements

- RF-APP-03

## Acceptance criteria

- Startup and foreground transitions trigger refresh logic.
- Expired session shows explicit UX and allows safe re-authentication.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Depends on Firebase Auth and lifecycle observers.

## Risks

- Risk: refresh loops or repeated expiry popups.
  - Mitigation: debounce and idempotent refresh strategy.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
