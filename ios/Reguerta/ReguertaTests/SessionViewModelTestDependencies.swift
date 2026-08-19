import Foundation

@testable import Reguerta

extension SessionViewModelDependencies {
    @MainActor
    static func preview(
        repository: any LocalMemberRepository = InMemoryMemberRepository(),
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar(),
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository =
            NoOpCriticalDataFreshnessLocalRepository()
    ) -> SessionViewModelDependencies {
        SessionViewModelPreviewDependencies.make(
            repository: repository,
            feedbackCenter: feedbackCenter,
            authorizedDeviceRegistrar: authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository
        )
    }
}

extension SessionViewModel {
    convenience init(
        repository: (any MemberRepository)? = nil,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedMemberResolver: (any AuthorizedMemberResolving)? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository =
            NoOpCriticalDataFreshnessLocalRepository(),
        environmentRouter: (any SessionEnvironmentRouting)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) },
        sessionOperationTimeout: Duration = SessionOperationConfiguration.defaultTimeout,
        sessionOperationSleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) {
        let selectedRepository = repository ?? InMemoryMemberRepository()
        let selectedEnvironmentRouter = environmentRouter ?? RuntimeSessionEnvironmentRouter()
        let selectedResolveAuthorizedSession = resolveAuthorizedSession ?? makeTestResolveAuthorizedSession(
            repository: selectedRepository,
            authorizedMemberResolver: authorizedMemberResolver,
            environmentRouter: selectedEnvironmentRouter
        )
        self.init(
            dependencies: SessionViewModelDependencies(
                feedbackCenter: feedbackCenter,
                repository: selectedRepository,
                authSessionProvider: authSessionProvider ?? MockAuthSessionProvider(),
                resolveAuthorizedSession: selectedResolveAuthorizedSession,
                authorizedDeviceRegistrar: authorizedDeviceRegistrar ?? NoOpAuthorizedDeviceRegistrar(),
                criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository,
                environmentRouter: selectedEnvironmentRouter,
                sessionRefreshPolicy: sessionRefreshPolicy,
                nowMillisProvider: nowMillisProvider,
                sessionOperationTimeout: sessionOperationTimeout,
                sessionOperationSleeper: sessionOperationSleeper,
                developImpersonationEnabled: developImpersonationEnabled
            )
        )
    }
}

@MainActor
private func makeTestResolveAuthorizedSession(
    repository: any MemberRepository,
    authorizedMemberResolver: (any AuthorizedMemberResolving)?,
    environmentRouter: any SessionEnvironmentRouting
) -> ResolveAuthorizedSessionUseCase {
    let resolver: any AuthorizedMemberResolving
    if let authorizedMemberResolver {
        resolver = authorizedMemberResolver
    } else if let localRepository = repository as? any LocalMemberRepository {
        resolver = InMemoryAuthorizedMemberResolver(repository: localRepository)
    } else {
        preconditionFailure("A non-local test repository requires an explicit authorized-session resolver")
    }
    return ResolveAuthorizedSessionUseCase(
        repository: repository,
        resolver: resolver,
        environmentRouter: environmentRouter
    )
}
