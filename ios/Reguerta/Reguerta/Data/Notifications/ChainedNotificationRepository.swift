import Foundation

actor ChainedNotificationRepository<Primary: NotificationRepository, Fallback: NotificationRepository>:
    NotificationRepository {
    private let primary: Primary
    private let fallback: Fallback

    init(primary: Primary, fallback: Fallback) {
        self.primary = primary
        self.fallback = fallback
    }

    func notifications(visibleTo member: Member) async throws -> [NotificationEvent] {
        let primaryNotifications = try await primary.notifications(visibleTo: member)
        if !primaryNotifications.isEmpty {
            return primaryNotifications
        }
        return try await fallback.notifications(visibleTo: member)
    }

    func allNotifications() async throws -> [NotificationEvent] {
        let primaryNotifications = try await primary.allNotifications()
        if !primaryNotifications.isEmpty {
            return primaryNotifications
        }
        return try await fallback.allNotifications()
    }

    func readNotificationIds(memberId: String) async throws -> Set<String> {
        async let primaryReadIds = primary.readNotificationIds(memberId: memberId)
        async let fallbackReadIds = fallback.readNotificationIds(memberId: memberId)
        return try await primaryReadIds.union(fallbackReadIds)
    }

    func markNotificationsRead(memberId: String, notificationIds: [String], readAtMillis: Int64) async throws {
        guard !notificationIds.isEmpty else { return }
        try await fallback.markNotificationsRead(
            memberId: memberId,
            notificationIds: notificationIds,
            readAtMillis: readAtMillis
        )
        try await primary.markNotificationsRead(
            memberId: memberId,
            notificationIds: notificationIds,
            readAtMillis: readAtMillis
        )
    }

    func send(event: NotificationEvent) async throws -> NotificationEvent {
        _ = try await fallback.send(event: event)
        return try await primary.send(event: event)
    }
}
