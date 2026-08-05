import Foundation

extension NewsNotificationsFeatureViewModel {
    func updateNewsDraft(
        _ update: (inout NewsDraft) -> Void
    ) {
        var draft = newsDraft
        update(&draft)
        guard draft != newsDraft else { return }
        newsDraft = draft
        newsDraftRevision &+= 1
    }

    func updateNotificationDraft(
        _ update: (inout NotificationDraft) -> Void
    ) {
        var draft = notificationDraft
        update(&draft)
        guard draft != notificationDraft else { return }
        notificationDraft = draft
        notificationDraftRevision &+= 1
    }

    @discardableResult func startCreatingNews() -> Bool {
        guard let context = captureAuthorizedSessionContext() else { return false }
        guard context.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminPublishNews)
            return false
        }

        invalidateNewsImageUploadForEditorTransition()
        newsDraft = NewsDraft()
        editingNewsId = nil
        return true
    }

    @discardableResult func startEditingNews(newsId: String) -> Bool {
        guard let context = captureAuthorizedSessionContext() else { return false }
        guard context.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminEditNews)
            return false
        }
        guard let article = newsFeed.first(where: { $0.id == newsId }) else {
            return false
        }

        invalidateNewsImageUploadForEditorTransition()
        newsDraft = article.toDraft()
        editingNewsId = article.id
        return true
    }

    func clearNewsEditor() {
        invalidateNewsImageUploadForEditorTransition()
        newsDraft = NewsDraft()
        editingNewsId = nil
    }

    @discardableResult func closeNewsSaveConfirmation() -> String? {
        guard let confirmation = pendingNewsSaveConfirmation else { return nil }
        pendingNewsSaveConfirmation = nil
        clearNewsEditor()
        highlightNews(confirmation.newsId)
        return confirmation.newsId
    }

    @discardableResult func startCreatingNotification() -> Bool {
        guard let context = captureAuthorizedSessionContext() else { return false }
        guard context.canSendAdminNotifications else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminSendNotification)
            return false
        }

        invalidateNotificationEditorTransition()
        notificationDraft = NotificationDraft()
        return true
    }

    func clearNotificationEditor() {
        invalidateNotificationEditorTransition()
        notificationDraft = NotificationDraft()
    }

    func closeNotificationSendConfirmation() {
        guard isNotificationSendConfirmationPresented else { return }
        isNotificationSendConfirmationPresented = false
        clearNotificationEditor()
    }

    func dismissPushNotificationPermissionDialog() {
        showsPushNotificationPermissionDialog = false
        didDismissPushNotificationPermissionDialogForVisit = true
    }

    func openPushNotificationSettings() {
        showsPushNotificationPermissionDialog = false
        didDismissPushNotificationPermissionDialogForVisit = true
        pushNotificationPermissionProvider.openSettings()
    }

    func requestNewsDeletion(newsId: String) {
        newsDeletionRevision &+= 1
        pendingNewsDeletionId = newsId
    }

    func clearPendingNewsDeletion() {
        newsDeletionRevision &+= 1
        pendingNewsDeletionId = nil
    }

    func saveNews() async -> Bool {
        guard let context = captureAuthorizedSessionContext() else { return false }
        guard context.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminPublishNews)
            return false
        }
        let normalizedDraft = newsDraft.normalized
        guard !normalizedDraft.title.isEmpty, !normalizedDraft.body.isEmpty else {
            feedbackCenter.show(AccessL10nKey.feedbackNewsTitleBodyRequired)
            return false
        }
        guard !isUploadingNewsImage,
              let mutationOperationId = beginNewsMutationOperation(isSaving: true) else {
            return false
        }

        let editorOwnership = captureNewsMutationEditorOwnership()
        let existing = newsFeed.first(where: { $0.id == editorOwnership.newsID })
        let article = newsArticleForSave(
            draft: normalizedDraft,
            existing: existing,
            editorNewsID: editorOwnership.newsID,
            context: context
        )
        let saved: NewsArticle
        do {
            saved = try await newsRepository.upsert(article: article)
            try Task.checkCancellation()
        } catch is CancellationError {
            finishNewsMutationOperation(mutationOperationId, context: context)
            return false
        } catch {
            if isCurrentNewsMutation(mutationOperationId, context: context),
               isCurrentNewsMutationEditor(editorOwnership) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            finishNewsMutationOperation(mutationOperationId, context: context)
            return false
        }
        guard isCurrentNewsMutation(mutationOperationId, context: context) else {
            finishNewsMutationOperation(mutationOperationId, context: context)
            return false
        }

        return applyConfirmedNewsSave(
            saved,
            existing: existing,
            editorOwnership: editorOwnership,
            mutationOperationId: mutationOperationId,
            context: context
        )
    }

    func confirmNewsDeletion() async {
        guard let context = captureAuthorizedSessionContext() else { return }
        guard context.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminDeleteNews)
            return
        }
        guard let newsId = pendingNewsDeletionId,
              let mutationOperationId = beginNewsMutationOperation(isSaving: false) else {
            return
        }
        let deletionOwnership = NewsDeletionOwnership(
            revision: newsDeletionRevision,
            newsID: newsId
        )

        let deleted: Bool
        do {
            deleted = try await newsRepository.delete(newsId: newsId)
            try Task.checkCancellation()
        } catch is CancellationError {
            finishNewsMutationOperation(mutationOperationId, context: context)
            return
        } catch {
            if isCurrentNewsMutation(mutationOperationId, context: context),
               isCurrentNewsDeletion(deletionOwnership) {
                feedbackCenter.show(AccessL10nKey.feedbackNewsDeleteFailed)
            }
            finishNewsMutationOperation(mutationOperationId, context: context)
            return
        }
        guard deleted, isCurrentNewsMutation(mutationOperationId, context: context) else {
            if isCurrentNewsMutation(mutationOperationId, context: context),
               isCurrentNewsDeletion(deletionOwnership) {
                feedbackCenter.show(AccessL10nKey.feedbackNewsDeleteFailed)
            }
            finishNewsMutationOperation(mutationOperationId, context: context)
            return
        }

        invalidateNewsRefreshForConfirmedMutation()
        removeConfirmedNews(newsID: newsId)
        if editingNewsId == newsId {
            clearNewsEditor()
        }
        if isCurrentNewsDeletion(deletionOwnership) {
            pendingNewsDeletionId = nil
            feedbackCenter.show(AccessL10nKey.feedbackNewsDeleted)
        }
        finishNewsMutationOperation(mutationOperationId, context: context)
        scheduleNewsConvergence(feedbackOwnership: .deletion(deletionOwnership))
    }

    func sendNotification() async -> Bool {
        guard let context = captureAuthorizedSessionContext() else { return false }
        guard context.canSendAdminNotifications else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminSendNotification)
            return false
        }
        let normalizedDraft = notificationDraft.normalized
        guard !normalizedDraft.title.isEmpty, !normalizedDraft.body.isEmpty else {
            feedbackCenter.show(AccessL10nKey.feedbackNotificationTitleBodyRequired)
            return false
        }
        guard let mutationOperationId = beginNotificationMutationOperation() else { return false }

        let editorOwnership = captureNotificationMutationEditorOwnership()
        let event = notificationEventForSend(draft: normalizedDraft, context: context)
        let sent: NotificationEvent
        do {
            sent = try await notificationRepository.send(event: event)
            try Task.checkCancellation()
        } catch is CancellationError {
            finishNotificationMutationOperation(mutationOperationId, context: context)
            return false
        } catch {
            if isCurrentNotificationMutation(mutationOperationId, context: context),
               isCurrentNotificationMutationEditor(editorOwnership) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            finishNotificationMutationOperation(mutationOperationId, context: context)
            return false
        }
        guard isCurrentNotificationMutation(mutationOperationId, context: context) else {
            finishNotificationMutationOperation(mutationOperationId, context: context)
            return false
        }

        return applyConfirmedNotificationSend(
            sent,
            editorOwnership: editorOwnership,
            mutationOperationId: mutationOperationId,
            context: context
        )
    }

    func uploadNewsImage(_ imageData: Data) async {
        guard let context = captureAuthorizedSessionContext() else { return }
        guard context.canPublishNews else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminPublishNews)
            return
        }
        guard activeNewsMutationOperationId == nil, !isSavingNews else { return }
        let editorRevision = newsEditorRevision
        let editorNewsID = editingNewsId
        guard let operationId = beginNewsImageUploadOperation() else { return }
        defer {
            finishNewsImageUploadOperation(
                operationId,
                editorRevision: editorRevision,
                editorNewsID: editorNewsID,
                context: context
            )
        }
        let entityId = editorNewsID?.isEmpty == false ? editorNewsID : nil

        do {
            let uploaded = try await imagePipelineManager.processAndUpload(
                imageData: imageData,
                request: ImageUploadRequest(
                    ownerId: context.memberID,
                    namespace: .news,
                    entityId: entityId,
                    nameHint: newsDraft.title
                )
            )
            try Task.checkCancellation()
            guard isCurrentNewsImageUpload(
                operationId,
                editorRevision: editorRevision,
                editorNewsID: editorNewsID,
                context: context
            ) else {
                return
            }
            updateNewsDraft { $0.urlImage = uploaded.downloadURL }
        } catch is CancellationError {
            return
        } catch {
            if isCurrentNewsImageUpload(
                operationId,
                editorRevision: editorRevision,
                editorNewsID: editorNewsID,
                context: context
            ) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
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

    func highlightNews(_ newsId: String) {
        highlightedNewsId = newsId
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            await MainActor.run {
                if self?.highlightedNewsId == newsId {
                    self?.highlightedNewsId = nil
                }
            }
        }
    }
}
