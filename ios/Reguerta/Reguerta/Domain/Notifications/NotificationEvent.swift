import Foundation

struct NotificationEvent: Identifiable, Equatable, Sendable {
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

    func isVisible(to member: Member) -> Bool {
        switch target {
        case "all":
            return true
        case "users":
            return userIds.contains(member.id)
        case "segment":
            guard segmentType == "role", let targetRole else {
                return false
            }
            return member.roles.contains(targetRole)
        default:
            return false
        }
    }
}
