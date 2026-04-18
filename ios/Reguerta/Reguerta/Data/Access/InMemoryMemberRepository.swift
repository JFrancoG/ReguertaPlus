import Foundation

actor InMemoryMemberRepository: MemberRepository {
    private var members: [String: Member] = [
        "member_admin_001": Member(
            id: "member_admin_001",
            displayName: "Ana Admin",
            normalizedEmail: "ana.admin@reguerta.app",
            authUid: nil,
            roles: [.member, .admin],
            isActive: true,
            producerCatalogEnabled: true
        ),
        "member_producer_001": Member(
            id: "member_producer_001",
            displayName: "Pablo Productor",
            companyName: "Riscos Altos",
            normalizedEmail: "pablo.producer@reguerta.app",
            authUid: nil,
            roles: [.member, .producer],
            isActive: true,
            producerCatalogEnabled: true,
            producerParity: .even
        ),
        "member_member_001": Member(
            id: "member_member_001",
            displayName: "Marta Miembro",
            normalizedEmail: "marta.member@reguerta.app",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true,
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .even
        ),
    ]

    func findByEmailNormalized(_ emailNormalized: String) async -> Member? {
        members.values.first { $0.normalizedEmail == emailNormalized }
    }

    func findByAuthUid(_ authUid: String) async -> Member? {
        members.values.first { $0.authUid == authUid }
    }

    func linkAuthUid(memberId: String, authUid: String) async -> Member? {
        guard let existing = members[memberId] else {
            return nil
        }

        let updated = Member(
            id: existing.id,
            displayName: existing.displayName,
            companyName: existing.companyName,
            phoneNumber: existing.phoneNumber,
            normalizedEmail: existing.normalizedEmail,
            authUid: authUid,
            roles: existing.roles,
            isActive: existing.isActive,
            producerCatalogEnabled: existing.producerCatalogEnabled,
            isCommonPurchaseManager: existing.isCommonPurchaseManager,
            producerParity: existing.producerParity,
            ecoCommitmentMode: existing.ecoCommitmentMode,
            ecoCommitmentParity: existing.ecoCommitmentParity
        )
        members[memberId] = updated
        return updated
    }

    func allMembers() async -> [Member] {
        members.values.sorted { lhs, rhs in
            lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
        }
    }

    func upsert(member: Member) async -> Member {
        members[member.id] = member
        return member
    }
}
