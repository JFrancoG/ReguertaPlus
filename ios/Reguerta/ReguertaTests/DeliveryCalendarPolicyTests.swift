import Foundation
import Testing

@testable import Reguerta

@Suite("Delivery Calendar Madrid policy")
struct DeliveryCalendarPolicyTests {
    @Test func allowedExceptionWeekdaysMatchTheProductContract() {
        #expect(DeliveryWeekday.calendarExceptionCases == [.tuesday, .thursday, .friday])
    }

    @Test(arguments: DeliveryCalendarWindowScenario.cases)
    func overrideUsesMadridBusinessInstants(_ scenario: DeliveryCalendarWindowScenario) throws {
        let override = try #require(
            DeliveryCalendarOverride.weeklyException(
                weekKey: scenario.weekKey,
                weekday: scenario.weekday,
                updatedByUserId: "admin_1",
                updatedAtMillis: 42
            )
        )

        #expect(override.weekKey == scenario.weekKey)
        #expect(override.deliveryDateMillis == scenario.deliveryDateMillis)
        #expect(override.ordersBlockedDateMillis == scenario.ordersBlockedDateMillis)
        #expect(override.ordersOpenAtMillis == scenario.ordersOpenAtMillis)
        #expect(override.ordersCloseAtMillis == scenario.ordersCloseAtMillis)
        #expect(override.updatedBy == "admin_1")
        #expect(override.updatedAtMillis == 42)
    }

    @Test(arguments: [
        "2026-W1",
        "2026-W00",
        "2026-W54",
        "2021-W53",
        "2026-W020",
        "2026W20",
        "2026-w20",
        " 2026-W20 "
    ])
    func malformedOrImpossibleISOWeekKeysAreRejected(_ weekKey: String) {
        #expect(
            DeliveryCalendarOverride.weeklyException(
                weekKey: weekKey,
                weekday: .friday,
                updatedByUserId: "admin_1",
                updatedAtMillis: 42
            ) == nil
        )
    }

    @Test(arguments: [
        DeliveryWeekday.monday,
        .wednesday,
        .saturday,
        .sunday
    ])
    func unsupportedExceptionWeekdaysAreRejected(_ weekday: DeliveryWeekday) {
        #expect(
            DeliveryCalendarOverride.weeklyException(
                weekKey: "2026-W20",
                weekday: weekday,
                updatedByUserId: "admin_1",
                updatedAtMillis: 42
            ) == nil
        )
    }

    @Test func calendarPolicySourceHasNoDeviceTimezoneAuthority() throws {
        let sourceRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Reguerta")
        let calendarSource = try combinedSwiftSource(in: sourceRoot.appendingPathComponent("Domain/Calendar"))
        let loadingSource = try String(
            contentsOf: sourceRoot.appendingPathComponent("Presentation/Shifts/ShiftsFeatureViewModel+Loading.swift"),
            encoding: .utf8
        )
        let policySource = calendarSource + loadingSource

        #expect(calendarSource.contains("Europe/Madrid"))
        #expect(loadingSource.contains("DeliveryCalendarOverride.weeklyException"))
        #expect(!policySource.contains("Calendar.current"))
        #expect(!policySource.contains("TimeZone.current"))
        #expect(!policySource.contains("timeZone = .current"))
    }

    private func combinedSwiftSource(in directory: URL) throws -> String {
        let fileURLs = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )
        return try fileURLs
            .filter { $0.pathExtension == "swift" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .map { try String(contentsOf: $0, encoding: .utf8) }
            .joined(separator: "\n")
    }
}

struct DeliveryCalendarWindowScenario {
    let weekKey: String
    let weekday: DeliveryWeekday
    let deliveryDateMillis: Int64
    let ordersBlockedDateMillis: Int64
    let ordersOpenAtMillis: Int64
    let ordersCloseAtMillis: Int64
}

extension DeliveryCalendarWindowScenario {
    static let cases = [
        DeliveryCalendarWindowScenario(
            weekKey: "2026-W20",
            weekday: .tuesday,
            deliveryDateMillis: 1_778_536_800_000,
            ordersBlockedDateMillis: 1_778_623_200_000,
            ordersOpenAtMillis: 1_778_709_600_000,
            ordersCloseAtMillis: 1_779_055_199_000
        ),
        DeliveryCalendarWindowScenario(
            weekKey: "2026-W20",
            weekday: .thursday,
            deliveryDateMillis: 1_778_709_600_000,
            ordersBlockedDateMillis: 1_778_796_000_000,
            ordersOpenAtMillis: 1_778_882_400_000,
            ordersCloseAtMillis: 1_779_055_199_000
        ),
        DeliveryCalendarWindowScenario(
            weekKey: "2026-W20",
            weekday: .friday,
            deliveryDateMillis: 1_778_796_000_000,
            ordersBlockedDateMillis: 1_778_882_400_000,
            ordersOpenAtMillis: 1_778_968_800_000,
            ordersCloseAtMillis: 1_779_055_199_000
        ),
        DeliveryCalendarWindowScenario(
            weekKey: "2026-W13",
            weekday: .friday,
            deliveryDateMillis: 1_774_566_000_000,
            ordersBlockedDateMillis: 1_774_652_400_000,
            ordersOpenAtMillis: 1_774_738_800_000,
            ordersCloseAtMillis: 1_774_821_599_000
        ),
        DeliveryCalendarWindowScenario(
            weekKey: "2026-W43",
            weekday: .friday,
            deliveryDateMillis: 1_792_706_400_000,
            ordersBlockedDateMillis: 1_792_792_800_000,
            ordersOpenAtMillis: 1_792_879_200_000,
            ordersCloseAtMillis: 1_792_969_199_000
        ),
        DeliveryCalendarWindowScenario(
            weekKey: "2026-W01",
            weekday: .friday,
            deliveryDateMillis: 1_767_308_400_000,
            ordersBlockedDateMillis: 1_767_394_800_000,
            ordersOpenAtMillis: 1_767_481_200_000,
            ordersCloseAtMillis: 1_767_567_599_000
        ),
        DeliveryCalendarWindowScenario(
            weekKey: "2020-W53",
            weekday: .friday,
            deliveryDateMillis: 1_609_455_600_000,
            ordersBlockedDateMillis: 1_609_542_000_000,
            ordersOpenAtMillis: 1_609_628_400_000,
            ordersCloseAtMillis: 1_609_714_799_000
        )
    ]
}
