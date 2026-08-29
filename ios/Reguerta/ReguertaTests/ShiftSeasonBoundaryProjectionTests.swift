import Testing

@testable import Reguerta

@MainActor
struct ShiftSeasonBoundaryProjectionTests {
    @Test func boardAndUpcomingRolesContinueAcrossSeptemberBoundary() async {
        let currentMember = shiftMember(id: "member_1", displayName: "Carmen")
        let priorSeasonDelivery = shift(
            id: "delivery_2026_08_26",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 8, day: 26),
            assignedUserIds: ["member_2"]
        )
        let nextSeasonDelivery = shift(
            id: "delivery_2026_09_02",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 9, day: 2),
            assignedUserIds: [currentMember.id]
        )
        let laterDelivery = shift(
            id: "delivery_2026_09_09",
            type: .delivery,
            dateMillis: testMillis(year: 2026, month: 9, day: 9),
            assignedUserIds: ["member_3"]
        )
        let nextSeasonMarket = shift(
            id: "market_2026_09_19",
            type: .market,
            dateMillis: testMillis(year: 2026, month: 9, day: 19),
            assignedUserIds: ["member_4", currentMember.id, "member_5"]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftRepository: InMemoryShiftRepository(
                items: [laterDelivery, nextSeasonMarket, nextSeasonDelivery, priorSeasonDelivery]
            ),
            nowMillisProvider: { testMillis(year: 2026, month: 8, day: 27) }
        )

        await viewModel.refreshShifts()

        #expect(viewModel.deliveryShifts.map(\.id) == [
            priorSeasonDelivery.id,
            nextSeasonDelivery.id,
            laterDelivery.id
        ])
        #expect(viewModel.nextDeliveryLeadShift?.id == nextSeasonDelivery.id)
        #expect(viewModel.nextDeliveryHelperShift?.id == priorSeasonDelivery.id)
        #expect(viewModel.resolvedHelperUserId(for: priorSeasonDelivery) == currentMember.id)
        #expect(viewModel.nextMarketAssignedShift?.id == nextSeasonMarket.id)
        #expect(viewModel.shiftBoardWindow(for: .delivery).highlightedShiftId == nextSeasonDelivery.id)
    }
}
