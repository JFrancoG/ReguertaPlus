# HU-063 - Shifts helper and UI polish

## Metadata
- issue_id: #163
- priority: P2
- platform: both
- status: implemented

## Context and problem

The shifts screen already exposes delivery and market turns, but the upcoming-shifts block can show a helper as pending after the helper delivery date has passed. The expected rule is that the lead of the following delivery week is the helper in the current delivery week. The normal delivery day is Wednesday unless `plus-collection/deliveryCalendar` contains an exception for that week.

There are also small UI parity adjustments requested after comparing Android and iOS screenshots: hierarchy of the upcoming-shifts block, request-swap button alignment, market month label width, and main title placement.

## User story

As a cooperative member I want my upcoming shifts to show the correct helper/lead sequence and a consistent cross-platform layout so that I can trust the planning at a glance.

## Scope

### In Scope
- Helper-name resolution on delivery cards and in the upcoming delivery role for both platforms.
- Shift-facing role copy uses the cooperative terminology: Responsable/Apoyo in Spanish and Responsible/Support in English.
- Cross-platform shifts UI polish:
  - centered upcoming-shifts section title/content;
  - slightly smaller regular font for upcoming-shifts values;
  - centered swap-request button;
  - market month label formatted as `MMM yyyy`;
  - main shifts title placed below the back arrow.
  - vertically centered date block and wider name column on shift cards.
- Validation against the 8 July 2026 helper and 15 July 2026 lead case.

### Out of Scope
- Firestore schema changes.
- Google Sheets synchronization changes.
- Shift swap lifecycle changes beyond button presentation.
- Admin planning tools.

## Linked functional requirements

- RF-TURN-01
- RF-TURN-02
- RF-TURN-04

## Acceptance criteria

- iOS and Android show the lead of the following logical delivery week as helper on the current delivery card, without using the persisted helper field.
- iOS shows Nohemi as helper for the 8 July 2026 delivery shift when Nohemi is lead for the following delivery week.
- "Mis proximos turnos" / "My next shifts" keeps that helper delivery paired with the member's next lead shift even after the helper date has passed.
- Only the last delivery week with no following lead shows the helper as pending.
- The helper lookup respects delivery-day exceptions from `plus-collection/deliveryCalendar`; otherwise it uses Wednesday as the default delivery day.
- Android keeps the same helper assignment behavior and stays visually aligned with the updated contract.
- The lead row in iOS upcoming shifts has a slightly larger regular type treatment, and visible role labels use Responsable/Apoyo.
- The "Mis proximos turnos" / "My next shifts" block is centered and its values use regular weight with slightly smaller text than before.
- The "Solicitar cambio" / "Request swap" action appears as a centered button on delivery shift cards where swaps are available.
- Market cards show the month label with three-letter month plus year, for example `Mar 2026`.
- The screen title "Turnos" / "Shifts" is visually below the back arrow on both platforms.
- Compact screens remain readable with long member names.
- The delivery-card date lines are vertically centered against the names and long names receive enough width to stay on one line whenever possible.

## Dependencies

- Depends on HU-015 for the base shifts feed.
- Builds on HU-041 for segmented delivery/market cards.
- Uses the delivery calendar behavior from HU-042.

## Risks

- Main risk: iOS and Android may model delivery-day exceptions with different helper APIs.
  - Mitigation: trace both implementations before changing behavior and keep the product rule explicit in tests.
- Secondary risk: visual changes may regress compact device layouts.
  - Mitigation: validate screenshot-like states on small iOS and Android viewports/emulators when possible.

## Validation plan

- Android:
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` when a device/emulator is available or if UI behavior requires it.
- iOS:
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
  - If the simulator name is unavailable, use another valid simulator and report it.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed or skipped with reason.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
