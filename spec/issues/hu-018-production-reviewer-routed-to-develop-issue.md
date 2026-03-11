# [HU-018] Production reviewer routed to develop

## Summary

As a reviewer I want to run full test flows without impacting real production data.

## Links
- Spec: spec/reviewer/hu-018-production-reviewer-routed-to-develop/spec.md
- Plan: spec/reviewer/hu-018-production-reviewer-routed-to-develop/plan.md
- Tasks: spec/reviewer/hu-018-production-reviewer-routed-to-develop/tasks.md

## Acceptance criteria

- Allowlisted reviewer in production app is routed to develop backend.
- Reviewer writes never affect real production dataset.

## Scope
### In Scope
- Implement story HU-018 within MVP scope.
- Satisfy linked RFs: RF-REV-01, RF-REV-02, RF-REV-03.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:reviewer
- platform:cross
- priority:P1
