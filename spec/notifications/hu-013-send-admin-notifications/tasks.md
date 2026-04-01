# Tasks - HU-013 (Send admin notifications)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Identify impacted components/layers in Android, iOS, and backend.
- [x] Define test scenarios (happy path and edge cases).
- [x] Align device contract: `users.lastDeviceId` and `users/{userId}/devices/{deviceId}`.
- [x] Add `fcmToken` and `tokenUpdatedAt` to the documented device contract.
- [x] Record MVP deferrals: no read/unread state, no unread badge, no edit flow.

## 2. Android implementation
- [x] Implement UI/ViewModel/domain layer changes.
- [x] Integrate required read/write data flows.
- [x] Validate loading, error, and success states.
- [x] Add notifications list route for all authorized members.
- [x] Add admin send-notification route reachable from drawer and notifications screen.
- [x] Ensure device metadata write/update includes `apiLevel` for Android.

## 3. iOS implementation
- [x] Implement equivalent SwiftUI/ViewModel/domain layer changes.
- [x] Integrate required read/write data flows.
- [x] Validate loading, error, and success states.
- [x] Add notifications list route for all authorized members.
- [x] Add admin send-notification route reachable from drawer and notifications screen.
- [x] Ensure device metadata write/update keeps `apiLevel = null` on iOS.

## 4. Backend / Firestore
- [x] Adjust app-side schema usage and queries where applicable.
- [ ] Verify compatibility with existing data and incremental strategy.
- [ ] Confirm role-based access and security behavior.
- [x] Validate consistency of `users.lastDeviceId` against existing device docs.
- [x] Use registered devices as delivery targets for push notification dispatch.
- [x] Reuse current `notificationEvents` contract without introducing read-state persistence yet.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [ ] Execute required integration tests.
- [ ] Perform full manual acceptance validation.
- [x] Validate notifications list ordering by `sentAt` descending.
- [x] Validate admin can send from drawer entry and from notifications screen.
- [x] Validate iOS device document persists `apiLevel = null`.
- [x] Validate `lastDeviceId` updates to most recently seen device.

## 6. Documentation
- [x] Update technical notes in the linked issue.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
