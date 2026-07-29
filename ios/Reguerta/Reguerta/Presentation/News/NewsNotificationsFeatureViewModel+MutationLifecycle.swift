import Foundation

extension NewsNotificationsFeatureViewModel {
    func invalidateNewsImageUploadForEditorTransition() {
        newsEditorRevision &+= 1
        activeNewsImageUploadOperationId = nil
        isUploadingNewsImage = false
        pendingNewsSaveConfirmation = nil
    }

    func invalidateNotificationEditorTransition() {
        notificationEditorRevision &+= 1
        isNotificationSendConfirmationPresented = false
    }

    func beginNewsImageUploadOperation() -> UInt64? {
        guard activeNewsImageUploadOperationId == nil else { return nil }
        nextNewsImageUploadOperationId &+= 1
        activeNewsImageUploadOperationId = nextNewsImageUploadOperationId
        isUploadingNewsImage = true
        return nextNewsImageUploadOperationId
    }

    func isCurrentNewsImageUpload(
        _ operationId: UInt64,
        editorRevision: UInt64,
        editorNewsID: String?,
        context: SessionContext
    ) -> Bool {
        activeNewsImageUploadOperationId == operationId &&
            newsEditorRevision == editorRevision &&
            editingNewsId == editorNewsID &&
            isCurrentSession(context)
    }

    func finishNewsImageUploadOperation(
        _ operationId: UInt64,
        editorRevision: UInt64,
        editorNewsID: String?,
        context: SessionContext
    ) {
        guard activeNewsImageUploadOperationId == operationId else { return }
        activeNewsImageUploadOperationId = nil
        guard newsEditorRevision == editorRevision,
              editingNewsId == editorNewsID,
              isCurrentSession(context) else {
            return
        }
        isUploadingNewsImage = false
    }

    func invalidateNewsRefreshForConfirmedMutation() {
        activeNewsRefreshOperationId = nil
        isLoadingNews = false
    }

    func invalidateNotificationsRefreshForConfirmedMutation() {
        activeNotificationsRefreshOperationId = nil
        isLoadingNotifications = false
    }

    func newsArticleForSave(
        draft: NewsDraft,
        existing: NewsArticle?,
        editorNewsID: String?,
        context: SessionContext
    ) -> NewsArticle {
        NewsArticle(
            id: editorNewsID ?? "",
            title: draft.title,
            body: draft.body,
            active: draft.active,
            publishedBy: context.session.member.displayName,
            publishedByUserId: context.memberID,
            publishedAtMillis: existing?.publishedAtMillis ?? nowMillisProvider(),
            urlImage: draft.normalizedImageURL
        )
    }

    func notificationEventForSend(
        draft: NotificationDraft,
        context: SessionContext
    ) -> NotificationEvent {
        NotificationEvent(
            id: "",
            title: draft.title,
            body: draft.body,
            type: "admin_broadcast",
            target: draft.audience.targetValue,
            userIds: [],
            segmentType: draft.audience.segmentType,
            targetRole: draft.audience.targetRole,
            createdBy: context.memberID,
            sentAtMillis: nowMillisProvider(),
            weekKey: nil
        )
    }

    func beginNewsMutationOperation(isSaving: Bool) -> UInt64? {
        guard activeNewsMutationOperationId == nil else { return nil }
        nextNewsMutationOperationId &+= 1
        activeNewsMutationOperationId = nextNewsMutationOperationId
        if isSaving {
            isSavingNews = true
        }
        return nextNewsMutationOperationId
    }

    func isCurrentNewsMutation(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeNewsMutationOperationId == operationId && isCurrentSession(context)
    }

    func finishNewsMutationOperation(_ operationId: UInt64, context: SessionContext) {
        guard activeNewsMutationOperationId == operationId else { return }
        activeNewsMutationOperationId = nil
        guard isCurrentSession(context) else { return }
        isSavingNews = false
    }

    func beginNotificationMutationOperation() -> UInt64? {
        guard activeNotificationMutationOperationId == nil else { return nil }
        nextNotificationMutationOperationId &+= 1
        activeNotificationMutationOperationId = nextNotificationMutationOperationId
        isSendingNotification = true
        return nextNotificationMutationOperationId
    }

    func isCurrentNotificationMutation(
        _ operationId: UInt64,
        context: SessionContext
    ) -> Bool {
        activeNotificationMutationOperationId == operationId && isCurrentSession(context)
    }

    func finishNotificationMutationOperation(
        _ operationId: UInt64,
        context: SessionContext
    ) {
        guard activeNotificationMutationOperationId == operationId else { return }
        activeNotificationMutationOperationId = nil
        guard isCurrentSession(context) else { return }
        isSendingNotification = false
    }

    func applyConfirmedNewsSave(
        _ saved: NewsArticle,
        existing: NewsArticle?,
        editorOwnership: NewsMutationEditorOwnership,
        mutationOperationId: UInt64,
        context: SessionContext
    ) -> Bool {
        invalidateNewsRefreshForConfirmedMutation()
        upsertConfirmedNews(saved, member: context.session.member)
        let ownsEditor = isCurrentNewsMutationEditor(editorOwnership)
        let convergenceOwnership: NewsMutationEditorOwnership
        if ownsEditor {
            newsDraft = saved.toDraft()
            editingNewsId = saved.id
            pendingNewsSaveConfirmation = NewsSaveConfirmation(
                newsId: saved.id,
                isNew: existing == nil
            )
            convergenceOwnership = captureNewsMutationEditorOwnership()
        } else {
            convergenceOwnership = editorOwnership
        }
        finishNewsMutationOperation(mutationOperationId, context: context)
        scheduleNewsConvergence(feedbackOwnership: .editor(convergenceOwnership))
        return ownsEditor
    }

    func applyConfirmedNotificationSend(
        _ sent: NotificationEvent,
        editorOwnership: NotificationMutationEditorOwnership,
        mutationOperationId: UInt64,
        context: SessionContext
    ) -> Bool {
        invalidateNotificationsRefreshForConfirmedMutation()
        upsertConfirmedNotification(sent, member: context.session.member)
        let ownsEditor = isCurrentNotificationMutationEditor(editorOwnership)
        let convergenceOwnership: NotificationMutationEditorOwnership
        if ownsEditor {
            notificationDraft = NotificationDraft()
            isNotificationSendConfirmationPresented = true
            convergenceOwnership = captureNotificationMutationEditorOwnership()
        } else {
            convergenceOwnership = editorOwnership
        }
        finishNotificationMutationOperation(mutationOperationId, context: context)
        scheduleNotificationsConvergence(feedbackOwnership: convergenceOwnership)
        return ownsEditor
    }

    func scheduleNewsConvergence(
        feedbackOwnership: NewsConvergenceFeedbackOwnership
    ) {
        Task { [weak self] in
            await self?.refreshNews(failureFeedbackOwnership: feedbackOwnership)
        }
    }

    func scheduleNotificationsConvergence(
        feedbackOwnership: NotificationMutationEditorOwnership
    ) {
        Task { [weak self] in
            await self?.refreshNotifications(failureFeedbackOwnership: feedbackOwnership)
        }
    }

    func captureNewsMutationEditorOwnership() -> NewsMutationEditorOwnership {
        NewsMutationEditorOwnership(
            editorRevision: newsEditorRevision,
            draftRevision: newsDraftRevision,
            newsID: editingNewsId
        )
    }

    func isCurrentNewsMutationEditor(_ ownership: NewsMutationEditorOwnership) -> Bool {
        captureNewsMutationEditorOwnership() == ownership
    }

    func captureNotificationMutationEditorOwnership() -> NotificationMutationEditorOwnership {
        NotificationMutationEditorOwnership(
            editorRevision: notificationEditorRevision,
            draftRevision: notificationDraftRevision
        )
    }

    func isCurrentNotificationMutationEditor(
        _ ownership: NotificationMutationEditorOwnership
    ) -> Bool {
        captureNotificationMutationEditorOwnership() == ownership
    }

    func isCurrentNewsDeletion(_ ownership: NewsDeletionOwnership) -> Bool {
        newsDeletionRevision == ownership.revision &&
            pendingNewsDeletionId == ownership.newsID
    }

    func canPublishNewsConvergenceFeedback(
        for ownership: NewsConvergenceFeedbackOwnership
    ) -> Bool {
        switch ownership {
        case .editor(let editorOwnership):
            isCurrentNewsMutationEditor(editorOwnership)
        case .deletion(let deletionOwnership):
            newsDeletionRevision == deletionOwnership.revision
        }
    }
}
