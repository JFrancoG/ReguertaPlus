import FirebaseCore
import FirebaseFirestore
import Foundation

enum SessionOperationConfiguration {
    static let defaultTimeout: Duration = .seconds(30)
}

struct SessionViewModelDependencies {
    let feedbackCenter: GlobalFeedbackCenter
    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let environmentRouter: any SessionEnvironmentRouting
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let sessionOperationTimeout: Duration
    let sessionOperationSleeper: @Sendable (Duration) async throws -> Void
    let developImpersonationEnabled: Bool

    static func live(
        db: Firestore = Firestore.firestore(),
        repository: (any MemberRepository)? = nil,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedMemberResolver: (any AuthorizedMemberResolving)? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        criticalDataFreshnessLocalRepository: (any CriticalDataFreshnessLocalRepository)? = nil,
        environmentRouter: (any SessionEnvironmentRouting)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) },
        sessionOperationTimeout: Duration = SessionOperationConfiguration.defaultTimeout,
        sessionOperationSleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) -> SessionViewModelDependencies {
        let useMockAuth = ProcessInfo.processInfo.arguments.contains("-useMockAuth")
        let selectedRepository: any MemberRepository = repository ?? (useMockAuth
            ? InMemoryMemberRepository()
            : FirestoreMemberRepository(db: db))
        let selectedAuthProvider: any AuthSessionProvider = authSessionProvider
            ?? (useMockAuth ? MockAuthSessionProvider() : FirebaseAuthSessionProvider())
        let selectedEnvironmentRouter: any SessionEnvironmentRouting = environmentRouter
            ?? (useMockAuth ? FixedSessionEnvironmentRouter() : RuntimeSessionEnvironmentRouter())
        let selectedResolver: any AuthorizedMemberResolving
        if let authorizedMemberResolver {
            selectedResolver = authorizedMemberResolver
        } else if let localRepository = selectedRepository as? any LocalMemberRepository {
            selectedResolver = InMemoryAuthorizedMemberResolver(repository: localRepository)
        } else {
            guard let projectID = FirebaseApp.app()?.options.projectID else {
                preconditionFailure("Firebase projectID is required for authenticated Functions")
            }
            let baseURL = URL(
                string: "https://europe-west1-\(projectID).cloudfunctions.net"
            )!
            selectedResolver = FirebaseAuthorizedMemberResolver(
                client: AuthenticatedFirebaseFunctionsClient(
                    baseURL: baseURL,
                    tokenProvider: selectedAuthProvider
                )
            )
        }

        return SessionViewModelDependencies(
            feedbackCenter: feedbackCenter,
            repository: selectedRepository,
            authSessionProvider: selectedAuthProvider,
            resolveAuthorizedSession: resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(
                repository: selectedRepository,
                resolver: selectedResolver,
                environmentRouter: selectedEnvironmentRouter
            ),
            authorizedDeviceRegistrar: authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar(),
            criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository
                ?? UserDefaultsCriticalDataFreshnessLocalRepository(),
            environmentRouter: selectedEnvironmentRouter,
            sessionRefreshPolicy: sessionRefreshPolicy,
            nowMillisProvider: nowMillisProvider,
            sessionOperationTimeout: sessionOperationTimeout,
            sessionOperationSleeper: sessionOperationSleeper,
            developImpersonationEnabled: developImpersonationEnabled
        )
    }

    static func preview(
        repository: any LocalMemberRepository = InMemoryMemberRepository(),
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar(),
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository =
            NoOpCriticalDataFreshnessLocalRepository()
    ) -> SessionViewModelDependencies {
        let environmentRouter = FixedSessionEnvironmentRouter()
        return SessionViewModelDependencies(
            feedbackCenter: feedbackCenter,
            repository: repository,
            authSessionProvider: MockAuthSessionProvider(),
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
                repository: repository,
                resolver: InMemoryAuthorizedMemberResolver(repository: repository),
                environmentRouter: environmentRouter
            ),
            authorizedDeviceRegistrar: authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository,
            environmentRouter: environmentRouter,
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: { Int64(Date().timeIntervalSince1970 * 1_000) },
            sessionOperationTimeout: SessionOperationConfiguration.defaultTimeout,
            sessionOperationSleeper: { try await ContinuousClock().sleep(for: $0) },
            developImpersonationEnabled: false
        )
    }

}

nonisolated struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        .skipped
    }

    func updateRegistrationToken(_ token: String?) async throws {}

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {}
}

@MainActor
final class NoOpCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private(set) var writeGeneration: UInt64 = 0

    func getMetadata() -> CriticalDataFreshnessMetadata? { nil }

    func saveMetadata(_: CriticalDataFreshnessMetadata, ifWriteGeneration _: UInt64) -> Bool { true }

    func clear() throws {
        writeGeneration &+= 1
    }
}
