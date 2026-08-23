import Foundation
import Testing

@testable import Reguerta

private let spanishHomeLocalization = HomeWeeklySummaryLocalization(
    locale: Locale(identifier: "es_ES"),
    weekLabel: "Semana",
    weekRangeAccessibilityFormat: "Del %1$@ al %2$@",
    pendingLabel: "Pendiente"
)

private struct HomeTimeZoneBoundaryFixture {
    let instant: Date
    let nowMillis: Int64
    let shiftMillis: Int64
    let madridTimeZone: TimeZone
    let utcTimeZone: TimeZone
    let shift: ShiftAssignment
}

@MainActor
struct ReguertaHomeSummaryTests {
    @Test func homeWeeklySummaryUsesCurrentWeekBeforeDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 6),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8)],
            members: homeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W19")
        #expect(display.orderWeekKey == "2026-W18")
        #expect(display.weekRangeLabel == "4 may–10 may")
        #expect(display.weekRangeAccessibilityLabel == "Del 4 may al 10 may")
        #expect(display.producerName == "Huerta Sur")
        #expect(display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleLastOrder)
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test func configuredFridayKeepsThursdayInTheCurrentHomeConsultationCycle() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 7, day: 9),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [],
            members: homeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W28")
        #expect(display.orderWeekKey == "2026-W27")
        #expect(display.deliveryLabel == "Vie 10")
        #expect(display.isConsultaPhase)
    }

    @Test func homeUsesTheMadridBusinessDayAtADeviceTimeZoneBoundary() throws {
        let fixture = try homeTimeZoneBoundaryFixture()
        let madridDisplay = homeTimeZoneBoundaryDisplay(fixture, businessTimeZone: fixture.madridTimeZone)
        let defaultDisplay = homeTimeZoneBoundaryDisplay(fixture, businessTimeZone: nil)
        let utcDisplay = homeTimeZoneBoundaryDisplay(fixture, businessTimeZone: fixture.utcTimeZone)
        let orderWindow = resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [],
            shifts: [],
            now: fixture.instant
        )

        #expect(madridDisplay.weekKey == "2026-W29")
        #expect(madridDisplay.orderWeekKey == "2026-W28")
        #expect(madridDisplay.deliveryLabel == "Mié 15")
        #expect(madridDisplay.responsibleName == "Carmen")
        #expect(!madridDisplay.isConsultaPhase)
        #expect(defaultDisplay == madridDisplay)
        #expect(utcDisplay.weekKey == "2026-W28")
        #expect(utcDisplay.deliveryLabel == "Mié 8")
        #expect(utcDisplay.responsibleName == "Carmen")
        #expect(utcDisplay.isConsultaPhase)
        #expect(orderWindow.isConsultaPhase == madridDisplay.isConsultaPhase)
        #expect(fixture.shiftMillis.isoWeekKey == "2026-W29")
        #expect(fixture.shiftMillis.deliveryWeekday == .monday)
        #expect(
            formatHomeTopBarDate(
                nowMillis: fixture.nowMillis,
                locale: Locale(identifier: "en_US"),
                businessTimeZone: fixture.madridTimeZone
            ) == "Thursday, July 9"
        )
        #expect(
            formatHomeTopBarDate(
                nowMillis: fixture.nowMillis,
                locale: Locale(identifier: "en_US"),
                businessTimeZone: fixture.utcTimeZone
            ) == "Wednesday, July 8"
        )
    }

    @Test func homeWeeklySummaryKeepsScheduledProducerWhileVacationModeIsEnabled() {
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
            members: vacationMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.producerName == "Huerta Sur")
    }

    @Test func homeWeeklySummaryMovesToNextWeekAfterDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 9),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [
                testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8),
                testDeliveryShift(id: "delivery_w20", year: 2026, month: 5, day: 15)
            ],
            members: homeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W20")
        #expect(display.orderWeekKey == "2026-W19")
        #expect(display.weekRangeLabel == "11 may–17 may")
        #expect(display.producerName == "Huerta Norte")
        #expect(!display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleEdit)
    }

    @Test func homeWeeklySummaryAfterWednesdayDeliveryUsesNextDeliveryCycleAndCurrentMarket() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 14),
            defaultDeliveryDayOfWeek: .wednesday,
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
            members: may2026HomeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W21")
        #expect(display.orderWeekKey == "2026-W20")
        #expect(display.weekRangeLabel == "18 may–24 may")
        #expect(display.weekBadgeLabel == "Semana 21")
        #expect(display.producerName == "Tito Fernando")
        #expect(display.deliveryLabel == "Mié 20")
        #expect(display.marketLabel == "Sáb 16")
        #expect(display.responsibleName == "Felix")
        #expect(display.helperName == "Ana Belen")
        #expect(display.marketResponsibleNames == ["Valle", "Angeles", "Sandra"])
    }

    @Test func homeWeeklySummaryMarketMovesToNextShiftTheDayAfterMarket() {
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
            members: may2026HomeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W21")
        #expect(display.marketLabel == "Sáb 13")
        #expect(display.marketResponsibleNames == ["Angeles", "Sandra", "Valle"])
    }

    @Test func homeWeeklySummaryUsesWednesdayWhenNoDeliveryCalendarOverrideEvenIfShiftIsLater() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 7, day: 7),
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w28", year: 2026, month: 7, day: 9)],
            members: homeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W28")
        #expect(display.deliveryLabel == "Mié 8")
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test func homeWeeklySummaryUsesDeliveryCalendarOverrideWhenPresent() {
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
            members: homeSummaryMembers,
            localization: spanishHomeLocalization
        )

        #expect(display.weekKey == "2026-W28")
        #expect(display.deliveryLabel == "Jue 9")
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test func homeWeeklySummaryUsesEnglishLocaleAndSkipsSummerMarkets() {
        let nowMillis = testMillis(year: 2026, month: 7, day: 11)
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: nowMillis,
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [],
            shifts: [],
            members: homeSummaryMembers,
            localization: HomeWeeklySummaryLocalization(
                locale: Locale(identifier: "en_US"),
                weekLabel: "Week",
                weekRangeAccessibilityFormat: "From %1$@ to %2$@",
                pendingLabel: "Pending"
            )
        )

        #expect(formatHomeTopBarDate(nowMillis: nowMillis, locale: Locale(identifier: "en_US")) == "Saturday, July 11")
        #expect(display.weekRangeLabel == "Jul 13–Jul 19")
        #expect(display.weekRangeAccessibilityLabel == "From Jul 13 to Jul 19")
        #expect(display.weekBadgeLabel == "Week 29")
        #expect(display.deliveryLabel == "Wed 15")
        #expect(display.marketLabel == "Sep 19")
        #expect(display.responsibleName == "Pending")
        #expect(display.helperName == "Pending")
        #expect(display.marketResponsibleNames == ["Pending"])
    }

    @Test func homeOrderStateMappingUsesTheDomainLocalState() {
        #expect(resolveHomeOrderState(.empty) == .notStarted)
        #expect(resolveHomeOrderState(.draft) == .unconfirmed)
        #expect(resolveHomeOrderState(.confirmed) == .completed)
    }

    @Test func homeDisplayedOrderStateUsesConsultationBeforeDelivery() {
        #expect(resolveHomeDisplayedOrderState(isConsultaPhase: true, orderState: .notStarted) == .consultation)
        #expect(resolveHomeDisplayedOrderState(isConsultaPhase: true, orderState: .unconfirmed) == .consultation)
        #expect(resolveHomeDisplayedOrderState(isConsultaPhase: false, orderState: .notStarted) == .notStarted)
    }
}

private func homeTimeZoneBoundaryFixture() throws -> HomeTimeZoneBoundaryFixture {
    var utcCalendar = Calendar(identifier: .gregorian)
    utcCalendar.timeZone = try #require(TimeZone(secondsFromGMT: 0))
    let instant = try #require(
        utcCalendar.date(from: DateComponents(year: 2026, month: 7, day: 8, hour: 22, minute: 30))
    )
    let shiftInstant = try #require(
        utcCalendar.date(from: DateComponents(year: 2026, month: 7, day: 12, hour: 22, minute: 30))
    )
    let shiftMillis = Int64(shiftInstant.timeIntervalSince1970 * 1_000)
    return HomeTimeZoneBoundaryFixture(
        instant: instant,
        nowMillis: Int64(instant.timeIntervalSince1970 * 1_000),
        shiftMillis: shiftMillis,
        madridTimeZone: try #require(TimeZone(identifier: "Europe/Madrid")),
        utcTimeZone: utcCalendar.timeZone,
        shift: ShiftAssignment(
            id: "delivery_boundary",
            type: .delivery,
            dateMillis: shiftMillis,
            assignedUserIds: ["member_1"],
            helperUserId: "member_2",
            status: .confirmed,
            source: "test",
            createdAtMillis: 0,
            updatedAtMillis: 0
        )
    )
}

private func homeTimeZoneBoundaryDisplay(
    _ fixture: HomeTimeZoneBoundaryFixture,
    businessTimeZone: TimeZone?
) -> HomeWeeklySummaryDisplay {
    if let businessTimeZone {
        return resolveHomeWeeklySummaryDisplay(
            nowMillis: fixture.nowMillis,
            defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [],
            shifts: [fixture.shift],
            members: homeSummaryMembers,
            businessTimeZone: businessTimeZone,
            localization: spanishHomeLocalization
        )
    }
    return resolveHomeWeeklySummaryDisplay(
        nowMillis: fixture.nowMillis,
        defaultDeliveryDayOfWeek: .wednesday,
        deliveryCalendarOverrides: [],
        shifts: [fixture.shift],
        members: homeSummaryMembers,
        localization: spanishHomeLocalization
    )
}
