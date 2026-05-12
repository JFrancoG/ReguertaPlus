import Foundation
import Observation

@MainActor
@Observable
final class NewsNotificationsFeatureViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let newsRepository: any NewsRepository
    @ObservationIgnored let notificationRepository: any NotificationRepository
    @ObservationIgnored let imagePipelineManager: any ImagePipelineManager
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var latestNews: [NewsArticle] = []
    var newsFeed: [NewsArticle] = []
    var newsDraft = NewsDraft()
    var notificationDraft = NotificationDraft()
    var notificationsFeed: [NotificationEvent] = []
    var editingNewsId: String?
    var pendingNewsDeletionId: String?
    var isLoadingNews = false
    var isSavingNews = false
    var isUploadingNewsImage = false
    var isLoadingNotifications = false
    var isSendingNotification = false

    var pendingNewsDeletionArticle: NewsArticle? {
        guard let pendingNewsDeletionId else { return nil }
        return newsFeed.first(where: { $0.id == pendingNewsDeletionId })
    }

    var canPublishNews: Bool {
        currentMember?.canPublishNews == true
    }

    var canSendAdminNotifications: Bool {
        currentMember?.canSendAdminNotifications == true
    }

    init(
        sessionViewModel: SessionViewModel,
        newsRepository: any NewsRepository,
        notificationRepository: any NotificationRepository,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.newsRepository = newsRepository
        self.notificationRepository = notificationRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
    }
}
