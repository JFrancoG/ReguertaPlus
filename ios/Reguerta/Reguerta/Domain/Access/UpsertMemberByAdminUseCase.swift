import Foundation

enum MemberManagementError: Error, Equatable, Sendable {
    case accessDenied
    case lastAdminRemoval
    case conflict(code: String)
}

protocol MemberAdministrationRepository: Sendable {
    func upsertMember(_ member: Member) async throws -> Member
}

protocol MemberAdminUpserting: Sendable {
    func execute(target: Member) async throws -> Member
}

struct UpsertMemberByAdminUseCase: MemberAdminUpserting {
    private let storedRepository: any MemberAdministrationRepository

    func execute(target: Member) async throws -> Member {
        try await storedRepository.upsertMember(target.withCanonicalIdentity)
    }
}

struct LocalMemberAdministrationRepository: MemberAdministrationRepository {
    private let storedRepository: any LocalMemberRepository

    func upsertMember(_ member: Member) async throws -> Member {
        await storedRepository.upsert(member: member)
    }
}

extension UpsertMemberByAdminUseCase {
    init(repository: any MemberAdministrationRepository) {
        self.storedRepository = repository
    }
}

extension LocalMemberAdministrationRepository {
    init(repository: any LocalMemberRepository) {
        self.storedRepository = repository
    }
}

private extension Member {
    var withCanonicalIdentity: Member {
        Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: phoneNumber,
            normalizedEmail: normalizedEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            authUid: authUid,
            roles: roles.union([.member]),
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }
}
