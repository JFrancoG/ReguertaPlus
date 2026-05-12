import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel

    static func live() -> ReguertaAppEnvironment {
        FirebaseBootstrapper.configureIfNeeded()

        let dependencies = LiveRootDependencies()
        let sessionViewModel = makeLiveSessionViewModel(dependencies)
        let accessRootViewModel = makeLiveAccessRootViewModel(
            dependencies,
            sessionViewModel: sessionViewModel
        )

        return ReguertaAppEnvironment(
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel
        )
    }

    static func preview() -> ReguertaAppEnvironment {
        let notificationRepository = InMemoryNotificationRepository()
        let sessionViewModel = SessionViewModel(dependencies: .preview(notificationRepository: notificationRepository))
        let accessRootViewModel = AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            productsFeatureDependencies: .preview(),
            ordersFeatureDependencies: .preview(),
            shiftsFeatureDependencies: .preview(notificationRepository: notificationRepository),
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: PreviewStartupVersionPolicyRepository()
            ),
            installedVersionProvider: { "0.0.0-preview" }
        )

        return ReguertaAppEnvironment(
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel
        )
    }
}

private struct LiveRootDependencies {
    let db: Firestore
    let imagePipelineManager: FirebaseImagePipelineManager
    let notificationRepository: ChainedNotificationRepository

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
        self.imagePipelineManager = FirebaseImagePipelineManager()
        self.notificationRepository = ChainedNotificationRepository(
            primary: FirestoreNotificationRepository(db: db),
            fallback: InMemoryNotificationRepository()
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

private func makeLiveSessionViewModel(_ dependencies: LiveRootDependencies) -> SessionViewModel {
    SessionViewModel(
        dependencies: .live(
            db: dependencies.db,
            notificationRepository: dependencies.notificationRepository,
            imagePipelineManager: dependencies.imagePipelineManager,
            authorizedDeviceRegistrar: FirebaseAuthorizedDeviceRegistrar(
                repository: FirestoreDeviceRegistrationRepository(db: dependencies.db)
            ),
            reviewerEnvironmentRouter: FirestoreReviewerEnvironmentRouter(db: dependencies.db),
            developImpersonationEnabled: dependencies.developImpersonationEnabled,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        )
    )
}

private func makeLiveAccessRootViewModel(
    _ dependencies: LiveRootDependencies,
    sessionViewModel: SessionViewModel
) -> AccessRootViewModel {
    AccessRootViewModel(
        sessionViewModel: sessionViewModel,
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
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        ),
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
    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy? {
        nil
    }
}
