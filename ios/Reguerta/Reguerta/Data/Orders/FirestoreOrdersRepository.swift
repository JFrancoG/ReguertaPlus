import FirebaseFirestore
import Foundation

struct FirestoreOrdersRepository: OrdersRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore,
        environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
    ) {
        self.db = db
        self.environment = environment
    }

    func submitMyOrder(_ request: MyOrderCheckoutRequest) async -> Bool {
        await submitCheckoutOrderToFirestore(
            currentMember: request.currentMember,
            weekKey: request.weekKey,
            products: request.products,
            selectedQuantities: request.selectedQuantities,
            selectedEcoBasketOptions: request.selectedEcoBasketOptions,
            db: db,
            environment: environment,
            nowMillis: request.nowMillis
        )
    }

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try await fetchPreviousWeekOrderSnapshot(
            currentMember: currentMember,
            previousWeekKey: previousWeekKey,
            db: db,
            environment: environment
        )
    }

    func myOrderProducerStatuses(orderId: String) async -> MyOrderProducerStatusSnapshot {
        await loadMyOrderProducerStatuses(orderId: orderId, db: db, environment: environment)
    }

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String
    ) async throws -> ReceivedOrdersSnapshot? {
        try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: targetWeekKey,
            db: db,
            environment: environment
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
            environment: environment,
            nowMillis: nowMillis
        )
    }
}
