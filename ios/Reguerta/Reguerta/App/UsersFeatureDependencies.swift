import Foundation

struct UsersFeatureDependencies {
    let memberRepository: any MemberRepository
    let upsertMemberByAdmin: any MemberAdminUpserting

    static func live(
        memberRepository: any MemberRepository,
        memberAdministrationRepository: any MemberAdministrationRepository
    ) -> UsersFeatureDependencies {
        UsersFeatureDependencies(
            memberRepository: memberRepository,
            upsertMemberByAdmin: UpsertMemberByAdminUseCase(repository: memberAdministrationRepository)
        )
    }

    static func preview(
        memberRepository: any LocalMemberRepository = InMemoryMemberRepository(),
        upsertMemberByAdmin: (any MemberAdminUpserting)? = nil
    ) -> UsersFeatureDependencies {
        UsersFeatureDependencies(
            memberRepository: memberRepository,
            upsertMemberByAdmin: upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(
                repository: LocalMemberAdministrationRepository(repository: memberRepository)
            )
        )
    }
}
