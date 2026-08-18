# HU-022 - Critical-data freshness before order

## Metadata
- issue_id: #22
- priority: P1
- platform: both
- status: in_progress

## Context and problem

Ordering must not proceed with stale critical data (users/products/config/timestamps).

## User story

As a member I want `My order` enabled only when critical data is fresh so ordering stays reliable.

## Scope

### In Scope
- Freshness gate before entering `My order`.
- Timeout and bounded automatic recovery for blocked/stuck sync.

### Out of Scope
- Full offline-first redesign.

## Linked functional requirements

- RF-APP-02, RF-APP-04

## Acceptance criteria

- `My order` remains disabled while critical sync/freshness checks are pending.
- A server query that succeeds with no matching current-week data is a valid empty result, not a
  freshness failure.
- Initial Home data failures wait 10 seconds and retry once before publishing the generic load-failure feedback.
- If the freshness check times out or becomes unavailable, `My order` can start a new gated attempt but
  navigation stays blocked until that exact attempt reaches `Ready`; the app also retries automatically
  after 10, 20, and 30 seconds without requiring an app restart.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-collections-fields-v1.md.

## Risks

- Risk: over-blocking when stale markers are wrong.
  - Mitigation: bounded automatic retries and robust timestamp validation without adding an inline Home error message.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Tests executed.
- [x] Documentation updated.
- [x] Issue and PR linked.
