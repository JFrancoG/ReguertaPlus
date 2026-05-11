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
        #expect(display.weekRangeLabel == "4 may - 10 may")
        #expect(display.producerName == "Huerta Sur")
        #expect(display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleLastOrder)
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
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
        #expect(display.weekRangeLabel == "11 may - 17 may")
        #expect(display.producerName == "Huerta Norte")
        #expect(!display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleEdit)
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
}
