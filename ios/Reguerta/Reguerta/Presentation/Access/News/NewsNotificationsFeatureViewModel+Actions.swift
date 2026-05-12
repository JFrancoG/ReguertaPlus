import Foundation

extension NewsNotificationsFeatureViewModel {
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

    @discardableResult
    func startCreatingNews() -> Bool {
        guard let session = authorizedSession else { return false }
        guard session.member.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminPublishNews)
            return false
        }

        newsDraft = NewsDraft()
        editingNewsId = nil
        isUploadingNewsImage = false
        return true
    }

    @discardableResult
    func startEditingNews(newsId: String) -> Bool {
        guard let session = authorizedSession else { return false }
        guard session.member.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminEditNews)
            return false
        }
        guard let article = newsFeed.first(where: { $0.id == newsId }) else { return false }

        newsDraft = article.toDraft()
        editingNewsId = article.id
        isUploadingNewsImage = false
        return true
    }

    func clearNewsEditor() {
        newsDraft = NewsDraft()
        editingNewsId = nil
        isSavingNews = false
        isUploadingNewsImage = false
    }

    @discardableResult
    func startCreatingNotification() -> Bool {
        guard let session = authorizedSession else { return false }
        guard session.member.canSendAdminNotifications else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminSendNotification)
            return false
        }

        notificationDraft = NotificationDraft()
        isSendingNotification = false
        return true
    }

    func clearNotificationEditor() {
        notificationDraft = NotificationDraft()
        isSendingNotification = false
    }

    func requestNewsDeletion(newsId: String) {
        pendingNewsDeletionId = newsId
    }

    func clearPendingNewsDeletion() {
        pendingNewsDeletionId = nil
    }

    func saveNews() async -> Bool {
        guard let session = authorizedSession else { return false }
        guard session.member.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminPublishNews)
            return false
        }
        let normalizedDraft = newsDraft.normalized
        guard !normalizedDraft.title.isEmpty, !normalizedDraft.body.isEmpty else {
            feedbackCenter.show(AccessL10nKey.feedbackNewsTitleBodyRequired)
            return false
        }
        guard !isUploadingNewsImage else { return false }

        isSavingNews = true
        defer { isSavingNews = false }

        let existing = newsFeed.first(where: { $0.id == editingNewsId })
        let saved = await newsRepository.upsert(
            article: NewsArticle(
                id: editingNewsId ?? "",
                title: normalizedDraft.title,
                body: normalizedDraft.body,
                active: normalizedDraft.active,
                publishedBy: existing?.publishedBy ?? session.member.displayName,
                publishedAtMillis: existing?.publishedAtMillis ?? nowMillisProvider(),
                urlImage: normalizedDraft.normalizedImageURL
            )
        )
        let allNews = await newsRepository.allNews()
        guard isCurrentSession(session) else { return false }
        applyNewsSnapshot(allNews, member: session.member)
        newsDraft = saved.toDraft()
        editingNewsId = saved.id
        feedbackCenter.show(
            existing == nil
                ? AccessL10nKey.feedbackNewsCreated
                : AccessL10nKey.feedbackNewsUpdated
        )
        return true
    }

    func confirmNewsDeletion() async {
        guard let session = authorizedSession else { return }
        guard session.member.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminDeleteNews)
            return
        }
        guard let newsId = pendingNewsDeletionId else { return }

        let deleted = await newsRepository.delete(newsId: newsId)
        guard deleted else {
            feedbackCenter.show(AccessL10nKey.feedbackNewsDeleteFailed)
            return
        }
        let allNews = await newsRepository.allNews()
        guard isCurrentSession(session) else { return }
        applyNewsSnapshot(allNews, member: session.member)
        if editingNewsId == newsId {
            clearNewsEditor()
        }
        pendingNewsDeletionId = nil
        feedbackCenter.show(AccessL10nKey.feedbackNewsDeleted)
    }

    func sendNotification() async -> Bool {
        guard let session = authorizedSession else { return false }
        guard session.member.canSendAdminNotifications else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminSendNotification)
            return false
        }
        let normalizedDraft = notificationDraft.normalized
        guard !normalizedDraft.title.isEmpty, !normalizedDraft.body.isEmpty else {
            feedbackCenter.show(AccessL10nKey.feedbackNotificationTitleBodyRequired)
            return false
        }

        isSendingNotification = true
        defer { isSendingNotification = false }

        _ = await notificationRepository.send(
            event: NotificationEvent(
                id: "",
                title: normalizedDraft.title,
                body: normalizedDraft.body,
                type: "admin_broadcast",
                target: normalizedDraft.audience.targetValue,
                userIds: [],
                segmentType: normalizedDraft.audience.segmentType,
                targetRole: normalizedDraft.audience.targetRole,
                createdBy: session.member.id,
                sentAtMillis: nowMillisProvider(),
                weekKey: nil
            )
        )
        let allNotifications = await notificationRepository.allNotifications()
        guard isCurrentSession(session) else { return false }
        notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
        notificationDraft = NotificationDraft()
        feedbackCenter.show(AccessL10nKey.feedbackNotificationSent)
        return true
    }

    func uploadNewsImage(_ imageData: Data) async {
        guard let session = authorizedSession else { return }
        guard session.member.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminPublishNews)
            return
        }

        isUploadingNewsImage = true
        defer { isUploadingNewsImage = false }
        let entityId = editingNewsId?.isEmpty == false ? editingNewsId : nil

        do {
            let uploaded = try await imagePipelineManager.processAndUpload(
                imageData: imageData,
                request: ImageUploadRequest(
                    ownerId: session.member.id,
                    namespace: .news,
                    entityId: entityId,
                    nameHint: newsDraft.title
                )
            )
            newsDraft.urlImage = uploaded.downloadURL
        } catch {
            feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
        }
    }

    func clearNewsImage() {
        updateNewsDraft { draft in
            draft.urlImage = ""
        }
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
