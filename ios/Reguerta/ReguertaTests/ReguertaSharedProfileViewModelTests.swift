import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaSharedProfileViewModelTests {
    @Test
    func sharedProfileViewModelLoadsVisibleProfilesAndOwnDraft() async {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let ownProfile = sharedProfile(
            userId: currentMember.id,
            familyNames: "Familia Uno",
            about: "Perfil propio",
            updatedAtMillis: 10
        )
        let otherProfile = sharedProfile(
            userId: "member_2",
            familyNames: "Familia Dos",
            about: "Otro perfil",
            updatedAtMillis: 20
        )
        let blankProfile = sharedProfile(userId: "blank", updatedAtMillis: 30)
        let viewModel = makeSharedProfileViewModel(
            currentMember: currentMember,
            repository: InMemorySharedProfileRepository(items: [ownProfile, otherProfile, blankProfile])
        )

        await viewModel.refreshProfiles()

        #expect(viewModel.profiles.map(\.userId) == ["member_2", "member_1"])
        #expect(viewModel.draft == ownProfile.toDraft())
    }

    @Test
    func sharedProfileViewModelResetsStateWhenSessionLeavesAuthorizedMode() {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let viewModel = makeSharedProfileViewModel(currentMember: currentMember)
        viewModel.profiles = [sharedProfile(userId: currentMember.id, familyNames: "Familia")]
        viewModel.draft = SharedProfileDraft(familyNames: "Familia", about: "Texto")
        viewModel.isLoading = true
        viewModel.isSaving = true
        viewModel.isUploadingImage = true
        viewModel.isDeleting = true

        viewModel.handleSessionModeChange(.signedOut)

        #expect(viewModel.currentSession == nil)
        #expect(viewModel.currentMember == nil)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft == SharedProfileDraft())
        #expect(viewModel.isLoading == false)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.isUploadingImage == false)
        #expect(viewModel.isDeleting == false)
    }

    @Test
    func sharedProfileViewModelBlocksSaveWithoutVisibleContent() async {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let repository = InMemorySharedProfileRepository(items: [])
        let viewModel = makeSharedProfileViewModel(currentMember: currentMember, repository: repository)
        viewModel.draft = SharedProfileDraft(familyNames: " ", photoUrl: " ", about: " ")

        let saved = await viewModel.saveProfile()

        #expect(saved == false)
        #expect(await repository.sharedProfile(userId: currentMember.id) == nil)
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackSharedProfileContentRequired)
    }

    @Test
    func sharedProfileViewModelSavesNormalizedProfileAndRefreshesSnapshot() async {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let repository = InMemorySharedProfileRepository(items: [])
        let viewModel = makeSharedProfileViewModel(
            currentMember: currentMember,
            repository: repository,
            nowMillis: 123
        )
        viewModel.draft = SharedProfileDraft(
            familyNames: "  Familia Uno  ",
            photoUrl: " https://cdn.test/profile.jpg ",
            about: "  Somos una familia  "
        )

        let saved = await viewModel.saveProfile()

        let profile = await repository.sharedProfile(userId: currentMember.id)
        #expect(saved)
        #expect(profile?.familyNames == "Familia Uno")
        #expect(profile?.photoUrl == "https://cdn.test/profile.jpg")
        #expect(profile?.about == "Somos una familia")
        #expect(profile?.updatedAtMillis == 123)
        #expect(viewModel.profiles.map(\.userId) == [currentMember.id])
        #expect(
            viewModel.draft == SharedProfileDraft(
                familyNames: "Familia Uno",
                photoUrl: "https://cdn.test/profile.jpg",
                about: "Somos una familia"
            )
        )
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackSharedProfileSaved)
    }

    @Test
    func sharedProfileViewModelDeletesOwnProfileAndClearsDraft() async {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let repository = InMemorySharedProfileRepository(
            items: [sharedProfile(userId: currentMember.id, familyNames: "Familia")]
        )
        let viewModel = makeSharedProfileViewModel(currentMember: currentMember, repository: repository)
        await viewModel.refreshProfiles()

        let deleted = await viewModel.deleteProfile()

        #expect(deleted)
        #expect(await repository.sharedProfile(userId: currentMember.id) == nil)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft == SharedProfileDraft())
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackSharedProfileDeleted)
    }

    @Test
    func sharedProfileViewModelUploadsImageAndShowsFeedbackOnFailure() async {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let successViewModel = makeSharedProfileViewModel(
            currentMember: currentMember,
            imagePipelineManager: SharedProfileMockImagePipelineManager(
                result: .success("https://cdn.test/upload.jpg")
            )
        )

        await successViewModel.uploadImage(Data([1, 2, 3]))

        #expect(successViewModel.draft.photoUrl == "https://cdn.test/upload.jpg")

        let failureViewModel = makeSharedProfileViewModel(
            currentMember: currentMember,
            imagePipelineManager: SharedProfileMockImagePipelineManager(
                result: .failure(SharedProfileImagePipelineTestError())
            )
        )

        await failureViewModel.uploadImage(Data([1, 2, 3]))

        #expect(failureViewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackUnableSaveChanges)
    }

    @Test
    func sharedProfileViewModelReportsImageSelectionAndCameraFailures() {
        let currentMember = sharedProfileMember(id: "member_1", displayName: "Member One")
        let viewModel = makeSharedProfileViewModel(currentMember: currentMember)

        viewModel.reportImageSelectionFailed()
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackUnableSaveChanges)

        viewModel.reportCameraPermissionDenied()
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackCameraPermissionRequired)

        viewModel.reportCameraUnavailable()
        #expect(viewModel.sessionViewModel.feedbackMessageKey == AccessL10nKey.feedbackCameraUnavailable)
    }

    @Test
    func previewEnvironmentUsesInMemorySharedProfileDependencies() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.sharedProfileViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.sharedProfileViewModel.sharedProfileRepository is InMemorySharedProfileRepository)
        #expect(environment.accessRootViewModel.sharedProfileViewModel.imagePipelineManager is NoOpImagePipelineManager)
    }
}

@MainActor
private func makeSharedProfileViewModel(
    currentMember: Member,
    members: [Member]? = nil,
    repository: InMemorySharedProfileRepository? = nil,
    imagePipelineManager: any ImagePipelineManager = SharedProfileMockImagePipelineManager(
        result: .success("https://cdn.test/profile.jpg")
    ),
    nowMillis: Int64 = 100
) -> SharedProfileFeatureViewModel {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let resolvedMembers = members ?? [currentMember]
    let session = AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(currentMember.id)", email: currentMember.normalizedEmail),
        authenticatedMember: currentMember,
        member: currentMember,
        members: resolvedMembers
    )
    sessionViewModel.mode = .authorized(session)
    let viewModel = SharedProfileFeatureViewModel(
        sessionViewModel: sessionViewModel,
        sharedProfileRepository: repository ?? InMemorySharedProfileRepository(items: []),
        imagePipelineManager: imagePipelineManager,
        nowMillisProvider: { nowMillis }
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    return viewModel
}

@MainActor
private func sharedProfileMember(id: String, displayName: String) -> Member {
    Member(
        id: id,
        displayName: displayName,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: "auth_\(id)",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private func sharedProfile(
    userId: String,
    familyNames: String = "",
    photoUrl: String? = nil,
    about: String = "",
    updatedAtMillis: Int64 = 1
) -> SharedProfile {
    SharedProfile(
        userId: userId,
        familyNames: familyNames,
        photoUrl: photoUrl,
        about: about,
        updatedAtMillis: updatedAtMillis
    )
}

private struct SharedProfileImagePipelineTestError: Error {}

private final class SharedProfileMockImagePipelineManager: ImagePipelineManager {
    enum ResultMode {
        case success(String)
        case failure(any Error)
    }

    private let result: ResultMode

    init(result: ResultMode) {
        self.result = result
    }

    func processAndUpload(
        imageData _: Data,
        request _: ImageUploadRequest
    ) async throws -> ImageUploadResult {
        switch result {
        case .success(let downloadURL):
            ImageUploadResult(
                downloadURL: downloadURL,
                widthPx: 1,
                heightPx: 1,
                byteSize: 1,
                mimeType: "image/jpeg"
            )
        case .failure(let error):
            throw error
        }
    }
}
