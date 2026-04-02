# HU-041 - Segmented shifts board and cells

## Metadata
- issue_id: #65
- priority: P2
- platform: both
- status: implemented

## Context and problem

HU-015 closes the functional read path for shifts, but the board still uses a generic MVP layout. Members need a clearer board tailored to the two operational realities of Reguerta: weekly delivery shifts and monthly market shifts.

## User story

As a member I want the shifts board to be split into delivery and market tabs with purpose-built cells so that I can scan my planning quickly.

## Scope

### In Scope
- Add segmented navigation between delivery and market shifts.
- Design delivery cells with week number and week date range on the left, and responsible/helper names on the right.
- Design market cells with month and market Saturday on the left, and the assigned names on the right.
- Keep the board scrollable and aligned with the role-aware home shell patterns already implemented.

### Out of Scope
- Creating or confirming shift swap requests.
- Google Sheets synchronization logic.
- Automatic planning/generation of shifts.

## Linked functional requirements

- RF-TURN-01, RF-TURN-02

## Acceptance criteria

- The shifts screen exposes two tabs: delivery and market.
- Delivery cells show week number and week date range on the left, plus responsible/helper names on the right.
- Market cells show month and market Saturday date on the left, plus the assigned names on the right.
- The board remains scrollable and readable on Android and iOS.

## Dependencies

- Depends on HU-015 for the base read-only shifts feed.
- Recommended after HU-020 so the board can be exercised with synchronized real data.

## Risks

- Main risk: overfitting the layout to placeholder data instead of real planning data.
  - Mitigation: validate the cell structure against real synchronized shifts before visual polish freeze.
- Secondary risk: parity drift between Android and iOS if each board evolves independently.
  - Mitigation: keep a single visual contract in spec before implementation.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
