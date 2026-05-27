import Foundation
import SwiftUI

extension ShiftsFeatureViewModel {
    var nextDeliveryLeadShift: ShiftAssignment? {
        guard let memberId = currentMember?.id else { return nil }
        return deliveryShifts
            .filter {
                $0.assignedUserIds.first == memberId &&
                    effectiveDateMillis(for: $0) >= currentNowMillis
            }
            .min { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }
    }

    var nextDeliveryHelperShift: ShiftAssignment? {
        guard let memberId = currentMember?.id else { return nil }
        return deliveryShifts
            .filter {
                $0.helperUserId == memberId &&
                    effectiveDateMillis(for: $0) >= currentNowMillis
            }
            .min { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }
    }

    var nextMarketAssignedShift: ShiftAssignment? {
        guard let memberId = currentMember?.id else { return nil }
        return marketShifts
            .filter {
                $0.assignedUserIds.contains(memberId) &&
                    effectiveDateMillis(for: $0) >= currentNowMillis
            }
            .min { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }
    }

    var selectedBoardWindow: ShiftBoardWindow {
        shiftBoardWindow(for: selectedShiftSegment)
    }

    var visibleShiftIdsSignature: String {
        visibleShifts.map(\.id).joined(separator: "|")
    }

    var visibleShiftSwapActivity: VisibleShiftSwapActivity {
        shiftSwapRequests.visibleShiftSwapActivity(
            currentMemberId: currentMember?.id,
            dismissedRequestIds: dismissedShiftSwapRequestIds
        )
    }

    var hasVisibleShiftSwapActivity: Bool {
        visibleShiftSwapActivity.hasContent
    }

    func shiftBoardWindow(for segment: ShiftBoardSegment) -> ShiftBoardWindow {
        let shifts = segment == .delivery ? deliveryShifts : marketShifts
        let today = Calendar.current.startOfDay(
            for: Date(timeIntervalSince1970: TimeInterval(currentNowMillis) / 1_000)
        )
        let highlighted = shifts
            .filter { effectiveDate(for: $0) >= today }
            .min { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }

        return ShiftBoardWindow(
            highlightedShiftId: highlighted?.id
        )
    }

    func deliveryOverride(for shift: ShiftAssignment) -> DeliveryCalendarOverride? {
        guard shift.type == .delivery else { return nil }
        return deliveryCalendarOverrides.first(where: { $0.weekKey == shift.weekKey })
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

    func localizedEffectiveShortDateOnly(_ shift: ShiftAssignment) -> String {
        localizedShortDateOnly(effectiveDateMillis(for: shift))
    }

    func shiftLeftBoardLines(_ shift: ShiftAssignment, tokens: ReguertaDesignTokens) -> [ShiftBoardLine] {
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
            return effectiveMillis > currentNowMillis &&
                shift.assignedUserIds.first == currentMemberId
        case .market:
            return effectiveMillis > currentNowMillis &&
                shift.assignedUserIds.contains(currentMemberId)
        }
    }

    func memberNames(for userIds: [String]) -> String {
        guard let currentSession else {
            return userIds.joined(separator: ", ")
        }
        let names = userIds.map { displayName(for: $0, in: currentSession) }
        return names.isEmpty ? "—" : names.joined(separator: ", ")
    }

    func shiftSummary(_ shift: ShiftAssignment) -> String {
        "\(localizedEffectiveDateTime(shift)) · \(memberNames(for: shift.assignedUserIds))"
    }

    func shiftSwapDisplayLabel(_ shift: ShiftAssignment, memberId _: String?) -> String {
        localizedEffectiveDateOnly(shift)
    }

    func displayNameForSwap(_ userId: String) -> String {
        guard let currentSession else { return userId }
        return displayName(for: userId, in: currentSession)
    }

    func shiftSwapStatusLabel(_ status: ShiftSwapRequestStatus) -> String {
        switch status {
        case .open:
            return ShiftSwapCopy.localized.open
        case .cancelled:
            return ShiftSwapCopy.localized.cancelled
        case .applied:
            return ShiftSwapCopy.localized.applied
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

    func localizedShortDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "dd MMM yyyy"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }
}
