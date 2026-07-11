import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaHomeSummaryTests {
    @Test
    func homeWeeklySummaryUsesCurrentWeekBeforeDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 6),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8)],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W19")
        #expect(display.orderWeekKey == "2026-W18")
        #expect(display.weekRangeLabel == "4 may - 10 may")
        #expect(display.producerName == "Huerta Sur")
        #expect(display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleLastOrder)
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test
    func homeWeeklySummaryKeepsScheduledProducerWhileVacationModeIsEnabled() {
        let vacationMembers = homeSummaryMembers.map { member in
            guard member.id == "producer_2" else { return member }
            return Member(
                id: member.id,
                displayName: member.displayName,
                companyName: member.companyName,
                phoneNumber: member.phoneNumber,
                normalizedEmail: member.normalizedEmail,
                authUid: member.authUid,
                roles: member.roles,
                isActive: member.isActive,
                producerCatalogEnabled: false,
                isCommonPurchaseManager: member.isCommonPurchaseManager,
                producerParity: member.producerParity,
                ecoCommitmentMode: member.ecoCommitmentMode,
                ecoCommitmentParity: member.ecoCommitmentParity
            )
        }
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 6),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8)],
            members: vacationMembers
        )

        #expect(display.producerName == "Huerta Sur")
    }

    @Test
    func homeWeeklySummaryMovesToNextWeekAfterDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 9),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [
                testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8),
                testDeliveryShift(id: "delivery_w20", year: 2026, month: 5, day: 15)
            ],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W20")
        #expect(display.orderWeekKey == "2026-W19")
        #expect(display.weekRangeLabel == "11 may - 17 may")
        #expect(display.producerName == "Huerta Norte")
        #expect(!display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleEdit)
    }

    @Test
    func homeWeeklySummaryAfterWednesdayDeliveryUsesNextDeliveryCycleAndCurrentMarket() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 14),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [
                testDeliveryShift(id: "delivery_w20", year: 2026, month: 5, day: 13),
                testDeliveryShift(
                    id: "delivery_w21",
                    year: 2026,
                    month: 5,
                    day: 20,
                    assignedUserIds: ["felix"],
                    helperUserId: "ana_belen"
                ),
                testMarketShift(
                    id: "market_w20",
                    year: 2026,
                    month: 5,
                    day: 16,
                    assignedUserIds: ["valle", "angeles", "sandra"]
                )
            ],
            members: may2026HomeSummaryMembers
        )

        #expect(display.weekKey == "2026-W21")
        #expect(display.orderWeekKey == "2026-W20")
        #expect(display.weekRangeLabel == "18 may - 24 may")
        #expect(display.weekBadgeLabel == "Semana 21")
        #expect(display.producerName == "Tito Fernando")
        #expect(display.deliveryLabel == "Mié 20")
        #expect(display.marketLabel == "Sáb 16")
        #expect(display.responsibleName == "Felix")
        #expect(display.helperName == "Ana Belen")
        #expect(display.marketResponsibleNames == ["Valle", "Angeles", "Sandra"])
    }

    @Test
    func homeWeeklySummaryMarketMovesToNextShiftTheDayAfterMarket() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 17),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [
                testDeliveryShift(id: "delivery_w20", year: 2026, month: 5, day: 13),
                testDeliveryShift(id: "delivery_w21", year: 2026, month: 5, day: 20),
                testMarketShift(
                    id: "market_w20",
                    year: 2026,
                    month: 5,
                    day: 16,
                    assignedUserIds: ["valle", "angeles", "sandra"]
                ),
                testMarketShift(
                    id: "market_w24",
                    year: 2026,
                    month: 6,
                    day: 13,
                    assignedUserIds: ["angeles", "sandra", "valle"]
                )
            ],
            members: may2026HomeSummaryMembers
        )

        #expect(display.weekKey == "2026-W21")
        #expect(display.marketLabel == "Sáb 13")
        #expect(display.marketResponsibleNames == ["Angeles", "Sandra", "Valle"])
    }

    @Test
    func homeWeeklySummaryUsesWednesdayWhenNoDeliveryCalendarOverrideEvenIfShiftIsLater() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 7, day: 7),
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w28", year: 2026, month: 7, day: 9)],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W28")
        #expect(display.deliveryLabel == "Mié 8")
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test
    func homeWeeklySummaryUsesDeliveryCalendarOverrideWhenPresent() {
        let override = DeliveryCalendarOverride(
            weekKey: "2026-W28",
            deliveryDateMillis: testMillis(year: 2026, month: 7, day: 9),
            ordersBlockedDateMillis: testMillis(year: 2026, month: 7, day: 9),
            ordersOpenAtMillis: testMillis(year: 2026, month: 7, day: 9),
            ordersCloseAtMillis: testMillis(year: 2026, month: 7, day: 9),
            updatedBy: "test",
            updatedAtMillis: 0
        )
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 7, day: 7),
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [override],
            shifts: [testDeliveryShift(id: "delivery_w28", year: 2026, month: 7, day: 9)],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W28")
        #expect(display.deliveryLabel == "Jue 9")
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test
    func homeOrderStateMappingUsesConfirmedBeforeDraft() {
        let suiteName = "home-order-state-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let cartKey = "reguerta_my_order_cart.member_member_1_week_2026-W19.quantities"
        let confirmedKey = "reguerta_my_order_cart.member_member_1_week_2026-W19.confirmed_quantities"

        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .notStarted)
        defaults.set(["product_1": 2], forKey: cartKey)
        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .unconfirmed)
        defaults.set(["product_1": 2], forKey: confirmedKey)
        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .completed)
    }

    @Test
    func homeDisplayedOrderStateUsesConsultationBeforeDelivery() {
        #expect(resolveHomeDisplayedOrderState(isConsultaPhase: true, orderState: .notStarted) == .consultation)
        #expect(resolveHomeDisplayedOrderState(isConsultaPhase: true, orderState: .unconfirmed) == .consultation)
        #expect(resolveHomeDisplayedOrderState(isConsultaPhase: false, orderState: .notStarted) == .notStarted)
    }
}
