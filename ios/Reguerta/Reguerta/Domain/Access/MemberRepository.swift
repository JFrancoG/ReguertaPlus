import Foundation

protocol MemberRepository: Sendable {
    func member(id: String) async throws -> Member?
    func members(visibleTo member: Member) async throws -> [Member]
    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async throws -> Member
}

protocol LocalMemberRepository: MemberRepository {
    func findByEmailNormalized(_ emailNormalized: String) async -> Member?
    func findByAuthUid(_ authUid: String) async -> Member?
    func linkAuthUid(memberId: String, authUid: String) async -> Member?
    func allMembers() async -> [Member]
    func upsert(member: Member) async -> Member
}
