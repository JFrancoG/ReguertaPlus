import SwiftUI
import ImageIO

struct SharedProfileHubRoute: View {
    let tokens: ReguertaDesignTokens
    let session: AuthorizedSession
    let viewModel: SharedProfileFeatureViewModel
    let displayName: (String) -> String
    let onTitleChanged: (String?) -> Void
    let onProfileSaved: () -> Void

    @State private var selectedProfileUserId: String?
    @State private var carouselStartProfileUserId: String?
    @State private var isEditingOwnProfile = false
    @State private var profilePhotoOrientations: [String: SharedProfilePhotoOrientation] = [:]
    @FocusState private var focusedEditorField: SharedProfileEditorField?

    private var ownProfile: SharedProfile? {
        viewModel.profiles.first { $0.userId == session.member.id }
    }

    private var ownProfileExists: Bool {
        ownProfile != nil
    }

    private var hasProfileChanges: Bool {
        viewModel.draft.normalized != (ownProfile?.toDraft().normalized ?? SharedProfileDraft())
    }

    private var sortedProfiles: [SharedProfile] {
        viewModel.profiles.sorted { displayName($0.userId) < displayName($1.userId) }
    }

    private var selectedProfile: SharedProfile? {
        sortedProfiles.first { $0.userId == selectedProfileUserId }
    }

    private func sharedProfileListName(_ profile: SharedProfile) -> String {
        profile.familyNames.isEmpty ? displayName(profile.userId) : profile.familyNames
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
        Group {
            if isEditingOwnProfile {
                editorView
            } else if let selectedProfile {
                detailView(for: selectedProfile)
            } else if carouselStartProfileUserId != nil {
                carouselView
            } else {
                listView
            }
        }
        .onAppear(perform: updateTitleOverride)
        .onChange(of: selectedProfileUserId) { _, _ in updateTitleOverride() }
        .onChange(of: isEditingOwnProfile) { _, _ in updateTitleOverride() }
        .onDisappear { onTitleChanged(nil) }
    }

    private var listView: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.xl) {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text(localizedKey(AccessL10nKey.profileSharedHubTitle))
                            .font(tokens.typography.titleCard)
                        Text(localizedKey(AccessL10nKey.profileSharedHubSubtitle))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }

                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        if viewModel.isLoading {
                            Text(localizedKey(AccessL10nKey.profileSharedLoading))
                                .font(tokens.typography.bodySecondary)
                        } else if sortedProfiles.isEmpty {
                            Text(localizedKey(AccessL10nKey.profileSharedEmpty))
                                .font(tokens.typography.bodySecondary)
                        } else {
                            ForEach(sortedProfiles) { profile in
                                Button {
                                    carouselStartProfileUserId = profile.userId
                                } label: {
                                    HStack(spacing: tokens.spacing.md) {
                                        profileAvatar(profile, size: 64.resize, cornerRadius: tokens.radius.sm)
                                            .accessibilityHidden(true)
                                        Text(sharedProfileListName(profile))
                                            .font(tokens.typography.bodySecondary.weight(.semibold))
                                            .foregroundStyle(tokens.colors.textPrimary)
                                            .lineLimit(2)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                    .padding(tokens.spacing.sm + 2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(tokens.colors.actionPrimary.opacity(0.15))
                                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                                }
                                .buttonStyle(.plain)
                                .accessibilityElement(children: .combine)
                                .accessibilityAddTraits(.isButton)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, ReguertaFloatingActionButtonLayout.scrollContentBottomPadding)
            }

            reguertaFloatingActionButton(localizedKey(AccessL10nKey.profileSharedActionViewMyProfile)) {
                selectedProfileUserId = nil
                carouselStartProfileUserId = nil
                isEditingOwnProfile = true
            }
        }
    }

    private var carouselView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                Text(localizedKey(AccessL10nKey.profileSharedCommunityTitle))
                    .font(tokens.typography.titleCard)

                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(alignment: .top, spacing: tokens.spacing.md) {
                            ForEach(sortedProfiles) { profile in
                                Button {
                                    selectedProfileUserId = profile.userId
                                } label: {
                                    sharedProfileCarouselCard(profile)
                                }
                                .buttonStyle(.plain)
                                .accessibilityElement(children: .combine)
                                .accessibilityAddTraits(.isButton)
                                .id(profile.userId)
                            }
                        }
                        .padding(.vertical, tokens.spacing.xs)
                    }
                    .onAppear {
                        scrollCarousel(proxy)
                    }
                    .onChange(of: carouselStartProfileUserId) { _, _ in
                        scrollCarousel(proxy)
                    }
                }

            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, tokens.spacing.lg)
        }
    }

    private func detailView(for profile: SharedProfile) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                sharedProfileDetailContent(profile)

                if profile.userId == session.member.id {
                    reguertaButton(localizedKey(AccessL10nKey.profileSharedActionEdit)) {
                        isEditingOwnProfile = true
                    }
                    reguertaButton(
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
                            carouselStartProfileUserId = nil
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, tokens.spacing.lg)
        }
        .task(id: profile.photoUrl) {
            await updateProfilePhotoOrientation(for: profile)
        }
    }

    private var editorView: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(localizedKey(AccessL10nKey.profileSharedFamilyNamesLabel))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextField("", text: familyNamesBinding)
                        .textFieldStyle(.roundedBorder)
                        .focused($focusedEditorField, equals: .familyNames)
                        .accessibilityLabel(Text(localizedKey(AccessL10nKey.profileSharedFamilyNamesLabel)))

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
                        onCameraUnavailable: viewModel.reportCameraUnavailable,
                        usesIconControls: true,
                        overlaysControlsOnImage: true,
                        previewSize: 160.resize,
                        usesFitPreview: true,
                        controlSize: 38.resize
                    )

                    Text(localizedKey(AccessL10nKey.profileSharedAboutLabel))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextField("", text: aboutBinding, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(5...)
                        .focused($focusedEditorField, equals: .about)
                        .padding(tokens.spacing.sm)
                        .background(tokens.colors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                        .accessibilityLabel(Text(localizedKey(AccessL10nKey.profileSharedAboutLabel)))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, ReguertaFloatingActionButtonLayout.scrollContentBottomPadding)
            }
            .scrollDismissesKeyboard(.interactively)

            if focusedEditorField == nil {
                reguertaFloatingActionButton(
                    localizedKey(
                        viewModel.isSaving
                        ? AccessL10nKey.profileSharedActionSaving
                        : (ownProfileExists
                            ? AccessL10nKey.profileSharedActionSave
                            : AccessL10nKey.profileSharedActionCreate)
                    ),
                    isEnabled: hasProfileChanges && !viewModel.isSaving && !viewModel.isUploadingImage
                ) {
                    Task {
                        guard await viewModel.saveProfile() else { return }
                        isEditingOwnProfile = false
                        selectedProfileUserId = nil
                        carouselStartProfileUserId = nil
                        onProfileSaved()
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.18), value: focusedEditorField)
    }

    private func updateTitleOverride() {
        if isEditingOwnProfile {
            onTitleChanged(l10n(AccessL10nKey.profileSharedEditorTitleEdit))
            return
        }

        guard let selectedProfile else {
            onTitleChanged(nil)
            return
        }
        onTitleChanged(sharedProfileListName(selectedProfile))
    }

    private func scrollCarousel(_ proxy: ScrollViewProxy) {
        guard let carouselStartProfileUserId else { return }
        withAnimation(.easeInOut(duration: 0.25)) {
            proxy.scrollTo(carouselStartProfileUserId, anchor: .center)
        }
    }

    private func updateProfilePhotoOrientation(for profile: SharedProfile) async {
        guard
            profilePhotoOrientations[profile.userId] == nil,
            let orientation = await SharedProfilePhotoOrientationResolver.orientation(for: profile.photoUrl)
        else {
            return
        }
        await MainActor.run {
            profilePhotoOrientations[profile.userId] = orientation
        }
    }

    private func sharedProfileCarouselCard(_ profile: SharedProfile) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.md) {
            Text(sharedProfileListName(profile))
                .font(tokens.typography.titleCard.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(maxWidth: .infinity)

            profileAvatar(profile, size: 184.resize, cornerRadius: tokens.radius.sm)
                .accessibilityHidden(true)

            if !profile.about.isEmpty {
                Text(profile.about)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(5)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Spacer(minLength: 0)
        }
        .padding(tokens.spacing.lg)
        .frame(width: 300.resize, height: 430.resize, alignment: .top)
        .background(tokens.colors.actionPrimary.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
    }

    @ViewBuilder
    private func sharedProfileDetailContent(_ profile: SharedProfile) -> some View {
        let orientation = profilePhotoOrientations[profile.userId] ?? .landscape
        let hasPhoto = profile.photoUrl?.isEmpty == false

        if hasPhoto, orientation == .portrait {
            HStack(alignment: .top, spacing: tokens.spacing.md) {
                sharedProfileDetailPhoto(profile)
                    .frame(width: 132.resize)
                SharedProfileDetailText(profile: profile, tokens: tokens)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                if hasPhoto {
                    sharedProfileDetailPhoto(profile)
                        .frame(maxWidth: .infinity)
                }
                SharedProfileDetailText(profile: profile, tokens: tokens)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func sharedProfileDetailPhoto(_ profile: SharedProfile) -> some View {
        if let rawURL = profile.photoUrl, let url = URL(string: rawURL), !rawURL.isEmpty {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    avatarPlaceholder(size: 96.resize, cornerRadius: tokens.radius.sm)
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                case .failure:
                    avatarPlaceholder(size: 96.resize, cornerRadius: tokens.radius.sm)
                @unknown default:
                    avatarPlaceholder(size: 96.resize, cornerRadius: tokens.radius.sm)
                }
            }
        }
    }

    @ViewBuilder
    private func profileAvatar(
        _ profile: SharedProfile,
        size: CGFloat = 72.resize,
        cornerRadius: CGFloat? = nil
    ) -> some View {
        let resolvedCornerRadius = cornerRadius ?? size / 2
        if let rawURL = profile.photoUrl, let url = URL(string: rawURL), !rawURL.isEmpty {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    avatarPlaceholder(size: size, cornerRadius: resolvedCornerRadius)
                case .success(let image):
                    image.resizable().scaledToFit()
                        .frame(width: size, height: size)
                        .clipShape(RoundedRectangle(cornerRadius: resolvedCornerRadius))
                case .failure:
                    avatarPlaceholder(size: size, cornerRadius: resolvedCornerRadius)
                @unknown default:
                    avatarPlaceholder(size: size, cornerRadius: resolvedCornerRadius)
                }
            }
        } else {
            avatarPlaceholder(size: size, cornerRadius: resolvedCornerRadius)
        }
    }

    private func avatarPlaceholder(size: CGFloat, cornerRadius: CGFloat) -> some View {
        SharedProfileAvatarPlaceholder(tokens: tokens, size: size, cornerRadius: cornerRadius)
    }
}

private struct SharedProfileAvatarPlaceholder: View {
    let tokens: ReguertaDesignTokens
    let size: CGFloat
    let cornerRadius: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(tokens.colors.actionPrimary.opacity(0.14))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.39, weight: .semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)
            }
    }
}

private enum SharedProfilePhotoOrientation {
    case landscape
    case portrait
}

private enum SharedProfileEditorField: Hashable {
    case familyNames
    case about
}

private struct SharedProfileDetailText: View {
    let profile: SharedProfile
    let tokens: ReguertaDesignTokens

    var body: some View {
        if !profile.about.isEmpty {
            Text(profile.about)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private enum SharedProfilePhotoOrientationResolver {
    static func orientation(for rawURL: String?) async -> SharedProfilePhotoOrientation? {
        guard
            let rawURL,
            let url = URL(string: rawURL),
            !rawURL.isEmpty
        else {
            return nil
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard
                let source = CGImageSourceCreateWithData(data as CFData, nil),
                let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
                let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.doubleValue,
                let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.doubleValue,
                width > 0,
                height > 0
            else {
                return nil
            }
            return width >= height ? .landscape : .portrait
        } catch {
            return .landscape
        }
    }
}
