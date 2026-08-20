#if DEBUG
import Foundation

@MainActor
final class AdaptiveOperationsPreviewFixture {
    let environment: ReguertaAppEnvironment
    let session: AuthorizedSession
    let ordersRepository: AdaptiveOperationsPreviewOrdersRepository
    let cartStore: AdaptiveOperationsPreviewCartStore
    let myOrderViewModel: MyOrderRouteViewModel
    let myOrdersHistoryViewModel: MyOrdersHistoryRouteViewModel
    let receivedOrdersViewModel: ReceivedOrdersRouteViewModel
    let receivedOrdersHistoryViewModel: ReceivedOrdersHistoryRouteViewModel
    let shiftsViewModel: ShiftsFeatureViewModel
    let productsViewModel: ProductsRouteViewModel
    let newsViewModel: NewsNotificationsFeatureViewModel
    let loadNewsImageData: @Sendable (URL) async throws -> Data

    var nowMillis: Int64 { AdaptiveOperationsPreviewData.nowMillis }
    var receivedOrdersNowMillis: Int64 { AdaptiveOperationsPreviewData.receivedOrdersNowMillis }
    var currentMember: Member { AdaptiveOperationsPreviewData.currentMember }
    var members: [Member] { AdaptiveOperationsPreviewData.members }
    var sharedProfile: SharedProfile { AdaptiveOperationsPreviewData.sharedProfile }
    var products: [Product] { AdaptiveOperationsPreviewData.products }
    var shifts: [ShiftAssignment] { AdaptiveOperationsPreviewData.shifts }

    init(scenario: AdaptiveOperationsPreviewScenario) {
        let data = AdaptiveOperationsPreviewData.self
        let session = data.session
        let historyWeekKey = orderHistoryPreviousIsoWeekKey(nowMillis: data.nowMillis, timeZone: data.timeZone)
        let ordersRepository = AdaptiveOperationsPreviewOrdersRepository(
            historyWeekKey: historyWeekKey,
            personalHistory: AdaptiveOperationsPreviewOrderData.personalHistory,
            receivedOrders: AdaptiveOperationsPreviewOrderData.receivedOrders
        )
        let cartSnapshot = scenario == .myOrderCart ? data.cartSnapshot : .empty
        let cartStore = AdaptiveOperationsPreviewCartStore(cartSnapshot: cartSnapshot)
        let environment = ReguertaAppEnvironment.preview(
            developmentTimeMachine: .transient(initialOverrideNowMillis: data.nowMillis)
        )
        environment.sessionViewModel.mode = .authorized(session)

        let sessionViewModel = environment.sessionViewModel
        let rootViewModel = environment.accessRootViewModel
        let myOrderViewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: ordersRepository,
            cartStore: cartStore,
            nowMillisProvider: { AdaptiveOperationsPreviewData.nowMillis }
        )
        let myOrdersHistoryViewModel = MyOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: ordersRepository
        )
        let receivedOrdersViewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: ordersRepository,
            nowMillisProvider: { AdaptiveOperationsPreviewData.receivedOrdersNowMillis }
        )
        let receivedOrdersHistoryViewModel = ReceivedOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: ordersRepository
        )

        self.environment = environment
        self.session = session
        self.ordersRepository = ordersRepository
        self.cartStore = cartStore
        self.myOrderViewModel = myOrderViewModel
        self.myOrdersHistoryViewModel = myOrdersHistoryViewModel
        self.receivedOrdersViewModel = receivedOrdersViewModel
        self.receivedOrdersHistoryViewModel = receivedOrdersHistoryViewModel
        self.shiftsViewModel = rootViewModel.shiftsViewModel
        self.productsViewModel = rootViewModel.productsViewModel
        self.newsViewModel = rootViewModel.newsNotificationsViewModel
        self.loadNewsImageData = { _ in throw AdaptivePreviewImageDataError.unavailable }

        configureSynchronousState(scenario: scenario)
    }

    var myOrderContext: MyOrderRouteContext {
        MyOrderRouteContext(
            products: products,
            seasonalCommitments: [],
            shifts: shifts,
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: deliveryCalendarOverrides,
            nowMillis: nowMillis,
            isLoading: false,
            currentMember: currentMember,
            members: members,
            environment: .develop
        )
    }

    var myOrdersHistoryContext: MyOrdersHistoryRouteContext {
        MyOrdersHistoryRouteContext(
            currentMember: currentMember,
            nowMillis: nowMillis,
            environment: .develop
        )
    }

    var receivedOrdersContext: ReceivedOrdersRouteContext {
        ReceivedOrdersRouteContext(
            currentMember: currentMember,
            shifts: shifts,
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: deliveryCalendarOverrides,
            nowMillis: receivedOrdersNowMillis,
            environment: .develop
        )
    }

    var receivedOrdersHistoryContext: ReceivedOrdersHistoryRouteContext {
        ReceivedOrdersHistoryRouteContext(
            currentMember: currentMember,
            nowMillis: receivedOrdersNowMillis,
            environment: .develop
        )
    }

    var homeDashboardPresentation: HomeDashboardPresentation {
        HomeDashboardPresentation(
            content: .authorized(
                HomeAuthorizedDashboardPresentation(
                    weeklySummary: AdaptiveOperationsPreviewData.homeWeeklySummary,
                    actionRow: HomeActionRowPresentation(
                        myOrderFreshnessState: .ready,
                        canOpenReceivedOrders: true,
                        orderState: .unconfirmed,
                        myOrderSubtitleKey: AccessL10nKey.homeDashboardMyOrderSubtitleReview
                    )
                )
            )
        )
    }

    var deliveryCalendarOverrides: [DeliveryCalendarOverride] {
        AdaptiveOperationsPreviewData.deliveryCalendarOverrides
    }

    var futureDeliveryShifts: [ShiftAssignment] {
        shiftsViewModel.futureDeliveryWeeks
    }

    var initialCalendarWeekKey: String {
        futureDeliveryShifts.first?.weekKey ?? "2026-W35"
    }

    var initialCalendarWeekday: DeliveryWeekday { .thursday }

    private func configureSynchronousState(scenario: AdaptiveOperationsPreviewScenario) {
        configureProductAndNewsState()
        configureShiftsState()
        configureMyOrderState(scenario: scenario)
        configureOrderHistoryState()
    }

    private func configureProductAndNewsState() {
        productsViewModel.currentSession = session
        productsViewModel.currentMember = currentMember
        productsViewModel.catalogProducts = products

        newsViewModel.currentSession = session
        newsViewModel.currentMember = currentMember
        newsViewModel.currentEnvironment = session.environment
        newsViewModel.latestNews = AdaptiveOperationsPreviewData.latestNews
        newsViewModel.newsFeed = AdaptiveOperationsPreviewData.latestNews
    }

    private func configureShiftsState() {
        shiftsViewModel.currentSession = session
        shiftsViewModel.currentMember = currentMember
        shiftsViewModel.currentEnvironment = session.environment
        shiftsViewModel.shiftsFeed = shifts
        shiftsViewModel.defaultDeliveryDayOfWeek = .wednesday
        shiftsViewModel.deliveryCalendarOverrides = deliveryCalendarOverrides
        shiftsViewModel.selectedShiftSegment = .delivery
        shiftsViewModel.isLoadingShifts = false
        shiftsViewModel.isLoadingDeliveryCalendar = false
        shiftsViewModel.recomputeNextShifts()
    }

    private func configureMyOrderState(scenario: AdaptiveOperationsPreviewScenario) {
        myOrderViewModel.context = myOrderContext
        myOrderViewModel.hasRestoredCartState = true
        myOrderViewModel.restoredCartStorageKey = myOrderContext.cartStorageKey
        myOrderViewModel.previousOrderState = .empty
        myOrderViewModel.selectedQuantities = scenario == .myOrderCart
            ? AdaptiveOperationsPreviewData.cartSnapshot.selectedQuantities
            : [:]
        myOrderViewModel.selectedEcoBasketOptions = scenario == .myOrderCart
            ? AdaptiveOperationsPreviewData.cartSnapshot.selectedEcoBasketOptions
            : [:]
        myOrderViewModel.isCartVisible = scenario == .myOrderCart
    }

    private func configureOrderHistoryState() {
        let historyWeekKey = orderHistoryPreviousIsoWeekKey(
            nowMillis: nowMillis,
            timeZone: AdaptiveOperationsPreviewData.timeZone
        )
        let historyWeeks = orderHistoryWeekOption(
            weekKey: historyWeekKey,
            timeZone: AdaptiveOperationsPreviewData.timeZone
        ).map { [$0] } ?? []

        myOrdersHistoryViewModel.context = myOrdersHistoryContext
        myOrdersHistoryViewModel.availableWeeks = historyWeeks
        myOrdersHistoryViewModel.selectedWeekKey = historyWeekKey
        myOrdersHistoryViewModel.loadState = .loaded(AdaptiveOperationsPreviewOrderData.personalHistory)

        receivedOrdersViewModel.context = receivedOrdersContext
        receivedOrdersViewModel.selectedTab = .byMember
        receivedOrdersViewModel.loadState = .loaded(AdaptiveOperationsPreviewOrderData.receivedOrders)

        receivedOrdersHistoryViewModel.context = receivedOrdersHistoryContext
        receivedOrdersHistoryViewModel.availableWeeks = historyWeeks
        receivedOrdersHistoryViewModel.selectedWeekKey = historyWeekKey
        receivedOrdersHistoryViewModel.selectedTab = .byProduct
        receivedOrdersHistoryViewModel.loadState = .loaded(AdaptiveOperationsPreviewOrderData.receivedOrders)
    }

}

actor AdaptiveOperationsPreviewOrdersRepository: OrdersRepository {
    let historyWeekKey: String
    let personalHistory: MyOrderPreviousOrderSnapshot
    let receivedOrders: ReceivedOrdersSnapshot

    init(
        historyWeekKey: String,
        personalHistory: MyOrderPreviousOrderSnapshot,
        receivedOrders: ReceivedOrdersSnapshot
    ) {
        self.historyWeekKey = historyWeekKey
        self.personalHistory = personalHistory
        self.receivedOrders = receivedOrders
    }

    func submitMyOrder(_ request: MyOrderCheckoutRequest, environment: SessionEnvironment) async throws -> Bool {
        request.currentMember != nil && environment == .develop
    }

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try await orderSummarySnapshot(
            currentMember: currentMember,
            weekKey: previousWeekKey,
            environment: environment
        )
    }

    func orderHistoryWeekKeys(currentMember: Member?, environment: SessionEnvironment) async throws -> [String] {
        currentMember == nil || environment != .develop ? [] : [historyWeekKey]
    }

    func orderSummarySnapshot(
        currentMember: Member?,
        weekKey: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        currentMember != nil && environment == .develop && weekKey == historyWeekKey ? personalHistory : nil
    }

    func myOrderProducerStatuses(
        currentMember: Member?,
        weekKey: String,
        environment: SessionEnvironment
    ) async -> MyOrderProducerStatusSnapshot {
        MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
    }

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot? {
        producerId.isEmpty || targetWeekKey != historyWeekKey || environment != .develop ? nil : receivedOrders
    }

    func receivedOrdersHistoryWeekKeys(
        producerId: String,
        environment: SessionEnvironment
    ) async throws -> [String] {
        producerId.isEmpty || environment != .develop ? [] : [historyWeekKey]
    }

    func receivedOrdersHistorySnapshot(
        producerId: String,
        weekKey: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot? {
        try await receivedOrdersSnapshot(
            producerId: producerId,
            targetWeekKey: weekKey,
            environment: environment
        )
    }

    func updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ProducerOrderStatus,
        nowMillis: Int64,
        environment: SessionEnvironment
    ) async -> ReceivedOrderStatusWriteResult {
        orderId.isEmpty || producerId.isEmpty || nowMillis <= 0 || environment != .develop ? .failure : .success
    }
}

actor AdaptiveOperationsPreviewCartStore: MyOrderCartStore {
    let cartSnapshot: MyOrderCartSnapshot

    init(cartSnapshot: MyOrderCartSnapshot) {
        self.cartSnapshot = cartSnapshot
    }

    func readCart(storageKey: String) async -> MyOrderCartSnapshot {
        storageKey.isEmpty ? .empty : cartSnapshot
    }

    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async {}

    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot { .empty }

    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async {}
}
#endif
