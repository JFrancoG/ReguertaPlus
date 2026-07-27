import FirebaseFirestore
import Foundation

struct FirestoreOrdersRepository: OrdersRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore,
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    private var resolvedEnvironment: ReguertaFirestoreEnvironment {
        environment ?? ReguertaRuntimeEnvironment.currentFirestoreEnvironment
    }

    func submitMyOrder(_ request: MyOrderCheckoutRequest) async throws -> Bool {
        try await submitCheckoutOrderToFirestore(
            currentMember: request.currentMember,
            weekKey: request.weekKey,
            products: request.products,
            selectedQuantities: request.selectedQuantities,
            selectedEcoBasketOptions: request.selectedEcoBasketOptions,
            db: db,
            environment: resolvedEnvironment,
            nowMillis: request.nowMillis
        )
    }

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try await orderSummarySnapshot(
            currentMember: currentMember,
            weekKey: previousWeekKey
        )
    }

    func orderHistoryWeekKeys(currentMember: Member?) async throws -> [String] {
        try await fetchOrderHistoryWeekKeys(
            currentMember: currentMember,
            db: db,
            environment: resolvedEnvironment
        )
    }

    func orderSummarySnapshot(
        currentMember: Member?,
        weekKey: String
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try await fetchOrderSummarySnapshot(
            currentMember: currentMember,
            weekKey: weekKey,
            db: db,
            environment: resolvedEnvironment
        )
    }

    func myOrderProducerStatuses(
        currentMember: Member?,
        weekKey: String
    ) async -> MyOrderProducerStatusSnapshot {
        await loadMyOrderProducerStatuses(
            currentMember: currentMember,
            weekKey: weekKey,
            db: db,
            environment: resolvedEnvironment
        )
    }

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String
    ) async throws -> ReceivedOrdersSnapshot? {
        try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: targetWeekKey,
            db: db,
            environment: resolvedEnvironment
        )
    }

    func receivedOrdersHistoryWeekKeys(producerId: String) async throws -> [String] {
        try await fetchReceivedOrderHistoryWeekKeys(
            producerId: producerId,
            db: db,
            environment: resolvedEnvironment
        )
    }

    func receivedOrdersHistorySnapshot(
        producerId: String,
        weekKey: String
    ) async throws -> ReceivedOrdersSnapshot? {
        try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: weekKey,
            synchronizesUnreadStatuses: false,
            db: db,
            environment: resolvedEnvironment
        )
    }

    func updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ProducerOrderStatus,
        nowMillis: Int64
    ) async -> ReceivedOrderStatusWriteResult {
        await Reguerta.updateReceivedOrderProducerStatus(
            orderId: orderId,
            producerId: producerId,
            status: status,
            db: db,
            environment: resolvedEnvironment,
            nowMillis: nowMillis
        )
    }
}
