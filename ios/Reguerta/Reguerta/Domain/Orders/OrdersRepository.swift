import Foundation

struct MyOrderCheckoutRequest {
    let currentMember: Member?
    let weekKey: String
    let products: [Product]
    let selectedQuantities: [String: Int]
    let selectedEcoBasketOptions: [String: String]
    let nowMillis: Int64
}

protocol OrdersRepository: Sendable {
    func submitMyOrder(_ request: MyOrderCheckoutRequest, environment: SessionEnvironment) async throws -> Bool

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot?

    func orderHistoryWeekKeys(currentMember: Member?, environment: SessionEnvironment) async throws -> [String]

    func orderSummarySnapshot(
        currentMember: Member?,
        weekKey: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot?

    func myOrderProducerStatuses(
        currentMember: Member?,
        weekKey: String,
        environment: SessionEnvironment
    ) async -> MyOrderProducerStatusSnapshot

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot?

    func receivedOrdersHistoryWeekKeys(producerId: String, environment: SessionEnvironment) async throws -> [String]

    func receivedOrdersHistorySnapshot(
        producerId: String,
        weekKey: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot?

    func updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ProducerOrderStatus,
        nowMillis: Int64,
        environment: SessionEnvironment
    ) async -> ReceivedOrderStatusWriteResult
}

protocol MyOrderCartStore {
    func readCart(storageKey: String) async -> MyOrderCartSnapshot
    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async
    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot
    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async
}

protocol ImmediateMyOrderCartStore: MyOrderCartStore {
    func persistCartImmediately(storageKey: String, snapshot: MyOrderCartSnapshot)
}
