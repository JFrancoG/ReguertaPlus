import Foundation

func buildDeliveryCalendarOverride(
    weekKey: String,
    weekday: DeliveryWeekday,
    updatedByUserId: String,
    updatedAtMillis: Int64
) -> DeliveryCalendarOverride? {
    guard let weekStart = isoWeekStartDate(from: weekKey) else {
        return nil
    }
    let deliveryDate = Calendar.current.date(byAdding: .day, value: weekday.dayOffset, to: weekStart) ?? weekStart
    let blockedDate = Calendar.current.date(byAdding: .day, value: 1, to: deliveryDate) ?? deliveryDate
    let openDate = Calendar.current.date(byAdding: .day, value: 2, to: deliveryDate) ?? deliveryDate
    let closeBase = Calendar.current.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
    let openStartOfDay = Calendar.current.startOfDay(for: openDate)
    let closeDate = Calendar.current.date(
        bySettingHour: 23,
        minute: 59,
        second: 59,
        of: closeBase
    ) ?? closeBase

    return DeliveryCalendarOverride(
        weekKey: weekKey,
        deliveryDateMillis: Int64(deliveryDate.timeIntervalSince1970 * 1_000),
        ordersBlockedDateMillis: Int64(Calendar.current.startOfDay(for: blockedDate).timeIntervalSince1970 * 1_000),
        ordersOpenAtMillis: Int64(openStartOfDay.timeIntervalSince1970 * 1_000),
        ordersCloseAtMillis: Int64(closeDate.timeIntervalSince1970 * 1_000),
        updatedBy: updatedByUserId,
        updatedAtMillis: updatedAtMillis
    )
}

func isoWeekStartDate(from weekKey: String) -> Date? {
    let parts = weekKey.components(separatedBy: "-W")
    guard parts.count == 2,
          let year = Int(parts[0]),
          let week = Int(parts[1])
    else {
        return nil
    }
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = .current
    var dateComponents = DateComponents()
    dateComponents.weekOfYear = week
    dateComponents.yearForWeekOfYear = year
    dateComponents.weekday = 2
    return calendar.date(from: dateComponents).map { calendar.startOfDay(for: $0) }
}

private extension DeliveryWeekday {
    var dayOffset: Int {
        switch self {
        case .monday: return 0
        case .tuesday: return 1
        case .wednesday: return 2
        case .thursday: return 3
        case .friday: return 4
        case .saturday: return 5
        case .sunday: return 6
        }
    }
}
