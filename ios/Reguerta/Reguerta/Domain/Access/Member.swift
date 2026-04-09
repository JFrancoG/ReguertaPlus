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
    let producerParity: ProducerParity?
    let ecoCommitmentMode: EcoCommitmentMode
    let ecoCommitmentParity: ProducerParity?

    nonisolated init(
        id: String,
        displayName: String,
        normalizedEmail: String,
        authUid: String?,
        roles: Set<MemberRole>,
        isActive: Bool,
        producerCatalogEnabled: Bool,
        isCommonPurchaseManager: Bool = false,
        producerParity: ProducerParity? = nil,
        ecoCommitmentMode: EcoCommitmentMode = .weekly,
        ecoCommitmentParity: ProducerParity? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.normalizedEmail = normalizedEmail
        self.authUid = authUid
        self.roles = roles
        self.isActive = isActive
        self.producerCatalogEnabled = producerCatalogEnabled
        self.isCommonPurchaseManager = isCommonPurchaseManager
        self.producerParity = producerParity
        self.ecoCommitmentMode = ecoCommitmentMode
        self.ecoCommitmentParity = ecoCommitmentParity
    }

    var isAdmin: Bool {
        roles.contains(.admin)
    }
}

enum ProducerParity: String, Equatable, Sendable {
    case even
    case odd
}

enum EcoCommitmentMode: String, Equatable, Sendable {
    case weekly
    case biweekly
}
