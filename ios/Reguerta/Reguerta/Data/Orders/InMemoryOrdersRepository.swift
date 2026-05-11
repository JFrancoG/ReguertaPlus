import Foundation

enum InMemoryOrdersRepositoryError: Error {
    case forcedFailure
}

actor InMemoryOrdersRepository: OrdersRepository {
    struct SubmittedOrder: Equatable {
        let memberId: String?
        let weekKey: String
        let selectedQuantities: [String: Int]
        let selectedEcoBasketOptions: [String: String]
        let nowMillis: Int64
    }

    var submitResult = true
    var previousOrderError: Error?
    var receivedOrdersError: Error?

    private var submittedOrders: [SubmittedOrder] = []
    private var previousOrdersByWeekKey: [String: MyOrderPreviousOrderSnapshot] = [:]
    private var producerStatusesByOrderId: [String: MyOrderProducerStatusSnapshot] = [:]
    private var receivedSnapshotsByProducerWeek: [String: ReceivedOrdersSnapshot] = [:]
    private var updateResultsByOrderId: [String: ReceivedOrderStatusWriteResult] = [:]

    init() {}

    func submitMyOrder(_ request: MyOrderCheckoutRequest) async -> Bool {
        guard submitResult,
              request.currentMember != nil,
              request.selectedQuantities.values.contains(where: { $0 > 0 }) else {
            return false
        }
        submittedOrders.append(
            SubmittedOrder(
                memberId: request.currentMember?.id,
                weekKey: request.weekKey,
                selectedQuantities: request.selectedQuantities,
                selectedEcoBasketOptions: request.selectedEcoBasketOptions,
                nowMillis: request.nowMillis
            )
        )
        return true
    }

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        if let previousOrderError {
            throw previousOrderError
        }
        guard currentMember != nil else { return nil }
        return previousOrdersByWeekKey[previousWeekKey]
    }

    func myOrderProducerStatuses(orderId: String) async -> MyOrderProducerStatusSnapshot {
        producerStatusesByOrderId[orderId] ?? MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
    }

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String
    ) async throws -> ReceivedOrdersSnapshot? {
        if let receivedOrdersError {
            throw receivedOrdersError
        }
        return receivedSnapshotsByProducerWeek[receivedKey(producerId: producerId, weekKey: targetWeekKey)]
    }

    func updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ProducerOrderStatus,
        nowMillis: Int64
    ) async -> ReceivedOrderStatusWriteResult {
        updateResultsByOrderId[orderId] ?? .success
    }

    func setPreviousOrder(_ snapshot: MyOrderPreviousOrderSnapshot, forWeekKey weekKey: String) {
        previousOrdersByWeekKey[weekKey] = snapshot
    }

    func setPreviousOrderError(_ error: Error?) {
        previousOrderError = error
    }

    func setProducerStatuses(_ snapshot: MyOrderProducerStatusSnapshot, forOrderId orderId: String) {
        producerStatusesByOrderId[orderId] = snapshot
    }

    func setSubmitResult(_ result: Bool) {
        submitResult = result
    }

    func setReceivedOrdersSnapshot(
        _ snapshot: ReceivedOrdersSnapshot,
        producerId: String,
        weekKey: String
    ) {
        receivedSnapshotsByProducerWeek[receivedKey(producerId: producerId, weekKey: weekKey)] = snapshot
    }

    func setReceivedOrdersError(_ error: Error?) {
        receivedOrdersError = error
    }

    func setUpdateResult(_ result: ReceivedOrderStatusWriteResult, forOrderId orderId: String) {
        updateResultsByOrderId[orderId] = result
    }

    func submissions() -> [SubmittedOrder] {
        submittedOrders
    }

    private func receivedKey(producerId: String, weekKey: String) -> String {
        "\(producerId)|\(weekKey)"
    }
}
