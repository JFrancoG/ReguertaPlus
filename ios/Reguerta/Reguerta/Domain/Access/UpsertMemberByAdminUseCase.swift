import Foundation

enum MemberManagementError: Error, Equatable {
    case accessDenied
    case lastAdminRemoval
}

struct UpsertMemberByAdminUseCase: Sendable {
    private let repository: any MemberRepository

    init(repository: any MemberRepository) {
        self.repository = repository
    }

    func execute(actorAuthUid: String, target: Member) async throws -> Member {
        guard let actor = await repository.findByAuthUid(actorAuthUid), actor.isAdmin, actor.isActive else {
            throw MemberManagementError.accessDenied
        }

        let allMembers = await repository.allMembers()
        let current = allMembers.first { $0.id == target.id }
        let normalized = target.withNormalizedEmail

        if wouldLeaveWithoutActiveAdmins(allMembers: allMembers, current: current, target: normalized) {
            throw MemberManagementError.lastAdminRemoval
        }

        return await repository.upsert(member: normalized)
    }

    private func wouldLeaveWithoutActiveAdmins(allMembers: [Member], current: Member?, target: Member) -> Bool {
        let activeAdminCount = allMembers.count { $0.isActive && $0.roles.contains(.admin) }
        let wasActiveAdmin = current?.isActive == true && current?.roles.contains(.admin) == true
        let willBeActiveAdmin = target.isActive && target.roles.contains(.admin)
        return wasActiveAdmin && !willBeActiveAdmin && activeAdminCount <= 1
    }
}

private extension Member {
    var withNormalizedEmail: Member {
        Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: phoneNumber,
            normalizedEmail: normalizedEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
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
