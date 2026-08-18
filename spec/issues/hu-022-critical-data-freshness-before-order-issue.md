# [HU-022] Critical-data freshness before order

## Summary

As a member I want `My order` enabled only when critical data is fresh so ordering stays reliable.

## Links
- Spec: spec/app/hu-022-critical-data-freshness-before-order/spec.md
- Plan: spec/app/hu-022-critical-data-freshness-before-order/plan.md
- Tasks: spec/app/hu-022-critical-data-freshness-before-order/tasks.md

## Acceptance criteria

- `My order` remains disabled while critical sync/freshness checks are pending.
- A successful server query with no matching current-week data is a valid empty result.
- Initial Home data failures wait 10 seconds and retry once before publishing generic load-failure feedback.
- When sync times out or becomes unavailable, navigation stays closed and retries automatically after
  10, 20, and 30 seconds; the Home action can also request a new fenced attempt.

## Scope
### In Scope
- Implement story HU-022 within MVP scope.
- Satisfy linked RFs: RF-APP-02, RF-APP-04.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [x] Android
- [x] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:app
- platform:cross
- priority:P1

## Dependencies
- #21 (HU-021)
- #5 (HU-001)
