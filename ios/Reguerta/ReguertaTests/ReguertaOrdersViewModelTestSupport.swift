import Foundation
import Synchronization
import Testing
@testable import Reguerta

@MainActor
func myOrderContext(
    products: [Product] = [],
    seasonalCommitments: [SeasonalCommitment] = [],
    nowMillis: Int64? = nil,
    currentMember: Member? = nil,
    isLoading: Bool = false,
    environment: SessionEnvironment = .develop
) -> MyOrderRouteContext {
    let resolvedNowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 14)
    let resolvedMember = currentMember ?? member(id: "member_1", ecoCommitmentMode: .weekly)
    return MyOrderRouteContext(
        products: products,
        seasonalCommitments: seasonalCommitments,
        shifts: [],
        defaultDeliveryDayOfWeek: .wednesday,
        deliveryCalendarOverrides: [],
        nowMillis: resolvedNowMillis,
        isLoading: isLoading,
        currentMember: resolvedMember,
        members: [resolvedMember, producer(id: "producer_even", parity: .even)],
        environment: environment
    )
}

@MainActor
func myOrdersHistoryContext(
    nowMillis: Int64,
    currentMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> MyOrdersHistoryRouteContext {
    MyOrdersHistoryRouteContext(
        currentMember: currentMember ?? member(id: "member_1", ecoCommitmentMode: .weekly),
        nowMillis: nowMillis,
        environment: environment
    )
}

@MainActor
func receivedOrdersContext(
    currentMember: Member,
    nowMillis: Int64,
    environment: SessionEnvironment = .develop
) -> ReceivedOrdersRouteContext {
    ReceivedOrdersRouteContext(
        currentMember: currentMember,
        shifts: [],
        defaultDeliveryDayOfWeek: .wednesday,
        deliveryCalendarOverrides: [],
        nowMillis: nowMillis,
        environment: environment
    )
}

@MainActor
func receivedOrdersHistoryContext(
    nowMillis: Int64,
    currentMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> ReceivedOrdersHistoryRouteContext {
    ReceivedOrdersHistoryRouteContext(
        currentMember: currentMember ?? producer(id: "producer_even", parity: .even),
        nowMillis: nowMillis,
        environment: environment
    )
}

@MainActor func previousOrderSnapshot(weekKey: String) -> MyOrderPreviousOrderSnapshot {
    MyOrderPreviousOrderSnapshot(
        weekKey: weekKey,
        groups: [
            MyOrderPreviousOrderGroup(
                vendorId: "producer_even",
                companyName: "Huerta Norte",
                lines: [
                    MyOrderPreviousOrderLine(
                        vendorId: "producer_even",
                        companyName: "Huerta Norte",
                        productName: "Tomates",
                        packagingLine: "Caja 1 kg",
                        quantityLabel: "2 uds.",
                        subtotal: 4
                    )
                ],
                subtotal: 4
            )
        ],
        total: 4
    )
}

@MainActor func finiteStockProduct(_ product: Product, stock: Double) -> Product {
    Product(
        id: product.id,
        vendorId: product.vendorId,
        companyName: product.companyName,
        name: product.name,
        description: product.description,
        productImageUrl: product.productImageUrl,
        price: product.price,
        pricingMode: product.pricingMode,
        unitName: product.unitName,
        unitAbbreviation: product.unitAbbreviation,
        unitPlural: product.unitPlural,
        unitQty: product.unitQty,
        packContainerName: product.packContainerName,
        packContainerAbbreviation: product.packContainerAbbreviation,
        packContainerPlural: product.packContainerPlural,
        packContainerQty: product.packContainerQty,
        isAvailable: product.isAvailable,
        stockMode: .finite,
        stockQty: stock,
        isEcoBasket: product.isEcoBasket,
        isCommonPurchase: product.isCommonPurchase,
        commonPurchaseType: product.commonPurchaseType,
        archived: product.archived,
        createdAtMillis: product.createdAtMillis,
        updatedAtMillis: product.updatedAtMillis
    )
}

@MainActor func receivedOrdersSnapshot(status: ProducerOrderStatus) -> ReceivedOrdersSnapshot {
    ReceivedOrdersSnapshot(
        byProductRows: [
            ReceivedOrdersProductRow(
                productId: "tomato",
                productName: "Tomates",
                productImageUrl: nil,
                companyName: "Huerta Norte",
                packagingLine: "Caja 1 kg",
                totalQuantity: 3,
                quantityUnitSingular: "caja",
                quantityUnitPlural: "cajas",
                totalMeasureQuantity: 3,
                measureUnitSingular: "kg",
                measureUnitPlural: "kg",
                measureUnitAbbreviation: "kg",
                subtotal: 6
            )
        ],
        byMemberGroups: [
            ReceivedOrdersMemberGroup(
                id: "member_1|Carmen",
                orderId: "order_1",
                consumerDisplayName: "Carmen",
                producerStatus: status,
                lines: [
                    ReceivedOrdersMemberLine(
                        id: "order_1|tomato",
                        productName: "Tomates",
                        packagingLine: "Caja 1 kg",
                        quantity: 3,
                        quantityUnitSingular: "caja",
                        quantityUnitPlural: "cajas",
                        totalMeasureQuantity: 3,
                        measureUnitSingular: "kg",
                        measureUnitPlural: "kg",
                        measureUnitAbbreviation: "kg",
                        subtotal: 6
                    )
                ],
                total: 6
            )
        ],
        generalTotal: 6
    )
}

enum EnvironmentSwitchOrdersRepositoryCall: Hashable {
    case submitMyOrder(SessionEnvironment)
    case previousOrderSnapshot(SessionEnvironment)
    case myOrderProducerStatuses(SessionEnvironment)
    case orderHistoryWeekKeys(SessionEnvironment)
    case orderSummarySnapshot(SessionEnvironment)
    case receivedOrdersSnapshot(SessionEnvironment)
    case receivedOrdersHistoryWeekKeys(SessionEnvironment)
    case receivedOrdersHistorySnapshot(SessionEnvironment)
    case updateReceivedOrderProducerStatus(SessionEnvironment)
}
final class EnvironmentSwitchOrdersRepository: OrdersRepository, Sendable {
    private struct CallCountWaiter {
        let count: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var blockedCalls: Set<EnvironmentSwitchOrdersRepositoryCall>
        var oneShotBlockedCalls: Set<EnvironmentSwitchOrdersRepositoryCall>
        var calls: [EnvironmentSwitchOrdersRepositoryCall]
        var blockedContinuations: [
            EnvironmentSwitchOrdersRepositoryCall: [UUID: CheckedContinuation<Void, any Error>]
        ]
        var callCountWaiters: [UUID: CallCountWaiter]
        var cancellationGeneration: UInt64
    }

    private let state: Mutex<State>
    private let cancellationDeferredCalls: Set<EnvironmentSwitchOrdersRepositoryCall>
    private let submitResults: [SessionEnvironment: Bool]
    private let previousSnapshots: [SessionEnvironment: MyOrderPreviousOrderSnapshot]
    private let producerStatusSnapshots: [SessionEnvironment: MyOrderProducerStatusSnapshot]
    private let receivedSnapshots: [SessionEnvironment: ReceivedOrdersSnapshot]
    init(
        blockedCalls: Set<EnvironmentSwitchOrdersRepositoryCall>,
        submitResults: [SessionEnvironment: Bool] = [:],
        previousSnapshots: [SessionEnvironment: MyOrderPreviousOrderSnapshot] = [:],
        producerStatusSnapshots: [SessionEnvironment: MyOrderProducerStatusSnapshot] = [:],
        receivedSnapshots: [SessionEnvironment: ReceivedOrdersSnapshot] = [:]
    ) {
        state = Mutex(State(
            blockedCalls: blockedCalls,
            oneShotBlockedCalls: [],
            calls: [],
            blockedContinuations: [:],
            callCountWaiters: [:],
            cancellationGeneration: 0
        ))
        cancellationDeferredCalls = []
        self.submitResults = submitResults
        self.previousSnapshots = previousSnapshots
        self.producerStatusSnapshots = producerStatusSnapshots
        self.receivedSnapshots = receivedSnapshots
    }

    init(
        cancellationDeferredOneShotCalls: Set<EnvironmentSwitchOrdersRepositoryCall>,
        submitResults: [SessionEnvironment: Bool] = [:],
        previousSnapshots: [SessionEnvironment: MyOrderPreviousOrderSnapshot] = [:],
        producerStatusSnapshots: [SessionEnvironment: MyOrderProducerStatusSnapshot] = [:],
        receivedSnapshots: [SessionEnvironment: ReceivedOrdersSnapshot] = [:]
    ) {
        state = Mutex(State(
            blockedCalls: [],
            oneShotBlockedCalls: cancellationDeferredOneShotCalls,
            calls: [],
            blockedContinuations: [:],
            callCountWaiters: [:],
            cancellationGeneration: 0
        ))
        cancellationDeferredCalls = cancellationDeferredOneShotCalls
        self.submitResults = submitResults
        self.previousSnapshots = previousSnapshots
        self.producerStatusSnapshots = producerStatusSnapshots
        self.receivedSnapshots = receivedSnapshots
    }

    func submitMyOrder(_: MyOrderCheckoutRequest, environment: SessionEnvironment) async throws -> Bool {
        try await recordAndPauseIfNeeded(.submitMyOrder(environment))
        return submitResults[environment, default: false]
    }

    func previousOrderSnapshot(
        currentMember _: Member?,
        previousWeekKey _: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try await recordAndPauseIfNeeded(.previousOrderSnapshot(environment))
        return previousSnapshots[environment]
    }

    func orderHistoryWeekKeys(currentMember _: Member?, environment: SessionEnvironment) async throws -> [String] {
        try await recordAndPauseIfNeeded(.orderHistoryWeekKeys(environment))
        return [weekKey(for: environment)]
    }

    func orderSummarySnapshot(
        currentMember _: Member?,
        weekKey _: String,
        environment: SessionEnvironment
    ) async throws -> MyOrderPreviousOrderSnapshot? {
        try await recordAndPauseIfNeeded(.orderSummarySnapshot(environment))
        return previousSnapshots[environment]
    }

    func myOrderProducerStatuses(
        currentMember _: Member?,
        weekKey _: String,
        environment: SessionEnvironment
    ) async -> MyOrderProducerStatusSnapshot {
        do {
            try await recordAndPauseIfNeeded(.myOrderProducerStatuses(environment))
        } catch {
            return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
        }
        return producerStatusSnapshots[environment]
            ?? MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
    }

    func receivedOrdersSnapshot(
        producerId _: String,
        targetWeekKey _: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot? {
        try await recordAndPauseIfNeeded(.receivedOrdersSnapshot(environment))
        return receivedSnapshots[environment]
    }

    func receivedOrdersHistoryWeekKeys(producerId _: String, environment: SessionEnvironment) async throws -> [String] {
        try await recordAndPauseIfNeeded(.receivedOrdersHistoryWeekKeys(environment))
        return [weekKey(for: environment)]
    }

    func receivedOrdersHistorySnapshot(
        producerId _: String,
        weekKey _: String,
        environment: SessionEnvironment
    ) async throws -> ReceivedOrdersSnapshot? {
        try await recordAndPauseIfNeeded(.receivedOrdersHistorySnapshot(environment))
        return receivedSnapshots[environment]
    }

    func updateReceivedOrderProducerStatus(
        orderId _: String,
        producerId _: String,
        status _: ProducerOrderStatus,
        nowMillis _: Int64,
        environment: SessionEnvironment
    ) async -> ReceivedOrderStatusWriteResult {
        do {
            try await recordAndPauseIfNeeded(.updateReceivedOrderProducerStatus(environment))
            return .success
        } catch {
            return .failure
        }
    }

    func waitForCallCount(_ expectedCount: Int) async throws {
        let waiterID = UUID()
        let cancellationGeneration = state.withLock { $0.cancellationGeneration }
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                guard !Task.isCancelled else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                let result = state.withLock { state -> Bool? in
                    guard !Task.isCancelled else { return nil }
                    guard state.cancellationGeneration == cancellationGeneration else { return nil }
                    guard state.calls.count < expectedCount else { return true }
                    state.callCountWaiters[waiterID] = CallCountWaiter(
                        count: expectedCount,
                        continuation: continuation
                    )
                    return false
                }
                guard let result else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                if result {
                    continuation.resume()
                }
            }
        } onCancel: {
            self.cancelCallCountWaiter(id: waiterID)
        }
    }

    func resume(_ call: EnvironmentSwitchOrdersRepositoryCall) async {
        let continuations = state.withLock { state -> [CheckedContinuation<Void, any Error>] in
            state.blockedCalls.remove(call)
            state.oneShotBlockedCalls.remove(call)
            guard let pending = state.blockedContinuations.removeValue(forKey: call) else { return [] }
            return Array(pending.values)
        }
        for continuation in continuations {
            continuation.resume()
        }
    }

    func recordedCalls() async -> [EnvironmentSwitchOrdersRepositoryCall] {
        state.withLock { $0.calls }
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            state.cancellationGeneration &+= 1
            state.blockedCalls.removeAll()
            state.oneShotBlockedCalls.removeAll()
            let blocked = state.blockedContinuations.values.flatMap { $0.values }
            let waiters = state.callCountWaiters.values.map(\.continuation)
            state.blockedContinuations.removeAll()
            state.callCountWaiters.removeAll()
            return (blocked, waiters)
        }
        continuations.0.forEach { $0.resume(throwing: CancellationError()) }
        continuations.1.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func recordAndPauseIfNeeded(_ call: EnvironmentSwitchOrdersRepositoryCall) async throws {
        let continuationID = UUID()
        let defersCancellation = cancellationDeferredCalls.contains(call)
        let cancellationGeneration = state.withLock { $0.cancellationGeneration }
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                let registration = state.withLock { state -> (Bool?, [CheckedContinuation<Void, any Error>]) in
                    guard state.cancellationGeneration == cancellationGeneration else { return (nil, []) }
                    guard defersCancellation || !Task.isCancelled else { return (nil, []) }
                    let shouldPause = state.blockedCalls.contains(call)
                        || state.oneShotBlockedCalls.remove(call) != nil
                    if shouldPause {
                        state.blockedContinuations[call, default: [:]][continuationID] = continuation
                    }
                    state.calls.append(call)
                    let satisfiedIDs = state.callCountWaiters.compactMap { id, waiter in
                        waiter.count <= state.calls.count ? id : nil
                    }
                    let waiters = satisfiedIDs.compactMap {
                        state.callCountWaiters.removeValue(forKey: $0)?.continuation
                    }
                    return (shouldPause, waiters)
                }
                registration.1.forEach { $0.resume() }
                guard let shouldPause = registration.0 else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                if !shouldPause {
                    continuation.resume()
                }
            }
        } onCancel: {
            guard !defersCancellation else { return }
            self.cancelBlockedCall(call, id: continuationID)
        }
    }

    private func cancelCallCountWaiter(id: UUID) {
        let continuation = state.withLock { $0.callCountWaiters.removeValue(forKey: id)?.continuation }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelBlockedCall(_ call: EnvironmentSwitchOrdersRepositoryCall, id: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<Void, any Error>? in
            let continuation = state.blockedContinuations[call]?.removeValue(forKey: id)
            if state.blockedContinuations[call]?.isEmpty == true {
                state.blockedContinuations[call] = nil
            }
            return continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func weekKey(for environment: SessionEnvironment) -> String {
        switch environment {
        case .develop:
            "2026-W20"
        case .production:
            "2026-W21"
        }
    }
}
