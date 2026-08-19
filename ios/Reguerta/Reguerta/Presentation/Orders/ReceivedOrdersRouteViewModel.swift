import Foundation
import Observation

enum ReceivedOrdersTab: String, CaseIterable, Identifiable, Sendable {
    case byProduct
    case byMember

    var id: String { rawValue }

    var title: String {
        localizedReceivedOrdersTabTitle(self)
    }
}

enum ReceivedOrdersLoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded(ReceivedOrdersSnapshot)
    case empty
    case error
}

struct ReceivedOrdersWindow: Equatable {
    let isEnabled: Bool
    let targetWeekKey: String
}

struct ReceivedOrdersRouteContext {
    let currentMember: Member?
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64
    let environment: SessionEnvironment

    static let empty = ReceivedOrdersRouteContext(
        currentMember: nil,
        shifts: [],
        defaultDeliveryDayOfWeek: nil,
        deliveryCalendarOverrides: [],
        nowMillis: 0,
        environment: .develop
    )

    var identity: String {
        [
            currentMember?.id ?? "none",
            environment.rawValue,
            String(currentMember?.canAccessReceivedOrders == true),
            nowMillis.isoWeekKey,
            shifts.map(shiftSignature).joined(separator: ","),
            deliveryCalendarOverrides.map(overrideSignature).joined(separator: ","),
            defaultDeliveryDayOfWeek?.rawValue ?? "none"
        ].joined(separator: "|")
    }

    private func shiftSignature(_ shift: ShiftAssignment) -> String {
        [
            shift.id,
            shift.type.rawValue,
            String(shift.dateMillis),
            shift.status.rawValue,
            String(shift.updatedAtMillis)
        ].joined(separator: ":")
    }

    private func overrideSignature(_ override: DeliveryCalendarOverride) -> String {
        [
            override.weekKey,
            String(override.deliveryDateMillis),
            String(override.ordersOpenAtMillis),
            String(override.ordersCloseAtMillis),
            String(override.updatedAtMillis)
        ].joined(separator: ":")
    }
}

@MainActor
@Observable
final class ReceivedOrdersRouteViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let ordersRepository: any OrdersRepository
    @ObservationIgnored private let nowMillisProvider: @MainActor () -> Int64

    var context: ReceivedOrdersRouteContext = .empty
    var selectedTab: ReceivedOrdersTab = .byProduct
    var loadState: ReceivedOrdersLoadState = .idle
    var updatingStatusOrderId: String?
    var statusWriteFeedback: ReceivedOrderStatusWriteResult?

    private var loadedTaskID: String?
    private var loadedTaskOwnerGeneration: UInt64?
    private var loadOperationGeneration: UInt64 = 0
    private var statusOperationGeneration: UInt64 = 0
    private var contextSessionStateRevision: UInt64 = 0

    private struct LoadOperation {
        let context: ReceivedOrdersRouteContext
        let generation: UInt64
        let taskID: String
        let window: ReceivedOrdersWindow
        let sessionStateRevision: UInt64
    }

    private struct StatusOperation {
        let context: ReceivedOrdersRouteContext
        let generation: UInt64
        let sessionStateRevision: UInt64
    }

    init(
        sessionViewModel: SessionViewModel,
        ordersRepository: any OrdersRepository,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
        self.nowMillisProvider = nowMillisProvider
        contextSessionStateRevision = sessionViewModel.sessionStateRevision
    }

    var currentMember: Member? {
        context.currentMember
    }

    var isProducer: Bool {
        currentMember?.canAccessReceivedOrders == true
    }

    var window: ReceivedOrdersWindow {
        resolveReceivedOrdersWindow(
            nowMillis: context.nowMillis,
            defaultDeliveryDayOfWeek: context.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: context.deliveryCalendarOverrides,
            shifts: context.shifts
        )
    }

    var loadTaskID: String {
        makeLoadTaskID(context: context, window: window)
    }

    func appear(context newContext: ReceivedOrdersRouteContext) async {
        let contextChanged = context.identity != newContext.identity
        let nextSessionStateRevision = sessionViewModel.sessionStateRevision
        let sessionChanged = contextSessionStateRevision != nextSessionStateRevision
        context = newContext
        contextSessionStateRevision = nextSessionStateRevision
        if contextChanged || sessionChanged {
            invalidateStatusOperation()
        }
        let operation = beginLoadOperation()
        await loadIfNeeded(operation: operation)
    }

    func selectTab(_ tab: ReceivedOrdersTab) {
        selectedTab = tab
    }

    func retry() async {
        let operation = beginLoadOperation()
        await loadIfNeeded(force: true, operation: operation)
    }

    func loadIfNeeded(force: Bool = false) async {
        let operation = beginLoadOperation()
        await loadIfNeeded(force: force, operation: operation)
    }

    private func loadIfNeeded(force: Bool = false, operation: LoadOperation) async {
        guard let producerId = prepareLoad(force: force, operation: operation) else { return }
        do {
            let snapshot = try await ordersRepository.receivedOrdersSnapshot(
                producerId: producerId,
                targetWeekKey: operation.window.targetWeekKey,
                environment: operation.context.environment
            )
            try Task.checkCancellation()
            guard isCurrent(operation) else {
                finishLoad(operation, completed: false)
                return
            }
            finishLoad(operation, completed: true)
            applyLoadedSnapshot(snapshot)
        } catch is CancellationError {
            finishLoad(operation, completed: false)
            return
        } catch {
            guard isCurrent(operation) else {
                finishLoad(operation, completed: false)
                return
            }
            loadState = .error
            finishLoad(operation, completed: false)
        }
    }

    private func prepareLoad(force: Bool, operation: LoadOperation) -> String? {
        guard isCurrent(operation) else { return nil }
        guard operation.context.currentMember?.canAccessReceivedOrders == true else {
            resetLoadState()
            return nil
        }
        guard operation.window.isEnabled else {
            resetLoadState()
            return nil
        }
        if !force, loadedTaskID == operation.taskID {
            if loadedTaskOwnerGeneration == operation.generation { return nil }
            if loadedTaskOwnerGeneration == nil { return nil }
        }
        guard let producerId = operation.context.currentMember?.id else {
            loadState = .error
            return nil
        }
        loadedTaskID = operation.taskID
        loadedTaskOwnerGeneration = operation.generation
        loadState = .loading
        statusWriteFeedback = nil
        return producerId
    }

    private func resetLoadState() {
        loadState = .idle
        statusWriteFeedback = nil
        loadedTaskID = nil
        loadedTaskOwnerGeneration = nil
    }

    private func applyLoadedSnapshot(_ snapshot: ReceivedOrdersSnapshot?) {
        if let snapshot {
            loadState = .loaded(snapshot)
        } else {
            loadState = .empty
        }
    }

    private func finishLoad(_ operation: LoadOperation, completed: Bool) {
        guard loadedTaskID == operation.taskID, loadedTaskOwnerGeneration == operation.generation else { return }
        loadedTaskOwnerGeneration = nil
        if !completed {
            loadedTaskID = nil
            if case .loading = loadState {
                loadState = .idle
            }
        }
    }

    func updateProducerStatus(orderId: String, status: ProducerOrderStatus) async {
        guard updatingStatusOrderId == nil else { return }
        guard let producerId = currentMember?.id, producerId.isNotEmpty else { return }
        guard case .loaded(let currentSnapshot) = loadState else { return }
        guard let group = currentSnapshot.byMemberGroups.first(where: { $0.orderId == orderId }) else { return }
        guard group.producerStatus != status else { return }

        let operation = beginStatusOperation()
        guard isCurrent(operation) else { return }
        updatingStatusOrderId = orderId
        defer { finishStatusOperation(operation) }
        let updateResult = await ordersRepository.updateReceivedOrderProducerStatus(
            orderId: orderId,
            producerId: producerId,
            status: status,
            nowMillis: nowMillisProvider(),
            environment: operation.context.environment
        )
        guard !Task.isCancelled, isCurrent(operation) else { return }
        if updateResult == .success {
            statusWriteFeedback = nil
            loadState = .loaded(currentSnapshot.withProducerStatus(orderId: orderId, status: status))
        } else {
            statusWriteFeedback = updateResult
        }
    }

    private func finishStatusOperation(_ operation: StatusOperation) {
        guard statusOperationGeneration == operation.generation else { return }
        updatingStatusOrderId = nil
    }

    private func beginLoadOperation() -> LoadOperation {
        loadOperationGeneration &+= 1
        let operationContext = context
        let operationWindow = resolveReceivedOrdersWindow(
            nowMillis: operationContext.nowMillis,
            defaultDeliveryDayOfWeek: operationContext.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: operationContext.deliveryCalendarOverrides,
            shifts: operationContext.shifts
        )
        return LoadOperation(
            context: operationContext,
            generation: loadOperationGeneration,
            taskID: makeLoadTaskID(context: operationContext, window: operationWindow),
            window: operationWindow,
            sessionStateRevision: contextSessionStateRevision
        )
    }

    private func beginStatusOperation() -> StatusOperation {
        statusOperationGeneration &+= 1
        return StatusOperation(
            context: context,
            generation: statusOperationGeneration,
            sessionStateRevision: contextSessionStateRevision
        )
    }

    private func invalidateStatusOperation() {
        statusOperationGeneration &+= 1
        updatingStatusOrderId = nil
    }

    private func isCurrent(_ operation: LoadOperation) -> Bool {
        loadOperationGeneration == operation.generation &&
            context.identity == operation.context.identity &&
            sessionViewModel.sessionStateRevision == operation.sessionStateRevision &&
            ordersRouteHasActiveAuthorization(
                sessionViewModel: sessionViewModel,
                currentMember: operation.context.currentMember,
                environment: operation.context.environment
            )
    }

    private func isCurrent(_ operation: StatusOperation) -> Bool {
        statusOperationGeneration == operation.generation &&
            context.identity == operation.context.identity &&
            sessionViewModel.sessionStateRevision == operation.sessionStateRevision &&
            ordersRouteHasActiveAuthorization(
                sessionViewModel: sessionViewModel,
                currentMember: operation.context.currentMember,
                environment: operation.context.environment
            )
    }

    private func makeLoadTaskID(context: ReceivedOrdersRouteContext, window: ReceivedOrdersWindow) -> String {
        [
            context.environment.rawValue,
            String(context.currentMember?.canAccessReceivedOrders == true),
            String(window.isEnabled),
            window.targetWeekKey,
            context.currentMember?.id ?? ""
        ].joined(separator: "|")
    }
}

func resolveReceivedOrdersWindow(
    nowMillis: Int64,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment]
) -> ReceivedOrdersWindow {
    let consultaWindow = resolveMyOrderConsultaWindow(
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        shifts: shifts,
        now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    )
    let currentWeekKey = nowMillis.isoWeekKey
    return ReceivedOrdersWindow(
        isEnabled: consultaWindow.isConsultaPhase,
        targetWeekKey: consultaWindow.isConsultaPhase ? consultaWindow.previousWeekKey : currentWeekKey
    )
}
