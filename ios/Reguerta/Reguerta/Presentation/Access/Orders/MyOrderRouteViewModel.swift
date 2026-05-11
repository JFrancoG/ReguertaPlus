import Observation

@MainActor
@Observable
final class MyOrderRouteViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let ordersRepository: any OrdersRepository
    @ObservationIgnored let cartStore: any MyOrderCartStore
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64

    var context: MyOrderRouteContext = .empty
    var searchQuery = ""
    var selectedQuantities: [String: Int] = [:]
    var selectedEcoBasketOptions: [String: String] = [:]
    var confirmedQuantities: [String: Int] = [:]
    var confirmedEcoBasketOptions: [String: String] = [:]
    var isCartVisible = false
    var isSubmittingCheckout = false
    var checkoutAlert: MyOrderCheckoutAlert?
    var isViewingConfirmedOrder = false
    var previousOrderState: MyOrderPreviousOrderState = .loading
    var confirmedProducerStatusesByVendor: [String: ProducerOrderStatus] = [:]
    var confirmedLegacyProducerStatus: ProducerOrderStatus = .unread

    var hasRestoredCartState = false
    var restoredCartStorageKey: String?
    var loadedConsultaTaskID: String?
    var loadedStatusTaskID: String?

    init(
        sessionViewModel: SessionViewModel,
        ordersRepository: any OrdersRepository,
        cartStore: any MyOrderCartStore,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
        self.cartStore = cartStore
        self.nowMillisProvider = nowMillisProvider
    }
}
