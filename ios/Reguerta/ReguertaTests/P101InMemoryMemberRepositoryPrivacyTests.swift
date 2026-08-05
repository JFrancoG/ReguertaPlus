import Testing

@testable import Reguerta

@MainActor
struct P101InMemoryMemberRepositoryPrivacyTests {
    @Test func nonAdminReadsStablePublicProjectionAndKeepsOwnIdentity() async throws {
        let currentMember = Member(
            id: "member_1",
            displayName: "Current Member",
            normalizedEmail: "current@reguerta.test",
            authUid: "auth_member_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let otherMember = Member(
            id: "member_2",
            displayName: "Other Member",
            phoneNumber: "600000000",
            normalizedEmail: "other@reguerta.test",
            authUid: "auth_member_2",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let repository = InMemoryMemberRepository(items: [currentMember, otherMember])

        let firstRead = try await repository.members(visibleTo: currentMember)
        let secondRead = try await repository.members(visibleTo: currentMember)

        #expect(firstRead == secondRead)
        #expect(firstRead.first { $0.id == currentMember.id } == currentMember)
        #expect(firstRead.first { $0.id == otherMember.id }?.normalizedEmail.isEmpty == true)
        #expect(firstRead.first { $0.id == otherMember.id }?.phoneNumber == nil)
        #expect(firstRead.first { $0.id == otherMember.id }?.authUid == nil)
    }
}
