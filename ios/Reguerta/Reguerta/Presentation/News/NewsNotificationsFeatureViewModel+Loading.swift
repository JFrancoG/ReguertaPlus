import Foundation

extension NewsNotificationsFeatureViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let previousMemberId = currentMember?.id
            currentSession = session
            currentMember = session.member
            if previousMemberId != session.member.id {
                clearNewsEditor()
                clearNotificationEditor()
                pendingNewsDeletionId = nil
            }
            Task {
                await refreshNews()
                await refreshNotifications()
            }
        case .signedOut, .unauthorized:
            reset()
        }
    }

    func refreshNews() async {
        guard let session = authorizedSession else {
            resetNewsFeed()
            return
        }

        isLoadingNews = true
        let allNews: [NewsArticle]
        do {
            allNews = try await newsRepository.news(visibleTo: session.member)
        } catch {
            feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            isLoadingNews = false
            return
        }
        guard isCurrentSession(session) else {
            isLoadingNews = false
            return
        }
        applyNewsSnapshot(allNews, member: session.member)
        isLoadingNews = false
        isUploadingNewsImage = false
    }

    func refreshNotifications() async {
        guard let session = authorizedSession else {
            resetNotificationsFeed()
            return
        }

        isLoadingNotifications = true
        let allNotifications: [NotificationEvent]
        let readNotificationIds: Set<String>
        do {
            async let allNotificationsResult = notificationRepository.notifications(visibleTo: session.member)
            async let readNotificationIdsResult = notificationRepository.readNotificationIds(memberId: session.member.id)
            (allNotifications, readNotificationIds) = try await (
                allNotificationsResult,
                readNotificationIdsResult
            )
        } catch {
            feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            isLoadingNotifications = false
            return
        }
        guard isCurrentSession(session) else {
            isLoadingNotifications = false
            return
        }
        notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
        self.readNotificationIds = readNotificationIds
        isLoadingNotifications = false
    }

    func prepareNotificationsRoute() async {
        didDismissPushNotificationPermissionDialogForVisit = false
        await refreshNotifications()
        await refreshPushNotificationPermission(showDialogIfInactive: true)
    }

    func refreshPushNotificationPermission(showDialogIfInactive: Bool) async {
        let isActive = await pushNotificationPermissionProvider.isPushNotificationPermissionActive()
        isPushNotificationPermissionActive = isActive
        if showDialogIfInactive, !isActive, !didDismissPushNotificationPermissionDialogForVisit {
            showsPushNotificationPermissionDialog = true
        }
    }

    func markVisibleNotificationsReadOnExit() async {
        guard let session = authorizedSession else { return }
        let unreadIds = notificationsFeed
            .map(\.id)
            .filter { !readNotificationIds.contains($0) }
        guard !unreadIds.isEmpty else { return }

        do {
            try await notificationRepository.markNotificationsRead(
                memberId: session.member.id,
                notificationIds: unreadIds,
                readAtMillis: nowMillisProvider()
            )
        } catch {
            feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            return
        }
        guard isCurrentSession(session) else { return }
        readNotificationIds.formUnion(unreadIds)
    }
}

extension NewsNotificationsFeatureViewModel {
    var authorizedSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    func reset() {
        currentSession = nil
        currentMember = nil
        resetNewsFeed()
        resetNotificationsFeed()
        newsDraft = NewsDraft()
        notificationDraft = NotificationDraft()
        editingNewsId = nil
        pendingNewsDeletionId = nil
        pendingNewsSaveConfirmation = nil
        isNotificationSendConfirmationPresented = false
        highlightedNewsId = nil
        isSavingNews = false
        isUploadingNewsImage = false
        isSendingNotification = false
    }

    func isCurrentSession(_ session: AuthorizedSession) -> Bool {
        guard let latestSession = authorizedSession else { return false }
        return latestSession.principal.uid == session.principal.uid &&
            latestSession.member.id == session.member.id
    }

    func applyNewsSnapshot(_ allNews: [NewsArticle], member: Member) {
        latestNews = Array(allNews.filter(\.active).prefix(3))
        newsFeed = member.canPublishNews ? allNews : allNews.filter(\.active)
    }

    func resetNewsFeed() {
        latestNews = []
        newsFeed = []
        isLoadingNews = false
    }

    func resetNotificationsFeed() {
        notificationsFeed = []
        readNotificationIds = []
        isLoadingNotifications = false
        isPushNotificationPermissionActive = true
        showsPushNotificationPermissionDialog = false
        didDismissPushNotificationPermissionDialogForVisit = false
    }
}
