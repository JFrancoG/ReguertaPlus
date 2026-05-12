import FirebaseFirestore
import Foundation

struct SessionViewModelDependencies {
    let feedbackCenter: GlobalFeedbackCenter
    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let reviewerEnvironmentRouter: any ReviewerEnvironmentRouter
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let developImpersonationEnabled: Bool

    static func live(
        db: Firestore = Firestore.firestore(),
        repository: (any MemberRepository)? = nil,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        reviewerEnvironmentRouter: (any ReviewerEnvironmentRouter)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) }
    ) -> SessionViewModelDependencies {
        let useMockAuth = ProcessInfo.processInfo.arguments.contains("-useMockAuth")
        let selectedRepository = liveMemberRepository(db: db, override: repository)

        return SessionViewModelDependencies(
            feedbackCenter: feedbackCenter,
            repository: selectedRepository,
            authSessionProvider: authSessionProvider ?? (useMockAuth ? MockAuthSessionProvider() : FirebaseAuthSessionProvider()),
            resolveAuthorizedSession: resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository),
            authorizedDeviceRegistrar: authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar(),
            reviewerEnvironmentRouter: reviewerEnvironmentRouter ?? NoOpReviewerEnvironmentRouter(),
            sessionRefreshPolicy: sessionRefreshPolicy,
            nowMillisProvider: nowMillisProvider,
            developImpersonationEnabled: developImpersonationEnabled
        )
    }

    static func preview(
        repository: any MemberRepository = InMemoryMemberRepository(),
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter()
    ) -> SessionViewModelDependencies {
        return SessionViewModelDependencies(
            feedbackCenter: feedbackCenter,
            repository: repository,
            authSessionProvider: MockAuthSessionProvider(),
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(repository: repository),
            authorizedDeviceRegistrar: NoOpAuthorizedDeviceRegistrar(),
            reviewerEnvironmentRouter: NoOpReviewerEnvironmentRouter(),
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: { Int64(Date().timeIntervalSince1970 * 1_000) },
            developImpersonationEnabled: false
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
