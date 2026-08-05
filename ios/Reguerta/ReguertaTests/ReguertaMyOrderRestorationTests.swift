import Testing

@testable import Reguerta

@MainActor
struct ReguertaMyOrderRestorationTests {
    @Test func myOrderViewModelKeepsRestoredDraftWhileProductsLoad() async {
        let cartStore = InMemoryMyOrderCartStore()
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let storageKey = "member_member_1_week_2026-W20"
        let restoredDraft = MyOrderCartSnapshot(
            selectedQuantities: [product.id: 2],
            selectedEcoBasketOptions: [:]
        )
        await cartStore.seedCart(restoredDraft, storageKey: storageKey)
        let viewModel = makeMyOrderViewModel(cartStore: cartStore)

        await viewModel.appear(context: myOrderContext(products: [], isLoading: true))
        let storedWhileLoading = await cartStore.readCart(storageKey: storageKey)

        #expect(viewModel.selectedQuantities == [product.id: 2])
        #expect(storedWhileLoading.selectedQuantities == [product.id: 2])

        await viewModel.appear(context: myOrderContext(products: [product], isLoading: false))

        #expect(viewModel.selectedQuantities == [product.id: 2])
        #expect(viewModel.selectedUnits == 2)
    }

    @Test func myOrderViewModelKeepsRestoredDraftBeforeProductRefreshStarts() async {
        let cartStore = InMemoryMyOrderCartStore()
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let storageKey = "member_member_1_week_2026-W20"
        let restoredDraft = MyOrderCartSnapshot(
            selectedQuantities: [product.id: 2],
            selectedEcoBasketOptions: [:]
        )
        await cartStore.seedCart(restoredDraft, storageKey: storageKey)
        let viewModel = makeMyOrderViewModel(cartStore: cartStore)

        await viewModel.appear(context: myOrderContext(products: [], isLoading: false))
        let storedBeforeRefresh = await cartStore.readCart(storageKey: storageKey)

        #expect(viewModel.selectedQuantities == [product.id: 2])
        #expect(storedBeforeRefresh.selectedQuantities == [product.id: 2])

        await viewModel.appear(context: myOrderContext(products: [product], isLoading: false))

        #expect(viewModel.selectedQuantities == [product.id: 2])
        #expect(viewModel.selectedUnits == 2)
    }

    @Test func myOrderViewModelRestoresCartAndConfirmedOrderFromStore() async {
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
}
