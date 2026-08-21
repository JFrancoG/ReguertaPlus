import Foundation

enum SessionViewModelPreviewDependencies {
    @MainActor
    static func make(
        repository: any LocalMemberRepository = InMemoryMemberRepository(),
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar(),
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository =
            NoOpCriticalDataFreshnessLocalRepository(),
        environmentRouter: any SessionEnvironmentRouting = FixedSessionEnvironmentRouter(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) -> SessionViewModelDependencies {
        return SessionViewModelDependencies(
            feedbackCenter: feedbackCenter,
            repository: repository,
            authSessionProvider: MockAuthSessionProvider(),
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
                repository: repository,
                resolver: InMemoryAuthorizedMemberResolver(repository: repository)
            ),
            authorizedDeviceRegistrar: authorizedDeviceRegistrar,
            criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository,
            environmentRouter: environmentRouter,
            sessionRefreshPolicy: SessionRefreshPolicy(),
            nowMillisProvider: nowMillisProvider,
            sessionOperationTimeout: SessionOperationConfiguration.defaultTimeout,
            sessionOperationSleeper: { try await ContinuousClock().sleep(for: $0) },
            developImpersonationEnabled: false
        )
    }
}

struct NoOpAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
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
