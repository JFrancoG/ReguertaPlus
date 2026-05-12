import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsViewModelTests {
    @Test
    func shiftsViewModelLoadsVisibleShiftsAndResetsWhenSignedOut() async {
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
            )
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember, otherMember],
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: requestRepository
        )

        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await waitForCondition { viewModel.shiftsFeed.count == 2 }

        #expect(viewModel.shiftSwapRequests.map(\.id) == ["visible_request"])
        #expect(viewModel.nextDeliveryShift?.id == requestedShift.id)

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)

        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.shiftSwapRequests.isEmpty)
        #expect(viewModel.nextDeliveryShift == nil)
    }

    @Test
    func shiftsViewModelComputesNextShiftsAndRespondsToNowOverride() async {
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

    @Test
    func shiftsViewModelFiltersBoardSegmentAndAppliesDeliveryCalendarOverrides() async {
        let currentMember = adminMember(id: "admin_1", displayName: "Admin")
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
        let override = buildDeliveryCalendarOverride(
            weekKey: delivery.weekKey,
            weekday: .friday,
            updatedByUserId: currentMember.id,
            updatedAtMillis: 10
        )
        let calendarRepository = InMemoryDeliveryCalendarRepository(defaultDay: .wednesday)
        if let override {
            _ = await calendarRepository.upsertOverride(override)
        }
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [delivery, market]),
            deliveryCalendarRepository: calendarRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )

        await viewModel.refreshShifts()
        await viewModel.refreshDeliveryCalendar()

        #expect(viewModel.visibleShifts.map(\.id) == [delivery.id])
        #expect(viewModel.effectiveDateMillis(for: delivery).deliveryWeekday == .friday)

        viewModel.selectedShiftSegment = .market

        #expect(viewModel.visibleShifts.map(\.id) == [market.id])
    }

    @Test
    func shiftsViewModelBlocksSwapRequestWithoutCandidates() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let requestedShift = shift(
            id: "delivery_requested",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 20),
            assignedUserIds: [currentMember.id]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [requestedShift]),
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()

        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        let saved = await viewModel.saveShiftSwapRequest()

        #expect(saved == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackShiftSwapNoCandidates)
    }

    @Test
    func shiftsViewModelCreatesSwapRequestAndNotifiesCandidates() async {
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
        let requestRepository = InMemoryShiftSwapRequestRepository()
        let notificationRepository = RecordingNotificationRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: requester,
            members: [requester, candidate],
            shiftRepository: InMemoryShiftRepository(items: [requestedShift, candidateShift]),
            shiftSwapRequestRepository: requestRepository,
            notificationRepository: notificationRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 1) }
        )
        await viewModel.refreshShifts()

        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        viewModel.updateShiftSwapDraft { $0.reason = "No puedo ir" }
        let saved = await viewModel.saveShiftSwapRequest()
        let requests = await requestRepository.allShiftSwapRequests()
        let events = await notificationRepository.sentEvents()

        #expect(saved)
        #expect(requests.first?.requestedShiftId == requestedShift.id)
        #expect(requests.first?.reason == "No puedo ir")
        #expect(requests.first?.candidates == [ShiftSwapCandidate(userId: candidate.id, shiftId: candidateShift.id)])
        #expect(events.first?.type == "shift_swap_requested")
        #expect(events.first?.userIds == [candidate.id])
        #expect(viewModel.shiftSwapDraft == ShiftSwapDraft())
    }

    @Test
    func shiftsViewModelAcceptsCandidateResponseAndPersistsIt() async {
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
        let requestRepository = InMemoryShiftSwapRequestRepository()
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "swap_1",
                requestedShiftId: requestedShift.id,
                requesterUserId: requester.id,
                candidates: [ShiftSwapCandidate(userId: candidate.id, shiftId: candidateShift.id)]
            )
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

        let stored = await requestRepository.allShiftSwapRequests()
        #expect(stored.first?.responses.first?.status == .available)
    }

}
