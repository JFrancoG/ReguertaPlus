import Foundation

actor ChainedNotificationRepository: NotificationRepository {
    private let primary: any NotificationRepository
    private let fallback: any NotificationRepository

    init(primary: any NotificationRepository, fallback: any NotificationRepository) {
        self.primary = primary
        self.fallback = fallback
    }

    func allNotifications() async -> [NotificationEvent] {
        let primaryNotifications = await primary.allNotifications()
        if !primaryNotifications.isEmpty {
            return primaryNotifications
        }
        return await fallback.allNotifications()
    }

    func send(event: NotificationEvent) async -> NotificationEvent {
        _ = await fallback.send(event: event)
        return await primary.send(event: event)
    }
}
