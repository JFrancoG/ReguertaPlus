import Foundation

actor InMemoryNotificationRepository: NotificationRepository {
    private var notifications: [String: NotificationEvent]
    private var readNotificationIdsByMember: [String: Set<String>]

    init(items: [NotificationEvent]? = nil) {
        self.init(items: items, readNotificationIdsByMember: [:])
    }

    init(
        items: [NotificationEvent]? = nil,
        readNotificationIdsByMember: [String: Set<String>]
    ) {
        self.notifications = Dictionary(uniqueKeysWithValues: (items ?? Self.seedNotifications).map { ($0.id, $0) })
        self.readNotificationIdsByMember = readNotificationIdsByMember
    }

    private static let seedNotifications: [NotificationEvent] = [
        NotificationEvent(
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
        NotificationEvent(
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
        )
    ]

    func allNotifications() async -> [NotificationEvent] {
        var localized: [NotificationEvent] = []
        localized.reserveCapacity(notifications.count)
        for event in notifications.values {
            localized.append(await localizedSeedNotification(event))
        }
        return localized.sorted { $0.sentAtMillis > $1.sentAtMillis }
    }

    func readNotificationIds(memberId: String) async -> Set<String> {
        readNotificationIdsByMember[memberId] ?? []
    }

    func markNotificationsRead(memberId: String, notificationIds: [String], readAtMillis _: Int64) async {
        guard !notificationIds.isEmpty else { return }
        var readIds = readNotificationIdsByMember[memberId] ?? []
        readIds.formUnion(notificationIds)
        readNotificationIdsByMember[memberId] = readIds
    }

    func send(event: NotificationEvent) async -> NotificationEvent {
        let eventId = event.id.isEmpty ? "notification_\(notifications.count + 1)" : event.id
        let persisted = NotificationEvent(
            id: eventId,
            title: event.title,
            body: event.body,
            type: event.type,
            target: event.target,
            userIds: event.userIds,
            segmentType: event.segmentType,
            targetRole: event.targetRole,
            createdBy: event.createdBy,
            sentAtMillis: event.sentAtMillis,
            weekKey: event.weekKey
        )
        notifications[eventId] = persisted
        return persisted
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
