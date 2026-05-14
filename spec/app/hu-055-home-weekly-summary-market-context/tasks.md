# Tasks - HU-055 (Home weekly summary market context)

GitHub tracking:

- #139 - Home weekly summary market context.

## 1. Shared behavior
- [x] Android: add `orderWeekKey`, market date, and market responsibles to the Home summary display model.
- [x] Android: resolve Home delivery cutoff from the effective current-week delivery shift.
- [x] Android: resolve market shift from the next scheduled market date.
- [x] Android: resolve Home order state using `orderWeekKey`.
- [x] iOS: add `orderWeekKey`, market date, and market responsibles to the Home summary display model.
- [x] iOS: resolve Home delivery cutoff from the effective current-week delivery shift.
- [x] iOS: resolve market shift from the next scheduled market date.
- [x] iOS: resolve Home order state using `orderWeekKey`.

## 2. Dashboard UI
- [x] Android: convert the weekly summary into a three-row asymmetric grid.
- [x] Android: center labels and values in the new grid cells.
- [x] Android: add market and market-responsibles strings.
- [x] iOS: convert the weekly summary into a three-row asymmetric grid.
- [x] iOS: center labels and values in the new grid cells.
- [x] iOS: add market and market-responsibles strings.

## 3. News navigation and divider
- [x] Android: keep Home latest-news heading and rename drawer news destination to `News`.
- [x] Android: add divider above latest news.
- [x] iOS: keep Home latest-news heading and rename drawer news destination to `News`.
- [x] iOS: add divider above latest news.

## 4. Tests
- [x] Android: add Thursday-after-Wednesday-delivery boundary coverage with stale default weekday.
- [x] Android: add day-after-market coverage.
- [x] iOS: add Thursday-after-Wednesday-delivery boundary coverage with stale default weekday.
- [x] iOS: add day-after-market coverage.
- [x] Android: run `./gradlew app:testDebugUnitTest`.
- [x] Android: run `./gradlew app:lintDebug`.
- [!] Android: run `./gradlew app:connectedDebugAndroidTest` once a device is reachable; AVD startup failed to register with `adb` in this environment.
- [x] iOS: run the standard simulator test command; one rerun hit an `xctrunner` launch flake on the drawer UI test, and the isolated drawer UI test passed immediately after.

## 5. Closure
- [x] Update GitHub issue number after issue creation.
- [x] Record validation outcome and any parity gaps in final handoff.
