import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsViewModelTests {
    @Test func shiftsViewModelLoadsVisibleShiftsAndResetsWhenSignedOut() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let otherMember = shiftMember(id: "member_2", displayName: "Javier")
        let requestedShift = shift(
            id: "delivery_requested",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 20),
            assignedUserIds: [currentMember.id],
            helperUserId: otherMember.id
        )
        let candidateShift = shift(
            id: "delivery_candidate",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 6, day: 10),
            assignedUserIds: [otherMember.id],
            helperUserId: currentMember.id
        )
        let shiftRepository = InMemoryShiftRepository(items: [requestedShift, candidateShift])
        let requestRepository = InMemoryShiftSwapRequestRepository()
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "visible_request",
                requestedShiftId: requestedShift.id,
                requesterUserId: currentMember.id,
                candidates: [
                    ShiftSwapCandidate(userId: otherMember.id, shiftId: candidateShift.id)
                ]
            ),
            environment: .develop
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember, otherMember],
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: requestRepository
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await awaitCurrentShiftsRefresh(in: viewModel)

        #expect(viewModel.shiftSwapRequests.map(\.id) == ["visible_request"])
        #expect(viewModel.nextDeliveryShift?.id == requestedShift.id)

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)

        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapRequests.isEmpty)
        #expect(viewModel.nextDeliveryShift == nil)
    }

    @Test func shiftsViewModelComputesNextShiftsAndRespondsToNowOverride() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let nowProvider = TestNowProvider(nowMillis: testMillis(year: 2026, month: 5, day: 1))
        let firstDelivery = shift(
            id: "delivery_first",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 5),
            assignedUserIds: [currentMember.id]
        )
        let secondDelivery = shift(
            id: "delivery_second",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 12),
            assignedUserIds: [currentMember.id]
        )
        let market = shift(
            id: "market_next",
            type: .market,
            dateMillis: testMillis(year: 2026, month: 5, day: 3),
            assignedUserIds: [currentMember.id]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [firstDelivery, secondDelivery, market]),
            nowMillisProvider: { nowProvider.nowMillis }
        )

        await viewModel.refreshShifts()

        #expect(viewModel.nextDeliveryShift?.id == firstDelivery.id)
        #expect(viewModel.nextMarketShift?.id == market.id)

        nowProvider.nowMillis = testMillis(year: 2026, month: 5, day: 6)
        viewModel.handleNowOverrideChange()

        #expect(viewModel.nextDeliveryShift?.id == secondDelivery.id)
        #expect(viewModel.nextMarketShift == nil)
    }

    @Test func shiftsViewModelFiltersBoardSegmentAndAppliesDeliveryCalendarOverrides() async throws {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let delivery = shift(
            id: "delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [currentMember.id]
        )
        let market = shift(
            id: "market",
            type: .market,
            dateMillis: testMillis(year: 2026, month: 5, day: 8),
            assignedUserIds: [currentMember.id]
        )
        let override = try #require(
            DeliveryCalendarOverride.weeklyException(
                weekKey: delivery.weekKey,
                weekday: .friday,
                updatedByUserId: "admin_1",
                updatedAtMillis: 10
            )
        )
        let calendarRepository = InMemoryDeliveryCalendarRepository(defaultDay: .wednesday)
        _ = await calendarRepository.upsertOverride(override, environment: .develop)
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [delivery, market]),
            deliveryCalendarRepository: calendarRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )

        await viewModel.refreshShifts()
        await viewModel.refreshDeliveryCalendar()

        #expect(viewModel.defaultDeliveryDayOfWeek == .wednesday)
        #expect(viewModel.deliveryCalendarOverrides == [override])
        #expect(viewModel.visibleShifts.map(\.id) == [delivery.id])
        #expect(viewModel.effectiveDateMillis(for: delivery).deliveryWeekday == .friday)

        viewModel.selectedShiftSegment = .market

        #expect(viewModel.visibleShifts.map(\.id) == [market.id])
    }

    @Test func shiftsViewModelSubmitsSwapWhenLocalCandidatesAreStale() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let requestedShift = shift(
            id: "delivery_requested",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 20),
            assignedUserIds: [currentMember.id]
        )
        let requestRepository = AuthoritativeShiftSwapRequestRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [requestedShift]),
            shiftSwapRequestRepository: requestRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()

        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        viewModel.updateShiftSwapDraft { $0.reason = "  No puedo ir  " }
        let saved = await awaitShiftSwapSave(in: viewModel)
        let recordedCreate = await requestRepository.recordedCreate()

        #expect(saved)
        #expect(recordedCreate?.environment == .develop)
        #expect(recordedCreate?.requestedShiftId == requestedShift.id)
        #expect(recordedCreate?.reason == "No puedo ir")
    }

    @Test(arguments: [
        ShiftSwapFeedbackScenario(
            error: .noCandidates,
            expectedMessageKey: AccessL10nKey.feedbackShiftSwapNoCandidates
        ),
        ShiftSwapFeedbackScenario(
            error: .permissionDenied,
            expectedMessageKey: AccessL10nKey.feedbackShiftSwapPermissionDenied
        ),
        ShiftSwapFeedbackScenario(
            error: .conflict(code: "shift_swap_closed"),
            expectedMessageKey: AccessL10nKey.feedbackShiftSwapConflict
        ),
        ShiftSwapFeedbackScenario(
            error: .unavailable,
            expectedMessageKey: AccessL10nKey.feedbackShiftSwapUnavailable
        ),
        ShiftSwapFeedbackScenario(
            error: .invalidData,
            expectedMessageKey: AccessL10nKey.feedbackShiftSwapInvalidData
        ),
        ShiftSwapFeedbackScenario(
            error: .unknown,
            expectedMessageKey: AccessL10nKey.feedbackUnableSaveChanges
        )
    ])
    func shiftsViewModelMapsBackendSwapFailureToLocalizedFeedback(_ scenario: ShiftSwapFeedbackScenario) async {
        let requester = shiftMember(id: "requester", displayName: "Rosa")
        let candidate = shiftMember(id: "candidate", displayName: "Luis")
        let requestedShift = shift(
            id: "delivery_requested",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 20),
            assignedUserIds: [requester.id]
        )
        let candidateShift = shift(
            id: "delivery_candidate",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 6, day: 10),
            assignedUserIds: [candidate.id]
        )
        let requestRepository = FailingShiftSwapRequestRepository(error: scenario.error)
        let viewModel = makeShiftsViewModel(
            currentMember: requester,
            members: [requester, candidate],
            shiftRepository: InMemoryShiftRepository(items: [requestedShift, candidateShift]),
            shiftSwapRequestRepository: requestRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()

        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        viewModel.updateShiftSwapDraft { $0.reason = "No puedo ir" }
        let originalDraft = viewModel.shiftSwapDraft
        let saved = await awaitShiftSwapSave(in: viewModel)

        #expect(saved == false)
        #expect(viewModel.shiftSwapDraft == originalDraft)
        #expect(viewModel.feedbackCenter.messageKey == scenario.expectedMessageKey)
    }

    @Test func shiftsViewModelReadsBackAuthoritativeInMemoryCreate() async {
        let requester = shiftMember(id: "requester", displayName: "Rosa")
        let candidate = shiftMember(id: "candidate", displayName: "Luis")
        let requestedShift = shift(
            id: "delivery_requested",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 20),
            assignedUserIds: [requester.id]
        )
        let candidateShift = shift(
            id: "delivery_candidate",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 6, day: 10),
            assignedUserIds: [candidate.id]
        )
        let expectedCandidate = ShiftSwapCandidate(userId: candidate.id, shiftId: candidateShift.id)
        let transitionMillis = testMillis(year: 2026, month: 5, day: 1)
        let requestRepository = InMemoryShiftSwapRequestRepository(
            createFixtures: [InMemoryShiftSwapCreateFixture(
                requestedShiftId: requestedShift.id,
                requestId: "swap_server",
                requesterUserId: requester.id,
                candidates: [expectedCandidate]
            )],
            actorUserIdProvider: { requester.id },
            transitionMillisProvider: { transitionMillis }
        )
        let viewModel = makeShiftsViewModel(
            currentMember: requester,
            members: [requester, candidate],
            shiftRepository: InMemoryShiftRepository(items: [requestedShift, candidateShift]),
            shiftSwapRequestRepository: requestRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()

        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        viewModel.updateShiftSwapDraft { $0.reason = "No puedo ir" }
        let saved = await awaitShiftSwapSave(in: viewModel)
        await awaitCurrentShiftsRefresh(in: viewModel)

        #expect(saved)
        #expect(viewModel.shiftSwapRequests.first?.id == "swap_server")
        #expect(viewModel.shiftSwapRequests.first?.requesterUserId == requester.id)
        #expect(viewModel.shiftSwapRequests.first?.candidates == [expectedCandidate])
        #expect(viewModel.shiftSwapAcknowledgements.isEmpty)
        #expect(viewModel.shiftSwapDraft == ShiftSwapDraft())
    }

    @Test func shiftsViewModelAcceptsCandidateResponseAndPersistsIt() async {
        let requester = shiftMember(id: "requester", displayName: "Rosa")
        let candidate = shiftMember(id: "candidate", displayName: "Luis")
        let requestedShift = shift(
            id: "delivery_requested",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 20),
            assignedUserIds: [requester.id]
        )
        let candidateShift = shift(
            id: "delivery_candidate",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 6, day: 10),
            assignedUserIds: [candidate.id]
        )
        let requestRepository = InMemoryShiftSwapRequestRepository(
            actorUserIdProvider: { candidate.id }
        )
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "swap_1",
                requestedShiftId: requestedShift.id,
                requesterUserId: requester.id,
                candidates: [ShiftSwapCandidate(userId: candidate.id, shiftId: candidateShift.id)]
            ),
            environment: .develop
        )
        let viewModel = makeShiftsViewModel(
            currentMember: candidate,
            members: [requester, candidate],
            shiftRepository: InMemoryShiftRepository(items: [requestedShift, candidateShift]),
            shiftSwapRequestRepository: requestRepository
        )
        await viewModel.refreshShifts()

        viewModel.acceptShiftSwapRequest(requestId: "swap_1", candidateShiftId: candidateShift.id)
        await waitForCondition {
            viewModel.shiftSwapRequests.first?.responses.first?.status == .available
        }

        let stored = await requestRepository.allShiftSwapRequests(environment: .develop)
        #expect(stored.first?.responses.first?.status == .available)
    }

}

private struct RecordedShiftSwapCreate {
    let environment: SessionEnvironment
    let requestedShiftId: String
    let reason: String
}

struct ShiftSwapFeedbackScenario {
    let error: ShiftSwapCommandError
    let expectedMessageKey: String
}

private actor AuthoritativeShiftSwapRequestRepository: ShiftSwapRequestRepository {
    private var create: RecordedShiftSwapCreate?

    func allShiftSwapRequests(environment _: SessionEnvironment) -> [ShiftSwapRequest] { [] }

    func transition(
        _ command: ShiftSwapCommand,
        environment: SessionEnvironment
    ) throws -> ShiftSwapTransitionResult {
        guard case .create(let requestedShiftId, let reason) = command else {
            throw ShiftSwapCommandError.invalidData
        }
        create = RecordedShiftSwapCreate(
            environment: environment,
            requestedShiftId: requestedShiftId,
            reason: reason
        )
        return ShiftSwapTransitionResult(requestId: "swap_server", candidateCount: 1)
    }

    func recordedCreate() -> RecordedShiftSwapCreate? { create }
}

private actor FailingShiftSwapRequestRepository: ShiftSwapRequestRepository {
    private let error: ShiftSwapCommandError

    init(error: ShiftSwapCommandError) {
        self.error = error
    }

    func allShiftSwapRequests(environment _: SessionEnvironment) -> [ShiftSwapRequest] { [] }

    func transition(
        _ command: ShiftSwapCommand,
        environment _: SessionEnvironment
    ) throws -> ShiftSwapTransitionResult {
        throw error
    }
}
