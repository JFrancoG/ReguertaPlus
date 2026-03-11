# [HU-022] Critical-data freshness before order

## Summary

As a member I want `My order` enabled only when critical data is fresh so ordering stays reliable.

## Links
- Spec: spec/app/hu-022-critical-data-freshness-before-order/spec.md
- Plan: spec/app/hu-022-critical-data-freshness-before-order/plan.md
- Tasks: spec/app/hu-022-critical-data-freshness-before-order/tasks.md

## Acceptance criteria

- `My order` remains disabled while critical sync/freshness checks are pending.
- Timeout/retry path is available when sync gets stuck.

## Scope
### In Scope
- Implement story HU-022 within MVP scope.
- Satisfy linked RFs: RF-APP-02, RF-APP-04.

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
- area:app
- platform:cross
- priority:P1

## Dependencies
- #21 (HU-021)
- #5 (HU-001)
