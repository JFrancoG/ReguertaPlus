import Foundation

actor InMemoryDeliveryCalendarRepository: DeliveryCalendarRepository {
    private let defaultDay: DeliveryWeekday
    private var overrides: [String: DeliveryCalendarOverride] = [:]

    init(defaultDay: DeliveryWeekday = .wednesday) {
        self.defaultDay = defaultDay
    }

    func defaultDeliveryDayOfWeek() async -> DeliveryWeekday? {
        defaultDay
    }

    func allOverrides() async -> [DeliveryCalendarOverride] {
        overrides.values.sorted { $0.weekKey < $1.weekKey }
    }

    func upsertOverride(_ override: DeliveryCalendarOverride) async -> DeliveryCalendarOverride {
        overrides[override.weekKey] = override
        return override
    }

    func deleteOverride(weekKey: String) async {
        overrides.removeValue(forKey: weekKey)
    }
}
