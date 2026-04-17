# HU-045 - Firestore security for producer order status

## Metadata
- issue_id: #106
- priority: P1
- platform: both
- status: ready

## Context and problem

Producer order status updates are business-critical and currently risk inconsistent authorization if backend rules are not explicit per role and environment.

## User story

As an admin I want strict Firestore rules for producer status updates so only authorized actors can change status and data remains trustworthy.

## Scope

### In Scope
- Define and apply Firestore rules for `orders/orderLines/producerStatus` writes.
- Restrict writes by role and producer ownership.
- Validate allowed status transitions for producer status lifecycle.
- Add security-rule tests for develop and production environments.

### Out of Scope
- Replacing the current status model with a new domain model.
- Non-status order editing workflows.

## Linked functional requirements

- RF-PROD-04
- RF-ROL-05

## Acceptance criteria

- Consumers cannot write producer status fields.
- Producers can only update status for their own producer-scoped lines/orders.
- Admin role can apply status corrections under explicit rule constraints.
- Security tests cover allow/deny cases per role and environment and pass in CI.

## Implemented rule contract

- Rules file: `firestore.rules`.
- Protected paths:
  - `{env}/plus-collections/orders/{orderId}`
  - `{env}/collections/orders/{orderId}`
  - `env`: `develop` and `production`.
- Producer status mutation contract:
  - Producer writes must include `producerStatusUpdatedBy` and match the authenticated producer identity.
  - Producer can only mutate `producerStatusesByVendor.{selfMemberId}` plus legacy mirror `producerStatus`.
  - Producer mutation is only allowed when order contains `totalsByVendor.{selfMemberId}`.
- Admin correction contract:
  - Admin writes must include `producerStatusUpdatedBy` and match authenticated admin identity.
  - Admin can correct legacy top-level `producerStatus` without mutating `producerStatusesByVendor`.
- Transition policy for producer self-updates:
  - `unread -> read|prepared|delivered`
  - `read -> read|prepared|delivered`
  - `prepared -> read|prepared|delivered`
  - `delivered -> delivered`
- App write alignment:
  - Producer status writes now include `producerStatusUpdatedBy`.
  - Consumer checkout payloads no longer persist producer status fields directly.
  - Android/iOS show explicit feedback when write is denied by rules.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on HU-008/HU-009 producer order flows and HU-018 environment routing safeguards.

## Risks

- Risk: overly strict rules block legitimate producer updates.
  - Mitigation: codify rule tests with realistic producer/admin fixtures.
- Risk: environment path mismatch causes false negatives.
  - Mitigation: include explicit tests for develop and production path roots.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
