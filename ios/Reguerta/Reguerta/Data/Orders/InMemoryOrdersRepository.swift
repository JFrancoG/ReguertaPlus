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
    private var orderHistoryWeekKeysByMemberId: [String: Set<String>] = [:]
    private var producerStatusesByOrderId: [String: MyOrderProducerStatusSnapshot] = [:]
    private var receivedSnapshotsByProducerWeek: [String: ReceivedOrdersSnapshot] = [:]
    private var receivedHistoryWeekKeysByProducerId: [String: Set<String>] = [:]
    private var updateResultsByOrderId: [String: ReceivedOrderStatusWriteResult] = [:]
    private var receivedStatusUpdateRequests: [(orderId: String, producerId: String, status: ProducerOrderStatus)] = []

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
        try await orderSummarySnapshot(currentMember: currentMember, weekKey: previousWeekKey)
    }

    func orderHistoryWeekKeys(currentMember: Member?) async throws -> [String] {
        if let previousOrderError {
            throw previousOrderError
        }
        guard let currentMember else { return [] }
        let explicitKeys = orderHistoryWeekKeysByMemberId[currentMember.id] ?? []
        let seededKeys = Set(previousOrdersByWeekKey.keys)
        return Array(explicitKeys.union(seededKeys)).sorted()
    }

    func orderSummarySnapshot(
        currentMember: Member?,
        weekKey: String
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        if let previousOrderError {
            throw previousOrderError
        }
        guard currentMember != nil else { return nil }
        return previousOrdersByWeekKey[weekKey]
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

    func receivedOrdersHistoryWeekKeys(producerId: String) async throws -> [String] {
        if let receivedOrdersError {
            throw receivedOrdersError
        }
        let explicitKeys = receivedHistoryWeekKeysByProducerId[producerId] ?? []
        let seededKeys = receivedSnapshotsByProducerWeek.keys.compactMap { key -> String? in
            let parts = key.components(separatedBy: "|")
            guard parts.count == 2, parts[0] == producerId else { return nil }
            return parts[1]
        }
        return Array(explicitKeys.union(seededKeys)).sorted()
    }

    func receivedOrdersHistorySnapshot(
        producerId: String,
        weekKey: String
    ) async throws -> ReceivedOrdersSnapshot? {
        try await receivedOrdersSnapshot(producerId: producerId, targetWeekKey: weekKey)
    }

    func updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ProducerOrderStatus,
        nowMillis: Int64
    ) async -> ReceivedOrderStatusWriteResult {
        receivedStatusUpdateRequests.append((orderId: orderId, producerId: producerId, status: status))
        return updateResultsByOrderId[orderId] ?? .success
    }

    func setPreviousOrder(_ snapshot: MyOrderPreviousOrderSnapshot, forWeekKey weekKey: String) {
        previousOrdersByWeekKey[weekKey] = snapshot
    }

    func setOrderHistoryWeekKeys(_ weekKeys: [String], forMemberId memberId: String = "member_1") {
        orderHistoryWeekKeysByMemberId[memberId] = Set(weekKeys)
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

    func setReceivedOrdersHistoryWeekKeys(_ weekKeys: [String], forProducerId producerId: String = "member_1") {
        receivedHistoryWeekKeysByProducerId[producerId] = Set(weekKeys)
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

    func receivedStatusUpdates() -> [(orderId: String, producerId: String, status: ProducerOrderStatus)] {
        receivedStatusUpdateRequests
    }

    private func receivedKey(producerId: String, weekKey: String) -> String {
        "\(producerId)|\(weekKey)"
    }
}
