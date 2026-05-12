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
        let allNews = await newsRepository.allNews()
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
        let allNotifications = await notificationRepository.allNotifications()
        guard isCurrentSession(session) else {
            isLoadingNotifications = false
            return
        }
        notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
        isLoadingNotifications = false
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
        isLoadingNotifications = false
    }
}
