extension NewsNotificationsFeatureViewModel {
    func applyNewsSnapshot(_ allNews: [NewsArticle], member: Member) {
        latestNews = Array(allNews.filter(\.active).prefix(3))
        newsFeed = member.canPublishNews ? allNews : allNews.filter(\.active)
    }

    func applyNotificationsSnapshot(
        _ allNotifications: [NotificationEvent],
        readNotificationIDs: Set<String>,
        member: Member
    ) {
        let serverNotificationIDs = Set(allNotifications.map(\.id))
        pendingConfirmedNotifications = pendingConfirmedNotifications.filter {
            !serverNotificationIDs.contains($0.key) && $0.value.isVisible(to: member)
        }
        var mergedNotifications = allNotifications.filter { $0.isVisible(to: member) }
        let mergedNotificationIDs = Set(mergedNotifications.map(\.id))
        mergedNotifications.append(
            contentsOf: pendingConfirmedNotifications.values.filter {
                !mergedNotificationIDs.contains($0.id)
            }
        )
        notificationsFeed = mergedNotifications.sorted {
            $0.sentAtMillis > $1.sentAtMillis
        }

        pendingConfirmedReadNotificationIds.subtract(readNotificationIDs)
        readNotificationIds = readNotificationIDs.union(
            pendingConfirmedReadNotificationIds
        )
        notificationsStateRevision &+= 1
    }

    func resetNewsFeed() {
        latestNews = []
        newsFeed = []
        isLoadingNews = false
        activeNewsRefreshOperationId = nil
    }

    func resetNotificationsFeed() {
        clearNotificationShiftDetail()
        notificationsFeed = []
        readNotificationIds = []
        pendingConfirmedNotifications = [:]
        pendingConfirmedReadNotificationIds = []
        notificationsStateRevision &+= 1
        isLoadingNotifications = false
        activeNotificationsRefreshOperationId = nil
        isPushNotificationPermissionActive = true
        showsPushNotificationPermissionDialog = false
        didDismissPushNotificationPermissionDialogForVisit = false
    }

    func clearNotificationShiftDetail() {
        notificationShiftDetail = nil
        loadingNotificationDetailEventID = nil
        activeNotificationDetailOperationId = nil
    }

    func upsertConfirmedNews(_ article: NewsArticle, member: Member) {
        var snapshot = newsFeed
        snapshot.removeAll { $0.id == article.id }
        snapshot.append(article)
        snapshot.sort { $0.publishedAtMillis > $1.publishedAtMillis }
        applyNewsSnapshot(snapshot, member: member)
    }

    func removeConfirmedNews(newsID: String) {
        newsFeed.removeAll { $0.id == newsID }
        latestNews = Array(
            newsFeed
                .filter(\.active)
                .sorted { $0.publishedAtMillis > $1.publishedAtMillis }
                .prefix(3)
        )
    }

    @discardableResult func upsertConfirmedNotification(_ event: NotificationEvent, member: Member) -> Bool {
        notificationsFeed.removeAll { $0.id == event.id }
        guard event.isVisible(to: member) else {
            pendingConfirmedNotifications[event.id] = nil
            notificationsStateRevision &+= 1
            return false
        }
        pendingConfirmedNotifications[event.id] = event
        notificationsFeed.append(event)
        notificationsFeed.sort { $0.sentAtMillis > $1.sentAtMillis }
        notificationsStateRevision &+= 1
        return true
    }
}
