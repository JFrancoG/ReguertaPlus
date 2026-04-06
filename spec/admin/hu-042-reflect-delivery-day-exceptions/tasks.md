# Tasks - HU-042 (Reflect delivery day exceptions across app texts and Google Sheets)

## 1. Preparation
- [x] Review issue #68 and identify affected Android/iOS/backend surfaces.
- [x] Trace which UI texts still used raw `shift.date`.

## 2. Android implementation
- [x] Use effective delivery date in next shifts, board cards, swap labels, and calendar admin flow.
- [x] Keep swap-request eligibility aligned with the effective future date.

## 3. iOS implementation
- [x] Use effective delivery date in next shifts, board cards, swap labels, and calendar admin flow.
- [x] Keep swap-request eligibility aligned with the effective future date.

## 4. Backend / Google Sheets
- [x] Export delivery rows using effective exception dates.
- [x] Re-export sheets when `deliveryCalendar/{weekKey}` changes.
- [x] Keep incremental row updates aligned with effective week date matching.

## 5. Testing
- [x] Android validation executed.
- [x] iOS validation executed.
- [x] Functions validation executed.
- [ ] Manual acceptance validation in app + sheet.

## 6. Documentation
- [x] Add HU-042 spec and issue note.
- [x] Document scope and parity.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
