# Plan - HU-056 (Notification feed read state and push permission)

## Technical approach

Keep `notificationEvents` immutable and add user-scoped read markers under `users/{userId}/notificationReads/{eventId}`. Presentation ViewModels combine visible notifications with read ids and push permission state; views render the list and dialog only.

## Implementation changes
- Extend Android/iOS `NotificationRepository` with read-id load and batch mark-read methods.
- Add platform push permission providers and inject them through existing app/root factories.
- Refresh read state when opening notifications and mark visible unread ids on route exit.
- Replace the notifications header card with direct list content under the shared screen title.
- Use accent/action-primary 0.15 for read cards and warning 0.15 for unread cards.
- Move the Home bell indicator to unread state instead of any notification state.
- Add EN/ES strings and Firestore contract documentation.

## Test strategy
- Unit test repository read markers and presentation read/unread derivation.
- Unit test iOS ViewModel permission dialog visit lifecycle.
- Run standard Android and iOS validations for touched platforms.

## Risks
- Route transitions can bypass mark-read if destination changes outside the home coordinator.
- Permission status may change while the app is backgrounded; refresh on each notifications entry mitigates this.
