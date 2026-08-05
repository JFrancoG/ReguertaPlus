import Foundation
import Observation

@MainActor
@Observable
final class SharedProfileFeatureViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
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
    var editorRevision: UInt64 = 0
    var profilesRevision: UInt64 = 0
    var sessionIdentityEpoch: UInt64 = 0
    var activeRefreshOperationId: UInt64?
    var nextRefreshOperationId: UInt64 = 0
    var activeMutationOperationId: UInt64?
    var nextMutationOperationId: UInt64 = 0
    var activeUploadOperationId: UInt64?
    var nextUploadOperationId: UInt64 = 0

    var currentMemberId: String? {
        currentMember?.id
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        sharedProfileRepository: any SharedProfileRepository,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.sharedProfileRepository = sharedProfileRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
    }
}

extension SharedProfileFeatureViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let identityChanged = currentSession?.principal.uid != session.principal.uid ||
                currentSession?.member.id != session.member.id
            if identityChanged {
                sessionIdentityEpoch += 1
                resetProfileState()
            }
            currentSession = session
            currentMember = session.member
            Task { await refreshProfiles() }
        case .signedOut, .unauthorized:
            sessionIdentityEpoch += 1
            currentSession = nil
            currentMember = nil
            resetProfileState()
        }
    }

    func refreshProfiles() async {
        guard let context = authorizedSessionContext else {
            resetProfileState()
            return
        }
        let refreshOperationId = beginRefreshOperation()
        let refreshEditorRevision = editorRevision
        let refreshProfilesRevision = profilesRevision

        do {
            let fetchedProfiles = try await sharedProfileRepository.allSharedProfiles()
            try Task.checkCancellation()
            guard isCurrentRefresh(refreshOperationId, context: context) else { return }
            if profilesRevision == refreshProfilesRevision {
                applyProfiles(
                    fetchedProfiles,
                    currentMemberId: context.session.member.id,
                    updatesDraft: editorRevision == refreshEditorRevision
                )
            }
        } catch is CancellationError {
            finishRefreshOperation(refreshOperationId, context: context)
            return
        } catch {
            if isCurrentRefresh(refreshOperationId, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishRefreshOperation(refreshOperationId, context: context)
    }

    func updateDraft(_ draft: SharedProfileDraft) {
        self.draft = draft
        editorRevision += 1
    }

    func saveProfile() async -> Bool {
        guard let context = authorizedSessionContext else { return false }
        guard activeMutationOperationId == nil,
              activeUploadOperationId == nil,
              !isSaving,
              !isDeleting,
              !isUploadingImage else {
            return false
        }

        let normalizedDraft = draft.normalized
        guard normalizedDraft.hasVisibleContent else {
            feedbackCenter.show(AccessL10nKey.feedbackSharedProfileContentRequired)
            return false
        }
        guard !Task.isCancelled else { return false }

        let saveEditorRevision = editorRevision
        let mutationOperationId = beginMutationOperation(isDelete: false)
        defer { finishMutationOperation(mutationOperationId, context: context) }

        let savedProfile: SharedProfile
        do {
            savedProfile = try await sharedProfileRepository.upsert(
                profile: SharedProfile(
                    userId: context.session.member.id,
                    familyNames: normalizedDraft.familyNames,
                    photoUrl: normalizedDraft.persistedPhotoUrl,
                    about: normalizedDraft.about,
                    updatedAtMillis: nowMillisProvider()
                )
            )
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentEditor(context, revision: saveEditorRevision) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            return false
        }

        guard isCurrentSession(context) else { return false }
        upsertLocalProfile(savedProfile)
        guard editorRevision == saveEditorRevision else { return false }
        draft = savedProfile.toDraft()
        editorRevision += 1
        return true
    }

    func deleteProfile() async -> Bool {
        guard let context = authorizedSessionContext else { return false }
        guard activeMutationOperationId == nil,
              activeUploadOperationId == nil,
              !isSaving,
              !isDeleting,
              !isUploadingImage else {
            return false
        }
        guard !Task.isCancelled else { return false }

        let deleteEditorRevision = editorRevision
        let mutationOperationId = beginMutationOperation(isDelete: true)
        defer { finishMutationOperation(mutationOperationId, context: context) }

        let deleted: Bool
        do {
            deleted = try await sharedProfileRepository.deleteSharedProfile(
                userId: context.session.member.id
            )
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackSharedProfileDeleteFailed)
            }
            return false
        }
        guard deleted, isCurrentSession(context) else {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackSharedProfileDeleteFailed)
            }
            return false
        }

        profiles.removeAll { $0.userId == context.session.member.id }
        profilesRevision += 1
        if editorRevision == deleteEditorRevision {
            draft = SharedProfileDraft()
            editorRevision += 1
        }
        feedbackCenter.show(AccessL10nKey.feedbackSharedProfileDeleted)
        return true
    }

    func uploadImage(_ imageData: Data) async {
        guard let context = authorizedSessionContext else { return }
        guard activeUploadOperationId == nil,
              activeMutationOperationId == nil,
              !isUploadingImage,
              !isSaving,
              !isDeleting else {
            return
        }
        guard !Task.isCancelled else { return }

        let uploadEditorRevision = editorRevision
        let uploadOperationId = beginUploadOperation()
        defer { finishUploadOperation(uploadOperationId, context: context) }

        do {
            let uploaded = try await imagePipelineManager.processAndUpload(
                imageData: imageData,
                request: ImageUploadRequest(
                    ownerId: context.session.member.id,
                    namespace: .sharedProfiles,
                    entityId: context.session.member.id,
                    nameHint: context.session.member.displayName
                )
            )
            guard isCurrentUpload(
                uploadOperationId,
                context: context,
                revision: uploadEditorRevision
            ) else { return }
            draft.photoUrl = uploaded.downloadURL
            editorRevision += 1
        } catch is CancellationError {
            return
        } catch {
            if isCurrentEditor(context, revision: uploadEditorRevision) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
        }
    }

    func clearImage() {
        var updatedDraft = draft
        updatedDraft.photoUrl = ""
        updateDraft(updatedDraft)
    }

    func reportImageSelectionFailed() {
        feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
    }

    func reportCameraPermissionDenied() {
        feedbackCenter.show(AccessL10nKey.feedbackCameraPermissionRequired)
    }

    func reportCameraUnavailable() {
        feedbackCenter.show(AccessL10nKey.feedbackCameraUnavailable)
    }
}

private extension SharedProfileFeatureViewModel {
    private func applyProfiles(_ fetchedProfiles: [SharedProfile], currentMemberId: String, updatesDraft: Bool) {
        profiles = fetchedProfiles.filter(\.hasVisibleContent)
        guard updatesDraft else { return }
        draft = fetchedProfiles.first { $0.userId == currentMemberId }?.toDraft() ?? SharedProfileDraft()
        editorRevision += 1
    }

    private func upsertLocalProfile(_ profile: SharedProfile) {
        profiles.removeAll { $0.userId == profile.userId }
        if profile.hasVisibleContent {
            profiles.append(profile)
        }
        profiles.sort { $0.updatedAtMillis > $1.updatedAtMillis }
        profilesRevision += 1
    }

    private func resetProfileState() {
        profiles = []
        draft = SharedProfileDraft()
        isLoading = false
        isSaving = false
        isUploadingImage = false
        isDeleting = false
        editorRevision += 1
        profilesRevision += 1
        activeRefreshOperationId = nil
        activeMutationOperationId = nil
        activeUploadOperationId = nil
    }

    private var authorizedSessionContext: SessionContext? {
        guard let currentSession else { return nil }
        return SessionContext(session: currentSession, generation: sessionIdentityEpoch)
    }

    private func isCurrentSession(_ context: SessionContext) -> Bool {
        currentSession?.principal.uid == context.session.principal.uid &&
            currentSession?.member.id == context.session.member.id &&
            sessionIdentityEpoch == context.generation
    }

    private func isCurrentEditor(_ context: SessionContext, revision: UInt64) -> Bool {
        isCurrentSession(context) && editorRevision == revision
    }

    private func beginRefreshOperation() -> UInt64 {
        nextRefreshOperationId += 1
        activeRefreshOperationId = nextRefreshOperationId
        isLoading = true
        return nextRefreshOperationId
    }

    private func isCurrentRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeRefreshOperationId == operationId && isCurrentSession(context)
    }

    private func finishRefreshOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentRefresh(operationId, context: context) else { return }
        activeRefreshOperationId = nil
        isLoading = false
    }

    private func beginMutationOperation(isDelete: Bool) -> UInt64 {
        nextMutationOperationId += 1
        activeMutationOperationId = nextMutationOperationId
        if isDelete {
            isDeleting = true
        } else {
            isSaving = true
        }
        return nextMutationOperationId
    }

    private func finishMutationOperation(_ operationId: UInt64, context: SessionContext) {
        guard activeMutationOperationId == operationId else { return }
        activeMutationOperationId = nil
        guard isCurrentSession(context) else { return }
        isSaving = false
        isDeleting = false
    }

    private func beginUploadOperation() -> UInt64 {
        nextUploadOperationId += 1
        activeUploadOperationId = nextUploadOperationId
        isUploadingImage = true
        return nextUploadOperationId
    }

    private func isCurrentUpload(_ operationId: UInt64, context: SessionContext, revision: UInt64) -> Bool {
        activeUploadOperationId == operationId && isCurrentEditor(context, revision: revision)
    }

    private func finishUploadOperation(_ operationId: UInt64, context: SessionContext) {
        guard activeUploadOperationId == operationId else { return }
        activeUploadOperationId = nil
        guard isCurrentSession(context) else { return }
        isUploadingImage = false
    }

    private struct SessionContext {
        let session: AuthorizedSession
        let generation: UInt64
    }
}
