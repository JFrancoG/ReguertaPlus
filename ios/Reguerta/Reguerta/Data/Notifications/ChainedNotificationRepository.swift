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

    func readNotificationIds(memberId: String) async -> Set<String> {
        async let primaryReadIds = primary.readNotificationIds(memberId: memberId)
        async let fallbackReadIds = fallback.readNotificationIds(memberId: memberId)
        return await primaryReadIds.union(fallbackReadIds)
    }

    func markNotificationsRead(memberId: String, notificationIds: [String], readAtMillis: Int64) async {
        guard !notificationIds.isEmpty else { return }
        await fallback.markNotificationsRead(
            memberId: memberId,
            notificationIds: notificationIds,
            readAtMillis: readAtMillis
        )
        await primary.markNotificationsRead(
            memberId: memberId,
            notificationIds: notificationIds,
            readAtMillis: readAtMillis
        )
    }

    func send(event: NotificationEvent) async -> NotificationEvent {
        _ = await fallback.send(event: event)
        return await primary.send(event: event)
    }
}
