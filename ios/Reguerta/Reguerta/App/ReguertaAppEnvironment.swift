import FirebaseCore
import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let feedbackCenter: GlobalFeedbackCenter
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let loadNewsImageData: @Sendable (URL) async throws -> Data

    @MainActor
    static func make(configuration: ReguertaAppConfiguration) -> ReguertaAppEnvironment {
        configuration.compose(
            live: { live(configuration: configuration) },
            preview: { preview(configuration: configuration) },
            uiTesting: { uiTesting(configuration: configuration) }
        )
    }

    @MainActor
    static func live(configuration: ReguertaAppConfiguration) -> ReguertaAppEnvironment {
        precondition(configuration.scenario == .live, "Live composition requires the live App scenario")
        FirebaseBootstrapper.configureIfNeeded()

        let dependencies = LiveRootDependencies(initialNowOverrideMillis: configuration.initialNowOverrideMillis)
        return assemble(makeLiveAppAssembly(
            dependencies,
            configuration: configuration
        ))
    }

    @MainActor
    static func preview(
        configuration: ReguertaAppConfiguration = .preview,
        developmentTimeMachine injectedDevelopmentTimeMachine: DevelopmentTimeMachine? = nil
    ) -> ReguertaAppEnvironment {
        precondition(configuration.scenario == .preview, "Preview composition requires the preview App scenario")
        let developmentTimeMachine = makeNonLiveClock(configuration, injected: injectedDevelopmentTimeMachine)
        let memberRepository = InMemoryMemberRepository()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let authorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar()
        let nowMillisProvider: @Sendable () -> Int64 = { developmentTimeMachine.nowMillis() }
        let freshnessDependencies = MyOrderFreshnessFeatureDependencies.preview(
            nowProvider: nowMillisProvider
        )
        let sessionDependencies = SessionViewModelPreviewDependencies.make(
            repository: memberRepository,
            feedbackCenter: feedbackCenter,
            authorizedDeviceRegistrar: authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository: freshnessDependencies.criticalDataFreshnessLocalRepository,
            nowMillisProvider: nowMillisProvider
        )

        return assemble(
            ReguertaAppAssemblyDependencies(
                session: sessionDependencies,
                loadNewsImageData: { _ in throw NewsImageDataLoaderError.emptyData },
                root: ReguertaAppRootAssemblyDependencies(
                    products: .preview(nowMillisProvider: nowMillisProvider),
                    orders: .preview(nowMillisProvider: nowMillisProvider),
                    shifts: .preview(
                        notificationRepository: notificationRepository,
                        nowMillisProvider: nowMillisProvider
                    ),
                    newsNotifications: .preview(
                        notificationRepository: notificationRepository,
                        nowMillisProvider: nowMillisProvider
                    ),
                    sharedProfile: .preview(nowMillisProvider: nowMillisProvider),
                    users: .preview(memberRepository: memberRepository),
                    myOrderFreshness: freshnessDependencies,
                    bylaws: .preview(),
                    developmentTimeMachine: developmentTimeMachine,
                    startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                        repository: PreviewStartupVersionPolicyRepository(),
                        environment: .develop
                    ),
                    shouldSkipSplashProvider: { configuration.skipsSplash },
                    installedVersionProvider: { "0.0.0-preview" }
                )
            )
        )
    }

    @MainActor
    static func uiTesting(
        configuration: ReguertaAppConfiguration = .uiTesting,
        developmentTimeMachine injectedDevelopmentTimeMachine: DevelopmentTimeMachine? = nil
    ) -> ReguertaAppEnvironment {
        precondition(configuration.scenario == .uiTesting, "UI-test composition requires the UI-test App scenario")
        let developmentTimeMachine = makeNonLiveClock(configuration, injected: injectedDevelopmentTimeMachine)
        let memberRepository = InMemoryMemberRepository()
        let newsRepository = InMemoryNewsRepository.uiTesting()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let authorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar()
        let nowMillisProvider: @Sendable () -> Int64 = { developmentTimeMachine.nowMillis() }
        let freshnessDependencies = makeUITestingFreshnessDependencies(nowProvider: nowMillisProvider)
        let sessionDependencies = SessionViewModelPreviewDependencies.make(
            repository: memberRepository,
            feedbackCenter: feedbackCenter,
            authorizedDeviceRegistrar: authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository: freshnessDependencies.criticalDataFreshnessLocalRepository,
            nowMillisProvider: nowMillisProvider
        )

        return assemble(
            ReguertaAppAssemblyDependencies(
                session: sessionDependencies,
                loadNewsImageData: { _ in throw NewsImageDataLoaderError.emptyData },
                root: ReguertaAppRootAssemblyDependencies(
                    products: .uiTesting(
                        memberRepository: memberRepository,
                        nowMillisProvider: nowMillisProvider
                    ),
                    orders: .preview(nowMillisProvider: nowMillisProvider),
                    shifts: .preview(
                        notificationRepository: notificationRepository,
                        nowMillisProvider: nowMillisProvider
                    ),
                    newsNotifications: .preview(
                        newsRepository: newsRepository,
                        notificationRepository: notificationRepository,
                        nowMillisProvider: nowMillisProvider
                    ),
                    sharedProfile: .preview(nowMillisProvider: nowMillisProvider),
                    users: .preview(memberRepository: memberRepository),
                    myOrderFreshness: freshnessDependencies,
                    bylaws: .preview(),
                    developmentTimeMachine: developmentTimeMachine,
                    startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                        repository: PreviewStartupVersionPolicyRepository(),
                        environment: .develop
                    ),
                    shouldSkipSplashProvider: { configuration.skipsSplash },
                    installedVersionProvider: { "0.0.0-ui-testing" }
                )
            )
        )
    }
}

@MainActor
private func makeNonLiveClock(
    _ configuration: ReguertaAppConfiguration,
    injected: DevelopmentTimeMachine?
) -> DevelopmentTimeMachine {
    injected ?? .transient(initialOverrideNowMillis: configuration.initialNowOverrideMillis)
}

struct ReguertaAppAssemblyDependencies {
    let session: SessionViewModelDependencies
    let loadNewsImageData: @Sendable (URL) async throws -> Data
    let root: ReguertaAppRootAssemblyDependencies
}

struct ReguertaAppRootAssemblyDependencies {
    let products: ProductsFeatureDependencies
    let orders: OrdersFeatureDependencies
    let shifts: ShiftsFeatureDependencies
    let newsNotifications: NewsNotificationsFeatureDependencies
    let sharedProfile: SharedProfileFeatureDependencies
    let users: UsersFeatureDependencies
    let myOrderFreshness: MyOrderFreshnessFeatureDependencies
    let bylaws: BylawsFeatureDependencies
    let developmentTimeMachine: DevelopmentTimeMachine
    let startupVersionGateUseCase: ResolveStartupVersionGateUseCase
    let shouldSkipSplashProvider: () -> Bool
    let installedVersionProvider: () -> String
}

extension ReguertaAppEnvironment {
    @MainActor
    static func assemble(_ dependencies: ReguertaAppAssemblyDependencies) -> ReguertaAppEnvironment {
        let sessionViewModel = SessionViewModel(dependencies: dependencies.session)
        let root = dependencies.root
        let accessRootViewModel = AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: dependencies.session.feedbackCenter,
            productsFeatureDependencies: root.products,
            ordersFeatureDependencies: root.orders,
            shiftsFeatureDependencies: root.shifts,
            newsNotificationsFeatureDependencies: root.newsNotifications,
            sharedProfileFeatureDependencies: root.sharedProfile,
            usersFeatureDependencies: root.users,
            myOrderFreshnessFeatureDependencies: root.myOrderFreshness,
            bylawsFeatureDependencies: root.bylaws,
            developmentTimeMachine: root.developmentTimeMachine,
            startupVersionGateUseCase: root.startupVersionGateUseCase,
            shouldSkipSplashProvider: root.shouldSkipSplashProvider,
            installedVersionProvider: root.installedVersionProvider
        )

        return ReguertaAppEnvironment(
            feedbackCenter: dependencies.session.feedbackCenter,
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel,
            authorizedDeviceRegistrar: dependencies.session.authorizedDeviceRegistrar,
            loadNewsImageData: dependencies.loadNewsImageData
        )
    }
}

@MainActor
private func makeUITestingFreshnessDependencies(
    nowProvider: @escaping @Sendable () -> Int64
) -> MyOrderFreshnessFeatureDependencies {
    let freshnessConfig = CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
        )
    )
    return MyOrderFreshnessFeatureDependencies.preview(
        remoteConfig: freshnessConfig,
        nowProvider: nowProvider
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
    init(db: Firestore = Firestore.firestore(), initialNowOverrideMillis: Int64? = nil) {
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
        self.developmentTimeMachine = DevelopmentTimeMachine(initialOverrideNowMillis: initialNowOverrideMillis)
        self.authorizedDeviceRegistrar = FirebaseAuthorizedDeviceCoordinator(
            repository: FirestoreDeviceRegistrationRepository(db: db),
            keychainStore: KeychainStore()
        )
    }
}

@MainActor
private func makeLiveAppAssembly(
    _ dependencies: LiveRootDependencies,
    configuration: ReguertaAppConfiguration
) -> ReguertaAppAssemblyDependencies {
    let feedbackCenter = GlobalFeedbackCenter()
    let developmentTimeMachine = dependencies.developmentTimeMachine
    let nowMillisProvider: @Sendable () -> Int64 = {
        developmentTimeMachine.nowMillis()
    }
    return ReguertaAppAssemblyDependencies(
        session: SessionViewModelDependencies(
            feedbackCenter: feedbackCenter,
            repository: dependencies.memberRepository,
            authSessionProvider: dependencies.authSessionProvider,
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
                repository: dependencies.memberRepository,
                resolver: FirebaseAuthorizedMemberResolver(client: dependencies.functionsClient),
                environmentRouter: dependencies.environmentRouter
            ),
            authorizedDeviceRegistrar: dependencies.authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository: dependencies.criticalDataFreshnessLocalRepository,
            environmentRouter: dependencies.environmentRouter,
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: nowMillisProvider,
            sessionOperationTimeout: SessionOperationConfiguration.defaultTimeout,
            sessionOperationSleeper: { try await ContinuousClock().sleep(for: $0) },
            developImpersonationEnabled: dependencies.developImpersonationEnabled
        ),
        loadNewsImageData: makeLiveNewsImageDataProvider(),
        root: makeLiveRootAssembly(
            dependencies,
            configuration: configuration,
            nowMillisProvider: nowMillisProvider
        )
    )
}

private typealias NewsImageDataProvider = @Sendable (URL) async throws -> Data

private func makeLiveNewsImageDataProvider() -> NewsImageDataProvider {
    let loader = NewsImageDataLoader()
    return { try await loader.load(from: $0) }
}

@MainActor
private func makeLiveRootAssembly(
    _ dependencies: LiveRootDependencies,
    configuration: ReguertaAppConfiguration,
    nowMillisProvider: @escaping @Sendable () -> Int64
) -> ReguertaAppRootAssemblyDependencies {
    ReguertaAppRootAssemblyDependencies(
        products: ProductsFeatureDependencies.live(
            configuration: configuration,
            db: dependencies.db,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        ),
        orders: OrdersFeatureDependencies.live(
            db: dependencies.db,
            nowMillisProvider: nowMillisProvider
        ),
        shifts: ShiftsFeatureDependencies.live(
            db: dependencies.db,
            environmentProvider: dependencies.environmentStore,
            functionsClient: dependencies.functionsClient,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: nowMillisProvider
        ),
        newsNotifications: NewsNotificationsFeatureDependencies.live(
            db: dependencies.db,
            environmentProvider: dependencies.environmentStore,
            imagePipelineManager: dependencies.imagePipelineManager,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: nowMillisProvider
        ),
        sharedProfile: SharedProfileFeatureDependencies.live(
            db: dependencies.db,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        ),
        users: UsersFeatureDependencies.live(
            memberRepository: dependencies.memberRepository,
            memberAdministrationRepository: dependencies.memberAdministrationRepository
        ),
        myOrderFreshness: MyOrderFreshnessFeatureDependencies.live(
            configuration: configuration,
            db: dependencies.db,
            localRepository: dependencies.criticalDataFreshnessLocalRepository
        ),
        bylaws: .live(),
        developmentTimeMachine: dependencies.developmentTimeMachine,
        startupVersionGateUseCase: makeLiveStartupVersionGateUseCase(dependencies),
        shouldSkipSplashProvider: { configuration.skipsSplash },
        installedVersionProvider: { resolveInstalledAppVersion() }
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
