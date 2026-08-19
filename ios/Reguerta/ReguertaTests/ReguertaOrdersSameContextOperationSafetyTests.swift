import Testing

@testable import Reguerta

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct ReguertaOrdersSameContextOperationSafetyTests {
    @Test func myOrderSameContextReentryKeepsThePreviousOrderLoadCurrent() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.previousOrderSnapshot(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "same-context")]
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let context = myOrderContext(nowMillis: nowMillis, currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: makeOrdersSessionViewModel(currentMember: currentMember),
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        let firstAppearance = Task { await viewModel.appear(context: context) }
        defer {
            firstAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        firstAppearance.cancel()
        await viewModel.appear(context: context)
        await repository.resume(.previousOrderSnapshot(.develop))
        await firstAppearance.value

        guard case .loaded(let snapshot) = viewModel.previousOrderState else {
            Issue.record("Expected the shared previous-order operation to publish")
            return
        }
        #expect(snapshot.weekKey == "same-context")
        #expect(
            await repository.recordedCalls() == [
                .previousOrderSnapshot(.develop),
                .previousOrderSnapshot(.develop)
            ]
        )
    }

    @Test func myOrdersHistorySameContextReentryKeepsTheSelectedWeekLoadCurrent() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.orderSummarySnapshot(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "same-context")]
        )
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let context = myOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = MyOrdersHistoryRouteViewModel(
            sessionViewModel: makeOrdersSessionViewModel(currentMember: currentMember),
            ordersRepository: repository
        )
        let firstAppearance = Task { await viewModel.appear(context: context) }
        defer {
            firstAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(2)
        firstAppearance.cancel()
        await viewModel.appear(context: context)
        await repository.resume(.orderSummarySnapshot(.develop))
        await firstAppearance.value

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the shared order-history operation to publish")
            return
        }
        #expect(snapshot.weekKey == "same-context")
        #expect(
            await repository.recordedCalls() == [
                .orderHistoryWeekKeys(.develop),
                .orderSummarySnapshot(.develop),
                .orderSummarySnapshot(.develop)
            ]
        )
    }

    @Test func receivedOrdersHistorySameContextReentryKeepsTheSelectedWeekLoadCurrent() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.receivedOrdersHistorySnapshot(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let currentProducer = producer(id: "producer_even", parity: .even)
        let context = receivedOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentProducer
        )
        let viewModel = ReceivedOrdersHistoryRouteViewModel(
            sessionViewModel: makeOrdersSessionViewModel(currentMember: currentProducer),
            ordersRepository: repository
        )
        let firstAppearance = Task { await viewModel.appear(context: context) }
        defer {
            firstAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(2)
        firstAppearance.cancel()
        await viewModel.appear(context: context)
        await repository.resume(.receivedOrdersHistorySnapshot(.develop))
        await firstAppearance.value

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the shared received-order history operation to publish")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(
            await repository.recordedCalls() == [
                .receivedOrdersHistoryWeekKeys(.develop),
                .receivedOrdersHistorySnapshot(.develop),
                .receivedOrdersHistorySnapshot(.develop)
            ]
        )
    }

    @Test func receivedOrdersSameContextReentryKeepsTheSnapshotLoadCurrent() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.receivedOrdersSnapshot(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 11)
        let currentProducer = producer(id: "producer_even", parity: .even)
        let context = receivedOrdersContext(
            currentMember: currentProducer,
            nowMillis: nowMillis
        )
        let viewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: makeOrdersSessionViewModel(currentMember: currentProducer),
            ordersRepository: repository,
            nowMillisProvider: { nowMillis }
        )
        let firstAppearance = Task { await viewModel.appear(context: context) }
        defer {
            firstAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        firstAppearance.cancel()
        await viewModel.appear(context: context)
        await repository.resume(.receivedOrdersSnapshot(.develop))
        await firstAppearance.value

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the shared received-orders operation to publish")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(
            await repository.recordedCalls() == [
                .receivedOrdersSnapshot(.develop),
                .receivedOrdersSnapshot(.develop)
            ]
        )
    }
}
