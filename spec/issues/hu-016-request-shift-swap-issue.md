# [HU-016] Request shift swap

## Summary

As a member I want to request a shift swap when I cannot attend so that I can resolve it in-app.

## Links
- Spec: spec/shifts/hu-016-request-shift-swap/spec.md
- Plan: spec/shifts/hu-016-request-shift-swap/plan.md
- Tasks: spec/shifts/hu-016-request-shift-swap/tasks.md

## Acceptance criteria

- Request is broadcast to eligible future members for the same shift type.
- Candidate members can answer whether they can cover the requested shift.
- The requester can confirm one of the members who accepted.
- Final confirmation applies the change across both shifts.
- Applied change notifies all members.
- The request starts from the shifts board and opens a dedicated request screen.
- The request includes shift context and reason.

## Scope
### In Scope
- Implement story HU-016 within MVP scope.
- Satisfy linked RFs: RF-TURN-05, RF-TURN-06.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Implementation notes

- Entry point starts from the shifts board as an open request for the selected assigned shift.
- Requests are persisted in `shiftSwapRequests` with candidate future shifts and per-candidate responses, then mirrored in both apps with incoming/outgoing/history sections.
- Final confirmation applies the reassignment on both affected `shifts`, which keeps the Google Sheets sync path from HU-020 active.
- In-app notifications are sent on create, response, and apply; dedicated push automation for this flow can be iterated later if needed.

## Suggested labels
- type:feature
- area:shifts
- platform:cross
- priority:P1
