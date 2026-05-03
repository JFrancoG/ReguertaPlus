import FirebaseAuth
import Foundation
import Testing

// swiftlint:disable file_length

@testable import Reguerta

@MainActor
// swiftlint:disable:next type_body_length
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
    func authUidMatchWinsOverEmailDuplicate() async {
        let repository = InMemoryMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(repository: repository)

        _ = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_linked", email: "ana.admin@reguerta.app")
        )

        _ = await repository.upsert(
            member: Member(
                id: "member_duplicate_email",
                displayName: "Duplicado",
                normalizedEmail: "ana.admin@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: true,
                producerCatalogEnabled: true
            )
        )

        let result = await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_linked", email: "ana.admin@reguerta.app")
        )

        guard case .authorized(let member) = result else {
            Issue.record("Expected linked authorization to succeed")
            return
        }
        #expect(member.authUid == "uid_admin_linked")
        #expect(member.roles.contains(.admin))
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
    func inMemoryNotificationRepositoryReturnsNewestFirst() async {
        let repository = InMemoryNotificationRepository()

        _ = await repository.send(
            event: NotificationEvent(
                id: "notification_002",
                title: "Aviso",
                body: "Texto",
                type: "admin_broadcast",
                target: "all",
                userIds: [],
                segmentType: nil,
                targetRole: nil,
                createdBy: "adminUid",
                sentAtMillis: 4_000_000_000_000,
                weekKey: nil
            )
        )

        let notifications = await repository.allNotifications()

        #expect(notifications.first?.id == "notification_002")
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
    func receivedOrderStatusWriteResultMapsPermissionDenied() {
        let error = NSError(
            domain: "FIRFirestoreErrorDomain",
            code: 7
        )

        #expect(receivedOrderStatusWriteResult(from: error) == .permissionDenied)
    }

    @Test
    func receivedOrderStatusWriteResultMapsUnknownAsFailure() {
        let error = NSError(domain: "example", code: -99)

        #expect(receivedOrderStatusWriteResult(from: error) == .failure)
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

    @Test
    func myOrderValidationBlocksMissingWeeklyCommitment() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let ecoBasket = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [ecoBasket],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:]
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Ecocesta"])
        #expect(result.hasEcoBasketPriceMismatch == false)
    }

    @Test
    func myOrderValidationAcceptsNoPickupAsPaidCommitment() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let ecoBasket = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [ecoBasket],
            selectedQuantities: [ecoBasket.id: 1],
            selectedEcoBasketOptions: [ecoBasket.id: ecoBasketOptionNoPickup]
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationRequiresParityProducerInBiweeklyMode() {
        let currentMember = member(
            id: "member_1",
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .even
        )
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoEven = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id, name: "Ecocesta par")
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, name: "Ecocesta impar")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoEven, ecoOdd],
            selectedQuantities: [ecoOdd.id: 1],
            selectedEcoBasketOptions: [ecoOdd.id: ecoBasketOptionPickup],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Ecocesta par"])
    }

    @Test
    func myOrderValidationDoesNotRequireBiweeklyCommitmentOnOppositeWeek() {
        let currentMember = member(
            id: "member_1",
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .even
        )
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, name: "Ecocesta impar")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoOdd],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .odd
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentProduct() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 1)],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksExceededSeasonalCommitmentQuantity() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 2)],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.exceededCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationFlagsIncompatibleSeasonalCommitmentStep() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        var avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")
        avocados = Product(
            id: avocados.id,
            vendorId: avocados.vendorId,
            companyName: avocados.companyName,
            name: avocados.name,
            description: avocados.description,
            productImageUrl: avocados.productImageUrl,
            price: avocados.price,
            pricingMode: .weight,
            unitName: "kg",
            unitAbbreviation: "kg",
            unitPlural: "kg",
            unitQty: 1.0,
            packContainerName: avocados.packContainerName,
            packContainerAbbreviation: avocados.packContainerAbbreviation,
            packContainerPlural: avocados.packContainerPlural,
            packContainerQty: avocados.packContainerQty,
            isAvailable: avocados.isAvailable,
            stockMode: avocados.stockMode,
            stockQty: avocados.stockQty,
            isEcoBasket: avocados.isEcoBasket,
            isCommonPurchase: avocados.isCommonPurchase,
            commonPurchaseType: avocados.commonPurchaseType,
            archived: avocados.archived,
            createdAtMillis: avocados.createdAtMillis,
            updatedAtMillis: avocados.updatedAtMillis
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 3.5)],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.incompatibleCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationIgnoresSeasonalCommitmentWhenProductNotOffered() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [],
            seasonalCommitments: [seasonalCommitment(productId: "seasonal_hidden", fixedQtyPerOfferedWeek: 1)],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentUsingSeasonKeyFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_mango_commitment",
                    seasonKey: "2026-aguacate",
                    fixedQtyPerOfferedWeek: 1
                )
            ],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentUsingSeasonCodeFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_code_commitment",
                    seasonKey: "AVO-2025-26",
                    fixedQtyPerOfferedWeek: 1
                )
            ],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksExceededSeasonalCommitmentUsingSeasonCodeFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_code_commitment",
                    seasonKey: "AVO-2025-26",
                    fixedQtyPerOfferedWeek: 2
                )
            ],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.exceededCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationFlagsEcoBasketPriceMismatch() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoEven = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id, price: 2.0)
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, price: 2.5)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoEven, ecoOdd],
            selectedQuantities: [ecoEven.id: 1],
            selectedEcoBasketOptions: [ecoEven.id: ecoBasketOptionPickup]
        )

        #expect(result.hasEcoBasketPriceMismatch == true)
    }

    @Test
    func seasonalCommitmentLookupKeysIncludeMemberIdAuthUIDAndEmail() {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "member_1@reguerta.app",
            authUid: "uid_member_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )

        #expect(member.seasonalCommitmentLookupKeys == ["member_1", "uid_member_1", "member_1@reguerta.app"])
    }

    @Test
    func seasonalCommitmentLookupKeysRemoveDuplicatesAndBlanks() {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "   ",
            authUid: " member_1 ",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )

        #expect(member.seasonalCommitmentLookupKeys == ["member_1"])
    }

    @Test
    func canonicalMatrixCapabilitiesMatchIOSPermissionMatrix() throws {
        let matrix = try loadCanonicalMatrix()

        for role in CanonicalAccessRole.allCases {
            let expected = Set(
                matrix[role.rawValue, default: []]
                    .compactMap(AccessCapability.init(rawValue:))
            )
            #expect(MemberPermissionMatrix.capabilities(for: role) == expected)
        }
    }

    @Test
    func commonPurchaseManagerOverrideGrantsCatalogManagement() {
        let member = Member(
            id: "member_common_purchase_001",
            displayName: "Compra común",
            normalizedEmail: "compras@reguerta.app",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: true
        )

        #expect(member.canManageProductCatalog)
    }

    @Test
    func inMemoryFixturesStayAlignedWithCanonicalMatrix() async {
        let repository = InMemoryMemberRepository()
        let membersById = Dictionary(
            uniqueKeysWithValues: await repository.allMembers().map { ($0.id, $0) }
        )

        if let admin = membersById["member_admin_001"] {
            #expect(admin.canManageMembers)
            #expect(admin.canGrantAdminRole)
            #expect(admin.canPublishNews)
            #expect(admin.canSendAdminNotifications)
        } else {
            Issue.record("Missing seeded admin fixture")
        }

        if let producer = membersById["member_producer_001"] {
            #expect(producer.canManageProductCatalog)
            #expect(producer.canAccessReceivedOrders)
        } else {
            Issue.record("Missing seeded producer fixture")
        }

        if let member = membersById["member_member_001"] {
            #expect(member.canAccessCommonHomeModules)
            #expect(member.canManageMembers == false)
            #expect(member.canAccessReceivedOrders == false)
        } else {
            Issue.record("Missing seeded member fixture")
        }
    }

    private func loadCanonicalMatrix() throws -> [String: Set<String>] {
        let matrixURL = try findCanonicalMatrixURL()
        let data = try Data(contentsOf: matrixURL)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let roles = root["roles"] as? [String: [String: Any]] else {
            throw MatrixLoadError.invalidPayload
        }

        func resolveCapabilities(
            roleName: String,
            visiting: inout Set<String>
        ) throws -> Set<String> {
            guard let role = roles[roleName] else { return [] }
            if visiting.contains(roleName) {
                throw MatrixLoadError.inheritanceCycle(roleName)
            }
            visiting.insert(roleName)
            defer { visiting.remove(roleName) }

            let direct = Set(stringArray(role["capabilities"]))
            let inherited = stringArray(role["inherits"])
            let inheritedCapabilities = try inherited.reduce(into: Set<String>()) { partialResult, inheritedRole in
                partialResult.formUnion(try resolveCapabilities(roleName: inheritedRole, visiting: &visiting))
            }
            return direct.union(inheritedCapabilities)
        }

        return try roles.keys.reduce(into: [String: Set<String>]()) { partialResult, roleName in
            var visiting = Set<String>()
            partialResult[roleName] = try resolveCapabilities(roleName: roleName, visiting: &visiting)
        }
    }

    private func findCanonicalMatrixURL() throws -> URL {
        var cursor = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let fileManager = FileManager.default
        while true {
            let candidate = cursor.appendingPathComponent(Self.matrixRelativePath)
            if fileManager.fileExists(atPath: candidate.path) {
                return candidate
            }
            let parent = cursor.deletingLastPathComponent()
            if parent.path == cursor.path {
                break
            }
            cursor = parent
        }
        throw MatrixLoadError.fileNotFound
    }

    private func stringArray(_ value: Any?) -> [String] {
        (value as? [String])?
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty } ?? []
    }

    private enum MatrixLoadError: Error {
        case fileNotFound
        case invalidPayload
        case inheritanceCycle(String)
    }

    private func member(
        id: String,
        ecoCommitmentMode: EcoCommitmentMode,
        ecoCommitmentParity: ProducerParity? = nil
    ) -> Member {
        Member(
            id: id,
            displayName: "Member",
            normalizedEmail: "\(id)@reguerta.app",
            authUid: "auth_\(id)",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }

    private func producer(id: String, parity: ProducerParity) -> Member {
        Member(
            id: id,
            displayName: id,
            normalizedEmail: "\(id)@reguerta.app",
            authUid: nil,
            roles: [.producer],
            isActive: true,
            producerCatalogEnabled: true,
            producerParity: parity
        )
    }

    private func ecoBasketProduct(
        id: String,
        vendorId: String,
        name: String = "Ecocesta",
        price: Double = 2.0
    ) -> Product {
        Product(
            id: id,
            vendorId: vendorId,
            companyName: vendorId,
            name: name,
            description: "",
            productImageUrl: nil,
            price: price,
            pricingMode: .fixed,
            unitName: "unit",
            unitAbbreviation: "ud",
            unitPlural: "units",
            unitQty: 1.0,
            packContainerName: nil,
            packContainerAbbreviation: nil,
            packContainerPlural: nil,
            packContainerQty: nil,
            isAvailable: true,
            stockMode: .infinite,
            stockQty: nil,
            isEcoBasket: true,
            isCommonPurchase: false,
            commonPurchaseType: nil,
            archived: false,
            createdAtMillis: 1,
            updatedAtMillis: 1
        )
    }

    private func regularProduct(
        id: String,
        vendorId: String,
        name: String
    ) -> Product {
        Product(
            id: id,
            vendorId: vendorId,
            companyName: vendorId,
            name: name,
            description: "",
            productImageUrl: nil,
            price: 2.0,
            pricingMode: .fixed,
            unitName: "unit",
            unitAbbreviation: "ud",
            unitPlural: "units",
            unitQty: 1.0,
            packContainerName: nil,
            packContainerAbbreviation: nil,
            packContainerPlural: nil,
            packContainerQty: nil,
            isAvailable: true,
            stockMode: .infinite,
            stockQty: nil,
            isEcoBasket: false,
            isCommonPurchase: false,
            commonPurchaseType: nil,
            archived: false,
            createdAtMillis: 1,
            updatedAtMillis: 1
        )
    }

    private func seasonalCommitment(
        productId: String,
        seasonKey: String = "2026",
        productNameHint: String? = nil,
        fixedQtyPerOfferedWeek: Double
    ) -> SeasonalCommitment {
        SeasonalCommitment(
            id: "commitment_\(productId)",
            userId: "member_1",
            productId: productId,
            productNameHint: productNameHint,
            seasonKey: seasonKey,
            fixedQtyPerOfferedWeek: fixedQtyPerOfferedWeek,
            active: true,
            createdAtMillis: 1,
            updatedAtMillis: 1
        )
    }

    @Test
    func homeWeeklySummaryUsesCurrentWeekBeforeDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 6),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8)],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W19")
        #expect(display.weekRangeLabel == "4 may - 10 may")
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test
    func homeWeeklySummaryMovesToNextWeekAfterDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 9),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [
                testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8),
                testDeliveryShift(id: "delivery_w20", year: 2026, month: 5, day: 15),
            ],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W20")
        #expect(display.weekRangeLabel == "11 may - 17 may")
    }

    @Test
    func homeOrderStateMappingUsesConfirmedBeforeDraft() {
        let suiteName = "home-order-state-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let cartKey = "reguerta_my_order_cart.member_member_1_week_2026-W19.quantities"
        let confirmedKey = "reguerta_my_order_cart.member_member_1_week_2026-W19.confirmed_quantities"

        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .notStarted)
        defaults.set(["product_1": 2], forKey: cartKey)
        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .unconfirmed)
        defaults.set(["product_1": 2], forKey: confirmedKey)
        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .completed)
    }

    private static let matrixRelativePath =
        "spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json"
}

private func testMillis(year: Int, month: Int, day: Int) -> Int64 {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Madrid")!
    let date = calendar.date(from: DateComponents(year: year, month: month, day: day))!
    return Int64(date.timeIntervalSince1970 * 1_000)
}

private func testDeliveryShift(id: String, year: Int, month: Int, day: Int) -> ShiftAssignment {
    ShiftAssignment(
        id: id,
        type: .delivery,
        dateMillis: testMillis(year: year, month: month, day: day),
        assignedUserIds: ["member_1"],
        helperUserId: "member_2",
        status: .confirmed,
        source: "test",
        createdAtMillis: 0,
        updatedAtMillis: 0
    )
}

private let homeSummaryMembers = [
    Member(
        id: "member_1",
        displayName: "Carmen",
        normalizedEmail: "carmen@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "member_2",
        displayName: "Javier",
        normalizedEmail: "javier@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "producer_1",
        displayName: "Huerta Norte",
        companyName: "Huerta Norte",
        normalizedEmail: "huerta@reguerta.test",
        authUid: nil,
        roles: [.producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .odd
    ),
]

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

// swiftlint:enable file_length
