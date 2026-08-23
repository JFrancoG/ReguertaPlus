import Foundation

/// Canonical ISO calendar for order, delivery, and shift decisions in the Madrid business time zone.
enum OrderBusinessCalendar {
    static let timeZone = TimeZone(identifier: "Europe/Madrid") ?? .current

    static func make(timeZone: TimeZone = OrderBusinessCalendar.timeZone) -> Calendar {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = timeZone
        return calendar
    }
}

struct OrderConsultationCycle: Equatable {
    let weekStart: Date
    let deliveryDate: Date
    let previousWeekKey: String
    let isConsultaPhase: Bool
}

/// Resolves the active weekly order cycle in the supplied business calendar.
///
/// Delivery precedence is a weekly override, the configured weekday, then Wednesday. The consultation interval is
/// closed through the resolved delivery day, and the returned keys use the same calendar and time zone.
func resolveOrderConsultationCycle(
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    now: Date,
    calendar: Calendar
) -> OrderConsultationCycle {
    let weekStart = calendar.startOfDay(
        for: calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
    )
    let today = calendar.startOfDay(for: now)
    let deliveryDate = resolveOrderDeliveryDate(
        weekStart: weekStart,
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        calendar: calendar
    )
    let previousWeek = calendar.date(byAdding: .day, value: -7, to: weekStart) ?? weekStart

    return OrderConsultationCycle(
        weekStart: weekStart,
        deliveryDate: deliveryDate,
        previousWeekKey: orderIsoWeekKey(for: previousWeek, calendar: calendar),
        isConsultaPhase: today >= weekStart && today <= deliveryDate
    )
}

/// Resolves a week's delivery date without allowing consumers to diverge on override or weekday precedence.
func resolveOrderDeliveryDate(
    weekStart: Date,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    calendar: Calendar
) -> Date {
    let normalizedWeekStart = calendar.startOfDay(for: weekStart)
    let weekKey = orderIsoWeekKey(for: normalizedWeekStart, calendar: calendar)
    if let override = deliveryCalendarOverrides.first(where: { $0.weekKey == weekKey }) {
        return calendar.startOfDay(
            for: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1_000)
        )
    }
    let weekday = defaultDeliveryDayOfWeek ?? .wednesday
    return calendar.date(
        byAdding: .day,
        value: weekday.orderWeekdayOffset,
        to: normalizedWeekStart
    ) ?? normalizedWeekStart
}

func resolveMyOrderConsultaWindow(
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts _: [ShiftAssignment],
    now: Date = Date(),
    timeZone: TimeZone = OrderBusinessCalendar.timeZone
) -> MyOrderConsultaWindow {
    let calendar = OrderBusinessCalendar.make(timeZone: timeZone)
    let cycle = resolveOrderConsultationCycle(
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        now: now,
        calendar: calendar
    )
    return MyOrderConsultaWindow(
        isConsultaPhase: cycle.isConsultaPhase,
        previousWeekKey: cycle.previousWeekKey
    )
}

private func orderIsoWeekKey(for date: Date, calendar: Calendar) -> String {
    String(
        format: "%04d-W%02d",
        calendar.component(.yearForWeekOfYear, from: date),
        calendar.component(.weekOfYear, from: date)
    )
}

extension Int64 {
    /// Returns the ISO week key for this timestamp in the canonical Madrid business calendar.
    var isoWeekKey: String {
        let calendar = OrderBusinessCalendar.make()
        let date = Date(timeIntervalSince1970: TimeInterval(self) / 1_000)
        return orderIsoWeekKey(for: date, calendar: calendar)
    }

    /// Returns the delivery weekday for this timestamp in the canonical Madrid business calendar.
    var deliveryWeekday: DeliveryWeekday {
        let calendar = OrderBusinessCalendar.make()
        let weekday = calendar.component(
            .weekday,
            from: Date(timeIntervalSince1970: TimeInterval(self) / 1_000)
        )
        switch weekday {
        case 2: return .monday
        case 3: return .tuesday
        case 4: return .wednesday
        case 5: return .thursday
        case 6: return .friday
        case 7: return .saturday
        default: return .sunday
        }
    }
}

private extension DeliveryWeekday {
    var orderWeekdayOffset: Int {
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
