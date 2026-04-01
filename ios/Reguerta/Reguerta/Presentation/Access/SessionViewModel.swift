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

struct AuthorizedSession: Equatable, Sendable {
    var principal: AuthPrincipal
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
    var editingNewsId: String?
    var isLoadingNews = false
    var isSavingNews = false
    var isLoadingNotifications = false
    var isSendingNotification = false

    private let repository: any MemberRepository
    private let newsRepository: any NewsRepository
    private let notificationRepository: any NotificationRepository
    private let authSessionProvider: any AuthSessionProvider
    private let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    private let upsertMemberByAdmin: UpsertMemberByAdminUseCase
    private let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    private let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    private let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    private let sessionRefreshPolicy: SessionRefreshPolicy
    private let nowMillisProvider: @Sendable () -> Int64
    private var lastSessionRefreshAtMillis: Int64?
    private var isSessionRefreshInFlight = false

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
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        upsertMemberByAdmin: UpsertMemberByAdminUseCase? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
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
        editingNewsId = nil
        isLoadingNews = false
        isSavingNews = false
        isLoadingNotifications = false
        isSendingNotification = false
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
                    createdBy: session.principal.uid,
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

    private func applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Bool = true
    ) async {
        let result = await resolveAuthorizedSession.execute(authPrincipal: principal)
        switch result {
        case .authorized(let member):
            let members = await repository.allMembers()
            let allNotifications = await notificationRepository.allNotifications()
            mode = .authorized(
                AuthorizedSession(
                    principal: principal,
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
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = member.isAdmin ? allNews : allNews.filter(\.active)
            notificationsFeed = allNotifications.filter { $0.isVisible(to: member) }
            isLoadingNews = false
            isLoadingNotifications = false
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
            editingNewsId = nil
            isLoadingNews = false
            isSavingNews = false
            isLoadingNotifications = false
            isSendingNotification = false
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
        editingNewsId = nil
        isLoadingNews = false
        isSavingNews = false
        isLoadingNotifications = false
        isSendingNotification = false
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
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
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

private struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(member: Member) async {}
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
