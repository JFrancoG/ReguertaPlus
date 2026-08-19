import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaMyOrderRestorationTests {
    @Test func myOrderViewModelKeepsRestoredDraftWhileProductsLoad() async {
        let cartStore = InMemoryMyOrderCartStore()
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let storageKey = myOrderLocalStateStorageKey(memberId: "member_1", weekKey: "2026-W20", environment: .develop)
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
        let storageKey = myOrderLocalStateStorageKey(memberId: "member_1", weekKey: "2026-W20", environment: .develop)
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
        let storageKey = myOrderLocalStateStorageKey(memberId: "member_1", weekKey: "2026-W20", environment: .develop)
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

    @Test func environmentQualifiedStorageDoesNotRestoreDevelopOrderStateInProduction() async {
        let suiteName = "ReguertaMyOrderRestorationTests.environment.\(UUID().uuidString)"
        guard let userDefaults = UserDefaults(suiteName: suiteName) else {
            Issue.record("Expected test UserDefaults suite")
            return
        }
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        let cartStore = UserDefaultsMyOrderCartStore(userDefaults: userDefaults)
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let developContext = myOrderContext(
            products: [product],
            nowMillis: nowMillis,
            currentMember: currentMember,
            environment: .develop
        )
        let productionContext = myOrderContext(
            products: [product],
            nowMillis: nowMillis,
            currentMember: currentMember,
            environment: .production
        )
        let developStorageKey = developContext.cartStorageKey
        let productionStorageKey = productionContext.cartStorageKey
        let developSnapshot = MyOrderCartSnapshot(
            selectedQuantities: [product.id: 1],
            selectedEcoBasketOptions: [:]
        )
        await cartStore.persistCart(storageKey: developStorageKey, snapshot: developSnapshot)
        await cartStore.persistConfirmed(storageKey: developStorageKey, snapshot: developSnapshot)
        let viewModel = makeMyOrderViewModel(
            cartStore: cartStore,
            nowMillis: nowMillis,
            currentMember: currentMember
        )

        await viewModel.appear(context: developContext)
        viewModel.editConfirmedOrder()
        viewModel.increase(product)
        let editedDevelopSnapshot = await cartStore.readCart(storageKey: developStorageKey)

        #expect(developStorageKey != productionStorageKey)
        #expect(editedDevelopSnapshot.selectedQuantities == [product.id: 2])

        authorizeOrdersSession(viewModel.sessionViewModel, currentMember: currentMember, environment: .production)
        await viewModel.appear(context: productionContext)

        #expect(viewModel.selectedQuantities.isEmpty)
        #expect(viewModel.confirmedQuantities.isEmpty)
        #expect(!viewModel.isViewingConfirmedOrder)
        #expect(await cartStore.readCart(storageKey: productionStorageKey) == .empty)
        #expect(await cartStore.readConfirmed(storageKey: productionStorageKey) == .empty)
        #expect(await cartStore.readCart(storageKey: developStorageKey) == editedDevelopSnapshot)
    }

    @Test func legacyUnqualifiedStorageIsNotRestoredAutomatically() async {
        let cartStore = InMemoryMyOrderCartStore()
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let legacyStorageKey = "member_member_1_week_2026-W20"
        await cartStore.seedCart(
            MyOrderCartSnapshot(selectedQuantities: [product.id: 3], selectedEcoBasketOptions: [:]),
            storageKey: legacyStorageKey
        )
        let viewModel = makeMyOrderViewModel(cartStore: cartStore)

        await viewModel.appear(context: myOrderContext(products: [product], environment: .develop))

        #expect(viewModel.selectedQuantities.isEmpty)
        #expect(viewModel.cartStorageKey != legacyStorageKey)
    }
}
