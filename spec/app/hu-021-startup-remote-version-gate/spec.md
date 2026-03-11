# HU-021 - Startup remote version gate

## Metadata
- issue_id: #21
- priority: P1
- platform: both
- status: ready

## Context and problem

Users can run obsolete app builds that should be blocked or warned based on remote policy.

## User story

As a member I want app version policy to be validated at startup so unsupported builds are blocked or warned.

## Scope

### In Scope
- Forced update startup gate.
- Optional update startup prompt.

### Out of Scope
- Store publishing/release pipeline management.

## Linked functional requirements

- RF-APP-01

## Acceptance criteria

- If remote policy is forced update and app version is below minimum, usage is blocked until update.
- If remote policy is optional update, user can continue after warning.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.

## Risks

- Risk: malformed remote version policy can block valid users.
  - Mitigation: safe defaults and robust parsing/validation.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
