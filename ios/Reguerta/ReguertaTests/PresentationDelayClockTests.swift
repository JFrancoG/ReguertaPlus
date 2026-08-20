import Foundation
import Testing

@testable import Reguerta

@MainActor
struct PresentationDelayClockTests {
    @Test func splashDelayUsesTheInjectedClockAndPreservesCancellation() async throws {
        let sleeper = ControlledPresentationDelaySleeper()
        let viewModel = makeRootViewModel(clock: makeClock(sleeper: sleeper))

        let splashTask = Task { await viewModel.handleSplashIfNeeded() }
        try await sleeper.waitForRequestCount(1)

        #expect(await sleeper.requestedDuration(at: 0) == .milliseconds(1_500))

        splashTask.cancel()
        await splashTask.value

        #expect(await sleeper.wasCancelled(at: 0))
        #expect(viewModel.splashDelayCompleted == false)
        #expect(viewModel.shellState.currentRoute == .splash)
    }

    @Test func memberHighlightCancelsTheSupersededDelayAndKeepsTheLatestOwner() async throws {
        let sleeper = ControlledPresentationDelaySleeper()
        let scenario = makeUsersHighlightScenario(clock: makeClock(sleeper: sleeper))
        let viewModel = scenario.viewModel

        #expect(await viewModel.toggleActive(memberId: scenario.target.id))
        try await sleeper.waitForRequestCount(1)
        let firstTask = try #require(viewModel.memberHighlightTask)

        #expect(await viewModel.toggleActive(memberId: scenario.target.id))
        await firstTask.value
        try await sleeper.waitForRequestCount(2)

        #expect(await sleeper.requestedDuration(at: 0) == .milliseconds(1_600))
        #expect(await sleeper.requestedDuration(at: 1) == .milliseconds(1_600))
        #expect(await sleeper.wasCancelled(at: 0))
        #expect(viewModel.highlightedMemberId == scenario.target.id)

        let latestTask = try #require(viewModel.memberHighlightTask)
        await sleeper.completeRequest(at: 1)
        await latestTask.value

        #expect(viewModel.highlightedMemberId == nil)
        #expect(viewModel.memberHighlightTask == nil)
    }

    @Test func productHighlightCancelsTheSupersededDelayAndKeepsTheLatestOwner() async throws {
        let sleeper = ControlledPresentationDelaySleeper()
        let viewModel = makeProductsViewModel(clock: makeClock(sleeper: sleeper))

        viewModel.highlightProduct("product-first")
        try await sleeper.waitForRequestCount(1)
        let firstTask = try #require(viewModel.productHighlightTask)

        viewModel.highlightProduct("product-latest")
        await firstTask.value
        try await sleeper.waitForRequestCount(2)

        #expect(await sleeper.requestedDuration(at: 0) == .milliseconds(1_600))
        #expect(await sleeper.requestedDuration(at: 1) == .milliseconds(1_600))
        #expect(await sleeper.wasCancelled(at: 0))
        #expect(viewModel.highlightedProductId == "product-latest")

        let latestTask = try #require(viewModel.productHighlightTask)
        await sleeper.completeRequest(at: 1)
        await latestTask.value

        #expect(viewModel.highlightedProductId == nil)
        #expect(viewModel.productHighlightTask == nil)
    }

    @Test func newsHighlightCancelsTheSupersededDelayAndKeepsTheLatestOwner() async throws {
        let sleeper = ControlledPresentationDelaySleeper()
        let viewModel = makeNewsViewModel(clock: makeClock(sleeper: sleeper))

        viewModel.highlightNews("news-first")
        try await sleeper.waitForRequestCount(1)
        let firstTask = try #require(viewModel.newsHighlightTask)

        viewModel.highlightNews("news-latest")
        await firstTask.value
        try await sleeper.waitForRequestCount(2)

        #expect(await sleeper.requestedDuration(at: 0) == .milliseconds(1_600))
        #expect(await sleeper.requestedDuration(at: 1) == .milliseconds(1_600))
        #expect(await sleeper.wasCancelled(at: 0))
        #expect(viewModel.highlightedNewsId == "news-latest")

        let latestTask = try #require(viewModel.newsHighlightTask)
        await sleeper.completeRequest(at: 1)
        await latestTask.value

        #expect(viewModel.highlightedNewsId == nil)
        #expect(viewModel.newsHighlightTask == nil)
    }

    @Test(arguments: HighlightInvalidationScenario.allCases)
    func contextInvalidationCancelsTheOwnedHighlight(_ scenario: HighlightInvalidationScenario) async throws {
        let sleeper = ControlledPresentationDelaySleeper()
        let harness = makeHighlightInvalidationHarness(scenario: scenario, sleeper: sleeper)

        #expect(await harness.start())
        try await sleeper.waitForRequestCount(1)
        let ownedTask = try #require(harness.state().task)

        harness.invalidate()
        await ownedTask.value

        #expect(await sleeper.wasCancelled(at: 0))
        #expect(harness.state().id == nil)
        #expect(harness.state().task == nil)
    }
}

@MainActor
private extension PresentationDelayClockTests {
    func makeClock(sleeper: ControlledPresentationDelaySleeper) -> PresentationDelayClock {
        PresentationDelayClock(
            sleep: { duration in
                try await sleeper.sleep(for: duration)
            }
        )
    }

    func makeRootViewModel(clock: PresentationDelayClock) -> AccessRootViewModel {
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
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: FixedStartupVersionPolicyRepository(policy: nil),
                environment: .develop
            ),
            shouldSkipSplashProvider: { false },
            installedVersionProvider: { "1.0.0" },
            splashClock: clock
        )
    }

    func makeUsersHighlightScenario(clock: PresentationDelayClock) -> UsersHighlightScenario {
        let admin = clockAdminMember(id: "admin", authUID: "auth_admin")
        let target = Member(
            id: "member",
            displayName: "Member",
            normalizedEmail: "member@reguerta.test",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let members = [admin, target]
        let repository = InMemoryMemberRepository(items: members)
        let sessionViewModel = SessionViewModel(dependencies: .preview(repository: repository))
        let session = clockAuthorizedSession(admin: admin, members: members, environment: .develop)
        sessionViewModel.mode = .authorized(session)
        let dependencies = UsersFeatureDependencies.preview(memberRepository: repository)
        let viewModel = UsersFeatureViewModel(
            sessionViewModel: sessionViewModel,
            memberRepository: repository,
            upsertMemberByAdmin: dependencies.upsertMemberByAdmin,
            memberHighlightClock: clock
        )
        viewModel.currentSession = session
        viewModel.currentMember = admin
        viewModel.membersFeed = members
        return UsersHighlightScenario(viewModel: viewModel, target: target)
    }

    func makeProductsViewModel(clock: PresentationDelayClock) -> ProductsRouteViewModel {
        let dependencies = ProductsFeatureDependencies.preview()
        return ProductsRouteViewModel(
            sessionViewModel: SessionViewModel(dependencies: .preview()),
            productRepository: dependencies.productRepository,
            memberRepository: dependencies.memberRepository,
            seasonalCommitmentRepository: dependencies.seasonalCommitmentRepository,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: dependencies.nowMillisProvider,
            productHighlightClock: clock
        )
    }

    func makeNewsViewModel(clock: PresentationDelayClock) -> NewsNotificationsFeatureViewModel {
        let dependencies = NewsNotificationsFeatureDependencies.preview()
        return NewsNotificationsFeatureViewModel(
            sessionViewModel: SessionViewModel(dependencies: .preview()),
            newsRepository: dependencies.newsRepository,
            notificationRepository: dependencies.notificationRepository,
            pushNotificationPermissionProvider: dependencies.pushNotificationPermissionProvider,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: dependencies.nowMillisProvider,
            environmentProvider: dependencies.environmentProvider,
            newsHighlightClock: clock
        )
    }

    func makeHighlightInvalidationHarness(
        scenario: HighlightInvalidationScenario,
        sleeper: ControlledPresentationDelaySleeper
    ) -> HighlightInvalidationHarness {
        let clock = makeClock(sleeper: sleeper)
        switch scenario {
        case .usersAuthorizedSuccessor:
            return makeUsersHighlightInvalidationHarness(clock: clock)
        case .productsSignedOut:
            return makeProductsHighlightInvalidationHarness(clock: clock)
        case .newsEnvironmentTransition:
            return makeNewsHighlightInvalidationHarness(clock: clock)
        }
    }

    func makeUsersHighlightInvalidationHarness(clock: PresentationDelayClock) -> HighlightInvalidationHarness {
        let users = makeUsersHighlightScenario(clock: clock)
        return HighlightInvalidationHarness(
            start: { await users.viewModel.toggleActive(memberId: users.target.id) },
            invalidate: {
                let successor = self.clockAdminMember(id: "successor", authUID: "auth_successor")
                users.viewModel.adoptAuthorizedSession(
                    self.clockAuthorizedSession(
                        admin: successor,
                        members: [successor, users.target],
                        environment: .production
                    ),
                    sourceMayContainPrivateMembers: true
                )
            },
            state: {
                HighlightOwnerState(
                    id: users.viewModel.highlightedMemberId,
                    task: users.viewModel.memberHighlightTask
                )
            }
        )
    }

    func makeProductsHighlightInvalidationHarness(clock: PresentationDelayClock) -> HighlightInvalidationHarness {
        let viewModel = makeProductsViewModel(clock: clock)
        return HighlightInvalidationHarness(
            start: {
                viewModel.highlightProduct("product")
                return true
            },
            invalidate: { viewModel.handleSessionModeChange(.signedOut) },
            state: {
                HighlightOwnerState(id: viewModel.highlightedProductId, task: viewModel.productHighlightTask)
            }
        )
    }

    func makeNewsHighlightInvalidationHarness(clock: PresentationDelayClock) -> HighlightInvalidationHarness {
        let viewModel = makeNewsViewModel(clock: clock)
        return HighlightInvalidationHarness(
            start: {
                viewModel.highlightNews("news")
                return true
            },
            invalidate: {
                viewModel.handleEnvironmentRoutingTransition(
                    SessionEnvironmentRoutingTransition(generation: 1, environment: .production)
                )
            },
            state: {
                HighlightOwnerState(id: viewModel.highlightedNewsId, task: viewModel.newsHighlightTask)
            }
        )
    }

    func clockAdminMember(id: String, authUID: String) -> Member {
        Member(
            id: id,
            displayName: id.capitalized,
            normalizedEmail: "\(id)@reguerta.test",
            authUid: authUID,
            roles: [.member, .admin],
            isActive: true,
            producerCatalogEnabled: true
        )
    }

    func clockAuthorizedSession(
        admin: Member,
        members: [Member],
        environment: SessionEnvironment
    ) -> AuthorizedSession {
        AuthorizedSession(
            principal: AuthPrincipal(uid: admin.authUid ?? "", email: admin.normalizedEmail),
            authenticatedMember: admin,
            member: admin,
            members: members,
            environment: environment
        )
    }
}

enum HighlightInvalidationScenario: CaseIterable {
    case usersAuthorizedSuccessor
    case productsSignedOut
    case newsEnvironmentTransition
}

@MainActor
private struct HighlightInvalidationHarness {
    let start: @MainActor () async -> Bool
    let invalidate: @MainActor () -> Void
    let state: @MainActor () -> HighlightOwnerState
}

private struct HighlightOwnerState {
    let id: String?
    let task: Task<Void, Never>?
}

@MainActor
private struct UsersHighlightScenario {
    let viewModel: UsersFeatureViewModel
    let target: Member
}

private actor ControlledPresentationDelaySleeper {
    private var nextRequestIndex = 0
    private var registeredRequestCount = 0
    private var requestedDurations: [Duration] = []
    private var requestContinuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var cancelledRequests: Set<Int> = []
    private var nextRequestCountWaiterID = 0
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]

    func sleep(for duration: Duration) async throws {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        requestedDurations.append(duration)

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if cancelledRequests.remove(requestIndex) != nil {
                    continuation.resume(throwing: CancellationError())
                } else {
                    requestContinuations[requestIndex] = continuation
                    registeredRequestCount += 1
                    resumeSatisfiedRequestCountWaiters()
                }
            }
        } onCancel: {
            Task { await self.cancelRequest(at: requestIndex) }
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard registeredRequestCount < expectedCount else { return }
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

    func requestedDuration(at index: Int) -> Duration {
        requestedDurations[index]
    }

    func wasCancelled(at index: Int) -> Bool {
        cancelledRequests.contains(index)
    }

    func completeRequest(at index: Int) {
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("Missing presentation delay request at index \(index)")
            return
        }
        continuation.resume()
    }

    private func cancelRequest(at index: Int) {
        cancelledRequests.insert(index)
        requestContinuations.removeValue(forKey: index)?.resume(throwing: CancellationError())
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedWaiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= registeredRequestCount ? waiterID : nil
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
