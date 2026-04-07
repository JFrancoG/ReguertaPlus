# [HU-042] Reflect delivery day exceptions across app texts and Google Sheets

## Summary

When an admin changes the delivery day for a specific week from the app, that exception should propagate consistently to all derived texts in the apps and to the linked Google Sheet row/cell where that week is shown.

## Links
- Issue: #68
- Spec: spec/admin/hu-042-reflect-delivery-day-exceptions/spec.md
- Tasks: spec/admin/hu-042-reflect-delivery-day-exceptions/tasks.md

## Acceptance criteria

- A weekly exception saved from the app updates the effective delivery date shown in app UI for that week.
- The same exception is reflected in the Google Sheet for that week.
- Android and iOS behave the same.

## Implementation notes

- Android and iOS resolve an effective delivery date by combining `shift.date` with any `deliveryCalendar/{weekKey}` override.
- Google Sheets export now uses the effective date for delivery rows and re-exports when a delivery-calendar override changes.
- Incremental delivery row updates match rows by ISO week key so an override can move the displayed day without losing the row mapping.
