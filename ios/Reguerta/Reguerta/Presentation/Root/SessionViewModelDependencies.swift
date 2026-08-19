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
}
