import Observation

@MainActor
@Observable
final class ShiftsFeatureViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let shiftRepository: any ShiftRepository
    @ObservationIgnored let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    @ObservationIgnored let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    @ObservationIgnored let deliveryCalendarRepository: any DeliveryCalendarRepository
    @ObservationIgnored let notificationRepository: any NotificationRepository
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var shiftsFeed: [ShiftAssignment] = []
    var shiftSwapRequests: [ShiftSwapRequest] = []
    var dismissedShiftSwapRequestIds = Set<String>()
    var shiftSwapDraft = ShiftSwapDraft()
    var selectedShiftSegment: ShiftBoardSegment = .delivery
    var nextDeliveryShift: ShiftAssignment?
    var nextMarketShift: ShiftAssignment?
    var defaultDeliveryDayOfWeek: DeliveryWeekday?
    var deliveryCalendarOverrides: [DeliveryCalendarOverride] = []
    var isLoadingShifts = false
    var isLoadingDeliveryCalendar = false
    var isSavingDeliveryCalendar = false
    var isSubmittingShiftPlanningRequest = false
    var isSavingShiftSwapRequest = false
    var isUpdatingShiftSwapRequest = false
    var isDeliveryCalendarEditorPresented = false
    var isDeliveryCalendarWeekPickerPresented = false
    var selectedDeliveryCalendarWeekKey: String?
    var selectedDeliveryCalendarWeekday: DeliveryWeekday = .wednesday
    var pendingShiftPlanningType: ShiftPlanningRequestType?

    var deliveryShifts: [ShiftAssignment] {
        shiftsFeed
            .filter { $0.type == .delivery }
            .sorted { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }
    }

    var marketShifts: [ShiftAssignment] {
        shiftsFeed
            .filter { $0.type == .market }
            .sorted { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }
    }

    var visibleShifts: [ShiftAssignment] {
        selectedShiftSegment == .delivery ? deliveryShifts : marketShifts
    }

    var futureDeliveryWeeks: [ShiftAssignment] {
        let nowMillis = nowMillisProvider()
        let sortedWeeks = deliveryShifts.filter { effectiveDateMillis(for: $0) > nowMillis }

        var seenWeekKeys = Set<String>()
        return sortedWeeks.filter { seenWeekKeys.insert($0.weekKey).inserted }
    }

    var selectedDeliveryCalendarShift: ShiftAssignment? {
        guard let selectedDeliveryCalendarWeekKey else { return nil }
        return futureDeliveryWeeks.first { $0.weekKey == selectedDeliveryCalendarWeekKey }
    }

    var selectedDeliveryCalendarOverride: DeliveryCalendarOverride? {
        guard let selectedDeliveryCalendarWeekKey else { return nil }
        return deliveryCalendarOverrides.first { $0.weekKey == selectedDeliveryCalendarWeekKey }
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        shiftRepository: any ShiftRepository,
        shiftSwapRequestRepository: any ShiftSwapRequestRepository,
        shiftPlanningRequestRepository: any ShiftPlanningRequestRepository,
        deliveryCalendarRepository: any DeliveryCalendarRepository,
        notificationRepository: any NotificationRepository,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.shiftRepository = shiftRepository
        self.shiftSwapRequestRepository = shiftSwapRequestRepository
        self.shiftPlanningRequestRepository = shiftPlanningRequestRepository
        self.deliveryCalendarRepository = deliveryCalendarRepository
        self.notificationRepository = notificationRepository
        self.nowMillisProvider = nowMillisProvider
    }
}
