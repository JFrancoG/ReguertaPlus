# Plan - HU-013 (Send admin notifications)

## 1. Technical approach

Implement this story incrementally, following Clean Architecture and reusing the documented `notificationEvents` contract and existing app-shell routes. The MVP scope covers listing notifications for authorized members, sending immutable notifications from admin entry points, registering the current device plus latest known `fcmToken` after an authorized session is established, and dispatching backend FCM pushes when new notification events are created, while explicitly deferring read/unread state and unread badge behavior.

## 2. Layer impact
- UI: Screen, state, and user action updates required by HU-013.
- Domain: Business rules and validations tied to linked RFs.
- Data: Repository/DTO/mapper/query changes for `notificationEvents` plus `users/{userId}/devices/{deviceId}` and `users.lastDeviceId`.
- Backend: Firestore trigger on `plus-collections/notificationEvents` with target resolution and FCM dispatch.
- Backend: Firestore/rules/functions/job updates for real push dispatch remain deferred.
- Data read model: `notificationEvents` feed ordered by `sentAt` descending for in-app consultation.
- Device write model: upsert device metadata and latest known token on authorized-session bootstrap/refresh.
- Docs: Spec/tasks and issue evidence updates.

## 3. Platform-specific changes
### Android
- Implement flow and validations in ViewModel + data layer.
- Ensure notifications can be opened from the bell and drawer, and sent from admin entry points.

### iOS
- Implement equivalent flow and validations in ViewModel + data layer.
- Verify functional equivalence against Android.

### Functions/Backend
- Leave backend push dispatch and cleanup scheduling as documented follow-ups once device registration is in place.
- Keep compatibility with the proposed MVP Firestore structure and avoid adding per-user read-state persistence in this iteration.

## 4. Test strategy
- Unit tests for impacted business rules.
- Integration tests for relevant repository/data paths in Android/iOS app code.
- End-to-end manual validation of notification listing, admin sending, and role-based access.

## 5. Rollout and functional validation
- Validate changes in develop environment.
- Run cross-story regression for related stories in the same domain.
- Confirm role-based behavior (member/producer/admin/reviewer when applicable).

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Align data contracts and linked RFs.
- Define test cases and edge scenarios.

### Phase 2 - Implementation
- Implement Android/iOS changes.
- Defer backend push-delivery changes to a follow-up now that device-token registration exists on the app side.
- Keep unread/read and red-badge behavior deferred for a later HU.

### Phase 3 - Closure
- Execute tests and validate acceptance criteria.
- Update issue, completion checklist, and documentation.

## 7. Technical risks and mitigation
- Risk: platform behavior drift.
  - Mitigation: parity checklist per acceptance criterion.
- Risk: Firestore data inconsistencies.
  - Mitigation: domain validations plus security rules.
