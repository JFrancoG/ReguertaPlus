import FirebaseCore
import FirebaseFirestore
import Foundation

struct SessionViewModelDependencies {
    let feedbackCenter: GlobalFeedbackCenter
    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let environmentRouter: any SessionEnvironmentRouting
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let developImpersonationEnabled: Bool

    static func live(
        db: Firestore = Firestore.firestore(),
        repository: (any MemberRepository)? = nil,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedMemberResolver: (any AuthorizedMemberResolving)? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        environmentRouter: (any SessionEnvironmentRouting)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) }
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
            environmentRouter: selectedEnvironmentRouter,
            sessionRefreshPolicy: sessionRefreshPolicy,
            nowMillisProvider: nowMillisProvider,
            developImpersonationEnabled: developImpersonationEnabled
        )
    }

    static func preview(
        repository: any LocalMemberRepository = InMemoryMemberRepository(),
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter()
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
            authorizedDeviceRegistrar: NoOpAuthorizedDeviceRegistrar(),
            environmentRouter: environmentRouter,
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: { Int64(Date().timeIntervalSince1970 * 1_000) },
            developImpersonationEnabled: false
        )
    }

}

private struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(member: Member) async -> AuthorizedDeviceRegistrationResult {
        .skipped
    }
}
