import Foundation

enum NotificationAudience: String, CaseIterable, Equatable, Sendable {
    case all
    case members
    case producers
    case admins
}
