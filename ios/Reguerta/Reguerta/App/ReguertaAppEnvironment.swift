import FirebaseCore
import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let feedbackCenter: GlobalFeedbackCenter
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar

    @MainActor
    static func live() -> ReguertaAppEnvironment {
        if ProcessInfo.processInfo.arguments.contains("-useMockAuth") {
            return uiTesting()
        }
        FirebaseBootstrapper.configureIfNeeded()

        let dependencies = LiveRootDependencies()
        let feedbackCenter = GlobalFeedbackCenter()
        let sessionViewModel = makeLiveSessionViewModel(
            dependencies,
            feedbackCenter: feedbackCenter
        )
        let accessRootViewModel = makeLiveAccessRootViewModel(
            dependencies,
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter
        )

        return ReguertaAppEnvironment(
            feedbackCenter: feedbackCenter,
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel,
            authorizedDeviceRegistrar: dependencies.authorizedDeviceRegistrar
        )
    }

    @MainActor
    static func preview() -> ReguertaAppEnvironment {
        let memberRepository = InMemoryMemberRepository()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let authorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar()
        let developmentTimeMachine = DevelopmentTimeMachine()
        let freshnessDependencies = MyOrderFreshnessFeatureDependencies.preview()
        let sessionViewModel = SessionViewModel(
            dependencies: .preview(
                repository: memberRepository,
                feedbackCenter: feedbackCenter,
                authorizedDeviceRegistrar: authorizedDeviceRegistrar,
                criticalDataFreshnessLocalRepository:
                    freshnessDependencies.criticalDataFreshnessLocalRepository
            )
        )
        let accessRootViewModel = AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            productsFeatureDependencies: .preview(),
            ordersFeatureDependencies: .preview(),
            shiftsFeatureDependencies: .preview(notificationRepository: notificationRepository),
            newsNotificationsFeatureDependencies: .preview(notificationRepository: notificationRepository),
            sharedProfileFeatureDependencies: .preview(),
            usersFeatureDependencies: .preview(memberRepository: memberRepository),
            myOrderFreshnessFeatureDependencies: freshnessDependencies,
            bylawsFeatureDependencies: .preview(),
            developmentTimeMachine: developmentTimeMachine,
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: PreviewStartupVersionPolicyRepository(),
                environment: .develop
            ),
            installedVersionProvider: { "0.0.0-preview" }
        )

        return ReguertaAppEnvironment(
            feedbackCenter: feedbackCenter,
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel,
            authorizedDeviceRegistrar: authorizedDeviceRegistrar
        )
    }

    @MainActor
    static func uiTesting() -> ReguertaAppEnvironment {
        let memberRepository = InMemoryMemberRepository()
        let newsRepository = InMemoryNewsRepository.uiTesting()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let authorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar()
        let developmentTimeMachine = DevelopmentTimeMachine()
        let nowMillisProvider: @MainActor () -> Int64 = {
            developmentTimeMachine.nowMillis()
        }
        let freshnessConfig = CriticalDataFreshnessConfig(
            cacheExpirationMinutes: 15,
            remoteTimestampsMillis: Dictionary(
                uniqueKeysWithValues: CriticalCollection.allCases.map {
                    ($0, 1_000)
                }
            )
        )
        let freshnessDependencies = MyOrderFreshnessFeatureDependencies.preview(
            remoteConfig: freshnessConfig,
            nowProvider: { developmentTimeMachine.nowMillis() }
        )
        let sessionViewModel = SessionViewModel(
            dependencies: .preview(
                repository: memberRepository,
                feedbackCenter: feedbackCenter,
                authorizedDeviceRegistrar: authorizedDeviceRegistrar,
                criticalDataFreshnessLocalRepository:
                    freshnessDependencies.criticalDataFreshnessLocalRepository
            )
        )
        let accessRootViewModel = makeUITestingAccessRootViewModel(
            UITestingAccessRootDependencies(
                sessionViewModel: sessionViewModel,
                feedbackCenter: feedbackCenter,
                memberRepository: memberRepository,
                newsRepository: newsRepository,
                notificationRepository: notificationRepository,
                freshnessDependencies: freshnessDependencies,
                developmentTimeMachine: developmentTimeMachine,
                nowMillisProvider: nowMillisProvider
            )
        )

        return ReguertaAppEnvironment(
            feedbackCenter: feedbackCenter,
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel,
            authorizedDeviceRegistrar: authorizedDeviceRegistrar
        )
    }
}

private struct UITestingAccessRootDependencies {
    let sessionViewModel: SessionViewModel
    let feedbackCenter: GlobalFeedbackCenter
    let memberRepository: InMemoryMemberRepository
    let newsRepository: InMemoryNewsRepository
    let notificationRepository: InMemoryNotificationRepository
    let freshnessDependencies: MyOrderFreshnessFeatureDependencies
    let developmentTimeMachine: DevelopmentTimeMachine
    let nowMillisProvider: @MainActor () -> Int64
}

@MainActor
private func makeUITestingAccessRootViewModel(_ dependencies: UITestingAccessRootDependencies) -> AccessRootViewModel {
    AccessRootViewModel(
        sessionViewModel: dependencies.sessionViewModel,
        feedbackCenter: dependencies.feedbackCenter,
        productsFeatureDependencies: .uiTesting(
            memberRepository: dependencies.memberRepository,
            nowMillisProvider: dependencies.nowMillisProvider
        ),
        ordersFeatureDependencies: .preview(nowMillisProvider: dependencies.nowMillisProvider),
        shiftsFeatureDependencies: .preview(
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: dependencies.nowMillisProvider
        ),
        newsNotificationsFeatureDependencies: .preview(
            newsRepository: dependencies.newsRepository,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: dependencies.nowMillisProvider
        ),
        sharedProfileFeatureDependencies: .preview(
            nowMillisProvider: dependencies.nowMillisProvider
        ),
        usersFeatureDependencies: .preview(memberRepository: dependencies.memberRepository),
        myOrderFreshnessFeatureDependencies: dependencies.freshnessDependencies,
        bylawsFeatureDependencies: .preview(),
        developmentTimeMachine: dependencies.developmentTimeMachine,
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: PreviewStartupVersionPolicyRepository(),
            environment: .develop
        ),
        installedVersionProvider: { "0.0.0-ui-testing" }
    )
}

private struct LiveRootDependencies {
    let db: Firestore
    let environmentStore: RuntimeSessionEnvironmentStore
    let environmentRouter: RuntimeSessionEnvironmentRouter
    let memberRepository: FirestoreMemberRepository
    let authSessionProvider: FirebaseAuthSessionProvider
    let functionsClient: AuthenticatedFirebaseFunctionsClient
    let memberAdministrationRepository: FirebaseMemberAdministrationRepository
    let imagePipelineManager: FirebaseImagePipelineManager
    let notificationRepository: FirestoreNotificationRepository
    let authorizedDeviceRegistrar: FirebaseAuthorizedDeviceCoordinator
    let criticalDataFreshnessLocalRepository: UserDefaultsCriticalDataFreshnessLocalRepository
    let developmentTimeMachine: DevelopmentTimeMachine

    var developImpersonationEnabled: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }
}

private extension LiveRootDependencies {
    @MainActor
    init(db: Firestore = Firestore.firestore()) {
        let environmentStore = RuntimeSessionEnvironmentStore()
        self.db = db
        self.environmentStore = environmentStore
        self.environmentRouter = RuntimeSessionEnvironmentRouter(environmentStore: environmentStore)
        self.memberRepository = FirestoreMemberRepository(firebaseAppName: db.app.name)
        self.authSessionProvider = FirebaseAuthSessionProvider()
        guard let projectID = FirebaseApp.app()?.options.projectID,
              let functionsBaseURL = URL(
                string: "https://europe-west1-\(projectID).cloudfunctions.net"
              ) else {
            preconditionFailure("Firebase projectID is required for authenticated Functions")
        }
        self.functionsClient = AuthenticatedFirebaseFunctionsClient(
            baseURL: functionsBaseURL,
            tokenProvider: authSessionProvider
        )
        self.memberAdministrationRepository = FirebaseMemberAdministrationRepository(client: functionsClient)
        self.imagePipelineManager = FirebaseImagePipelineManager(firebaseAppName: db.app.name)
        self.notificationRepository = FirestoreNotificationRepository(firebaseAppName: db.app.name)
        self.criticalDataFreshnessLocalRepository =
            UserDefaultsCriticalDataFreshnessLocalRepository()
        self.developmentTimeMachine = DevelopmentTimeMachine()
        self.authorizedDeviceRegistrar = FirebaseAuthorizedDeviceCoordinator(
            repository: FirestoreDeviceRegistrationRepository(db: db),
            keychainStore: KeychainStore()
        )
    }
}

@MainActor
private func makeLiveSessionViewModel(
    _ dependencies: LiveRootDependencies,
    feedbackCenter: GlobalFeedbackCenter
) -> SessionViewModel {
    if ProcessInfo.processInfo.arguments.contains("-useMockAuth") {
        return SessionViewModel(
            dependencies: .live(
                db: dependencies.db,
                feedbackCenter: feedbackCenter,
                criticalDataFreshnessLocalRepository:
                    dependencies.criticalDataFreshnessLocalRepository,
                developImpersonationEnabled: dependencies.developImpersonationEnabled,
                nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
            )
        )
    }

    return SessionViewModel(
        dependencies: .live(
            db: dependencies.db,
            repository: dependencies.memberRepository,
            feedbackCenter: feedbackCenter,
            authSessionProvider: dependencies.authSessionProvider,
            authorizedMemberResolver: FirebaseAuthorizedMemberResolver(
                client: dependencies.functionsClient
            ),
            authorizedDeviceRegistrar: dependencies.authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository:
                dependencies.criticalDataFreshnessLocalRepository,
            environmentRouter: dependencies.environmentRouter,
            developImpersonationEnabled: dependencies.developImpersonationEnabled,
            nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
        )
    )
}

@MainActor
private func makeLiveAccessRootViewModel(
    _ dependencies: LiveRootDependencies,
    sessionViewModel: SessionViewModel,
    feedbackCenter: GlobalFeedbackCenter
) -> AccessRootViewModel {
    AccessRootViewModel(
        sessionViewModel: sessionViewModel,
        feedbackCenter: feedbackCenter,
        productsFeatureDependencies: ProductsFeatureDependencies.live(
            db: dependencies.db,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
        ),
        ordersFeatureDependencies: OrdersFeatureDependencies.live(
            db: dependencies.db,
            nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
        ),
        shiftsFeatureDependencies: ShiftsFeatureDependencies.live(
            db: dependencies.db,
            environmentProvider: dependencies.environmentStore,
            functionsClient: dependencies.functionsClient,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
        ),
        newsNotificationsFeatureDependencies: NewsNotificationsFeatureDependencies.live(
            db: dependencies.db,
            environmentProvider: dependencies.environmentStore,
            imagePipelineManager: dependencies.imagePipelineManager,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
        ),
        sharedProfileFeatureDependencies: SharedProfileFeatureDependencies.live(
            db: dependencies.db,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: { dependencies.developmentTimeMachine.nowMillis() }
        ),
        usersFeatureDependencies: UsersFeatureDependencies.live(
            memberRepository: dependencies.memberRepository,
            memberAdministrationRepository: dependencies.memberAdministrationRepository
        ),
        myOrderFreshnessFeatureDependencies: MyOrderFreshnessFeatureDependencies.live(
            db: dependencies.db,
            localRepository: dependencies.criticalDataFreshnessLocalRepository
        ),
        bylawsFeatureDependencies: .live(),
        developmentTimeMachine: dependencies.developmentTimeMachine,
        startupVersionGateUseCase: makeLiveStartupVersionGateUseCase(dependencies)
    )
}

@MainActor
private func makeLiveStartupVersionGateUseCase(
    _ dependencies: LiveRootDependencies
) -> ResolveStartupVersionGateUseCase {
    ResolveStartupVersionGateUseCase(
        repository: FirestoreStartupVersionPolicyRepository(firebaseAppName: dependencies.db.app.name),
        environment: dependencies.environmentStore.baseEnvironment
    )
}

extension EnvironmentValues {
    @Entry fileprivate var injectedReguertaAppEnvironment: ReguertaAppEnvironment?

    var reguertaAppEnvironment: ReguertaAppEnvironment {
        get {
            guard let injectedReguertaAppEnvironment else {
                preconditionFailure("ReguertaAppEnvironment must be injected at the app root")
            }
            return injectedReguertaAppEnvironment
        }
        set {
            injectedReguertaAppEnvironment = newValue
        }
    }
}

extension View {
    @MainActor
    func reguertaAppEnvironment(_ environment: ReguertaAppEnvironment) -> some View {
        self.environment(\.injectedReguertaAppEnvironment, environment)
    }
}

private struct PreviewStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    func policy(for platform: StartupPlatform, environment _: SessionEnvironment) async throws -> StartupVersionPolicy {
        throw RepositoryError.notFound(resource: "config.public")
    }
}
