# [HU-049] Minimum operational observability for critical jobs

## Summary

As an operator I want minimum observability for critical jobs so failures are detected early and triaged quickly.

## Links
- Spec: spec/notifications/hu-049-minimum-operational-observability-for-critical-jobs/spec.md
- Plan: spec/notifications/hu-049-minimum-operational-observability-for-critical-jobs/plan.md
- Tasks: spec/notifications/hu-049-minimum-operational-observability-for-critical-jobs/tasks.md

## Acceptance criteria

- Critical jobs emit structured logs and basic counters (`processed`, `sent`, `failed`, `duration`).
- Alerts trigger for repeated failures and missing scheduled executions.
- Push failure reasons are classified and queryable.
- Runbook exists and is linked from the story docs.

## Scope
### In Scope
- Implement story HU-049 within MVP scope.
- Satisfy linked RFs: RF-NOTI-03, RF-APP-04.

### Out of Scope
- Full SRE platform migration.
- Advanced long-term analytics dashboards.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:notifications
- platform:backend
- priority:P2

## Dependencies
- #10 (HU-006)
- #107 (HU-046)
