import Foundation

/// Canonical ISO calendar for order, delivery, and shift decisions in the Madrid business time zone.
enum BusinessCalendar {
    static let timeZone: TimeZone = {
        guard let timeZone = TimeZone(identifier: "Europe/Madrid") else {
            preconditionFailure("Reguerta requires the Europe/Madrid business time zone")
        }
        return timeZone
    }()

    static func make(timeZone: TimeZone = BusinessCalendar.timeZone) -> Calendar {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = timeZone
        return calendar
    }

    static func isoWeekKey(for date: Date, calendar: Calendar = BusinessCalendar.make()) -> String {
        String(
            format: "%04d-W%02d",
            calendar.component(.yearForWeekOfYear, from: date),
            calendar.component(.weekOfYear, from: date)
        )
    }

    /// Resolves a strict `YYYY-Www` key without allowing Foundation to normalize impossible weeks.
    static func isoWeekStart(for weekKey: String, calendar: Calendar = BusinessCalendar.make()) -> Date? {
        let parts = weekKey.components(separatedBy: "-W")
        guard parts.count == 2,
              parts[0].count == 4,
              parts[1].count == 2,
              parts[0].allSatisfy({ $0.isASCII && $0.isNumber }),
              parts[1].allSatisfy({ $0.isASCII && $0.isNumber }),
              let year = Int(parts[0]),
              year > 0,
              let week = Int(parts[1]),
              (1...53).contains(week) else {
            return nil
        }

        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        components.yearForWeekOfYear = year
        components.weekOfYear = week
        components.weekday = 2
        guard let date = calendar.date(from: components) else { return nil }
        let weekStart = calendar.startOfDay(for: date)
        return isoWeekKey(for: weekStart, calendar: calendar) == weekKey ? weekStart : nil
    }
}

extension Int64 {
    /// Returns the ISO week key for this timestamp in the canonical Madrid business calendar.
    var isoWeekKey: String {
        let date = Date(timeIntervalSince1970: TimeInterval(self) / 1_000)
        return BusinessCalendar.isoWeekKey(for: date)
    }

    /// Returns the delivery weekday for this timestamp in the canonical Madrid business calendar.
    var deliveryWeekday: DeliveryWeekday {
        let calendar = BusinessCalendar.make()
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
