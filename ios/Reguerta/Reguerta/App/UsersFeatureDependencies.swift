import Foundation

struct UsersFeatureDependencies {
    let memberRepository: any MemberRepository
    let upsertMemberByAdmin: any MemberAdminUpserting

    static func live(memberRepository: any MemberRepository) -> UsersFeatureDependencies {
        UsersFeatureDependencies(
            memberRepository: memberRepository,
            upsertMemberByAdmin: UpsertMemberByAdminUseCase(repository: memberRepository)
        )
    }

    static func preview(
        memberRepository: any MemberRepository = InMemoryMemberRepository(),
        upsertMemberByAdmin: (any MemberAdminUpserting)? = nil
    ) -> UsersFeatureDependencies {
        UsersFeatureDependencies(
            memberRepository: memberRepository,
            upsertMemberByAdmin: upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: memberRepository)
        )
    }
}
