@testable import Reguerta

@MainActor
func makeShiftsViewModel(
    currentMember: Member,
    members: [Member],
    shiftRepository: (any ShiftRepository)? = nil,
    shiftSwapRequestRepository: (any ShiftSwapRequestRepository)? = nil,
    shiftPlanningRequestRepository: (any ShiftPlanningRequestRepository)? = nil,
    deliveryCalendarRepository: (any DeliveryCalendarRepository)? = nil,
    notificationRepository: (any NotificationRepository)? = nil,
    nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 }
) -> ShiftsFeatureViewModel {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let session = AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(currentMember.id)", email: currentMember.normalizedEmail),
        authenticatedMember: currentMember,
        member: currentMember,
        members: members
    )
    sessionViewModel.mode = .authorized(session)
    let viewModel = ShiftsFeatureViewModel(
        sessionViewModel: sessionViewModel,
        shiftRepository: shiftRepository ?? InMemoryShiftRepository(),
        shiftSwapRequestRepository: shiftSwapRequestRepository ?? InMemoryShiftSwapRequestRepository(),
        shiftPlanningRequestRepository: shiftPlanningRequestRepository ?? RecordingShiftPlanningRequestRepository(),
        deliveryCalendarRepository: deliveryCalendarRepository ?? InMemoryDeliveryCalendarRepository(),
        notificationRepository: notificationRepository ?? RecordingNotificationRepository(),
        nowMillisProvider: nowMillisProvider
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    return viewModel
}

@MainActor
func shiftMember(id: String, displayName: String) -> Member {
    Member(
        id: id,
        displayName: displayName,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: "auth_\(id)",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

@MainActor
func adminMember(id: String, displayName: String) -> Member {
    Member(
        id: id,
        displayName: displayName,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: "auth_\(id)",
        roles: [.member, .admin],
        isActive: true,
        producerCatalogEnabled: true
    )
}

@MainActor
func shift(
    id: String,
    type: ShiftType,
    dateMillis: Int64,
    assignedUserIds: [String],
    helperUserId: String? = nil
) -> ShiftAssignment {
    ShiftAssignment(
        id: id,
        type: type,
        dateMillis: dateMillis,
        assignedUserIds: assignedUserIds,
        helperUserId: helperUserId,
        status: .confirmed,
        source: "test",
        createdAtMillis: 0,
        updatedAtMillis: 0
    )
}

func shiftSwapRequest(
    id: String,
    requestedShiftId: String,
    requesterUserId: String,
    candidates: [ShiftSwapCandidate],
    responses: [ShiftSwapResponse] = [],
    status: ShiftSwapRequestStatus = .open
) -> ShiftSwapRequest {
    ShiftSwapRequest(
        id: id,
        requestedShiftId: requestedShiftId,
        requesterUserId: requesterUserId,
        reason: "Cambio de prueba",
        status: status,
        candidates: candidates,
        responses: responses,
        selectedCandidateUserId: nil,
        selectedCandidateShiftId: nil,
        requestedAtMillis: 1,
        confirmedAtMillis: nil,
        appliedAtMillis: nil
    )
}

func availableShiftSwapResponse(userId: String, shiftId: String) -> ShiftSwapResponse {
    ShiftSwapResponse(
        userId: userId,
        shiftId: shiftId,
        status: .available,
        respondedAtMillis: 10
    )
}

@MainActor
final class TestNowProvider {
    var nowMillis: Int64

    init(nowMillis: Int64) {
        self.nowMillis = nowMillis
    }
}

actor RecordingNotificationRepository: NotificationRepository {
    private var events: [NotificationEvent] = []

    func allNotifications() async -> [NotificationEvent] {
        events
    }

    func readNotificationIds(memberId _: String) async -> Set<String> {
        []
    }

    func markNotificationsRead(memberId _: String, notificationIds _: [String], readAtMillis _: Int64) async {}

    func send(event: NotificationEvent) async -> NotificationEvent {
        events.append(event)
        return event
    }

    func sentEvents() async -> [NotificationEvent] {
        events
    }
}

actor RecordingShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    private var requests: [ShiftPlanningRequest] = []

    func submit(request: ShiftPlanningRequest) async -> ShiftPlanningRequest {
        requests.append(request)
        return request
    }

    func submittedRequests() async -> [ShiftPlanningRequest] {
        requests
    }
}

struct ConfirmShiftSwapTestScenario {
    let requester: Member
    let candidate: Member
    let requestedShift: ShiftAssignment
    let candidateShift: ShiftAssignment
    let shiftRepository: InMemoryShiftRepository
    let requestRepository: InMemoryShiftSwapRequestRepository
    let viewModel: ShiftsFeatureViewModel
}

@MainActor
func makeConfirmShiftSwapTestScenario() async -> ConfirmShiftSwapTestScenario {
    let requester = shiftMember(id: "requester", displayName: "Rosa")
    let candidate = shiftMember(id: "candidate", displayName: "Luis")
    let helper = shiftMember(id: "helper", displayName: "Marta")
    let requestedShift = shift(
        id: "delivery_requested",
        type: .delivery,
        dateMillis: testMillis(year: 2026, month: 5, day: 20),
        assignedUserIds: [requester.id],
        helperUserId: candidate.id
    )
    let candidateShift = shift(
        id: "delivery_candidate",
        type: .delivery,
        dateMillis: testMillis(year: 2026, month: 6, day: 10),
        assignedUserIds: [candidate.id],
        helperUserId: helper.id
    )
    let requestRepository = InMemoryShiftSwapRequestRepository()
    _ = await requestRepository.upsert(
        request: shiftSwapRequest(
            id: "swap_1",
            requestedShiftId: requestedShift.id,
            requesterUserId: requester.id,
            candidates: [ShiftSwapCandidate(userId: candidate.id, shiftId: candidateShift.id)],
            responses: [availableShiftSwapResponse(userId: candidate.id, shiftId: candidateShift.id)]
        )
    )
    let shiftRepository = InMemoryShiftRepository(items: [requestedShift, candidateShift])
    let viewModel = makeShiftsViewModel(
        currentMember: requester,
        members: [requester, candidate, helper],
        shiftRepository: shiftRepository,
        shiftSwapRequestRepository: requestRepository,
        nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
    )
    await viewModel.refreshShifts()
    return ConfirmShiftSwapTestScenario(
        requester: requester,
        candidate: candidate,
        requestedShift: requestedShift,
        candidateShift: candidateShift,
        shiftRepository: shiftRepository,
        requestRepository: requestRepository,
        viewModel: viewModel
    )
}
