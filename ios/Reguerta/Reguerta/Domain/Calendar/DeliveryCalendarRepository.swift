import Foundation

protocol DeliveryCalendarRepository: Sendable {
    func defaultDeliveryDayOfWeek() async -> DeliveryWeekday?
    func allOverrides() async -> [DeliveryCalendarOverride]
    func upsertOverride(_ override: DeliveryCalendarOverride) async throws -> DeliveryCalendarOverride
    func deleteOverride(weekKey: String) async throws
}
