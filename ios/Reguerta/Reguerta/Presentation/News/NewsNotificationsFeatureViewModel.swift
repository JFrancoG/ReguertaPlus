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
    @ObservationIgnored let shiftNotificationDetailRepository: any ShiftNotificationDetailRepository
    @ObservationIgnored let pushNotificationPermissionProvider: any PushNotificationPermissionProvider
    @ObservationIgnored let imagePipelineManager: any ImagePipelineManager
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64
    @ObservationIgnored let environmentProvider: @MainActor () -> SessionEnvironment
    @ObservationIgnored let environmentRoutingSignal: SessionEnvironmentRoutingSignal
    @ObservationIgnored let newsHighlightClock: PresentationDelayClock

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var currentEnvironment: SessionEnvironment?
    var latestNews: [NewsArticle] = []
    var newsFeed: [NewsArticle] = []
    var newsDraft = NewsDraft()
    var notificationDraft = NotificationDraft()
    var notificationsFeed: [NotificationEvent] = []
    var notificationShiftDetail: ShiftNotificationDetail?
    var loadingNotificationDetailEventID: String?
    var readNotificationIds: Set<String> = []
    @ObservationIgnored var pendingConfirmedNotifications: [String: NotificationEvent] = [:]
    @ObservationIgnored var pendingConfirmedReadNotificationIds: Set<String> = []
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
    @ObservationIgnored var sessionIdentityEpoch: UInt64 = 0
    @ObservationIgnored var environmentRoutingGeneration: UInt64 = 0
    @ObservationIgnored var activeCommunityHydrationTask: Task<Void, Never>?
    @ObservationIgnored var newsHighlightTask: Task<Void, Never>?
    @ObservationIgnored var communityHydrationGeneration: UInt64 = 0
    @ObservationIgnored var activeNewsRefreshOperationId: UInt64?
    @ObservationIgnored var nextNewsRefreshOperationId: UInt64 = 0
    @ObservationIgnored var activeNotificationsRefreshOperationId: UInt64?
    @ObservationIgnored var nextNotificationsRefreshOperationId: UInt64 = 0
    @ObservationIgnored var activeNotificationsRouteOperationId: UInt64?
    @ObservationIgnored var nextNotificationsRouteOperationId: UInt64 = 0
    @ObservationIgnored var activeNotificationDetailOperationId: UInt64?
    @ObservationIgnored var nextNotificationDetailOperationId: UInt64 = 0
    @ObservationIgnored var activePermissionRefreshOperationId: UInt64?
    @ObservationIgnored var nextPermissionRefreshOperationId: UInt64 = 0
    @ObservationIgnored var activeMarkReadOperationId: UInt64?
    @ObservationIgnored var nextMarkReadOperationId: UInt64 = 0
    @ObservationIgnored var activeNewsMutationOperationId: UInt64?
    @ObservationIgnored var nextNewsMutationOperationId: UInt64 = 0
    @ObservationIgnored var activeNotificationMutationOperationId: UInt64?
    @ObservationIgnored var nextNotificationMutationOperationId: UInt64 = 0
    @ObservationIgnored var activeNewsImageUploadOperationId: UInt64?
    @ObservationIgnored var nextNewsImageUploadOperationId: UInt64 = 0
    @ObservationIgnored var newsEditorRevision: UInt64 = 0
    @ObservationIgnored var newsDraftRevision: UInt64 = 0
    @ObservationIgnored var notificationEditorRevision: UInt64 = 0
    @ObservationIgnored var notificationDraftRevision: UInt64 = 0
    @ObservationIgnored var newsDeletionRevision: UInt64 = 0
    @ObservationIgnored var notificationsStateRevision: UInt64 = 0

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
        shiftNotificationDetailRepository: any ShiftNotificationDetailRepository =
            UnavailableShiftNotificationDetailRepository(),
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64,
        environmentProvider: @escaping @MainActor () -> SessionEnvironment = { .develop },
        environmentRoutingSignal: SessionEnvironmentRoutingSignal? = nil,
        newsHighlightClock: PresentationDelayClock = .continuous
    ) {
        self.init(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            shiftNotificationDetailRepository: shiftNotificationDetailRepository,
            pushNotificationPermissionProvider: FixedPushNotificationPermissionProvider(isActive: true),
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider,
            environmentProvider: environmentProvider,
            environmentRoutingSignal: environmentRoutingSignal,
            newsHighlightClock: newsHighlightClock
        )
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        newsRepository: any NewsRepository,
        notificationRepository: any NotificationRepository,
        shiftNotificationDetailRepository: any ShiftNotificationDetailRepository =
            UnavailableShiftNotificationDetailRepository(),
        pushNotificationPermissionProvider: any PushNotificationPermissionProvider,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64,
        environmentProvider: @escaping @MainActor () -> SessionEnvironment = { .develop },
        environmentRoutingSignal: SessionEnvironmentRoutingSignal? = nil,
        newsHighlightClock: PresentationDelayClock = .continuous
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.newsRepository = newsRepository
        self.notificationRepository = notificationRepository
        self.shiftNotificationDetailRepository = shiftNotificationDetailRepository
        self.pushNotificationPermissionProvider = pushNotificationPermissionProvider
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
        self.environmentProvider = environmentProvider
        self.newsHighlightClock = newsHighlightClock
        let resolvedRoutingSignal = environmentRoutingSignal
            ?? sessionViewModel.environmentRouter.transitionSignal
        self.environmentRoutingSignal = resolvedRoutingSignal
        self.environmentRoutingGeneration = resolvedRoutingSignal.currentTransition.generation
        resolvedRoutingSignal.observe { [weak self] transition in
            self?.handleEnvironmentRoutingTransition(transition)
        }
    }

    struct SessionContext: Equatable {
        let session: AuthorizedSession
        let epoch: UInt64
        let authorizationSignature: SessionAuthorizationSignature
        let canPublishNews: Bool
        let canSendAdminNotifications: Bool
        let environmentRoutingGeneration: UInt64

        var memberID: String { authorizationSignature.currentMember.id }
        var environment: SessionEnvironment { authorizationSignature.environment }
    }

    struct SessionAuthorizationSignature: Equatable {
        let principalUID: String
        let authenticatedMember: MemberAuthorizationSignature
        let currentMember: MemberAuthorizationSignature
        let environment: SessionEnvironment
    }

    struct MemberAuthorizationSignature: Equatable {
        let id: String
        let authUID: String?
        let roles: Set<MemberRole>
        let isActive: Bool
    }

    struct NewsMutationEditorOwnership: Equatable {
        let editorRevision: UInt64
        let draftRevision: UInt64
        let newsID: String?
    }

    struct NotificationMutationEditorOwnership: Equatable {
        let editorRevision: UInt64
        let draftRevision: UInt64
    }

    struct NewsDeletionOwnership: Equatable {
        let revision: UInt64
        let newsID: String
    }

    enum NewsConvergenceFeedbackOwnership: Equatable {
        case editor(NewsMutationEditorOwnership)
        case deletion(NewsDeletionOwnership)
    }
}
