import Testing

@testable import Reguerta

@MainActor
struct ReguertaOrdersViewModelTests {
    @Test
    func myOrderViewModelRestoresCartAndConfirmedOrderFromStore() async {
        let repository = InMemoryOrdersRepository()
        let cartStore = InMemoryMyOrderCartStore()
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let context = myOrderContext(products: [product], currentMember: currentMember)
        let storageKey = "member_member_1_week_2026-W20"
        await cartStore.seedCart(
            MyOrderCartSnapshot(selectedQuantities: [product.id: 2], selectedEcoBasketOptions: [:]),
            storageKey: storageKey
        )
        await cartStore.seedConfirmed(
            MyOrderCartSnapshot(selectedQuantities: [product.id: 2], selectedEcoBasketOptions: [:]),
            storageKey: storageKey
        )
        let viewModel = makeMyOrderViewModel(repository: repository, cartStore: cartStore)

        await viewModel.appear(context: context)

        #expect(viewModel.selectedQuantities == [product.id: 2])
        #expect(viewModel.confirmedQuantities == [product.id: 2])
        #expect(viewModel.isReadOnlyConfirmedView)
        #expect(viewModel.selectedUnits == 2)
    }

    @Test
    func myOrderViewModelSanitizesQuantitiesAgainstStockAndCommitments() async {
        let product = finiteStockProduct(
            regularProduct(id: "avocado", vendorId: "producer_even", name: "Aguacates"),
            stock: 5
        )
        let viewModel = makeMyOrderViewModel()

        await viewModel.appear(
            context: myOrderContext(
                products: [product],
                seasonalCommitments: [
                    seasonalCommitment(productId: product.id, fixedQtyPerOfferedWeek: 3)
                ]
            )
        )
        viewModel.selectedQuantities = [product.id: 8]
        viewModel.sanitizeSelectedStateForCurrentProducts()

        #expect(viewModel.selectedQuantities == [product.id: 3])
    }

    @Test
    func myOrderViewModelBlocksCheckoutWithExistingValidation() async {
        let product = regularProduct(id: "avocado", vendorId: "producer_even", name: "Aguacates")
        let viewModel = makeMyOrderViewModel()
        await viewModel.appear(
            context: myOrderContext(
                products: [product],
                seasonalCommitments: [
                    seasonalCommitment(productId: product.id, fixedQtyPerOfferedWeek: 1)
                ]
            )
        )

        await viewModel.validateCheckout()

        guard case .missingCommitments(let names) = viewModel.checkoutAlert else {
            Issue.record("Expected missing commitment checkout alert")
            return
        }
        #expect(names == ["Aguacates"])
    }

    @Test
    func myOrderViewModelPersistsSuccessfulCheckoutAndConfirmedSnapshot() async {
        let repository = InMemoryOrdersRepository()
        let cartStore = InMemoryMyOrderCartStore()
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let viewModel = makeMyOrderViewModel(repository: repository, cartStore: cartStore)

        await viewModel.appear(context: myOrderContext(products: [product]))
        viewModel.increase(product)
        await viewModel.validateCheckout()

        guard case .readyToSubmit(let total, let noPickupEcoBaskets) = viewModel.checkoutAlert else {
            Issue.record("Expected checkout success alert")
            return
        }
        let confirmed = await cartStore.readConfirmed(storageKey: "member_member_1_week_2026-W20")
        let submissions = await repository.submissions()
        #expect(total == 2.0)
        #expect(noPickupEcoBaskets == 0)
        #expect(confirmed.selectedQuantities == [product.id: 1])
        #expect(submissions.count == 1)
        #expect(submissions.first?.weekKey == "2026-W20")
    }

    @Test
    func myOrderViewModelLoadsEmptyAndErrorPreviousOrderStates() async {
        let repository = InMemoryOrdersRepository()
        let viewModel = makeMyOrderViewModel(repository: repository)

        await viewModel.appear(context: myOrderContext(nowMillis: testMillis(year: 2026, month: 5, day: 11)))
        #expect(viewModel.previousOrderState == .empty)

        await repository.setPreviousOrderError(InMemoryOrdersRepositoryError.forcedFailure)
        await viewModel.retryPreviousOrder()
        #expect(viewModel.previousOrderState == .error)
    }

    @Test
    func receivedOrdersViewModelDoesNotLoadForNonProducerOrOutsideWindow() async {
        let repository = InMemoryOrdersRepository()
        let nonProducerViewModel = makeReceivedOrdersViewModel(repository: repository)
        await nonProducerViewModel.appear(
            context: receivedOrdersContext(
                currentMember: member(id: "member_1", ecoCommitmentMode: .weekly),
                nowMillis: testMillis(year: 2026, month: 5, day: 11)
            )
        )
        #expect(nonProducerViewModel.loadState == .idle)

        let producerViewModel = makeReceivedOrdersViewModel(repository: repository)
        await producerViewModel.appear(
            context: receivedOrdersContext(
                currentMember: producer(id: "producer_even", parity: .even),
                nowMillis: testMillis(year: 2026, month: 5, day: 14)
            )
        )
        #expect(producerViewModel.loadState == .idle)
    }

    @Test
    func receivedOrdersViewModelLoadsSnapshotByProductAndMember() async {
        let repository = InMemoryOrdersRepository()
        let snapshot = receivedOrdersSnapshot(status: .read)
        await repository.setReceivedOrdersSnapshot(
            snapshot,
            producerId: "producer_even",
            weekKey: "2026-W19"
        )
        let viewModel = makeReceivedOrdersViewModel(repository: repository)

        await viewModel.appear(
            context: receivedOrdersContext(
                currentMember: producer(id: "producer_even", parity: .even),
                nowMillis: testMillis(year: 2026, month: 5, day: 11)
            )
        )

        guard case .loaded(let loadedSnapshot) = viewModel.loadState else {
            Issue.record("Expected loaded received orders snapshot")
            return
        }
        #expect(loadedSnapshot.byProductRows.first?.productName == "Tomates")
        #expect(loadedSnapshot.byMemberGroups.first?.consumerDisplayName == "Carmen")
        #expect(loadedSnapshot.generalTotal == 6.0)
    }

    @Test
    func receivedOrdersViewModelUpdatesProducerStatusAndMutatesLocalSnapshot() async {
        let repository = InMemoryOrdersRepository()
        await repository.setReceivedOrdersSnapshot(
            receivedOrdersSnapshot(status: .read),
            producerId: "producer_even",
            weekKey: "2026-W19"
        )
        let viewModel = makeReceivedOrdersViewModel(repository: repository)
        await viewModel.appear(
            context: receivedOrdersContext(
                currentMember: producer(id: "producer_even", parity: .even),
                nowMillis: testMillis(year: 2026, month: 5, day: 11)
            )
        )

        await viewModel.updateProducerStatus(orderId: "order_1", status: .prepared)

        guard case .loaded(let loadedSnapshot) = viewModel.loadState else {
            Issue.record("Expected loaded received orders snapshot")
            return
        }
        #expect(loadedSnapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(viewModel.statusWriteFeedback == nil)
    }

    @Test
    func receivedOrdersViewModelShowsFeedbackWhenStatusUpdateFails() async {
        let repository = InMemoryOrdersRepository()
        await repository.setReceivedOrdersSnapshot(
            receivedOrdersSnapshot(status: .read),
            producerId: "producer_even",
            weekKey: "2026-W19"
        )
        await repository.setUpdateResult(.permissionDenied, forOrderId: "order_1")
        let viewModel = makeReceivedOrdersViewModel(repository: repository)
        await viewModel.appear(
            context: receivedOrdersContext(
                currentMember: producer(id: "producer_even", parity: .even),
                nowMillis: testMillis(year: 2026, month: 5, day: 11)
            )
        )

        await viewModel.updateProducerStatus(orderId: "order_1", status: .prepared)

        guard case .loaded(let loadedSnapshot) = viewModel.loadState else {
            Issue.record("Expected loaded received orders snapshot")
            return
        }
        #expect(loadedSnapshot.byMemberGroups.first?.producerStatus == .read)
        #expect(viewModel.statusWriteFeedback == .permissionDenied)
    }

    @Test
    func previewEnvironmentUsesInMemoryOrdersDependenciesAndSharesRootSession() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.myOrderViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.receivedOrdersViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.myOrderViewModel.ordersRepository is InMemoryOrdersRepository)
        #expect(environment.accessRootViewModel.myOrderViewModel.cartStore is InMemoryMyOrderCartStore)
        #expect(environment.accessRootViewModel.receivedOrdersViewModel.ordersRepository is InMemoryOrdersRepository)
    }

}
