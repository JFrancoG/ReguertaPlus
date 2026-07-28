import FirebaseCore
import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let feedbackCenter: GlobalFeedbackCenter
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel

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
            accessRootViewModel: accessRootViewModel
        )
    }

    static func preview() -> ReguertaAppEnvironment {
        let memberRepository = InMemoryMemberRepository()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let sessionViewModel = SessionViewModel(
            dependencies: .preview(
                repository: memberRepository,
                feedbackCenter: feedbackCenter
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
            myOrderFreshnessFeatureDependencies: .preview(),
            bylawsFeatureDependencies: .preview(),
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: PreviewStartupVersionPolicyRepository()
            ),
            installedVersionProvider: { "0.0.0-preview" }
        )

        return ReguertaAppEnvironment(
            feedbackCenter: feedbackCenter,
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel
        )
    }

    static func uiTesting() -> ReguertaAppEnvironment {
        let memberRepository = InMemoryMemberRepository()
        let newsRepository = InMemoryNewsRepository.uiTesting()
        let notificationRepository = InMemoryNotificationRepository()
        let feedbackCenter = GlobalFeedbackCenter()
        let nowMillisProvider: @MainActor () -> Int64 = {
            DevelopmentTimeMachine.shared.nowMillis()
        }
        let sessionViewModel = SessionViewModel(
            dependencies: .preview(
                repository: memberRepository,
                feedbackCenter: feedbackCenter
            )
        )
        let freshnessConfig = CriticalDataFreshnessConfig(
            cacheExpirationMinutes: 15,
            remoteTimestampsMillis: Dictionary(
                uniqueKeysWithValues: CriticalCollection.allCases.map {
                    ($0, 1_000)
                }
            )
        )
        let accessRootViewModel = AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            productsFeatureDependencies: .uiTesting(
                memberRepository: memberRepository,
                nowMillisProvider: nowMillisProvider
            ),
            ordersFeatureDependencies: .preview(
                nowMillisProvider: nowMillisProvider
            ),
            shiftsFeatureDependencies: .preview(
                notificationRepository: notificationRepository,
                nowMillisProvider: nowMillisProvider
            ),
            newsNotificationsFeatureDependencies: .preview(
                newsRepository: newsRepository,
                notificationRepository: notificationRepository,
                nowMillisProvider: nowMillisProvider
            ),
            sharedProfileFeatureDependencies: .preview(
                nowMillisProvider: nowMillisProvider
            ),
            usersFeatureDependencies: .preview(
                memberRepository: memberRepository
            ),
            myOrderFreshnessFeatureDependencies: .preview(
                remoteConfig: freshnessConfig,
                nowProvider: { DevelopmentTimeMachine.shared.nowMillis() }
            ),
            bylawsFeatureDependencies: .preview(),
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: PreviewStartupVersionPolicyRepository()
            ),
            installedVersionProvider: { "0.0.0-ui-testing" },
            initialNowOverrideMillis: DevelopmentTimeMachine.shared.overrideNowMillis
        )

        return ReguertaAppEnvironment(
            feedbackCenter: feedbackCenter,
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel
        )
    }
}

private struct LiveRootDependencies {
    let db: Firestore
    let memberRepository: any MemberRepository
    let authSessionProvider: FirebaseAuthSessionProvider
    let functionsClient: AuthenticatedFirebaseFunctionsClient
    let memberAdministrationRepository: FirebaseMemberAdministrationRepository
    let imagePipelineManager: FirebaseImagePipelineManager
    let notificationRepository: FirestoreNotificationRepository

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
            authorizedDeviceRegistrar: FirebaseAuthorizedDeviceRegistrar(
                repository: FirestoreDeviceRegistrationRepository(db: dependencies.db)
            ),
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
            db: dependencies.db
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
