import Foundation

actor ChainedMemberRepository: LocalMemberRepository {
    private let primary: any LocalMemberRepository
    private let fallback: any LocalMemberRepository

    init(primary: any LocalMemberRepository, fallback: any LocalMemberRepository) {
        self.primary = primary
        self.fallback = fallback
    }

    func member(id: String) async throws -> Member? {
        if let primaryMember = try await primary.member(id: id) {
            return primaryMember
        }
        return try await fallback.member(id: id)
    }

    func members(visibleTo member: Member) async throws -> [Member] {
        let primaryMembers = try await primary.members(visibleTo: member)
        if !primaryMembers.isEmpty {
            return primaryMembers
        }
        return try await fallback.members(visibleTo: member)
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async throws -> Member {
        let updated = try await primary.updateOwnProducerCatalogEnabled(member: member, enabled: enabled)
        _ = try? await fallback.updateOwnProducerCatalogEnabled(member: member, enabled: enabled)
        return updated
    }

    func findByEmailNormalized(_ emailNormalized: String) async -> Member? {
        if let primaryMatch = await primary.findByEmailNormalized(emailNormalized) {
            return primaryMatch
        }
        return await fallback.findByEmailNormalized(emailNormalized)
    }

    func findByAuthUid(_ authUid: String) async -> Member? {
        if let primaryMatch = await primary.findByAuthUid(authUid) {
            return primaryMatch
        }
        return await fallback.findByAuthUid(authUid)
    }

    func linkAuthUid(memberId: String, authUid: String) async -> Member? {
        let fallbackLinked = await fallback.linkAuthUid(memberId: memberId, authUid: authUid)
        let primaryLinked = await primary.linkAuthUid(memberId: memberId, authUid: authUid)
        return primaryLinked ?? fallbackLinked
    }

    func allMembers() async -> [Member] {
        let primaryMembers = await primary.allMembers()
        if !primaryMembers.isEmpty {
            return primaryMembers
        }
        return await fallback.allMembers()
    }

    func upsert(member: Member) async -> Member {
        _ = await fallback.upsert(member: member)
        let primaryUpdated = await primary.upsert(member: member)
        return primaryUpdated
    }
}
