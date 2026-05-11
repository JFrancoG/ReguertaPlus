import Foundation
import Observation

struct MemberDraft: Equatable, Sendable {
    var displayName = ""
    var email = ""
    var companyName = ""
    var phoneNumber = ""
    var isMember = true
    var isProducer = false
    var isAdmin = false
    var isCommonPurchaseManager = false
    var isActive = true
}

struct NewsDraft: Equatable, Sendable {
    var title = ""
    var body = ""
    var urlImage = ""
    var active = true
}

struct NotificationDraft: Equatable, Sendable {
    var title = ""
    var body = ""
    var audience: NotificationAudience = .all
}

struct SharedProfileDraft: Equatable, Sendable {
    var familyNames = ""
    var photoUrl = ""
    var about = ""

    var normalized: SharedProfileDraft {
        SharedProfileDraft(
            familyNames: familyNames.trimmingCharacters(in: .whitespacesAndNewlines),
            photoUrl: photoUrl.trimmingCharacters(in: .whitespacesAndNewlines),
            about: about.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    var hasVisibleContent: Bool {
        !familyNames.isEmpty || !photoUrl.isEmpty || !about.isEmpty
    }
}

struct ShiftSwapDraft: Equatable, Sendable {
    var shiftId = ""
    var reason = ""
}

struct AuthorizedSession: Equatable, Sendable {
    var principal: AuthPrincipal
    var authenticatedMember: Member
    var member: Member
    var members: [Member]
}

protocol ReviewerEnvironmentRouter: Sendable {
    func applyRouting(for principal: AuthPrincipal) async
    func resetToBaseEnvironment()
}

struct NoOpReviewerEnvironmentRouter: ReviewerEnvironmentRouter {
    func applyRouting(for principal: AuthPrincipal) async {}
    func resetToBaseEnvironment() {}
}

enum SessionMode: Equatable, Sendable {
    case signedOut
    case unauthorized(email: String, reason: UnauthorizedReason)
    case authorized(AuthorizedSession)
}

enum MyOrderFreshnessState: Equatable, Sendable {
    case idle
    case checking
    case ready
    case timedOut
    case unavailable
}

@Observable
final class SessionViewModel {
    var emailInput = "" {
        didSet {
            if oldValue != emailInput {
                emailErrorKey = nil
            }
        }
    }
    var passwordInput = "" {
        didSet {
            if oldValue != passwordInput {
                passwordErrorKey = nil
            }
        }
    }
    var registerEmailInput = "" {
        didSet {
            if oldValue != registerEmailInput {
                registerEmailErrorKey = nil
            }
        }
    }
    var registerPasswordInput = "" {
        didSet {
            if oldValue != registerPasswordInput {
                registerPasswordErrorKey = nil
            }
        }
    }
    var registerRepeatPasswordInput = "" {
        didSet {
            if oldValue != registerRepeatPasswordInput {
                registerRepeatPasswordErrorKey = nil
            }
        }
    }
    var recoverEmailInput = "" {
        didSet {
            if oldValue != recoverEmailInput {
                recoverEmailErrorKey = nil
            }
        }
    }
    var emailErrorKey: String?
    var passwordErrorKey: String?
    var registerEmailErrorKey: String?
    var registerPasswordErrorKey: String?
    var registerRepeatPasswordErrorKey: String?
    var recoverEmailErrorKey: String?
    var isAuthenticating = false
    var isRegistering = false
    var isRecoveringPassword = false
    var showSessionExpiredDialog = false
    var showUnauthorizedDialog = false
    var mode: SessionMode = .signedOut
    var memberDraft = MemberDraft()
    var feedbackMessageKey: String?
    var myOrderFreshnessState: MyOrderFreshnessState = .idle
    var latestNews: [NewsArticle] = []
    var newsFeed: [NewsArticle] = []
    var newsDraft = NewsDraft()
    var notificationsFeed: [NotificationEvent] = []
    var notificationDraft = NotificationDraft()
    var sharedProfiles: [SharedProfile] = []
    var sharedProfileDraft = SharedProfileDraft()
    var shiftsFeed: [ShiftAssignment] = []
    var deliveryCalendarOverrides: [DeliveryCalendarOverride] = []
    var defaultDeliveryDayOfWeek: DeliveryWeekday?
    var shiftSwapRequests: [ShiftSwapRequest] = []
    var dismissedShiftSwapRequestIds = Set<String>()
    var shiftSwapDraft = ShiftSwapDraft()
    var bylawsQueryInput = ""
    var bylawsAnswerResult: BylawsAnswerResult?
    var nextDeliveryShift: ShiftAssignment?
    var nextMarketShift: ShiftAssignment?
    var editingNewsId: String?
    var isLoadingNews = false
    var isSavingNews = false
    var isUploadingNewsImage = false
    var isLoadingNotifications = false
    var isSendingNotification = false
    var isLoadingSharedProfiles = false
    var isSavingSharedProfile = false
    var isUploadingSharedProfileImage = false
    var isDeletingSharedProfile = false
    var isLoadingShifts = false
    var isLoadingDeliveryCalendar = false
    var isSavingDeliveryCalendar = false
    var isSubmittingShiftPlanningRequest = false
    var isSavingShiftSwapRequest = false
    var isUpdatingShiftSwapRequest = false
    var isAskingBylaws = false
    var nowOverrideMillis: Int64?

    let repository: any MemberRepository
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let imagePipelineManager: any ImagePipelineManager
    let sharedProfileRepository: any SharedProfileRepository
    let shiftRepository: any ShiftRepository
    let deliveryCalendarRepository: any DeliveryCalendarRepository
    let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let upsertMemberByAdmin: UpsertMemberByAdminUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let reviewerEnvironmentRouter: any ReviewerEnvironmentRouter
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let developImpersonationEnabled: Bool
    var lastSessionRefreshAtMillis: Int64?
    var isSessionRefreshInFlight = false

    var isDevelopImpersonationEnabled: Bool {
        developImpersonationEnabled
    }

    var canSubmitSignIn: Bool {
        let normalizedEmail = normalizeEmail(emailInput)
        return !isAuthenticating &&
            !normalizedEmail.isEmpty &&
            isValidEmail(normalizedEmail) &&
            isValidPassword(passwordInput) &&
            emailErrorKey == nil &&
            passwordErrorKey == nil
    }

    var canSubmitSignUp: Bool {
        let normalizedEmail = normalizeEmail(registerEmailInput)
        return !isRegistering &&
            !normalizedEmail.isEmpty &&
            isValidEmail(normalizedEmail) &&
            isValidPassword(registerPasswordInput) &&
            isValidPassword(registerRepeatPasswordInput) &&
            registerPasswordInput == registerRepeatPasswordInput &&
            registerEmailErrorKey == nil &&
            registerPasswordErrorKey == nil &&
            registerRepeatPasswordErrorKey == nil
    }

    var canSubmitPasswordReset: Bool {
        let normalizedEmail = normalizeEmail(recoverEmailInput)
        return !isRecoveringPassword &&
            !normalizedEmail.isEmpty &&
            isValidEmail(normalizedEmail) &&
            recoverEmailErrorKey == nil
    }

    init(dependencies: SessionViewModelDependencies) {
        self.repository = dependencies.repository
        self.newsRepository = dependencies.newsRepository
        self.notificationRepository = dependencies.notificationRepository
        self.imagePipelineManager = dependencies.imagePipelineManager
        self.sharedProfileRepository = dependencies.sharedProfileRepository
        self.shiftRepository = dependencies.shiftRepository
        self.deliveryCalendarRepository = dependencies.deliveryCalendarRepository
        self.shiftPlanningRequestRepository = dependencies.shiftPlanningRequestRepository
        self.shiftSwapRequestRepository = dependencies.shiftSwapRequestRepository
        self.authSessionProvider = dependencies.authSessionProvider
        self.resolveAuthorizedSession = dependencies.resolveAuthorizedSession
        self.upsertMemberByAdmin = dependencies.upsertMemberByAdmin
        self.authorizedDeviceRegistrar = dependencies.authorizedDeviceRegistrar
        self.resolveCriticalDataFreshness = dependencies.resolveCriticalDataFreshness
        self.criticalDataFreshnessLocalRepository = dependencies.criticalDataFreshnessLocalRepository
        self.reviewerEnvironmentRouter = dependencies.reviewerEnvironmentRouter
        self.sessionRefreshPolicy = dependencies.sessionRefreshPolicy
        self.nowMillisProvider = dependencies.nowMillisProvider
        self.developImpersonationEnabled = dependencies.developImpersonationEnabled
        self.nowOverrideMillis = dependencies.initialNowOverrideMillis
    }

    convenience init(
        repository: (any MemberRepository)? = nil,
        sharedProfileRepository: (any SharedProfileRepository)? = nil,
        deliveryCalendarRepository: (any DeliveryCalendarRepository)? = nil,
        shiftPlanningRequestRepository: (any ShiftPlanningRequestRepository)? = nil,
        shiftSwapRequestRepository: (any ShiftSwapRequestRepository)? = nil,
        imagePipelineManager: (any ImagePipelineManager)? = nil,
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        upsertMemberByAdmin: UpsertMemberByAdminUseCase? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        reviewerEnvironmentRouter: (any ReviewerEnvironmentRouter)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) },
        initialNowOverrideMillis: Int64? = nil
    ) {
        self.init(
            dependencies: .live(
                repository: repository,
                sharedProfileRepository: sharedProfileRepository,
                deliveryCalendarRepository: deliveryCalendarRepository,
                shiftPlanningRequestRepository: shiftPlanningRequestRepository,
                shiftSwapRequestRepository: shiftSwapRequestRepository,
                imagePipelineManager: imagePipelineManager,
                authSessionProvider: authSessionProvider,
                resolveAuthorizedSession: resolveAuthorizedSession,
                upsertMemberByAdmin: upsertMemberByAdmin,
                authorizedDeviceRegistrar: authorizedDeviceRegistrar,
                reviewerEnvironmentRouter: reviewerEnvironmentRouter,
                developImpersonationEnabled: developImpersonationEnabled,
                sessionRefreshPolicy: sessionRefreshPolicy,
                nowMillisProvider: nowMillisProvider,
                initialNowOverrideMillis: initialNowOverrideMillis
            )
        )
    }

    func setNowOverrideMillis(_ nowMillis: Int64?) {
        DevelopmentTimeMachine.shared.setOverrideNowMillis(nowMillis)
        nowOverrideMillis = nowMillis
        refreshShifts()
        refreshDeliveryCalendar()
    }

    func shiftNowByDays(_ days: Int) {
        let baseMillis = nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
        let shiftedMillis = baseMillis + Int64(days) * 24 * 60 * 60 * 1_000
        setNowOverrideMillis(shiftedMillis)
    }
}
