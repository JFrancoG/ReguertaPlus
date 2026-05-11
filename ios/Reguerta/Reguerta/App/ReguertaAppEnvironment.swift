import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel

    static func live() -> ReguertaAppEnvironment {
        FirebaseBootstrapper.configureIfNeeded()

        let db = Firestore.firestore()
        let deviceRepository = FirestoreDeviceRegistrationRepository(db: db)
        let reviewerEnvironmentRouter = FirestoreReviewerEnvironmentRouter(db: db)

        #if DEBUG
        let developImpersonationEnabled = true
        #else
        let developImpersonationEnabled = false
        #endif

        let sessionViewModel = SessionViewModel(
            dependencies: .live(
                db: db,
                authorizedDeviceRegistrar: FirebaseAuthorizedDeviceRegistrar(repository: deviceRepository),
                reviewerEnvironmentRouter: reviewerEnvironmentRouter,
                developImpersonationEnabled: developImpersonationEnabled,
                nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() },
                initialNowOverrideMillis: DevelopmentTimeMachine.shared.overrideNowMillis
            )
        )
        let ordersFeatureDependencies = OrdersFeatureDependencies.live(
            db: db,
            nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() }
        )
        let accessRootViewModel = AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            ordersFeatureDependencies: ordersFeatureDependencies,
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: FirestoreStartupVersionPolicyRepository(db: db)
            )
        )

        return ReguertaAppEnvironment(
            sessionViewModel: sessionViewModel,
            accessRootViewModel: accessRootViewModel
        )
    }

    static func preview() -> ReguertaAppEnvironment {
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        let accessRootViewModel = AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            ordersFeatureDependencies: .preview(),
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

extension EnvironmentValues {
    @Entry var reguertaAppEnvironment: ReguertaAppEnvironment = .preview()
}

private struct PreviewStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy? {
        nil
    }
}
