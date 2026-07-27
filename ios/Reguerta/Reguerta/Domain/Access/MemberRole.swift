import Foundation

nonisolated enum MemberRole: String, CaseIterable, Codable, Sendable {
    case member
    case producer
    case admin
}
