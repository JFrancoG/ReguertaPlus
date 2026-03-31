import FirebaseAuth
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaTests {
    @Test
    func unauthorizedEmailStaysRestricted() async {
        let repository = InMemoryMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(repository: repository)

        let result = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_unknown", email: "unknown@reguerta.app")
        )

        #expect(result == .unauthorized(.userNotFoundInAuthorizedUsers))
    }

    @Test
    func existingInactiveMemberDoesNotUseMissingUsersReason() async {
        let repository = InMemoryMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(repository: repository)

        _ = await repository.upsert(
            member: Member(
                id: "member_inactive_001",
                displayName: "Inactiva",
                normalizedEmail: "inactive@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: false,
                producerCatalogEnabled: true
            )
        )

        let result = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_inactive", email: "inactive@reguerta.app")
        )

        #expect(result == .unauthorized(.userAccessRestricted))
    }

    @Test
    func firstAuthorizedLoginLinksAuthUid() async {
        let repository = InMemoryMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(repository: repository)

        let result = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_1", email: "ana.admin@reguerta.app")
        )

        guard case .authorized(let member) = result else {
            Issue.record("Expected authorized session")
            return
        }

        #expect(member.authUid == "uid_admin_1")
    }

    @Test
    func preventRemovingLastActiveAdmin() async {
        let repository = InMemoryMemberRepository()
        let resolveUseCase = ResolveAuthorizedSessionUseCase(repository: repository)
        let upsertUseCase = UpsertMemberByAdminUseCase(repository: repository)

        _ = await resolveUseCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_2", email: "ana.admin@reguerta.app")
        )

        guard let admin = await repository.findByEmailNormalized("ana.admin@reguerta.app") else {
            Issue.record("Expected seeded admin")
            return
        }

        do {
            _ = try await upsertUseCase.execute(
                actorAuthUid: "uid_admin_2",
                target: Member(
                    id: admin.id,
                    displayName: admin.displayName,
                    normalizedEmail: admin.normalizedEmail,
                    authUid: admin.authUid,
                    roles: [.member],
                    isActive: admin.isActive,
                    producerCatalogEnabled: admin.producerCatalogEnabled
                )
            )
            Issue.record("Expected last admin protection")
        } catch let error as MemberManagementError {
            #expect(error == .lastAdminRemoval)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test
    func adminCanCreatePreAuthorizedMember() async throws {
        let repository = InMemoryMemberRepository()
        let resolveUseCase = ResolveAuthorizedSessionUseCase(repository: repository)
        let upsertUseCase = UpsertMemberByAdminUseCase(repository: repository)

        _ = await resolveUseCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_3", email: "ana.admin@reguerta.app")
        )

        let created = try await upsertUseCase.execute(
            actorAuthUid: "uid_admin_3",
            target: Member(
                id: "member_new_001",
                displayName: "Nuevo Miembro",
                normalizedEmail: "nuevo@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: true,
                producerCatalogEnabled: true
            )
        )

        #expect(created.normalizedEmail == "nuevo@reguerta.app")
        #expect(await repository.findByEmailNormalized("nuevo@reguerta.app") != nil)
    }

    @Test
    func authShellRoutesSplashToWelcomeWhenNoSession() {
        let reduced = reduceAuthShell(
            state: AuthShellState(),
            action: .splashCompleted(isAuthenticated: false)
        )

        #expect(reduced.currentRoute == .welcome)
        #expect(reduced.canGoBack == false)
    }

    @Test
    func authShellDeterministicBackFlowForLoginRegister() {
        let welcome = AuthShellState(backStack: [.welcome])
        let login = reduceAuthShell(state: welcome, action: .continueFromWelcome)
        let register = reduceAuthShell(state: login, action: .openRegisterFromLogin)
        let backToLogin = reduceAuthShell(state: register, action: .back)
        let backToWelcome = reduceAuthShell(state: backToLogin, action: .back)

        #expect(login.currentRoute == .login)
        #expect(register.currentRoute == .register)
        #expect(backToLogin.currentRoute == .login)
        #expect(backToWelcome.currentRoute == .welcome)
    }

    @Test
    func authShellCanOpenRegisterDirectlyFromWelcome() {
        let welcome = AuthShellState(backStack: [.welcome])
        let register = reduceAuthShell(state: welcome, action: .openRegisterFromWelcome)
        let backToWelcome = reduceAuthShell(state: register, action: .back)

        #expect(register.currentRoute == .register)
        #expect(backToWelcome.currentRoute == .welcome)
    }

    @Test
    func authShellResetsToHomeOnAuthenticatedSession() {
        let state = AuthShellState(backStack: [.welcome, .login, .recoverPassword])
        let reduced = reduceAuthShell(state: state, action: .sessionAuthenticated)

        #expect(reduced.currentRoute == .home)
        #expect(reduced.canGoBack == false)
    }

    @Test
    func authShellResetsToWelcomeOnSignOut() {
        let state = AuthShellState(backStack: [.home])
        let reduced = reduceAuthShell(state: state, action: .signedOut)

        #expect(reduced.currentRoute == .welcome)
        #expect(reduced.canGoBack == false)
    }

    @Test
    func inMemoryNewsRepositoryReturnsNewestFirst() async {
        let repository = InMemoryNewsRepository()

        _ = await repository.upsert(
            article: NewsArticle(
                id: "news_002",
                title: "Nueva noticia",
                body: "Texto",
                active: true,
                publishedBy: "Ana Admin",
                publishedAtMillis: 4_000_000_000_000,
                urlImage: nil
            )
        )

        let news = await repository.allNews()

        #expect(news.first?.id == "news_002")
    }

    @Test
    func inMemoryNewsRepositoryDeletesExistingNews() async {
        let repository = InMemoryNewsRepository()

        let deleted = await repository.delete(newsId: "news_welcome_001")
        let remaining = await repository.allNews()

        #expect(deleted == true)
        #expect(remaining.contains(where: { $0.id == "news_welcome_001" }) == false)
    }

    @Test
    func firebaseAuthErrorMappingCoversKnownCodes() {
        let invalidEmail = NSError(domain: AuthErrorDomain, code: AuthErrorCode.invalidEmail.rawValue)
        let wrongPassword = NSError(domain: AuthErrorDomain, code: AuthErrorCode.wrongPassword.rawValue)
        let emailAlreadyInUse = NSError(domain: AuthErrorDomain, code: AuthErrorCode.emailAlreadyInUse.rawValue)
        let weakPassword = NSError(domain: AuthErrorDomain, code: AuthErrorCode.weakPassword.rawValue)
        let notFound = NSError(domain: AuthErrorDomain, code: AuthErrorCode.userNotFound.rawValue)
        let disabled = NSError(domain: AuthErrorDomain, code: AuthErrorCode.userDisabled.rawValue)
        let tooMany = NSError(domain: AuthErrorDomain, code: AuthErrorCode.tooManyRequests.rawValue)
        let network = NSError(domain: AuthErrorDomain, code: AuthErrorCode.networkError.rawValue)

        #expect(mapFirebaseAuthError(invalidEmail) == .invalidEmail)
        #expect(mapFirebaseAuthError(wrongPassword) == .invalidCredentials)
        #expect(mapFirebaseAuthError(emailAlreadyInUse) == .emailAlreadyInUse)
        #expect(mapFirebaseAuthError(weakPassword) == .weakPassword)
        #expect(mapFirebaseAuthError(notFound) == .userNotFound)
        #expect(mapFirebaseAuthError(disabled) == .userDisabled)
        #expect(mapFirebaseAuthError(tooMany) == .tooManyRequests)
        #expect(mapFirebaseAuthError(network) == .network)
    }

    @Test
    func authErrorPresentationMappingByFlow() {
        let signIn = mapAuthFailure(.invalidCredentials, flow: .signIn)
        #expect(signIn.passwordErrorKey == AccessL10nKey.authErrorInvalidCredentials)
        #expect(signIn.emailErrorKey == nil)

        let signUp = mapAuthFailure(.emailAlreadyInUse, flow: .signUp)
        #expect(signUp.emailErrorKey == AccessL10nKey.authErrorEmailAlreadyInUse)

        let passwordReset = mapAuthFailure(.invalidCredentials, flow: .passwordReset)
        #expect(passwordReset.globalMessageKey == AccessL10nKey.authErrorUnknown)
    }

    @Test
    func semanticComparatorSupportsVariableVersionSegments() {
        #expect(SemanticVersionComparator.compare("0.3", "0.3.0") == 0)
        #expect(SemanticVersionComparator.compare("0.3.0.1", "0.3.0") == 1)
        #expect(SemanticVersionComparator.compare("0.2.9", "0.3.0") == -1)
        #expect(SemanticVersionComparator.compare("0.3-beta", "0.3.0") == nil)
    }

    @Test
    func startupGateBlocksOutdatedVersionWhenForceUpdateIsActive() {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(
                policy: StartupVersionPolicy(
                    currentVersion: "0.3.1",
                    minimumVersion: "0.3.0",
                    forceUpdate: true,
                    storeURL: "https://apps.apple.com"
                )
            )
        )

        let decision = useCase.evaluate(
            installedVersion: "0.2.9",
            policy: StartupVersionPolicy(
                currentVersion: "0.3.1",
                minimumVersion: "0.3.0",
                forceUpdate: true,
                storeURL: "https://apps.apple.com"
            )
        )

        #expect(decision == .forcedUpdate(storeURL: "https://apps.apple.com"))
    }

    @Test
    func startupGateWarnsWhenVersionIsBelowCurrent() {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(
                policy: StartupVersionPolicy(
                    currentVersion: "0.3.1",
                    minimumVersion: "0.3.0",
                    forceUpdate: false,
                    storeURL: "https://apps.apple.com"
                )
            )
        )

        let decision = useCase.evaluate(
            installedVersion: "0.3.0",
            policy: StartupVersionPolicy(
                currentVersion: "0.3.1",
                minimumVersion: "0.3.0",
                forceUpdate: false,
                storeURL: "https://apps.apple.com"
            )
        )

        #expect(decision == .optionalUpdate(storeURL: "https://apps.apple.com"))
    }

    @Test
    func startupGateFallsBackToAllowWhenPolicyIsMalformed() {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(
                policy: StartupVersionPolicy(
                    currentVersion: "invalid",
                    minimumVersion: "0.3.0",
                    forceUpdate: true,
                    storeURL: "https://apps.apple.com"
                )
            )
        )

        let decision = useCase.evaluate(
            installedVersion: "0.2.9",
            policy: StartupVersionPolicy(
                currentVersion: "invalid",
                minimumVersion: "0.3.0",
                forceUpdate: true,
                storeURL: "https://apps.apple.com"
            )
        )

        #expect(decision == .allow)
    }

    @Test
    func criticalDataFreshnessRejectsMissingTimestampKeys() {
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
            localRepository: InMemoryCriticalDataFreshnessLocalRepository()
        )

        let evaluation = useCase.evaluate(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: [
                    .users: 1_000,
                    .products: 1_000,
                    .orders: 1_000,
                    .containers: 1_000,
                    .measures: 1_000,
                ]
            ),
            metadata: nil,
            nowMillis: 10_000
        )

        #expect(evaluation == .invalidConfig)
    }

    @Test
    func criticalDataFreshnessPersistsWhenRemoteTimestampsChange() {
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
            localRepository: InMemoryCriticalDataFreshnessLocalRepository()
        )
        let remoteTimestamps = Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(2_000)) }
        )

        let evaluation = useCase.evaluate(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: remoteTimestamps
            ),
            metadata: CriticalDataFreshnessMetadata(
                validatedAtMillis: 5_000,
                acknowledgedTimestampsMillis: Dictionary(
                    uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(1_000)) }
                )
            ),
            nowMillis: 6_000
        )

        #expect(
            evaluation == .accepted(
                metadataToPersist: CriticalDataFreshnessMetadata(
                    validatedAtMillis: 6_000,
                    acknowledgedTimestampsMillis: remoteTimestamps
                )
            )
        )
    }

    @Test
    func criticalDataFreshnessKeepsMetadataWhenTtlIsStillValid() {
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
            localRepository: InMemoryCriticalDataFreshnessLocalRepository()
        )
        let remoteTimestamps = Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(2_000)) }
        )

        let evaluation = useCase.evaluate(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: remoteTimestamps
            ),
            metadata: CriticalDataFreshnessMetadata(
                validatedAtMillis: 10_000,
                acknowledgedTimestampsMillis: remoteTimestamps
            ),
            nowMillis: 20_000
        )

        #expect(evaluation == .accepted(metadataToPersist: nil))
    }

    @Test
    func sessionRefreshPolicyDebouncesForegroundTransitions() {
        let policy = SessionRefreshPolicy(minimumForegroundIntervalMillis: 15_000)

        #expect(policy.shouldRefresh(
            trigger: .startup,
            lastRefreshAtMillis: nil,
            nowMillis: 1_000,
            isRefreshInFlight: false
        ))
        #expect(!policy.shouldRefresh(
            trigger: .startup,
            lastRefreshAtMillis: 1_000,
            nowMillis: 2_000,
            isRefreshInFlight: false
        ))
        #expect(!policy.shouldRefresh(
            trigger: .foreground,
            lastRefreshAtMillis: 10_000,
            nowMillis: 20_000,
            isRefreshInFlight: false
        ))
        #expect(policy.shouldRefresh(
            trigger: .foreground,
            lastRefreshAtMillis: 10_000,
            nowMillis: 25_000,
            isRefreshInFlight: false
        ))
    }

    @Test
    func startupRefreshRestoresAuthorizedSession() async {
        let provider = TestAuthSessionProvider(
            refreshResult: .active(AuthPrincipal(uid: "uid_admin_restore", email: "ana.admin@reguerta.app"))
        )
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(),
            authSessionProvider: provider,
            sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 15_000),
            nowMillisProvider: { 1_000 }
        )

        viewModel.refreshSession(trigger: .startup)
        await waitForCondition { viewModel.mode.isAuthenticatedSession }

        guard case .authorized(let session) = viewModel.mode else {
            Issue.record("Expected restored authorized session")
            return
        }

        #expect(session.principal.uid == "uid_admin_restore")
        #expect(viewModel.showSessionExpiredDialog == false)
    }

    @Test
    func expiredRefreshSignsOutAndShowsRecoveryDialog() async {
        let provider = TestAuthSessionProvider(
            signInResult: .success(AuthPrincipal(uid: "uid_admin_expired", email: "ana.admin@reguerta.app")),
            refreshResult: .expired
        )
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(),
            authSessionProvider: provider,
            sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 15_000),
            nowMillisProvider: { 1_000 }
        )

        viewModel.emailInput = "ana.admin@reguerta.app"
        viewModel.passwordInput = "test1234"
        viewModel.signIn()
        await waitForCondition { viewModel.mode.isAuthenticatedSession }

        #expect(viewModel.mode.isAuthenticatedSession)

        viewModel.refreshSession(trigger: .foreground)
        await waitForCondition { viewModel.mode == .signedOut && viewModel.showSessionExpiredDialog }

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.showSessionExpiredDialog)
    }
}

private struct FixedStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    let policy: StartupVersionPolicy?

    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy? {
        policy
    }
}

private struct FixedCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?

    func getConfig() async -> CriticalDataFreshnessConfig? {
        config
    }
}

private actor InMemoryCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?

    func getMetadata() async -> CriticalDataFreshnessMetadata? {
        metadata
    }

    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) async {
        self.metadata = metadata
    }

    func clear() async {
        metadata = nil
    }
}

@MainActor
private final class TestAuthSessionProvider: AuthSessionProvider {
    private let signInResult: AuthSignInResult
    private let refreshResult: AuthSessionRefreshResult

    init(
        signInResult: AuthSignInResult = .failure(.invalidCredentials),
        refreshResult: AuthSessionRefreshResult = .noSession
    ) {
        self.signInResult = signInResult
        self.refreshResult = refreshResult
    }

    func signIn(email: String, password: String) async -> AuthSignInResult {
        signInResult
    }

    func signUp(email: String, password: String) async -> AuthSignInResult {
        signInResult
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        .success
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        refreshResult
    }

    func signOut() {
    }
}

@MainActor
private func waitForCondition(
    timeoutNanoseconds: UInt64 = 500_000_000,
    pollNanoseconds: UInt64 = 10_000_000,
    condition: @escaping @MainActor () -> Bool
) async {
    let start = ContinuousClock.now
    while !condition() {
        if ContinuousClock.now - start >= .nanoseconds(Int(timeoutNanoseconds)) {
            return
        }
        try? await Task.sleep(nanoseconds: pollNanoseconds)
    }
}
