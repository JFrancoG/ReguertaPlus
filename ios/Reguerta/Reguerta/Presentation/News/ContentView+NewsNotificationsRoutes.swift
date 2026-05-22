import SwiftUI

struct NewsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: NewsNotificationsFeatureViewModel
    let newsMetaText: (NewsArticle) -> String
    let onCreateNews: () -> Void
    let onEditNews: () -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: tokens.spacing.lg) {
                        if viewModel.isLoadingNews {
                            Text(LocalizedStringKey(AccessL10nKey.newsLoading))
                                .font(tokens.typography.bodySecondary)
                        } else if viewModel.newsFeed.isEmpty {
                            Text(LocalizedStringKey(AccessL10nKey.newsEmptyState))
                                .font(tokens.typography.bodySecondary)
                        } else {
                            ForEach(Array(viewModel.newsFeed.enumerated()), id: \.element.id) { index, article in
                                NewsArticleCardView(
                                    tokens: tokens,
                                    article: article,
                                    index: index,
                                    isAdmin: viewModel.canPublishNews,
                                    isHighlighted: viewModel.highlightedNewsId == article.id,
                                    newsMetaText: newsMetaText,
                                    onEditNews: editNews,
                                    onDeleteNews: requestNewsDeletion
                                )
                                .id(article.id)
                            }
                        }
                    }
                    .padding(.bottom, viewModel.canPublishNews
                        ? ReguertaFloatingActionButtonLayout.scrollContentBottomPadding
                        : tokens.spacing.sm)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.newsFeed.map(\.id))
                }
                .onChange(of: viewModel.highlightedNewsId) { _, newsId in
                    guard let newsId else { return }
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(newsId, anchor: .center)
                    }
                }
            }

            if viewModel.canPublishNews {
                reguertaFloatingActionButton(LocalizedStringKey(AccessL10nKey.newsCreateAction)) {
                    createNews()
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func createNews() {
        if viewModel.startCreatingNews() {
            onCreateNews()
        }
    }

    private func editNews(_ newsId: String) {
        if viewModel.startEditingNews(newsId: newsId) {
            onEditNews()
        }
    }

    private func requestNewsDeletion(_ newsId: String) {
        viewModel.requestNewsDeletion(newsId: newsId)
    }
}

private struct NewsArticleCardView: View {
    let tokens: ReguertaDesignTokens
    let article: NewsArticle
    let index: Int
    let isAdmin: Bool
    let isHighlighted: Bool
    let newsMetaText: (NewsArticle) -> String
    let onEditNews: (String) -> Void
    let onDeleteNews: (String) -> Void

    var body: some View {
        reguertaListItemCard(isHighlighted: isHighlighted) {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HomeLatestNewsRowView(
                    tokens: tokens,
                    item: HomeLatestNewsItemPresentation(
                        article: article,
                        index: index,
                        metadataText: newsMetaText(article),
                        statusText: article.active ? nil : l10n(AccessL10nKey.newsInactiveBadge),
                        bodyLineLimit: nil,
                        titleAccessibilityIdentifierPrefix: "news.list.article",
                        cardAccessibilityIdentifierPrefix: "news.list.articleCard"
                    )
                )

                if isAdmin {
                    HStack(spacing: tokens.spacing.sm) {
                        Spacer()
                        ReguertaListActionIconButton(
                            systemImageName: "pencil",
                            accessibilityLabel: l10n(AccessL10nKey.newsEditAction),
                            backgroundColor: tokens.colors.actionPrimary,
                            action: { onEditNews(article.id) }
                        )

                        ReguertaListActionIconButton(
                            systemImageName: "trash",
                            accessibilityLabel: l10n(AccessL10nKey.newsDeleteAction),
                            backgroundColor: tokens.colors.feedbackError,
                            action: { onDeleteNews(article.id) }
                        )
                        Spacer().frame(width: 12.resize)
                    }
                }
            }
            .padding(tokens.spacing.lg)
        }
    }
}

struct NewsEditorRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: NewsNotificationsFeatureViewModel
    let onSaveSuccess: () -> Void

    private var saveActionKey: String {
        if viewModel.isSavingNews {
            return AccessL10nKey.newsSaveActionSaving
        }
        return viewModel.editingNewsId == nil
            ? AccessL10nKey.newsSaveActionCreate
            : AccessL10nKey.newsSaveActionUpdate
    }

    private var newsTitle: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.title },
            set: { value in
                viewModel.updateNewsDraft { draft in
                    draft.title = value
                }
            }
        )
    }

    private var newsBody: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.body },
            set: { value in
                viewModel.updateNewsDraft { draft in
                    draft.body = value
                }
            }
        )
    }

    private var newsArchived: Binding<Bool> {
        Binding(
            get: { !viewModel.newsDraft.active },
            set: { value in
                viewModel.updateNewsDraft { draft in
                    draft.active = !value
                }
            }
        )
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(LocalizedStringKey(AccessL10nKey.newsFieldTitle))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)

                    TextField(
                        "",
                        text: newsTitle
                    )
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.newsFieldTitle)))

                    Text(LocalizedStringKey(AccessL10nKey.newsFieldBody))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextEditor(text: newsBody)
                        .frame(minHeight: 180.resize)
                        .padding(tokens.spacing.sm)
                        .background(tokens.colors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                        .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.newsFieldBody)))

                    ReguertaImagePickerField(
                        tokens: tokens,
                        imageURLString: viewModel.newsDraft.urlImage,
                        isUploading: viewModel.isUploadingNewsImage,
                        placeholderSystemImage: "photo",
                        subtitleKey: nil,
                        onPickImageData: uploadNewsImage,
                        onClearImage: viewModel.clearNewsImage,
                        onImageSelectionFailed: viewModel.reportImageSelectionFailed,
                        onCameraPermissionDenied: viewModel.reportCameraPermissionDenied,
                        onCameraUnavailable: viewModel.reportCameraUnavailable,
                        placesActionsBesideImage: true
                    )

                    Toggle(LocalizedStringKey(AccessL10nKey.newsFieldActive), isOn: newsArchived)
                }
                .padding(.bottom, ReguertaFloatingActionButtonLayout.scrollContentBottomPadding)
            }

            reguertaFloatingActionButton(
                LocalizedStringKey(saveActionKey),
                isEnabled: !viewModel.isSavingNews && !viewModel.isUploadingNewsImage,
                action: saveNews
            )
        }
        .overlay {
            if let confirmation = viewModel.pendingNewsSaveConfirmation {
                reguertaDialog(
                    type: .info,
                    title: l10n(
                        confirmation.isNew
                            ? AccessL10nKey.newsSaveCreatedDialogTitle
                            : AccessL10nKey.newsSaveUpdatedDialogTitle
                    ),
                    message: l10n(
                        confirmation.isNew
                            ? AccessL10nKey.newsSaveCreatedDialogMessage
                            : AccessL10nKey.newsSaveUpdatedDialogMessage
                    ),
                    primaryAction: ReguertaDialogAction(
                        title: AccessL10nKey.commonActionClose,
                        action: closeNewsSaveDialog
                    )
                )
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func uploadNewsImage(_ imageData: Data) {
        Task { await viewModel.uploadNewsImage(imageData) }
    }

    private func saveNews() {
        Task {
            _ = await viewModel.saveNews()
        }
    }

    private func closeNewsSaveDialog() {
        guard viewModel.closeNewsSaveConfirmation() != nil else { return }
        onSaveSuccess()
    }
}

struct NotificationsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: NewsNotificationsFeatureViewModel
    let notificationDateText: (NotificationEvent) -> String

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: tokens.spacing.lg) {
                if viewModel.isLoadingNotifications {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsLoading))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                } else if viewModel.notificationsFeed.isEmpty {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.feedbackError)
                } else {
                    ForEach(viewModel.notificationListItems) { item in
                        NotificationListItemView(
                            tokens: tokens,
                            item: item,
                            dateText: notificationDateText(item.notification)
                        )
                    }
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

private struct NotificationListItemView: View {
    let tokens: ReguertaDesignTokens
    let item: NotificationListItem
    let dateText: String

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(dateText)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)

            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                    Image(systemName: item.notification.iconSystemName)
                        .foregroundStyle(tokens.colors.textPrimary)
                        .accessibilityHidden(true)
                    Text(item.notification.title)
                        .font(tokens.typography.titleCard)
                        .foregroundStyle(tokens.colors.textPrimary)
                }

                Text(item.notification.body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
            }
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(notificationBackgroundColor)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle.opacity(0.55), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
            .accessibilityElement(children: .combine)
        }
    }

    private var notificationBackgroundColor: Color {
        (item.isRead ? tokens.colors.actionPrimary : tokens.colors.feedbackWarning)
            .opacity(0.15)
    }
}

struct NotificationEditorRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: NewsNotificationsFeatureViewModel
    let onSendSuccess: () -> Void

    private var sendActionKey: String {
        viewModel.isSendingNotification
            ? AccessL10nKey.notificationsSendActionSending
            : AccessL10nKey.notificationsSendActionSend
    }

    private var notificationTitle: Binding<String> {
        Binding(
            get: { viewModel.notificationDraft.title },
            set: { value in
                viewModel.updateNotificationDraft { draft in
                    draft.title = value
                }
            }
        )
    }

    private var notificationBody: Binding<String> {
        Binding(
            get: { viewModel.notificationDraft.body },
            set: { value in
                viewModel.updateNotificationDraft { draft in
                    draft.body = value
                }
            }
        )
    }

    private var notificationAudience: Binding<NotificationAudience> {
        Binding(
            get: { viewModel.notificationDraft.audience },
            set: { value in
                viewModel.updateNotificationDraft { draft in
                    draft.audience = value
                }
            }
        )
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsFieldTitle))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)

                    TextField(
                        "",
                        text: notificationTitle
                    )
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.notificationsFieldTitle)))

                    Text(LocalizedStringKey(AccessL10nKey.notificationsFieldBody))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextEditor(text: notificationBody)
                        .frame(minHeight: 180.resize)
                        .padding(tokens.spacing.sm)
                        .background(tokens.colors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                        .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.notificationsFieldBody)))

                    Text(LocalizedStringKey(AccessL10nKey.notificationsFieldAudience))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Picker(
                        "",
                        selection: notificationAudience
                    ) {
                        ForEach(NotificationAudience.allCases, id: \.self) { audience in
                            Text(LocalizedStringKey(audience.titleKey)).tag(audience)
                        }
                    }
                    .pickerStyle(.menu)
                    .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.notificationsFieldAudience)))
                }
                .padding(.bottom, ReguertaFloatingActionButtonLayout.scrollContentBottomPadding)
            }

            reguertaFloatingActionButton(
                LocalizedStringKey(sendActionKey),
                isEnabled: !viewModel.isSendingNotification,
                action: sendNotification
            )
        }
        .overlay {
            if viewModel.isNotificationSendConfirmationPresented {
                reguertaDialog(
                    type: .info,
                    title: l10n(AccessL10nKey.notificationsSendSuccessDialogTitle),
                    message: l10n(AccessL10nKey.notificationsSendSuccessDialogMessage),
                    primaryAction: ReguertaDialogAction(
                        title: AccessL10nKey.commonActionClose,
                        action: closeNotificationSendDialog
                    )
                )
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func sendNotification() {
        Task {
            _ = await viewModel.sendNotification()
        }
    }

    private func closeNotificationSendDialog() {
        viewModel.closeNotificationSendConfirmation()
        onSendSuccess()
    }
}
