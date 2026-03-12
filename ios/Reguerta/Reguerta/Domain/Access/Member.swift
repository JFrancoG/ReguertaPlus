import Foundation

struct Member: Identifiable, Equatable, Sendable {
    let id: String
    let displayName: String
    let normalizedEmail: String
    let authUid: String?
    let roles: Set<MemberRole>
    let isActive: Bool
    let producerCatalogEnabled: Bool

    var isAdmin: Bool {
        roles.contains(.admin)
    }
}
