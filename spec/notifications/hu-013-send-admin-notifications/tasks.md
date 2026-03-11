# Tasks - HU-013 (Send admin notifications)

## 1. Preparation
- [ ] Review linked RFs and acceptance criteria for this story.
- [ ] Identify impacted components/layers in Android, iOS, and backend.
- [ ] Define test scenarios (happy path and edge cases).
- [ ] Align device contract: `users.lastDeviceId` and `users/{userId}/devices/{deviceId}`.

## 2. Android implementation
- [ ] Implement UI/ViewModel/domain layer changes.
- [ ] Integrate required read/write data flows.
- [ ] Validate loading, error, and success states.
- [ ] Ensure device metadata write/update includes `apiLevel` for Android.

## 3. iOS implementation
- [ ] Implement equivalent SwiftUI/ViewModel/domain layer changes.
- [ ] Integrate required read/write data flows.
- [ ] Validate loading, error, and success states.
- [ ] Ensure device metadata write/update keeps `apiLevel = null` on iOS.

## 4. Backend / Firestore
- [ ] Adjust schema/queries/rules/functions where applicable.
- [ ] Verify compatibility with existing data and incremental strategy.
- [ ] Confirm role-based access and security behavior.
- [ ] Validate consistency of `users.lastDeviceId` against existing device docs.
- [ ] Use registered devices as delivery targets for push notification dispatch.

## 5. Testing
- [ ] Execute unit tests for impacted areas.
- [ ] Execute required integration tests.
- [ ] Perform full manual acceptance validation.
- [ ] Validate iOS device document persists `apiLevel = null`.
- [ ] Validate `lastDeviceId` updates to most recently seen device.

## 6. Documentation
- [ ] Update technical notes in the linked issue.
- [ ] Record implementation decisions made during development.
- [ ] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
