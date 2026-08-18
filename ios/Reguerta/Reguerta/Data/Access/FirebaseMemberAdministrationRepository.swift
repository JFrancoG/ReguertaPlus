import Foundation

nonisolated private struct UpsertMemberByAdminRequest: Encodable {
    let environment: SessionEnvironment
    let memberId: String
    let displayName: String
    let companyName: String?
    let phoneNumber: String?
    let normalizedEmail: String
    let roles: [MemberRole]
    let isActive: Bool
    let producerCatalogEnabled: Bool
    let isCommonPurchaseManager: Bool
    let producerParity: ProducerParity?
    let ecoCommitmentMode: EcoCommitmentMode
    let ecoCommitmentParity: ProducerParity?

    private enum CodingKeys: String, CodingKey {
        case environment
        case memberId
        case displayName
        case companyName
        case phoneNumber
        case normalizedEmail
        case roles
        case isActive
        case producerCatalogEnabled
        case isCommonPurchaseManager
        case producerParity
        case ecoCommitmentMode
        case ecoCommitmentParity
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(environment, forKey: .environment)
        try container.encode(memberId, forKey: .memberId)
        try container.encode(displayName, forKey: .displayName)
        try container.encode(companyName, forKey: .companyName)
        try container.encode(phoneNumber, forKey: .phoneNumber)
        try container.encode(normalizedEmail, forKey: .normalizedEmail)
        try container.encode(roles, forKey: .roles)
        try container.encode(isActive, forKey: .isActive)
        try container.encode(producerCatalogEnabled, forKey: .producerCatalogEnabled)
        try container.encode(isCommonPurchaseManager, forKey: .isCommonPurchaseManager)
        try container.encode(producerParity, forKey: .producerParity)
        try container.encode(ecoCommitmentMode, forKey: .ecoCommitmentMode)
        try container.encode(ecoCommitmentParity, forKey: .ecoCommitmentParity)
    }
}

nonisolated private struct UpsertMemberByAdminResponse: Codable {
    let ok: Bool
    let memberId: String
    let roles: [MemberRole]
    let isActive: Bool
    let environment: SessionEnvironment
}

@MainActor
struct FirebaseMemberAdministrationRepository: MemberAdministrationRepository {
    private let storedClient: AuthenticatedFirebaseFunctionsClient
    private let environmentProvider: @MainActor @Sendable () -> SessionEnvironment

    func upsertMember(_ member: Member) async throws -> Member {
        let requestedEnvironment = environmentProvider()
        let response: UpsertMemberByAdminResponse
        do {
            response = try await storedClient.post(
                function: .upsertMemberByAdmin,
                body: UpsertMemberByAdminRequest(
                    environment: requestedEnvironment,
                    memberId: member.id,
                    displayName: member.displayName,
                    companyName: member.companyName,
                    phoneNumber: member.phoneNumber,
                    normalizedEmail: member.normalizedEmail,
                    roles: MemberRole.allCases.filter(member.roles.contains),
                    isActive: member.isActive,
                    producerCatalogEnabled: member.producerCatalogEnabled,
                    isCommonPurchaseManager: member.isCommonPurchaseManager,
                    producerParity: member.producerParity,
                    ecoCommitmentMode: member.ecoCommitmentMode,
                    ecoCommitmentParity: member.ecoCommitmentParity
                ),
                response: UpsertMemberByAdminResponse.self
            )
        } catch FirebaseFunctionClientError.unauthorized,
                FirebaseFunctionClientError.forbidden {
            throw MemberManagementError.accessDenied
        } catch let FirebaseFunctionClientError.conflict(code, _) {
            if code == "last_active_admin" {
                throw MemberManagementError.lastAdminRemoval
            }
            throw MemberManagementError.conflict(code: code)
        }
        guard response.ok,
              response.environment == requestedEnvironment,
              response.memberId == member.id,
              Set(response.roles) == member.roles,
              response.isActive == member.isActive else {
            throw FirebaseFunctionClientError.invalidResponse
        }
        return member
    }
}

extension FirebaseMemberAdministrationRepository {
    init(
        client: AuthenticatedFirebaseFunctionsClient,
        environmentProvider: @escaping @MainActor @Sendable () -> SessionEnvironment = {
            ReguertaRuntimeEnvironment.currentFirestoreEnvironment
        }
    ) {
        self.storedClient = client
        self.environmentProvider = environmentProvider
    }
}
