import Foundation

protocol NotificationRepository: Sendable {
    func notifications(visibleTo member: Member, environment: SessionEnvironment) async throws -> [NotificationEvent]
    func allNotifications(environment: SessionEnvironment) async throws -> [NotificationEvent]
    func readNotificationIds(memberId: String, environment: SessionEnvironment) async throws -> Set<String>
    func markNotificationsRead(
        memberId: String,
        notificationIds: [String],
        readAtMillis: Int64,
        environment: SessionEnvironment
    ) async throws
    func send(event: NotificationEvent, environment: SessionEnvironment) async throws -> NotificationEvent
}
