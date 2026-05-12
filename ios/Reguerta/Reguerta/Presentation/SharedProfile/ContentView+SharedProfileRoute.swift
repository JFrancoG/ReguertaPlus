import SwiftUI

struct SharedProfileHubRoute: View {
    let tokens: ReguertaDesignTokens
    let session: AuthorizedSession
    let viewModel: SharedProfileFeatureViewModel
    let displayName: (String) -> String

    @State private var selectedProfileUserId: String?
    @State private var isEditingOwnProfile = false

    private var ownProfileExists: Bool {
        viewModel.profiles.contains { $0.userId == session.member.id }
    }

    private var sortedProfiles: [SharedProfile] {
        viewModel.profiles.sorted { displayName($0.userId) < displayName($1.userId) }
    }

    private var selectedProfile: SharedProfile? {
        sortedProfiles.first { $0.userId == selectedProfileUserId }
    }

    private var familyNamesBinding: Binding<String> {
        Binding(
            get: { viewModel.draft.familyNames },
            set: { newValue in
                var updatedDraft = viewModel.draft
                updatedDraft.familyNames = newValue
                viewModel.updateDraft(updatedDraft)
            }
        )
    }

    private var aboutBinding: Binding<String> {
        Binding(
            get: { viewModel.draft.about },
            set: { newValue in
                var updatedDraft = viewModel.draft
                updatedDraft.about = newValue
                viewModel.updateDraft(updatedDraft)
            }
        )
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        if isEditingOwnProfile {
            editorView
        } else if let selectedProfile {
            detailView(for: selectedProfile)
        } else {
            listView
        }
    }

    private var listView: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(localizedKey(AccessL10nKey.profileSharedHubTitle))
                        .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.profileSharedHubSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    ReguertaButton(
                        localizedKey(
                            ownProfileExists
                            ? AccessL10nKey.profileSharedActionViewMyProfile
                            : AccessL10nKey.profileSharedActionCreate
                        )
                    ) {
                        if ownProfileExists {
                            selectedProfileUserId = session.member.id
                        } else {
                            isEditingOwnProfile = true
                        }
                    }
                }
            }

            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(localizedKey(AccessL10nKey.profileSharedCommunityTitle))
                        .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.profileSharedCommunitySubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    ReguertaButton(localizedKey(AccessL10nKey.notificationsRefreshAction), variant: .text, fullWidth: false) {
                        Task { await viewModel.refreshProfiles() }
                    }

                    if viewModel.isLoading {
                        Text(localizedKey(AccessL10nKey.profileSharedLoading))
                            .font(tokens.typography.bodySecondary)
                    } else if sortedProfiles.isEmpty {
                        Text(localizedKey(AccessL10nKey.profileSharedEmpty))
                            .font(tokens.typography.bodySecondary)
                    } else {
                        ForEach(sortedProfiles) { profile in
                            Button {
                                selectedProfileUserId = profile.userId
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                        Text(displayName(profile.userId))
                                            .font(tokens.typography.bodySecondary.weight(.semibold))
                                        if !profile.familyNames.isEmpty {
                                            Text(profile.familyNames)
                                                .font(tokens.typography.label)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundStyle(tokens.colors.textSecondary)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func detailView(for profile: SharedProfile) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                sharedProfileCard(profile)

                if profile.userId == session.member.id {
                    ReguertaButton(localizedKey(AccessL10nKey.profileSharedActionEdit)) {
                        isEditingOwnProfile = true
                    }
                    ReguertaButton(
                        localizedKey(
                            viewModel.isDeleting
                            ? AccessL10nKey.profileSharedActionDeleting
                            : AccessL10nKey.profileSharedActionDelete
                        ),
                        variant: .text,
                        isEnabled: !viewModel.isDeleting
                    ) {
                        Task {
                            _ = await viewModel.deleteProfile()
                            selectedProfileUserId = nil
                        }
                    }
                }

                ReguertaButton(localizedKey(AccessL10nKey.commonBack), variant: .text) {
                    selectedProfileUserId = nil
                }
            }
        }
    }

    private var editorView: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(
                    localizedKey(
                        ownProfileExists
                        ? AccessL10nKey.profileSharedEditorTitleEdit
                        : AccessL10nKey.profileSharedEditorTitleCreate
                    )
                )
                .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.profileSharedEditorSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                TextField(
                    "",
                    text: familyNamesBinding,
                    prompt: Text(localizedKey(AccessL10nKey.profileSharedFamilyNamesLabel))
                )
                    .textFieldStyle(.roundedBorder)
                ReguertaImagePickerField(
                    tokens: tokens,
                    imageURLString: viewModel.draft.photoUrl,
                    isUploading: viewModel.isUploadingImage,
                    placeholderSystemImage: "person.fill",
                    subtitleKey: nil,
                    onPickImageData: { imageData in
                        Task { await viewModel.uploadImage(imageData) }
                    },
                    onClearImage: viewModel.clearImage,
                    onImageSelectionFailed: viewModel.reportImageSelectionFailed,
                    onCameraPermissionDenied: viewModel.reportCameraPermissionDenied,
                    onCameraUnavailable: viewModel.reportCameraUnavailable
                )
                Text(localizedKey(AccessL10nKey.profileSharedAboutLabel))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(text: aboutBinding)
                    .frame(minHeight: 160.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                ReguertaButton(
                    localizedKey(
                        viewModel.isSaving
                        ? AccessL10nKey.profileSharedActionSaving
                        : (ownProfileExists
                            ? AccessL10nKey.profileSharedActionSave
                            : AccessL10nKey.profileSharedActionCreate)
                    ),
                    isEnabled: !viewModel.isSaving && !viewModel.isUploadingImage,
                    isLoading: viewModel.isSaving
                ) {
                    Task {
                        guard await viewModel.saveProfile() else { return }
                        isEditingOwnProfile = false
                        selectedProfileUserId = nil
                    }
                }
                ReguertaButton(localizedKey(AccessL10nKey.commonBack), variant: .text) {
                    isEditingOwnProfile = false
                }
            }
        }
    }

    private func sharedProfileCard(_ profile: SharedProfile) -> some View {
        HStack(alignment: .top, spacing: tokens.spacing.md) {
            profileAvatar(profile)

            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                Text(displayName(profile.userId))
                    .font(tokens.typography.bodySecondary.weight(.semibold))
                if !profile.familyNames.isEmpty {
                    Text(profile.familyNames)
                        .font(tokens.typography.label)
                }
                if !profile.about.isEmpty {
                    Text(profile.about)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textPrimary)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(tokens.spacing.sm + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tokens.colors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
    }

    @ViewBuilder
    private func profileAvatar(_ profile: SharedProfile) -> some View {
        if let rawURL = profile.photoUrl, let url = URL(string: rawURL), !rawURL.isEmpty {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    avatarPlaceholder
                case .success(let image):
                    image.resizable().scaledToFill()
                        .frame(width: 72.resize, height: 72.resize)
                        .clipShape(Circle())
                case .failure:
                    avatarPlaceholder
                @unknown default:
                    avatarPlaceholder
                }
            }
        } else {
            avatarPlaceholder
        }
    }

    private var avatarPlaceholder: some View {
        Circle()
            .fill(tokens.colors.actionPrimary.opacity(0.14))
            .frame(width: 72.resize, height: 72.resize)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.system(size: 28.resize, weight: .semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)
        }
    }
}
