import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ReguertaMyOrderOperationSafetyTests {
    @Test func rejectsAnObsoleteEnvironmentPreviousOrderResult() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.previousOrderSnapshot(.develop)],
            previousSnapshots: [
                .develop: previousOrderSnapshot(weekKey: "develop-result"),
                .production: previousOrderSnapshot(weekKey: "production-result")
            ]
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let sessionViewModel = makeOrdersSessionViewModel(currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        let obsoleteOperation = Task {
            await viewModel.appear(
                context: myOrderContext(nowMillis: nowMillis, currentMember: currentMember, environment: .develop)
            )
        }
        defer {
            obsoleteOperation.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        authorizeOrdersSession(sessionViewModel, currentMember: currentMember, environment: .production)
        await viewModel.appear(
            context: myOrderContext(nowMillis: nowMillis, currentMember: currentMember, environment: .production)
        )
        await repository.resume(.previousOrderSnapshot(.develop))
        await obsoleteOperation.value

        guard case .loaded(let snapshot) = viewModel.previousOrderState else {
            Issue.record("Expected the production previous-order snapshot to remain loaded")
            return
        }
        #expect(snapshot.weekKey == "production-result")
        #expect(
            await repository.recordedCalls() == [
                .previousOrderSnapshot(.develop),
                .previousOrderSnapshot(.production)
            ]
        )
    }

    @Test func rejectsAnObsoleteEnvironmentProducerStatusResult() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.myOrderProducerStatuses(.develop)],
            producerStatusSnapshots: [
                .develop: MyOrderProducerStatusSnapshot(
                    byVendor: ["producer_even": .unread],
                    legacyStatus: .unread
                ),
                .production: MyOrderProducerStatusSnapshot(
                    byVendor: ["producer_even": .prepared],
                    legacyStatus: .prepared
                )
            ]
        )
        let cartStore = InMemoryMyOrderCartStore()
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        await seedEnvironmentSwitchConfirmedOrder(productId: product.id, in: cartStore)
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let developContext = myOrderContext(products: [product], nowMillis: nowMillis, currentMember: currentMember)
        let sessionViewModel = makeOrdersSessionViewModel(currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: cartStore,
            nowMillisProvider: { nowMillis }
        )
        let obsoleteOperation = Task { await viewModel.appear(context: developContext) }
        defer {
            obsoleteOperation.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        authorizeOrdersSession(sessionViewModel, currentMember: currentMember, environment: .production)
        await viewModel.appear(
            context: myOrderContext(
                products: [product],
                nowMillis: nowMillis,
                currentMember: currentMember,
                environment: .production
            )
        )
        await repository.resume(.myOrderProducerStatuses(.develop))
        await obsoleteOperation.value

        await expectProductionProducerStatus(in: viewModel, repository: repository)
    }

    @Test func keepsSuccessorCheckoutProgressWhenAnObsoleteCheckoutCompletes() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.submitMyOrder(.develop), .submitMyOrder(.production)],
            submitResults: [.develop: true, .production: true]
        )
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let developContext = myOrderContext(products: [product], nowMillis: nowMillis, currentMember: currentMember)
        let sessionViewModel = makeOrdersSessionViewModel(currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        await viewModel.appear(context: developContext)
        viewModel.increase(product)

        let obsoleteCallCount = await repository.recordedCalls().count + 1
        let obsoleteCheckout = Task { await viewModel.validateCheckout() }
        defer {
            obsoleteCheckout.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(obsoleteCallCount)

        authorizeOrdersSession(sessionViewModel, currentMember: currentMember, environment: .production)
        await viewModel.appear(
            context: myOrderContext(
                products: [product],
                nowMillis: nowMillis,
                currentMember: currentMember,
                environment: .production
            )
        )
        viewModel.increase(product)
        let successorCallCount = await repository.recordedCalls().count + 1
        let successorCheckout = Task { await viewModel.validateCheckout() }
        defer { successorCheckout.cancel() }
        try await repository.waitForCallCount(successorCallCount)

        await repository.resume(.submitMyOrder(.develop))
        await obsoleteCheckout.value

        #expect(viewModel.isSubmittingCheckout)
        #expect(viewModel.checkoutAlert == nil)

        await repository.resume(.submitMyOrder(.production))
        await successorCheckout.value

        expectProductionCheckoutSuccess(in: viewModel)
    }
}

@MainActor
private func expectProductionProducerStatus(
    in viewModel: MyOrderRouteViewModel,
    repository: EnvironmentSwitchOrdersRepository
) async {
    #expect(viewModel.confirmedProducerStatusesByVendor == ["producer_even": .prepared])
    #expect(viewModel.confirmedLegacyProducerStatus == .prepared)
    #expect(
        await repository.recordedCalls() == [
            .myOrderProducerStatuses(.develop),
            .myOrderProducerStatuses(.production)
        ]
    )
}

@MainActor
private func expectProductionCheckoutSuccess(in viewModel: MyOrderRouteViewModel) {
    #expect(!viewModel.isSubmittingCheckout)
    guard case .readyToSubmit(let total, let noPickupEcoBaskets) = viewModel.checkoutAlert else {
        Issue.record("Expected only the production checkout to publish success")
        return
    }
    #expect(total == 2)
    #expect(noPickupEcoBaskets == 0)
}

@MainActor
private func seedEnvironmentSwitchConfirmedOrder(productId: String, in cartStore: InMemoryMyOrderCartStore) async {
    let snapshot = MyOrderCartSnapshot(selectedQuantities: [productId: 1], selectedEcoBasketOptions: [:])
    for environment in [SessionEnvironment.develop, .production] {
        await cartStore.seedConfirmed(
            snapshot,
            storageKey: myOrderLocalStateStorageKey(
                memberId: "member_1",
                weekKey: "2026-W20",
                environment: environment
            )
        )
    }
}
