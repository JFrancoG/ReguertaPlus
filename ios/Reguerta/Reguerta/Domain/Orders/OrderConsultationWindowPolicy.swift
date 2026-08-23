import Foundation

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
        previousWeekKey: BusinessCalendar.isoWeekKey(for: previousWeek, calendar: calendar),
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
    let weekKey = BusinessCalendar.isoWeekKey(for: normalizedWeekStart, calendar: calendar)
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
    timeZone: TimeZone = BusinessCalendar.timeZone
) -> MyOrderConsultaWindow {
    let calendar = BusinessCalendar.make(timeZone: timeZone)
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
