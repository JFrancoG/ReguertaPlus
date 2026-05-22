# HU-056 - Notification feed read state and push permission

## Metadata
- issue_id: local
- priority: P2
- platform: both
- status: implemented

## Context and problem

HU-013 delivered notification creation, listing, device registration, and push dispatch, but explicitly deferred per-user read state and richer notification UX. The notifications screen must now present the feed directly below the title, distinguish new notifications, persist read state by user, and guide users who have disabled push notifications.

## User story

As an authorized member I want to see received notifications in reverse chronological order, distinguish unread notifications from read ones, and know when push notifications are disabled so that I can stay informed by Reguerta.

## Scope

### In Scope
- Redesign the notifications list on Android and iOS.
- Show each notification as a date label plus a content card with type icon, title, and body.
- Persist read markers per user in `users/{userId}/notificationReads/{eventId}`.
- Mark visible unread notifications as read when leaving the notifications screen.
- Show a Reguerta info dialog when push notification permission is inactive.
- Open system settings from the dialog.
- Update Firestore contract docs and local issue traceability.

### Out of Scope
- Editing sent notifications.
- Red unread badge counts.
- Backend notification event mutation.
- Remote tracker creation unless requested separately.

## Acceptance criteria
- The notifications screen shows the feed directly below the page title.
- Notifications are ordered by `sentAt` descending.
- Each row shows `dd MMMM yyyy` and a card with `type icon + title`, then body.
- Read cards use accent/action primary at 0.15 opacity; unread cards use warning orange at 0.15 opacity.
- Empty state is a red message: `Aún no tienes notificaciones`.
- Unread notifications become read after the user leaves the notifications screen.
- Returning to the screen without new notifications shows all previous items as read.
- Push permission inactive shows the Reguerta info dialog with Close and Settings actions.
- Android and iOS remain functionally aligned.

## Dependencies
- HU-013 notification event and push delivery foundations.
- Firebase Auth/Firestore for user-scoped read markers.
- Platform notification permission APIs.

## Definition of Done
- [x] Android implementation validated.
- [x] iOS implementation validated.
- [x] Firestore contract docs updated in EN/ES.
- [x] Unit tests cover read state and permission dialog behavior.
- [x] Android/iOS parity reviewed or temporary gap documented.
