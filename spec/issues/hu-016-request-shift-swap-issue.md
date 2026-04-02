# [HU-016] Request shift swap

## Summary

As a member I want to request a shift swap when I cannot attend so that I can resolve it in-app.

## Links
- Spec: spec/shifts/hu-016-request-shift-swap/spec.md
- Plan: spec/shifts/hu-016-request-shift-swap/plan.md
- Tasks: spec/shifts/hu-016-request-shift-swap/tasks.md

## Acceptance criteria

- Request stays pending for target member.
- Acceptance plus final confirmation applies the change.
- Applied change notifies all members.
- The request starts from the shifts board and opens a dedicated request screen.
- The request includes shift context, target member, and reason.

## Scope
### In Scope
- Implement story HU-016 within MVP scope.
- Satisfy linked RFs: RF-TURN-05, RF-TURN-06.

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
- area:shifts
- platform:cross
- priority:P1
