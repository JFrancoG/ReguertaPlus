import FirebaseCore
import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let feedbackCenter: GlobalFeedbackCenter
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar

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

    static func preview() -> ReguertaAppEnvironment {
        let memberRepository = InMemoryMemberRepository()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let authorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar()
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
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: PreviewStartupVersionPolicyRepository()
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

    static func uiTesting() -> ReguertaAppEnvironment {
        let memberRepository = InMemoryMemberRepository()
        let newsRepository = InMemoryNewsRepository.uiTesting()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let authorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar()
        let nowMillisProvider: @MainActor () -> Int64 = {
            DevelopmentTimeMachine.shared.nowMillis()
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
            nowProvider: { DevelopmentTimeMachine.shared.nowMillis() }
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
    let nowMillisProvider: @MainActor () -> Int64
}

private func makeUITestingAccessRootViewModel(
    _ dependencies: UITestingAccessRootDependencies
) -> AccessRootViewModel {
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
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: PreviewStartupVersionPolicyRepository()
        ),
        installedVersionProvider: { "0.0.0-ui-testing" },
        initialNowOverrideMillis: DevelopmentTimeMachine.shared.overrideNowMillis
    )
}

private struct LiveRootDependencies {
    let db: Firestore
    let memberRepository: FirestoreMemberRepository
    let authSessionProvider: FirebaseAuthSessionProvider
    let functionsClient: AuthenticatedFirebaseFunctionsClient
    let memberAdministrationRepository: FirebaseMemberAdministrationRepository
    let imagePipelineManager: FirebaseImagePipelineManager
    let notificationRepository: FirestoreNotificationRepository
    let authorizedDeviceRegistrar: FirebaseAuthorizedDeviceCoordinator
    let criticalDataFreshnessLocalRepository: UserDefaultsCriticalDataFreshnessLocalRepository

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
        self.memberRepository = FirestoreMemberRepository(db: db)
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
        self.memberAdministrationRepository = FirebaseMemberAdministrationRepository(
            client: functionsClient
        )
        self.imagePipelineManager = FirebaseImagePipelineManager()
        self.notificationRepository = FirestoreNotificationRepository(db: db)
        self.criticalDataFreshnessLocalRepository =
            UserDefaultsCriticalDataFreshnessLocalRepository()
        self.authorizedDeviceRegistrar = FirebaseAuthorizedDeviceCoordinator(
            repository: FirestoreDeviceRegistrationRepository(db: db),
            keychainStore: KeychainStore()
        )
    }

    var developImpersonationEnabled: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }
}

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
                nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
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
            environmentRouter: RuntimeSessionEnvironmentRouter(),
            developImpersonationEnabled: dependencies.developImpersonationEnabled,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        )
    )
}

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
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        ),
        ordersFeatureDependencies: OrdersFeatureDependencies.live(
            db: dependencies.db,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        ),
        shiftsFeatureDependencies: ShiftsFeatureDependencies.live(
            db: dependencies.db,
            functionsClient: dependencies.functionsClient,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        ),
        newsNotificationsFeatureDependencies: NewsNotificationsFeatureDependencies.live(
            db: dependencies.db,
            imagePipelineManager: dependencies.imagePipelineManager,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        ),
        sharedProfileFeatureDependencies: SharedProfileFeatureDependencies.live(
            db: dependencies.db,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
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
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: FirestoreStartupVersionPolicyRepository(db: dependencies.db)
        ),
        initialNowOverrideMillis: DevelopmentTimeMachine.shared.overrideNowMillis
    )
}

extension EnvironmentValues {
    @Entry var reguertaAppEnvironment: ReguertaAppEnvironment = .preview()
}

private struct PreviewStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    func policy(for platform: StartupPlatform) async throws -> StartupVersionPolicy {
        throw RepositoryError.notFound(resource: "config.public")
    }
}
