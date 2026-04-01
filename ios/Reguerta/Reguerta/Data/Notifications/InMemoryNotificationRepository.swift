import Foundation

actor InMemoryNotificationRepository: NotificationRepository {
    private var notifications: [String: NotificationEvent] = [
        "notification_welcome_001": NotificationEvent(
            id: "notification_welcome_001",
            title: "Bienvenida a La Reguerta",
            body: "Aquí verás recordatorios y avisos extraordinarios enviados por la administración.",
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
            title: "Canal admin disponible",
            body: "Este entorno de pruebas ya puede enviar notificaciones extraordinarias desde la app.",
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
        notifications.values.sorted { $0.sentAtMillis > $1.sentAtMillis }
    }

    func send(event: NotificationEvent) async -> NotificationEvent {
        notifications[event.id] = event
        return event
    }
}
