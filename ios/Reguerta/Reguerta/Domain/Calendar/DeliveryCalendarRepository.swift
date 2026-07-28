import Foundation

protocol DeliveryCalendarRepository: Sendable {
    func defaultDeliveryDayOfWeek() async throws -> DeliveryWeekday
    func allOverrides() async throws -> [DeliveryCalendarOverride]
    func upsertOverride(_ override: DeliveryCalendarOverride) async throws -> DeliveryCalendarOverride
    func deleteOverride(weekKey: String) async throws
}
