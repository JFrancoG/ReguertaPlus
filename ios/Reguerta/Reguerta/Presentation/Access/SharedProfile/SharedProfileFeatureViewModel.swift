import Foundation
import Observation

@MainActor
@Observable
final class SharedProfileFeatureViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let sharedProfileRepository: any SharedProfileRepository
    @ObservationIgnored let imagePipelineManager: any ImagePipelineManager
    @ObservationIgnored let nowMillisProvider: @MainActor @Sendable () -> Int64

    var profiles: [SharedProfile] = []
    var draft = SharedProfileDraft()
    var isLoading = false
    var isSaving = false
    var isUploadingImage = false
    var isDeleting = false
    var currentSession: AuthorizedSession?
    var currentMember: Member?

    var currentMemberId: String? {
        currentMember?.id
    }

    init(
        sessionViewModel: SessionViewModel,
        sharedProfileRepository: any SharedProfileRepository,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.sharedProfileRepository = sharedProfileRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
    }

    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let previousMemberId = currentSession?.member.id
            currentSession = session
            currentMember = session.member
            if previousMemberId != session.member.id {
                resetProfileState()
            }
            Task { await refreshProfiles() }
        case .signedOut, .unauthorized:
            currentSession = nil
            currentMember = nil
            resetProfileState()
        }
    }

    func refreshProfiles() async {
        guard let session = currentSession else {
            resetProfileState()
            return
        }

        isLoading = true
        let fetchedProfiles = await sharedProfileRepository.allSharedProfiles()
        guard isCurrentSession(session) else {
            return
        }
        applyProfiles(fetchedProfiles, currentMemberId: session.member.id)
        isLoading = false
        isUploadingImage = false
    }

    func updateDraft(_ draft: SharedProfileDraft) {
        self.draft = draft
    }

    func saveProfile() async -> Bool {
        guard let session = currentSession else { return false }
        guard !isUploadingImage else { return false }

        let normalizedDraft = draft.normalized
        guard normalizedDraft.hasVisibleContent else {
            sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackSharedProfileContentRequired
            return false
        }

        isSaving = true
        let savedProfile = await sharedProfileRepository.upsert(
            profile: SharedProfile(
                userId: session.member.id,
                familyNames: normalizedDraft.familyNames,
                photoUrl: normalizedDraft.persistedPhotoUrl,
                about: normalizedDraft.about,
                updatedAtMillis: nowMillisProvider()
            )
        )
        let fetchedProfiles = await sharedProfileRepository.allSharedProfiles()
        guard isCurrentSession(session) else {
            return false
        }
        applyProfiles(fetchedProfiles, currentMemberId: session.member.id)
        draft = savedProfile.toDraft()
        isSaving = false
        sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackSharedProfileSaved
        return true
    }

    func deleteProfile() async -> Bool {
        guard let session = currentSession else { return false }

        isDeleting = true
        let deleted = await sharedProfileRepository.deleteSharedProfile(userId: session.member.id)
        let fetchedProfiles = await sharedProfileRepository.allSharedProfiles()
        guard isCurrentSession(session) else {
            return false
        }
        applyProfiles(fetchedProfiles, currentMemberId: session.member.id)
        draft = SharedProfileDraft()
        isDeleting = false
        sessionViewModel.feedbackMessageKey = deleted
            ? AccessL10nKey.feedbackSharedProfileDeleted
            : AccessL10nKey.feedbackSharedProfileDeleteFailed
        return deleted
    }

    func uploadImage(_ imageData: Data) async {
        guard let session = currentSession else { return }

        isUploadingImage = true
        do {
            let uploaded = try await imagePipelineManager.processAndUpload(
                imageData: imageData,
                request: ImageUploadRequest(
                    ownerId: session.member.id,
                    namespace: .sharedProfiles,
                    entityId: session.member.id,
                    nameHint: session.member.displayName
                )
            )
            guard isCurrentSession(session) else {
                return
            }
            draft.photoUrl = uploaded.downloadURL
        } catch {
            sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
        }
        isUploadingImage = false
    }

    func clearImage() {
        draft.photoUrl = ""
    }

    func reportImageSelectionFailed() {
        sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
    }

    func reportCameraPermissionDenied() {
        sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackCameraPermissionRequired
    }

    func reportCameraUnavailable() {
        sessionViewModel.feedbackMessageKey = AccessL10nKey.feedbackCameraUnavailable
    }

    private func applyProfiles(_ fetchedProfiles: [SharedProfile], currentMemberId: String) {
        profiles = fetchedProfiles.filter(\.hasVisibleContent)
        draft = fetchedProfiles.first(where: { $0.userId == currentMemberId })?.toDraft() ?? SharedProfileDraft()
    }

    private func resetProfileState() {
        profiles = []
        draft = SharedProfileDraft()
        isLoading = false
        isSaving = false
        isUploadingImage = false
        isDeleting = false
    }

    private func isCurrentSession(_ session: AuthorizedSession) -> Bool {
        currentSession == session
    }
}
