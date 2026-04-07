import Foundation

struct Member: Identifiable, Equatable, Sendable {
    let id: String
    let displayName: String
    let normalizedEmail: String
    let authUid: String?
    let roles: Set<MemberRole>
    let isActive: Bool
    let producerCatalogEnabled: Bool
    let isCommonPurchaseManager: Bool

    nonisolated init(
        id: String,
        displayName: String,
        normalizedEmail: String,
        authUid: String?,
        roles: Set<MemberRole>,
        isActive: Bool,
        producerCatalogEnabled: Bool,
        isCommonPurchaseManager: Bool = false
    ) {
        self.id = id
        self.displayName = displayName
        self.normalizedEmail = normalizedEmail
        self.authUid = authUid
        self.roles = roles
        self.isActive = isActive
        self.producerCatalogEnabled = producerCatalogEnabled
        self.isCommonPurchaseManager = isCommonPurchaseManager
    }

    var isAdmin: Bool {
        roles.contains(.admin)
    }
}
