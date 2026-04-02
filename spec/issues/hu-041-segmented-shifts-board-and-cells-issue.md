# [HU-041] Segmented shifts board and cells

## Summary

As a member I want the shifts board to be split into delivery and market tabs with purpose-built cells so that I can scan my planning quickly.

## Links
- Spec: spec/shifts/hu-041-segmented-shifts-board-and-cells/spec.md
- Plan: spec/shifts/hu-041-segmented-shifts-board-and-cells/plan.md
- Tasks: spec/shifts/hu-041-segmented-shifts-board-and-cells/tasks.md

## Acceptance criteria

- The shifts screen exposes two tabs: delivery and market.
- Delivery cells show week number and week date range on the left, plus responsible/helper names on the right.
- Market cells show month and market Saturday date on the left, plus the assigned names on the right.
- The board remains scrollable and readable on Android and iOS.

## Scope
### In Scope
- Delivery/market segmented board UX.
- Domain-specific cells for each shift type.

### Out of Scope
- Swap-request workflow.
- Google Sheets synchronization logic.
- Shift planning generation.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:shifts
- platform:cross
- priority:P2
