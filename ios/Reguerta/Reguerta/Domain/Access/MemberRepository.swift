import Foundation

protocol MemberRepository: Sendable {
    func findByEmailNormalized(_ emailNormalized: String) async -> Member?
    func findByAuthUid(_ authUid: String) async -> Member?
    func linkAuthUid(memberId: String, authUid: String) async -> Member?
    func allMembers() async -> [Member]
    func upsert(member: Member) async -> Member
}
