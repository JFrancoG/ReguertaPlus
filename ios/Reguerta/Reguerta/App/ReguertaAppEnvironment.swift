import FirebaseFirestore
import SwiftUI

struct ReguertaAppEnvironment {
    let feedbackCenter: GlobalFeedbackCenter
    let sessionViewModel: SessionViewModel
    let accessRootViewModel: AccessRootViewModel

    static func live() -> ReguertaAppEnvironment {
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
}

private struct LiveRootDependencies {
    let db: Firestore
    let memberRepository: any MemberRepository
    let imagePipelineManager: FirebaseImagePipelineManager
    let notificationRepository: ChainedNotificationRepository

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
        self.memberRepository = ChainedMemberRepository(
            primary: FirestoreMemberRepository(db: db),
            fallback: InMemoryMemberRepository()
        )
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

private func makeLiveSessionViewModel(
    _ dependencies: LiveRootDependencies,
    feedbackCenter: GlobalFeedbackCenter
) -> SessionViewModel {
    SessionViewModel(
        dependencies: .live(
            db: dependencies.db,
            repository: dependencies.memberRepository,
            feedbackCenter: feedbackCenter,
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
            memberRepository: dependencies.memberRepository
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
    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy? {
        nil
    }
}
