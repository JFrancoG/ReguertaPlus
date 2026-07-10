# Plan - HU-063 (Shifts helper and UI polish)

## Goal

Make delivery helper assignment trustworthy on iOS and align the shifts screen presentation across Android and iOS.

## Workstreams

1. Behavior discovery
- Trace Android delivery helper inference and calendar-exception handling.
- Trace iOS delivery helper inference and identify why the 8 July 2026 helper is missing.
- Confirm available test seams or fixtures for delivery weeks around 8 and 15 July 2026.

2. iOS behavior
- Pair the helper row in upcoming shifts with the delivery immediately before the member's next lead shift, even after that helper date has passed.
- Respect `plus-collection/deliveryCalendar` exceptions before falling back to Wednesday.
- Resolve board helper names only from the following delivery lead; the final delivery without a following lead remains pending.
- Add targeted unit coverage where the existing test structure supports it.

3. Cross-platform UI polish
- Move the main `Turnos` / `Shifts` title below the back arrow.
- Center and soften the upcoming-shifts block values.
- Center the shift-swap action and keep it visually button-like.
- Format market month labels as `MMM yyyy`.
- Center the date column vertically against the names and favor the name column on compact cards.

4. Validation
- Run touched-platform unit/lint/build checks from `AGENTS.md`.
- Manually inspect or screenshot the relevant shifts states when local tooling allows it.
- Record any temporary platform parity gap in the handoff.
