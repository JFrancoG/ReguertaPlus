import Foundation
import Observation

struct NewsSaveConfirmation: Equatable {
    let newsId: String
    let isNew: Bool
}

@MainActor
@Observable
final class NewsNotificationsFeatureViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let newsRepository: any NewsRepository
    @ObservationIgnored let notificationRepository: any NotificationRepository
    @ObservationIgnored let pushNotificationPermissionProvider: any PushNotificationPermissionProvider
    @ObservationIgnored let imagePipelineManager: any ImagePipelineManager
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var latestNews: [NewsArticle] = []
    var newsFeed: [NewsArticle] = []
    var newsDraft = NewsDraft()
    var notificationDraft = NotificationDraft()
    var notificationsFeed: [NotificationEvent] = []
    var readNotificationIds: Set<String> = []
    var editingNewsId: String?
    var pendingNewsDeletionId: String?
    var pendingNewsSaveConfirmation: NewsSaveConfirmation?
    var isNotificationSendConfirmationPresented = false
    var highlightedNewsId: String?
    var isLoadingNews = false
    var isSavingNews = false
    var isUploadingNewsImage = false
    var isLoadingNotifications = false
    var isSendingNotification = false
    var isPushNotificationPermissionActive = true
    var showsPushNotificationPermissionDialog = false
    var didDismissPushNotificationPermissionDialogForVisit = false

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

    var notificationListItems: [NotificationListItem] {
        notificationsFeed.map {
            NotificationListItem(notification: $0, isRead: readNotificationIds.contains($0.id))
        }
    }

    var hasUnreadNotifications: Bool {
        notificationsFeed.contains { !readNotificationIds.contains($0.id) }
    }

    convenience init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        newsRepository: any NewsRepository,
        notificationRepository: any NotificationRepository,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.init(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            pushNotificationPermissionProvider: FixedPushNotificationPermissionProvider(isActive: true),
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        newsRepository: any NewsRepository,
        notificationRepository: any NotificationRepository,
        pushNotificationPermissionProvider: any PushNotificationPermissionProvider,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.newsRepository = newsRepository
        self.notificationRepository = notificationRepository
        self.pushNotificationPermissionProvider = pushNotificationPermissionProvider
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
    }
}
