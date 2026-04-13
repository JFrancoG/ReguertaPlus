import SwiftUI

extension ContentView {
    func deliveryOverride(for shift: ShiftAssignment) -> DeliveryCalendarOverride? {
        guard shift.type == .delivery else { return nil }
        return viewModel.deliveryCalendarOverrides.first(where: { $0.weekKey == shift.weekKey })
    }

    func effectiveDateMillis(for shift: ShiftAssignment) -> Int64 {
        deliveryOverride(for: shift)?.deliveryDateMillis ?? shift.dateMillis
    }

    func effectiveDate(for shift: ShiftAssignment) -> Date {
        Date(timeIntervalSince1970: TimeInterval(effectiveDateMillis(for: shift)) / 1_000)
    }

    func localizedEffectiveDateTime(_ shift: ShiftAssignment) -> String {
        localizedDateTime(effectiveDateMillis(for: shift))
    }

    func localizedEffectiveDateOnly(_ shift: ShiftAssignment) -> String {
        localizedDateOnly(effectiveDateMillis(for: shift))
    }

    func shiftLeftBoardLines(_ shift: ShiftAssignment) -> [ShiftBoardLine] {
        switch shift.type {
        case .delivery:
            return [
                ShiftBoardLine(
                    text: effectiveDateMillis(for: shift).isoWeekKey,
                    font: tokens.typography.label,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
                ShiftBoardLine(
                    text: effectiveDate(for: shift).boardDateLabel,
                    font: tokens.typography.bodySecondary,
                    weight: .regular,
                    color: tokens.colors.textSecondary
                )
            ]
        case .market:
            let date = effectiveDate(for: shift)
            let monthFormatter = DateFormatter()
            monthFormatter.locale = Locale.current
            monthFormatter.dateFormat = "LLLL"
            let weekdayFormatter = DateFormatter()
            weekdayFormatter.locale = Locale.current
            weekdayFormatter.dateFormat = "EEEE"
            return [
                ShiftBoardLine(
                    text: monthFormatter.string(from: date).capitalized,
                    font: tokens.typography.bodySecondary,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
                ShiftBoardLine(
                    text: weekdayFormatter.string(from: date).capitalized,
                    font: tokens.typography.label,
                    weight: .regular,
                    color: tokens.colors.textSecondary
                ),
                ShiftBoardLine(
                    text: date.dayNumberLabel,
                    font: tokens.typography.titleCard,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                )
            ]
        }
    }

    func canRequestSwapForShift(_ shift: ShiftAssignment, currentMemberId: String) -> Bool {
        let effectiveMillis = effectiveDateMillis(for: shift)
        switch shift.type {
        case .delivery:
            return effectiveMillis > Int64(Date().timeIntervalSince1970 * 1_000) &&
                shift.assignedUserIds.first == currentMemberId
        case .market:
            return effectiveMillis > Int64(Date().timeIntervalSince1970 * 1_000) &&
                shift.assignedUserIds.contains(currentMemberId)
        }
    }

    func memberNames(for userIds: [String]) -> String {
        guard let session = currentHomeSession else {
            return userIds.joined(separator: ", ")
        }
        let names = userIds.map { displayName(for: $0, session: session) }
        return names.isEmpty ? "—" : names.joined(separator: ", ")
    }

    func shiftSummary(_ shift: ShiftAssignment) -> String {
        "\(localizedEffectiveDateTime(shift)) · \(memberNames(for: shift.assignedUserIds))"
    }

    func shiftSwapDisplayLabel(_ shift: ShiftAssignment, memberId: String?) -> String {
        localizedEffectiveDateOnly(shift)
    }

    func displayNameForSwap(_ userId: String) -> String {
        guard let session = currentHomeSession else { return userId }
        return displayName(for: userId, session: session)
    }

    var shiftSwapCopy: ShiftSwapCopy {
        .localized
    }

    func shiftSwapStatusLabel(_ status: ShiftSwapRequestStatus) -> String {
        switch status {
        case .open:
            return shiftSwapCopy.open
        case .cancelled:
            return shiftSwapCopy.cancelled
        case .applied:
            return shiftSwapCopy.applied
        }
    }
    func localizedDateTime(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    func localizedDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }
}
