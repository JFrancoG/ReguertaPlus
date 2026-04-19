import SwiftUI

struct SharedProfileHubRoute: View {
    let session: AuthorizedSession
    let profiles: [SharedProfile]
    @Binding var draft: SharedProfileDraft
    let isLoading: Bool
    let isSaving: Bool
    let isUploadingImage: Bool
    let isDeleting: Bool
    let onPickImage: (Data) -> Void
    let onClearImage: () -> Void
    let onImageSelectionFailed: () -> Void
    let onCameraPermissionDenied: () -> Void
    let onCameraUnavailable: () -> Void
    let onRefresh: () -> Void
    let onSave: (@escaping @MainActor () -> Void) -> Void
    let onDelete: (@escaping @MainActor () -> Void) -> Void
    let displayName: (String) -> String

    @Environment(\.reguertaTokens) private var tokens
    @State private var selectedProfileUserId: String?
    @State private var isEditingOwnProfile = false

    private var ownProfileExists: Bool {
        profiles.contains { $0.userId == session.member.id }
    }

    private var sortedProfiles: [SharedProfile] {
        profiles.sorted { displayName($0.userId) < displayName($1.userId) }
    }

    private var selectedProfile: SharedProfile? {
        sortedProfiles.first { $0.userId == selectedProfileUserId }
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
                        onRefresh()
                    }

                    if isLoading {
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
                            isDeleting
                            ? AccessL10nKey.profileSharedActionDeleting
                            : AccessL10nKey.profileSharedActionDelete
                        ),
                        variant: .text,
                        isEnabled: !isDeleting
                    ) {
                        onDelete {
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

                TextField("", text: $draft.familyNames, prompt: Text(localizedKey(AccessL10nKey.profileSharedFamilyNamesLabel)))
                    .textFieldStyle(.roundedBorder)
                ReguertaImagePickerField(
                    tokens: tokens,
                    imageURLString: draft.photoUrl,
                    isUploading: isUploadingImage,
                    placeholderSystemImage: "person.fill",
                    subtitleKey: nil,
                    onPickImageData: onPickImage,
                    onClearImage: onClearImage,
                    onImageSelectionFailed: onImageSelectionFailed,
                    onCameraPermissionDenied: onCameraPermissionDenied,
                    onCameraUnavailable: onCameraUnavailable
                )
                Text(localizedKey(AccessL10nKey.profileSharedAboutLabel))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(text: $draft.about)
                    .frame(minHeight: 160.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                ReguertaButton(
                    localizedKey(
                        isSaving
                        ? AccessL10nKey.profileSharedActionSaving
                        : (ownProfileExists
                            ? AccessL10nKey.profileSharedActionSave
                            : AccessL10nKey.profileSharedActionCreate)
                    ),
                    isEnabled: !isSaving && !isUploadingImage,
                    isLoading: isSaving
                ) {
                    onSave {
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
