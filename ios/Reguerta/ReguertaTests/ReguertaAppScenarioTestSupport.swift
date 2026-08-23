import Foundation

@testable import Reguerta

struct PureAppAssemblyFixture {
    let environment: ReguertaAppEnvironment
    let environmentRouter: RuntimeSessionEnvironmentRouter
}

private struct PureAppAssemblyCollaborators {
    let feedbackCenter: GlobalFeedbackCenter
    let memberRepository: InMemoryMemberRepository
    let notificationRepository: InMemoryNotificationRepository
    let authorizedDeviceRegistrar: IdentityAuthorizedDeviceRegistrar
    let freshnessLocalRepository: InMemoryCriticalDataFreshnessLocalRepository
    let imagePipelineManager: IdentityImagePipelineManager
    let environmentStore: RuntimeSessionEnvironmentStore
    let environmentRouter: RuntimeSessionEnvironmentRouter
    let developmentTimeMachine: DevelopmentTimeMachine
    let nowMillisProvider: @Sendable () -> Int64
}

@MainActor
func makePureAppAssemblyFixture(developmentTimeMachine: DevelopmentTimeMachine) -> PureAppAssemblyFixture {
    let collaborators = makePureAppAssemblyCollaborators(developmentTimeMachine: developmentTimeMachine)
    let freshnessDependencies = MyOrderFreshnessFeatureDependencies.preview(
        localRepository: collaborators.freshnessLocalRepository,
        nowProvider: collaborators.nowMillisProvider
    )
    let sessionDependencies = SessionViewModelPreviewDependencies.make(
        repository: collaborators.memberRepository,
        feedbackCenter: collaborators.feedbackCenter,
        authorizedDeviceRegistrar: collaborators.authorizedDeviceRegistrar,
        criticalDataFreshnessLocalRepository: collaborators.freshnessLocalRepository,
        environmentRouter: collaborators.environmentRouter,
        nowMillisProvider: collaborators.nowMillisProvider
    )
    let assembly = ReguertaAppAssemblyDependencies(
        session: sessionDependencies,
        loadNewsImageData: { _ in Data() },
        root: makePureAppRootAssemblyDependencies(
            collaborators: collaborators,
            freshnessDependencies: freshnessDependencies
        )
    )
    return PureAppAssemblyFixture(
        environment: ReguertaAppEnvironment.assemble(assembly),
        environmentRouter: collaborators.environmentRouter
    )
}

@MainActor
private func makePureAppAssemblyCollaborators(
    developmentTimeMachine: DevelopmentTimeMachine
) -> PureAppAssemblyCollaborators {
    let environmentStore = RuntimeSessionEnvironmentStore()
    let nowMillisProvider: @Sendable () -> Int64 = {
        developmentTimeMachine.nowMillis()
    }
    return PureAppAssemblyCollaborators(
        feedbackCenter: GlobalFeedbackCenter(),
        memberRepository: InMemoryMemberRepository(),
        notificationRepository: InMemoryNotificationRepository(),
        authorizedDeviceRegistrar: IdentityAuthorizedDeviceRegistrar(),
        freshnessLocalRepository: InMemoryCriticalDataFreshnessLocalRepository(),
        imagePipelineManager: IdentityImagePipelineManager(),
        environmentStore: environmentStore,
        environmentRouter: RuntimeSessionEnvironmentRouter(environmentStore: environmentStore),
        developmentTimeMachine: developmentTimeMachine,
        nowMillisProvider: nowMillisProvider
    )
}

@MainActor
private func makePureAppRootAssemblyDependencies(
    collaborators: PureAppAssemblyCollaborators,
    freshnessDependencies: MyOrderFreshnessFeatureDependencies
) -> ReguertaAppRootAssemblyDependencies {
    ReguertaAppRootAssemblyDependencies(
        products: .preview(
            memberRepository: collaborators.memberRepository,
            imagePipelineManager: collaborators.imagePipelineManager,
            nowMillisProvider: collaborators.nowMillisProvider
        ),
        orders: .preview(nowMillisProvider: collaborators.nowMillisProvider),
        shifts: .preview(
            nowMillisProvider: collaborators.nowMillisProvider,
            environmentProvider: { collaborators.environmentStore.snapshot().environment }
        ),
        newsNotifications: .preview(
            notificationRepository: collaborators.notificationRepository,
            imagePipelineManager: collaborators.imagePipelineManager,
            nowMillisProvider: collaborators.nowMillisProvider,
            environmentProvider: { collaborators.environmentStore.snapshot().environment }
        ),
        sharedProfile: .preview(
            imagePipelineManager: collaborators.imagePipelineManager,
            nowMillisProvider: collaborators.nowMillisProvider
        ),
        users: .preview(memberRepository: collaborators.memberRepository),
        myOrderFreshness: freshnessDependencies,
        bylaws: .preview(),
        developmentTimeMachine: collaborators.developmentTimeMachine,
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: nil),
            environment: .develop
        ),
        shouldSkipSplashProvider: { false },
        installedVersionProvider: { "assembly-test" }
    )
}

@MainActor
func withIsolatedDevelopmentTimeMachine<Result>(
    systemNowMillis: Int64 = 0,
    operation: (DevelopmentTimeMachine) throws -> Result
) throws -> Result {
    let suiteName = "ReguertaAppScenarioTests.\(UUID().uuidString)"
    guard let userDefaults = UserDefaults(suiteName: suiteName) else {
        throw ReguertaAppScenarioTestError.unavailableUserDefaultsSuite
    }
    userDefaults.removePersistentDomain(forName: suiteName)
    defer { userDefaults.removePersistentDomain(forName: suiteName) }

    return try operation(
        DevelopmentTimeMachine(
            defaults: userDefaults,
            systemNowMillisProvider: { systemNowMillis }
        )
    )
}

private enum ReguertaAppScenarioTestError: Error {
    case unavailableUserDefaultsSuite
}

private final class IdentityAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        .skipped
    }

    func updateRegistrationToken(_ token: String?) async throws {}

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {}
}

private final class IdentityImagePipelineManager: ImagePipelineManager {
    func processAndUpload(imageData: Data, request: ImageUploadRequest) async throws -> ImageUploadResult {
        throw ImagePipelineError.uploadFailed
    }
}
