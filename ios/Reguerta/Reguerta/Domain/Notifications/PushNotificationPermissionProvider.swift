import Foundation

protocol PushNotificationPermissionProvider: Sendable {
    func isPushNotificationPermissionActive() async -> Bool
    @MainActor func openSettings()
}

struct FixedPushNotificationPermissionProvider: PushNotificationPermissionProvider {
    let isActive: Bool

    func isPushNotificationPermissionActive() async -> Bool {
        isActive
    }

    @MainActor
    func openSettings() {}
}
