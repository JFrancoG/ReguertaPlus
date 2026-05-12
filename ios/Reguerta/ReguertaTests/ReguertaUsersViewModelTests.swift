import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaUsersViewModelTests {
    @Test
    func usersViewModelLoadsMembersAndResetsWhenSignedOut() async {
        let admin = usersAdminMember()
        let member = usersRegularMember(id: "member_1", displayName: "Member One")
        let scenario = makeUsersScenario(currentMember: admin, members: [admin, member], startsAuthorized: false)

        scenario.sessionViewModel.mode = .authorized(scenario.session)
        scenario.viewModel.handleSessionModeChange(.authorized(scenario.session))
        await waitForCondition { scenario.viewModel.membersFeed.count == 2 }

        #expect(scenario.viewModel.membersFeed.map(\.id) == [admin.id, member.id])
        #expect(scenario.viewModel.currentMember == admin)

        scenario.viewModel.handleSessionModeChange(.signedOut)

        #expect(scenario.viewModel.currentSession == nil)
        #expect(scenario.viewModel.currentMember == nil)
        #expect(scenario.viewModel.membersFeed.isEmpty)
        #expect(scenario.viewModel.draft == MemberDraft())
        #expect(scenario.viewModel.isEditorOpen == false)
    }

    @Test
    func usersViewModelBlocksUnauthorizedMemberManagementActions() async {
        let member = usersRegularMember(id: "member_1", displayName: "Member One")
        let scenario = makeUsersScenario(currentMember: member, members: [member])
        scenario.viewModel.draft = validMemberDraft(email: "new@reguerta.app")

        #expect(await scenario.viewModel.saveDraft() == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackOnlyAdminCreate)

        #expect(await scenario.viewModel.toggleAdmin(memberId: member.id) == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackOnlyAdminEditRoles)

        #expect(await scenario.viewModel.toggleActive(memberId: member.id) == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackOnlyAdminToggleActive)
    }

    @Test
    func usersViewModelValidatesDraftBeforeSaving() async {
        let admin = usersAdminMember()
        let existing = usersRegularMember(id: "member_existing", email: "existing@reguerta.app")
        let scenario = makeUsersScenario(currentMember: admin, members: [admin, existing])

        scenario.viewModel.draft = validMemberDraft(displayName: " ", email: " ")
        #expect(await scenario.viewModel.createAuthorizedMember() == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackDisplayNameEmailRequired)

        scenario.viewModel.draft = validMemberDraft(email: "new@reguerta.app", isMember: false)
        #expect(await scenario.viewModel.createAuthorizedMember() == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackSelectRole)

        scenario.viewModel.draft = validMemberDraft(email: "producer@reguerta.app", isProducer: true)
        #expect(await scenario.viewModel.createAuthorizedMember() == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackProducerCompanyRequired)

        scenario.viewModel.draft = validMemberDraft(email: " existing@reguerta.app ")
        #expect(await scenario.viewModel.createAuthorizedMember() == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackMemberExists)
    }

    @Test
    func usersViewModelCreatesPreAuthorizedMemberWithNormalizedPayload() async {
        let admin = usersAdminMember()
        let scenario = makeUsersScenario(currentMember: admin, members: [admin])
        scenario.viewModel.draft = MemberDraft(
            displayName: "  Nuevo Socio  ",
            email: " NUEVO@Reguerta.App ",
            companyName: "  Huerta Nueva  ",
            phoneNumber: "  600 111 222  ",
            isMember: true,
            isProducer: true,
            isAdmin: false,
            isCommonPurchaseManager: true,
            isActive: true
        )

        #expect(await scenario.viewModel.createAuthorizedMember())

        let created = await scenario.repository.findByEmailNormalized("nuevo@reguerta.app")
        #expect(created?.id == "member_nuevo_reguerta_app")
        #expect(created?.displayName == "Nuevo Socio")
        #expect(created?.companyName == "Huerta Nueva")
        #expect(created?.phoneNumber == "600 111 222")
        #expect(created?.roles == [.member, .producer])
        #expect(created?.isCommonPurchaseManager == true)
        #expect(created?.producerCatalogEnabled == true)
        #expect(scenario.viewModel.draft == MemberDraft())
    }

    @Test
    func usersViewModelEditsMemberAndPreservesExistingMetadata() async {
        let admin = usersAdminMember()
        let producer = usersRegularMember(
            id: "producer_1",
            displayName: "Producer",
            email: "producer@reguerta.app",
            authUid: "auth_producer",
            roles: [.member, .producer],
            isActive: true,
            producerCatalogEnabled: false,
            producerParity: .odd,
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .odd
        )
        let scenario = makeUsersScenario(currentMember: admin, members: [admin, producer])

        scenario.viewModel.startEditing(memberId: producer.id)
        var draft = scenario.viewModel.draft
        draft.displayName = "  Producer Updated  "
        draft.phoneNumber = "  699  "
        draft.companyName = "  Updated Farm  "
        draft.isCommonPurchaseManager = true
        scenario.viewModel.updateDraft(draft)

        #expect(await scenario.viewModel.saveDraft())

        let updated = await scenario.repository.findByEmailNormalized("producer@reguerta.app")
        #expect(updated?.displayName == "Producer Updated")
        #expect(updated?.phoneNumber == "699")
        #expect(updated?.companyName == "Updated Farm")
        #expect(updated?.authUid == "auth_producer")
        #expect(updated?.producerCatalogEnabled == false)
        #expect(updated?.producerParity == .odd)
        #expect(updated?.ecoCommitmentMode == .biweekly)
        #expect(updated?.ecoCommitmentParity == .odd)
        #expect(updated?.isCommonPurchaseManager == true)
    }

    @Test
    func usersViewModelTogglesAdminAndActiveStatusAndUpdatesSession() async {
        let admin = usersAdminMember()
        let member = usersRegularMember(id: "member_1", displayName: "Member One")
        let scenario = makeUsersScenario(currentMember: admin, members: [admin, member])

        #expect(await scenario.viewModel.toggleAdmin(memberId: member.id))

        var updatedMember = await scenario.repository.findByEmailNormalized(member.normalizedEmail)
        #expect(updatedMember?.roles.contains(.admin) == true)
        #expect(scenario.viewModel.membersFeed.first { $0.id == member.id }?.roles.contains(.admin) == true)

        scenario.viewModel.requestToggleActive(memberId: member.id)
        #expect(scenario.viewModel.pendingToggleActiveMemberId == member.id)
        #expect(await scenario.viewModel.confirmToggleActive())

        updatedMember = await scenario.repository.findByEmailNormalized(member.normalizedEmail)
        #expect(updatedMember?.isActive == false)
        #expect(scenario.viewModel.pendingToggleActiveMemberId == nil)
        guard case .authorized(let session) = scenario.sessionViewModel.mode else {
            Issue.record("Expected authorized session")
            return
        }
        #expect(session.members.first { $0.id == member.id }?.isActive == false)
    }

    @Test
    func usersViewModelMapsPersistenceFailuresToFeedback() async {
        let sessionAdmin = usersAdminMember()
        let repositoryAdmin = usersAdminMember(authUid: nil)
        let accessDeniedScenario = makeUsersScenario(
            currentMember: sessionAdmin,
            members: [sessionAdmin],
            repositoryMembers: [repositoryAdmin]
        )
        accessDeniedScenario.viewModel.draft = validMemberDraft(email: "new@reguerta.app")

        #expect(await accessDeniedScenario.viewModel.createAuthorizedMember() == false)
        #expect(accessDeniedScenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackOnlyAdminManageMembers)

        let lastAdminScenario = makeUsersScenario(currentMember: sessionAdmin, members: [sessionAdmin])
        lastAdminScenario.viewModel.startEditing(memberId: sessionAdmin.id)
        var draft = lastAdminScenario.viewModel.draft
        draft.isAdmin = false
        lastAdminScenario.viewModel.updateDraft(draft)

        #expect(await lastAdminScenario.viewModel.saveDraft() == false)
        #expect(lastAdminScenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackCannotRemoveLastAdmin)

        let genericScenario = makeUsersScenario(
            currentMember: sessionAdmin,
            members: [sessionAdmin],
            upsertMemberByAdmin: FailingMemberAdminUpserter(error: UsersGenericPersistenceError())
        )
        genericScenario.viewModel.draft = validMemberDraft(email: "generic@reguerta.app")

        #expect(await genericScenario.viewModel.createAuthorizedMember() == false)
        #expect(genericScenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test
    func previewEnvironmentUsesSharedInMemoryUsersDependencies() throws {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.usersViewModel.sessionViewModel === environment.sessionViewModel)
        let usersRepository = try #require(
            environment.accessRootViewModel.usersViewModel.memberRepository as? InMemoryMemberRepository
        )
        let sessionRepository = try #require(
            environment.sessionViewModel.repository as? InMemoryMemberRepository
        )
        #expect(usersRepository === sessionRepository)
    }
}

private struct UsersScenario {
    let viewModel: UsersFeatureViewModel
    let sessionViewModel: SessionViewModel
    let repository: InMemoryMemberRepository
    let session: AuthorizedSession
}

@MainActor
private func makeUsersScenario(
    currentMember: Member,
    authenticatedMember: Member? = nil,
    members: [Member],
    repositoryMembers: [Member]? = nil,
    upsertMemberByAdmin: (any MemberAdminUpserting)? = nil,
    startsAuthorized: Bool = true
) -> UsersScenario {
    let repository = InMemoryMemberRepository(items: repositoryMembers ?? members)
    let sessionViewModel = SessionViewModel(dependencies: .preview(repository: repository))
    let resolvedAuthenticatedMember = authenticatedMember ?? currentMember
    let session = AuthorizedSession(
        principal: AuthPrincipal(
            uid: currentMember.authUid ?? "auth_\(currentMember.id)",
            email: currentMember.normalizedEmail
        ),
        authenticatedMember: resolvedAuthenticatedMember,
        member: currentMember,
        members: members
    )
    let viewModel = UsersFeatureViewModel(
        sessionViewModel: sessionViewModel,
        memberRepository: repository,
        upsertMemberByAdmin: upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: repository)
    )
    if startsAuthorized {
        sessionViewModel.mode = .authorized(session)
        viewModel.currentSession = session
        viewModel.currentMember = currentMember
        viewModel.membersFeed = members.sorted {
            $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
    }
    return UsersScenario(
        viewModel: viewModel,
        sessionViewModel: sessionViewModel,
        repository: repository,
        session: session
    )
}

private func usersAdminMember(
    id: String = "admin",
    displayName: String = "Admin",
    email: String = "admin@reguerta.test",
    authUid: String? = "auth_admin"
) -> Member {
    Member(
        id: id,
        displayName: displayName,
        normalizedEmail: email,
        authUid: authUid,
        roles: [.member, .admin],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private func usersRegularMember(
    id: String,
    displayName: String = "Member",
    email: String = "member@reguerta.test",
    authUid: String? = nil,
    roles: Set<MemberRole> = [.member],
    isActive: Bool = true,
    producerCatalogEnabled: Bool = true,
    producerParity: ProducerParity? = nil,
    ecoCommitmentMode: EcoCommitmentMode = .weekly,
    ecoCommitmentParity: ProducerParity? = nil
) -> Member {
    Member(
        id: id,
        displayName: displayName,
        companyName: roles.contains(.producer) ? "Farm" : nil,
        normalizedEmail: email,
        authUid: authUid,
        roles: roles,
        isActive: isActive,
        producerCatalogEnabled: producerCatalogEnabled,
        producerParity: producerParity,
        ecoCommitmentMode: ecoCommitmentMode,
        ecoCommitmentParity: ecoCommitmentParity
    )
}

private func validMemberDraft(
    displayName: String = "New Member",
    email: String,
    isMember: Bool = true,
    isProducer: Bool = false,
    isAdmin: Bool = false
) -> MemberDraft {
    MemberDraft(
        displayName: displayName,
        email: email,
        companyName: "",
        phoneNumber: "",
        isMember: isMember,
        isProducer: isProducer,
        isAdmin: isAdmin,
        isCommonPurchaseManager: false,
        isActive: true
    )
}

private struct UsersGenericPersistenceError: Error {}

private struct FailingMemberAdminUpserter: MemberAdminUpserting {
    let error: any Error

    func execute(actorAuthUid _: String, target _: Member) async throws -> Member {
        throw error
    }
}
