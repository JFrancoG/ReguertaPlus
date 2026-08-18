import FirebaseFirestore
import Foundation

struct FirestoreOrdersRepository: OrdersRepository {
    private let storedDB: Firestore
    private let environment: ReguertaFirestoreEnvironment?

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
            db: storedDB,
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
            db: storedDB,
            environment: resolvedEnvironment
        )
    }

    func orderSummarySnapshot(currentMember: Member?, weekKey: String) async throws -> MyOrderPreviousOrderSnapshot? {
        try await fetchOrderSummarySnapshot(
            currentMember: currentMember,
            weekKey: weekKey,
            db: storedDB,
            environment: resolvedEnvironment
        )
    }

    func myOrderProducerStatuses(currentMember: Member?, weekKey: String) async -> MyOrderProducerStatusSnapshot {
        await loadMyOrderProducerStatuses(
            currentMember: currentMember,
            weekKey: weekKey,
            db: storedDB,
            environment: resolvedEnvironment
        )
    }

    func receivedOrdersSnapshot(producerId: String, targetWeekKey: String) async throws -> ReceivedOrdersSnapshot? {
        try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: targetWeekKey,
            db: storedDB,
            environment: resolvedEnvironment
        )
    }

    func receivedOrdersHistoryWeekKeys(producerId: String) async throws -> [String] {
        try await fetchReceivedOrderHistoryWeekKeys(
            producerId: producerId,
            db: storedDB,
            environment: resolvedEnvironment
        )
    }

    func receivedOrdersHistorySnapshot(producerId: String, weekKey: String) async throws -> ReceivedOrdersSnapshot? {
        try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: weekKey,
            synchronizesUnreadStatuses: false,
            db: storedDB,
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
            db: storedDB,
            environment: resolvedEnvironment,
            nowMillis: nowMillis
        )
    }
}

extension FirestoreOrdersRepository {
    init(db: Firestore, environment: ReguertaFirestoreEnvironment? = nil) {
        self.storedDB = db
        self.environment = environment
    }
}
