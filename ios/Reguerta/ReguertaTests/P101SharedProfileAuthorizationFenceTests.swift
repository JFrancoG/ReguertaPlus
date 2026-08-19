import Foundation
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct P101SharedProfileAuthorizationFenceTests {
    @Test func revokedImpersonationCannotStartRepositoryOrMediaWorkWithoutHandler() async {
        let revokedAuthenticatedMember = sharedProfileAuthorizationMember(
            id: "authenticated_member",
            roles: [.member]
        )
        let currentMember = sharedProfileAuthorizationMember(id: "current_member")
        let repository = EntryGuardProfileRepository()
        let imagePipeline = EntryGuardProfileImagePipeline()
        let viewModel = sharedProfileAuthorizationViewModel(
            authenticatedMember: revokedAuthenticatedMember,
            currentMember: currentMember,
            repository: repository,
            imagePipelineManager: imagePipeline
        )
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Pending profile"))

        await viewModel.refreshProfiles()
        #expect(await viewModel.saveProfile() == false)
        #expect(await viewModel.deleteProfile() == false)
        await viewModel.uploadImage(Data([1]))

        #expect(await repository.invocationCount() == 0)
        #expect(await imagePipeline.invocationCount() == 0)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft.photoUrl.isEmpty)
        #expect(viewModel.isLoading == false)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.isDeleting == false)
        #expect(viewModel.isUploadingImage == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateRefreshPublishesNothingWhenAuthenticatedMemberAuthorizationChangesBeforeHandler() async throws {
        let authenticatedMember = sharedProfileAuthorizationMember(
            id: "authenticated_member",
            roles: [.member, .admin]
        )
        let currentMember = sharedProfileAuthorizationMember(id: "current_member")
        let repository = EnvironmentSuspendedProfileRepository(suspendsReads: true)
        let viewModel = sharedProfileAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            repository: repository
        )
        let existingProfile = sharedProfileAuthorizationProfile(familyNames: "Estado vigente")
        let pendingDraft = SharedProfileDraft(familyNames: "Edición vigente")
        viewModel.profiles = [existingProfile]
        viewModel.updateDraft(pendingDraft)

        let refreshTask = Task { await viewModel.refreshProfiles() }
        defer {
            refreshTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadStarts(environment: .develop)
        let demotedAuthenticatedMember = sharedProfileAuthorizationMember(
            id: authenticatedMember.id,
            roles: [.member]
        )
        viewModel.sessionViewModel.mode = .authorized(
            sharedProfileAuthorizationSession(
                authenticatedMember: demotedAuthenticatedMember,
                currentMember: currentMember
            )
        )

        repository.completeRead(
            environment: .develop,
            profiles: [sharedProfileAuthorizationProfile(familyNames: "Respuesta obsoleta")]
        )
        await refreshTask.value

        #expect(viewModel.profiles == [existingProfile])
        #expect(viewModel.draft == pendingDraft)
        #expect(viewModel.isLoading == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateSavePublishesNothingWhenCurrentMemberBecomesInactiveBeforeHandler() async throws {
        let authenticatedMember = sharedProfileAuthorizationMember(
            id: "authenticated_member",
            roles: [.member, .admin]
        )
        let currentMember = sharedProfileAuthorizationMember(id: "current_member")
        let repository = EnvironmentSuspendedProfileRepository()
        let viewModel = sharedProfileAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            repository: repository
        )
        let pendingDraft = SharedProfileDraft(familyNames: "Respuesta obsoleta", about: "No debe publicarse")
        viewModel.updateDraft(pendingDraft)

        let saveTask = Task { await viewModel.saveProfile() }
        defer {
            saveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilUpsertStarts(environment: .develop)
        let inactiveCurrentMember = sharedProfileAuthorizationMember(id: currentMember.id, isActive: false)
        viewModel.sessionViewModel.mode = .authorized(
            sharedProfileAuthorizationSession(
                authenticatedMember: authenticatedMember,
                currentMember: inactiveCurrentMember
            )
        )

        repository.completeUpsert(environment: .develop)

        #expect(await saveTask.value == false)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft == pendingDraft)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateDeletePublishesNothingWhenCurrentMemberAuthLinkChangesBeforeHandler() async throws {
        let authenticatedMember = sharedProfileAuthorizationMember(
            id: "authenticated_member",
            roles: [.member, .admin]
        )
        let currentMember = sharedProfileAuthorizationMember(id: "current_member")
        let repository = EnvironmentSuspendedProfileRepository()
        let viewModel = sharedProfileAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            repository: repository
        )
        let existingProfile = sharedProfileAuthorizationProfile(familyNames: "Perfil vigente")
        viewModel.profiles = [existingProfile]

        let deleteTask = Task { await viewModel.deleteProfile() }
        defer {
            deleteTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilDeleteStarts(environment: .develop)
        let relinkedCurrentMember = sharedProfileAuthorizationMember(
            id: currentMember.id,
            authUID: "auth_relinked_current_member"
        )
        viewModel.sessionViewModel.mode = .authorized(
            sharedProfileAuthorizationSession(
                authenticatedMember: authenticatedMember,
                currentMember: relinkedCurrentMember
            )
        )

        repository.completeDelete(environment: .develop)

        #expect(await deleteTask.value == false)
        #expect(viewModel.profiles == [existingProfile])
        #expect(viewModel.isDeleting == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func lateUploadPublishesNothingWhenCurrentMemberCapabilitiesChangeBeforeHandler() async throws {
        let authenticatedMember = sharedProfileAuthorizationMember(
            id: "authenticated_member",
            roles: [.member, .admin]
        )
        let currentMember = sharedProfileAuthorizationMember(
            id: "current_member",
            isCommonPurchaseManager: true
        )
        let repository = EnvironmentSuspendedProfileRepository()
        let imagePipeline = EnvironmentSuspendedImagePipelineManager()
        let viewModel = sharedProfileAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            repository: repository,
            imagePipelineManager: imagePipeline
        )
        let pendingDraft = SharedProfileDraft(familyNames: "Edición vigente")
        viewModel.updateDraft(pendingDraft)

        let uploadTask = Task { await viewModel.uploadImage(Data([1])) }
        defer {
            uploadTask.cancel()
            repository.cancelAll()
            imagePipeline.cancelAll()
        }
        try await imagePipeline.waitUntilUploadStarts(environment: .develop)
        let reducedCurrentMember = sharedProfileAuthorizationMember(id: currentMember.id)
        viewModel.sessionViewModel.mode = .authorized(
            sharedProfileAuthorizationSession(
                authenticatedMember: authenticatedMember,
                currentMember: reducedCurrentMember
            )
        )

        imagePipeline.completeUpload(environment: .develop, downloadURL: "https://stale.test/photo.jpg")
        await uploadTask.value

        #expect(viewModel.draft == pendingDraft)
        #expect(viewModel.isUploadingImage == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func staleSaveCleanupCannotClearSameEnvironmentSuccessorAfterAuthorizationChange() async throws {
        let authenticatedMember = sharedProfileAuthorizationMember(
            id: "authenticated_member",
            roles: [.member, .admin]
        )
        let currentMember = sharedProfileAuthorizationMember(id: "current_member")
        let repository = EnvironmentSuspendedProfileRepository(suspendsReads: true)
        let viewModel = sharedProfileAuthorizationViewModel(
            authenticatedMember: authenticatedMember,
            currentMember: currentMember,
            repository: repository
        )
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Owner obsoleto"))

        let staleSaveTask = Task { await viewModel.saveProfile() }
        defer {
            staleSaveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilUpsertStarts(environment: .develop)
        let relinkedAuthenticatedMember = sharedProfileAuthorizationMember(
            id: authenticatedMember.id,
            authUID: "auth_relinked_authenticated_member",
            roles: [.member, .admin]
        )
        let successorSession = sharedProfileAuthorizationSession(
            authenticatedMember: relinkedAuthenticatedMember,
            currentMember: currentMember
        )
        viewModel.sessionViewModel.mode = .authorized(successorSession)
        viewModel.handleSessionModeChange(.authorized(successorSession))
        try await repository.waitUntilReadStarts(environment: .develop)

        let successorDeleteTask = Task { await viewModel.deleteProfile() }
        defer { successorDeleteTask.cancel() }
        try await repository.waitUntilDeleteStarts(environment: .develop)

        repository.completeUpsert(environment: .develop)
        #expect(await staleSaveTask.value == false)
        #expect(viewModel.isDeleting)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        repository.completeDelete(environment: .develop)
        #expect(await successorDeleteTask.value)
        #expect(viewModel.isDeleting == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackSharedProfileDeleted)
    }
}

@MainActor
private func sharedProfileAuthorizationViewModel(
    authenticatedMember: Member,
    currentMember: Member,
    repository: any SharedProfileRepository,
    imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager()
) -> SharedProfileFeatureViewModel {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let session = sharedProfileAuthorizationSession(
        authenticatedMember: authenticatedMember,
        currentMember: currentMember
    )
    sessionViewModel.mode = .authorized(session)
    let viewModel = SharedProfileFeatureViewModel(
        sessionViewModel: sessionViewModel,
        sharedProfileRepository: repository,
        imagePipelineManager: imagePipelineManager,
        nowMillisProvider: { 100 }
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    return viewModel
}

private func sharedProfileAuthorizationSession(
    authenticatedMember: Member,
    currentMember: Member
) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(
            uid: authenticatedMember.authUid ?? "auth_\(authenticatedMember.id)",
            email: authenticatedMember.normalizedEmail
        ),
        authenticatedMember: authenticatedMember,
        member: currentMember,
        members: [authenticatedMember, currentMember],
        environment: .develop
    )
}

private func sharedProfileAuthorizationMember(
    id: String,
    authUID: String? = nil,
    roles: Set<MemberRole> = [.member],
    isActive: Bool = true,
    isCommonPurchaseManager: Bool = false
) -> Member {
    Member(
        id: id,
        displayName: id,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: authUID ?? "auth_\(id)",
        roles: roles,
        isActive: isActive,
        producerCatalogEnabled: true,
        isCommonPurchaseManager: isCommonPurchaseManager
    )
}

private func sharedProfileAuthorizationProfile(familyNames: String) -> SharedProfile {
    SharedProfile(
        userId: "current_member",
        familyNames: familyNames,
        photoUrl: nil,
        about: "",
        updatedAtMillis: 1
    )
}
