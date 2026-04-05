# HU-016 - Request shift swap

## Metadata
- issue_id: #12
- priority: P1
- platform: both
- status: in_progress

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want to request a shift swap when I cannot attend so that I can resolve it in-app.

## Scope

### In Scope
- Start a swap request from the shifts board as an open request, not against a single predefined member.
- Capture shift context and reason in a dedicated request screen.
- Resolve future candidate members automatically:
  - delivery: all future delivery leads from week + 2 onward, excluding the requester
  - market: all members assigned to future market shifts, excluding the requester
- Persist the request lifecycle in `shiftSwapRequests` with open, cancelled, and applied states, plus per-candidate responses.
- Allow candidate members to answer `available` / `unavailable` from the same shifts screen.
- Allow the requester to review available responders and confirm one concrete swap so the reassignment is applied.
- Send in-app notifications when the request is created, when a member responds, and when the final swap is applied.
- Keep Android/iOS parity for board entry points, request form, request inbox, and final confirmation flow.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-TURN-05, RF-TURN-06

## Acceptance criteria

- Request is broadcast to the eligible future members for the same shift type.
- Candidate members can answer whether they can cover the requested shift.
- The requester sees the members who accepted and can confirm one concrete exchange.
- Final confirmation applies the change across both shifts.
- Applied change notifies all members.
- The request can be started from the shifts board for a shift already assigned to the current member.
- A dedicated request screen captures reason and shift context before submission.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on shifts, swap requests, and change notifications.
- Recommended after HU-020 and HU-041 so the workflow runs on synchronized data and the board already exposes the entry point.

## Risks

- Main risk: misalignment between business rules and data rules.
  - Mitigation: validate against linked RFs and acceptance tests.
- Secondary risk: regression in existing weekly workflows.
  - Mitigation: weekly-window regression tests by role.

## Implementation notes

- Source of truth lives in `plus-collections/shiftSwapRequests`.
- Each request stores candidate future shifts and per-candidate responses, so the requester can choose the final exchange partner after collecting replies.
- Final reassignment updates both affected documents in `plus-collections/shifts`, which keeps the Google Sheets outbound sync from HU-020 in play.
- Dedicated push/backend orchestration for swap events is still deferred; this HU uses the existing in-app notification flow.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated in code.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
