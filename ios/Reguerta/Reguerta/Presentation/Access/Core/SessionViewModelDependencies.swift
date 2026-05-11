import FirebaseFirestore
import Foundation

struct SessionViewModelDependencies {
    let repository: any MemberRepository
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let productRepository: any ProductRepository
    let imagePipelineManager: any ImagePipelineManager
    let seasonalCommitmentRepository: any SeasonalCommitmentRepository
    let sharedProfileRepository: any SharedProfileRepository
    let shiftRepository: any ShiftRepository
    let deliveryCalendarRepository: any DeliveryCalendarRepository
    let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let upsertMemberByAdmin: UpsertMemberByAdminUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let reviewerEnvironmentRouter: any ReviewerEnvironmentRouter
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let developImpersonationEnabled: Bool
    let initialNowOverrideMillis: Int64?

    static func live(
        db: Firestore = Firestore.firestore(),
        repository: (any MemberRepository)? = nil,
        sharedProfileRepository: (any SharedProfileRepository)? = nil,
        deliveryCalendarRepository: (any DeliveryCalendarRepository)? = nil,
        shiftPlanningRequestRepository: (any ShiftPlanningRequestRepository)? = nil,
        shiftSwapRequestRepository: (any ShiftSwapRequestRepository)? = nil,
        imagePipelineManager: (any ImagePipelineManager)? = nil,
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        upsertMemberByAdmin: UpsertMemberByAdminUseCase? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        reviewerEnvironmentRouter: (any ReviewerEnvironmentRouter)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) },
        initialNowOverrideMillis: Int64? = nil
    ) -> SessionViewModelDependencies {
        let useMockAuth = ProcessInfo.processInfo.arguments.contains("-useMockAuth")
        let freshnessLocalRepository = UserDefaultsCriticalDataFreshnessLocalRepository()
        let selectedRepository = liveMemberRepository(db: db, override: repository)
        let selectedSharedProfileRepository = liveSharedProfileRepository(db: db, override: sharedProfileRepository)
        let selectedDeliveryCalendarRepository = liveDeliveryCalendarRepository(db: db, override: deliveryCalendarRepository)
        let selectedShiftPlanningRequestRepository =
            liveShiftPlanningRequestRepository(db: db, override: shiftPlanningRequestRepository)
        let selectedShiftSwapRequestRepository = liveShiftSwapRequestRepository(db: db, override: shiftSwapRequestRepository)

        return SessionViewModelDependencies(
            repository: selectedRepository,
            newsRepository: ChainedNewsRepository(
                primary: FirestoreNewsRepository(db: db),
                fallback: InMemoryNewsRepository()
            ),
            notificationRepository: ChainedNotificationRepository(
                primary: FirestoreNotificationRepository(db: db),
                fallback: InMemoryNotificationRepository()
            ),
            productRepository: ChainedProductRepository(
                primary: FirestoreProductRepository(db: db),
                fallback: InMemoryProductRepository()
            ),
            imagePipelineManager: imagePipelineManager ?? FirebaseImagePipelineManager(),
            seasonalCommitmentRepository: ChainedSeasonalCommitmentRepository(
                primary: FirestoreSeasonalCommitmentRepository(db: db),
                fallback: InMemorySeasonalCommitmentRepository()
            ),
            sharedProfileRepository: selectedSharedProfileRepository,
            shiftRepository: ChainedShiftRepository(
                primary: FirestoreShiftRepository(db: db),
                fallback: InMemoryShiftRepository()
            ),
            deliveryCalendarRepository: selectedDeliveryCalendarRepository,
            shiftPlanningRequestRepository: selectedShiftPlanningRequestRepository,
            shiftSwapRequestRepository: selectedShiftSwapRequestRepository,
            authSessionProvider: authSessionProvider ?? (useMockAuth ? MockAuthSessionProvider() : FirebaseAuthSessionProvider()),
            resolveAuthorizedSession: resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository),
            upsertMemberByAdmin: upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: selectedRepository),
            authorizedDeviceRegistrar: authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar(),
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: makeDefaultFreshnessRemoteRepository(db: db, useMockAuth: useMockAuth),
                localRepository: freshnessLocalRepository
            ),
            criticalDataFreshnessLocalRepository: freshnessLocalRepository,
            reviewerEnvironmentRouter: reviewerEnvironmentRouter ?? NoOpReviewerEnvironmentRouter(),
            sessionRefreshPolicy: sessionRefreshPolicy,
            nowMillisProvider: nowMillisProvider,
            developImpersonationEnabled: developImpersonationEnabled,
            initialNowOverrideMillis: initialNowOverrideMillis
        )
    }

    static func preview() -> SessionViewModelDependencies {
        let repository = InMemoryMemberRepository()
        let freshnessLocalRepository = InMemoryCriticalDataFreshnessLocalRepository()

        return SessionViewModelDependencies(
            repository: repository,
            newsRepository: InMemoryNewsRepository(),
            notificationRepository: InMemoryNotificationRepository(),
            productRepository: InMemoryProductRepository(),
            imagePipelineManager: NoOpImagePipelineManager(),
            seasonalCommitmentRepository: InMemorySeasonalCommitmentRepository(),
            sharedProfileRepository: InMemorySharedProfileRepository(),
            shiftRepository: InMemoryShiftRepository(),
            deliveryCalendarRepository: InMemoryDeliveryCalendarRepository(),
            shiftPlanningRequestRepository: InMemoryShiftPlanningRequestRepository(),
            shiftSwapRequestRepository: InMemoryShiftSwapRequestRepository(),
            authSessionProvider: MockAuthSessionProvider(),
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(repository: repository),
            upsertMemberByAdmin: UpsertMemberByAdminUseCase(repository: repository),
            authorizedDeviceRegistrar: NoOpAuthorizedDeviceRegistrar(),
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
                localRepository: freshnessLocalRepository
            ),
            criticalDataFreshnessLocalRepository: freshnessLocalRepository,
            reviewerEnvironmentRouter: NoOpReviewerEnvironmentRouter(),
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: { Int64(Date().timeIntervalSince1970 * 1_000) },
            developImpersonationEnabled: false,
            initialNowOverrideMillis: nil
        )
    }

    private static func makeDefaultFreshnessRemoteRepository(
        db: Firestore,
        useMockAuth: Bool
    ) -> any CriticalDataFreshnessRemoteRepository {
        guard useMockAuth else {
            return FirestoreCriticalDataFreshnessRemoteRepository(db: db)
        }

        return FixedCriticalDataFreshnessRemoteRepository(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: Dictionary(
                    uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
                )
            )
        )
    }

    private static func liveMemberRepository(
        db: Firestore,
        override: (any MemberRepository)?
    ) -> any MemberRepository {
        override ?? ChainedMemberRepository(
            primary: FirestoreMemberRepository(db: db),
            fallback: InMemoryMemberRepository()
        )
    }

    private static func liveSharedProfileRepository(
        db: Firestore,
        override: (any SharedProfileRepository)?
    ) -> any SharedProfileRepository {
        override ?? ChainedSharedProfileRepository(
            primary: FirestoreSharedProfileRepository(db: db),
            fallback: InMemorySharedProfileRepository()
        )
    }

    private static func liveDeliveryCalendarRepository(
        db: Firestore,
        override: (any DeliveryCalendarRepository)?
    ) -> any DeliveryCalendarRepository {
        override ?? ChainedDeliveryCalendarRepository(
            primary: FirestoreDeliveryCalendarRepository(db: db),
            fallback: InMemoryDeliveryCalendarRepository()
        )
    }

    private static func liveShiftPlanningRequestRepository(
        db: Firestore,
        override: (any ShiftPlanningRequestRepository)?
    ) -> any ShiftPlanningRequestRepository {
        override ?? ChainedShiftPlanningRequestRepository(
            primary: FirestoreShiftPlanningRequestRepository(db: db),
            fallback: InMemoryShiftPlanningRequestRepository()
        )
    }

    private static func liveShiftSwapRequestRepository(
        db: Firestore,
        override: (any ShiftSwapRequestRepository)?
    ) -> any ShiftSwapRequestRepository {
        override ?? ChainedShiftSwapRequestRepository(
            primary: FirestoreShiftSwapRequestRepository(db: db),
            fallback: InMemoryShiftSwapRequestRepository()
        )
    }
}

private struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(member: Member) async {}
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
