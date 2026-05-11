import Foundation
import Observation

enum ReceivedOrdersTab: String, CaseIterable, Identifiable, Sendable {
    case byProduct
    case byMember

    var id: String { rawValue }

    var title: String {
        switch self {
        case .byProduct:
            return "Por producto"
        case .byMember:
            return "Por regüertense"
        }
    }
}

enum ReceivedOrdersLoadState: Equatable, Sendable {
    case idle
    case loading
    case loaded(ReceivedOrdersSnapshot)
    case empty
    case error
}

struct ReceivedOrdersWindow: Equatable, Sendable {
    let isEnabled: Bool
    let targetWeekKey: String
}

struct ReceivedOrdersRouteContext: Sendable {
    let currentMember: Member?
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64

    static let empty = ReceivedOrdersRouteContext(
        currentMember: nil,
        shifts: [],
        defaultDeliveryDayOfWeek: nil,
        deliveryCalendarOverrides: [],
        nowMillis: 0
    )

    var identity: String {
        [
            currentMember?.id ?? "none",
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

    init(
        sessionViewModel: SessionViewModel,
        ordersRepository: any OrdersRepository,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
        self.nowMillisProvider = nowMillisProvider
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
        "\(isProducer)-\(window.isEnabled)-\(window.targetWeekKey)-\(currentMember?.id ?? "")"
    }

    func appear(context newContext: ReceivedOrdersRouteContext) async {
        context = newContext
        await loadIfNeeded()
    }

    func selectTab(_ tab: ReceivedOrdersTab) {
        selectedTab = tab
    }

    func retry() async {
        await loadIfNeeded(force: true)
    }

    func loadIfNeeded(force: Bool = false) async {
        guard isProducer else {
            loadState = .idle
            statusWriteFeedback = nil
            loadedTaskID = nil
            return
        }
        guard window.isEnabled else {
            loadState = .idle
            statusWriteFeedback = nil
            loadedTaskID = nil
            return
        }
        if !force, case .loading = loadState {
            return
        }
        if !force, loadedTaskID == loadTaskID {
            return
        }
        guard let producerId = currentMember?.id else {
            loadState = .error
            return
        }
        loadedTaskID = loadTaskID
        loadState = .loading
        statusWriteFeedback = nil
        do {
            if let snapshot = try await ordersRepository.receivedOrdersSnapshot(
                producerId: producerId,
                targetWeekKey: window.targetWeekKey
            ) {
                loadState = .loaded(snapshot)
            } else {
                loadState = .empty
            }
        } catch {
            loadState = .error
            loadedTaskID = nil
        }
    }

    func updateProducerStatus(orderId: String, status: ProducerOrderStatus) async {
        guard updatingStatusOrderId == nil else { return }
        guard let producerId = currentMember?.id, producerId.isNotEmpty else { return }
        guard case .loaded(let currentSnapshot) = loadState else { return }
        guard let group = currentSnapshot.byMemberGroups.first(where: { $0.orderId == orderId }) else { return }
        guard group.producerStatus != status else { return }

        updatingStatusOrderId = orderId
        let updateResult = await ordersRepository.updateReceivedOrderProducerStatus(
            orderId: orderId,
            producerId: producerId,
            status: status,
            nowMillis: nowMillisProvider()
        )
        if updateResult == .success {
            statusWriteFeedback = nil
            loadState = .loaded(currentSnapshot.withProducerStatus(orderId: orderId, status: status))
        } else {
            statusWriteFeedback = updateResult
        }
        updatingStatusOrderId = nil
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
