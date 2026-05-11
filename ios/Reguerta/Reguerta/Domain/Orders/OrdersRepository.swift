import Foundation

struct MyOrderCheckoutRequest: Sendable {
    let currentMember: Member?
    let weekKey: String
    let products: [Product]
    let selectedQuantities: [String: Int]
    let selectedEcoBasketOptions: [String: String]
    let nowMillis: Int64
}

protocol OrdersRepository {
    func submitMyOrder(_ request: MyOrderCheckoutRequest) async -> Bool

    func previousOrderSnapshot(
        currentMember: Member?,
        previousWeekKey: String
    ) async throws -> MyOrderPreviousOrderSnapshot?

    func myOrderProducerStatuses(orderId: String) async -> MyOrderProducerStatusSnapshot

    func receivedOrdersSnapshot(
        producerId: String,
        targetWeekKey: String
    ) async throws -> ReceivedOrdersSnapshot?

    func updateReceivedOrderProducerStatus(
        orderId: String,
        producerId: String,
        status: ProducerOrderStatus,
        nowMillis: Int64
    ) async -> ReceivedOrderStatusWriteResult
}

protocol MyOrderCartStore {
    func readCart(storageKey: String) async -> MyOrderCartSnapshot
    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async
    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot
    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async
}
