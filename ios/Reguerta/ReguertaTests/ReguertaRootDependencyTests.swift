import Foundation
import SwiftUI
import Testing

@testable import Reguerta

@MainActor
struct ReguertaRootDependencyTests {
    @Test func presentationRootConstructorsRequireExplicitFeatureDependencies() throws {
        let relativePaths = [
            "Reguerta/Presentation/Root/AccessRootViewModel.swift",
            "Reguerta/Presentation/Freshness/MyOrderFreshnessViewModel.swift",
            "Reguerta/Presentation/Bylaws/BylawsFeatureViewModel.swift"
        ]

        for relativePath in relativePaths {
            let source = try source(at: relativePath)
            #expect(source.contains("= .preview()") == false, "\(relativePath) must require explicit dependencies")
        }

        let rootSource = try source(at: relativePaths[0])
        #expect(rootSource.contains("ProcessInfo.processInfo.arguments") == false)
    }

    @Test func previewEnvironmentSharesSessionWithRootCoordinator() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(environment.sessionViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(environment.accessRootViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.installedVersion == "0.0.0-preview")
        #expect(environment.sessionViewModel.mode == .signedOut)
    }

    @Test func previewDependenciesCreateSignedOutSessionWithoutLiveBootstrap() {
        let viewModel = SessionViewModel(dependencies: .preview())

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isDevelopImpersonationEnabled == false)
    }

    @Test func uiTestingEnvironmentUsesLocalFixturesWithoutLiveBootstrap() {
        let environment = ReguertaAppEnvironment.uiTesting()

        #expect(environment.accessRootViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(environment.sessionViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(environment.accessRootViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.installedVersion == "0.0.0-ui-testing")
        #expect(environment.sessionViewModel.mode == .signedOut)
        #expect(environment.sessionViewModel.isDevelopImpersonationEnabled == false)
    }

    @Test func environmentValuesPreserveTheInjectedAppGraphIdentity() {
        let environment = ReguertaAppEnvironment.preview()
        var values = EnvironmentValues()

        values.reguertaAppEnvironment = environment

        #expect(values.reguertaAppEnvironment.feedbackCenter === environment.feedbackCenter)
        #expect(values.reguertaAppEnvironment.sessionViewModel === environment.sessionViewModel)
        #expect(values.reguertaAppEnvironment.accessRootViewModel === environment.accessRootViewModel)
    }

    @Test func rootCoordinatorSkipsSplashToWelcomeWhenLaunchArgumentRequestsIt() async {
        let rootViewModel = makeRootViewModel(shouldSkipSplash: true)

        await rootViewModel.handleSplashIfNeeded()

        #expect(rootViewModel.splashDelayCompleted)
        #expect(rootViewModel.startupGateState == .optionalDismissed)
        #expect(rootViewModel.shellState.currentRoute == .welcome)
    }

    @Test func rootCoordinatorBlocksSplashWhenStartupGateRequiresForcedUpdate() async throws {
        let rootViewModel = makeRootViewModel(
            startupPolicy: StartupVersionPolicy(
                currentVersion: "2.0.0",
                minimumVersion: "2.0.0",
                forceUpdate: true,
                storeURL: "https://apps.apple.com/app/reguerta"
            ),
            installedVersion: "1.0.0"
        )
        rootViewModel.splashDelayCompleted = true

        rootViewModel.evaluateStartupGateIfNeeded()
        let operation = try #require(rootViewModel.startupGateOperationTask)
        await operation.value

        #expect(rootViewModel.startupGateState == .forcedUpdate(storeURL: "https://apps.apple.com/app/reguerta"))
        #expect(rootViewModel.shellState.currentRoute == .splash)
    }

    @Test func startupTimeoutPublishesWithoutWaitingForRemoteCompletionAndRetryRecovers() async throws {
        let repository = ControlledStartupVersionPolicyRepository()
        let sleeper = ControlledStartupGateSleeper()
        let rootViewModel = makeRootViewModel(
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(repository: repository, environment: .develop),
            startupGateSleeper: { duration in
                try await sleeper.sleep(for: duration)
            }
        )
        rootViewModel.splashDelayCompleted = true

        rootViewModel.evaluateStartupGateIfNeeded()
        guard let firstOperation = rootViewModel.startupGateOperationTask,
              let firstTimeout = rootViewModel.startupGateTimeoutTask else {
            Issue.record("Expected owned startup gate tasks")
            return
        }
        try await repository.waitForRequestCount(1)
        try await sleeper.waitForRequestCount(1)

        await sleeper.completeRequest(at: 0)
        await firstTimeout.value

        #expect(rootViewModel.startupGateState == .timedOut)
        #expect(rootViewModel.shellState.currentRoute == .splash)

        rootViewModel.retryStartupGate()
        guard let retryOperation = rootViewModel.startupGateOperationTask,
              let retryTimeout = rootViewModel.startupGateTimeoutTask else {
            Issue.record("Expected owned retry tasks")
            return
        }
        try await repository.waitForRequestCount(2)
        try await sleeper.waitForRequestCount(2)
        await repository.completeRequest(at: 1, with: .success(currentStartupPolicy()))
        await retryOperation.value
        await sleeper.completeRequest(at: 1)
        await retryTimeout.value

        #expect(rootViewModel.startupGateState == .ready)
        #expect(rootViewModel.shellState.currentRoute == .welcome)

        await repository.completeRequest(
            at: 0,
            with: .success(
                StartupVersionPolicy(
                    currentVersion: "2.0.0",
                    minimumVersion: "2.0.0",
                    forceUpdate: true,
                    storeURL: "https://apps.apple.com/app/reguerta"
                )
            )
        )
        await firstOperation.value

        #expect(rootViewModel.startupGateState == .ready)
    }

    @Test func startupFailureRequiresExplicitContinuation() async throws {
        let rootViewModel = makeRootViewModel()
        rootViewModel.splashDelayCompleted = true

        rootViewModel.evaluateStartupGateIfNeeded()
        let operation = try #require(rootViewModel.startupGateOperationTask)
        await operation.value

        #expect(rootViewModel.shellState.currentRoute == .splash)

        rootViewModel.continueAfterStartupGateFailure()

        #expect(rootViewModel.startupGateState == .optionalDismissed)
        #expect(rootViewModel.shellState.currentRoute == .welcome)
    }

    @Test func rootCoordinatorRoutesAuthenticatedSessionToHomeOutsideSplash() {
        let rootViewModel = makeRootViewModel()
        let currentMember = Member(
            id: "member_root",
            displayName: "Root Member",
            normalizedEmail: "root@reguerta.test",
            authUid: "auth_root",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        rootViewModel.shellState = AuthShellState(backStack: [.welcome, .login])
        rootViewModel.sessionViewModel.mode = .authorized(
            AuthorizedSession(
                principal: AuthPrincipal(uid: "auth_root", email: "root@reguerta.test"),
                authenticatedMember: currentMember,
                member: currentMember,
                members: [currentMember],
                environment: .develop
            )
        )

        rootViewModel.handleSessionModeChange(rootViewModel.sessionViewModel.mode)

        #expect(rootViewModel.shellState.currentRoute == .home)
        #expect(rootViewModel.shellState.canGoBack == false)
    }

    @Test func rootCoordinatorRoutesSignedOutSessionToWelcomeOutsideSplash() {
        let rootViewModel = makeRootViewModel()
        rootViewModel.shellState = AuthShellState(backStack: [.home])
        rootViewModel.sessionViewModel.mode = .signedOut

        rootViewModel.handleSessionModeChange(rootViewModel.sessionViewModel.mode)

        #expect(rootViewModel.shellState.currentRoute == .welcome)
        #expect(rootViewModel.shellState.canGoBack == false)
    }

    @Test func homeDrawerSignOutRequestsConfirmationWithoutEndingSession() {
        let rootViewModel = makeRootViewModel()
        rootViewModel.shellState = AuthShellState(backStack: [.home])
        rootViewModel.sessionViewModel.mode = .authorized(makeAuthorizedSession())
        rootViewModel.isHomeDrawerOpen = true

        rootViewModel.handleHomeDrawerSignOut()

        #expect(rootViewModel.showsHomeSignOutDialog)
        #expect(rootViewModel.isHomeDrawerOpen == false)
        #expect(rootViewModel.shellState.currentRoute == .home)
        guard case .authorized = rootViewModel.sessionViewModel.mode else {
            Issue.record("Drawer sign-out should wait for explicit confirmation")
            return
        }

        rootViewModel.dismissHomeDrawerSignOutDialog()

        #expect(rootViewModel.showsHomeSignOutDialog == false)
        guard case .authorized = rootViewModel.sessionViewModel.mode else {
            Issue.record("Dismissing the dialog should keep the session active")
            return
        }
    }

    @Test func homeDrawerSignOutConfirmationSignsOutAndRoutesWelcome() {
        let rootViewModel = makeRootViewModel()
        rootViewModel.shellState = AuthShellState(backStack: [.home])
        rootViewModel.sessionViewModel.mode = .authorized(makeAuthorizedSession())
        rootViewModel.showsHomeSignOutDialog = true

        rootViewModel.confirmHomeDrawerSignOut()

        #expect(rootViewModel.showsHomeSignOutDialog == false)
        #expect(rootViewModel.homeDestination == .dashboard)
        #expect(rootViewModel.sessionViewModel.mode == .signedOut)
        #expect(rootViewModel.shellState.currentRoute == .welcome)
        #expect(rootViewModel.shellState.canGoBack == false)
    }

    private func makeRootViewModel(
        startupPolicy: StartupVersionPolicy? = nil,
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase? = nil,
        shouldSkipSplash: Bool = false,
        installedVersion: String = "1.0.0",
        startupGateSleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) -> AccessRootViewModel {
        AccessRootViewModel(
            sessionViewModel: SessionViewModel(dependencies: .preview()),
            productsFeatureDependencies: .preview(),
            ordersFeatureDependencies: .preview(),
            shiftsFeatureDependencies: .preview(),
            newsNotificationsFeatureDependencies: .preview(),
            sharedProfileFeatureDependencies: .preview(),
            usersFeatureDependencies: .preview(),
            myOrderFreshnessFeatureDependencies: .preview(),
            bylawsFeatureDependencies: .preview(),
            developmentTimeMachine: DevelopmentTimeMachine(),
            startupVersionGateUseCase: startupVersionGateUseCase ?? ResolveStartupVersionGateUseCase(
                repository: FixedStartupVersionPolicyRepository(policy: startupPolicy),
                environment: .develop
            ),
            shouldSkipSplashProvider: { shouldSkipSplash },
            installedVersionProvider: { installedVersion },
            startupGateTimeout: .seconds(60),
            startupGateSleeper: startupGateSleeper
        )
    }

    private func makeAuthorizedSession() -> AuthorizedSession {
        let member = Member(
            id: "member_root",
            displayName: "Root Member",
            normalizedEmail: "root@reguerta.test",
            authUid: "auth_root",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        return AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_root", email: "root@reguerta.test"),
            authenticatedMember: member,
            member: member,
            members: [member],
            environment: .develop
        )
    }

    private func source(at relativePath: String) throws -> String {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: relativePath)
        return try String(contentsOf: sourceURL, encoding: .utf8)
    }
}

private func currentStartupPolicy() -> StartupVersionPolicy {
    StartupVersionPolicy(
        currentVersion: "1.0.0",
        minimumVersion: "1.0.0",
        forceUpdate: false,
        storeURL: "https://apps.apple.com/app/reguerta"
    )
}

private actor ControlledStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    private var nextRequestIndex = 0
    private var continuations: [Int: CheckedContinuation<Result<StartupVersionPolicy, RepositoryError>, Never>] = [:]
    private var nextRequestCountWaiterID = 0
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]

    func policy(for platform: StartupPlatform, environment _: SessionEnvironment) async throws -> StartupVersionPolicy {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        resumeSatisfiedRequestCountWaiters()
        let result = await withCheckedContinuation { continuation in
            continuations[requestIndex] = continuation
        }
        return try result.get()
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard nextRequestIndex < expectedCount else { return }
        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                requestCountWaiters[waiterID] = (expectedCount, continuation)
            }
        } onCancel: {
            Task { await self.cancelRequestCountWaiter(waiterID) }
        }
    }

    func completeRequest(at index: Int, with result: Result<StartupVersionPolicy, RepositoryError>) {
        continuations.removeValue(forKey: index)?.resume(returning: result)
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedWaiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= nextRequestIndex ? waiterID : nil
        }
        for waiterID in satisfiedWaiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(_ waiterID: Int) {
        requestCountWaiters
            .removeValue(forKey: waiterID)?
            .continuation
            .resume(throwing: CancellationError())
    }
}

private actor ControlledStartupGateSleeper {
    private var nextRequestIndex = 0
    private var continuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var nextRequestCountWaiterID = 0
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]

    func sleep(for _: Duration) async throws {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        resumeSatisfiedRequestCountWaiters()
        try await withCheckedThrowingContinuation { continuation in
            continuations[requestIndex] = continuation
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard nextRequestIndex < expectedCount else { return }
        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                requestCountWaiters[waiterID] = (expectedCount, continuation)
            }
        } onCancel: {
            Task { await self.cancelRequestCountWaiter(waiterID) }
        }
    }

    func completeRequest(at index: Int) {
        continuations.removeValue(forKey: index)?.resume()
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedWaiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= nextRequestIndex ? waiterID : nil
        }
        for waiterID in satisfiedWaiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(_ waiterID: Int) {
        requestCountWaiters
            .removeValue(forKey: waiterID)?
            .continuation
            .resume(throwing: CancellationError())
    }
}
