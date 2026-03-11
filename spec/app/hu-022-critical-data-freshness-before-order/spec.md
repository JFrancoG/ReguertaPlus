# HU-022 - Critical-data freshness before order

## Metadata
- issue_id: #22
- priority: P1
- platform: both
- status: ready

## Context and problem

Ordering must not proceed with stale critical data (users/products/config/timestamps).

## User story

As a member I want `My order` enabled only when critical data is fresh so ordering stays reliable.

## Scope

### In Scope
- Freshness gate before entering `My order`.
- Timeout and retry path for blocked/stuck sync.

### Out of Scope
- Full offline-first redesign.

## Linked functional requirements

- RF-APP-02, RF-APP-04

## Acceptance criteria

- `My order` remains disabled while critical sync/freshness checks are pending.
- If freshness check times out, user can retry and recover without app restart.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.

## Risks

- Risk: over-blocking when stale markers are wrong.
  - Mitigation: timeout/retry UX and robust timestamp validation.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Tests executed.
- [ ] Documentation updated.
- [ ] Issue and PR linked.
