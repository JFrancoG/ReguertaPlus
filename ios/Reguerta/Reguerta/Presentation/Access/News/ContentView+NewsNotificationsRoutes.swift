import SwiftUI

struct NewsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let isLoadingNews: Bool
    let newsFeed: [NewsArticle]
    let isAdmin: Bool
    let newsMetaText: (NewsArticle) -> String
    let onCreateNews: () -> Void
    let onRefreshNews: () -> Void
    let onEditNews: (String) -> Void
    let onDeleteNews: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            NewsListHeaderCardView(
                tokens: tokens,
                isAdmin: isAdmin,
                onCreateNews: onCreateNews,
                onRefreshNews: onRefreshNews
            )

            if isLoadingNews {
                ReguertaCard {
                    Text(LocalizedStringKey(AccessL10nKey.newsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if newsFeed.isEmpty {
                ReguertaCard {
                    Text(LocalizedStringKey(AccessL10nKey.newsEmptyState))
                        .font(tokens.typography.bodySecondary)
                }
            } else {
                ForEach(newsFeed) { article in
                    NewsArticleCardView(
                        tokens: tokens,
                        article: article,
                        isAdmin: isAdmin,
                        newsMetaText: newsMetaText,
                        onEditNews: onEditNews,
                        onDeleteNews: onDeleteNews
                    )
                }
            }
        }
    }
}

private struct NewsListHeaderCardView: View {
    let tokens: ReguertaDesignTokens
    let isAdmin: Bool
    let onCreateNews: () -> Void
    let onRefreshNews: () -> Void

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(LocalizedStringKey(AccessL10nKey.homeShellNewsTitle))
                    .font(tokens.typography.titleCard)
                Text(LocalizedStringKey(AccessL10nKey.newsListSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if isAdmin {
                    ReguertaButton(LocalizedStringKey(AccessL10nKey.newsCreateAction), action: onCreateNews)
                }
                ReguertaButton(
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
        ReguertaCard {
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
                        ReguertaButton(
                            LocalizedStringKey(AccessL10nKey.newsEditAction),
                            variant: .text,
                            fullWidth: false
                        ) {
                            onEditNews(article.id)
                        }
                        ReguertaButton(
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
    let editingNewsId: String?
    @Binding var newsTitle: String
    let newsImageURL: String
    @Binding var newsBody: String
    @Binding var newsActive: Bool
    let isSavingNews: Bool
    let isUploadingNewsImage: Bool
    let onPickNewsImage: (Data) -> Void
    let onClearNewsImage: () -> Void
    let onImageSelectionFailed: () -> Void
    let onCameraPermissionDenied: () -> Void
    let onCameraUnavailable: () -> Void
    let onSave: () -> Void
    let onBack: () -> Void

    private var editorTitleKey: String {
        editingNewsId == nil
            ? AccessL10nKey.newsEditorTitleCreate
            : AccessL10nKey.newsEditorTitleEdit
    }

    private var saveActionKey: String {
        if isSavingNews {
            return AccessL10nKey.newsSaveActionSaving
        }
        return editingNewsId == nil
            ? AccessL10nKey.newsSaveActionCreate
            : AccessL10nKey.newsSaveActionUpdate
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(LocalizedStringKey(editorTitleKey))
                    .font(tokens.typography.titleCard)

                Text(LocalizedStringKey(AccessL10nKey.newsEditorSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                ReguertaImagePickerField(
                    tokens: tokens,
                    imageURLString: newsImageURL,
                    isUploading: isUploadingNewsImage,
                    placeholderSystemImage: "photo",
                    subtitleKey: nil,
                    onPickImageData: onPickNewsImage,
                    onClearImage: onClearNewsImage,
                    onImageSelectionFailed: onImageSelectionFailed,
                    onCameraPermissionDenied: onCameraPermissionDenied,
                    onCameraUnavailable: onCameraUnavailable
                )

                TextField(
                    "",
                    text: $newsTitle,
                    prompt: Text(LocalizedStringKey(AccessL10nKey.newsFieldTitle))
                )
                .textFieldStyle(.roundedBorder)

                Text(LocalizedStringKey(AccessL10nKey.newsFieldBody))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(text: $newsBody)
                    .frame(minHeight: 180.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                Toggle(LocalizedStringKey(AccessL10nKey.newsFieldActive), isOn: $newsActive)

                ReguertaButton(
                    LocalizedStringKey(saveActionKey),
                    isEnabled: !isSavingNews && !isUploadingNewsImage,
                    isLoading: isSavingNews,
                    action: onSave
                )

                ReguertaButton(
                    LocalizedStringKey(AccessL10nKey.commonBack),
                    variant: .text,
                    action: onBack
                )

                Spacer(minLength: tokens.spacing.sm)
            }
        }
    }
}

struct NotificationsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let isLoadingNotifications: Bool
    let notificationsFeed: [NotificationEvent]
    let isAdmin: Bool
    let notificationMetaText: (NotificationEvent) -> String
    let onCreateNotification: () -> Void
    let onRefreshNotifications: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            NotificationsListHeaderCardView(
                tokens: tokens,
                isAdmin: isAdmin,
                onCreateNotification: onCreateNotification,
                onRefreshNotifications: onRefreshNotifications
            )

            if isLoadingNotifications {
                ReguertaCard {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if notificationsFeed.isEmpty {
                ReguertaCard {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsEmptyState))
                        .font(tokens.typography.bodySecondary)
                }
            } else {
                ForEach(notificationsFeed) { notification in
                    NotificationCardView(
                        tokens: tokens,
                        notification: notification,
                        notificationMetaText: notificationMetaText
                    )
                }
            }
        }
    }
}

private struct NotificationsListHeaderCardView: View {
    let tokens: ReguertaDesignTokens
    let isAdmin: Bool
    let onCreateNotification: () -> Void
    let onRefreshNotifications: () -> Void

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(LocalizedStringKey(AccessL10nKey.homeShellNotifications))
                    .font(tokens.typography.titleCard)
                Text(LocalizedStringKey(AccessL10nKey.notificationsListSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if isAdmin {
                    ReguertaButton(
                        LocalizedStringKey(AccessL10nKey.notificationsCreateAction),
                        action: onCreateNotification
                    )
                }
                ReguertaButton(
                    LocalizedStringKey(AccessL10nKey.notificationsRefreshAction),
                    variant: .text,
                    action: onRefreshNotifications
                )
            }
        }
    }
}

private struct NotificationCardView: View {
    let tokens: ReguertaDesignTokens
    let notification: NotificationEvent
    let notificationMetaText: (NotificationEvent) -> String

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(notification.title)
                    .font(tokens.typography.titleCard)
                Text(notificationMetaText(notification))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                Text(notification.body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(LocalizedStringKey(notification.audienceTitleKey))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.actionPrimary)
            }
        }
    }
}

struct NotificationEditorRouteView: View {
    let tokens: ReguertaDesignTokens
    @Binding var notificationTitle: String
    @Binding var notificationBody: String
    @Binding var notificationAudience: NotificationAudience
    let isSendingNotification: Bool
    let onSend: () -> Void
    let onBack: () -> Void

    private var sendActionKey: String {
        isSendingNotification
            ? AccessL10nKey.notificationsSendActionSending
            : AccessL10nKey.notificationsSendActionSend
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(LocalizedStringKey(AccessL10nKey.notificationsEditorTitle))
                    .font(tokens.typography.titleCard)

                Text(LocalizedStringKey(AccessL10nKey.notificationsEditorSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                TextField(
                    "",
                    text: $notificationTitle,
                    prompt: Text(LocalizedStringKey(AccessL10nKey.notificationsFieldTitle))
                )
                .textFieldStyle(.roundedBorder)

                Text(LocalizedStringKey(AccessL10nKey.notificationsFieldBody))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(text: $notificationBody)
                    .frame(minHeight: 180.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                Picker(
                    LocalizedStringKey(AccessL10nKey.notificationsFieldAudience),
                    selection: $notificationAudience
                ) {
                    ForEach(NotificationAudience.allCases, id: \.self) { audience in
                        Text(LocalizedStringKey(audience.titleKey)).tag(audience)
                    }
                }

                ReguertaButton(
                    LocalizedStringKey(sendActionKey),
                    isEnabled: !isSendingNotification,
                    isLoading: isSendingNotification,
                    action: onSend
                )

                ReguertaButton(
                    LocalizedStringKey(AccessL10nKey.commonBack),
                    variant: .text,
                    action: onBack
                )
            }
        }
    }
}
