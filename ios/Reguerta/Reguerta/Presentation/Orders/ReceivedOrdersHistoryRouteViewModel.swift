import Foundation
import Observation

enum ReceivedOrdersHistoryLoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded(ReceivedOrdersSnapshot)
    case empty
    case error
}

struct ReceivedOrdersHistoryRouteContext {
    let currentMember: Member?
    let nowMillis: Int64
    let environment: SessionEnvironment

    static let empty = ReceivedOrdersHistoryRouteContext(currentMember: nil, nowMillis: 0, environment: .develop)

    var identity: String {
        [
            currentMember?.id ?? "none",
            environment.rawValue,
            String(currentMember?.canAccessReceivedOrders == true),
            orderHistoryPreviousIsoWeekKey(nowMillis: nowMillis)
        ].joined(separator: "|")
    }
}

@MainActor
@Observable
final class ReceivedOrdersHistoryRouteViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let ordersRepository: any OrdersRepository

    var context: ReceivedOrdersHistoryRouteContext = .empty
    var availableWeeks: [OrderHistoryWeekOption] = []
    var selectedWeekKey: String?
    var pickerSelectedWeekKey: String?
    var isWeekPickerPresented = false
    var selectedTab: ReceivedOrdersTab = .byProduct
    var loadState: ReceivedOrdersHistoryLoadState = .idle

    private var loadedHistoryIdentity: String?
    private var loadedWeekKey: String?
    private var historyLoadOwnerGeneration: UInt64?
    private var weekLoadOwnerGeneration: UInt64?
    private var loadOperationGeneration: UInt64 = 0
    private var contextSessionStateRevision: UInt64 = 0

    private struct LoadOperation {
        let context: ReceivedOrdersHistoryRouteContext
        let generation: UInt64
        let sessionStateRevision: UInt64
    }

    init(sessionViewModel: SessionViewModel, ordersRepository: any OrdersRepository) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
        contextSessionStateRevision = sessionViewModel.sessionStateRevision
    }

    var isProducer: Bool {
        context.currentMember?.canAccessReceivedOrders == true
    }

    var selectedWeek: OrderHistoryWeekOption? {
        guard let selectedWeekKey else { return nil }
        return availableWeeks.first { $0.weekKey == selectedWeekKey }
            ?? orderHistoryWeekOption(weekKey: selectedWeekKey)
    }

    var selectedTitle: String? {
        guard let selectedWeek else { return nil }
        return "Pedidos recibidos \(selectedWeek.rangeLabel)"
    }

    var canGoPrevious: Bool {
        guard let index = selectedWeekIndex else { return false }
        return index > availableWeeks.startIndex
    }

    var canGoNext: Bool {
        guard let index = selectedWeekIndex else { return false }
        return index < availableWeeks.index(before: availableWeeks.endIndex)
    }

    var selectedWeekIndex: Int? {
        guard let selectedWeekKey else { return nil }
        return availableWeeks.firstIndex { $0.weekKey == selectedWeekKey }
    }

    func appear(context newContext: ReceivedOrdersHistoryRouteContext) async {
        context = newContext
        contextSessionStateRevision = sessionViewModel.sessionStateRevision
        let operation = beginLoadOperation()
        await loadHistoryIfNeeded(operation: operation)
    }

    func selectTab(_ tab: ReceivedOrdersTab) {
        selectedTab = tab
    }

    func retry() async {
        let operation = beginLoadOperation()
        loadedWeekKey = nil
        if availableWeeks.isEmpty {
            loadedHistoryIdentity = nil
            await loadHistoryIfNeeded(force: true, operation: operation)
        } else {
            await loadSelectedWeek(force: true, operation: operation)
        }
    }

    func selectPreviousWeek() async {
        guard canGoPrevious, let index = selectedWeekIndex else { return }
        await selectWeek(availableWeeks[availableWeeks.index(before: index)].weekKey)
    }

    func selectNextWeek() async {
        guard canGoNext, let index = selectedWeekIndex else { return }
        await selectWeek(availableWeeks[availableWeeks.index(after: index)].weekKey)
    }

    func selectWeek(_ weekKey: String) async {
        guard selectedWeekKey != weekKey else { return }
        selectedWeekKey = weekKey
        loadedWeekKey = nil
        let operation = beginLoadOperation()
        await loadSelectedWeek(force: true, operation: operation)
    }

    func presentWeekPicker() {
        pickerSelectedWeekKey = selectedWeekKey ?? availableWeeks.first?.weekKey
        isWeekPickerPresented = true
    }

    func dismissWeekPicker() {
        isWeekPickerPresented = false
    }

    func commitPickerSelection() async {
        guard let pickerSelectedWeekKey else {
            isWeekPickerPresented = false
            return
        }
        isWeekPickerPresented = false
        await selectWeek(pickerSelectedWeekKey)
    }

    func loadHistoryIfNeeded(force: Bool = false) async {
        let operation = beginLoadOperation()
        await loadHistoryIfNeeded(force: force, operation: operation)
    }

    func loadSelectedWeek(force: Bool = false) async {
        let operation = beginLoadOperation()
        await loadSelectedWeek(force: force, operation: operation)
    }

    private func loadHistoryIfNeeded(force: Bool = false, operation: LoadOperation) async {
        guard isCurrent(operation) else { return }
        let operationContext = operation.context
        guard operationContext.currentMember?.canAccessReceivedOrders == true else {
            resetForUnavailableProducer()
            return
        }
        if !force, loadedHistoryIdentity == operationContext.identity {
            if historyLoadOwnerGeneration == operation.generation { return }
            if historyLoadOwnerGeneration == nil {
                await loadSelectedWeek(operation: operation)
                return
            }
        }
        loadedHistoryIdentity = operationContext.identity
        historyLoadOwnerGeneration = operation.generation
        let preferredWeekKey = orderHistoryPreviousIsoWeekKey(nowMillis: operationContext.nowMillis)
        selectedWeekKey = preferredWeekKey
        loadedWeekKey = nil
        weekLoadOwnerGeneration = nil
        loadState = .loading
        do {
            let producerId = operationContext.currentMember?.id ?? ""
            let realWeekKeys = try await ordersRepository.receivedOrdersHistoryWeekKeys(
                producerId: producerId,
                environment: operationContext.environment
            )
            try Task.checkCancellation()
            guard canPublishHistoryLoad(operation) else { return }
            finishHistoryLoad(operation, completed: true)
            availableWeeks = orderHistoryBrowsableWeekOptions(
                realWeekKeys: realWeekKeys,
                oldestOrderWeekKey: realWeekKeys.min(),
                preferredWeekKey: preferredWeekKey
            )
            if availableWeeks.isEmpty, let fallback = orderHistoryWeekOption(weekKey: preferredWeekKey) {
                availableWeeks = [fallback]
            }
            await loadSelectedWeek(force: true, operation: operation)
        } catch is CancellationError {
            finishHistoryLoad(operation, completed: false)
            return
        } catch {
            guard canPublishHistoryLoad(operation) else { return }
            availableWeeks = orderHistoryBrowsableWeekOptions(
                realWeekKeys: [],
                preferredWeekKey: preferredWeekKey
            )
            loadState = .error
            finishHistoryLoad(operation, completed: false)
        }
    }

    private func loadSelectedWeek(force: Bool = false, operation: LoadOperation) async {
        guard isCurrent(operation) else { return }
        let operationContext = operation.context
        guard operationContext.currentMember?.canAccessReceivedOrders == true,
              let producerId = operationContext.currentMember?.id,
              producerId.isNotEmpty else {
            resetForUnavailableProducer()
            return
        }
        let weekKey = selectedWeekKey ?? orderHistoryPreviousIsoWeekKey(nowMillis: operationContext.nowMillis)
        if !force, loadedWeekKey == weekKey {
            if weekLoadOwnerGeneration == operation.generation { return }
            if weekLoadOwnerGeneration == nil { return }
        }
        selectedWeekKey = weekKey
        loadedWeekKey = weekKey
        weekLoadOwnerGeneration = operation.generation
        loadState = .loading
        do {
            let snapshot = try await ordersRepository.receivedOrdersHistorySnapshot(
                producerId: producerId,
                weekKey: weekKey,
                environment: operationContext.environment
            )
            try Task.checkCancellation()
            guard isCurrent(operation) else {
                finishWeekLoad(operation, weekKey: weekKey, completed: false)
                return
            }
            if let snapshot, !snapshot.byProductRows.isEmpty || !snapshot.byMemberGroups.isEmpty {
                loadState = .loaded(snapshot)
            } else {
                loadState = .empty
            }
            finishWeekLoad(operation, weekKey: weekKey, completed: true)
        } catch is CancellationError {
            finishWeekLoad(operation, weekKey: weekKey, completed: false)
            return
        } catch {
            guard isCurrent(operation) else {
                finishWeekLoad(operation, weekKey: weekKey, completed: false)
                return
            }
            loadState = .error
            finishWeekLoad(operation, weekKey: weekKey, completed: false)
        }
    }

    private func beginLoadOperation() -> LoadOperation {
        loadOperationGeneration &+= 1
        return LoadOperation(
            context: context,
            generation: loadOperationGeneration,
            sessionStateRevision: contextSessionStateRevision
        )
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

    private func canPublishHistoryLoad(_ operation: LoadOperation) -> Bool {
        guard isCurrent(operation) else {
            finishHistoryLoad(operation, completed: false)
            return false
        }
        return true
    }

    private func finishHistoryLoad(_ operation: LoadOperation, completed: Bool) {
        guard loadedHistoryIdentity == operation.context.identity,
              historyLoadOwnerGeneration == operation.generation else { return }
        historyLoadOwnerGeneration = nil
        if !completed {
            loadedHistoryIdentity = nil
            if case .loading = loadState {
                loadState = .idle
            }
        }
    }

    private func finishWeekLoad(_ operation: LoadOperation, weekKey: String, completed: Bool) {
        guard loadedWeekKey == weekKey, weekLoadOwnerGeneration == operation.generation else { return }
        weekLoadOwnerGeneration = nil
        if !completed {
            loadedWeekKey = nil
            if case .loading = loadState {
                loadState = .idle
            }
        }
    }

    private func resetForUnavailableProducer() {
        availableWeeks = []
        selectedWeekKey = nil
        pickerSelectedWeekKey = nil
        isWeekPickerPresented = false
        loadedHistoryIdentity = nil
        loadedWeekKey = nil
        historyLoadOwnerGeneration = nil
        weekLoadOwnerGeneration = nil
        loadState = .idle
    }
}
