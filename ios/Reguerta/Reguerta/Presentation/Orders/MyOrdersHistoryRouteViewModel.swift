import Foundation
import Observation

enum MyOrdersHistoryLoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded(MyOrderPreviousOrderSnapshot)
    case empty
    case error
}

struct MyOrdersHistoryRouteContext: Sendable {
    let currentMember: Member?
    let nowMillis: Int64

    static let empty = MyOrdersHistoryRouteContext(currentMember: nil, nowMillis: 0)

    var identity: String {
        [
            currentMember?.id ?? "none",
            orderHistoryPreviousIsoWeekKey(nowMillis: nowMillis)
        ].joined(separator: "|")
    }
}

@MainActor
@Observable
final class MyOrdersHistoryRouteViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let ordersRepository: any OrdersRepository

    var context: MyOrdersHistoryRouteContext = .empty
    var availableWeeks: [OrderHistoryWeekOption] = []
    var selectedWeekKey: String?
    var pickerSelectedWeekKey: String?
    var isWeekPickerPresented = false
    var loadState: MyOrdersHistoryLoadState = .idle

    private var loadedHistoryIdentity: String?
    private var loadedWeekKey: String?

    init(
        sessionViewModel: SessionViewModel,
        ordersRepository: any OrdersRepository
    ) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
    }

    var selectedWeek: OrderHistoryWeekOption? {
        guard let selectedWeekKey else { return nil }
        return availableWeeks.first { $0.weekKey == selectedWeekKey }
            ?? orderHistoryWeekOption(weekKey: selectedWeekKey)
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

    func appear(context newContext: MyOrdersHistoryRouteContext) async {
        context = newContext
        await loadHistoryIfNeeded()
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
            let realWeekKeys = try await ordersRepository.orderHistoryWeekKeys(currentMember: context.currentMember)
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
        let weekKey = selectedWeekKey ?? orderHistoryPreviousIsoWeekKey(nowMillis: context.nowMillis)
        guard force || loadedWeekKey != weekKey else { return }
        selectedWeekKey = weekKey
        loadedWeekKey = weekKey
        loadState = .loading
        do {
            let snapshot = try await ordersRepository.orderSummarySnapshot(
                currentMember: context.currentMember,
                weekKey: weekKey
            )
            if let snapshot, !snapshot.groups.isEmpty {
                loadState = .loaded(snapshot)
            } else {
                loadState = .empty
            }
        } catch {
            loadState = .error
            loadedWeekKey = nil
        }
    }
}
