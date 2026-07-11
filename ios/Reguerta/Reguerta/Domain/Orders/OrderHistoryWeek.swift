import Foundation

struct OrderHistoryWeekOption: Identifiable, Equatable, Sendable {
    let weekKey: String
    let weekYear: Int
    let weekNumber: Int
    let rangeLabel: String

    var id: String { weekKey }
    var title: String { "\(weekYear) Semana \(weekNumber)" }
    var shortYearWeekLabel: String { "\(weekYear) Sem \(weekNumber)" }
    var pickerLabel: String { "\(rangeLabel) · \(shortYearWeekLabel)" }
    var orderTitle: String { "Pedido \(rangeLabel)" }
}

extension String {
    var isValidIsoWeekKey: Bool {
        let parts = components(separatedBy: "-W")
        guard parts.count == 2,
              parts[0].count == 4,
              let week = Int(parts[1]) else {
            return false
        }
        return (1...53).contains(week)
    }
}

func orderHistoryPreviousIsoWeekKey(
    nowMillis: Int64,
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current
) -> String {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = timeZone
    let now = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let currentWeekStart = orderHistoryWeekStart(for: now, calendar: calendar)
    let previousWeekStart = calendar.date(byAdding: .day, value: -7, to: currentWeekStart) ?? currentWeekStart
    return orderHistoryWeekKey(for: previousWeekStart, calendar: calendar)
}

func orderHistoryContinuousWeekOptions(
    realWeekKeys: [String],
    preferredWeekKey: String,
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current,
    locale: Locale = Locale(identifier: "es_ES")
) -> [OrderHistoryWeekOption] {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = timeZone
    let seedWeekKeys = Set(realWeekKeys.filter(\.isValidIsoWeekKey) + [preferredWeekKey].filter(\.isValidIsoWeekKey))
    let starts = seedWeekKeys.compactMap { orderHistoryWeekStart(forWeekKey: $0, calendar: calendar) }.sorted()
    guard let firstStart = starts.first, let lastStart = starts.last else {
        return []
    }

    var options: [OrderHistoryWeekOption] = []
    var cursor = firstStart
    while cursor <= lastStart {
        options.append(orderHistoryWeekOption(for: cursor, calendar: calendar, locale: locale))
        cursor = calendar.date(byAdding: .day, value: 7, to: cursor) ?? cursor.addingTimeInterval(7 * 24 * 60 * 60)
    }
    return options
}

func orderHistoryBrowsableWeekOptions(
    realWeekKeys: [String],
    oldestOrderWeekKey: String? = nil,
    preferredWeekKey: String,
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current,
    locale: Locale = Locale(identifier: "es_ES")
) -> [OrderHistoryWeekOption] {
    let validRealWeekKeys = realWeekKeys.filter(\.isValidIsoWeekKey)
    let validOldestOrderWeekKey = oldestOrderWeekKey?.isValidIsoWeekKey == true ? oldestOrderWeekKey : nil
    let firstWeekKey: String?
    if let earliestKnownWeekKey = (validRealWeekKeys + [validOldestOrderWeekKey].compactMap { $0 }).min() {
        firstWeekKey = earliestKnownWeekKey
    } else if preferredWeekKey.isValidIsoWeekKey,
              let preferredYear = Int(preferredWeekKey.prefix(4)) {
        firstWeekKey = String(format: "%04d-W01", preferredYear)
    } else {
        firstWeekKey = nil
    }

    return orderHistoryContinuousWeekOptions(
        realWeekKeys: validRealWeekKeys + [firstWeekKey].compactMap { $0 },
        preferredWeekKey: preferredWeekKey,
        timeZone: timeZone,
        locale: locale
    )
}

func orderHistoryWeekOption(
    weekKey: String,
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current,
    locale: Locale = Locale(identifier: "es_ES")
) -> OrderHistoryWeekOption? {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = timeZone
    guard let start = orderHistoryWeekStart(forWeekKey: weekKey, calendar: calendar) else {
        return nil
    }
    return orderHistoryWeekOption(for: start, calendar: calendar, locale: locale)
}

private func orderHistoryWeekOption(
    for weekStart: Date,
    calendar: Calendar,
    locale: Locale
) -> OrderHistoryWeekOption {
    let weekEnd = calendar.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
    let weekNumber = calendar.component(.weekOfYear, from: weekStart)
    let weekYear = calendar.component(.yearForWeekOfYear, from: weekStart)
    return OrderHistoryWeekOption(
        weekKey: orderHistoryWeekKey(for: weekStart, calendar: calendar),
        weekYear: weekYear,
        weekNumber: weekNumber,
        rangeLabel: "\(orderHistoryShortDayMonth(weekStart, locale: locale)) - \(orderHistoryShortDayMonth(weekEnd, locale: locale))"
    )
}

private func orderHistoryWeekStart(for date: Date, calendar: Calendar) -> Date {
    calendar.startOfDay(for: calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date)
}

private func orderHistoryWeekStart(forWeekKey weekKey: String, calendar: Calendar) -> Date? {
    let parts = weekKey.components(separatedBy: "-W")
    guard parts.count == 2,
          let year = Int(parts[0]),
          let week = Int(parts[1]) else {
        return nil
    }
    var components = DateComponents()
    components.calendar = calendar
    components.timeZone = calendar.timeZone
    components.yearForWeekOfYear = year
    components.weekOfYear = week
    components.weekday = 2
    guard let date = calendar.date(from: components) else {
        return nil
    }
    let start = calendar.startOfDay(for: date)
    return orderHistoryWeekKey(for: start, calendar: calendar) == weekKey ? start : nil
}

private func orderHistoryWeekKey(for date: Date, calendar: Calendar) -> String {
    String(
        format: "%04d-W%02d",
        calendar.component(.yearForWeekOfYear, from: date),
        calendar.component(.weekOfYear, from: date)
    )
}

private func orderHistoryShortDayMonth(_ date: Date, locale: Locale) -> String {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.setLocalizedDateFormatFromTemplate("d MMM")
    return formatter.string(from: date)
        .replacingOccurrences(of: ".", with: "")
}
