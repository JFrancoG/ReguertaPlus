import Foundation

/// All coverage UI strings share the catalog; status/action wire values are never displayed directly.
enum CoverageCopy {
    private static let ordinaryDateStyle = Date.ISO8601FormatStyle(timeZone: .gmt)
        .year().month().day().dateSeparator(.dash)
    static func text(_ key: String) -> String {
        let catalogKey = "coverage.\(key)"
        return String(localized: String.LocalizationValue(catalogKey))
    }

    static func creditState(_ state: ShiftCoverageSnapshot.CreditState) -> LocalizedStringResource {
        switch state {
        case .pending: "coverage.credit_pending"
        case .consumed: "coverage.credit_consumed"
        case .cancelled: "coverage.credit_cancelled"
        }
    }

    static func phaseDeadline(_ phase: ShiftCoverageSnapshot.Phase?) -> LocalizedStringResource {
        phase == .adminRequired ? "coverage.admin_deadline" : "coverage.phase_deadline"
    }

    static func shiftLabel(_ shift: ShiftCoverageSnapshot.AvailableShift) -> String {
        "\(text(shift.type.rawValue)) · \(shiftDate(shift.scheduledAtMillis))"
    }

    static func membershipStatus(_ member: ShiftCoverageAdministrationSnapshot.Member) -> String {
        if member.permanentDeparture {
            return text("admin_departure_recorded")
        }
        guard let active = member.sourceActive else { return text("admin_member_missing") }
        return text(
            !active ? "admin_member_inactive" : member.eligible ? "admin_member_eligible" : "admin_member_ineligible"
        )
    }

    static func ordinaryDate(_ value: String) -> Date? {
        guard let date = try? ordinaryDateStyle.parse(value),
              ordinaryDateStyle.format(date) == value else { return nil }
        return date
    }

    static func ordinaryDateLabel(_ value: String) -> String {
        ordinaryDate(value)?.formatted(Date.FormatStyle(date: .abbreviated, time: .omitted, timeZone: .gmt)) ?? value
    }

    static func shiftDate(_ millis: Int64) -> String {
        Date(timeIntervalSince1970: Double(millis) / 1000).formatted(Date.FormatStyle(
            date: .abbreviated,
            time: .omitted,
            timeZone: TimeZone(identifier: "Europe/Madrid") ?? .gmt
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
