import Foundation

extension SessionViewModel {
    func refreshSharedProfiles() {
        guard case .authorized(let session) = mode else { return }
        isLoadingSharedProfiles = true
        Task { @MainActor in
            let profiles = await sharedProfileRepository.allSharedProfiles()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = profiles.first(where: { $0.userId == session.member.id })?.toDraft() ?? SharedProfileDraft()
            isLoadingSharedProfiles = false
        }
    }

    func saveSharedProfile(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        let draft = sharedProfileDraft.normalized
        guard draft.hasVisibleContent else {
            feedbackMessageKey = AccessL10nKey.feedbackSharedProfileContentRequired
            return
        }

        isSavingSharedProfile = true
        Task { @MainActor in
            let saved = await sharedProfileRepository.upsert(
                profile: SharedProfile(
                    userId: session.member.id,
                    familyNames: draft.familyNames,
                    photoUrl: draft.photoUrl.isEmpty ? nil : draft.photoUrl,
                    about: draft.about,
                    updatedAtMillis: nowMillisProvider()
                )
            )
            let profiles = await sharedProfileRepository.allSharedProfiles()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = saved.toDraft()
            isSavingSharedProfile = false
            feedbackMessageKey = AccessL10nKey.feedbackSharedProfileSaved
            onSuccess()
        }
    }

    func deleteSharedProfile(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }

        isDeletingSharedProfile = true
        Task { @MainActor in
            let deleted = await sharedProfileRepository.deleteSharedProfile(userId: session.member.id)
            let profiles = await sharedProfileRepository.allSharedProfiles()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = SharedProfileDraft()
            isDeletingSharedProfile = false
            feedbackMessageKey = deleted
                ? AccessL10nKey.feedbackSharedProfileDeleted
                : AccessL10nKey.feedbackSharedProfileDeleteFailed
            onSuccess()
        }
    }
}

extension SharedProfile {
    func toDraft() -> SharedProfileDraft {
        SharedProfileDraft(
            familyNames: familyNames,
            photoUrl: photoUrl ?? "",
            about: about
        )
    }
}
