import Foundation

struct ChainedDeliveryCalendarRepository: DeliveryCalendarRepository {
    let primary: any DeliveryCalendarRepository
    let fallback: any DeliveryCalendarRepository

    func defaultDeliveryDayOfWeek() async -> DeliveryWeekday? {
        if let primaryValue = await primary.defaultDeliveryDayOfWeek() {
            return primaryValue
        }
        return await fallback.defaultDeliveryDayOfWeek()
    }

    func allOverrides() async -> [DeliveryCalendarOverride] {
        let primaryOverrides = await primary.allOverrides()
        return primaryOverrides.isEmpty ? await fallback.allOverrides() : primaryOverrides
    }

    func upsertOverride(_ override: DeliveryCalendarOverride) async -> DeliveryCalendarOverride {
        let persisted = await primary.upsertOverride(override)
        _ = await fallback.upsertOverride(persisted)
        return persisted
    }

    func deleteOverride(weekKey: String) async {
        await primary.deleteOverride(weekKey: weekKey)
        await fallback.deleteOverride(weekKey: weekKey)
    }
}
