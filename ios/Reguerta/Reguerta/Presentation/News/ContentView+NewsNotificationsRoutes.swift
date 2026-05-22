import SwiftUI

struct NewsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: NewsNotificationsFeatureViewModel
    let newsMetaText: (NewsArticle) -> String
    let onCreateNews: () -> Void
    let onEditNews: () -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: tokens.spacing.lg) {
                NewsListHeaderCardView(
                    tokens: tokens,
                    isAdmin: viewModel.canPublishNews,
                    onCreateNews: createNews,
                    onRefreshNews: refreshNews
                )

                if viewModel.isLoadingNews {
                    reguertaCard {
                        Text(LocalizedStringKey(AccessL10nKey.newsLoading))
                            .font(tokens.typography.bodySecondary)
                    }
                } else if viewModel.newsFeed.isEmpty {
                    reguertaCard {
                        Text(LocalizedStringKey(AccessL10nKey.newsEmptyState))
                            .font(tokens.typography.bodySecondary)
                    }
                } else {
                    ForEach(viewModel.newsFeed) { article in
                        NewsArticleCardView(
                            tokens: tokens,
                            article: article,
                            isAdmin: viewModel.canPublishNews,
                            newsMetaText: newsMetaText,
                            onEditNews: editNews,
                            onDeleteNews: requestNewsDeletion
                        )
                    }
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func createNews() {
        if viewModel.startCreatingNews() {
            onCreateNews()
        }
    }

    private func refreshNews() {
        Task { await viewModel.refreshNews() }
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

private struct NewsListHeaderCardView: View {
    let tokens: ReguertaDesignTokens
    let isAdmin: Bool
    let onCreateNews: () -> Void
    let onRefreshNews: () -> Void

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(LocalizedStringKey(AccessL10nKey.newsListSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if isAdmin {
                    reguertaButton(LocalizedStringKey(AccessL10nKey.newsCreateAction), action: onCreateNews)
                }
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.newsRefreshAction),
                    variant: .text,
                    action: onRefreshNews
                )
            }
        }
    }
}

private struct NewsArticleCardView: View {
    let tokens: ReguertaDesignTokens
    let article: NewsArticle
    let isAdmin: Bool
    let newsMetaText: (NewsArticle) -> String
    let onEditNews: (String) -> Void
    let onDeleteNews: (String) -> Void

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(article.title)
                    .font(tokens.typography.titleCard)
                Text(newsMetaText(article))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                if !article.active {
                    Text(LocalizedStringKey(AccessL10nKey.newsInactiveBadge))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                Text(article.body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
                if let urlImage = article.urlImage {
                    Text(urlImage)
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                if isAdmin {
                    HStack {
                        reguertaButton(
                            LocalizedStringKey(AccessL10nKey.newsEditAction),
                            variant: .text,
                            fullWidth: false
                        ) {
                            onEditNews(article.id)
                        }
                        reguertaButton(
                            LocalizedStringKey(AccessL10nKey.newsDeleteAction),
                            variant: .text,
                            fullWidth: false
                        ) {
                            onDeleteNews(article.id)
                        }
                    }
                }
            }
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

    private var newsActive: Binding<Bool> {
        Binding(
            get: { viewModel.newsDraft.active },
            set: { value in
                viewModel.updateNewsDraft { draft in
                    draft.active = value
                }
            }
        )
    }

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(LocalizedStringKey(AccessL10nKey.newsEditorSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

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
                    onCameraUnavailable: viewModel.reportCameraUnavailable
                )

                TextField(
                    "",
                    text: newsTitle,
                    prompt: Text(LocalizedStringKey(AccessL10nKey.newsFieldTitle))
                )
                .textFieldStyle(.roundedBorder)

                Text(LocalizedStringKey(AccessL10nKey.newsFieldBody))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(text: newsBody)
                    .frame(minHeight: 180.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                Toggle(LocalizedStringKey(AccessL10nKey.newsFieldActive), isOn: newsActive)

                reguertaButton(
                    LocalizedStringKey(saveActionKey),
                    isEnabled: !viewModel.isSavingNews && !viewModel.isUploadingNewsImage,
                    isLoading: viewModel.isSavingNews,
                    action: saveNews
                )

                Spacer(minLength: tokens.spacing.sm)
            }
        }
    }

    private func uploadNewsImage(_ imageData: Data) {
        Task { await viewModel.uploadNewsImage(imageData) }
    }

    private func saveNews() {
        Task {
            if await viewModel.saveNews() {
                onSaveSuccess()
            }
        }
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
        ScrollView(.vertical, showsIndicators: false) {
            reguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsEditorSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    TextField(
                        "",
                        text: notificationTitle,
                        prompt: Text(LocalizedStringKey(AccessL10nKey.notificationsFieldTitle))
                    )
                    .textFieldStyle(.roundedBorder)

                    Text(LocalizedStringKey(AccessL10nKey.notificationsFieldBody))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextEditor(text: notificationBody)
                        .frame(minHeight: 180.resize)
                        .padding(tokens.spacing.sm)
                        .background(tokens.colors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                    Picker(
                        LocalizedStringKey(AccessL10nKey.notificationsFieldAudience),
                        selection: notificationAudience
                    ) {
                        ForEach(NotificationAudience.allCases, id: \.self) { audience in
                            Text(LocalizedStringKey(audience.titleKey)).tag(audience)
                        }
                    }

                    reguertaButton(
                        LocalizedStringKey(sendActionKey),
                        isEnabled: !viewModel.isSendingNotification,
                        isLoading: viewModel.isSendingNotification,
                        action: sendNotification
                    )
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func sendNotification() {
        Task {
            if await viewModel.sendNotification() {
                onSendSuccess()
            }
        }
    }
}
