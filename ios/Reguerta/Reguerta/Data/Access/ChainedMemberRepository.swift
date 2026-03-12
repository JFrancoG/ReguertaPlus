import Foundation

actor ChainedMemberRepository: MemberRepository {
    private let primary: any MemberRepository
    private let fallback: any MemberRepository

    init(primary: any MemberRepository, fallback: any MemberRepository) {
        self.primary = primary
        self.fallback = fallback
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
