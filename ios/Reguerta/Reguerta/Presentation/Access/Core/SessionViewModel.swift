import Foundation
import Observation

struct MemberDraft: Equatable, Sendable {
    var displayName = ""
    var email = ""
    var isMember = true
    var isProducer = false
    var isAdmin = false
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

struct ProductDraft: Equatable, Sendable {
    var name = ""
    var description = ""
    var productImageUrl = ""
    var price = ""
    var unitName = ""
    var unitAbbreviation = ""
    var unitPlural = ""
    var unitQty = "1"
    var packContainerName = ""
    var packContainerAbbreviation = ""
    var packContainerPlural = ""
    var packContainerQty = ""
    var isAvailable = true
    var stockMode: ProductStockMode = .infinite
    var stockQty = ""
    var isEcoBasket = false
    var isCommonPurchase = false
    var commonPurchaseType: CommonPurchaseType?

    var normalized: ProductDraft {
        ProductDraft(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            productImageUrl: productImageUrl.trimmingCharacters(in: .whitespacesAndNewlines),
            price: price.trimmingCharacters(in: .whitespacesAndNewlines),
            unitName: unitName.trimmingCharacters(in: .whitespacesAndNewlines),
            unitAbbreviation: unitAbbreviation.trimmingCharacters(in: .whitespacesAndNewlines),
            unitPlural: unitPlural.trimmingCharacters(in: .whitespacesAndNewlines),
            unitQty: unitQty.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerName: packContainerName.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerAbbreviation: packContainerAbbreviation.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerPlural: packContainerPlural.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerQty: packContainerQty.trimmingCharacters(in: .whitespacesAndNewlines),
            isAvailable: isAvailable,
            stockMode: stockMode,
            stockQty: stockQty.trimmingCharacters(in: .whitespacesAndNewlines),
            isEcoBasket: isEcoBasket,
            isCommonPurchase: isCommonPurchase,
            commonPurchaseType: commonPurchaseType
        )
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
    var productsFeed: [Product] = []
    var myOrderProductsFeed: [Product] = []
    var myOrderSeasonalCommitmentsFeed: [SeasonalCommitment] = []
    var productDraft = ProductDraft()
    var sharedProfiles: [SharedProfile] = []
    var sharedProfileDraft = SharedProfileDraft()
    var shiftsFeed: [ShiftAssignment] = []
    var deliveryCalendarOverrides: [DeliveryCalendarOverride] = []
    var defaultDeliveryDayOfWeek: DeliveryWeekday?
    var shiftSwapRequests: [ShiftSwapRequest] = []
    var dismissedShiftSwapRequestIds = Set<String>()
    var shiftSwapDraft = ShiftSwapDraft()
    var nextDeliveryShift: ShiftAssignment?
    var nextMarketShift: ShiftAssignment?
    var editingProductId: String?
    var editingNewsId: String?
    var isLoadingNews = false
    var isSavingNews = false
    var isLoadingNotifications = false
    var isSendingNotification = false
    var isLoadingProducts = false
    var isLoadingMyOrderProducts = false
    var isSavingProduct = false
    var isUpdatingProducerCatalogVisibility = false
    var isLoadingSharedProfiles = false
    var isSavingSharedProfile = false
    var isDeletingSharedProfile = false
    var isLoadingShifts = false
    var isLoadingDeliveryCalendar = false
    var isSavingDeliveryCalendar = false
    var isSubmittingShiftPlanningRequest = false
    var isSavingShiftSwapRequest = false
    var isUpdatingShiftSwapRequest = false
    var nowOverrideMillis: Int64?

    let repository: any MemberRepository
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let productRepository: any ProductRepository
    let seasonalCommitmentRepository: any SeasonalCommitmentRepository
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

    init(
        repository: (any MemberRepository)? = nil,
        sharedProfileRepository: (any SharedProfileRepository)? = nil,
        deliveryCalendarRepository: (any DeliveryCalendarRepository)? = nil,
        shiftPlanningRequestRepository: (any ShiftPlanningRequestRepository)? = nil,
        shiftSwapRequestRepository: (any ShiftSwapRequestRepository)? = nil,
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
        let defaults = Self.makeDefaultDependencies()
        let selectedRepository = repository ?? defaults.repository
        let selectedSharedProfileRepository = sharedProfileRepository ?? defaults.sharedProfileRepository
        let selectedDeliveryCalendarRepository = deliveryCalendarRepository ?? defaults.deliveryCalendarRepository
        let selectedShiftPlanningRequestRepository = shiftPlanningRequestRepository ?? defaults.shiftPlanningRequestRepository
        let selectedShiftSwapRequestRepository = shiftSwapRequestRepository ?? defaults.shiftSwapRequestRepository
        let selectedAuthProvider = authSessionProvider ?? defaults.authSessionProvider

        self.repository = selectedRepository
        self.newsRepository = defaults.newsRepository
        self.notificationRepository = defaults.notificationRepository
        self.productRepository = defaults.productRepository
        self.seasonalCommitmentRepository = defaults.seasonalCommitmentRepository
        self.sharedProfileRepository = selectedSharedProfileRepository
        self.shiftRepository = defaults.shiftRepository
        self.deliveryCalendarRepository = selectedDeliveryCalendarRepository
        self.shiftPlanningRequestRepository = selectedShiftPlanningRequestRepository
        self.shiftSwapRequestRepository = selectedShiftSwapRequestRepository
        self.authSessionProvider = selectedAuthProvider
        self.resolveAuthorizedSession = resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository)
        self.upsertMemberByAdmin = upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: selectedRepository)
        self.authorizedDeviceRegistrar = authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar()
        self.resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: defaults.freshnessRemoteRepository,
            localRepository: defaults.freshnessLocalRepository
        )
        self.criticalDataFreshnessLocalRepository = defaults.freshnessLocalRepository
        self.reviewerEnvironmentRouter = reviewerEnvironmentRouter ?? NoOpReviewerEnvironmentRouter()
        self.sessionRefreshPolicy = sessionRefreshPolicy
        self.nowMillisProvider = nowMillisProvider
        self.developImpersonationEnabled = developImpersonationEnabled
        self.nowOverrideMillis = initialNowOverrideMillis
    }

    func setNowOverrideMillis(_ nowMillis: Int64?) {
        DevelopmentTimeMachine.shared.setOverrideNowMillis(nowMillis)
        nowOverrideMillis = nowMillis
        refreshProducts()
        refreshMyOrderProducts()
        refreshShifts()
        refreshDeliveryCalendar()
    }

    func shiftNowByDays(_ days: Int) {
        let baseMillis = nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
        let shiftedMillis = baseMillis + Int64(days) * 24 * 60 * 60 * 1_000
        setNowOverrideMillis(shiftedMillis)
    }
}

private struct SessionViewModelDefaultDependencies {
    let repository: any MemberRepository
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let productRepository: any ProductRepository
    let seasonalCommitmentRepository: any SeasonalCommitmentRepository
    let sharedProfileRepository: any SharedProfileRepository
    let shiftRepository: any ShiftRepository
    let deliveryCalendarRepository: any DeliveryCalendarRepository
    let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    let authSessionProvider: any AuthSessionProvider
    let freshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let freshnessRemoteRepository: any CriticalDataFreshnessRemoteRepository
}

private extension SessionViewModel {
    static func makeDefaultDependencies() -> SessionViewModelDefaultDependencies {
        let useMockAuth = ProcessInfo.processInfo.arguments.contains("-useMockAuth")
        let freshnessLocalRepository = UserDefaultsCriticalDataFreshnessLocalRepository()
        let freshnessRemoteRepository = makeDefaultFreshnessRemoteRepository(useMockAuth: useMockAuth)

        return SessionViewModelDefaultDependencies(
            repository: ChainedMemberRepository(
                primary: FirestoreMemberRepository(),
                fallback: InMemoryMemberRepository()
            ),
            newsRepository: ChainedNewsRepository(
                primary: FirestoreNewsRepository(),
                fallback: InMemoryNewsRepository()
            ),
            notificationRepository: ChainedNotificationRepository(
                primary: FirestoreNotificationRepository(),
                fallback: InMemoryNotificationRepository()
            ),
            productRepository: ChainedProductRepository(
                primary: FirestoreProductRepository(),
                fallback: InMemoryProductRepository()
            ),
            seasonalCommitmentRepository: ChainedSeasonalCommitmentRepository(
                primary: FirestoreSeasonalCommitmentRepository(),
                fallback: InMemorySeasonalCommitmentRepository()
            ),
            sharedProfileRepository: ChainedSharedProfileRepository(
                primary: FirestoreSharedProfileRepository(),
                fallback: InMemorySharedProfileRepository()
            ),
            shiftRepository: ChainedShiftRepository(
                primary: FirestoreShiftRepository(),
                fallback: InMemoryShiftRepository()
            ),
            deliveryCalendarRepository: ChainedDeliveryCalendarRepository(
                primary: FirestoreDeliveryCalendarRepository(),
                fallback: InMemoryDeliveryCalendarRepository()
            ),
            shiftPlanningRequestRepository: ChainedShiftPlanningRequestRepository(
                primary: FirestoreShiftPlanningRequestRepository(),
                fallback: InMemoryShiftPlanningRequestRepository()
            ),
            shiftSwapRequestRepository: ChainedShiftSwapRequestRepository(
                primary: FirestoreShiftSwapRequestRepository(),
                fallback: InMemoryShiftSwapRequestRepository()
            ),
            authSessionProvider: useMockAuth ? MockAuthSessionProvider() : FirebaseAuthSessionProvider(),
            freshnessLocalRepository: freshnessLocalRepository,
            freshnessRemoteRepository: freshnessRemoteRepository
        )
    }

    static func makeDefaultFreshnessRemoteRepository(
        useMockAuth: Bool
    ) -> any CriticalDataFreshnessRemoteRepository {
        guard useMockAuth else {
            return FirestoreCriticalDataFreshnessRemoteRepository()
        }

        return FixedCriticalDataFreshnessRemoteRepository(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: Dictionary(
                    uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
                )
            )
        )
    }
}

private struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(member: Member) async {}
}

private struct FixedCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?

    func getConfig() async -> CriticalDataFreshnessConfig? {
        config
    }
}
