# HU-049 - Minimum operational observability for critical jobs

## Metadata
- issue_id: #110
- priority: P2
- platform: backend
- status: ready

## Context and problem

Critical backend jobs currently lack a minimal, standardized observability baseline. Without this, incidents on reminders/push/jobs can go unnoticed or be slow to diagnose.

## User story

As an operator I want minimum observability for critical jobs so failures are detected early and triaged quickly.

## Scope

### In Scope
- Define minimum metrics/logging contract for critical Functions jobs.
- Add alerting thresholds for job failures and abnormal inactivity.
- Track push delivery failure categories with actionable diagnostics.
- Document runbook steps for first-response triage.

### Out of Scope
- Full SRE platform migration.
- Advanced long-term analytics dashboards.

## Linked functional requirements

- RF-NOTI-03
- RF-APP-04

## Acceptance criteria

- Critical jobs emit structured logs and basic counters (`processed`, `sent`, `failed`, `duration`).
- Alerts trigger for repeated failures and missing scheduled executions.
- Push failure reasons are classified and queryable.
- Runbook exists and is linked from the story docs.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on HU-006 and HU-046 orchestration scope.

## Risks

- Risk: alert noise leads to ignored incidents.
  - Mitigation: tune thresholds with staged rollout.
- Risk: incomplete telemetry misses key failure modes.
  - Mitigation: define and enforce a minimum event taxonomy.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [ ] Implementation aligned with linked RFs.
- [ ] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [ ] Technical/functional documentation updated.
- [ ] Issue and PR linked.
