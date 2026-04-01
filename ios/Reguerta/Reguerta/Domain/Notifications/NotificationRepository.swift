import Foundation

protocol NotificationRepository: Sendable {
    func allNotifications() async -> [NotificationEvent]
    func send(event: NotificationEvent) async -> NotificationEvent
}
