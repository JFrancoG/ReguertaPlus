import Foundation

/// All coverage UI strings share the catalog; status/action wire values are never displayed directly.
enum CoverageCopy {
    static func text(_ key: String) -> String {
        let catalogKey = "coverage.\(key)"
        return String(localized: String.LocalizationValue(catalogKey))
    }

    static func shiftLabel(_ shift: ShiftCoverageSnapshot.AvailableShift) -> String {
        "\(text(shift.type.rawValue)) · \(shiftDate(shift.scheduledAtMillis))"
    }

    static func shiftDate(_ millis: Int64) -> String {
        Date(timeIntervalSince1970: Double(millis) / 1000).formatted(Date.FormatStyle(
            date: .abbreviated, time: .omitted, timeZone: TimeZone(identifier: "Europe/Madrid") ?? .gmt
        ))
    }

    static func date(_ millis: Int64) -> String {
        Date(timeIntervalSince1970: Double(millis) / 1000).formatted(Date.FormatStyle(
            date: .abbreviated,
            time: .shortened,
            timeZone: TimeZone(identifier: "Europe/Madrid") ?? .gmt
        ))
    }

    static func failure(_ failure: ShiftCoverageFailure) -> String {
        switch failure {
        case .sessionChanged: text("access_lost")
        case .rejected(let status, _): text([401, 403].contains(status) ? "access_lost" : "conflict")
        case .localOnly: text("local_note")
        case .invalidResponse, .unavailable: text("unavailable")
        }
    }
}
