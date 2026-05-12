import FirebaseFirestore
import Foundation

struct SessionViewModelDependencies {
    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let reviewerEnvironmentRouter: any ReviewerEnvironmentRouter
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let developImpersonationEnabled: Bool

    static func live(
        db: Firestore = Firestore.firestore(),
        repository: (any MemberRepository)? = nil,
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        reviewerEnvironmentRouter: (any ReviewerEnvironmentRouter)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) }
    ) -> SessionViewModelDependencies {
        let useMockAuth = ProcessInfo.processInfo.arguments.contains("-useMockAuth")
        let freshnessLocalRepository = UserDefaultsCriticalDataFreshnessLocalRepository()
        let selectedRepository = liveMemberRepository(db: db, override: repository)

        return SessionViewModelDependencies(
            repository: selectedRepository,
            authSessionProvider: authSessionProvider ?? (useMockAuth ? MockAuthSessionProvider() : FirebaseAuthSessionProvider()),
            resolveAuthorizedSession: resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository),
            authorizedDeviceRegistrar: authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar(),
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: makeDefaultFreshnessRemoteRepository(db: db, useMockAuth: useMockAuth),
                localRepository: freshnessLocalRepository
            ),
            criticalDataFreshnessLocalRepository: freshnessLocalRepository,
            reviewerEnvironmentRouter: reviewerEnvironmentRouter ?? NoOpReviewerEnvironmentRouter(),
            sessionRefreshPolicy: sessionRefreshPolicy,
            nowMillisProvider: nowMillisProvider,
            developImpersonationEnabled: developImpersonationEnabled
        )
    }

    static func preview(repository: any MemberRepository = InMemoryMemberRepository()) -> SessionViewModelDependencies {
        let freshnessLocalRepository = InMemoryCriticalDataFreshnessLocalRepository()

        return SessionViewModelDependencies(
            repository: repository,
            authSessionProvider: MockAuthSessionProvider(),
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(repository: repository),
            authorizedDeviceRegistrar: NoOpAuthorizedDeviceRegistrar(),
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
                localRepository: freshnessLocalRepository
            ),
            criticalDataFreshnessLocalRepository: freshnessLocalRepository,
            reviewerEnvironmentRouter: NoOpReviewerEnvironmentRouter(),
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: { Int64(Date().timeIntervalSince1970 * 1_000) },
            developImpersonationEnabled: false
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
