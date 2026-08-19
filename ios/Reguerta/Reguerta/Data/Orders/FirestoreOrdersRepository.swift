import FirebaseCore
import FirebaseFirestore
import Foundation

actor FirestoreOrdersRepository: OrdersRepository {
    let storedDB: Firestore

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for orders")
        }
        self.storedDB = Firestore.firestore(app: app)
    }

    func submitMyOrder(_ request: MyOrderCheckoutRequest, environment: SessionEnvironment) async throws -> Bool {
        try Task.checkCancellation()
        return try await submitCheckoutOrderToFirestore(
            request: request,
            environment: environment
        )
    }

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try Task.checkCancellation()
        return try await fetchOrderSummarySnapshot(
            currentMember: currentMember,
            weekKey: previousWeekKey,
            environment: environment
        )
    }

    func orderHistoryWeekKeys(currentMember: Member?, environment: SessionEnvironment) async throws -> [String] {
        try Task.checkCancellation()
        return try await fetchOrderHistoryWeekKeys(
            currentMember: currentMember,
            environment: environment
        )
    }

    func orderSummarySnapshot(
        currentMember: Member?,
        weekKey: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try Task.checkCancellation()
        return try await fetchOrderSummarySnapshot(
            currentMember: currentMember,
            weekKey: weekKey,
            environment: environment
        )
    }

    func myOrderProducerStatuses(
        currentMember: Member?,
        weekKey: String,
        environment: SessionEnvironment
    ) async -> MyOrderProducerStatusSnapshot {
        guard !Task.isCancelled else {
            return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
        }
        return await loadMyOrderProducerStatuses(
            currentMember: currentMember,
            weekKey: weekKey,
            environment: environment
        )
    }

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot? {
        try Task.checkCancellation()
        return try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: targetWeekKey,
            environment: environment
        )
    }

    func receivedOrdersHistoryWeekKeys(producerId: String, environment: SessionEnvironment) async throws -> [String] {
        try Task.checkCancellation()
        return try await fetchReceivedOrderHistoryWeekKeys(
            producerId: producerId,
            environment: environment
        )
    }

    func receivedOrdersHistorySnapshot(
        producerId: String,
        weekKey: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot? {
        try Task.checkCancellation()
        return try await fetchReceivedOrdersSnapshotForProducer(
            producerId: producerId,
            targetWeekKey: weekKey,
            synchronizesUnreadStatuses: false,
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
        guard !Task.isCancelled else { return .failure }
        return await writeReceivedOrderProducerStatus(
            orderId: orderId,
            producerId: producerId,
            status: status,
            environment: environment,
            nowMillis: nowMillis
        )
    }
}
