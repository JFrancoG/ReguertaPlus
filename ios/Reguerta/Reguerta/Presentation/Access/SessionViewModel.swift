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
    var editingNewsId: String?
    var isLoadingNews = false
    var isSavingNews = false
    var isLoadingNotifications = false
    var isSendingNotification = false
    var isLoadingSharedProfiles = false
    var isSavingSharedProfile = false
    var isDeletingSharedProfile = false
    var isLoadingShifts = false
    var isLoadingDeliveryCalendar = false
    var isSavingDeliveryCalendar = false
    var isSubmittingShiftPlanningRequest = false
    var isSavingShiftSwapRequest = false
    var isUpdatingShiftSwapRequest = false

    private let repository: any MemberRepository
    private let newsRepository: any NewsRepository
    private let notificationRepository: any NotificationRepository
    private let sharedProfileRepository: any SharedProfileRepository
    private let shiftRepository: any ShiftRepository
    private let deliveryCalendarRepository: any DeliveryCalendarRepository
    private let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    private let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    private let authSessionProvider: any AuthSessionProvider
    private let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    private let upsertMemberByAdmin: UpsertMemberByAdminUseCase
    private let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    private let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    private let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    private let sessionRefreshPolicy: SessionRefreshPolicy
    private let nowMillisProvider: @Sendable () -> Int64
    private let developImpersonationEnabled: Bool
    private var lastSessionRefreshAtMillis: Int64?
    private var isSessionRefreshInFlight = false

    var isDevelopImpersonationEnabled: Bool {
        developImpersonationEnabled
    }

    var canSubmitSignIn: Bool {
        !isAuthenticating &&
            !normalizeEmail(emailInput).isEmpty &&
            normalizeEmail(emailInput).isValidEmail &&
            passwordInput.isValidPassword &&
            emailErrorKey == nil &&
            passwordErrorKey == nil
    }

    var canSubmitSignUp: Bool {
        !isRegistering &&
            !normalizeEmail(registerEmailInput).isEmpty &&
            normalizeEmail(registerEmailInput).isValidEmail &&
            registerPasswordInput.isValidPassword &&
            registerRepeatPasswordInput.isValidPassword &&
            registerPasswordInput == registerRepeatPasswordInput &&
            registerEmailErrorKey == nil &&
            registerPasswordErrorKey == nil &&
            registerRepeatPasswordErrorKey == nil
    }

    var canSubmitPasswordReset: Bool {
        !isRecoveringPassword &&
            !normalizeEmail(recoverEmailInput).isEmpty &&
            normalizeEmail(recoverEmailInput).isValidEmail &&
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

    func signIn() {
        let email = normalizeEmail(emailInput)
        let password = passwordInput
        feedbackMessageKey = nil
        emailErrorKey = nil
        passwordErrorKey = nil

        guard validateSignInInputs(email: email, password: password) else {
            return
        }

        isAuthenticating = true
        Task { @MainActor in
            let authResult = await authSessionProvider.signIn(email: email, password: password)

            switch authResult {
            case .success(let principal):
                await applyAuthorizedSession(principal: principal)
            case .failure(let reason):
                applySignInFailure(reason)
            }

            isAuthenticating = false
        }
    }

    func signUp() {
        let email = normalizeEmail(registerEmailInput)
        let password = registerPasswordInput
        let repeatedPassword = registerRepeatPasswordInput
        feedbackMessageKey = nil
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil

        guard validateSignUpInputs(email: email, password: password, repeatedPassword: repeatedPassword) else {
            return
        }

        isRegistering = true
        Task { @MainActor in
            let authResult = await authSessionProvider.signUp(email: email, password: password)

            switch authResult {
            case .success(let principal):
                await applyAuthorizedSession(principal: principal)
                registerEmailInput = ""
                registerPasswordInput = ""
                registerRepeatPasswordInput = ""
            case .failure(let reason):
                applySignUpFailure(reason)
            }

            isRegistering = false
        }
    }

    func signOut() {
        authSessionProvider.signOut()
        clearSessionRefreshTracking()
        Task {
            await KeyManager.shared.remove(.authorizedMemberId)
        }
        emailInput = ""
        passwordInput = ""
        registerEmailInput = ""
        registerPasswordInput = ""
        registerRepeatPasswordInput = ""
        recoverEmailInput = ""
        emailErrorKey = nil
        passwordErrorKey = nil
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil
        recoverEmailErrorKey = nil
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        feedbackMessageKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
        myOrderFreshnessState = .idle
        latestNews = []
        newsFeed = []
        newsDraft = NewsDraft()
        notificationsFeed = []
        notificationDraft = NotificationDraft()
        sharedProfiles = []
        sharedProfileDraft = SharedProfileDraft()
        shiftsFeed = []
        shiftSwapRequests = []
        shiftSwapDraft = ShiftSwapDraft()
        nextDeliveryShift = nil
        nextMarketShift = nil
        editingNewsId = nil
        isLoadingNews = false
        isSavingNews = false
        isLoadingNotifications = false
        isSendingNotification = false
        isLoadingSharedProfiles = false
        isSavingSharedProfile = false
        isDeletingSharedProfile = false
        isLoadingShifts = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
        Task {
            await criticalDataFreshnessLocalRepository.clear()
        }
    }

    func dismissSessionExpiredDialog() {
        showSessionExpiredDialog = false
    }

    func dismissUnauthorizedDialog() {
        showUnauthorizedDialog = false
    }

    func updateNewsDraft(_ update: (inout NewsDraft) -> Void) {
        var draft = newsDraft
        update(&draft)
        newsDraft = draft
    }

    func updateNotificationDraft(_ update: (inout NotificationDraft) -> Void) {
        var draft = notificationDraft
        update(&draft)
        notificationDraft = draft
    }

    func startCreatingNews() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminPublishNews
            return
        }

        newsDraft = NewsDraft()
        editingNewsId = nil
    }

    func startEditingNews(newsId: String) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminEditNews
            return
        }
        guard let article = newsFeed.first(where: { $0.id == newsId }) else { return }

        newsDraft = NewsDraft(
            title: article.title,
            body: article.body,
            urlImage: article.urlImage ?? "",
            active: article.active
        )
        editingNewsId = article.id
    }

    func clearNewsEditor() {
        newsDraft = NewsDraft()
        editingNewsId = nil
        isSavingNews = false
    }

    func startCreatingNotification() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminSendNotification
            return
        }

        notificationDraft = NotificationDraft()
        isSendingNotification = false
    }

    func clearNotificationEditor() {
        notificationDraft = NotificationDraft()
        isSendingNotification = false
    }

    func refreshSharedProfiles() {
        guard case .authorized(let session) = mode else { return }
        isLoadingSharedProfiles = true
        Task { @MainActor in
            let profiles = await sharedProfileRepository.allSharedProfiles()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = profiles.first(where: { $0.userId == session.member.id })?.toDraft() ?? SharedProfileDraft()
            isLoadingSharedProfiles = false
        }
    }

    func refreshShifts() {
        guard case .authorized(let session) = mode else { return }
        isLoadingShifts = true
        Task { @MainActor in
            let shifts = await shiftRepository.allShifts()
            let requests = await shiftSwapRequestRepository.allShiftSwapRequests()
            shiftsFeed = shifts
            shiftSwapRequests = requests.visible(to: session.member.id)
            nextDeliveryShift = shifts.nextAssignedShift(
                memberId: session.member.id,
                type: .delivery,
                nowMillis: nowMillisProvider()
            )
            nextMarketShift = shifts.nextAssignedShift(
                memberId: session.member.id,
                type: .market,
                nowMillis: nowMillisProvider()
            )
            isLoadingShifts = false
        }
    }

    func refreshDeliveryCalendar() {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }
        isLoadingDeliveryCalendar = true
        Task { @MainActor in
            defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
            isLoadingDeliveryCalendar = false
        }
    }

    func updateShiftSwapDraft(_ update: (inout ShiftSwapDraft) -> Void) {
        var draft = shiftSwapDraft
        update(&draft)
        shiftSwapDraft = draft
    }

    func startCreatingShiftSwap(shiftId: String) {
        shiftSwapDraft = ShiftSwapDraft(
            shiftId: shiftId,
            reason: ""
        )
    }

    func clearShiftSwapDraft() {
        shiftSwapDraft = ShiftSwapDraft()
        isSavingShiftSwapRequest = false
    }

    func impersonate(memberId: String) {
        guard developImpersonationEnabled else { return }
        guard case .authorized(let session) = mode else { return }
        guard let target = session.members.first(where: { $0.id == memberId && $0.isActive }) else { return }

        mode = .authorized(
            AuthorizedSession(
                principal: session.principal,
                authenticatedMember: session.authenticatedMember,
                member: target,
                members: session.members
            )
        )
        dismissedShiftSwapRequestIds = []
        shiftSwapDraft = ShiftSwapDraft()
        refreshNews()
        refreshNotifications()
        refreshSharedProfiles()
        refreshShifts()
        refreshDeliveryCalendar()
    }

    func clearImpersonation() {
        guard developImpersonationEnabled else { return }
        guard case .authorized(let session) = mode else { return }
        guard session.member.id != session.authenticatedMember.id else { return }

        mode = .authorized(
            AuthorizedSession(
                principal: session.principal,
                authenticatedMember: session.authenticatedMember,
                member: session.authenticatedMember,
                members: session.members
            )
        )
        dismissedShiftSwapRequestIds = []
        shiftSwapDraft = ShiftSwapDraft()
        refreshNews()
        refreshNotifications()
        refreshSharedProfiles()
        refreshShifts()
        refreshDeliveryCalendar()
    }

    func dismissShiftSwapActivity(requestId: String) {
        dismissedShiftSwapRequestIds.insert(requestId)
    }

    func saveDeliveryCalendarOverride(
        weekKey: String,
        weekday: DeliveryWeekday,
        updatedByUserId: String,
        onSuccess: @escaping @MainActor () -> Void = {}
    ) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }
        guard let override = buildDeliveryCalendarOverride(
            weekKey: weekKey,
            weekday: weekday,
            updatedByUserId: updatedByUserId,
            updatedAtMillis: nowMillisProvider()
        ) else { return }

        isSavingDeliveryCalendar = true
        Task { @MainActor in
            _ = await deliveryCalendarRepository.upsertOverride(override)
            defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
            isSavingDeliveryCalendar = false
            onSuccess()
        }
    }

    func deleteDeliveryCalendarOverride(
        weekKey: String,
        onSuccess: @escaping @MainActor () -> Void = {}
    ) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }

        isSavingDeliveryCalendar = true
        Task { @MainActor in
            await deliveryCalendarRepository.deleteOverride(weekKey: weekKey)
            defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
            isSavingDeliveryCalendar = false
            onSuccess()
        }
    }

    func submitShiftPlanningRequest(
        type: ShiftPlanningRequestType,
        onSuccess: @escaping @MainActor () -> Void = {}
    ) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else { return }

        isSubmittingShiftPlanningRequest = true
        Task { @MainActor in
            _ = await shiftPlanningRequestRepository.submit(
                request: ShiftPlanningRequest(
                    id: "",
                    type: type,
                    requestedByUserId: session.member.id,
                    requestedAtMillis: nowMillisProvider(),
                    status: .requested
                )
            )
            isSubmittingShiftPlanningRequest = false
            onSuccess()
        }
    }

    func saveSharedProfile(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        let draft = sharedProfileDraft.normalized
        guard draft.hasVisibleContent else {
            feedbackMessageKey = AccessL10nKey.feedbackSharedProfileContentRequired
            return
        }

        isSavingSharedProfile = true
        Task { @MainActor in
            let saved = await sharedProfileRepository.upsert(
                profile: SharedProfile(
                    userId: session.member.id,
                    familyNames: draft.familyNames,
                    photoUrl: draft.photoUrl.isEmpty ? nil : draft.photoUrl,
                    about: draft.about,
                    updatedAtMillis: nowMillisProvider()
                )
            )
            let profiles = await sharedProfileRepository.allSharedProfiles()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = saved.toDraft()
            isSavingSharedProfile = false
            feedbackMessageKey = AccessL10nKey.feedbackSharedProfileSaved
            onSuccess()
        }
    }

    func deleteSharedProfile(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }

        isDeletingSharedProfile = true
        Task { @MainActor in
            let deleted = await sharedProfileRepository.deleteSharedProfile(userId: session.member.id)
            let profiles = await sharedProfileRepository.allSharedProfiles()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = SharedProfileDraft()
            isDeletingSharedProfile = false
            feedbackMessageKey = deleted
                ? AccessL10nKey.feedbackSharedProfileDeleted
                : AccessL10nKey.feedbackSharedProfileDeleteFailed
            onSuccess()
        }
    }

    func refreshNews() {
        guard case .authorized(let session) = mode else { return }
        isLoadingNews = true
        Task { @MainActor in
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = session.member.isAdmin ? allNews : allNews.filter(\.active)
            isLoadingNews = false
        }
    }

    func refreshNotifications() {
        guard case .authorized(let session) = mode else { return }
        isLoadingNotifications = true
        Task { @MainActor in
            let allNotifications = await notificationRepository.allNotifications()
            notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
            isLoadingNotifications = false
        }
    }

    func saveNews(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminPublishNews
            return
        }
        guard !newsDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !newsDraft.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackNewsTitleBodyRequired
            return
        }

        isSavingNews = true
        Task { @MainActor in
            let existing = newsFeed.first(where: { $0.id == editingNewsId })
            let saved = await newsRepository.upsert(
                article: NewsArticle(
                    id: editingNewsId ?? "",
                    title: newsDraft.title.trimmingCharacters(in: .whitespacesAndNewlines),
                    body: newsDraft.body.trimmingCharacters(in: .whitespacesAndNewlines),
                    active: newsDraft.active,
                    publishedBy: existing?.publishedBy ?? session.member.displayName,
                    publishedAtMillis: existing?.publishedAtMillis ?? nowMillisProvider(),
                    urlImage: {
                        let trimmed = newsDraft.urlImage.trimmingCharacters(in: .whitespacesAndNewlines)
                        return trimmed.isEmpty ? nil : trimmed
                    }()
                )
            )
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = allNews
            newsDraft = NewsDraft(
                title: saved.title,
                body: saved.body,
                urlImage: saved.urlImage ?? "",
                active: saved.active
            )
            editingNewsId = saved.id
            isSavingNews = false
            feedbackMessageKey = existing == nil ? AccessL10nKey.feedbackNewsCreated : AccessL10nKey.feedbackNewsUpdated
            onSuccess()
        }
    }

    func deleteNews(newsId: String, onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminDeleteNews
            return
        }

        Task { @MainActor in
            let deleted = await newsRepository.delete(newsId: newsId)
            guard deleted else {
                feedbackMessageKey = AccessL10nKey.feedbackNewsDeleteFailed
                return
            }
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = allNews
            if editingNewsId == newsId {
                clearNewsEditor()
            }
            feedbackMessageKey = AccessL10nKey.feedbackNewsDeleted
            onSuccess()
        }
    }

    func sendNotification(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminSendNotification
            return
        }
        guard !notificationDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !notificationDraft.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackNotificationTitleBodyRequired
            return
        }

        isSendingNotification = true
        Task { @MainActor in
            _ = await notificationRepository.send(
                event: NotificationEvent(
                    id: "",
                    title: notificationDraft.title.trimmingCharacters(in: .whitespacesAndNewlines),
                    body: notificationDraft.body.trimmingCharacters(in: .whitespacesAndNewlines),
                    type: "admin_broadcast",
                    target: notificationDraft.audience.targetValue,
                    userIds: [],
                    segmentType: notificationDraft.audience.segmentType,
                    targetRole: notificationDraft.audience.targetRole,
                    createdBy: session.member.id,
                    sentAtMillis: nowMillisProvider(),
                    weekKey: nil
                )
            )
            let allNotifications = await notificationRepository.allNotifications()
            notificationsFeed = allNotifications.filter { $0.isVisible(to: session.member) }
            notificationDraft = NotificationDraft()
            isSendingNotification = false
            feedbackMessageKey = AccessL10nKey.feedbackNotificationSent
            onSuccess()
        }
    }

    func saveShiftSwapRequest(onSuccess: @escaping @MainActor () -> Void = {}) {
        guard case .authorized(let session) = mode else { return }
        guard !shiftSwapDraft.shiftId.isEmpty else { return }
        guard let shift = shiftsFeed.first(where: { $0.id == shiftSwapDraft.shiftId }) else { return }
        let candidates = shift.swapCandidates(
            allShifts: shiftsFeed,
            requesterUserId: session.member.id,
            nowMillis: nowMillisProvider()
        )
        guard !candidates.isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackShiftSwapNoCandidates
            return
        }

        isSavingShiftSwapRequest = true
        Task { @MainActor in
            let saved = await shiftSwapRequestRepository.upsert(
                request: ShiftSwapRequest(
                    id: "",
                    requestedShiftId: shift.id,
                    requesterUserId: session.member.id,
                    reason: shiftSwapDraft.reason.trimmingCharacters(in: .whitespacesAndNewlines),
                    status: .open,
                    candidates: candidates,
                    responses: [],
                    selectedCandidateUserId: nil,
                    selectedCandidateShiftId: nil,
                    requestedAtMillis: nowMillisProvider(),
                    confirmedAtMillis: nil,
                    appliedAtMillis: nil
                )
            )
            await sendShiftSwapNotification(
                title: "Solicitud de cambio de turno",
                body: "\(session.member.displayName) solicita cambio para el turno del \(localizedShiftNotificationDateTime(shift.dateMillis))",
                type: "shift_swap_requested",
                targetUserIds: Array(Set(saved.candidates.map(\.userId))),
                createdBy: session.member.id
            )
            let requests = await shiftSwapRequestRepository.allShiftSwapRequests()
            shiftSwapRequests = requests.visible(to: session.member.id)
            shiftSwapDraft = ShiftSwapDraft()
            isSavingShiftSwapRequest = false
            onSuccess()
        }
    }

    func acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .available)
    }

    func rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId, responseStatus: .unavailable)
    }

    func cancelShiftSwapRequest(requestId: String) {
        updateShiftSwapRequest(requestId: requestId) { request, _, _ in
            ShiftSwapRequest(
                id: request.id,
                requestedShiftId: request.requestedShiftId,
                requesterUserId: request.requesterUserId,
                reason: request.reason,
                status: .cancelled,
                candidates: request.candidates,
                responses: request.responses,
                selectedCandidateUserId: request.selectedCandidateUserId,
                selectedCandidateShiftId: request.selectedCandidateShiftId,
                requestedAtMillis: request.requestedAtMillis,
                confirmedAtMillis: request.confirmedAtMillis,
                appliedAtMillis: request.appliedAtMillis
            )
        }
    }

    func confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        guard case .authorized(let session) = mode else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return }
        guard let candidate = request.candidates.first(where: { $0.shiftId == candidateShiftId }) else { return }
        guard let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId }) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedRequest = ShiftSwapRequest(
                id: request.id,
                requestedShiftId: request.requestedShiftId,
                requesterUserId: request.requesterUserId,
                reason: request.reason,
                status: .applied,
                candidates: request.candidates,
                responses: request.responses,
                selectedCandidateUserId: candidate.userId,
                selectedCandidateShiftId: candidate.shiftId,
                requestedAtMillis: request.requestedAtMillis,
                confirmedAtMillis: now,
                appliedAtMillis: now
            )
            let swapped = requestedShift.swappingMember(with: candidateShift, requesterUserId: request.requesterUserId, responderUserId: candidate.userId, nowMillis: now)
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            let existingShifts = await shiftRepository.allShifts()
            let shiftsToPersist = existingShifts.applyingConfirmedSwap(
                updatedRequestedShift: swapped.0,
                updatedCandidateShift: swapped.1,
                nowMillis: now
            )
            for shift in shiftsToPersist {
                _ = await shiftRepository.upsert(shift: shift)
            }
            await sendShiftSwapNotification(
                title: "Cambio de turno aplicado",
                body: "Se ha confirmado el cambio entre \(session.member.displayName) y \(displayName(for: candidate.userId, in: session)) para \(localizedShiftNotificationDateTime(requestedShift.dateMillis)) y \(localizedShiftNotificationDateTime(candidateShift.dateMillis)).",
                type: "shift_swap_applied",
                targetUserIds: Array(Set(session.members.filter(\.isActive).map(\.id))),
                createdBy: session.member.id
            )
            let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
            let allShifts = await shiftRepository.allShifts()
            shiftSwapRequests = allRequests.visible(to: session.member.id)
            shiftsFeed = allShifts
            nextDeliveryShift = allShifts.nextAssignedShift(memberId: session.member.id, type: .delivery, nowMillis: nowMillisProvider())
            nextMarketShift = allShifts.nextAssignedShift(memberId: session.member.id, type: .market, nowMillis: nowMillisProvider())
            isUpdatingShiftSwapRequest = false
        }
    }

    func refreshSession(trigger: SessionRefreshTrigger) {
        let nowMillis = nowMillisProvider()
        guard sessionRefreshPolicy.shouldRefresh(
            trigger: trigger,
            lastRefreshAtMillis: lastSessionRefreshAtMillis,
            nowMillis: nowMillis,
            isRefreshInFlight: isSessionRefreshInFlight
        ) else {
            return
        }

        isSessionRefreshInFlight = true
        let hadAuthenticatedSession = mode.isAuthenticatedSession

        Task { @MainActor in
            defer {
                lastSessionRefreshAtMillis = nowMillisProvider()
                isSessionRefreshInFlight = false
            }

            let result = await authSessionProvider.refreshCurrentSession()
            switch result {
            case .noSession:
                if hadAuthenticatedSession {
                    await handleExpiredSession()
                }
            case .active(let principal):
                let shouldRefreshCriticalData = !hadAuthenticatedSession || shouldRefreshCriticalData(for: principal)
                await applyAuthorizedSession(
                    principal: principal,
                    shouldRefreshCriticalData: shouldRefreshCriticalData
                )
            case .expired:
                await handleExpiredSession()
            }
        }
    }

    func refreshMyOrderFreshness() {
        guard case .authorized(let session) = mode else {
            return
        }

        myOrderFreshnessState = .checking
        Task { @MainActor in
            let resolution = await withTaskGroup(of: CriticalDataFreshnessResolution?.self) { group in
                group.addTask {
                    await self.resolveCriticalDataFreshness.execute()
                }
                group.addTask {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    return nil
                }
                let first = await group.next() ?? nil
                group.cancelAll()
                return first
            }

            guard case .authorized(let latestSession) = mode, latestSession == session else {
                return
            }

            switch resolution {
            case .fresh:
                myOrderFreshnessState = .ready
            case .invalidConfig:
                myOrderFreshnessState = .unavailable
            case nil:
                myOrderFreshnessState = .timedOut
            }
        }
    }

    func sendPasswordReset() {
        let email = normalizeEmail(recoverEmailInput)
        feedbackMessageKey = nil
        recoverEmailErrorKey = nil

        if email.isEmpty {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailRequired
            return
        }
        if !email.isValidEmail {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            return
        }

        isRecoveringPassword = true
        Task { @MainActor in
            let result = await authSessionProvider.sendPasswordReset(email: email)
            switch result {
            case .success:
                feedbackMessageKey = AccessL10nKey.authInfoPasswordResetSent
            case .failure(let reason):
                applyPasswordResetFailure(reason)
            }
            isRecoveringPassword = false
        }
    }

    func createAuthorizedMember() {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminCreate
            return
        }

        let normalizedEmail = normalizeEmail(memberDraft.email)
        guard !memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !normalizedEmail.isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackDisplayNameEmailRequired
            return
        }

        let roles = buildRoles(from: memberDraft)
        guard !roles.isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackSelectRole
            return
        }

        if session.members.contains(where: { $0.normalizedEmail == normalizedEmail }) {
            feedbackMessageKey = AccessL10nKey.feedbackMemberExists
            return
        }

        let member = Member(
            id: buildMemberId(from: normalizedEmail),
            displayName: memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            normalizedEmail: normalizedEmail,
            authUid: nil,
            roles: roles,
            isActive: memberDraft.isActive,
            producerCatalogEnabled: true
        )

        Task { @MainActor in
            await persistMember(target: member, session: session)
            memberDraft = MemberDraft()
        }
    }

    func toggleAdmin(memberId: String) {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminEditRoles
            return
        }
        guard let target = session.members.first(where: { $0.id == memberId }) else {
            return
        }

        var roles = target.roles
        if roles.contains(.admin) {
            roles.remove(.admin)
        } else {
            roles.insert(.admin)
        }
        if roles.isEmpty {
            roles.insert(.member)
        }

        let updated = Member(
            id: target.id,
            displayName: target.displayName,
            normalizedEmail: target.normalizedEmail,
            authUid: target.authUid,
            roles: roles,
            isActive: target.isActive,
            producerCatalogEnabled: target.producerCatalogEnabled
        )

        Task { @MainActor in
            await persistMember(target: updated, session: session)
        }
    }

    func toggleActive(memberId: String) {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminToggleActive
            return
        }
        guard let target = session.members.first(where: { $0.id == memberId }) else {
            return
        }

        let updated = Member(
            id: target.id,
            displayName: target.displayName,
            normalizedEmail: target.normalizedEmail,
            authUid: target.authUid,
            roles: target.roles,
            isActive: !target.isActive,
            producerCatalogEnabled: target.producerCatalogEnabled
        )

        Task { @MainActor in
            await persistMember(target: updated, session: session)
        }
    }

    func clearFeedbackMessage() {
        feedbackMessageKey = nil
    }

    func resetSignInDraft() {
        emailInput = ""
        passwordInput = ""
        emailErrorKey = nil
        passwordErrorKey = nil
        isAuthenticating = false
    }

    func resetSignUpDraft() {
        registerEmailInput = ""
        registerPasswordInput = ""
        registerRepeatPasswordInput = ""
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil
        isRegistering = false
    }

    func resetRecoverDraft() {
        recoverEmailInput = ""
        recoverEmailErrorKey = nil
        isRecoveringPassword = false
    }

    private func validateSignInInputs(email: String, password: String) -> Bool {
        var isValid = true

        if email.isEmpty {
            emailErrorKey = AccessL10nKey.feedbackEmailRequired
            isValid = false
        } else if !email.isValidEmail {
            emailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            passwordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        } else if !password.isValidPassword {
            passwordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        }

        return isValid
    }

    private func validateSignUpInputs(email: String, password: String, repeatedPassword: String) -> Bool {
        var isValid = true

        if email.isEmpty {
            registerEmailErrorKey = AccessL10nKey.feedbackEmailRequired
            isValid = false
        } else if !email.isValidEmail {
            registerEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            registerPasswordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        } else if !password.isValidPassword {
            registerPasswordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        }

        if repeatedPassword.isEmpty {
            registerRepeatPasswordErrorKey = AccessL10nKey.feedbackPasswordRepeatRequired
            isValid = false
        } else if !repeatedPassword.isValidPassword {
            registerRepeatPasswordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        } else if repeatedPassword != password {
            registerRepeatPasswordErrorKey = AccessL10nKey.feedbackPasswordMismatch
            isValid = false
        }

        return isValid
    }

    private func applySignInFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signIn)
        emailErrorKey = mapped.emailErrorKey
        passwordErrorKey = mapped.passwordErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    private func applySignUpFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signUp)
        registerEmailErrorKey = mapped.emailErrorKey
        registerPasswordErrorKey = mapped.passwordErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    private func applyPasswordResetFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .passwordReset)
        recoverEmailErrorKey = mapped.emailErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    private func updateShiftSwapRequest(
        requestId: String,
        transform: @escaping (ShiftSwapRequest, AuthorizedSession, Int64) -> ShiftSwapRequest
    ) {
        guard case .authorized(let session) = mode else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedRequest = transform(request, session, now)
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
            let allShifts = await shiftRepository.allShifts()
            shiftSwapRequests = allRequests.visible(to: session.member.id)
            shiftsFeed = allShifts
            nextDeliveryShift = allShifts.nextAssignedShift(
                memberId: session.member.id,
                type: .delivery,
                nowMillis: nowMillisProvider()
            )
            nextMarketShift = allShifts.nextAssignedShift(
                memberId: session.member.id,
                type: .market,
                nowMillis: nowMillisProvider()
            )
            isUpdatingShiftSwapRequest = false
        }
    }

    private func respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: ShiftSwapResponseStatus
    ) {
        guard case .authorized(let session) = mode else { return }
        guard let request = shiftSwapRequests.first(where: { $0.id == requestId }) else { return }
        guard let candidate = request.candidates.first(where: { $0.userId == session.member.id && $0.shiftId == candidateShiftId }) else { return }
        guard let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return }
        let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId })

        isUpdatingShiftSwapRequest = true
        Task { @MainActor in
            let now = nowMillisProvider()
            let updatedResponses = request.responses
                .filter { !($0.userId == candidate.userId && $0.shiftId == candidate.shiftId) }
                + [ShiftSwapResponse(
                    userId: candidate.userId,
                    shiftId: candidate.shiftId,
                    status: responseStatus,
                    respondedAtMillis: now
                )]
            let updatedRequest = ShiftSwapRequest(
                id: request.id,
                requestedShiftId: request.requestedShiftId,
                requesterUserId: request.requesterUserId,
                reason: request.reason,
                status: request.status,
                candidates: request.candidates,
                responses: updatedResponses.sorted { $0.respondedAtMillis > $1.respondedAtMillis },
                selectedCandidateUserId: request.selectedCandidateUserId,
                selectedCandidateShiftId: request.selectedCandidateShiftId,
                requestedAtMillis: request.requestedAtMillis,
                confirmedAtMillis: request.confirmedAtMillis,
                appliedAtMillis: request.appliedAtMillis
            )
            _ = await shiftSwapRequestRepository.upsert(request: updatedRequest)
            await sendShiftSwapNotification(
                title: responseStatus == .available ? "Socio disponible para cambio" : "Socio no disponible para cambio",
                body: "\(session.member.displayName)\(responseStatus == .available ? " puede cubrir " : " no puede cubrir ")\(localizedShiftNotificationDateTime(requestedShift.dateMillis))\(candidateShift.map { " desde su turno del \(localizedShiftNotificationDateTime($0.dateMillis))" } ?? "")",
                type: responseStatus == .available ? "shift_swap_available" : "shift_swap_unavailable",
                targetUserIds: [request.requesterUserId],
                createdBy: session.member.id
            )
            let allRequests = await shiftSwapRequestRepository.allShiftSwapRequests()
            shiftSwapRequests = allRequests.visible(to: session.member.id)
            isUpdatingShiftSwapRequest = false
        }
    }

    private func sendShiftSwapNotification(
        title: String,
        body: String,
        type: String,
        targetUserIds: [String],
        createdBy: String
    ) async {
        _ = await notificationRepository.send(
            event: NotificationEvent(
                id: "",
                title: title,
                body: body,
                type: type,
                target: "users",
                userIds: targetUserIds,
                segmentType: nil,
                targetRole: nil,
                createdBy: createdBy,
                sentAtMillis: nowMillisProvider(),
                weekKey: nil
            )
        )
    }

    private func applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Bool = true
    ) async {
        let result = await resolveAuthorizedSession.execute(authPrincipal: principal)
        switch result {
        case .authorized(let member):
            let members = await repository.allMembers()
            mode = .authorized(
                AuthorizedSession(
                    principal: principal,
                    authenticatedMember: member,
                    member: member,
                    members: members
                )
            )
            showSessionExpiredDialog = false
            showUnauthorizedDialog = false
            if shouldRefreshCriticalData {
                myOrderFreshnessState = .checking
                refreshMyOrderFreshness()
            }
            isLoadingNews = true
            isLoadingNotifications = true
            isLoadingSharedProfiles = true
            isLoadingShifts = true
            let allNotifications = await notificationRepository.allNotifications()
            let profiles = await sharedProfileRepository.allSharedProfiles()
            let shifts = await shiftRepository.allShifts()
            let requests = await shiftSwapRequestRepository.allShiftSwapRequests()
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = member.isAdmin ? allNews : allNews.filter(\.active)
            notificationsFeed = allNotifications.filter { $0.isVisible(to: member) }
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = profiles.first(where: { $0.userId == member.id })?.toDraft() ?? SharedProfileDraft()
            shiftsFeed = shifts
            shiftSwapRequests = requests.visible(to: member.id)
            shiftSwapDraft = ShiftSwapDraft()
            nextDeliveryShift = shifts.nextAssignedShift(
                memberId: member.id,
                type: .delivery,
                nowMillis: nowMillisProvider()
            )
            nextMarketShift = shifts.nextAssignedShift(
                memberId: member.id,
                type: .market,
                nowMillis: nowMillisProvider()
            )
            isLoadingNews = false
            isLoadingNotifications = false
            isLoadingSharedProfiles = false
            isLoadingShifts = false
            await authorizedDeviceRegistrar.register(member: member)
        case .unauthorized(let reason):
            let shouldShowUnauthorizedDialog = shouldShowUnauthorizedDialog(
                for: principal.email,
                reason: reason
            )
            mode = .unauthorized(email: principal.email, reason: reason)
            showSessionExpiredDialog = false
            showUnauthorizedDialog = shouldShowUnauthorizedDialog
            myOrderFreshnessState = .idle
            latestNews = []
            newsFeed = []
            newsDraft = NewsDraft()
            notificationsFeed = []
            notificationDraft = NotificationDraft()
            sharedProfiles = []
            sharedProfileDraft = SharedProfileDraft()
            shiftsFeed = []
            shiftSwapRequests = []
            shiftSwapDraft = ShiftSwapDraft()
            nextDeliveryShift = nil
            nextMarketShift = nil
            editingNewsId = nil
            isLoadingNews = false
            isSavingNews = false
            isLoadingNotifications = false
            isSendingNotification = false
            isLoadingSharedProfiles = false
            isSavingSharedProfile = false
            isDeletingSharedProfile = false
            isLoadingShifts = false
            isSavingShiftSwapRequest = false
            isUpdatingShiftSwapRequest = false
        }
    }

    private func shouldRefreshCriticalData(for principal: AuthPrincipal) -> Bool {
        switch mode {
        case .signedOut:
            return true
        case .unauthorized(let email, _):
            return email != principal.email
        case .authorized(let session):
            return session.principal.uid != principal.uid
        }
    }

    private func shouldShowUnauthorizedDialog(for email: String, reason: UnauthorizedReason) -> Bool {
        guard reason == .userNotFoundInAuthorizedUsers else {
            return false
        }
        if case .unauthorized(let currentEmail, _) = mode {
            return currentEmail != email
        }
        return true
    }

    private func handleExpiredSession() async {
        clearSessionRefreshTracking()
        emailInput = ""
        passwordInput = ""
        registerEmailInput = ""
        registerPasswordInput = ""
        registerRepeatPasswordInput = ""
        recoverEmailInput = ""
        emailErrorKey = nil
        passwordErrorKey = nil
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil
        recoverEmailErrorKey = nil
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackMessageKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
        myOrderFreshnessState = .idle
        showSessionExpiredDialog = true
        showUnauthorizedDialog = false
        latestNews = []
        newsFeed = []
        newsDraft = NewsDraft()
        notificationsFeed = []
        notificationDraft = NotificationDraft()
        sharedProfiles = []
        sharedProfileDraft = SharedProfileDraft()
        shiftsFeed = []
        shiftSwapRequests = []
        shiftSwapDraft = ShiftSwapDraft()
        nextDeliveryShift = nil
        nextMarketShift = nil
        editingNewsId = nil
        isLoadingNews = false
        isSavingNews = false
        isLoadingNotifications = false
        isSendingNotification = false
        isLoadingSharedProfiles = false
        isSavingSharedProfile = false
        isDeletingSharedProfile = false
        isLoadingShifts = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
        await criticalDataFreshnessLocalRepository.clear()
    }

    private func clearSessionRefreshTracking() {
        lastSessionRefreshAtMillis = nil
        isSessionRefreshInFlight = false
    }

    private func persistMember(target: Member, session: AuthorizedSession) async {
        do {
            let updated = try await upsertMemberByAdmin.execute(
                actorAuthUid: session.principal.uid,
                target: target
            )
            let members = await repository.allMembers()
            let refreshedCurrent = updated.id == session.member.id ? updated : session.member
            let refreshedAuthenticated = updated.id == session.authenticatedMember.id ? updated : session.authenticatedMember
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
                    authenticatedMember: refreshedAuthenticated,
                    member: refreshedCurrent,
                    members: members
                )
            )
        } catch MemberManagementError.accessDenied {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminManageMembers
        } catch MemberManagementError.lastAdminRemoval {
            feedbackMessageKey = AccessL10nKey.feedbackCannotRemoveLastAdmin
        } catch {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
        }
    }

    private func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func buildRoles(from draft: MemberDraft) -> Set<MemberRole> {
        var roles: Set<MemberRole> = []
        if draft.isMember { roles.insert(.member) }
        if draft.isProducer { roles.insert(.producer) }
        if draft.isAdmin { roles.insert(.admin) }
        return roles
    }

    private func buildMemberId(from normalizedEmail: String) -> String {
        let sanitized = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let suffix = sanitized.isEmpty ? "member" : String(sanitized.prefix(40))
        return "member_\(suffix)"
    }
}

private extension SharedProfile {
    func toDraft() -> SharedProfileDraft {
        SharedProfileDraft(
            familyNames: familyNames,
            photoUrl: photoUrl ?? "",
            about: about
        )
    }
}

private extension Array where Element == ShiftAssignment {
    func nextAssignedShift(
        memberId: String,
        type: ShiftType,
        nowMillis: Int64
    ) -> ShiftAssignment? {
        self
            .filter { $0.type == type && $0.dateMillis >= nowMillis && $0.isAssigned(to: memberId) }
            .min { $0.dateMillis < $1.dateMillis }
    }
}

private extension Array where Element == ShiftSwapRequest {
    func visible(to memberId: String) -> [ShiftSwapRequest] {
        filter { request in
            request.requesterUserId == memberId || request.candidates.contains(where: { $0.userId == memberId })
        }
            .sorted { $0.requestedAtMillis > $1.requestedAtMillis }
    }
}

private extension ShiftAssignment {
    func swapCandidates(allShifts: [ShiftAssignment], requesterUserId: String, nowMillis: Int64) -> [ShiftSwapCandidate] {
        let calendar = Calendar(identifier: .iso8601)
        let thresholdDate: Date
        if type == .delivery {
            thresholdDate = calendar.date(byAdding: .day, value: 14, to: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)) ?? Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        } else {
            thresholdDate = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        }
        let thresholdMillis = Int64(thresholdDate.timeIntervalSince1970 * 1_000)
        return Array(
            allShifts
                .filter { $0.id != id && $0.type == type && $0.dateMillis >= thresholdMillis }
                .flatMap { shift in
                    shift.assignedUserIds
                        .filter { $0 != requesterUserId }
                        .map { ShiftSwapCandidate(userId: $0, shiftId: shift.id) }
                }
                .reduce(into: [String: ShiftSwapCandidate]()) { partialResult, candidate in
                    partialResult["\(candidate.userId):\(candidate.shiftId)"] = candidate
                }
                .values
        )
    }

    func swappingMember(with other: ShiftAssignment, requesterUserId: String, responderUserId: String, nowMillis: Int64) -> (ShiftAssignment, ShiftAssignment) {
        func replacing(_ shift: ShiftAssignment, oldUserId: String, newUserId: String) -> ShiftAssignment {
            let updatedAssigned = shift.assignedUserIds.map { $0 == oldUserId ? newUserId : $0 }
            let updatedHelper = shift.helperUserId == oldUserId ? newUserId : shift.helperUserId
            return ShiftAssignment(
                id: shift.id,
                type: shift.type,
                dateMillis: shift.dateMillis,
                assignedUserIds: updatedAssigned,
                helperUserId: updatedHelper,
                status: .confirmed,
                source: "app",
                createdAtMillis: shift.createdAtMillis,
                updatedAtMillis: nowMillis
            )
        }

        return (
            replacing(self, oldUserId: requesterUserId, newUserId: responderUserId),
            replacing(other, oldUserId: responderUserId, newUserId: requesterUserId)
        )
    }
}

private extension Array where Element == ShiftAssignment {
    func applyingConfirmedSwap(
        updatedRequestedShift: ShiftAssignment,
        updatedCandidateShift: ShiftAssignment,
        nowMillis: Int64
    ) -> [ShiftAssignment] {
        let replaced = map { shift in
            if shift.id == updatedRequestedShift.id {
                return updatedRequestedShift
            }
            if shift.id == updatedCandidateShift.id {
                return updatedCandidateShift
            }
            return shift
        }

        let deliveries = replaced
            .filter { $0.type == .delivery }
            .sorted { $0.dateMillis < $1.dateMillis }
        let helperByDeliveryId = Dictionary(
            uniqueKeysWithValues: deliveries.enumerated().map { index, shift in
                (shift.id, index + 1 < deliveries.count ? deliveries[index + 1].assignedUserIds.first : nil)
            }
        )

        return replaced.map { shift in
            guard shift.type == .delivery else { return shift }
            let recomputedHelper = helperByDeliveryId[shift.id] ?? nil
            guard shift.helperUserId != recomputedHelper else { return shift }
            return ShiftAssignment(
                id: shift.id,
                type: shift.type,
                dateMillis: shift.dateMillis,
                assignedUserIds: shift.assignedUserIds,
                helperUserId: recomputedHelper,
                status: .confirmed,
                source: "app",
                createdAtMillis: shift.createdAtMillis,
                updatedAtMillis: nowMillis
            )
        }
    }
}

private func localizedShiftNotificationDateTime(_ millis: Int64) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "es_ES")
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
}

private func displayName(for memberId: String, in session: AuthorizedSession) -> String {
    session.members.first(where: { $0.id == memberId })?.displayName ?? memberId
}

private func buildDeliveryCalendarOverride(
    weekKey: String,
    weekday: DeliveryWeekday,
    updatedByUserId: String,
    updatedAtMillis: Int64
) -> DeliveryCalendarOverride? {
    guard let weekStart = isoWeekStartDate(from: weekKey) else {
        return nil
    }
    let deliveryDate = Calendar.current.date(byAdding: .day, value: weekday.dayOffset, to: weekStart) ?? weekStart
    let blockedDate = Calendar.current.date(byAdding: .day, value: 1, to: deliveryDate) ?? deliveryDate
    let openDate = Calendar.current.date(byAdding: .day, value: 2, to: deliveryDate) ?? deliveryDate
    let closeBase = Calendar.current.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
    let openStartOfDay = Calendar.current.startOfDay(for: openDate)
    let closeDate = Calendar.current.date(
        bySettingHour: 23,
        minute: 59,
        second: 59,
        of: closeBase
    ) ?? closeBase

    return DeliveryCalendarOverride(
        weekKey: weekKey,
        deliveryDateMillis: Int64(deliveryDate.timeIntervalSince1970 * 1000),
        ordersBlockedDateMillis: Int64(Calendar.current.startOfDay(for: blockedDate).timeIntervalSince1970 * 1000),
        ordersOpenAtMillis: Int64(openStartOfDay.timeIntervalSince1970 * 1000),
        ordersCloseAtMillis: Int64(closeDate.timeIntervalSince1970 * 1000),
        updatedBy: updatedByUserId,
        updatedAtMillis: updatedAtMillis
    )
}

private func isoWeekStartDate(from weekKey: String) -> Date? {
    let parts = weekKey.components(separatedBy: "-W")
    guard parts.count == 2,
          let year = Int(parts[0]),
          let week = Int(parts[1])
    else {
        return nil
    }
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = .current
    var dateComponents = DateComponents()
    dateComponents.weekOfYear = week
    dateComponents.yearForWeekOfYear = year
    dateComponents.weekday = 2
    return calendar.date(from: dateComponents).map { calendar.startOfDay(for: $0) }
}

private struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(member: Member) async {}
}

private extension DeliveryWeekday {
    var dayOffset: Int {
        switch self {
        case .monday: return 0
        case .tuesday: return 1
        case .wednesday: return 2
        case .thursday: return 3
        case .friday: return 4
        case .saturday: return 5
        case .sunday: return 6
        }
    }
}

private extension String {
    var isValidEmail: Bool {
        range(
            of: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    var isValidPassword: Bool {
        (6...16).contains(count)
    }
}

private extension NotificationAudience {
    var targetValue: String {
        switch self {
        case .all:
            return "all"
        case .members, .producers, .admins:
            return "segment"
        }
    }

    var segmentType: String? {
        switch self {
        case .all:
            return nil
        case .members, .producers, .admins:
            return "role"
        }
    }

    var targetRole: MemberRole? {
        switch self {
        case .all:
            return nil
        case .members:
            return .member
        case .producers:
            return .producer
        case .admins:
            return .admin
        }
    }
}

extension SessionMode {
    var isAuthenticatedSession: Bool {
        switch self {
        case .authorized, .unauthorized:
            return true
        case .signedOut:
            return false
        }
    }
}

private struct FixedCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?

    func getConfig() async -> CriticalDataFreshnessConfig? {
        config
    }
}
