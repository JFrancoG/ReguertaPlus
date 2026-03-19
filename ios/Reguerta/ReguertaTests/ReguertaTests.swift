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

        #expect(result == .unauthorized(.userNotAuthorized))
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
