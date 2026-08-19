import Foundation

protocol DeliveryCalendarRepository: Sendable {
    func defaultDeliveryDayOfWeek(environment: SessionEnvironment) async throws -> DeliveryWeekday
    func allOverrides(environment: SessionEnvironment) async throws -> [DeliveryCalendarOverride]
    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride
    func deleteOverride(weekKey: String, environment: SessionEnvironment) async throws
}
