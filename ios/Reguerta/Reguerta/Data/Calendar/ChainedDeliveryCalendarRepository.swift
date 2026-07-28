import Foundation

struct ChainedDeliveryCalendarRepository: DeliveryCalendarRepository {
    let primary: any DeliveryCalendarRepository
    let fallback: any DeliveryCalendarRepository

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
