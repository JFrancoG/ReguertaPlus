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
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @Sendable () -> Int64
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
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) }
    ) {
        let selectedRepository = repository ?? ChainedMemberRepository(
            primary: FirestoreMemberRepository(),
            fallback: InMemoryMemberRepository()
        )
        let selectedNewsRepository: any NewsRepository = ChainedNewsRepository(
            primary: FirestoreNewsRepository(),
            fallback: InMemoryNewsRepository()
        )
        let selectedNotificationRepository: any NotificationRepository = ChainedNotificationRepository(
            primary: FirestoreNotificationRepository(),
            fallback: InMemoryNotificationRepository()
        )
        let selectedProductRepository: any ProductRepository = ChainedProductRepository(
            primary: FirestoreProductRepository(),
            fallback: InMemoryProductRepository()
        )
        let selectedSeasonalCommitmentRepository: any SeasonalCommitmentRepository = ChainedSeasonalCommitmentRepository(
            primary: FirestoreSeasonalCommitmentRepository(),
            fallback: InMemorySeasonalCommitmentRepository()
        )
        let selectedSharedProfileRepository = sharedProfileRepository ?? ChainedSharedProfileRepository(
            primary: FirestoreSharedProfileRepository(),
            fallback: InMemorySharedProfileRepository()
        )
        let selectedShiftRepository: any ShiftRepository = ChainedShiftRepository(
            primary: FirestoreShiftRepository(),
            fallback: InMemoryShiftRepository()
        )
        let selectedDeliveryCalendarRepository = deliveryCalendarRepository ?? ChainedDeliveryCalendarRepository(
            primary: FirestoreDeliveryCalendarRepository(),
            fallback: InMemoryDeliveryCalendarRepository()
        )
        let selectedShiftPlanningRequestRepository = shiftPlanningRequestRepository ?? ChainedShiftPlanningRequestRepository(
            primary: FirestoreShiftPlanningRequestRepository(),
            fallback: InMemoryShiftPlanningRequestRepository()
        )
        let selectedShiftSwapRequestRepository = shiftSwapRequestRepository ?? ChainedShiftSwapRequestRepository(
            primary: FirestoreShiftSwapRequestRepository(),
            fallback: InMemoryShiftSwapRequestRepository()
        )
        let selectedAuthProvider = authSessionProvider ?? {
            if ProcessInfo.processInfo.arguments.contains("-useMockAuth") {
                return MockAuthSessionProvider()
            }
            return FirebaseAuthSessionProvider()
        }()
        let freshnessLocalRepository = UserDefaultsCriticalDataFreshnessLocalRepository()
        let freshnessRemoteRepository: any CriticalDataFreshnessRemoteRepository
        if ProcessInfo.processInfo.arguments.contains("-useMockAuth") {
            freshnessRemoteRepository = FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: Dictionary(
                        uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
                    )
                )
            )
        } else {
            freshnessRemoteRepository = FirestoreCriticalDataFreshnessRemoteRepository()
        }
        self.repository = selectedRepository
        self.newsRepository = selectedNewsRepository
        self.notificationRepository = selectedNotificationRepository
        self.productRepository = selectedProductRepository
        self.seasonalCommitmentRepository = selectedSeasonalCommitmentRepository
        self.sharedProfileRepository = selectedSharedProfileRepository
        self.shiftRepository = selectedShiftRepository
        self.deliveryCalendarRepository = selectedDeliveryCalendarRepository
        self.shiftPlanningRequestRepository = selectedShiftPlanningRequestRepository
        self.shiftSwapRequestRepository = selectedShiftSwapRequestRepository
        self.authSessionProvider = selectedAuthProvider
        self.resolveAuthorizedSession = resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository)
        self.upsertMemberByAdmin = upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: selectedRepository)
        self.authorizedDeviceRegistrar = authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar()
        self.resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: freshnessRemoteRepository,
            localRepository: freshnessLocalRepository
        )
        self.criticalDataFreshnessLocalRepository = freshnessLocalRepository
        self.sessionRefreshPolicy = sessionRefreshPolicy
        self.nowMillisProvider = nowMillisProvider
        self.developImpersonationEnabled = developImpersonationEnabled
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
