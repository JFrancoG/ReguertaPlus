import Foundation

enum NotificationContentPolicy: Equatable {
    case embedded
    case authorizedFetchRequired
}

struct NotificationEvent: Identifiable, Equatable {
    let id: String
    let title: String
    let body: String
    let type: String
    let target: String
    let userIds: [String]
    let segmentType: String?
    let targetRole: MemberRole?
    let createdBy: String
    let sentAtMillis: Int64
    let weekKey: String?
    let contentPolicy: NotificationContentPolicy

    func isVisible(to member: Member) -> Bool {
        switch target {
        case "all":
            return true
        case "users":
            return userIds.contains(member.id)
        case "segment":
            guard segmentType == "role", let targetRole else { return false }
            return member.roles.contains(targetRole)
        default:
            return false
        }
    }
}

extension NotificationEvent {
    init(
        id: String,
        title: String,
        body: String,
        type: String,
        target: String,
        userIds: [String],
        segmentType: String?,
        targetRole: MemberRole?,
        createdBy: String,
        sentAtMillis: Int64,
        weekKey: String?
    ) {
        self.init(
            id: id,
            title: title,
            body: body,
            type: type,
            target: target,
            userIds: userIds,
            segmentType: segmentType,
            targetRole: targetRole,
            createdBy: createdBy,
            sentAtMillis: sentAtMillis,
            weekKey: weekKey,
            contentPolicy: .embedded
        )
    }
}
