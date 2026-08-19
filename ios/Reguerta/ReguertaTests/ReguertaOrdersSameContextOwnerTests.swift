import Testing

@testable import Reguerta

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct ReguertaOrdersSameContextOwnerTests {
    @Test func myOrderSameContextReentryRestartsACancelledProducerStatusLoad() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.myOrderProducerStatuses(.develop)],
            producerStatusSnapshots: [
                .develop: MyOrderProducerStatusSnapshot(
                    byVendor: ["producer_even": .prepared],
                    legacyStatus: .prepared
                )
            ]
        )
        let cartStore = InMemoryMyOrderCartStore()
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        await cartStore.seedConfirmed(
            MyOrderCartSnapshot(selectedQuantities: [product.id: 1], selectedEcoBasketOptions: [:]),
            storageKey: myOrderLocalStateStorageKey(
                memberId: "member_1",
                weekKey: "2026-W20",
                environment: .develop
            )
        )
        let context = myOrderContext(products: [product], nowMillis: nowMillis, currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: makeOrdersSessionViewModel(currentMember: currentMember),
            ordersRepository: repository,
            cartStore: cartStore,
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
        await repository.resume(.myOrderProducerStatuses(.develop))
        await firstAppearance.value

        #expect(viewModel.confirmedProducerStatusesByVendor == ["producer_even": .prepared])
        #expect(viewModel.confirmedLegacyProducerStatus == .prepared)
        #expect(
            await repository.recordedCalls() == [
                .myOrderProducerStatuses(.develop),
                .myOrderProducerStatuses(.develop)
            ]
        )
    }

    @Test func myOrderSameContextReentryKeepsCheckoutOwnershipAndProgress() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.submitMyOrder(.develop)],
            submitResults: [.develop: true]
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let context = myOrderContext(products: [product], nowMillis: nowMillis, currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: makeOrdersSessionViewModel(currentMember: currentMember),
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        await viewModel.appear(context: context)
        viewModel.increase(product)

        let submitCallCount = await repository.recordedCalls().count + 1
        let checkout = Task { await viewModel.validateCheckout() }
        defer {
            checkout.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(submitCallCount)

        await viewModel.appear(context: context)
        #expect(viewModel.isSubmittingCheckout)

        await repository.resume(.submitMyOrder(.develop))
        await checkout.value

        #expect(!viewModel.isSubmittingCheckout)
        guard case .readyToSubmit(let total, let noPickupEcoBaskets) = viewModel.checkoutAlert else {
            Issue.record("Expected the same-context checkout owner to publish success")
            return
        }
        #expect(total == 2)
        #expect(noPickupEcoBaskets == 0)
        let submitCalls = await repository.recordedCalls().filter { $0 == .submitMyOrder(.develop) }
        #expect(submitCalls.count == 1)
    }

    @Test func myOrdersHistorySameContextReentryRestartsACancelledWeekListLoad() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.orderHistoryWeekKeys(.develop)],
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

        try await repository.waitForCallCount(1)
        firstAppearance.cancel()
        await viewModel.appear(context: context)
        await repository.resume(.orderHistoryWeekKeys(.develop))
        await firstAppearance.value

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the replacement order-history index owner to publish")
            return
        }
        #expect(snapshot.weekKey == "same-context")
        #expect(
            await repository.recordedCalls() == [
                .orderHistoryWeekKeys(.develop),
                .orderHistoryWeekKeys(.develop),
                .orderSummarySnapshot(.develop)
            ]
        )
    }

    @Test func receivedOrdersHistorySameContextReentryRestartsACancelledWeekListLoad() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.receivedOrdersHistoryWeekKeys(.develop)],
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

        try await repository.waitForCallCount(1)
        firstAppearance.cancel()
        await viewModel.appear(context: context)
        await repository.resume(.receivedOrdersHistoryWeekKeys(.develop))
        await firstAppearance.value

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the replacement received-order history index owner to publish")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(
            await repository.recordedCalls() == [
                .receivedOrdersHistoryWeekKeys(.develop),
                .receivedOrdersHistoryWeekKeys(.develop),
                .receivedOrdersHistorySnapshot(.develop)
            ]
        )
    }

    @Test func receivedOrdersSameContextReentryKeepsStatusWriteOwnershipAndProgress() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.updateReceivedOrderProducerStatus(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .unread)]
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
        await viewModel.appear(context: context)

        let statusWrite = Task { await viewModel.updateProducerStatus(orderId: "order_1", status: .prepared) }
        defer {
            statusWrite.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(2)

        await viewModel.appear(context: context)
        #expect(viewModel.updatingStatusOrderId == "order_1")

        await repository.resume(.updateReceivedOrderProducerStatus(.develop))
        await statusWrite.value

        #expect(viewModel.updatingStatusOrderId == nil)
        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the same-context status-write owner to publish success")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .prepared)
        let statusWriteCalls = await repository.recordedCalls().filter {
            $0 == .updateReceivedOrderProducerStatus(.develop)
        }
        #expect(statusWriteCalls.count == 1)
    }
}
