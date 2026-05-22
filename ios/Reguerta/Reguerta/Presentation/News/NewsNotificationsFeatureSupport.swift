import Foundation

struct NewsDraft: Equatable, Sendable {
    var title = ""
    var body = ""
    var urlImage = ""
    var active = true

    var normalized: NewsDraft {
        NewsDraft(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            urlImage: urlImage.trimmingCharacters(in: .whitespacesAndNewlines),
            active: active
        )
    }

    var normalizedImageURL: String? {
        let trimmed = urlImage.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct NotificationDraft: Equatable, Sendable {
    var title = ""
    var body = ""
    var audience: NotificationAudience = .all

    var normalized: NotificationDraft {
        NotificationDraft(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            audience: audience
        )
    }
}

struct NotificationListItem: Identifiable, Equatable, Sendable {
    let notification: NotificationEvent
    let isRead: Bool

    var id: String {
        notification.id
    }
}

extension NewsArticle {
    func toDraft() -> NewsDraft {
        NewsDraft(
            title: title,
            body: body,
            urlImage: urlImage ?? "",
            active: active
        )
    }
}

extension NotificationEvent {
    var iconSystemName: String {
        switch type {
        case "order_reminder", "order_auto_generated":
            "cart"
        case "shift_swap_requested", "shift_swap_accepted", "shift_swap_applied":
            "arrow.left.arrow.right"
        case "shift_updated":
            "calendar"
        case "news_published":
            "newspaper"
        case "admin_broadcast":
            "megaphone"
        default:
            "bell"
        }
    }
}

extension NotificationAudience {
    var targetValue: String {
        switch self {
        case .all:
            return "all"
        case .members, .producers, .admins:
            return "segment"
        }
    }

    var segmentType: String? {
        switch self {
        case .all:
            return nil
        case .members, .producers, .admins:
            return "role"
        }
    }

    var targetRole: MemberRole? {
        switch self {
        case .all:
            return nil
        case .members:
            return .member
        case .producers:
            return .producer
        case .admins:
            return .admin
        }
    }
}
