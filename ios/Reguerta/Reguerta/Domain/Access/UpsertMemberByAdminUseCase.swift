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
    private let repository: any MemberAdministrationRepository

    init(repository: any MemberAdministrationRepository) {
        self.repository = repository
    }

    func execute(target: Member) async throws -> Member {
        try await repository.upsertMember(target.withCanonicalIdentity)
    }
}

struct LocalMemberAdministrationRepository: MemberAdministrationRepository {
    private let repository: any LocalMemberRepository

    init(repository: any LocalMemberRepository) {
        self.repository = repository
    }

    func upsertMember(_ member: Member) async throws -> Member {
        await repository.upsert(member: member)
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
