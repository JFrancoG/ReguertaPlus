import Foundation

enum DeliveryWeekday: String, CaseIterable, Equatable, Sendable {
    case monday = "MON"
    case tuesday = "TUE"
    case wednesday = "WED"
    case thursday = "THU"
    case friday = "FRI"
    case saturday = "SAT"
    case sunday = "SUN"
}

extension DeliveryWeekday {
    static let calendarExceptionCases: [Self] = [.tuesday, .thursday, .friday]

    var isAllowedCalendarException: Bool { Self.calendarExceptionCases.contains(self) }
}

struct DeliveryCalendarOverride: Equatable {
    let weekKey: String
    let deliveryDateMillis: Int64
    let ordersBlockedDateMillis: Int64
    let ordersOpenAtMillis: Int64
    let ordersCloseAtMillis: Int64
    let updatedBy: String
    let updatedAtMillis: Int64
}

extension DeliveryCalendarOverride {
    /// Builds one persisted exception for a strict ISO week in the canonical Madrid calendar.
    ///
    /// Only Tuesday, Thursday, and Friday are valid exceptions. The resulting instants represent delivery at
    /// midnight, blocking at day +1, reopening at day +2, and closing on Sunday at 23:59:59. Calendar arithmetic
    /// preserves those wall-clock contracts across daylight-saving transitions.
    ///
    /// - Returns: The exception, or `nil` when the weekday or `YYYY-Www` key is invalid or impossible.
    static func weeklyException(
        weekKey: String,
        weekday: DeliveryWeekday,
        updatedByUserId: String,
        updatedAtMillis: Int64
    ) -> Self? {
        guard weekday.isAllowedCalendarException else { return nil }
        let calendar = BusinessCalendar.make()
        guard let weekStart = BusinessCalendar.isoWeekStart(for: weekKey, calendar: calendar),
              let deliveryDate = calendar.date(byAdding: .day, value: weekday.isoWeekdayOffset, to: weekStart),
              let blockedDate = calendar.date(byAdding: .day, value: 1, to: deliveryDate),
              let openDate = calendar.date(byAdding: .day, value: 2, to: deliveryDate),
              let closeBase = calendar.date(byAdding: .day, value: 6, to: weekStart),
              let closeDate = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: closeBase) else {
            return nil
        }

        return Self(
            weekKey: weekKey,
            deliveryDateMillis: deliveryDate.unixMillis,
            ordersBlockedDateMillis: calendar.startOfDay(for: blockedDate).unixMillis,
            ordersOpenAtMillis: calendar.startOfDay(for: openDate).unixMillis,
            ordersCloseAtMillis: closeDate.unixMillis,
            updatedBy: updatedByUserId,
            updatedAtMillis: updatedAtMillis
        )
    }
}

private extension Date {
    var unixMillis: Int64 { Int64(timeIntervalSince1970 * 1_000) }
}

private extension DeliveryWeekday {
    var isoWeekdayOffset: Int {
        switch self {
        case .monday: 0
        case .tuesday: 1
        case .wednesday: 2
        case .thursday: 3
        case .friday: 4
        case .saturday: 5
        case .sunday: 6
        }
    }
}
