import Foundation

enum ShiftType: String, Equatable, Sendable {
    case delivery
    case market
}

enum ShiftStatus: String, Equatable, Sendable {
    case planned
    case swapPending = "swap_pending"
    case confirmed
}

struct ShiftAssignment: Identifiable, Equatable, Sendable {
    let id: String
    let type: ShiftType
    let dateMillis: Int64
    let assignedUserIds: [String]
    let helperUserId: String?
    let status: ShiftStatus
    let source: String
    let createdAtMillis: Int64
    let updatedAtMillis: Int64

    func isAssigned(to userId: String) -> Bool {
        assignedUserIds.contains(userId) || helperUserId == userId
    }
}
