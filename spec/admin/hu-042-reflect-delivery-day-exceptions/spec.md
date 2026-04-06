# HU-042 - Reflect delivery day exceptions across app texts and Google Sheets

## Metadata
- issue_id: #68
- priority: P1
- platform: both
- status: implemented

## Context and problem

Weekly delivery exceptions already existed in `deliveryCalendar/{weekKey}`, but the effective date was not propagated consistently through app text surfaces and Google Sheets exports.

## User story

As an admin I want weekly delivery-day exceptions to be reflected everywhere so that members and operations see the same effective delivery date.

## Scope

### In Scope
- Reflect the effective delivery date in Android/iOS texts and cards that reference weekly delivery shifts.
- Reflect weekly exceptions in the corresponding Google Sheets rows for delivery shifts.
- Keep Android/iOS parity.

### Out of Scope
- Annual planning generation.
- General redesign/polish of the settings flow.

## Acceptance criteria

- A weekly exception saved from the app updates the effective delivery date shown in app UI for that week.
- The same exception is reflected in the Google Sheet for that week.
- Android and iOS behave the same.

## Dependencies

- `HU-011` delivery calendar management.
- `HU-020` Google Sheets sync for shifts.
- `HU-041` segmented shifts board.

## Risks

- Delivery exceptions may desync app text and sheet exports if one path still uses the original shift date.
- Incremental shift exports may miss exception changes if only `shifts` writes are observed.

## Definition of Done (DoD)

- [x] App text surfaces use the effective delivery date for exception weeks.
- [x] Google Sheets export updates after delivery-calendar changes.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
