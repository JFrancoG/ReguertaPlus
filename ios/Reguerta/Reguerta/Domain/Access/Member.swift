import Foundation

nonisolated struct Member: Identifiable, Equatable {
    private let storedID: String
    let displayName: String
    let companyName: String?
    let phoneNumber: String?
    let normalizedEmail: String
    let authUid: String?
    let roles: Set<MemberRole>
    let isActive: Bool
    let producerCatalogEnabled: Bool
    let isCommonPurchaseManager: Bool
    let producerParity: ProducerParity?
    let ecoCommitmentMode: EcoCommitmentMode
    let ecoCommitmentParity: ProducerParity?

    nonisolated var id: String { storedID }

    var isAdmin: Bool {
        roles.contains(.admin)
    }

    func copy(producerCatalogEnabled: Bool) -> Member {
        Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: phoneNumber,
            normalizedEmail: normalizedEmail,
            authUid: authUid,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }
}

extension Member {
    nonisolated init(
        id: String,
        displayName: String,
        companyName: String? = nil,
        phoneNumber: String? = nil,
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
        self.storedID = id
        self.displayName = displayName
        self.companyName = companyName
        self.phoneNumber = phoneNumber
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
}

nonisolated enum ProducerParity: String, Codable, Equatable, Sendable {
    case even
    case odd
}

nonisolated enum EcoCommitmentMode: String, Codable, Equatable, Sendable {
    case weekly
    case biweekly
}
