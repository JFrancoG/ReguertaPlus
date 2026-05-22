import Foundation

protocol NotificationRepository: Sendable {
    func allNotifications() async -> [NotificationEvent]
    func readNotificationIds(memberId: String) async -> Set<String>
    func markNotificationsRead(memberId: String, notificationIds: [String], readAtMillis: Int64) async
    func send(event: NotificationEvent) async -> NotificationEvent
}
