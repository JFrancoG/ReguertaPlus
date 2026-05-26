import Foundation
import Observation

enum ReceivedOrdersHistoryLoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded(ReceivedOrdersSnapshot)
    case empty
    case error
}

struct ReceivedOrdersHistoryRouteContext: Sendable {
    let currentMember: Member?
    let nowMillis: Int64

    static let empty = ReceivedOrdersHistoryRouteContext(currentMember: nil, nowMillis: 0)

    var identity: String {
        [
            currentMember?.id ?? "none",
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

    init(
        sessionViewModel: SessionViewModel,
        ordersRepository: any OrdersRepository
    ) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
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
        await loadHistoryIfNeeded()
    }

    func selectTab(_ tab: ReceivedOrdersTab) {
        selectedTab = tab
    }

    func retry() async {
        loadedWeekKey = nil
        if availableWeeks.isEmpty {
            loadedHistoryIdentity = nil
            await loadHistoryIfNeeded(force: true)
        } else {
            await loadSelectedWeek(force: true)
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
        await loadSelectedWeek(force: true)
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
        guard isProducer else {
            resetForUnavailableProducer()
            return
        }
        guard force || loadedHistoryIdentity != context.identity else {
            await loadSelectedWeek()
            return
        }
        loadedHistoryIdentity = context.identity
        let preferredWeekKey = orderHistoryPreviousIsoWeekKey(nowMillis: context.nowMillis)
        selectedWeekKey = preferredWeekKey
        loadedWeekKey = nil
        loadState = .loading
        do {
            let producerId = context.currentMember?.id ?? ""
            let realWeekKeys = try await ordersRepository.receivedOrdersHistoryWeekKeys(producerId: producerId)
            availableWeeks = orderHistoryContinuousWeekOptions(
                realWeekKeys: realWeekKeys,
                preferredWeekKey: preferredWeekKey
            )
            if availableWeeks.isEmpty, let fallback = orderHistoryWeekOption(weekKey: preferredWeekKey) {
                availableWeeks = [fallback]
            }
            await loadSelectedWeek(force: true)
        } catch {
            availableWeeks = orderHistoryWeekOption(weekKey: preferredWeekKey).map { [$0] } ?? []
            loadState = .error
            loadedHistoryIdentity = nil
        }
    }

    func loadSelectedWeek(force: Bool = false) async {
        guard isProducer, let producerId = context.currentMember?.id, producerId.isNotEmpty else {
            resetForUnavailableProducer()
            return
        }
        let weekKey = selectedWeekKey ?? orderHistoryPreviousIsoWeekKey(nowMillis: context.nowMillis)
        guard force || loadedWeekKey != weekKey else { return }
        selectedWeekKey = weekKey
        loadedWeekKey = weekKey
        loadState = .loading
        do {
            let snapshot = try await ordersRepository.receivedOrdersHistorySnapshot(
                producerId: producerId,
                weekKey: weekKey
            )
            if let snapshot, (!snapshot.byProductRows.isEmpty || !snapshot.byMemberGroups.isEmpty) {
                loadState = .loaded(snapshot)
            } else {
                loadState = .empty
            }
        } catch {
            loadState = .error
            loadedWeekKey = nil
        }
    }

    private func resetForUnavailableProducer() {
        availableWeeks = []
        selectedWeekKey = nil
        pickerSelectedWeekKey = nil
        isWeekPickerPresented = false
        loadedHistoryIdentity = nil
        loadedWeekKey = nil
        loadState = .idle
    }
}
