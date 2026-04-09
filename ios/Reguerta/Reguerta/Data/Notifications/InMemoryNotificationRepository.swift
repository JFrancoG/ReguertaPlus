import Foundation

actor InMemoryNotificationRepository: NotificationRepository {
    private var notifications: [String: NotificationEvent] = [
        "notification_welcome_001": NotificationEvent(
            id: "notification_welcome_001",
            title: "seed.notification.welcome.title",
            body: "seed.notification.welcome.body",
            type: "admin_broadcast",
            target: "all",
            userIds: [],
            segmentType: nil,
            targetRole: nil,
            createdBy: "system",
            sentAtMillis: 1_711_849_600_000,
            weekKey: nil
        ),
        "notification_admin_001": NotificationEvent(
            id: "notification_admin_001",
            title: "seed.notification.admin_channel.title",
            body: "seed.notification.admin_channel.body",
            type: "admin_broadcast",
            target: "segment",
            userIds: [],
            segmentType: "role",
            targetRole: .admin,
            createdBy: "system",
            sentAtMillis: 1_712_108_800_000,
            weekKey: nil
        ),
    ]

    func allNotifications() async -> [NotificationEvent] {
        var localized: [NotificationEvent] = []
        localized.reserveCapacity(notifications.count)
        for event in notifications.values {
            localized.append(await localizedSeedNotification(event))
        }
        return localized.sorted { $0.sentAtMillis > $1.sentAtMillis }
    }

    func send(event: NotificationEvent) async -> NotificationEvent {
        notifications[event.id] = event
        return event
    }
}

private func localizedSeedNotification(_ event: NotificationEvent) async -> NotificationEvent {
    let title = await MainActor.run {
        NSLocalizedString(event.title, comment: "")
    }
    let body = await MainActor.run {
        NSLocalizedString(event.body, comment: "")
    }
    return NotificationEvent(
        id: event.id,
        title: title,
        body: body,
        type: event.type,
        target: event.target,
        userIds: event.userIds,
        segmentType: event.segmentType,
        targetRole: event.targetRole,
        createdBy: event.createdBy,
        sentAtMillis: event.sentAtMillis,
        weekKey: event.weekKey
    )
}
