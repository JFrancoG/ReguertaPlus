import Testing

@testable import Reguerta

@MainActor
struct ReguertaShiftsPresentationViewModelTests {
    @Test
    func shiftsViewModelComputesNextShiftPresentationByRoleAndMarketAssignment() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let leadDelivery = shift(
            id: "lead_delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 8),
            assignedUserIds: [currentMember.id]
        )
        let helperDelivery = shift(
            id: "helper_delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 1),
            assignedUserIds: ["member_2"]
        )
        let market = shift(
            id: "market_assigned",
            type: .market,
            dateMillis: testMillis(year: 2026, month: 5, day: 10),
            assignedUserIds: ["member_3", currentMember.id]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [leadDelivery, helperDelivery, market]),
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 2) }
        )

        await viewModel.refreshShifts()

        #expect(viewModel.nextDeliveryLeadShift?.id == leadDelivery.id)
        #expect(viewModel.nextDeliveryHelperShift?.id == helperDelivery.id)
        #expect(viewModel.nextMarketAssignedShift?.id == market.id)
    }

    @Test
    func shiftsViewModelDerivesTodayHelperFromFollowingLeadShift() async {
        let currentMember = shiftMember(id: "nohemi", displayName: "Nohemi")
        let helperDelivery = shift(
            id: "delivery_2026_w28",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 7, day: 8),
            assignedUserIds: ["mercedes"]
        )
        let leadDelivery = shift(
            id: "delivery_2026_w29",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 7, day: 15),
            assignedUserIds: [currentMember.id]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [helperDelivery, leadDelivery]),
            nowMillisProvider: { testMillis(year: 2026, month: 7, day: 10) + 15 * 60 * 60 * 1_000 }
        )

        await viewModel.refreshShifts()

        #expect(viewModel.nextDeliveryHelperShift?.id == helperDelivery.id)
        #expect(viewModel.nextDeliveryLeadShift?.id == leadDelivery.id)
        #expect(viewModel.resolvedHelperUserId(for: helperDelivery) == currentMember.id)
        #expect(viewModel.boardNames(for: helperDelivery).last == currentMember.displayName)
        #expect(viewModel.highlightedBoardNameIndex(for: helperDelivery, currentMemberId: currentMember.id) == 1)
    }

    @Test
    func shiftsViewModelUsesFollowingLeadOverPersistedHelperForBoardNames() async {
        let currentMember = shiftMember(id: "nohemi", displayName: "Nohemi")
        let followingLead = shiftMember(id: "pedro", displayName: "Pedro")
        let delivery = shift(
            id: "delivery_2026_w29",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 7, day: 15),
            assignedUserIds: [currentMember.id],
            helperUserId: "stale_helper"
        )
        let nextDelivery = shift(
            id: "delivery_2026_w30",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 7, day: 22),
            assignedUserIds: [followingLead.id],
            helperUserId: "stale_last_helper"
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember, followingLead],
            shiftRepository: InMemoryShiftRepository(items: [delivery, nextDelivery]),
            nowMillisProvider: { testMillis(year: 2026, month: 7, day: 10) }
        )

        await viewModel.refreshShifts()

        #expect(viewModel.resolvedHelperUserId(for: delivery) == followingLead.id)
        #expect(viewModel.boardNames(for: delivery).last == followingLead.displayName)
        #expect(viewModel.resolvedHelperUserId(for: nextDelivery) == nil)
    }

    @Test
    func shiftsViewModelBoardWindowUsesEffectiveDeliveryDates() async {
        let currentMember = adminMember(id: "admin_1", displayName: "Admin")
        let previousDelivery = shift(
            id: "previous_delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 4, day: 29),
            assignedUserIds: [currentMember.id]
        )
        let shiftedDelivery = shift(
            id: "shifted_delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 6),
            assignedUserIds: [currentMember.id]
        )
        let override = buildDeliveryCalendarOverride(
            weekKey: shiftedDelivery.weekKey,
            weekday: .sunday,
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
            shiftRepository: InMemoryShiftRepository(items: [previousDelivery, shiftedDelivery]),
            deliveryCalendarRepository: calendarRepository,
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 8) }
        )

        await viewModel.refreshShifts()
        await viewModel.refreshDeliveryCalendar()

        #expect(viewModel.nextDeliveryLeadShift?.id == shiftedDelivery.id)
        #expect(viewModel.shiftBoardWindow(for: .delivery).highlightedShiftId == shiftedDelivery.id)
        #expect(!viewModel.shiftBoardWindow(for: .delivery).highlights(previousDelivery))
        #expect(viewModel.shiftBoardWindow(for: .delivery).highlights(shiftedDelivery))
        #expect(viewModel.shiftBoardWindow(for: .delivery).targetShiftId == shiftedDelivery.id)

        await assertTodayDeliveryWinsBoardWindow(for: currentMember)
    }

    private func assertTodayDeliveryWinsBoardWindow(for currentMember: Member) async {
        let todayDelivery = shift(
            id: "today_delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 8),
            assignedUserIds: [currentMember.id]
        )
        let tomorrowDelivery = shift(
            id: "tomorrow_delivery",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 5, day: 9),
            assignedUserIds: [currentMember.id]
        )
        let todayViewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(items: [todayDelivery, tomorrowDelivery]),
            nowMillisProvider: { testMillis(year: 2026, month: 5, day: 8) + 15 * 60 * 60 * 1_000 }
        )

        await todayViewModel.refreshShifts()

        #expect(todayViewModel.shiftBoardWindow(for: .delivery).highlightedShiftId == todayDelivery.id)
        #expect(todayViewModel.shiftBoardWindow(for: .delivery).highlights(todayDelivery))
        #expect(!todayViewModel.shiftBoardWindow(for: .delivery).highlights(tomorrowDelivery))
    }

    @Test
    func shiftsViewModelShowsSwapActivityAcrossDeliveryAndMarket() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let otherMember = shiftMember(id: "member_2", displayName: "Javier")
        let requestRepository = InMemoryShiftSwapRequestRepository()
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "incoming_delivery",
                requestedShiftId: "delivery_1",
                requesterUserId: otherMember.id,
                candidates: [ShiftSwapCandidate(userId: currentMember.id, shiftId: "delivery_2")]
            )
        )
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "outgoing_market",
                requestedShiftId: "market_1",
                requesterUserId: currentMember.id,
                candidates: [ShiftSwapCandidate(userId: otherMember.id, shiftId: "market_2")]
            )
        )
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "dismissed_history",
                requestedShiftId: "market_3",
                requesterUserId: currentMember.id,
                candidates: [],
                status: .applied
            )
        )
        _ = await requestRepository.upsert(
            request: shiftSwapRequest(
                id: "unrelated_history",
                requestedShiftId: "market_4",
                requesterUserId: "member_5",
                candidates: [ShiftSwapCandidate(userId: "member_6", shiftId: "market_5")],
                status: .applied
            )
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember, otherMember],
            shiftSwapRequestRepository: requestRepository
        )

        await viewModel.refreshShifts()
        viewModel.dismissedShiftSwapRequestIds = ["dismissed_history"]

        #expect(viewModel.hasVisibleShiftSwapActivity)
        #expect(viewModel.visibleShiftSwapActivity.incoming.map { $0.0.id } == ["incoming_delivery"])
        #expect(viewModel.visibleShiftSwapActivity.outgoing.map(\.id) == ["outgoing_market"])
        #expect(viewModel.visibleShiftSwapActivity.history.isEmpty)
    }
}
