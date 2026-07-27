import Foundation

protocol NotificationRepository: Sendable {
    func notifications(visibleTo member: Member) async throws -> [NotificationEvent]
    func allNotifications() async throws -> [NotificationEvent]
    func readNotificationIds(memberId: String) async throws -> Set<String>
    func markNotificationsRead(memberId: String, notificationIds: [String], readAtMillis: Int64) async throws
    func send(event: NotificationEvent) async throws -> NotificationEvent
}
