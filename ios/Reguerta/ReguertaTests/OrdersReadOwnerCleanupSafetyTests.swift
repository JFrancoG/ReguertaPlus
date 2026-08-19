import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct OrdersReadOwnerCleanupSafetyTests {
    @Test func benignSessionRevisionReleasesThePreviousOrderLoadWithoutRouteHandler() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.previousOrderSnapshot(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "stale")]
        )
        let currentMember = member(id: "member_previous_cleanup", ecoCommitmentMode: .weekly)
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let context = myOrderContext(nowMillis: nowMillis, currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        let appearance = Task { await viewModel.appear(context: context) }
        defer {
            appearance.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(1)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.previousOrderSnapshot(.develop))
        await appearance.value

        #expect(viewModel.previousOrderState == .empty)
        #expect(viewModel.loadedConsultaTaskID == nil)
        #expect(viewModel.consultaLoadOwnerGeneration == nil)
    }

    @Test func benignSessionRevisionReleasesTheDirectPreviousOrderRetryWithoutRouteHandler() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.previousOrderSnapshot(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "stale")]
        )
        let currentMember = member(id: "member_previous_retry_cleanup", ecoCommitmentMode: .weekly)
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let context = myOrderContext(nowMillis: nowMillis, currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        _ = viewModel.beginContextOperation(context)
        let retry = Task { await viewModel.retryPreviousOrder() }
        defer {
            retry.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(1)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.previousOrderSnapshot(.develop))
        await retry.value

        #expect(viewModel.previousOrderState == .empty)
    }

    @Test func benignSessionRevisionReleasesMyOrdersHistoryIndexWithoutRouteHandler() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.orderHistoryWeekKeys(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "stale")]
        )
        let currentMember = member(id: "member_history_index_cleanup", ecoCommitmentMode: .weekly)
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let context = myOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = MyOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository
        )
        let appearance = Task { await viewModel.appear(context: context) }
        defer {
            appearance.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(1)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.orderHistoryWeekKeys(.develop))
        await appearance.value

        #expect(viewModel.loadState == .idle)
        #expect(viewModel.availableWeeks.isEmpty)
    }

    @Test func benignSessionRevisionReleasesMyOrdersHistoryWeekWithoutRouteHandler() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.orderSummarySnapshot(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "stale")]
        )
        let currentMember = member(id: "member_history_week_cleanup", ecoCommitmentMode: .weekly)
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let context = myOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = MyOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository
        )
        let appearance = Task { await viewModel.appear(context: context) }
        defer {
            appearance.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(2)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.orderSummarySnapshot(.develop))
        await appearance.value

        #expect(viewModel.loadState == .idle)
    }

    @Test func benignSessionRevisionReleasesReceivedHistoryIndexWithoutRouteHandler() async throws {
        let currentMember = producer(id: "producer_history_index_cleanup", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.receivedOrdersHistoryWeekKeys(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let context = receivedOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = ReceivedOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository
        )
        let appearance = Task { await viewModel.appear(context: context) }
        defer {
            appearance.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(1)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.receivedOrdersHistoryWeekKeys(.develop))
        await appearance.value

        #expect(viewModel.loadState == .idle)
        #expect(viewModel.availableWeeks.isEmpty)
    }

    @Test func benignSessionRevisionReleasesReceivedHistoryWeekWithoutRouteHandler() async throws {
        let currentMember = producer(id: "producer_history_week_cleanup", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.receivedOrdersHistorySnapshot(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let context = receivedOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = ReceivedOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository
        )
        let appearance = Task { await viewModel.appear(context: context) }
        defer {
            appearance.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(2)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.receivedOrdersHistorySnapshot(.develop))
        await appearance.value

        #expect(viewModel.loadState == .idle)
    }

    @Test func benignSessionRevisionReleasesReceivedOrdersLoadWithoutRouteHandler() async throws {
        let currentMember = producer(id: "producer_received_cleanup", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.receivedOrdersSnapshot(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(
            session: ownerCleanupOrdersSession(for: currentMember)
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 11)
        let context = receivedOrdersContext(currentMember: currentMember, nowMillis: nowMillis)
        let viewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            nowMillisProvider: { nowMillis }
        )
        let appearance = Task { await viewModel.appear(context: context) }
        defer {
            appearance.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(1)

        applyBenignOrdersRevision(for: currentMember, to: sessionViewModel)
        await repository.resume(.receivedOrdersSnapshot(.develop))
        await appearance.value

        #expect(viewModel.loadState == .idle)
    }
}

@MainActor
private func applyBenignOrdersRevision(for member: Member, to sessionViewModel: SessionViewModel) {
    let refreshedMember = replacingDisplayName(in: member, with: "Nombre actualizado")
    sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
}
