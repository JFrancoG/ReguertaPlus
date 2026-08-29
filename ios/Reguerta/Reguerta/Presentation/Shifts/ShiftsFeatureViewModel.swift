import Foundation
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
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64
    @ObservationIgnored let planningRequestIDProvider: @MainActor () -> String
    @ObservationIgnored let environmentProvider: @MainActor () -> ReguertaFirestoreEnvironment
    @ObservationIgnored let shiftsRetrySleeper: @MainActor (Duration) async throws -> Void
    @ObservationIgnored var shiftsRefreshTask: Task<Void, Never>?
    @ObservationIgnored var shiftPlanningObservationTask: Task<Void, Never>?
    @ObservationIgnored var shiftSwapMutationTask: Task<Bool, Never>?
    @ObservationIgnored var activeShiftSwapMutationAuthorizationReceipt: ShiftSwapMutationAuthorizationReceipt?
    @ObservationIgnored var activeShiftSwapMutationIntent: ShiftSwapMutationIntent?
    @ObservationIgnored var activeShiftSwapMutationDidStartTransition = false
    @ObservationIgnored var pendingShiftSwapAuthorizationBoundaryReceipt: ShiftSwapMutationUncertaintyReceipt?
    @ObservationIgnored var handledShiftSwapAuthorizationBoundaryRevision: UInt64 = 0
    @ObservationIgnored var pendingInitialCalendarHydration: PendingInitialCalendarHydration?
    @ObservationIgnored var nextInitialCalendarHydrationGeneration: UInt64 = 0
    @ObservationIgnored var refreshedActivationRequestIds = Set<String>()
    @ObservationIgnored var reportedPlanningFailureRequestIds = Set<String>()

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var currentEnvironment: ReguertaFirestoreEnvironment?
    var shiftsFeed: [ShiftAssignment] = []
    var shiftSwapRequests: [ShiftSwapRequest] = []
    var dismissedShiftSwapRequestIds = Set<String>()
    var shiftSwapAcknowledgements: [String: ShiftSwapAcknowledgement] = [:]
    var uncertainShiftSwapMutationIntents: [ShiftSwapMutationUncertaintyKey: ShiftSwapMutationUncertaintyReceipt] = [:]
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
    var shiftPlanningObservation: ShiftPlanningRequestObservation?
    var shiftPlanningCandidate: ShiftPlanningCandidate?
    var isLoadingShiftPlanningCandidate = false
    var isRefreshingShiftsAfterActivation = false
    var isSavingShiftSwapRequest = false
    var isUpdatingShiftSwapRequest = false
    var isDeliveryCalendarWeekPickerPresented = false
    var selectedDeliveryCalendarWeekKey: String?
    var selectedDeliveryCalendarWeekday: DeliveryWeekday = .wednesday
    var originalDeliveryCalendarWeekday: DeliveryWeekday = .wednesday
    var shiftPlanningDeliverySeasonInput = ""
    var shiftPlanningMarketSeasonInput = ""
    var pendingShiftPlanningRequest: ShiftPlanningRequest?
    var sessionIdentityEpoch: UInt64 = 0
    var activeShiftsRefreshOperationId: UInt64?
    var nextShiftsRefreshOperationId: UInt64 = 0
    var activeCalendarRefreshOperationId: UInt64?
    var nextCalendarRefreshOperationId: UInt64 = 0
    var activeCalendarMutationOperationId: UInt64?
    var nextCalendarMutationOperationId: UInt64 = 0
    var activePlanningSubmissionOperationId: UInt64?
    var nextPlanningSubmissionOperationId: UInt64 = 0
    var activeShiftSwapMutationOperationId: UInt64?
    var nextShiftSwapMutationOperationId: UInt64 = 0

    var acknowledgedShiftSwapRequestIds: Set<String> {
        Set(shiftSwapAcknowledgements.keys)
    }

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

    var selectedDeliveryCalendarOverride: DeliveryCalendarOverride? {
        guard let selectedDeliveryCalendarWeekKey else { return nil }
        return deliveryCalendarOverrides.first { $0.weekKey == selectedDeliveryCalendarWeekKey }
    }

    var hasDeliveryCalendarDayChange: Bool {
        selectedDeliveryCalendarWeekday != originalDeliveryCalendarWeekday
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        shiftRepository: any ShiftRepository,
        shiftSwapRequestRepository: any ShiftSwapRequestRepository,
        shiftPlanningRequestRepository: any ShiftPlanningRequestRepository,
        deliveryCalendarRepository: any DeliveryCalendarRepository,
        nowMillisProvider: @escaping @MainActor () -> Int64,
        planningRequestIDProvider: @escaping @MainActor () -> String = {
            UUID().uuidString.lowercased()
        },
        shiftsRetrySleeper: @escaping @MainActor (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        },
        environmentProvider: @escaping @MainActor () -> ReguertaFirestoreEnvironment
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.shiftRepository = shiftRepository
        self.shiftSwapRequestRepository = shiftSwapRequestRepository
        self.shiftPlanningRequestRepository = shiftPlanningRequestRepository
        self.deliveryCalendarRepository = deliveryCalendarRepository
        self.nowMillisProvider = nowMillisProvider
        self.planningRequestIDProvider = planningRequestIDProvider
        self.shiftsRetrySleeper = shiftsRetrySleeper
        self.environmentProvider = environmentProvider
        handledShiftSwapAuthorizationBoundaryRevision = sessionViewModel.shiftSwapAuthorizationBoundaryRevision
        if case .authorized(let session) = sessionViewModel.mode, session.representsActiveAuthorization {
            currentSession = session
            currentMember = session.member
            currentEnvironment = session.environment
        }
    }

    deinit {
        shiftsRefreshTask?.cancel()
        shiftPlanningObservationTask?.cancel()
        shiftSwapMutationTask?.cancel()
    }

    struct SessionContext {
        let session: AuthorizedSession
        let generation: UInt64
        let environment: ReguertaFirestoreEnvironment
        let sessionStateRevision: UInt64
    }

    struct ShiftSwapMutationAuthorizationReceipt {
        let operationId: UInt64
        var generation: UInt64
        var sessionStateRevision: UInt64
        let authorizationBoundaryRevision: UInt64
    }

    struct PendingInitialCalendarHydration {
        let generation: UInt64
        let context: SessionContext
        let feedOperationId: UInt64
    }

    struct SessionAuthorizationSignature: Equatable {
        let principalUID: String
        let authenticatedMember: MemberAuthorizationSignature
        let currentMember: MemberAuthorizationSignature
        let environment: SessionEnvironment
    }

    struct MemberAuthorizationSignature: Equatable {
        let id: String
        let authUID: String?
        let roles: Set<MemberRole>
        let isActive: Bool
        let capabilities: Set<AccessCapability>
    }
}
