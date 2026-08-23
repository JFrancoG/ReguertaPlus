import Foundation
import Testing

@testable import Reguerta

@Suite("Order consultation-window policy")
struct OrderConsultaWindowPolicyTests {
    @Test func configuredFridayKeepsThursdayInConsultationPhaseWithoutOverride() throws {
        let now = try madridDate(year: 2026, month: 7, day: 9)

        let window = resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [],
            now: now
        )

        #expect(window.isConsultaPhase)
        #expect(window.previousWeekKey == "2026-W27")
    }

    @Test func receivedOrdersUsesTheConfiguredFridayConsultationWindow() throws {
        let now = try madridDate(year: 2026, month: 7, day: 9)

        let window = resolveReceivedOrdersWindow(
            nowMillis: Int64(now.timeIntervalSince1970 * 1_000),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: []
        )

        #expect(window.isEnabled)
        #expect(window.targetWeekKey == "2026-W27")
    }

    @Test func missingConfigurationFallsBackToWednesday() throws {
        let now = try madridDate(year: 2026, month: 7, day: 9)

        let window = resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: nil,
            deliveryCalendarOverrides: [],
            shifts: [],
            now: now
        )

        #expect(!window.isConsultaPhase)
        #expect(window.previousWeekKey == "2026-W27")
    }

    @Test func shiftWeekKeyUsesTheSharedMadridAuthorityAtAUTCWeekBoundary() throws {
        let boundaryDate = try utcDate(year: 2026, month: 7, day: 12, hour: 22, minute: 30)
        let boundaryMillis = Int64(boundaryDate.timeIntervalSince1970 * 1_000)
        let shift = ShiftAssignment(
            id: "delivery_boundary",
            type: .delivery,
            dateMillis: boundaryMillis,
            assignedUserIds: ["member_1"],
            helperUserId: nil,
            status: .planned,
            source: "test",
            createdAtMillis: boundaryMillis,
            updatedAtMillis: boundaryMillis
        )
        let override = DeliveryCalendarOverride(
            weekKey: "2026-W29",
            deliveryDateMillis: boundaryMillis,
            ordersBlockedDateMillis: boundaryMillis,
            ordersOpenAtMillis: boundaryMillis,
            ordersCloseAtMillis: boundaryMillis,
            updatedBy: "member_1",
            updatedAtMillis: boundaryMillis
        )
        let sourceRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Reguerta")
        let presentationSource = try String(
            contentsOf: sourceRoot.appendingPathComponent("Presentation/Root/ContentView+DomainSupport.swift"),
            encoding: .utf8
        )
        let shiftSource = try String(
            contentsOf: sourceRoot.appendingPathComponent("Domain/Shifts/ShiftAssignment.swift"),
            encoding: .utf8
        )

        #expect(!presentationSource.contains("var weekKey: String"))
        #expect(shiftSource.contains("var weekKey: String"))
        #expect(shiftSource.contains("dateMillis.isoWeekKey"))
        #expect(boundaryMillis.isoWeekKey == "2026-W29")
        #expect(shift.weekKey == boundaryMillis.isoWeekKey)
        #expect([override].first(where: { $0.weekKey == shift.weekKey }) == override)
    }

    @Test func producerParityUsesTheSharedMadridWeekAtAUTCWeekBoundary() throws {
        let boundaryDate = try utcDate(year: 2026, month: 7, day: 12, hour: 22, minute: 30)
        let boundaryMillis = Int64(boundaryDate.timeIntervalSince1970 * 1_000)
        let sourceRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Reguerta")
        let parityPolicySource = try String(
            contentsOf: sourceRoot.appendingPathComponent("Domain/Orders/OrderProducerParityPolicy.swift"),
            encoding: .utf8
        )
        let presentationSource = try combinedSwiftSource(
            in: sourceRoot.appendingPathComponent("Presentation/Orders")
        )

        #expect(parityPolicySource.contains("func producerParityForISOWeek"))
        #expect(parityPolicySource.contains("BusinessCalendar.make()"))
        #expect(!parityPolicySource.contains(".current"))
        #expect(!presentationSource.contains("func producerParityForISOWeek"))
        #expect(boundaryMillis.isoWeekKey == "2026-W29")
        #expect(producerParityForISOWeek(nowMillis: boundaryMillis) == .odd)
    }

    private func madridDate(year: Int, month: Int, day: Int) throws -> Date {
        var dateComponents = DateComponents()
        dateComponents.calendar = Calendar(identifier: .gregorian)
        dateComponents.timeZone = TimeZone(identifier: "Europe/Madrid")
        dateComponents.year = year
        dateComponents.month = month
        dateComponents.day = day
        return try #require(dateComponents.date)
    }

    private func utcDate(year: Int, month: Int, day: Int, hour: Int, minute: Int) throws -> Date {
        var dateComponents = DateComponents()
        dateComponents.calendar = Calendar(identifier: .gregorian)
        dateComponents.timeZone = TimeZone(secondsFromGMT: 0)
        dateComponents.year = year
        dateComponents.month = month
        dateComponents.day = day
        dateComponents.hour = hour
        dateComponents.minute = minute
        return try #require(dateComponents.date)
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
