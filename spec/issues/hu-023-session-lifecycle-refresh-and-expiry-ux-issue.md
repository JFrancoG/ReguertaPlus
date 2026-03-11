# [HU-023] Session lifecycle refresh and expiry UX

## Summary

As a member I want session refresh on lifecycle events and explicit expiry feedback so access is stable.

## Links
- Spec: spec/app/hu-023-session-lifecycle-refresh-and-expiry-ux/spec.md
- Plan: spec/app/hu-023-session-lifecycle-refresh-and-expiry-ux/plan.md
- Tasks: spec/app/hu-023-session-lifecycle-refresh-and-expiry-ux/tasks.md

## Acceptance criteria

- Startup and foreground transitions trigger refresh logic.
- Expired session shows explicit UX and allows safe re-authentication.

## Scope
### In Scope
- Implement story HU-023 within MVP scope.
- Satisfy linked RFs: RF-APP-03.

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
- #1 (HU-010)
