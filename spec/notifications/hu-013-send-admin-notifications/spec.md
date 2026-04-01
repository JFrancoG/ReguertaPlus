# HU-013 - Send admin notifications

## Metadata
- issue_id: #17
- priority: P2
- platform: both
- status: in_progress

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As an admin I want to send notifications through the enabled MVP mode so that I can communicate incidents and updates to registered member devices, and as an authorized member I want to consult the latest notifications from the app shell.

## Scope

### In Scope
- Implement capability defined by HU-013 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-013.
- Show a notifications list for authorized members from the home bell and the drawer entry.
- Let admins send notifications from the admin drawer entry and from the notifications screen.
- Order notifications by `sentAt` descending.
- Reuse the documented `notificationEvents` contract already defined in requirements docs.
- Persist notification events from the apps using `title`, `body`, `type`, `target`, `targetPayload`, `sentAt`, `createdBy` (`userId`), and `weekKey` only when the notification is week-scoped.
- Register/update `users/{userId}/devices/{deviceId}` after an authorized session is established, including `lastDeviceId` and the latest known `fcmToken` when available.
- Dispatch real FCM push from backend when a new `notificationEvents/{eventId}` document is created.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.
- Read/unread state persistence.
- Red badge or unread counters in the home bell.
- Editing previously sent notifications.
- Mandatory automatic cleanup of expired notifications in this first implementation.
- Editing previously sent notifications.

## Linked functional requirements

- RF-NOTI-04, RF-NOTI-05

## Acceptance criteria

- Authorized members can open notifications from the home bell or the drawer and see them ordered by `sentAt` descending.
- Admin can open a send-notification flow from the admin drawer area and from the notifications screen.
- Admin can create notifications using the documented MVP target contract and supported types.
- Notifications are immutable from the app once created in this first iteration.
- In this iteration, the apps persist and consume `notificationEvents` correctly for in-app consultation.
- Authorized sessions refresh device metadata and keep `users.lastDeviceId` aligned with the active device.
- Authorized sessions persist the latest known `fcmToken` when Firebase provides one.
- New `notificationEvents` are dispatched through backend FCM delivery using the registered device tokens for the resolved audience.

## Dependencies

- Base references: docs/requirements/mvp-requirements-reguerta-v1.md.
- Functional references: docs/requirements/user-stories-mvp-reguerta-v1.md.
- Data references: docs/requirements/firestore-structure-mvp-proposal-v1.md.
- Depends on Firebase Cloud Messaging plus valid APNs credentials for iOS delivery and valid Android notification permission/runtime acceptance.

## MVP Notes

- This MVP iteration intentionally does not implement per-user read state.
- Because there is no read state yet, the home bell must not show a red unread badge in this story.
- Automatic deletion after 90-100 days remains a follow-up concern and should not block HU-013 delivery unless backend support is already trivial to wire.
- This implementation now covers the app-shell slice, app-side device registration/token persistence, and backend push dispatch on notification creation.

## Risks

- Main risk: misalignment between business rules and data rules.
  - Mitigation: validate against linked RFs and acceptance tests.
- Secondary risk: regression in existing weekly workflows.
  - Mitigation: weekly-window regression tests by role.

## Definition of Done (DoD)

- [x] App-shell acceptance slice validated.
- [x] App-side device registration and `lastDeviceId` maintenance validated.
- [x] Backend push-delivery slice validated.
- [x] Implementation aligned with linked app requirements.
- [x] Android/iOS parity reviewed for the implemented slice.
- [x] Agreed app tests executed.
- [x] Technical/functional documentation updated.
- [x] Backend push-delivery follow-up closed.
- [ ] Issue and PR linked.
