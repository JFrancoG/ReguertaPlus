import SwiftUI

extension NotificationAudience {
    var titleKey: String {
        switch self {
        case .all:
            return AccessL10nKey.notificationsTargetAll
        case .members:
            return AccessL10nKey.notificationsTargetMembers
        case .producers:
            return AccessL10nKey.notificationsTargetProducers
        case .admins:
            return AccessL10nKey.notificationsTargetAdmins
        }
    }
}

extension NotificationEvent {
    var audienceTitleKey: String {
        switch (target, segmentType, targetRole) {
        case ("all", _, _):
            return AccessL10nKey.notificationsTargetAll
        case ("users", _, _):
            return AccessL10nKey.notificationsTargetUsers
        case ("segment", "role"?, .member?):
            return AccessL10nKey.notificationsTargetMembers
        case ("segment", "role"?, .producer?):
            return AccessL10nKey.notificationsTargetProducers
        case ("segment", "role"?, .admin?):
            return AccessL10nKey.notificationsTargetAdmins
        default:
            return AccessL10nKey.notificationsTargetAll
        }
    }
}

extension ShiftType {
    var titleKey: String {
        switch self {
        case .delivery:
            return AccessL10nKey.shiftsTypeDelivery
        case .market:
            return AccessL10nKey.shiftsTypeMarket
        }
    }
}

enum ShiftBoardSegment: CaseIterable {
    case delivery
    case market

    var titleKey: String {
        switch self {
        case .delivery:
            return AccessL10nKey.shiftsTypeDelivery
        case .market:
            return AccessL10nKey.shiftsTypeMarket
        }
    }
}

struct ShiftBoardLine {
    let text: String
    let font: Font
    let weight: Font.Weight
    let color: Color
}
extension ShiftAssignment {
    private var localDate: Date {
        Date(timeIntervalSince1970: TimeInterval(dateMillis) / 1_000)
    }

    func boardNames(session: AuthorizedSession?) -> [String] {
        switch type {
        case .delivery:
            var names: [String] = []
            if let firstAssigned = assignedUserIds.first {
                names.append(displayName(for: firstAssigned, session: session))
            }
            names.append(
                helperUserId.map { displayName(for: $0, session: session) } ?? "—"
            )
            return names.isEmpty ? ["—", "—"] : names
        case .market:
            let names = assignedUserIds.map { displayName(for: $0, session: session) }
            if names.isEmpty {
                return ["—", "—", "—"]
            }
            return Array((names + Array(repeating: "—", count: max(0, 3 - names.count))).prefix(3))
        }
    }

    func highlightedBoardNameIndex(for currentMemberId: String) -> Int? {
        switch type {
        case .delivery:
            if assignedUserIds.first == currentMemberId {
                return 0
            }
            if helperUserId == currentMemberId {
                return 1
            }
            return nil
        case .market:
            let index = assignedUserIds.firstIndex(of: currentMemberId)
            return index.map { min($0, 2) }
        }
    }

    var weekKey: String {
        let calendar = Calendar(identifier: .iso8601)
        let week = calendar.component(.weekOfYear, from: localDate)
        let year = calendar.component(.yearForWeekOfYear, from: localDate)
        return String(format: "%04d-W%02d", year, week)
    }

    private var boardDateLabel: String {
        localDate.boardDateLabel
    }

    private var shortMonthLabel: String {
        localDate.shortMonthLabel
    }

    private var dayNumberLabel: String {
        localDate.dayNumberLabel
    }

    private func displayName(for memberId: String, session: AuthorizedSession?) -> String {
        session?.members.first(where: { $0.id == memberId })?.displayName ?? memberId
    }
}

extension ShiftSwapRequest {
    var availableResponses: [ShiftSwapResponse] {
        responses.filter { $0.status == .available }
    }
}

extension DeliveryWeekday {
    var titleKey: String {
        switch self {
        case .monday: AccessL10nKey.weekdayMonday
        case .tuesday: AccessL10nKey.weekdayTuesday
        case .wednesday: AccessL10nKey.weekdayWednesday
        case .thursday: AccessL10nKey.weekdayThursday
        case .friday: AccessL10nKey.weekdayFriday
        case .saturday: AccessL10nKey.weekdaySaturday
        case .sunday: AccessL10nKey.weekdaySunday
        }
    }

    var previous: DeliveryWeekday {
        let all = DeliveryWeekday.allCases
        return all[(all.firstIndex(of: self)! + all.count - 1) % all.count]
    }

    var next: DeliveryWeekday {
        let all = DeliveryWeekday.allCases
        return all[(all.firstIndex(of: self)! + 1) % all.count]
    }
}

extension Int64 {
    var isoWeekKey: String {
        let calendar = Calendar(identifier: .iso8601)
        let date = Date(timeIntervalSince1970: TimeInterval(self) / 1_000)
        let week = calendar.component(.weekOfYear, from: date)
        let year = calendar.component(.yearForWeekOfYear, from: date)
        return String(format: "%04d-W%02d", year, week)
    }

    var deliveryWeekday: DeliveryWeekday {
        let weekday = Calendar.current.component(.weekday, from: Date(timeIntervalSince1970: TimeInterval(self) / 1_000))
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

extension Date {
    var boardDateLabel: String {
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.locale = Locale.current
        weekdayFormatter.dateFormat = "EEE"
        let weekday = weekdayFormatter.string(from: self)
            .replacingOccurrences(of: ".", with: "")
            .capitalized
        return "\(weekday) \(dayNumberLabel) \(shortMonthLabel)"
    }

    var shortMonthLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "MMM"
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "")
    }

    var dayNumberLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "d"
        return formatter.string(from: self)
    }
}

extension ShiftStatus {
    var titleKey: String {
        switch self {
        case .planned:
            return AccessL10nKey.shiftsStatusPlanned
        case .swapPending:
            return AccessL10nKey.shiftsStatusSwapPending
        case .confirmed:
            return AccessL10nKey.shiftsStatusConfirmed
        }
    }
}
