import Observation

@MainActor
@Observable
final class ShiftNotificationPushOpenStore {
    private(set) var pendingReference: ShiftNotificationPushReference?

    func accept(_ reference: ShiftNotificationPushReference) {
        pendingReference = reference
    }

    func consume(_ reference: ShiftNotificationPushReference) {
        guard pendingReference == reference else { return }
        pendingReference = nil
    }
}
