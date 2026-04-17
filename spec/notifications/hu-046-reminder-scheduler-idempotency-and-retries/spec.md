# HU-046 - Reminder scheduler idempotency and retries

## Metadata
- issue_id: #107
- priority: P1
- platform: both
- status: ready

## Context and problem

Reminder delivery requires stable orchestration. Without idempotency, retries, and traceability, users may miss reminders or receive duplicates.

## User story

As a member with commitments I want reminder jobs to run reliably and only once per slot so I can trust pending-order notifications.

## Scope

### In Scope
- Implement scheduler-driven reminder orchestration in Functions.
- Guarantee idempotent send behavior by reminder slot/week/user.
- Add retry policy for transient errors with bounded attempts.
- Add execution traces for operational diagnostics.

### Out of Scope
- Redesign of reminder content/copy.
- Full campaign-management features.

## Linked functional requirements

- RF-NOTI-02, RF-NOTI-03

## Acceptance criteria

- Reminder jobs execute at configured weekly slots in Europe/Madrid timezone.
- A user receives at most one reminder per slot for the same target week.
- Transient failures trigger bounded retries and are observable in logs/metrics.
- Operators can inspect run-level outcomes (processed, sent, skipped, failed).

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on HU-006 reminder functional behavior.

## Risks

- Risk: duplicate notifications from concurrent executions.
  - Mitigation: enforce idempotency keys and transactional writes.
- Risk: silent failures in push provider paths.
  - Mitigation: structured error logging and retry telemetry.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Implementation aligned with linked RFs.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [ ] Technical/functional documentation updated.
- [ ] Issue and PR linked.
