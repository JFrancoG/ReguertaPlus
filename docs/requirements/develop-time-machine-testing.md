# Develop Time Machine (Date Override)

## Purpose

In `develop`, many flows depend on weekday and week key (`My order`, delivery calendar, producer parity, commitments). This tool allows QA and product checks without changing backend data or device system time.

## Scope

- Platform parity: Android + iOS.
- Environment: intended for `develop` builds and testing workflows.
- Persistence: override is saved locally on device and survives app restarts.

## Where to use it

- Open `Settings`.
- In the develop tools area, use **Test clock** controls:
  - `-1 day`
  - `+1 day`
  - `Now`
  - `Reset`

## Behavior

1. When override is active, app uses the simulated timestamp as `now`.
2. All logic wired to `nowMillisProvider` follows simulated time.
3. `My order` consultation window and week calculation use the same simulated time.
4. `Reset` clears override and returns to real device time.

## Practical test flow for HU-005

1. Set simulated date to a Monday before delivery.
2. Open `My order`.
3. Expected: previous-week order view appears.
4. If there is no previous-week order document, expected state is empty message (not current-week order entry flow).
5. Move date forward (`+1 day`) to validate boundary behavior up to delivery day.

## Calendar resolution notes

Order consultation window resolves delivery date in this order:

1. `deliveryCalendar/{weekKey}` override (current week)
2. default day from `config/global.deliveryDayOfWeek`
3. legacy-compatible fallback key support:
   - `deliveryDateOfWeek` (top-level)
   - `otherConfig.deliveryDayOfWeek`
   - `otherConfig.deliveryDateOfWeek`

Firestore calendar/config readers also support legacy path fallbacks to avoid silent empty reads when data layout differs between historical nodes.
