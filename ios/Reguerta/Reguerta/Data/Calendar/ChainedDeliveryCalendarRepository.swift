import Foundation

struct ChainedDeliveryCalendarRepository<Primary: DeliveryCalendarRepository, Fallback: DeliveryCalendarRepository>:
    DeliveryCalendarRepository {
    let primary: Primary
    let fallback: Fallback

    func defaultDeliveryDayOfWeek() async throws -> DeliveryWeekday {
        try await primary.defaultDeliveryDayOfWeek()
    }

    func allOverrides() async throws -> [DeliveryCalendarOverride] {
        try await primary.allOverrides()
    }

    func upsertOverride(_ override: DeliveryCalendarOverride) async throws -> DeliveryCalendarOverride {
        try await primary.upsertOverride(override)
    }

    func deleteOverride(weekKey: String) async throws {
        try await primary.deleteOverride(weekKey: weekKey)
    }
}
