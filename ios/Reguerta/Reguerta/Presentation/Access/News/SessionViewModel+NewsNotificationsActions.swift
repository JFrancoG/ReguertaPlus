import Foundation

extension SessionViewModel {
    func updateNewsDraft(_ update: (inout NewsDraft) -> Void) {
        var draft = newsDraft
        update(&draft)
        newsDraft = draft
    }

    func updateNotificationDraft(_ update: (inout NotificationDraft) -> Void) {
        var draft = notificationDraft
        update(&draft)
        notificationDraft = draft
    }

    func startCreatingNews() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canPublishNews else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminPublishNews
            return
        }

        newsDraft = NewsDraft()
        editingNewsId = nil
    }

    func startEditingNews(newsId: String) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canPublishNews else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminEditNews
            return
        }
        guard let article = newsFeed.first(where: { $0.id == newsId }) else { return }

        newsDraft = NewsDraft(
            title: article.title,
            body: article.body,
            urlImage: article.urlImage ?? "",
            active: article.active
        )
        editingNewsId = article.id
    }

    func clearNewsEditor() {
        newsDraft = NewsDraft()
        editingNewsId = nil
        isSavingNews = false
    }

    func startCreatingNotification() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canSendAdminNotifications else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminSendNotification
            return
        }

        notificationDraft = NotificationDraft()
        isSendingNotification = false
    }

    func clearNotificationEditor() {
        notificationDraft = NotificationDraft()
        isSendingNotification = false
    }

    func refreshNews() {
        guard case .authorized(let session) = mode else { return }
        isLoadingNews = true
        Task { @MainActor in
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = session.member.canPublishNews ? allNews : allNews.filter(\.active)
            isLoadingNews = false
        }
    }

    func refreshNotifications() {
        guard case .authorized(let session) = mode else { return }
        isLoadingNotifications = true
        Task { @MainActor in
            let allNotifications = await notificationRepository.allNotifications()
            notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
            isLoadingNotifications = false
        }
    }

    func saveNews(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canPublishNews else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminPublishNews
            return
        }
        guard !newsDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !newsDraft.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackNewsTitleBodyRequired
            return
        }

        isSavingNews = true
        Task { @MainActor in
            let existing = newsFeed.first(where: { $0.id == editingNewsId })
            let saved = await newsRepository.upsert(
                article: NewsArticle(
                    id: editingNewsId ?? "",
                    title: newsDraft.title.trimmingCharacters(in: .whitespacesAndNewlines),
                    body: newsDraft.body.trimmingCharacters(in: .whitespacesAndNewlines),
                    active: newsDraft.active,
                    publishedBy: existing?.publishedBy ?? session.member.displayName,
                    publishedAtMillis: existing?.publishedAtMillis ?? nowMillisProvider(),
                    urlImage: {
                        let trimmed = newsDraft.urlImage.trimmingCharacters(in: .whitespacesAndNewlines)
                        return trimmed.isEmpty ? nil : trimmed
                    }()
                )
            )
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = allNews
            newsDraft = NewsDraft(
                title: saved.title,
                body: saved.body,
                urlImage: saved.urlImage ?? "",
                active: saved.active
            )
            editingNewsId = saved.id
            isSavingNews = false
            feedbackMessageKey = existing == nil ? AccessL10nKey.feedbackNewsCreated : AccessL10nKey.feedbackNewsUpdated
            onSuccess()
        }
    }

    func deleteNews(newsId: String, onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canPublishNews else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminDeleteNews
            return
        }

        Task { @MainActor in
            let deleted = await newsRepository.delete(newsId: newsId)
            guard deleted else {
                feedbackMessageKey = AccessL10nKey.feedbackNewsDeleteFailed
                return
            }
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = allNews
            if editingNewsId == newsId {
                clearNewsEditor()
            }
            feedbackMessageKey = AccessL10nKey.feedbackNewsDeleted
            onSuccess()
        }
    }

    func sendNotification(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.canSendAdminNotifications else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminSendNotification
            return
        }
        guard !notificationDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !notificationDraft.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackNotificationTitleBodyRequired
            return
        }

        isSendingNotification = true
        Task { @MainActor in
            _ = await notificationRepository.send(
                event: NotificationEvent(
                    id: "",
                    title: notificationDraft.title.trimmingCharacters(in: .whitespacesAndNewlines),
                    body: notificationDraft.body.trimmingCharacters(in: .whitespacesAndNewlines),
                    type: "admin_broadcast",
                    target: notificationDraft.audience.targetValue,
                    userIds: [],
                    segmentType: notificationDraft.audience.segmentType,
                    targetRole: notificationDraft.audience.targetRole,
                    createdBy: session.member.id,
                    sentAtMillis: nowMillisProvider(),
                    weekKey: nil
                )
            )
            let allNotifications = await notificationRepository.allNotifications()
            notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
            notificationDraft = NotificationDraft()
            isSendingNotification = false
            feedbackMessageKey = AccessL10nKey.feedbackNotificationSent
            onSuccess()
        }
    }
}

private extension NotificationAudience {
    var targetValue: String {
        switch self {
        case .all:
            return "all"
        case .members, .producers, .admins:
            return "segment"
        }
    }

    var segmentType: String? {
        switch self {
        case .all:
            return nil
        case .members, .producers, .admins:
            return "role"
        }
    }

    var targetRole: MemberRole? {
        switch self {
        case .all:
            return nil
        case .members:
            return .member
        case .producers:
            return .producer
        case .admins:
            return .admin
        }
    }
}
