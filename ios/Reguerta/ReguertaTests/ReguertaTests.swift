import Testing

@testable import Reguerta

@MainActor
struct ReguertaTests {
    @Test
    func unauthorizedEmailStaysRestricted() async {
        let repository = InMemoryMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(repository: repository)

        let result = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_unknown", email: "unknown@reguerta.app")
        )

        #expect(result == .unauthorized("Unauthorized user"))
    }

    @Test
    func firstAuthorizedLoginLinksAuthUid() async {
        let repository = InMemoryMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(repository: repository)

        let result = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_1", email: "ana.admin@reguerta.app")
        )

        guard case .authorized(let member) = result else {
            Issue.record("Expected authorized session")
            return
        }

        #expect(member.authUid == "uid_admin_1")
    }

    @Test
    func preventRemovingLastActiveAdmin() async {
        let repository = InMemoryMemberRepository()
        let resolveUseCase = ResolveAuthorizedSessionUseCase(repository: repository)
        let upsertUseCase = UpsertMemberByAdminUseCase(repository: repository)

        _ = await resolveUseCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_2", email: "ana.admin@reguerta.app")
        )

        guard let admin = await repository.findByEmailNormalized("ana.admin@reguerta.app") else {
            Issue.record("Expected seeded admin")
            return
        }

        do {
            _ = try await upsertUseCase.execute(
                actorAuthUid: "uid_admin_2",
                target: Member(
                    id: admin.id,
                    displayName: admin.displayName,
                    normalizedEmail: admin.normalizedEmail,
                    authUid: admin.authUid,
                    roles: [.member],
                    isActive: admin.isActive,
                    producerCatalogEnabled: admin.producerCatalogEnabled
                )
            )
            Issue.record("Expected last admin protection")
        } catch let error as MemberManagementError {
            #expect(error == .lastAdminRemoval)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test
    func adminCanCreatePreAuthorizedMember() async throws {
        let repository = InMemoryMemberRepository()
        let resolveUseCase = ResolveAuthorizedSessionUseCase(repository: repository)
        let upsertUseCase = UpsertMemberByAdminUseCase(repository: repository)

        _ = await resolveUseCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_3", email: "ana.admin@reguerta.app")
        )

        let created = try await upsertUseCase.execute(
            actorAuthUid: "uid_admin_3",
            target: Member(
                id: "member_new_001",
                displayName: "Nuevo Miembro",
                normalizedEmail: "nuevo@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: true,
                producerCatalogEnabled: true
            )
        )

        #expect(created.normalizedEmail == "nuevo@reguerta.app")
        #expect(await repository.findByEmailNormalized("nuevo@reguerta.app") != nil)
    }
}
